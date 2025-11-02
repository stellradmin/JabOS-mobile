// Memory performance integration utilities
// Integrates memory leak detection with existing performance monitoring
// Bridges memory testing with performance metrics and monitoring systems

import React from 'react';
import MemoryLeakTester from './memory-leak-testing';
import AutomatedLeakTestRunner from './automated-leak-tests';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface MemoryPerformanceMetrics {
  timestamp: number;
  componentName: string;
  memoryUsage: {
    jsHeapUsed: number;
    jsHeapTotal: number;
    jsHeapLimit: number;
    growth: number;
    efficiency: number; // Used/Total ratio
  };
  resourceCounts: {
    timers: number;
    refs: number;
    animations: number;
    subscriptions: number;
    eventListeners: number;
  };
  performance: {
    renderTime: number;
    componentLifecycleTime: number;
    memoryAllocationRate: number;
    garbageCollectionPressure: number;
  };
  leakRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

interface PerformanceAlert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'memory-leak' | 'performance-degradation' | 'resource-exhaustion' | 'gc-pressure';
  componentName: string;
  message: string;
  metrics: Partial<MemoryPerformanceMetrics>;
  actionRequired: boolean;
  recommendations: string[];
}

class MemoryPerformanceIntegrator {
  private static instance: MemoryPerformanceIntegrator;
  private memoryTester: MemoryLeakTester;
  private automatedRunner: AutomatedLeakTestRunner;
  private performanceMetrics: MemoryPerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;

  static getInstance(): MemoryPerformanceIntegrator {
    if (!MemoryPerformanceIntegrator.instance) {
      MemoryPerformanceIntegrator.instance = new MemoryPerformanceIntegrator();
    }
    return MemoryPerformanceIntegrator.instance;
  }

  constructor() {
    this.memoryTester = MemoryLeakTester.getInstance();
    this.automatedRunner = AutomatedLeakTestRunner.getInstance();
    this.setupPerformanceObserver();
  }

  // Set up performance observer for real-time metrics
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            this.processPerformanceEntry(entry);
          }
        });
      });

      // Observe various performance entry types
      this.performanceObserver.observe({ 
        entryTypes: ['measure', 'navigation', 'resource'] 
      });
    } catch (error) {
      logWarn('[MemoryPerformanceIntegrator] Performance Observer not supported:', "Warning", error);
    }
  }

  // Process performance entries for memory correlation
  private processPerformanceEntry(entry: PerformanceEntry): void {
    // Correlate performance metrics with memory usage
    if (entry.duration > 100) { // Long-running operations
      this.checkMemoryDuringPerformance(entry);
    }
  }

  // Check memory usage during performance events
  private async checkMemoryDuringPerformance(entry: PerformanceEntry): Promise<void> {
    const componentName = `performance_${entry.name || 'unknown'}`;
    const metrics = await this.captureMemoryPerformanceMetrics(componentName);
    
    if (metrics.leakRisk === 'high' || metrics.leakRisk === 'critical') {
      this.generateAlert({
        type: 'performance-degradation',
        severity: metrics.leakRisk === 'critical' ? 'critical' : 'error',
        componentName,
        message: `High memory usage detected during performance event: ${entry.name}`,
        metrics: { memoryUsage: metrics.memoryUsage, performance: metrics.performance },
        actionRequired: true,
        recommendations: [
          'Investigate memory allocation during this operation',
          'Check for memory leaks in event handlers',
          'Consider optimizing resource usage',
        ],
      });
    }
  }

  // Start comprehensive memory and performance monitoring
  startMonitoring(options: {
    interval?: number;
    alertThresholds?: {
      memoryGrowthMB?: number;
      resourceCount?: number;
      gcPressure?: number;
    };
    components?: string[];
  } = {}): void {
    if (this.monitoring || !__DEV__) return;

    const { 
      interval = 30000, 
      alertThresholds = {
        memoryGrowthMB: 20,
        resourceCount: 50,
        gcPressure: 0.8,
      },
      components = ['Global']
    } = options;

    this.monitoring = true;

    // Periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      for (const componentName of components) {
        const metrics = await this.captureMemoryPerformanceMetrics(componentName);
        this.performanceMetrics.push(metrics);
        
        // Check thresholds and generate alerts
        this.checkThresholds(metrics, alertThresholds);
      }
      
      // Cleanup old metrics (keep last 100)
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics = this.performanceMetrics.slice(-100);
      }
    }, interval);

    logDebug('[MemoryPerformanceIntegrator] Monitoring started', "Debug");
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (!this.monitoring) return;

    this.monitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    logDebug('[MemoryPerformanceIntegrator] Monitoring stopped', "Debug");
  }

  // Capture comprehensive memory and performance metrics
  async captureMemoryPerformanceMetrics(componentName: string): Promise<MemoryPerformanceMetrics> {
    const timestamp = Date.now();
    
    // Memory usage
    let memoryUsage = {
      jsHeapUsed: 0,
      jsHeapTotal: 0,
      jsHeapLimit: 0,
      growth: 0,
      efficiency: 0,
    };

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage.jsHeapUsed = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      memoryUsage.jsHeapTotal = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      memoryUsage.jsHeapLimit = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      memoryUsage.efficiency = memoryUsage.jsHeapTotal > 0 ? memoryUsage.jsHeapUsed / memoryUsage.jsHeapTotal : 0;
      
      // Calculate growth from previous measurement
      const previousMetrics = this.performanceMetrics
        .filter(m => m.componentName === componentName)
        .slice(-1)[0];
      
      if (previousMetrics) {
        memoryUsage.growth = memoryUsage.jsHeapUsed - previousMetrics.memoryUsage.jsHeapUsed;
      }
    }

    // Resource counts from tracking systems
    const resourceCounts = {
      timers: this.getResourceCount('timers'),
      refs: this.getResourceCount('refs'),
      animations: this.getResourceCount('animations'),
      subscriptions: this.getResourceCount('subscriptions'),
      eventListeners: this.getResourceCount('eventListeners'),
    };

    // Performance metrics
    const performanceMetrics = {
      renderTime: this.getRenderTime(),
      componentLifecycleTime: this.getComponentLifecycleTime(),
      memoryAllocationRate: this.getMemoryAllocationRate(),
      garbageCollectionPressure: this.getGCPressure(),
    };

    // Calculate leak risk
    const leakRisk = this.calculateLeakRisk(memoryUsage, resourceCounts, performanceMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(memoryUsage, resourceCounts, leakRisk);

    return {
      timestamp,
      componentName,
      memoryUsage,
      resourceCounts,
      performance: performanceMetrics,
      leakRisk,
      recommendations,
    };
  }

  // Get resource count from tracking systems
  private getResourceCount(resourceType: string): number {
    const trackers = {
      timers: (global as any).__timerTracker,
      refs: (global as any).__refTracker,
      animations: (global as any).__animationTracker,
      subscriptions: (global as any).__subscriptionTracker,
      eventListeners: (global as any).__eventListenerTracker,
    };

    const tracker = trackers[resourceType as keyof typeof trackers];
    if (!tracker) return 0;

    switch (resourceType) {
      case 'timers':
        return tracker.getActiveTimers?.()?.count || 0;
      case 'refs':
        return tracker.getActiveRefs?.()?.count || 0;
      case 'animations':
        return tracker.getActiveAnimations?.()?.total || 0;
      case 'subscriptions':
        return tracker.getActiveSubscriptions?.()?.total || 0;
      case 'eventListeners':
        return tracker.getActiveListeners?.()?.total || 0;
      default:
        return 0;
    }
  }

  // Estimate render time performance
  private getRenderTime(): number {
    if (typeof performance === 'undefined') return 0;
    
    // Check if getEntriesByType is available (not in React Native)
    if (typeof performance.getEntriesByType !== 'function') {
      return 0;
    }
    
    const entries = performance.getEntriesByType('measure');
    const renderEntries = entries.filter(e => 
      e.name.includes('render') || e.name.includes('React')
    );
    
    if (renderEntries.length === 0) return 0;
    
    return renderEntries.reduce((sum, entry) => sum + entry.duration, 0) / renderEntries.length;
  }

  // Estimate component lifecycle time
  private getComponentLifecycleTime(): number {
    if (typeof performance === 'undefined') return 0;
    
    // Check if getEntriesByType is available (not in React Native)
    if (typeof performance.getEntriesByType !== 'function') {
      return 0;
    }
    
    const entries = performance.getEntriesByType('measure');
    const lifecycleEntries = entries.filter(e => 
      e.name.includes('mount') || e.name.includes('unmount') || e.name.includes('update')
    );
    
    if (lifecycleEntries.length === 0) return 0;
    
    return lifecycleEntries.reduce((sum, entry) => sum + entry.duration, 0) / lifecycleEntries.length;
  }

  // Estimate memory allocation rate
  private getMemoryAllocationRate(): number {
    if (this.performanceMetrics.length < 2) return 0;
    
    const recent = this.performanceMetrics.slice(-5);
    if (recent.length < 2) return 0;
    
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const memoryGrowth = recent[recent.length - 1].memoryUsage.jsHeapUsed - recent[0].memoryUsage.jsHeapUsed;
    
    return timeSpan > 0 ? (memoryGrowth / timeSpan) * 1000 : 0; // MB per second
  }

  // Estimate garbage collection pressure
  private getGCPressure(): number {
    if (this.performanceMetrics.length < 3) return 0;
    
    const recent = this.performanceMetrics.slice(-10);
    let gcEvents = 0;
    
    // Look for sudden memory drops (indicating GC)
    for (let i = 1; i < recent.length; i++) {
      const memoryDrop = recent[i - 1].memoryUsage.jsHeapUsed - recent[i].memoryUsage.jsHeapUsed;
      if (memoryDrop > 5) { // 5MB drop
        gcEvents++;
      }
    }
    
    return gcEvents / recent.length; // GC events per measurement
  }

  // Calculate overall leak risk
  private calculateLeakRisk(
    memoryUsage: any,
    resourceCounts: any,
    performance: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;
    
    // Memory factors
    if (memoryUsage.growth > 30) riskScore += 3; // Critical growth
    else if (memoryUsage.growth > 15) riskScore += 2; // High growth
    else if (memoryUsage.growth > 5) riskScore += 1; // Medium growth
    
    if (memoryUsage.efficiency > 0.9) riskScore += 2; // High memory efficiency
    else if (memoryUsage.efficiency > 0.8) riskScore += 1;
    
    // Resource factors
    const totalResources = Object.values(resourceCounts).reduce((sum: number, count) => sum + (count as number), 0);
    if (totalResources > 100) riskScore += 3;
    else if (totalResources > 50) riskScore += 2;
    else if (totalResources > 25) riskScore += 1;
    
    // Performance factors
    if (performance.garbageCollectionPressure > 0.5) riskScore += 2;
    if (performance.memoryAllocationRate > 1) riskScore += 1; // 1MB/s
    
    // Determine risk level
    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  // Generate recommendations based on metrics
  private generateRecommendations(
    memoryUsage: any,
    resourceCounts: any,
    leakRisk: string
  ): string[] {
    const recommendations: string[] = [];
    
    if (memoryUsage.growth > 20) {
      recommendations.push('Significant memory growth detected - investigate for memory leaks');
    }
    
    if (memoryUsage.efficiency > 0.9) {
      recommendations.push('High memory efficiency - consider garbage collection optimization');
    }
    
    if (resourceCounts.timers > 20) {
      recommendations.push('High timer count - ensure timers are cleaned up properly');
    }
    
    if (resourceCounts.subscriptions > 15) {
      recommendations.push('High subscription count - review subscription lifecycle management');
    }
    
    if (resourceCounts.eventListeners > 30) {
      recommendations.push('High event listener count - consider event delegation patterns');
    }
    
    if (leakRisk === 'critical' || leakRisk === 'high') {
      recommendations.push('Run automated memory leak tests to identify specific issues');
      recommendations.push('Profile component memory usage during development');
    }
    
    return recommendations;
  }

  // Check thresholds and generate alerts
  private checkThresholds(
    metrics: MemoryPerformanceMetrics,
    thresholds: any
  ): void {
    const alerts: Partial<PerformanceAlert>[] = [];
    
    // Memory growth threshold
    if (metrics.memoryUsage.growth > thresholds.memoryGrowthMB) {
      alerts.push({
        type: 'memory-leak',
        severity: metrics.memoryUsage.growth > thresholds.memoryGrowthMB * 2 ? 'critical' : 'error',
        message: `Memory growth exceeds threshold: +${metrics.memoryUsage.growth}MB`,
        actionRequired: true,
      });
    }
    
    // Resource count threshold
    const totalResources = Object.values(metrics.resourceCounts).reduce((sum, count) => sum + count, 0);
    if (totalResources > thresholds.resourceCount) {
      alerts.push({
        type: 'resource-exhaustion',
        severity: totalResources > thresholds.resourceCount * 2 ? 'critical' : 'warning',
        message: `Resource count exceeds threshold: ${totalResources} resources`,
        actionRequired: totalResources > thresholds.resourceCount * 1.5,
      });
    }
    
    // GC pressure threshold
    if (metrics.performance.garbageCollectionPressure > thresholds.gcPressure) {
      alerts.push({
        type: 'gc-pressure',
        severity: 'warning',
        message: `High garbage collection pressure: ${metrics.performance.garbageCollectionPressure.toFixed(2)}`,
        actionRequired: false,
      });
    }
    
    // Generate alerts
    alerts.forEach(alertData => {
      this.generateAlert({
        componentName: metrics.componentName,
        metrics,
        recommendations: metrics.recommendations,
        ...alertData,
      } as Partial<PerformanceAlert>);
    });
  }

  // Generate performance alert
  private generateAlert(alertData: Partial<PerformanceAlert>): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity: alertData.severity || 'info',
      type: alertData.type || 'memory-leak',
      componentName: alertData.componentName || 'Unknown',
      message: alertData.message || 'Memory performance alert',
      metrics: alertData.metrics || {},
      actionRequired: alertData.actionRequired || false,
      recommendations: alertData.recommendations || [],
    };

    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // Log alert
    const logMethod = alert.severity === 'critical' ? 'error' : 
                     alert.severity === 'error' ? 'error' :
                     alert.severity === 'warning' ? 'warn' : 'log';
    
    console[logMethod](`[MemoryPerformanceIntegrator] ${alert.severity.toUpperCase()}: ${alert.message}`);
    
    if (alert.actionRequired) {
      console[logMethod]('Action required! Recommendations:', alert.recommendations);
    }
  }

  // Get current performance status
  getPerformanceStatus(): {
    isMonitoring: boolean;
    recentMetrics: MemoryPerformanceMetrics[];
    activeAlerts: PerformanceAlert[];
    summary: {
      averageMemoryUsage: number;
      averageResourceCount: number;
      alertCount: number;
      riskLevel: string;
    };
  } {
    const recentMetrics = this.performanceMetrics.slice(-10);
    const activeAlerts = this.alerts.filter(a => 
      Date.now() - a.timestamp < 300000 // Last 5 minutes
    );
    
    const summary = {
      averageMemoryUsage: recentMetrics.length > 0 
        ? recentMetrics.reduce((sum, m) => sum + m.memoryUsage.jsHeapUsed, 0) / recentMetrics.length 
        : 0,
      averageResourceCount: recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => 
            sum + Object.values(m.resourceCounts).reduce((rSum, count) => rSum + count, 0), 0
          ) / recentMetrics.length
        : 0,
      alertCount: activeAlerts.length,
      riskLevel: recentMetrics.length > 0 
        ? recentMetrics[recentMetrics.length - 1].leakRisk 
        : 'low',
    };

    return {
      isMonitoring: this.monitoring,
      recentMetrics,
      activeAlerts,
      summary,
    };
  }

  // Generate comprehensive report
  generateComprehensiveReport(): {
    performance: any;
    memoryTesting: any;
    automatedTesting: any;
    integration: {
      correlatedIssues: any[];
      performanceImpact: any;
      recommendations: string[];
    };
  } {
    const memoryTestingReport = this.memoryTester.generateTestReport();
    const automatedTestingReport = this.automatedRunner.generateComprehensiveReport();
    const performanceStatus = this.getPerformanceStatus();

    // Find correlated issues
    const correlatedIssues = this.findCorrelatedIssues();
    
    // Assess performance impact
    const performanceImpact = this.assessPerformanceImpact();

    return {
      performance: performanceStatus,
      memoryTesting: memoryTestingReport,
      automatedTesting: automatedTestingReport,
      integration: {
        correlatedIssues,
        performanceImpact,
        recommendations: [
          ...performanceStatus.recentMetrics.slice(-1)[0]?.recommendations || [],
          ...memoryTestingReport.recommendations,
          ...automatedTestingReport.recommendations,
          'Monitor memory usage during performance-critical operations',
          'Set up automated alerts for memory and performance thresholds',
          'Regularly review correlation between memory leaks and performance degradation',
        ],
      },
    };
  }

  // Find correlated issues between memory and performance
  private findCorrelatedIssues(): any[] {
    const issues: any[] = [];
    
    // Correlate high memory usage with poor performance
    const recentMetrics = this.performanceMetrics.slice(-10);
    recentMetrics.forEach(metric => {
      if (metric.memoryUsage.growth > 15 && metric.performance.renderTime > 50) {
        issues.push({
          type: 'memory-performance-correlation',
          severity: 'high',
          description: `High memory growth (${metric.memoryUsage.growth}MB) correlated with poor render performance (${metric.performance.renderTime}ms)`,
          componentName: metric.componentName,
          timestamp: metric.timestamp,
        });
      }
    });
    
    return issues;
  }

  // Assess performance impact of memory issues
  private assessPerformanceImpact(): any {
    const recentMetrics = this.performanceMetrics.slice(-5);
    if (recentMetrics.length === 0) return { impact: 'unknown' };
    
    const avgMemoryGrowth = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.growth, 0) / recentMetrics.length;
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.performance.renderTime, 0) / recentMetrics.length;
    
    let impact = 'low';
    if (avgMemoryGrowth > 20 || avgRenderTime > 100) impact = 'high';
    else if (avgMemoryGrowth > 10 || avgRenderTime > 50) impact = 'medium';
    
    return {
      impact,
      avgMemoryGrowth,
      avgRenderTime,
      recommendation: impact === 'high' 
        ? 'Immediate investigation required - memory issues are significantly impacting performance'
        : impact === 'medium'
        ? 'Monitor closely - potential performance impact from memory usage'
        : 'Performance impact is minimal',
    };
  }
}

// React hook for memory performance integration
export const useMemoryPerformanceIntegration = (
  componentName: string,
  options: {
    enableMonitoring?: boolean;
    alertThresholds?: any;
    trackPerformance?: boolean;
  } = {}
) => {
  const integrator = MemoryPerformanceIntegrator.getInstance();
  const [status, setStatus] = React.useState<any>(null);
  
  const { enableMonitoring = __DEV__, alertThresholds, trackPerformance = true } = options;

  React.useEffect(() => {
    if (enableMonitoring) {
      integrator.startMonitoring({
        alertThresholds,
        components: [componentName],
      });
    }

    return () => {
      if (enableMonitoring) {
        integrator.stopMonitoring();
      }
    };
  }, [enableMonitoring, componentName]);

  const captureMetrics = React.useCallback(async () => {
    const metrics = await integrator.captureMemoryPerformanceMetrics(componentName);
    setStatus(metrics);
    return metrics;
  }, [componentName]);

  const getStatus = React.useCallback(() => {
    return integrator.getPerformanceStatus();
  }, []);

  const generateReport = React.useCallback(() => {
    return integrator.generateComprehensiveReport();
  }, []);

  return {
    captureMetrics,
    getStatus,
    generateReport,
    status,
    isEnabled: enableMonitoring,
  };
};

export default MemoryPerformanceIntegrator;
