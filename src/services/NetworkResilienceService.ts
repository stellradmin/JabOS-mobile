/**
 * Network Resilience Service
 * Handles offline/online state management, request queuing, and connection monitoring
 * Implements the Observer pattern for network state notifications
 */
import NetInfo from '@react-native-community/netinfo';
import { secureStorage } from '../utils/secure-storage';
import { StellerError, ErrorCategory } from '../types/error-types';
import { trackError } from '../lib/sentry-enhanced';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Network connection state
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  strength: 'poor' | 'moderate' | 'excellent';
  timestamp: Date;
}

// Queued request for offline scenarios
export interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  category: 'messaging' | 'matching' | 'profile' | 'auth' | 'general';
  metadata?: Record<string, any>;
}

// Network listener callback
export type NetworkStateListener = (networkState: NetworkState) => void;

// Request queue configuration
interface QueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelayMs: number;
  enablePersistence: boolean;
  batchSize: number;
  priorityOrder: Array<QueuedRequest['priority']>;
}

// Connection monitoring configuration
interface MonitoringConfig {
  pingIntervalMs: number;
  pingTimeoutMs: number;
  pingUrls: string[];
  strengthThresholds: {
    poor: number;
    moderate: number;
  };
}

class NetworkResilienceService {
  private static instance: NetworkResilienceService;
  private currentNetworkState: NetworkState;
  private listeners: Set<NetworkStateListener> = new Set();
  private requestQueue: QueuedRequest[] = [];
  private queueConfig: QueueConfig;
  private monitoringConfig: MonitoringConfig;
  private unsubscribeNetInfo?: () => void;
  private pingInterval?: NodeJS.Timeout;
  private isProcessingQueue = false;

  private constructor() {
    this.currentNetworkState = {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      strength: 'poor',
      timestamp: new Date(),
    };

    this.queueConfig = {
      maxQueueSize: 100,
      maxRetries: 3,
      retryDelayMs: 5000,
      enablePersistence: true,
      batchSize: 10,
      priorityOrder: ['critical', 'high', 'medium', 'low'],
    };

    this.monitoringConfig = {
      pingIntervalMs: 30000, // 30 seconds
      pingTimeoutMs: 5000,
      pingUrls: [
        'https://httpbin.org/status/200',
        'https://www.google.com/generate_204',
      ],
      strengthThresholds: {
        poor: 1000, // >1s response time
        moderate: 500, // 500ms-1s response time
      },
    };

    this.initializeNetworkMonitoring();
  }

  static getInstance(): NetworkResilienceService {
    if (!NetworkResilienceService.instance) {
      NetworkResilienceService.instance = new NetworkResilienceService();
    }
    return NetworkResilienceService.instance;
  }

  /**
   * Initialize network state monitoring
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // Get initial network state
      const netInfoState = await NetInfo.fetch();
      this.updateNetworkState(netInfoState);

      // Subscribe to network state changes
      this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
        this.updateNetworkState(state);
      });

      // Start periodic connection strength monitoring
      this.startConnectionMonitoring();

      // Load persisted queue
      await this.loadQueueFromStorage();

    } catch (error) {
      logWarn('Failed to initialize network monitoring:', "Warning", error);
    }
  }

  /**
   * Update network state and notify listeners
   */
  private updateNetworkState(netInfoState: any): void {
    const previousState = { ...this.currentNetworkState };
    
    this.currentNetworkState = {
      isConnected: netInfoState.isConnected ?? false,
      isInternetReachable: netInfoState.isInternetReachable ?? false,
      type: netInfoState.type || 'unknown',
      strength: 'moderate', // Will be updated by ping tests
      timestamp: new Date(),
    };

    // If we just came back online, process the queue
    if (this.currentNetworkState.isConnected && !previousState.isConnected) {
      this.processQueueWhenOnline();
    }

    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Start periodic connection strength monitoring
   */
  private startConnectionMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(async () => {
      if (this.currentNetworkState.isConnected) {
        const strength = await this.measureConnectionStrength();
        
        if (strength !== this.currentNetworkState.strength) {
          this.currentNetworkState.strength = strength;
          this.currentNetworkState.timestamp = new Date();
          this.notifyListeners();
        }
      }
    }, this.monitoringConfig.pingIntervalMs);
  }

  /**
   * Measure connection strength using ping tests
   */
  private async measureConnectionStrength(): Promise<'poor' | 'moderate' | 'excellent'> {
    try {
      const startTime = Date.now();
      
      // Try to fetch a lightweight endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.monitoringConfig.pingTimeoutMs);

      try {
        await fetch(this.monitoringConfig.pingUrls[0], {
          method: 'HEAD',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const responseTime = Date.now() - startTime;

      if (responseTime > this.monitoringConfig.strengthThresholds.poor) {
        return 'poor';
      } else if (responseTime > this.monitoringConfig.strengthThresholds.moderate) {
        return 'moderate';
      } else {
        return 'excellent';
      }
    } catch (error) {
      return 'poor';
    }
  }

  /**
   * Add network state listener
   */
  addNetworkStateListener(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);
    
    // Call immediately with current state
    listener(this.currentNetworkState);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of network state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentNetworkState);
      } catch (error) {
        logWarn('Network state listener error:', "Warning", error);
      }
    });
  }

  /**
   * Queue request for later execution when online
   */
  async queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const queuedRequest: QueuedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
      ...request,
    };

    // Check queue size limit
    if (this.requestQueue.length >= this.queueConfig.maxQueueSize) {
      // Remove oldest low priority request
      const lowPriorityIndex = this.requestQueue.findIndex(req => req.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.requestQueue.splice(lowPriorityIndex, 1);
      } else {
        // Remove oldest request if no low priority ones found
        this.requestQueue.shift();
      }
    }

    // Insert request based on priority
    const insertIndex = this.findInsertIndex(queuedRequest.priority);
    this.requestQueue.splice(insertIndex, 0, queuedRequest);

    // Persist queue if enabled
    if (this.queueConfig.enablePersistence) {
      await this.saveQueueToStorage();
    }

    // Try to process queue if online
    if (this.currentNetworkState.isConnected) {
      this.processQueueWhenOnline();
    }

    return queuedRequest.id;
  }

  /**
   * Find insertion index based on priority
   */
  private findInsertIndex(priority: QueuedRequest['priority']): number {
    const priorityValue = this.queueConfig.priorityOrder.indexOf(priority);
    
    for (let i = 0; i < this.requestQueue.length; i++) {
      const currentPriorityValue = this.queueConfig.priorityOrder.indexOf(this.requestQueue[i].priority);
      if (priorityValue < currentPriorityValue) {
        return i;
      }
    }
    
    return this.requestQueue.length;
  }

  /**
   * Process queued requests when online
   */
  private async processQueueWhenOnline(): Promise<void> {
    if (this.isProcessingQueue || !this.currentNetworkState.isConnected) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const batch = this.requestQueue.splice(0, this.queueConfig.batchSize);
      
      for (const request of batch) {
        try {
          await this.executeQueuedRequest(request);
        } catch (error) {
          await this.handleQueuedRequestFailure(request, error as Error);
        }
      }

      // Continue processing if there are more requests
      if (this.requestQueue.length > 0 && this.currentNetworkState.isConnected) {
        setTimeout(() => this.processQueueWhenOnline(), 1000);
      }

      // Update persisted queue
      if (this.queueConfig.enablePersistence) {
        await this.saveQueueToStorage();
      }

    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a queued request
   */
  private async executeQueuedRequest(request: QueuedRequest): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Track successful request execution
      logDebug(`Successfully executed queued request: ${request.id}`, "Debug");
      
      return result;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle failure of queued request execution
   */
  private async handleQueuedRequestFailure(request: QueuedRequest, error: Error): Promise<void> {
    request.retryCount++;

    if (request.retryCount < request.maxRetries) {
      // Re-queue for retry
      const insertIndex = this.findInsertIndex(request.priority);
      this.requestQueue.splice(insertIndex, 0, request);
      
      trackError(error, {
        queued_request_id: request.id,
        retry_count: request.retryCount,
        request_category: request.category,
        error_type: 'queued_request_retry',
      });
    } else {
      // Max retries exceeded - track as failed
      trackError(error, {
        queued_request_id: request.id,
        retry_count: request.retryCount,
        request_category: request.category,
        error_type: 'queued_request_failed',
      });
      
      logError(`Queued request failed after ${request.retryCount} retries:`, "Error", request.id);
    }
  }

  /**
   * Get current network state
   */
  getCurrentNetworkState(): NetworkState {
    return { ...this.currentNetworkState };
  }

  /**
   * Check if network is in good condition for heavy operations
   */
  isNetworkSuitable(operation: 'light' | 'medium' | 'heavy' = 'medium'): boolean {
    if (!this.currentNetworkState.isConnected || !this.currentNetworkState.isInternetReachable) {
      return false;
    }

    switch (operation) {
      case 'light':
        return true; // Any connection is suitable for light operations
      case 'medium':
        return this.currentNetworkState.strength !== 'poor';
      case 'heavy':
        return this.currentNetworkState.strength === 'excellent';
      default:
        return false;
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalRequests: number;
    requestsByPriority: Record<string, number>;
    requestsByCategory: Record<string, number>;
    isProcessing: boolean;
  } {
    const requestsByPriority: Record<string, number> = {};
    const requestsByCategory: Record<string, number> = {};

    this.requestQueue.forEach(request => {
      requestsByPriority[request.priority] = (requestsByPriority[request.priority] || 0) + 1;
      requestsByCategory[request.category] = (requestsByCategory[request.category] || 0) + 1;
    });

    return {
      totalRequests: this.requestQueue.length,
      requestsByPriority,
      requestsByCategory,
      isProcessing: this.isProcessingQueue,
    };
  }

  /**
   * Clear request queue
   */
  async clearQueue(category?: QueuedRequest['category']): Promise<void> {
    if (category) {
      this.requestQueue = this.requestQueue.filter(req => req.category !== category);
    } else {
      this.requestQueue = [];
    }

    if (this.queueConfig.enablePersistence) {
      await this.saveQueueToStorage();
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      const queueData = JSON.stringify(this.requestQueue);
      await secureStorage.storeSecureItem('network_request_queue', queueData);
    } catch (error) {
      logWarn('Failed to save request queue to storage:', "Warning", error);
    }
  }

  /**
   * Load queue from persistent storage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const queueData = await secureStorage.getSecureItem('network_request_queue');
      if (queueData) {
        const parsedQueue: QueuedRequest[] = JSON.parse(queueData);
        
        // Filter out expired requests (older than 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.requestQueue = parsedQueue.filter(req => 
          new Date(req.timestamp) > oneDayAgo
        );
      }
    } catch (error) {
      logWarn('Failed to load request queue from storage:', "Warning", error);
    }
  }

  /**
   * Create network-aware HTTP client wrapper
   */
  createNetworkAwareClient() {
    return {
      get: (url: string, options?: any) => this.networkAwareRequest('GET', url, options),
      post: (url: string, options?: any) => this.networkAwareRequest('POST', url, options),
      put: (url: string, options?: any) => this.networkAwareRequest('PUT', url, options),
      delete: (url: string, options?: any) => this.networkAwareRequest('DELETE', url, options),
      patch: (url: string, options?: any) => this.networkAwareRequest('PATCH', url, options),
    };
  }

  /**
   * Network-aware request method
   */
  private async networkAwareRequest(
    method: QueuedRequest['method'],
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: any;
      priority?: QueuedRequest['priority'];
      category?: QueuedRequest['category'];
      queueIfOffline?: boolean;
    } = {}
  ): Promise<any> {
    // If offline and queuing is enabled, queue the request
    if (!this.currentNetworkState.isConnected && options.queueIfOffline !== false) {
      return await this.queueRequest({
        url,
        method,
        headers: options.headers,
        body: options.body,
        priority: options.priority || 'medium',
        category: options.category || 'general',
        maxRetries: this.queueConfig.maxRetries,
      });
    }

    // If online but poor connection and this is a heavy operation, consider queuing
    if (this.currentNetworkState.strength === 'poor' && options.priority === 'low') {
      return await this.queueRequest({
        url,
        method,
        headers: options.headers,
        body: options.body,
        priority: options.priority,
        category: options.category || 'general',
        maxRetries: 1, // Less retries for low priority when connection is poor
      });
    }

    // Execute immediately
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.listeners.clear();
    this.requestQueue = [];
  }
}

export default NetworkResilienceService;
