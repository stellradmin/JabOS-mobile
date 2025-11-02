// @ts-nocheck
// Subscription leak detection utilities for development environments
// Detects and reports subscription-related memory leaks and performance issues
// Development-only utilities with zero production impact

import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface SubscriptionLeakReport {
  timestamp: number;
  componentName?: string;
  leakType: 'context-leak' | 'supabase-leak' | 'websocket-leak' | 'listener-buildup' | 'stale-subscription' | 'channel-leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  subscriptionInfo?: {
    id?: string;
    type?: string;
    connectionId?: string;
    eventType?: string;
    channelName?: string;
    triggerCount?: number;
    errorCount?: number;
    duration?: number;
  };
  recommendations: string[];
}

interface SubscriptionMemorySnapshot {
  timestamp: number;
  componentName: string;
  contextSubscriptions: {
    total: number;
    active: number;
    byType: Record<string, number>;
  };
  supabaseSubscriptions: {
    total: number;
    connected: number;
    byTable: Record<string, number>;
    channels: number;
  };
  webSocketConnections: {
    total: number;
    connected: number;
    subscriptions: number;
    byProtocol: Record<string, number>;
  };
  eventListeners: {
    total: number;
    byType: Record<string, number>;
    orphaned: number;
  };
  memoryUsage?: {
    usedMB: number;
    totalMB: number;
  };
  performance: {
    avgResponseTime: number;
    maxResponseTime: number;
    failedConnections: number;
  };
}

class SubscriptionLeakDetector {
  private static instance: SubscriptionLeakDetector;
  private snapshots: SubscriptionMemorySnapshot[] = [];
  private leakReports: SubscriptionLeakReport[] = [];
  private monitoringActive = false;
  private monitorInterval?: NodeJS.Timeout;
  private connectionMonitor?: NodeJS.Timeout;

  static getInstance(): SubscriptionLeakDetector {
    if (!SubscriptionLeakDetector.instance) {
      SubscriptionLeakDetector.instance = new SubscriptionLeakDetector();
    }
    return SubscriptionLeakDetector.instance;
  }

  startMonitoring(options: {
    interval?: number;
    trackMemoryUsage?: boolean;
    trackConnections?: boolean;
    componentName?: string;
  } = {}): void {
    if (this.monitoringActive || !__DEV__) return;

    const { 
      interval = 30000, 
      trackMemoryUsage = true, 
      trackConnections = true,
      componentName = 'Global' 
    } = options;

    this.monitoringActive = true;

    // Periodic snapshots and analysis
    this.monitorInterval = setInterval(() => {
      this.takeSnapshot(componentName, trackMemoryUsage);
      this.analyzeForSubscriptionLeaks();
    }, interval);

    // Connection health monitoring
    if (trackConnections) {
      this.setupConnectionMonitoring();
    }

    logDebug('[SubscriptionLeakDetector] Monitoring started', "Debug");
  }

  stopMonitoring(): void {
    if (!this.monitoringActive) return;

    this.monitoringActive = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = undefined;
    }

    logDebug('[SubscriptionLeakDetector] Monitoring stopped', "Debug");
  }

  private takeSnapshot(componentName: string, trackMemoryUsage: boolean): SubscriptionMemorySnapshot {
    const snapshot: SubscriptionMemorySnapshot = {
      timestamp: Date.now(),
      componentName,
      contextSubscriptions: this.getContextSubscriptionStats(),
      supabaseSubscriptions: this.getSupabaseSubscriptionStats(),
      webSocketConnections: this.getWebSocketConnectionStats(),
      eventListeners: this.getEventListenerStats(),
      performance: this.getPerformanceStats(),
    };

    // Add memory usage if available and tracking enabled
    if (trackMemoryUsage && 'memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.memoryUsage = {
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      };
    }

    this.snapshots.push(snapshot);

    // Keep only last 50 snapshots
    if (this.snapshots.length > 50) {
      this.snapshots = this.snapshots.slice(-50);
    }

    return snapshot;
  }

  private getContextSubscriptionStats() {
    // These would integrate with our context subscription hooks
    const contextSubs = (window as any).__contextSubscriptionTracker || { total: 0, active: 0, byType: {} };
    return {
      total: contextSubs.total || 0,
      active: contextSubs.active || 0,
      byType: contextSubs.byType || {},
    };
  }

  private getSupabaseSubscriptionStats() {
    // These would integrate with our Supabase subscription hooks
    const supabaseSubs = (window as any).__supabaseSubscriptionTracker || { 
      total: 0, connected: 0, byTable: {}, channels: 0 
    };
    return {
      total: supabaseSubs.total || 0,
      connected: supabaseSubs.connected || 0,
      byTable: supabaseSubs.byTable || {},
      channels: supabaseSubs.channels || 0,
    };
  }

  private getWebSocketConnectionStats() {
    // These would integrate with our WebSocket manager hooks
    const wsSubs = (window as any).__webSocketTracker || { 
      total: 0, connected: 0, subscriptions: 0, byProtocol: {} 
    };
    return {
      total: wsSubs.total || 0,
      connected: wsSubs.connected || 0,
      subscriptions: wsSubs.subscriptions || 0,
      byProtocol: wsSubs.byProtocol || {},
    };
  }

  private getEventListenerStats() {
    // These would integrate with event listener tracking
    const eventListeners = (window as any).__eventListenerTracker || { 
      total: 0, byType: {}, orphaned: 0 
    };
    return {
      total: eventListeners.total || 0,
      byType: eventListeners.byType || {},
      orphaned: eventListeners.orphaned || 0,
    };
  }

  private getPerformanceStats() {
    // These would track actual performance metrics
    const perfStats = (window as any).__subscriptionPerformanceTracker || {
      avgResponseTime: 0,
      maxResponseTime: 0,
      failedConnections: 0,
    };
    return {
      avgResponseTime: perfStats.avgResponseTime || 0,
      maxResponseTime: perfStats.maxResponseTime || 0,
      failedConnections: perfStats.failedConnections || 0,
    };
  }

  private setupConnectionMonitoring(): void {
    this.connectionMonitor = setInterval(() => {
      this.checkConnectionHealth();
    }, 15000); // Check every 15 seconds
  }

  private checkConnectionHealth(): void {
    const wsStats = this.getWebSocketConnectionStats();
    const supabaseStats = this.getSupabaseSubscriptionStats();
    const perfStats = this.getPerformanceStats();

    // Check for failed connections
    if (perfStats.failedConnections > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'websocket-leak',
        severity: 'high',
        description: `High connection failure rate: ${perfStats.failedConnections} failed connections`,
        recommendations: [
          'Check network connectivity',
          'Review WebSocket server status',
          'Consider implementing exponential backoff',
          'Monitor connection retry logic',
        ],
      });
    }

    // Check for poor response times
    if (perfStats.avgResponseTime > 5000) { // 5 seconds
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'listener-buildup',
        severity: 'medium',
        description: `Poor average response time: ${perfStats.avgResponseTime}ms`,
        recommendations: [
          'Optimize subscription callback functions',
          'Check for blocking operations in handlers',
          'Consider debouncing frequent updates',
        ],
      });
    }

    // Check for disconnected Supabase channels
    if (supabaseStats.total > 0 && supabaseStats.connected === 0) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'supabase-leak',
        severity: 'high',
        description: 'All Supabase subscriptions disconnected',
        recommendations: [
          'Check Supabase service status',
          'Review authentication tokens',
          'Implement reconnection logic',
        ],
      });
    }
  }

  private analyzeForSubscriptionLeaks(): void {
    if (this.snapshots.length < 2) return;

    const current = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    this.checkContextSubscriptionIncrease(previous, current);
    this.checkSupabaseSubscriptionLeaks(previous, current);
    this.checkWebSocketConnectionLeaks(previous, current);
    this.checkEventListenerLeaks(previous, current);
    this.checkMemoryIncrease(previous, current);
  }

  private checkContextSubscriptionIncrease(previous: SubscriptionMemorySnapshot, current: SubscriptionMemorySnapshot): void {
    const subscriptionIncrease = current.contextSubscriptions.total - previous.contextSubscriptions.total;
    const activeIncrease = current.contextSubscriptions.active - previous.contextSubscriptions.active;
    
    if (subscriptionIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'context-leak',
        severity: subscriptionIncrease > 15 ? 'high' : 'medium',
        description: `Context subscription count increased by ${subscriptionIncrease}`,
        subscriptionInfo: {
          triggerCount: current.contextSubscriptions.total,
        },
        recommendations: [
          'Check for context subscriptions created in render loops',
          'Ensure subscription cleanup on component unmount',
          'Review context provider structure',
          'Consider subscription memoization',
        ],
      });
    }

    if (activeIncrease > 3 && current.contextSubscriptions.active > 20) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'context-leak',
        severity: 'medium',
        description: `High number of active context subscriptions: ${current.contextSubscriptions.active}`,
        recommendations: [
          'Review subscription necessity',
          'Consider context splitting',
          'Implement subscription batching',
        ],
      });
    }
  }

  private checkSupabaseSubscriptionLeaks(previous: SubscriptionMemorySnapshot, current: SubscriptionMemorySnapshot): void {
    const subscriptionIncrease = current.supabaseSubscriptions.total - previous.supabaseSubscriptions.total;
    const channelIncrease = current.supabaseSubscriptions.channels - previous.supabaseSubscriptions.channels;
    
    if (subscriptionIncrease > 3) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'supabase-leak',
        severity: subscriptionIncrease > 8 ? 'high' : 'medium',
        description: `Supabase subscription count increased by ${subscriptionIncrease}`,
        subscriptionInfo: {
          triggerCount: current.supabaseSubscriptions.total,
        },
        recommendations: [
          'Check for duplicate subscriptions to same table/event',
          'Ensure Supabase subscriptions are cleaned up on unmount',
          'Review subscription grouping strategy',
          'Consider subscription pooling',
        ],
      });
    }

    if (channelIncrease > 2) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'channel-leak',
        severity: 'medium',
        description: `Supabase channel count increased by ${channelIncrease}`,
        recommendations: [
          'Check for channel reuse opportunities',
          'Ensure channels are closed when no longer needed',
          'Review channel lifecycle management',
        ],
      });
    }

    // Check for disconnected subscriptions
    if (current.supabaseSubscriptions.total > 0 && current.supabaseSubscriptions.connected < current.supabaseSubscriptions.total * 0.5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'supabase-leak',
        severity: 'high',
        description: `Many Supabase subscriptions disconnected: ${current.supabaseSubscriptions.connected}/${current.supabaseSubscriptions.total}`,
        recommendations: [
          'Check network connectivity',
          'Review authentication status',
          'Implement reconnection logic',
          'Monitor Supabase service status',
        ],
      });
    }
  }

  private checkWebSocketConnectionLeaks(previous: SubscriptionMemorySnapshot, current: SubscriptionMemorySnapshot): void {
    const connectionIncrease = current.webSocketConnections.total - previous.webSocketConnections.total;
    const subscriptionIncrease = current.webSocketConnections.subscriptions - previous.webSocketConnections.subscriptions;
    
    if (connectionIncrease > 2) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'websocket-leak',
        severity: connectionIncrease > 5 ? 'high' : 'medium',
        description: `WebSocket connection count increased by ${connectionIncrease}`,
        subscriptionInfo: {
          triggerCount: current.webSocketConnections.total,
        },
        recommendations: [
          'Check for connection reuse opportunities',
          'Ensure WebSocket connections are closed properly',
          'Review connection pooling strategy',
          'Monitor connection lifecycle',
        ],
      });
    }

    if (subscriptionIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'websocket-leak',
        severity: 'medium',
        description: `WebSocket subscription count increased by ${subscriptionIncrease}`,
        recommendations: [
          'Check for duplicate event subscriptions',
          'Ensure WebSocket subscriptions are unsubscribed',
          'Review event handler cleanup',
        ],
      });
    }

    // Check for disconnected WebSocket connections
    if (current.webSocketConnections.total > 0 && current.webSocketConnections.connected === 0) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'websocket-leak',
        severity: 'high',
        description: 'All WebSocket connections disconnected',
        recommendations: [
          'Check WebSocket server availability',
          'Review network connectivity',
          'Implement reconnection logic',
          'Monitor WebSocket server status',
        ],
      });
    }
  }

  private checkEventListenerLeaks(previous: SubscriptionMemorySnapshot, current: SubscriptionMemorySnapshot): void {
    const listenerIncrease = current.eventListeners.total - previous.eventListeners.total;
    const orphanedIncrease = current.eventListeners.orphaned - previous.eventListeners.orphaned;
    
    if (listenerIncrease > 10) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'listener-buildup',
        severity: listenerIncrease > 25 ? 'high' : 'medium',
        description: `Event listener count increased by ${listenerIncrease}`,
        subscriptionInfo: {
          triggerCount: current.eventListeners.total,
        },
        recommendations: [
          'Check for event listeners added in render cycles',
          'Ensure event listeners are removed on cleanup',
          'Review event delegation patterns',
          'Consider using passive listeners where appropriate',
        ],
      });
    }

    if (orphanedIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'listener-buildup',
        severity: 'high',
        description: `Orphaned event listener count increased by ${orphanedIncrease}`,
        recommendations: [
          'Clean up orphaned event listeners immediately',
          'Review listener cleanup in component unmount',
          'Check for memory references preventing garbage collection',
        ],
      });
    }
  }

  private checkMemoryIncrease(previous: SubscriptionMemorySnapshot, current: SubscriptionMemorySnapshot): void {
    if (!previous.memoryUsage || !current.memoryUsage) return;

    const memoryIncrease = current.memoryUsage.usedMB - previous.memoryUsage.usedMB;
    
    if (memoryIncrease > 20) { // 20MB increase
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'stale-subscription',
        severity: memoryIncrease > 50 ? 'critical' : 'high',
        description: `Significant memory increase: +${memoryIncrease}MB (possibly subscription-related)`,
        subscriptionInfo: {
          duration: current.memoryUsage.usedMB,
        },
        recommendations: [
          'Check for subscription-related memory leaks',
          'Review subscription cleanup patterns',
          'Monitor callback function references',
          'Consider subscription debouncing',
          'Force garbage collection and check if memory is released',
        ],
      });
    }
  }

  private reportLeak(leak: SubscriptionLeakReport): void {
    this.leakReports.push(leak);

    // Keep only last 100 reports
    if (this.leakReports.length > 100) {
      this.leakReports = this.leakReports.slice(-100);
    }

    // Console output based on severity
    const logMethod = leak.severity === 'critical' ? 'error' : 
                     leak.severity === 'high' ? 'error' :
                     leak.severity === 'medium' ? 'warn' : 'log';

    console[logMethod](`[SubscriptionLeakDetector] ${leak.severity.toUpperCase()}: ${leak.description}`);
    
    if (leak.subscriptionInfo) {
      console[logMethod]('Subscription info:', leak.subscriptionInfo);
    }
    
    console[logMethod]('Recommendations:', leak.recommendations);
  }

  // Manual subscription analysis methods
  detectStaleSubscriptions(subscriptionMap: Map<string, any>): SubscriptionLeakReport[] {
    const leaks: SubscriptionLeakReport[] = [];
    const now = Date.now();

    subscriptionMap.forEach((subscription, id) => {
      // Check for subscriptions not triggered for a long time
      if (subscription.lastTriggered && subscription.isActive) {
        const inactiveTime = now - subscription.lastTriggered;
        
        if (inactiveTime > 1800000) { // 30 minutes
          leaks.push({
            timestamp: now,
            leakType: 'stale-subscription',
            severity: inactiveTime > 3600000 ? 'high' : 'medium', // 1 hour
            description: `Subscription ${id} inactive for ${Math.round(inactiveTime / 60000)} minutes`,
            subscriptionInfo: {
              id,
              type: subscription.type,
              duration: inactiveTime,
            },
            recommendations: [
              'Check if subscription is still needed',
              'Consider cleaning up inactive subscriptions',
              'Review subscription lifecycle management',
            ],
          });
        }
      }

      // Check for subscriptions with high error rates
      if (subscription.errorCount > 20) {
        leaks.push({
          timestamp: now,
          leakType: 'listener-buildup',
          severity: 'high',
          description: `Subscription ${id} has ${subscription.errorCount} errors`,
          subscriptionInfo: {
            id,
            type: subscription.type,
            errorCount: subscription.errorCount,
          },
          recommendations: [
            'Review subscription error handling',
            'Check for problematic callback implementations',
            'Consider subscription retry logic',
          ],
        });
      }
    });

    return leaks;
  }

  detectConnectionLeaks(connectionMap: Map<string, any>): SubscriptionLeakReport[] {
    const leaks: SubscriptionLeakReport[] = [];
    const now = Date.now();

    connectionMap.forEach((connection, id) => {
      // Check for connections stuck in connecting state
      if (connection.state === 'connecting' && connection.createdAt) {
        const connectingTime = now - connection.createdAt;
        
        if (connectingTime > 60000) { // 1 minute
          leaks.push({
            timestamp: now,
            leakType: 'websocket-leak',
            severity: 'high',
            description: `Connection ${id} stuck connecting for ${Math.round(connectingTime / 1000)} seconds`,
            subscriptionInfo: {
              id,
              connectionId: connection.id,
              duration: connectingTime,
            },
            recommendations: [
              'Check connection timeout settings',
              'Review server availability',
              'Implement connection timeout handling',
            ],
          });
        }
      }

      // Check for connections with excessive reconnect attempts
      if (connection.reconnectAttempts > 10) {
        leaks.push({
          timestamp: now,
          leakType: 'websocket-leak',
          severity: 'high',
          description: `Connection ${id} has ${connection.reconnectAttempts} reconnect attempts`,
          subscriptionInfo: {
            id,
            connectionId: connection.id,
            triggerCount: connection.reconnectAttempts,
          },
          recommendations: [
            'Review reconnection strategy',
            'Check server stability',
            'Consider exponential backoff',
            'Implement maximum retry limits',
          ],
        });
      }
    });

    return leaks;
  }

  // Report generation
  generateSubscriptionLeakReport(): {
    summary: {
      totalLeaks: number;
      leaksBySeverity: Record<string, number>;
      leaksByType: Record<string, number>;
      recentLeaks: SubscriptionLeakReport[];
    };
    snapshots: SubscriptionMemorySnapshot[];
    performance: {
      avgResponseTime: number;
      totalFailedConnections: number;
      memoryTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
    };
    recommendations: string[];
  } {
    const leaksBySeverity = this.leakReports.reduce((acc, leak) => {
      acc[leak.severity] = (acc[leak.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const leaksByType = this.leakReports.reduce((acc, leak) => {
      acc[leak.leakType] = (acc[leak.leakType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const performance = this.calculatePerformanceMetrics();
    const recommendations = this.generateRecommendations();

    return {
      summary: {
        totalLeaks: this.leakReports.length,
        leaksBySeverity,
        leaksByType,
        recentLeaks: this.leakReports.slice(-10),
      },
      snapshots: this.snapshots.slice(-10),
      performance,
      recommendations,
    };
  }

  private calculatePerformanceMetrics() {
    if (this.snapshots.length === 0) {
      return {
        avgResponseTime: 0,
        totalFailedConnections: 0,
        memoryTrend: 'unknown' as const,
      };
    }

    const recent = this.snapshots.slice(-5);
    const avgResponseTime = recent.reduce((sum, s) => sum + s.performance.avgResponseTime, 0) / recent.length;
    const totalFailedConnections = recent.reduce((sum, s) => sum + s.performance.failedConnections, 0);

    let memoryTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown' = 'unknown';
    if (recent.length > 2 && recent.every(s => s.memoryUsage)) {
      const memoryValues = recent.map(s => s.memoryUsage!.usedMB);
      const isIncreasing = memoryValues.every((val, i) => i === 0 || val >= memoryValues[i - 1] * 1.05);
      const isDecreasing = memoryValues.every((val, i) => i === 0 || val <= memoryValues[i - 1] * 0.95);
      
      if (isIncreasing) memoryTrend = 'increasing';
      else if (isDecreasing) memoryTrend = 'decreasing';
      else memoryTrend = 'stable';
    }

    return {
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      totalFailedConnections,
      memoryTrend,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const criticalLeaks = this.leakReports.filter(l => l.severity === 'critical').length;
    const highLeaks = this.leakReports.filter(l => l.severity === 'high').length;
    const contextLeaks = this.leakReports.filter(l => l.leakType === 'context-leak').length;
    const supabaseLeaks = this.leakReports.filter(l => l.leakType === 'supabase-leak').length;
    const websocketLeaks = this.leakReports.filter(l => l.leakType === 'websocket-leak').length;
    const listenerLeaks = this.leakReports.filter(l => l.leakType === 'listener-buildup').length;

    if (criticalLeaks > 0) {
      recommendations.push('URGENT: Critical subscription memory leaks detected - investigate immediately');
    }

    if (highLeaks > 3) {
      recommendations.push('Multiple high-severity subscription issues - review subscription cleanup patterns');
    }

    if (contextLeaks > 2) {
      recommendations.push('Context subscription leaks detected - implement automatic cleanup patterns');
    }

    if (supabaseLeaks > 1) {
      recommendations.push('Supabase subscription issues detected - review real-time subscription management');
    }

    if (websocketLeaks > 1) {
      recommendations.push('WebSocket connection leaks detected - review connection lifecycle management');
    }

    if (listenerLeaks > 2) {
      recommendations.push('Event listener buildup detected - ensure proper listener cleanup');
    }

    const performance = this.calculatePerformanceMetrics();
    if (performance.memoryTrend === 'increasing') {
      recommendations.push('Memory usage consistently increasing - audit subscription resource management');
    }

    if (performance.avgResponseTime > 3000) {
      recommendations.push('High average response time - optimize subscription callback functions');
    }

    if (performance.totalFailedConnections > 5) {
      recommendations.push('Frequent connection failures - review network handling and retry logic');
    }

    return recommendations;
  }

  clearHistory(): void {
    this.snapshots = [];
    this.leakReports = [];
  }
}

// Hook for automatic subscription leak detection
export const useSubscriptionLeakDetection = (options: {
  enabled?: boolean;
  interval?: number;
  trackMemoryUsage?: boolean;
  componentName?: string;
} = {}) => {
  const { enabled = __DEV__, interval = 30000, trackMemoryUsage = true, componentName } = options;

  const detector = SubscriptionLeakDetector.getInstance();

  // Start monitoring when enabled
  useEffect(() => {
    if (enabled) {
      detector.startMonitoring({ interval, trackMemoryUsage, componentName });
    }

    return () => {
      if (enabled) {
        detector.stopMonitoring();
      }
    };
  }, [enabled, interval, trackMemoryUsage, componentName]);

  const manualDetection = useCallback((subscriptionMap: Map<string, any>) => {
    return detector.detectStaleSubscriptions(subscriptionMap);
  }, []);

  const manualConnectionDetection = useCallback((connectionMap: Map<string, any>) => {
    return detector.detectConnectionLeaks(connectionMap);
  }, []);

  const generateReport = useCallback(() => {
    return detector.generateSubscriptionLeakReport();
  }, []);

  const clearHistory = useCallback(() => {
    detector.clearHistory();
  }, []);

  return {
    manualDetection,
    manualConnectionDetection,
    generateReport,
    clearHistory,
    isMonitoring: detector['monitoringActive'],
  };
};

// Global setup function for subscription leak detection
export const setupGlobalSubscriptionLeakDetection = (options: {
  autoStart?: boolean;
  interval?: number;
  trackMemoryUsage?: boolean;
  reportToConsole?: boolean;
} = {}) => {
  if (!__DEV__) return;

  const { autoStart = true, interval = 30000, trackMemoryUsage = true, reportToConsole = true } = options;
  const detector = SubscriptionLeakDetector.getInstance();

  if (autoStart) {
    detector.startMonitoring({ interval, trackMemoryUsage });
  }

  // Global report function
  (window as any).__subscriptionLeakDetector = {
    generateReport: () => detector.generateSubscriptionLeakReport(),
    clearHistory: () => detector.clearHistory(),
    startMonitoring: (opts?: any) => detector.startMonitoring(opts),
    stopMonitoring: () => detector.stopMonitoring(),
  };

  // Periodic console reports
  if (reportToConsole) {
    setInterval(() => {
      const report = detector.generateSubscriptionLeakReport();
      
      if (report.summary.totalLeaks > 0) {
        console.group('[SubscriptionLeakDetector] Periodic Report');
        logDebug('Total leaks:', "Debug", report.summary.totalLeaks);
        logDebug('By severity:', "Debug", report.summary.leaksBySeverity);
        logDebug('By type:', "Debug", report.summary.leaksByType);
        logDebug('Performance:', "Debug", report.performance);
        logDebug('Recommendations:', "Debug", report.recommendations);
        console.groupEnd();
      }
    }, 60000); // Every minute
  }

  logDebug('[SubscriptionLeakDetector] Global detection enabled', "Debug");
};

export default SubscriptionLeakDetector;
