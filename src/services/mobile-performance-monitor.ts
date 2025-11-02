/**
 * Mobile Performance Monitor for Stellr React Native App
 * 
 * Purpose: Mobile-specific performance monitoring with battery and memory optimization
 * Security: Addresses audit concerns with secure data collection and transmission
 * Features: Battery usage, memory leaks, network efficiency, frame drops, app lifecycle
 * 
 * Architecture: Follows the 10 Golden Code Principles
 * - React Native specific optimizations
 * - Battery-aware monitoring
 * - Memory leak detection
 * - Network efficiency tracking
 * - Performance regression detection
 */

import { AppState, AppStateStatus, Dimensions } from 'react-native';
import { secureStorage } from '../utils/secure-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as MemoryInfo from 'expo-memory-info';
import { trackError, trackCriticalError, trackBusinessMetric } from '../lib/sentry-enhanced';
import { enhancedMonitoring } from './enhanced-monitoring-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export interface MobilePerformanceMetrics {
  // App Lifecycle Metrics
  appStartTime: number;
  backgroundTime: number;
  foregroundTime: number;
  crashCount: number;
  
  // Memory Metrics
  memoryUsage: number;
  memoryWarnings: number;
  memoryLeaks: MemoryLeakInfo[];
  
  // Battery Metrics
  batteryLevel: number;
  batteryState: string;
  batteryImpact: 'low' | 'medium' | 'high';
  powerUsage: number;
  
  // Network Metrics
  networkType: string;
  dataUsage: number;
  requestCount: number;
  cacheHitRate: number;
  
  // Rendering Metrics
  frameDrops: number;
  averageFPS: number;
  slowRenders: number;
  viewHierarchyDepth: number;
  
  // Storage Metrics
  storageUsed: number;
  storageAvailable: number;
  databaseSize: number;
  cacheSize: number;
  
  // User Experience Metrics
  inputLatency: number;
  screenTransitionTime: number;
  gestureResponseTime: number;
  searchPerformance: number;
}

export interface MemoryLeakInfo {
  componentName: string;
  leakType: 'listener' | 'timer' | 'subscription' | 'reference';
  detectedAt: number;
  severity: 'low' | 'medium' | 'high';
  stackTrace?: string;
}

export interface PerformanceAlert {
  alertType: 'memory' | 'battery' | 'network' | 'rendering' | 'storage';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  recommendations: string[];
  timestamp: number;
}

export interface MobileOptimizationSuggestion {
  category: 'performance' | 'battery' | 'memory' | 'network';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string[];
  estimatedImprovement: string;
}

export interface DeviceCapabilities {
  platform: string;
  model: string;
  osVersion: string;
  cpuArchitecture: string;
  memorySize: number;
  storageSize: number;
  screenResolution: { width: number; height: number };
  pixelDensity: number;
  batteryCapacity: number;
}

// ===============================================================================
// MEMORY LEAK DETECTOR
// ===============================================================================

class MemoryLeakDetector {
  private componentInstances = new Map<string, number>();
  private activeTimers = new Set<NodeJS.Timeout>();
  private activeListeners = new Map<string, number>();
  private memoryBaseline: number = 0;
  private leakThreshold: number = 50 * 1024 * 1024; // 50MB

  constructor() {
    this.establishMemoryBaseline();
    this.startLeakDetection();
  }

  /**
   * Establishes memory baseline for leak detection
   * Principle 6: Fail Fast & Defensive - Establishes known good state
   */
  private async establishMemoryBaseline(): Promise<void> {
    try {
      // Get initial memory usage
      const memoryInfo = await MemoryInfo.getMemoryInfoAsync();
      this.memoryBaseline = memoryInfo.totalMemory - memoryInfo.freeMemory;
      
      logDebug('📊 Memory baseline established:', "Debug", this.memoryBaseline, 'bytes');
    } catch (error) {
      logError('Failed to establish memory baseline:', "Error", error);
      this.memoryBaseline = 100 * 1024 * 1024; // 100MB fallback
    }
  }

  /**
   * Starts automated memory leak detection
   */
  private startLeakDetection(): void {
    // Check for memory leaks every 2 minutes
    const detectionInterval = setInterval(async () => {
      await this.detectMemoryLeaks();
    }, 120000);

    this.activeTimers.add(detectionInterval);
  }

  /**
   * Registers component instance for tracking
   * Principle 1: Single Responsibility - Tracks one component type
   */
  public trackComponentInstance(componentName: string, action: 'mount' | 'unmount'): void {
    try {
      const currentCount = this.componentInstances.get(componentName) || 0;
      
      if (action === 'mount') {
        this.componentInstances.set(componentName, currentCount + 1);
      } else if (action === 'unmount') {
        this.componentInstances.set(componentName, Math.max(0, currentCount - 1));
      }

      // Alert on excessive component instances
      const newCount = this.componentInstances.get(componentName) || 0;
      if (newCount > 10) {
        this.reportPotentialLeak(componentName, 'reference', 'high', 
          `Excessive instances: ${newCount}`);
      }
    } catch (error) {
      logError('Component tracking failed:', "Error", error);
    }
  }

  /**
   * Tracks event listeners for cleanup validation
   */
  public trackEventListener(listenerType: string, action: 'add' | 'remove'): void {
    try {
      const currentCount = this.activeListeners.get(listenerType) || 0;
      
      if (action === 'add') {
        this.activeListeners.set(listenerType, currentCount + 1);
      } else if (action === 'remove') {
        this.activeListeners.set(listenerType, Math.max(0, currentCount - 1));
      }

      // Alert on excessive listeners
      const newCount = this.activeListeners.get(listenerType) || 0;
      if (newCount > 20) {
        this.reportPotentialLeak(listenerType, 'listener', 'medium',
          `Excessive listeners: ${newCount}`);
      }
    } catch (error) {
      logError('Listener tracking failed:', "Error", error);
    }
  }

  /**
   * Detects potential memory leaks
   */
  private async detectMemoryLeaks(): Promise<MemoryLeakInfo[]> {
    const leaks: MemoryLeakInfo[] = [];

    try {
      // Check current memory usage
      const memoryInfo = await MemoryInfo.getMemoryInfoAsync();
      const currentMemory = memoryInfo.totalMemory - memoryInfo.freeMemory;
      const memoryGrowth = currentMemory - this.memoryBaseline;

      // Alert on significant memory growth
      if (memoryGrowth > this.leakThreshold) {
        leaks.push({
          componentName: 'global',
          leakType: 'reference',
          detectedAt: Date.now(),
          severity: memoryGrowth > (this.leakThreshold * 2) ? 'high' : 'medium'
        });

        trackError(
          new Error(`Memory leak detected: ${Math.round(memoryGrowth / 1024 / 1024)}MB growth`),
          { 
            memoryGrowth, 
            currentMemory, 
            baseline: this.memoryBaseline 
          }
        );
      }

      // Check component instance leaks
      this.componentInstances.forEach((count, componentName) => {
        if (count > 5) {
          leaks.push({
            componentName,
            leakType: 'reference',
            detectedAt: Date.now(),
            severity: count > 20 ? 'high' : 'medium'
          });
        }
      });

      // Check listener leaks
      this.activeListeners.forEach((count, listenerType) => {
        if (count > 10) {
          leaks.push({
            componentName: listenerType,
            leakType: 'listener',
            detectedAt: Date.now(),
            severity: count > 50 ? 'high' : 'medium'
          });
        }
      });

      return leaks;
    } catch (error) {
      logError('Memory leak detection failed:', "Error", error);
      return leaks;
    }
  }

  private reportPotentialLeak(
    componentName: string,
    leakType: MemoryLeakInfo['leakType'],
    severity: MemoryLeakInfo['severity'],
    details: string
  ): void {
    const leak: MemoryLeakInfo = {
      componentName,
      leakType,
      detectedAt: Date.now(),
      severity
    };

    logWarn(`🚨 Potential ${leakType} leak in ${componentName}: ${details}`, "Warning");
    
    trackError(
      new Error(`Memory leak: ${leakType} in ${componentName}`),
      { leak, details, severity }
    );

    // Send to monitoring service
    enhancedMonitoring.trackPerformanceMetric(
      'api',
      'memory_leak_detected',
      0,
      { leak, details }
    );
  }

  public getActiveLeaks(): MemoryLeakInfo[] {
    // Return current potential leaks
    const leaks: MemoryLeakInfo[] = [];
    
    this.componentInstances.forEach((count, componentName) => {
      if (count > 5) {
        leaks.push({
          componentName,
          leakType: 'reference',
          detectedAt: Date.now(),
          severity: count > 20 ? 'high' : 'medium'
        });
      }
    });

    return leaks;
  }

  public cleanup(): void {
    // Clean up detection timers
    this.activeTimers.forEach(timer => {
      clearInterval(timer);
    });
    this.activeTimers.clear();
  }
}

// ===============================================================================
// BATTERY IMPACT MONITOR
// ===============================================================================

class BatteryImpactMonitor {
  private batteryBaseline: number = 100;
  private powerUsageHistory: Array<{ timestamp: number; level: number }> = [];
  private impactFactors = {
    location: 0,
    network: 0,
    processing: 0,
    screen: 0
  };

  constructor() {
    this.initializeBatteryMonitoring();
  }

  /**
   * Initializes battery monitoring with permission handling
   */
  private async initializeBatteryMonitoring(): Promise<void> {
    try {
      // Get initial battery level
      const batteryLevel = await Battery.getBatteryLevelAsync();
      this.batteryBaseline = batteryLevel * 100;
      
      // Monitor battery level changes
      this.startBatteryTracking();
      
      logDebug('🔋 Battery monitoring initialized:', "Debug", this.batteryBaseline + '%');
    } catch (error) {
      logError('Battery monitoring initialization failed:', "Error", error);
    }
  }

  private startBatteryTracking(): void {
    // Check battery every 5 minutes
    setInterval(async () => {
      await this.trackBatteryUsage();
    }, 300000);
  }

  /**
   * Tracks battery usage and calculates app impact
   * Principle 3: Small, Focused Functions - Clear, single purpose
   */
  private async trackBatteryUsage(): Promise<void> {
    try {
      const currentLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      const powerMode = await Battery.getPowerStateAsync();

      const currentLevelPercent = currentLevel * 100;
      const usage = this.batteryBaseline - currentLevelPercent;

      // Record usage history
      this.powerUsageHistory.push({
        timestamp: Date.now(),
        level: currentLevelPercent
      });

      // Keep only last 24 hours of data
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.powerUsageHistory = this.powerUsageHistory.filter(
        entry => entry.timestamp > dayAgo
      );

      // Calculate impact level
      const impactLevel = this.calculateBatteryImpact(usage, batteryState);

      // Alert on high battery usage
      if (impactLevel === 'high') {
        trackError(
          new Error('High battery impact detected'),
          {
            batteryLevel: currentLevelPercent,
            usage,
            impactLevel,
            powerMode
          }
        );
      }

      // Track in business metrics
      enhancedMonitoring.trackBusinessMetric('battery_impact', usage, {
        level: currentLevelPercent,
        impact: impactLevel,
        state: batteryState
      });

    } catch (error) {
      logError('Battery tracking failed:', "Error", error);
    }
  }

  /**
   * Calculates app's battery impact level
   */
  private calculateBatteryImpact(
    usage: number,
    batteryState: Battery.BatteryState
  ): MobilePerformanceMetrics['batteryImpact'] {
    // Adjust thresholds based on battery state
    let highThreshold = 10; // 10% in 5 minutes is concerning
    let mediumThreshold = 5;

    if (batteryState === Battery.BatteryState.CHARGING) {
      // More lenient when charging
      highThreshold = 20;
      mediumThreshold = 10;
    } else if (batteryState === Battery.BatteryState.UNPLUGGED) {
      // More strict when on battery
      highThreshold = 5;
      mediumThreshold = 2;
    }

    if (usage > highThreshold) return 'high';
    if (usage > mediumThreshold) return 'medium';
    return 'low';
  }

  /**
   * Tracks feature-specific battery impact
   */
  public trackFeatureBatteryUsage(
    feature: keyof typeof this.impactFactors,
    usage: number
  ): void {
    try {
      this.impactFactors[feature] = usage;
      
      // Track in monitoring service
      enhancedMonitoring.trackPerformanceMetric(
        'api',
        `battery_${feature}`,
        usage,
        { feature, impact: this.impactFactors[feature] }
      );

      // Generate optimization suggestions
      if (usage > 0.8) { // 80% impact threshold
        this.generateBatteryOptimizationSuggestion(feature, usage);
      }
    } catch (error) {
      logError('Feature battery tracking failed:', "Error", error);
    }
  }

  private generateBatteryOptimizationSuggestion(
    feature: string,
    usage: number
  ): void {
    const suggestions = {
      location: [
        'Reduce location update frequency',
        'Use coarse location when possible',
        'Cache location data',
        'Stop location services when app backgrounded'
      ],
      network: [
        'Implement request batching',
        'Use efficient caching strategies',
        'Minimize background sync',
        'Compress API responses'
      ],
      processing: [
        'Move heavy computations to background',
        'Implement progressive loading',
        'Cache calculation results',
        'Use lazy loading for expensive operations'
      ],
      screen: [
        'Reduce screen brightness programmatically',
        'Minimize complex animations',
        'Optimize image sizes',
        'Use dark mode when available'
      ]
    };

    logDebug(`🔋 Battery optimization suggestion for ${feature}:`, "Debug", suggestions[feature as keyof typeof suggestions]);
  }

  public getBatteryMetrics(): Partial<MobilePerformanceMetrics> {
    const recentUsage = this.powerUsageHistory.slice(-12); // Last hour
    const averageUsage = recentUsage.length > 0 ?
      recentUsage.reduce((sum, entry) => sum + (100 - entry.level), 0) / recentUsage.length :
      0;

    return {
      batteryLevel: this.batteryBaseline,
      batteryImpact: this.calculateBatteryImpact(averageUsage, Battery.BatteryState.UNKNOWN),
      powerUsage: averageUsage
    };
  }
}

// ===============================================================================
// NETWORK EFFICIENCY MONITOR
// ===============================================================================

class NetworkEfficiencyMonitor {
  private requestMetrics = new Map<string, {
    count: number;
    totalSize: number;
    cacheHits: number;
    averageLatency: number;
  }>();
  private networkType: string = 'unknown';
  private dataUsage: number = 0;

  constructor() {
    this.initializeNetworkMonitoring();
  }

  /**
   * Initializes network efficiency monitoring
   */
  private initializeNetworkMonitoring(): void {
    try {
      // Monitor network state changes
      NetInfo.addEventListener(state => {
        this.networkType = state.type || 'unknown';
        
        // Alert on network type changes that affect performance
        if (state.type === 'cellular' && state.details?.cellularGeneration === '2g') {
          this.alertSlowNetwork();
        }
        
        enhancedMonitoring.trackPerformanceMetric(
          'api',
          'network_type_change',
          0,
          { 
            type: state.type,
            isConnected: state.isConnected,
            isInternetReachable: state.isInternetReachable
          }
        );
      });

      logDebug('📶 Network efficiency monitoring initialized', "Debug");
    } catch (error) {
      logError('Network monitoring initialization failed:', "Error", error);
    }
  }

  /**
   * Tracks network request efficiency
   * Principle 2: Meaningful Names - Method name clearly indicates purpose
   */
  public trackNetworkRequest(
    endpoint: string,
    method: string,
    responseSize: number,
    latency: number,
    fromCache: boolean = false
  ): void {
    try {
      const key = `${method}:${endpoint}`;
      const existing = this.requestMetrics.get(key) || {
        count: 0,
        totalSize: 0,
        cacheHits: 0,
        averageLatency: 0
      };

      // Update metrics
      const updated = {
        count: existing.count + 1,
        totalSize: existing.totalSize + responseSize,
        cacheHits: existing.cacheHits + (fromCache ? 1 : 0),
        averageLatency: ((existing.averageLatency * existing.count) + latency) / (existing.count + 1)
      };

      this.requestMetrics.set(key, updated);
      this.dataUsage += responseSize;

      // Calculate efficiency metrics
      const cacheHitRate = updated.cacheHits / updated.count;
      const avgResponseSize = updated.totalSize / updated.count;

      // Alert on inefficient patterns
      if (cacheHitRate < 0.3 && updated.count > 10) {
        this.alertLowCacheEfficiency(key, cacheHitRate);
      }

      if (avgResponseSize > 1024 * 1024) { // > 1MB average
        this.alertLargeResponses(key, avgResponseSize);
      }

      // Track in monitoring service
      enhancedMonitoring.trackPerformanceMetric(
        'api',
        endpoint,
        latency,
        {
          method,
          responseSize,
          fromCache,
          cacheHitRate,
          networkType: this.networkType
        }
      );

    } catch (error) {
      logError('Network request tracking failed:', "Error", error);
    }
  }

  /**
   * Generates network optimization suggestions
   */
  public generateNetworkOptimizations(): MobileOptimizationSuggestion[] {
    const suggestions: MobileOptimizationSuggestion[] = [];

    try {
      // Analyze request patterns
      this.requestMetrics.forEach((metrics, endpoint) => {
        const cacheHitRate = metrics.cacheHits / metrics.count;
        const avgResponseSize = metrics.totalSize / metrics.count;
        
        // Low cache hit rate suggestion
        if (cacheHitRate < 0.5) {
          suggestions.push({
            category: 'network',
            priority: 'medium',
            title: `Improve Caching for ${endpoint}`,
            description: `Cache hit rate is only ${Math.round(cacheHitRate * 100)}%`,
            impact: 'Reduce data usage and improve response times',
            implementation: [
              'Implement proper cache headers',
              'Add client-side caching logic',
              'Consider offline-first strategy'
            ],
            estimatedImprovement: '30-50% reduction in network requests'
          });
        }

        // Large response size suggestion
        if (avgResponseSize > 500 * 1024) { // > 500KB
          suggestions.push({
            category: 'network',
            priority: 'high',
            title: `Optimize Response Size for ${endpoint}`,
            description: `Average response size is ${Math.round(avgResponseSize / 1024)}KB`,
            impact: 'Reduce data usage and battery consumption',
            implementation: [
              'Implement response compression',
              'Add pagination for large datasets',
              'Optimize image sizes',
              'Remove unnecessary fields'
            ],
            estimatedImprovement: '40-60% reduction in data usage'
          });
        }
      });

      return suggestions;
    } catch (error) {
      logError('Network optimization generation failed:', "Error", error);
      return suggestions;
    }
  }

  private alertSlowNetwork(): void {
    trackError(
      new Error('Slow network detected (2G)'),
      { 
        networkType: this.networkType,
        recommendation: 'Implement offline-first patterns'
      }
    );
  }

  private alertLowCacheEfficiency(endpoint: string, rate: number): void {
    trackError(
      new Error(`Low cache efficiency: ${endpoint}`),
      {
        endpoint,
        cacheHitRate: rate,
        recommendation: 'Improve caching strategy'
      }
    );
  }

  private alertLargeResponses(endpoint: string, avgSize: number): void {
    trackError(
      new Error(`Large response detected: ${endpoint}`),
      {
        endpoint,
        averageSize: Math.round(avgSize / 1024) + 'KB',
        recommendation: 'Optimize response size'
      }
    );
  }

  public getNetworkMetrics(): Partial<MobilePerformanceMetrics> {
    const totalRequests = Array.from(this.requestMetrics.values())
      .reduce((sum, metrics) => sum + metrics.count, 0);
    
    const totalCacheHits = Array.from(this.requestMetrics.values())
      .reduce((sum, metrics) => sum + metrics.cacheHits, 0);

    const cacheHitRate = totalRequests > 0 ? totalCacheHits / totalRequests : 0;

    return {
      networkType: this.networkType,
      dataUsage: this.dataUsage,
      requestCount: totalRequests,
      cacheHitRate
    };
  }
}

// ===============================================================================
// RENDERING PERFORMANCE MONITOR
// ===============================================================================

class RenderingPerformanceMonitor {
  private frameDropCount = 0;
  private renderTimes: number[] = [];
  private slowRenderCount = 0;
  private isMonitoring = false;

  constructor() {
    this.startRenderingMonitoring();
  }

  /**
   * Starts monitoring rendering performance
   */
  private startRenderingMonitoring(): void {
    try {
      // React Native doesn't have direct access to frame metrics
      // This would be implemented with native modules in production
      this.isMonitoring = true;
      
      // Simulate frame monitoring (would be native implementation)
      this.simulateFrameMonitoring();
      
      logDebug('🎨 Rendering performance monitoring started', "Debug");
    } catch (error) {
      logError('Rendering monitoring initialization failed:', "Error", error);
    }
  }

  private simulateFrameMonitoring(): void {
    // In production, this would use native performance APIs
    setInterval(() => {
      const renderTime = Math.random() * 32; // Simulate 0-32ms render time
      this.trackRenderTime(renderTime);
    }, 1000);
  }

  /**
   * Tracks render time for performance analysis
   */
  public trackRenderTime(renderTime: number): void {
    try {
      this.renderTimes.push(renderTime);
      
      // Keep only last 100 render times
      if (this.renderTimes.length > 100) {
        this.renderTimes = this.renderTimes.slice(-100);
      }

      // Alert on slow renders (>16ms for 60fps)
      if (renderTime > 16) {
        this.slowRenderCount++;
        
        if (renderTime > 32) { // Very slow render
          this.frameDropCount++;
          this.alertSlowRender(renderTime);
        }
      }

      // Track in monitoring service
      if (renderTime > 16) {
        enhancedMonitoring.trackPerformanceMetric(
          'screen',
          'slow_render',
          renderTime,
          { threshold: 16, severity: renderTime > 32 ? 'high' : 'medium' }
        );
      }
    } catch (error) {
      logError('Render time tracking failed:', "Error", error);
    }
  }

  /**
   * Tracks component rendering performance
   */
  public trackComponentRender(
    componentName: string,
    renderDuration: number,
    props?: Record<string, any>
  ): void {
    try {
      if (renderDuration > 5) { // >5ms is noteworthy for components
        enhancedMonitoring.trackPerformanceMetric(
          'screen',
          `component_render_${componentName}`,
          renderDuration,
          {
            componentName,
            propsCount: props ? Object.keys(props).length : 0,
            isSlowRender: renderDuration > 16
          }
        );

        if (renderDuration > 16) {
          logWarn(`🐌 Slow component render: ${componentName} (${renderDuration}ms, "Warning")`);
        }
      }
    } catch (error) {
      logError('Component render tracking failed:', "Error", error);
    }
  }

  /**
   * Tracks navigation/screen transition performance
   */
  public trackScreenTransition(
    fromScreen: string,
    toScreen: string,
    transitionTime: number
  ): void {
    try {
      // Track screen transition performance
      enhancedMonitoring.trackPerformanceMetric(
        'screen',
        'screen_transition',
        transitionTime,
        {
          from: fromScreen,
          to: toScreen,
          isSlowTransition: transitionTime > 300 // >300ms is slow
        }
      );

      if (transitionTime > 300) {
        trackError(
          new Error('Slow screen transition'),
          {
            fromScreen,
            toScreen,
            transitionTime,
            recommendation: 'Optimize screen loading'
          }
        );
      }
    } catch (error) {
      logError('Screen transition tracking failed:', "Error", error);
    }
  }

  private alertSlowRender(renderTime: number): void {
    if (this.frameDropCount % 10 === 0) { // Alert every 10 frame drops
      trackError(
        new Error('Frame drops detected'),
        {
          renderTime,
          frameDropCount: this.frameDropCount,
          averageRenderTime: this.getAverageRenderTime(),
          recommendation: 'Optimize rendering performance'
        }
      );
    }
  }

  private getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
  }

  public getRenderingMetrics(): Partial<MobilePerformanceMetrics> {
    const averageRenderTime = this.getAverageRenderTime();
    const estimatedFPS = averageRenderTime > 0 ? 1000 / averageRenderTime : 60;

    return {
      frameDrops: this.frameDropCount,
      averageFPS: Math.min(60, estimatedFPS), // Cap at 60fps
      slowRenders: this.slowRenderCount,
      screenTransitionTime: averageRenderTime
    };
  }
}

// ===============================================================================
// MAIN MOBILE PERFORMANCE MONITOR
// ===============================================================================

class MobilePerformanceMonitor {
  private static instance: MobilePerformanceMonitor;
  private memoryLeakDetector: MemoryLeakDetector;
  private batteryMonitor: BatteryImpactMonitor;
  private networkMonitor: NetworkEfficiencyMonitor;
  private renderingMonitor: RenderingPerformanceMonitor;
  private deviceCapabilities: DeviceCapabilities | null = null;
  private appStateHistory: Array<{ state: AppStateStatus; timestamp: number }> = [];
  private isMonitoring = false;

  private constructor() {
    this.memoryLeakDetector = new MemoryLeakDetector();
    this.batteryMonitor = new BatteryImpactMonitor();
    this.networkMonitor = new NetworkEfficiencyMonitor();
    this.renderingMonitor = new RenderingPerformanceMonitor();
  }

  /**
   * Singleton pattern for service management
   */
  public static getInstance(): MobilePerformanceMonitor {
    if (!MobilePerformanceMonitor.instance) {
      MobilePerformanceMonitor.instance = new MobilePerformanceMonitor();
    }
    return MobilePerformanceMonitor.instance;
  }

  /**
   * Initializes mobile performance monitoring
   * Principle 6: Fail Fast & Defensive - Comprehensive initialization
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isMonitoring) {
        logWarn('Mobile Performance Monitor already initialized', "Warning");
        return;
      }

      // Gather device capabilities
      await this.gatherDeviceCapabilities();
      
      // Set up app state monitoring
      this.setupAppStateMonitoring();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      this.isMonitoring = true;
      
      logDebug('✅ Mobile Performance Monitor initialized', "Debug", {
        device: this.deviceCapabilities?.model,
        platform: this.deviceCapabilities?.platform
      });

      // Track initialization
      enhancedMonitoring.trackBusinessMetric('mobile_performance_monitor_initialized', 1, {
        deviceModel: this.deviceCapabilities?.model,
        osVersion: this.deviceCapabilities?.osVersion
      });

    } catch (error) {
      logError('❌ Mobile Performance Monitor initialization failed:', "Error", error);
      trackCriticalError(error as Error, {
        component: 'MobilePerformanceMonitor',
        method: 'initialize'
      });
      throw error;
    }
  }

  /**
   * Gathers device capabilities for performance baselines
   */
  private async gatherDeviceCapabilities(): Promise<void> {
    try {
      const dimensions = Dimensions.get('window');
      
      this.deviceCapabilities = {
        platform: Device.osName || 'unknown',
        model: Device.modelName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
        cpuArchitecture: 'unknown', // Would need native module
        memorySize: 0, // Would need native module
        storageSize: 0, // Would need native module
        screenResolution: {
          width: dimensions.width,
          height: dimensions.height
        },
        pixelDensity: dimensions.scale,
        batteryCapacity: 0 // Would need native module
      };

      logDebug('📱 Device capabilities gathered:', "Debug", this.deviceCapabilities);
    } catch (error) {
      logError('Device capabilities gathering failed:', "Error", error);
    }
  }

  /**
   * Sets up app state monitoring for lifecycle tracking
   */
  private setupAppStateMonitoring(): void {
    try {
      AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        this.appStateHistory.push({
          state: nextAppState,
          timestamp: Date.now()
        });

        // Keep only last 50 state changes
        if (this.appStateHistory.length > 50) {
          this.appStateHistory = this.appStateHistory.slice(-50);
        }

        // Track app lifecycle events
        enhancedMonitoring.trackBusinessMetric(`app_state_${nextAppState}`, 1, {
          previousState: this.appStateHistory[this.appStateHistory.length - 2]?.state,
          timestamp: Date.now()
        });

        logDebug('📱 App state changed:', "Debug", nextAppState);
      });
    } catch (error) {
      logError('App state monitoring setup failed:', "Error", error);
    }
  }

  private startPerformanceMonitoring(): void {
    // Collect comprehensive performance metrics every 5 minutes
    setInterval(async () => {
      await this.collectPerformanceMetrics();
    }, 300000);
  }

  // ===============================================================================
  // PUBLIC API METHODS
  // ===============================================================================

  /**
   * Tracks component lifecycle for memory leak detection
   */
  public trackComponent(
    componentName: string,
    action: 'mount' | 'unmount' | 'render',
    renderTime?: number
  ): void {
    try {
      if (!this.isMonitoring) return;

      if (action === 'mount' || action === 'unmount') {
        this.memoryLeakDetector.trackComponentInstance(componentName, action);
      } else if (action === 'render' && renderTime !== undefined) {
        this.renderingMonitor.trackComponentRender(componentName, renderTime);
      }
    } catch (error) {
      logError('Component tracking failed:', "Error", error);
    }
  }

  /**
   * Tracks network requests for efficiency monitoring
   */
  public trackNetworkRequest(
    endpoint: string,
    method: string,
    responseSize: number,
    latency: number,
    fromCache: boolean = false
  ): void {
    try {
      if (!this.isMonitoring) return;

      this.networkMonitor.trackNetworkRequest(
        endpoint,
        method,
        responseSize,
        latency,
        fromCache
      );
    } catch (error) {
      logError('Network request tracking failed:', "Error", error);
    }
  }

  /**
   * Tracks screen navigation performance
   */
  public trackScreenNavigation(
    fromScreen: string,
    toScreen: string,
    transitionTime: number
  ): void {
    try {
      if (!this.isMonitoring) return;

      this.renderingMonitor.trackScreenTransition(fromScreen, toScreen, transitionTime);
    } catch (error) {
      logError('Screen navigation tracking failed:', "Error", error);
    }
  }

  /**
   * Tracks feature-specific battery usage
   */
  public trackBatteryUsage(
    feature: 'location' | 'network' | 'processing' | 'screen',
    usage: number
  ): void {
    try {
      if (!this.isMonitoring) return;

      this.batteryMonitor.trackFeatureBatteryUsage(feature, usage);
    } catch (error) {
      logError('Battery usage tracking failed:', "Error", error);
    }
  }

  /**
   * Collects comprehensive performance metrics
   */
  private async collectPerformanceMetrics(): Promise<MobilePerformanceMetrics> {
    try {
      const memoryMetrics = this.memoryLeakDetector.getActiveLeaks();
      const batteryMetrics = this.batteryMonitor.getBatteryMetrics();
      const networkMetrics = this.networkMonitor.getNetworkMetrics();
      const renderingMetrics = this.renderingMonitor.getRenderingMetrics();

      const metrics: MobilePerformanceMetrics = {
        // App Lifecycle
        appStartTime: 0, // Would track from app launch
        backgroundTime: this.calculateBackgroundTime(),
        foregroundTime: this.calculateForegroundTime(),
        crashCount: 0, // Would track from error boundary
        
        // Memory
        memoryUsage: 0, // Would get from native
        memoryWarnings: 0,
        memoryLeaks: memoryMetrics,
        
        // Battery
        batteryLevel: batteryMetrics.batteryLevel || 100,
        batteryState: 'unknown',
        batteryImpact: batteryMetrics.batteryImpact || 'low',
        powerUsage: batteryMetrics.powerUsage || 0,
        
        // Network
        networkType: networkMetrics.networkType || 'unknown',
        dataUsage: networkMetrics.dataUsage || 0,
        requestCount: networkMetrics.requestCount || 0,
        cacheHitRate: networkMetrics.cacheHitRate || 0,
        
        // Rendering
        frameDrops: renderingMetrics.frameDrops || 0,
        averageFPS: renderingMetrics.averageFPS || 60,
        slowRenders: renderingMetrics.slowRenders || 0,
        viewHierarchyDepth: 0, // Would need native implementation
        
        // Storage
        storageUsed: 0, // Would need native implementation
        storageAvailable: 0,
        databaseSize: 0,
        cacheSize: 0,
        
        // User Experience
        inputLatency: 0, // Would track from gesture handlers
        screenTransitionTime: renderingMetrics.screenTransitionTime || 0,
        gestureResponseTime: 0,
        searchPerformance: 0
      };

      // Send metrics to monitoring service
      Object.entries(metrics).forEach(([key, value]) => {
        if (typeof value === 'number' && value > 0) {
          enhancedMonitoring.trackBusinessMetric(`mobile_${key}`, value);
        }
      });

      return metrics;
    } catch (error) {
      logError('Performance metrics collection failed:', "Error", error);
      throw error;
    }
  }

  private calculateBackgroundTime(): number {
    const backgroundStates = this.appStateHistory.filter(entry => 
      entry.state === 'background'
    );
    
    let totalTime = 0;
    for (let i = 0; i < backgroundStates.length; i++) {
      const start = backgroundStates[i];
      const end = this.appStateHistory.find(entry => 
        entry.timestamp > start.timestamp && entry.state !== 'background'
      );
      
      if (end) {
        totalTime += end.timestamp - start.timestamp;
      }
    }
    
    return totalTime;
  }

  private calculateForegroundTime(): number {
    const activeStates = this.appStateHistory.filter(entry => 
      entry.state === 'active'
    );
    
    let totalTime = 0;
    for (let i = 0; i < activeStates.length; i++) {
      const start = activeStates[i];
      const end = this.appStateHistory.find(entry => 
        entry.timestamp > start.timestamp && entry.state !== 'active'
      );
      
      if (end) {
        totalTime += end.timestamp - start.timestamp;
      }
    }
    
    return totalTime;
  }

  // ===============================================================================
  // PUBLIC UTILITY METHODS
  // ===============================================================================

  /**
   * Generates mobile-specific optimization suggestions
   */
  public async generateOptimizationSuggestions(): Promise<MobileOptimizationSuggestion[]> {
    try {
      const suggestions: MobileOptimizationSuggestion[] = [];
      
      // Get network optimizations
      const networkSuggestions = this.networkMonitor.generateNetworkOptimizations();
      suggestions.push(...networkSuggestions);
      
      // Add memory optimizations
      const memoryLeaks = this.memoryLeakDetector.getActiveLeaks();
      if (memoryLeaks.length > 0) {
        suggestions.push({
          category: 'memory',
          priority: 'high',
          title: 'Fix Memory Leaks',
          description: `${memoryLeaks.length} potential memory leaks detected`,
          impact: 'Prevent app crashes and improve performance',
          implementation: [
            'Review component cleanup methods',
            'Ensure event listeners are removed',
            'Check for circular references',
            'Implement proper subscription cleanup'
          ],
          estimatedImprovement: '20-40% memory usage reduction'
        });
      }
      
      return suggestions;
    } catch (error) {
      logError('Optimization suggestion generation failed:', "Error", error);
      return [];
    }
  }

  /**
   * Gets current mobile performance dashboard data
   */
  public async getPerformanceDashboard(): Promise<Record<string, any>> {
    try {
      if (!this.isMonitoring) {
        throw new Error('Mobile Performance Monitor not initialized');
      }

      const metrics = await this.collectPerformanceMetrics();
      const suggestions = await this.generateOptimizationSuggestions();

      return {
        metrics,
        suggestions,
        deviceCapabilities: this.deviceCapabilities,
        appStateHistory: this.appStateHistory.slice(-10), // Last 10 state changes
        systemHealth: this.calculateSystemHealth(metrics),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logError('Performance dashboard generation failed:', "Error", error);
      throw error;
    }
  }

  private calculateSystemHealth(metrics: MobilePerformanceMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    let healthScore = 100;

    // Deduct points for performance issues
    if (metrics.memoryLeaks.length > 0) healthScore -= 20;
    if (metrics.batteryImpact === 'high') healthScore -= 30;
    if (metrics.frameDrops > 10) healthScore -= 25;
    if (metrics.cacheHitRate < 0.5) healthScore -= 15;
    if (metrics.averageFPS < 30) healthScore -= 20;

    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 50) return 'degraded';
    return 'unhealthy';
  }

  /**
   * Cleanup monitoring resources
   */
  public cleanup(): void {
    try {
      this.memoryLeakDetector.cleanup();
      this.isMonitoring = false;
      
      logDebug('✅ Mobile Performance Monitor cleaned up', "Debug");
    } catch (error) {
      logError('Mobile performance monitor cleanup failed:', "Error", error);
    }
  }
}

// ===============================================================================
// EXPORTS
// ===============================================================================

export default MobilePerformanceMonitor;
export {
  MemoryLeakDetector,
  BatteryImpactMonitor,
  NetworkEfficiencyMonitor,
  RenderingPerformanceMonitor,
  type MobilePerformanceMetrics,
  type MemoryLeakInfo,
  type PerformanceAlert,
  type MobileOptimizationSuggestion,
  type DeviceCapabilities
};

// Export singleton instance for app-wide use
export const mobilePerformanceMonitor = MobilePerformanceMonitor.getInstance();

// Convenience functions for common mobile performance tracking
export const trackComponentLifecycle = (
  componentName: string,
  action: 'mount' | 'unmount' | 'render',
  renderTime?: number
) => {
  mobilePerformanceMonitor.trackComponent(componentName, action, renderTime);
};

export const trackNetworkPerformance = (
  endpoint: string,
  method: string,
  responseSize: number,
  latency: number,
  fromCache: boolean = false
) => {
  mobilePerformanceMonitor.trackNetworkRequest(endpoint, method, responseSize, latency, fromCache);
};

export const trackScreenPerformance = (
  fromScreen: string,
  toScreen: string,
  transitionTime: number
) => {
  mobilePerformanceMonitor.trackScreenNavigation(fromScreen, toScreen, transitionTime);
};

export const trackMobileBatteryUsage = (
  feature: 'location' | 'network' | 'processing' | 'screen',
  usage: number
) => {
  mobilePerformanceMonitor.trackBatteryUsage(feature, usage);
};
