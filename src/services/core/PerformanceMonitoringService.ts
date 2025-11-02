/**
 * Core Performance Monitoring Service
 * Consolidated performance monitoring for mobile app with comprehensive metrics
 * 
 * This service consolidates functionality from:
 * - mobile-performance-monitor.ts
 * - enhanced-monitoring-service.ts (PerformanceMonitor class)
 * - production-alerting-service.ts
 */
import { secureStorage } from '../../utils/secure-storage';

import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { secureStorage } from '../../utils/secure-storage';
import { logError, logWarn, logInfo, logDebug } from '../../../utils/logger';
import { trackPerformance, trackAPICall, trackScreenLoad } from '../../lib/sentry-enhanced';

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export interface PerformanceMetrics {
  // App Performance
  appStartTime: number;
  coldStartTime?: number;
  warmStartTime?: number;
  memoryUsage: number;
  cpuUsage: number;
  batteryLevel: number;
  batteryState: 'charging' | 'unplugged' | 'full' | 'unknown';
  
  // Screen Performance
  screenLoadTimes: Record<string, number>;
  screenTransitionTimes: Record<string, number>;
  frameDrops: number;
  jankInstances: number;
  renderTime: number;
  
  // Network Performance
  networkLatency: number;
  networkType: string;
  networkStrength: 'poor' | 'moderate' | 'good' | 'excellent';
  apiResponseTimes: Record<string, number[]>;
  apiErrorRates: Record<string, number>;
  cacheHitRate: number;
  
  // Resource Usage
  imageLoadTimes: Record<string, number>;
  bundleSize: number;
  cacheSize: number;
  storageUsage: number;
}

export interface PerformanceThresholds {
  maxAppStartTime: number;
  maxScreenLoadTime: number;
  maxApiResponseTime: number;
  maxMemoryUsage: number;
  minFrameRate: number;
  maxCpuUsage: number;
  minBatteryLevel: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'app-start' | 'screen-load' | 'api' | 'memory' | 'cpu' | 'battery' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
  resolved: boolean;
}

export interface PerformanceSummary {
  period: { start: Date; end: Date };
  averageMetrics: Partial<PerformanceMetrics>;
  violations: PerformanceAlert[];
  recommendations: string[];
  healthScore: number; // 0-100
}

// Performance tracking context
export interface PerformanceContext {
  screen?: string;
  feature?: string;
  userId?: string;
  sessionId?: string;
  deviceInfo?: any;
}

// ===============================================================================
// PERFORMANCE MONITORING SERVICE
// ===============================================================================

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private sessionId: string;
  private appStartTime: number;
  private memoryCheckInterval?: NodeJS.Timeout;
  private metricsBuffer: Partial<PerformanceMetrics>[] = [];
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.appStartTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.thresholds = this.getDefaultThresholds();
    this.initialize();
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  private generateSessionId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      appStartTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      batteryLevel: 100,
      batteryState: 'unknown',
      screenLoadTimes: {},
      screenTransitionTimes: {},
      frameDrops: 0,
      jankInstances: 0,
      renderTime: 0,
      networkLatency: 0,
      networkType: 'unknown',
      networkStrength: 'good',
      apiResponseTimes: {},
      apiErrorRates: {},
      cacheHitRate: 0,
      imageLoadTimes: {},
      bundleSize: 0,
      cacheSize: 0,
      storageUsage: 0
    };
  }

  private getDefaultThresholds(): PerformanceThresholds {
    return {
      maxAppStartTime: 3000, // 3 seconds
      maxScreenLoadTime: 1000, // 1 second
      maxApiResponseTime: 5000, // 5 seconds
      maxMemoryUsage: 512, // 512 MB
      minFrameRate: 30, // 30 FPS
      maxCpuUsage: 80, // 80%
      minBatteryLevel: 15 // 15%
    };
  }

  private async initialize(): Promise<void> {
    try {
      // Track app start performance
      this.metrics.appStartTime = Date.now() - this.appStartTime;
      
      // Start monitoring
      this.startMemoryMonitoring();
      this.startNetworkMonitoring();
      this.startBatteryMonitoring();
      
      // Load persisted metrics
      await this.loadPersistedMetrics();
      
      // Track initial app start
      this.trackAppStart(this.metrics.appStartTime);
      
      this.isInitialized = true;
      logDebug('PerformanceMonitoringService initialized');
    } catch (error) {
      logError('Failed to initialize PerformanceMonitoringService:', error);
    }
  }

  // ===============================================================================
  // PUBLIC API - PERFORMANCE TRACKING
  // ===============================================================================

  /**
   * Track app start performance
   */
  trackAppStart(duration: number, type: 'cold' | 'warm' = 'cold'): void {
    if (type === 'cold') {
      this.metrics.coldStartTime = duration;
    } else {
      this.metrics.warmStartTime = duration;
    }

    // Send to Sentry
    trackPerformance('app_start', duration, { type });

    // Check threshold
    if (duration > this.thresholds.maxAppStartTime) {
      this.createAlert('app-start', duration, this.thresholds.maxAppStartTime);
    }

    logDebug(`App ${type} start: ${duration}ms`);
  }

  /**
   * Track screen load performance
   */
  trackScreenLoad(screenName: string, duration: number, context?: PerformanceContext): void {
    // Store metric
    this.metrics.screenLoadTimes[screenName] = duration;

    // Send to monitoring
    trackScreenLoad(screenName, duration);

    // Check threshold
    if (duration > this.thresholds.maxScreenLoadTime) {
      this.createAlert('screen-load', duration, this.thresholds.maxScreenLoadTime, {
        screen: screenName
      });
    }

    // Buffer for aggregation
    this.bufferMetric({ screenLoadTimes: { [screenName]: duration } });

    logDebug(`Screen load ${screenName}: ${duration}ms`);
  }

  /**
   * Track screen transition performance
   */
  trackScreenTransition(from: string, to: string, duration: number): void {
    const key = `${from}->${to}`;
    this.metrics.screenTransitionTimes[key] = duration;

    trackPerformance('screen_transition', duration, { from, to });

    if (duration > 500) { // Transition should be under 500ms
      logWarn(`Slow screen transition ${key}: ${duration}ms`);
    }
  }

  /**
   * Track API call performance
   */
  trackAPICall(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    error?: Error
  ): void {
    const key = `${method}:${endpoint}`;
    
    // Store response times
    if (!this.metrics.apiResponseTimes[key]) {
      this.metrics.apiResponseTimes[key] = [];
    }
    this.metrics.apiResponseTimes[key].push(duration);
    
    // Keep only last 100 measurements
    if (this.metrics.apiResponseTimes[key].length > 100) {
      this.metrics.apiResponseTimes[key] = this.metrics.apiResponseTimes[key].slice(-100);
    }

    // Track error rates
    if (error || status >= 400) {
      this.metrics.apiErrorRates[key] = (this.metrics.apiErrorRates[key] || 0) + 1;
    }

    // Send to monitoring
    trackAPICall(endpoint, method, duration, status, error?.message);

    // Check threshold
    if (duration > this.thresholds.maxApiResponseTime) {
      this.createAlert('api', duration, this.thresholds.maxApiResponseTime, {
        endpoint,
        method,
        status
      });
    }
  }

  /**
   * Track frame drops and jank
   */
  trackFrameDrops(count: number): void {
    this.metrics.frameDrops += count;
    
    if (count > 5) { // More than 5 dropped frames is noticeable
      this.metrics.jankInstances++;
      logWarn(`Frame drops detected: ${count}`);
    }
  }

  /**
   * Track image load performance
   */
  trackImageLoad(url: string, duration: number, size?: number): void {
    this.metrics.imageLoadTimes[url] = duration;
    
    if (duration > 2000) { // Images should load under 2 seconds
      logWarn(`Slow image load: ${url} took ${duration}ms`);
    }

    trackPerformance('image_load', duration, { url, size });
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(usage: number): void {
    this.metrics.memoryUsage = usage;
    
    if (usage > this.thresholds.maxMemoryUsage) {
      this.createAlert('memory', usage, this.thresholds.maxMemoryUsage);
    }
  }

  /**
   * Track CPU usage
   */
  trackCPUUsage(usage: number): void {
    this.metrics.cpuUsage = usage;
    
    if (usage > this.thresholds.maxCpuUsage) {
      this.createAlert('cpu', usage, this.thresholds.maxCpuUsage);
    }
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logDebug('Performance thresholds updated:', this.thresholds);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance summary for a time period
   */
  async getPerformanceSummary(
    period?: { start: Date; end: Date }
  ): Promise<PerformanceSummary> {
    const relevantAlerts = period
      ? this.alerts.filter(a => {
          const timestamp = new Date(a.timestamp);
          return timestamp >= period.start && timestamp <= period.end;
        })
      : this.alerts;

    const averageMetrics = this.calculateAverageMetrics();
    const healthScore = this.calculateHealthScore(averageMetrics, relevantAlerts);
    const recommendations = this.generateRecommendations(averageMetrics, relevantAlerts);

    return {
      period: period || { 
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), 
        end: new Date() 
      },
      averageMetrics,
      violations: relevantAlerts.filter(a => !a.resolved),
      recommendations,
      healthScore
    };
  }

  /**
   * Get active performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Resolve a performance alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logDebug(`Performance alert resolved: ${alertId}`);
    }
  }

  // ===============================================================================
  // PRIVATE MONITORING METHODS
  // ===============================================================================

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const memoryUsage = this.estimateMemoryUsage();
      this.trackMemoryUsage(memoryUsage);
    }, 30000); // Check every 30 seconds
  }

  private async startNetworkMonitoring(): Promise<void> {
    NetInfo.addEventListener(state => {
      this.metrics.networkType = state.type;
      this.metrics.networkStrength = this.calculateNetworkStrength(state);
      
      logDebug('Network state changed:', {
        type: state.type,
        isConnected: state.isConnected,
        strength: this.metrics.networkStrength
      });
    });

    // Measure network latency periodically
    setInterval(() => {
      this.measureNetworkLatency();
    }, 60000); // Every minute
  }

  private async startBatteryMonitoring(): Promise<void> {
    try {
      // Note: Battery monitoring requires native module implementation
      // This is a placeholder for the actual implementation
      setInterval(() => {
        this.checkBatteryLevel();
      }, 300000); // Every 5 minutes
    } catch (error) {
      logWarn('Battery monitoring not available:', error);
    }
  }

  private estimateMemoryUsage(): number {
    // This would use a native module for accurate memory measurement
    // For now, return a simulated value
    return Math.random() * 400 + 100; // 100-500 MB
  }

  private calculateNetworkStrength(state: any): 'poor' | 'moderate' | 'good' | 'excellent' {
    if (!state.isConnected) return 'poor';
    
    if (state.type === 'wifi') {
      return state.details?.strength > 70 ? 'excellent' : 'good';
    }
    
    if (state.type === 'cellular') {
      const cellularGen = state.details?.cellularGeneration;
      if (cellularGen === '4g' || cellularGen === '5g') return 'good';
      if (cellularGen === '3g') return 'moderate';
      return 'poor';
    }
    
    return 'moderate';
  }

  private async measureNetworkLatency(): Promise<void> {
    try {
      const start = Date.now();
      await fetch('https://www.google.com/generate_204', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      this.metrics.networkLatency = Date.now() - start;
      
      if (this.metrics.networkLatency > 1000) {
        logWarn(`High network latency: ${this.metrics.networkLatency}ms`);
      }
    } catch (error) {
      logWarn('Failed to measure network latency:', error);
      this.metrics.networkLatency = -1;
    }
  }

  private checkBatteryLevel(): void {
    // This would use Device.getBatteryLevelAsync() or similar
    // For now, simulate battery level
    this.metrics.batteryLevel = Math.random() * 100;
    
    if (this.metrics.batteryLevel < this.thresholds.minBatteryLevel) {
      this.createAlert('battery', this.metrics.batteryLevel, this.thresholds.minBatteryLevel);
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    value: number,
    threshold: number,
    context?: any
  ): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.calculateAlertSeverity(type, value, threshold),
      metric: type,
      value,
      threshold,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    logWarn(`Performance alert: ${type}`, {
      value,
      threshold,
      severity: alert.severity,
      context
    });
  }

  private calculateAlertSeverity(
    type: string,
    value: number,
    threshold: number
  ): PerformanceAlert['severity'] {
    const ratio = value / threshold;
    
    if (type === 'memory' || type === 'cpu') {
      if (ratio > 1.5) return 'critical';
      if (ratio > 1.2) return 'high';
      if (ratio > 1) return 'medium';
      return 'low';
    }
    
    if (type === 'app-start' || type === 'screen-load' || type === 'api') {
      if (ratio > 2) return 'critical';
      if (ratio > 1.5) return 'high';
      if (ratio > 1.2) return 'medium';
      return 'low';
    }
    
    return 'medium';
  }

  private bufferMetric(metric: Partial<PerformanceMetrics>): void {
    this.metricsBuffer.push(metric);
    
    // Flush buffer if it gets too large
    if (this.metricsBuffer.length > 100) {
      this.flushMetricsBuffer();
    }
  }

  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;
    
    try {
      const batch = this.metricsBuffer.splice(0, this.metricsBuffer.length);
      await this.persistMetrics(batch);
      logDebug(`Flushed ${batch.length} performance metrics`);
    } catch (error) {
      logError('Failed to flush metrics buffer:', error);
    }
  }

  private calculateAverageMetrics(): Partial<PerformanceMetrics> {
    const avgApiResponseTimes: Record<string, number> = {};
    
    Object.entries(this.metrics.apiResponseTimes).forEach(([key, times]) => {
      if (times.length > 0) {
        avgApiResponseTimes[key] = times.reduce((a, b) => a + b, 0) / times.length;
      }
    });

    return {
      appStartTime: this.metrics.appStartTime,
      memoryUsage: this.metrics.memoryUsage,
      cpuUsage: this.metrics.cpuUsage,
      networkLatency: this.metrics.networkLatency,
      cacheHitRate: this.metrics.cacheHitRate,
      frameDrops: this.metrics.frameDrops,
      apiResponseTimes: avgApiResponseTimes as any
    };
  }

  private calculateHealthScore(
    metrics: Partial<PerformanceMetrics>,
    alerts: PerformanceAlert[]
  ): number {
    let score = 100;
    
    // Deduct points for threshold violations
    if (metrics.appStartTime && metrics.appStartTime > this.thresholds.maxAppStartTime) {
      score -= 10;
    }
    
    if (metrics.memoryUsage && metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      score -= 15;
    }
    
    if (metrics.cpuUsage && metrics.cpuUsage > this.thresholds.maxCpuUsage) {
      score -= 10;
    }
    
    // Deduct points for active alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    
    score -= criticalAlerts * 20;
    score -= highAlerts * 10;
    
    return Math.max(0, score);
  }

  private generateRecommendations(
    metrics: Partial<PerformanceMetrics>,
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.appStartTime && metrics.appStartTime > this.thresholds.maxAppStartTime) {
      recommendations.push('Optimize app startup by lazy loading modules and reducing initial bundle size');
    }
    
    if (metrics.memoryUsage && metrics.memoryUsage > this.thresholds.maxMemoryUsage * 0.8) {
      recommendations.push('Monitor memory usage - consider implementing memory cleanup and image optimization');
    }
    
    if (metrics.frameDrops && metrics.frameDrops > 10) {
      recommendations.push('Optimize animations and reduce complex UI operations to prevent frame drops');
    }
    
    const slowAPIs = Object.entries(metrics.apiResponseTimes || {})
      .filter(([_, time]) => (time as any) > this.thresholds.maxApiResponseTime * 0.8);
    
    if (slowAPIs.length > 0) {
      recommendations.push(`Optimize slow API endpoints: ${slowAPIs.map(([k]) => k).join(', ')}`);
    }
    
    if (metrics.cacheHitRate && metrics.cacheHitRate < 0.5) {
      recommendations.push('Improve caching strategy to reduce API calls and improve performance');
    }
    
    return recommendations;
  }

  private async loadPersistedMetrics(): Promise<void> {
    try {
      const data = await secureStorage.getSecureItem('performance_metrics');
      if (data) {
        const persisted = JSON.parse(data);
        // Merge relevant persisted data
        this.metrics = { ...this.metrics, ...persisted };
      }
    } catch (error) {
      logWarn('Failed to load persisted metrics:', error);
    }
  }

  private async persistMetrics(metrics: Partial<PerformanceMetrics>[]): Promise<void> {
    try {
      const existing = await secureStorage.getSecureItem('performance_analytics');
      const analytics = existing ? JSON.parse(existing) : [];
      
      analytics.push({
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        metrics
      });
      
      // Keep only last 7 days of data
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = analytics.filter((a: any) => 
        new Date(a.timestamp).getTime() > cutoff
      );
      
      await secureStorage.storeSecureItem('performance_analytics', JSON.stringify(filtered));
    } catch (error) {
      logWarn('Failed to persist metrics:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    this.flushMetricsBuffer();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const performanceMonitoring = PerformanceMonitoringService.getInstance();

// Convenience functions
export const trackAppStart = (duration: number, type?: 'cold' | 'warm') =>
  performanceMonitoring.trackAppStart(duration, type);

export const trackScreenLoad = (screenName: string, duration: number, context?: PerformanceContext) =>
  performanceMonitoring.trackScreenLoad(screenName, duration, context);

export const trackScreenTransition = (from: string, to: string, duration: number) =>
  performanceMonitoring.trackScreenTransition(from, to, duration);

export const trackAPICall = (endpoint: string, method: string, duration: number, status: number, error?: Error) =>
  performanceMonitoring.trackAPICall(endpoint, method, duration, status, error);

export const trackFrameDrops = (count: number) =>
  performanceMonitoring.trackFrameDrops(count);

export const trackImageLoad = (url: string, duration: number, size?: number) =>
  performanceMonitoring.trackImageLoad(url, duration, size);

export const getPerformanceMetrics = () =>
  performanceMonitoring.getCurrentMetrics();

export const getPerformanceSummary = (period?: { start: Date; end: Date }) =>
  performanceMonitoring.getPerformanceSummary(period);