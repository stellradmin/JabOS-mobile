import { AppState, DeviceEventEmitter, NativeEventEmitter } from 'react-native';
import { secureStorage } from '../utils/secure-storage';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/logger';
import * as Battery from 'expo-battery';

interface PerformanceMetrics {
  messageRenderTime: number;
  scrollPerformance: number;
  memoryUsage: number;
  networkLatency: number;
  batteryDrain: number;
  subscriptionCount: number;
}

interface OptimizationSettings {
  enableImageCaching: boolean;
  compressMedia: boolean;
  limitConcurrentUploads: number;
  backgroundSyncInterval: number;
  messagePreloadCount: number;
  enableBatteryOptimization: boolean;
  adaptiveQuality: boolean;
}

interface NetworkOptimization {
  connectionType: string;
  isMetered: boolean;
  adaptiveSettings: {
    messageLoadCount: number;
    mediaQuality: 'low' | 'medium' | 'high';
    preloadMedia: boolean;
    enableRealtime: boolean;
  };
}

class MessagingPerformanceService {
  private metrics: PerformanceMetrics = {
    messageRenderTime: 0,
    scrollPerformance: 0,
    memoryUsage: 0,
    networkLatency: 0,
    batteryDrain: 0,
    subscriptionCount: 0,
  };

  private settings: OptimizationSettings = {
    enableImageCaching: true,
    compressMedia: true,
    limitConcurrentUploads: 3,
    backgroundSyncInterval: 30000,
    messagePreloadCount: 50,
    enableBatteryOptimization: true,
    adaptiveQuality: true,
  };

  private networkOptimization: NetworkOptimization = {
    connectionType: 'unknown',
    isMetered: false,
    adaptiveSettings: {
      messageLoadCount: 50,
      mediaQuality: 'high',
      preloadMedia: true,
      enableRealtime: true,
    },
  };

  private performanceInterval?: NodeJS.Timeout;
  private subscriptions: Set<string> = new Set();
  private renderStartTimes: Map<string, number> = new Map();
  private networkQueue: Array<{ id: string; priority: number; task: () => Promise<void> }> = [];
  private isProcessingQueue = false;

  constructor() {
    this.initializePerformanceMonitoring();
    this.loadSettings();
  }

  // Initialize performance monitoring
  private async initializePerformanceMonitoring(): Promise<void> {
    try {
      // Monitor network changes
      NetInfo.addEventListener(state => {
        this.updateNetworkOptimization(state);
      });

      // Monitor app state changes
      AppState.addEventListener('change', this.handleAppStateChange);

      // Start performance metrics collection
      this.startMetricsCollection();

      // Load initial network state
      const netInfo = await NetInfo.fetch();
      this.updateNetworkOptimization(netInfo);

      logger.info('Messaging performance monitoring initialized', undefined, {}, 'PERFORMANCE');
    } catch (error) {
      logger.error('Failed to initialize performance monitoring', error instanceof Error ? error : undefined, {}, 'PERFORMANCE');
    }
  }

  // Network optimization
  private updateNetworkOptimization(state: any): void {
    const wasOptimized = this.isLowPerformanceMode();
    
    this.networkOptimization.connectionType = state.type || 'unknown';
    this.networkOptimization.isMetered = state.details?.isConnectionExpensive || false;

    // Adapt settings based on network conditions
    if (state.type === 'cellular' && state.details?.cellularGeneration === '2g') {
      this.networkOptimization.adaptiveSettings = {
        messageLoadCount: 20,
        mediaQuality: 'low',
        preloadMedia: false,
        enableRealtime: false,
      };
    } else if (state.type === 'cellular' && state.details?.cellularGeneration === '3g') {
      this.networkOptimization.adaptiveSettings = {
        messageLoadCount: 30,
        mediaQuality: 'medium',
        preloadMedia: false,
        enableRealtime: true,
      };
    } else if (state.type === 'cellular' && this.networkOptimization.isMetered) {
      this.networkOptimization.adaptiveSettings = {
        messageLoadCount: 40,
        mediaQuality: 'medium',
        preloadMedia: true,
        enableRealtime: true,
      };
    } else {
      this.networkOptimization.adaptiveSettings = {
        messageLoadCount: 50,
        mediaQuality: 'high',
        preloadMedia: true,
        enableRealtime: true,
      };
    }

    const isNowOptimized = this.isLowPerformanceMode();
    if (wasOptimized !== isNowOptimized) {
      DeviceEventEmitter.emit('messaging:performance_mode_changed', {
        isOptimized: isNowOptimized,
        settings: this.networkOptimization.adaptiveSettings,
      });
    }

    logger.info('Network optimization updated', undefined, {
      connectionType: state.type,
      isMetered: this.networkOptimization.isMetered,
      settings: this.networkOptimization.adaptiveSettings,
    }, 'PERFORMANCE');
  }

  // App state handling
  private handleAppStateChange = (nextAppState: string): void => {
    if (nextAppState === 'background') {
      this.optimizeForBackground();
    } else if (nextAppState === 'active') {
      this.optimizeForForeground();
    }
  };

  // Performance metrics collection
  private startMetricsCollection(): void {
    this.performanceInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 10000); // Collect every 10 seconds
  }

  private async collectPerformanceMetrics(): Promise<void> {
    try {
      // Memory usage
      if ((global as any).__DEV__ && (global as any).performance?.memory) {
        this.metrics.memoryUsage = (global as any).performance.memory.usedJSHeapSize / 1024 / 1024; // MB
      }

      // Battery level (if available)
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        const batteryState = await Battery.getBatteryStateAsync();
        this.metrics.batteryDrain = batteryLevel < 0.2 && batteryState === Battery.BatteryState.UNPLUGGED ? 1 : 0;
      } catch {
        // Battery API not available on all devices
      }

      // Network latency (simple ping to Supabase)
      const latencyStart = Date.now();
      try {
        await fetch('https://your-supabase-url.supabase.co/rest/v1/', { method: 'HEAD' });
        this.metrics.networkLatency = Date.now() - latencyStart;
      } catch {
        this.metrics.networkLatency = 9999; // High latency for failed requests
      }

      this.metrics.subscriptionCount = this.subscriptions.size;

      // Adjust settings based on metrics
      this.adaptSettingsBasedOnMetrics();

    } catch (error) {
      logger.error('Failed to collect performance metrics', error instanceof Error ? error : undefined, {}, 'PERFORMANCE');
    }
  }

  // Render performance tracking
  startMessageRenderTracking(messageId: string): void {
    this.renderStartTimes.set(messageId, Date.now());
  }

  endMessageRenderTracking(messageId: string): number {
    const startTime = this.renderStartTimes.get(messageId);
    if (startTime) {
      const renderTime = Date.now() - startTime;
      this.metrics.messageRenderTime = renderTime;
      this.renderStartTimes.delete(messageId);
      
      // Warn about slow renders
      if (renderTime > 100) {
        logger.warn('Slow message render detected', undefined, { messageId, renderTime }, 'PERFORMANCE');
      }
      
      return renderTime;
    }
    return 0;
  }

  // Scroll performance tracking
  trackScrollPerformance(fps: number): void {
    this.metrics.scrollPerformance = fps;
    
    if (fps < 30) {
      logger.warn('Poor scroll performance detected', undefined, { fps }, 'PERFORMANCE');
      this.optimizeForLowPerformance();
    }
  }

  // Network queue management
  queueNetworkTask(id: string, task: () => Promise<void>, priority: number = 1): void {
    this.networkQueue.push({ id, task, priority });
    this.networkQueue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessingQueue) {
      this.processNetworkQueue();
    }
  }

  private async processNetworkQueue(): Promise<void> {
    this.isProcessingQueue = true;
    
    while (this.networkQueue.length > 0) {
      const maxConcurrent = this.settings.limitConcurrentUploads;
      const batch = this.networkQueue.splice(0, maxConcurrent);
      
      try {
        await Promise.all(batch.map(item => item.task()));
      } catch (error) {
        logger.error('Network queue processing error', error instanceof Error ? error : undefined, {}, 'PERFORMANCE');
      }
      
      // Add delay between batches on slow networks
      if (this.metrics.networkLatency > 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.isProcessingQueue = false;
  }

  // Subscription management
  registerSubscription(subscriptionId: string): void {
    this.subscriptions.add(subscriptionId);
    
    // Limit concurrent subscriptions for performance
    if (this.subscriptions.size > 10) {
      logger.warn('High subscription count detected', undefined, { count: this.subscriptions.size }, 'PERFORMANCE');
    }
  }

  unregisterSubscription(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  // Adaptive settings
  private adaptSettingsBasedOnMetrics(): void {
    const shouldOptimize = this.shouldOptimizePerformance();
    
    if (shouldOptimize && !this.isLowPerformanceMode()) {
      this.optimizeForLowPerformance();
    } else if (!shouldOptimize && this.isLowPerformanceMode()) {
      this.optimizeForHighPerformance();
    }
  }

  private shouldOptimizePerformance(): boolean {
    return (
      this.metrics.memoryUsage > 150 || // > 150MB memory usage
      this.metrics.networkLatency > 2000 || // > 2s network latency
      this.metrics.batteryDrain > 0 || // Low battery
      this.metrics.scrollPerformance < 30 || // < 30 FPS
      this.subscriptions.size > 15 // Too many subscriptions
    );
  }

  private isLowPerformanceMode(): boolean {
    return (
      this.networkOptimization.adaptiveSettings.messageLoadCount < 40 ||
      this.networkOptimization.adaptiveSettings.mediaQuality === 'low' ||
      !this.networkOptimization.adaptiveSettings.preloadMedia
    );
  }

  // Optimization modes
  private optimizeForLowPerformance(): void {
    this.settings.messagePreloadCount = 20;
    this.settings.limitConcurrentUploads = 1;
    this.settings.backgroundSyncInterval = 60000;
    
    DeviceEventEmitter.emit('messaging:optimize_for_low_performance', {
      reduceAnimations: true,
      limitImages: true,
      delayNonEssential: true,
    });

    logger.info('Optimizing for low performance', undefined, this.metrics, 'PERFORMANCE');
  }

  private optimizeForHighPerformance(): void {
    this.settings.messagePreloadCount = 50;
    this.settings.limitConcurrentUploads = 3;
    this.settings.backgroundSyncInterval = 30000;
    
    DeviceEventEmitter.emit('messaging:optimize_for_high_performance', {
      enableAnimations: true,
      preloadImages: true,
      enableAllFeatures: true,
    });

    logger.info('Optimizing for high performance', undefined, this.metrics, 'PERFORMANCE');
  }

  private optimizeForBackground(): void {
    // Reduce update frequency when app is in background
    this.settings.backgroundSyncInterval = 300000; // 5 minutes
    
    // Limit subscriptions
    DeviceEventEmitter.emit('messaging:background_mode', {
      pauseNonEssentialSubscriptions: true,
      reduceSyncFrequency: true,
    });

    logger.info('Optimizing for background mode', undefined, {}, 'PERFORMANCE');
  }

  private optimizeForForeground(): void {
    // Restore normal operation
    this.settings.backgroundSyncInterval = 30000;
    
    DeviceEventEmitter.emit('messaging:foreground_mode', {
      resumeAllSubscriptions: true,
      restoreSyncFrequency: true,
    });

    logger.info('Optimizing for foreground mode', undefined, {}, 'PERFORMANCE');
  }

  // Settings management
  private async loadSettings(): Promise<void> {
    try {
      const stored = await secureStorage.getSecureItem('messaging_performance_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error('Failed to load performance settings', error instanceof Error ? error : undefined, {}, 'PERFORMANCE');
    }
  }

  async updateSettings(newSettings: Partial<OptimizationSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await secureStorage.storeSecureItem('messaging_performance_settings', JSON.stringify(this.settings));
      
      DeviceEventEmitter.emit('messaging:settings_updated', this.settings);
    } catch (error) {
      logger.error('Failed to update performance settings', error instanceof Error ? error : undefined, newSettings, 'PERFORMANCE');
    }
  }

  // Public getters
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  getNetworkOptimization(): NetworkOptimization {
    return { ...this.networkOptimization };
  }

  // Media optimization
  getOptimalMediaQuality(): 'low' | 'medium' | 'high' {
    return this.networkOptimization.adaptiveSettings.mediaQuality;
  }

  shouldPreloadMedia(): boolean {
    return this.networkOptimization.adaptiveSettings.preloadMedia;
  }

  getMessageLoadCount(): number {
    return this.networkOptimization.adaptiveSettings.messageLoadCount;
  }

  isRealtimeEnabled(): boolean {
    return this.networkOptimization.adaptiveSettings.enableRealtime;
  }

  // Audio compression
  getAudioCompressionLevel(): number {
    const quality = this.getOptimalMediaQuality();
    switch (quality) {
      case 'low':
        return 32000; // 32 kbps
      case 'medium':
        return 64000; // 64 kbps
      case 'high':
      default:
        return 128000; // 128 kbps
    }
  }

  // Image compression
  getImageCompressionSettings(): { quality: number; maxDimension: number } {
    const quality = this.getOptimalMediaQuality();
    switch (quality) {
      case 'low':
        return { quality: 0.6, maxDimension: 800 };
      case 'medium':
        return { quality: 0.8, maxDimension: 1200 };
      case 'high':
      default:
        return { quality: 0.9, maxDimension: 1920 };
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
    }

    AppState.removeEventListener('change', this.handleAppStateChange);
    this.subscriptions.clear();
    this.renderStartTimes.clear();
    this.networkQueue.length = 0;

    logger.info('Messaging performance service cleaned up', undefined, {}, 'PERFORMANCE');
  }
}

// Singleton instance
let messagingPerformanceService: MessagingPerformanceService | null = null;

export const getMessagingPerformanceService = (): MessagingPerformanceService => {
  if (!messagingPerformanceService) {
    messagingPerformanceService = new MessagingPerformanceService();
  }
  return messagingPerformanceService;
};

export type { PerformanceMetrics, OptimizationSettings, NetworkOptimization };
export default MessagingPerformanceService;
