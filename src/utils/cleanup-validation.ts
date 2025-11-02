// Development-only cleanup validation utilities
// Helps detect memory leaks and improper cleanup during development

import React, { useEffect, useRef, useCallback } from 'react';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface CleanupValidationOptions {
  componentName?: string;
  strictMode?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  trackingEnabled?: boolean;
  alertThresholds?: {
    timers?: number;
    asyncOps?: number;
    networkRequests?: number;
    eventListeners?: number;
  };
}

interface ResourceSnapshot {
  timestamp: number;
  componentName: string;
  resources: {
    timers: number;
    asyncOperations: number;
    networkRequests: number;
    eventListeners: number;
    domElements: number;
  };
  memoryUsage?: {
    usedMB: number;
    totalMB: number;
  };
}

class CleanupValidator {
  private static instance: CleanupValidator;
  private snapshots = new Map<string, ResourceSnapshot>();
  private componentMountCounts = new Map<string, number>();
  private globalResourceCount = new Map<string, number>();
  private validationResults: Array<{
    componentName: string;
    issues: string[];
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
  }> = [];

  static getInstance(): CleanupValidator {
    if (!CleanupValidator.instance) {
      CleanupValidator.instance = new CleanupValidator();
    }
    return CleanupValidator.instance;
  }

  takeSnapshot(componentName: string): string {
    const snapshotId = `${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      componentName,
      resources: {
        timers: this.countActiveTimers(),
        asyncOperations: this.countAsyncOperations(),
        networkRequests: this.countNetworkRequests(),
        eventListeners: this.countEventListeners(),
        domElements: document.querySelectorAll('*').length,
      },
    };

    // Add memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.memoryUsage = {
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      };
    }

    this.snapshots.set(snapshotId, snapshot);
    
    // Track component mount count
    const currentCount = this.componentMountCounts.get(componentName) || 0;
    this.componentMountCounts.set(componentName, currentCount + 1);

    return snapshotId;
  }

  validateCleanup(snapshotId: string, options: CleanupValidationOptions = {}): boolean {
    const beforeSnapshot = this.snapshots.get(snapshotId);
    if (!beforeSnapshot) {
      logError(`[CleanupValidator] Snapshot ${snapshotId} not found`, "Error");
      return false;
    }

    const afterSnapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      componentName: beforeSnapshot.componentName,
      resources: {
        timers: this.countActiveTimers(),
        asyncOperations: this.countAsyncOperations(),
        networkRequests: this.countNetworkRequests(),
        eventListeners: this.countEventListeners(),
        domElements: document.querySelectorAll('*').length,
      },
    };

    // Add memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      afterSnapshot.memoryUsage = {
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      };
    }

    const issues = this.analyzeResourceLeaks(beforeSnapshot, afterSnapshot, options);
    
    if (issues.length > 0) {
      const severity = this.determineSeverity(issues, options);
      
      this.validationResults.push({
        componentName: beforeSnapshot.componentName,
        issues,
        severity,
        timestamp: Date.now(),
      });

      this.reportIssues(beforeSnapshot.componentName, issues, severity, options);
    }

    // Clean up snapshot
    this.snapshots.delete(snapshotId);

    return issues.length === 0;
  }

  private countActiveTimers(): number {
    // This would integrate with our useTimers hook in a real implementation
    // For now, we'll use a rough estimation
    return (window as any).__activeTimersCount || 0;
  }

  private countAsyncOperations(): number {
    // This would integrate with our useAsyncOperations hook
    return (window as any).__activeAsyncOperationsCount || 0;
  }

  private countNetworkRequests(): number {
    // This would integrate with our useNetworkRequests hook
    return (window as any).__activeNetworkRequestsCount || 0;
  }

  private countEventListeners(): number {
    // This would integrate with our useEventListener hook
    return (window as any).__activeEventListenersCount || 0;
  }

  private analyzeResourceLeaks(
    before: ResourceSnapshot,
    after: ResourceSnapshot,
    options: CleanupValidationOptions
  ): string[] {
    const issues: string[] = [];
    const thresholds = options.alertThresholds || {
      timers: 2,
      asyncOps: 3,
      networkRequests: 2,
      eventListeners: 3,
    };

    // Check for timer leaks
    const timerIncrease = after.resources.timers - before.resources.timers;
    if (timerIncrease > (thresholds.timers || 2)) {
      issues.push(`Timer leak detected: ${timerIncrease} additional timers after unmount`);
    }

    // Check for async operation leaks
    const asyncIncrease = after.resources.asyncOperations - before.resources.asyncOperations;
    if (asyncIncrease > (thresholds.asyncOps || 3)) {
      issues.push(`Async operation leak detected: ${asyncIncrease} operations not cleaned up`);
    }

    // Check for network request leaks
    const networkIncrease = after.resources.networkRequests - before.resources.networkRequests;
    if (networkIncrease > (thresholds.networkRequests || 2)) {
      issues.push(`Network request leak detected: ${networkIncrease} requests not cancelled`);
    }

    // Check for event listener leaks
    const listenerIncrease = after.resources.eventListeners - before.resources.eventListeners;
    if (listenerIncrease > (thresholds.eventListeners || 3)) {
      issues.push(`Event listener leak detected: ${listenerIncrease} listeners not removed`);
    }

    // Check for significant memory increase
    if (before.memoryUsage && after.memoryUsage) {
      const memoryIncrease = after.memoryUsage.usedMB - before.memoryUsage.usedMB;
      if (memoryIncrease > 10) { // 10MB threshold
        issues.push(`Significant memory increase: ${memoryIncrease}MB after component unmount`);
      }
    }

    // Check for DOM element leaks
    const domIncrease = after.resources.domElements - before.resources.domElements;
    if (domIncrease > 50) { // Threshold for DOM elements
      issues.push(`Potential DOM leak: ${domIncrease} additional elements after unmount`);
    }

    return issues;
  }

  private determineSeverity(issues: string[], options: CleanupValidationOptions): 'low' | 'medium' | 'high' {
    if (issues.some(issue => issue.includes('memory increase') || issue.includes('DOM leak'))) {
      return 'high';
    }
    if (issues.length > 2) {
      return 'medium';
    }
    return 'low';
  }

  private reportIssues(
    componentName: string,
    issues: string[],
    severity: 'low' | 'medium' | 'high',
    options: CleanupValidationOptions
  ): void {
    const logLevel = options.logLevel || 'warn';
    const logMethod = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';

    if (options.strictMode && severity === 'high') {
      throw new Error(`[CleanupValidator] Critical memory leak in ${componentName}: ${issues.join(', ')}`);
    }

    console[logMethod](`[CleanupValidator] ${componentName} - ${severity.toUpperCase()} SEVERITY`);
    issues.forEach(issue => console[logMethod](`  • ${issue}`));

    // Track in global stats
    const key = `${componentName}_${severity}`;
    const current = this.globalResourceCount.get(key) || 0;
    this.globalResourceCount.set(key, current + 1);
  }

  getValidationReport(): {
    totalValidations: number;
    issuesByComponent: Record<string, number>;
    issuesBySeverity: Record<string, number>;
    recentIssues: Array<any>;
    componentMountCounts: Record<string, number>;
  } {
    const issuesByComponent: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = { low: 0, medium: 0, high: 0 };

    this.validationResults.forEach(result => {
      issuesByComponent[result.componentName] = (issuesByComponent[result.componentName] || 0) + 1;
      issuesBySeverity[result.severity]++;
    });

    return {
      totalValidations: this.validationResults.length,
      issuesByComponent,
      issuesBySeverity,
      recentIssues: this.validationResults.slice(-10), // Last 10 issues
      componentMountCounts: Object.fromEntries(this.componentMountCounts),
    };
  }

  clearValidationHistory(): void {
    this.validationResults.length = 0;
    this.componentMountCounts.clear();
    this.globalResourceCount.clear();
  }
}

// Hook for automatic cleanup validation
export const useCleanupValidation = (options: CleanupValidationOptions = {}) => {
  const snapshotIdRef = useRef<string | null>(null);
  const validator = CleanupValidator.getInstance();

  useEffect(() => {
    if (!__DEV__ || !options.trackingEnabled) return;

    // Take snapshot on mount
    const componentName = options.componentName || 'UnknownComponent';
    snapshotIdRef.current = validator.takeSnapshot(componentName);

    // Validate cleanup on unmount
    return () => {
      if (snapshotIdRef.current) {
        // Small delay to allow cleanup to complete
        setTimeout(() => {
          if (snapshotIdRef.current) {
            validator.validateCleanup(snapshotIdRef.current, options);
            snapshotIdRef.current = null;
          }
        }, 100);
      }
    };
  }, [options.componentName, options.trackingEnabled]);

  const manualValidation = useCallback(() => {
    if (!snapshotIdRef.current) {
      logWarn('[CleanupValidator] No snapshot available for manual validation', "Warning");
      return false;
    }
    return validator.validateCleanup(snapshotIdRef.current, options);
  }, [options]);

  const getReport = useCallback(() => {
    return validator.getValidationReport();
  }, []);

  const clearHistory = useCallback(() => {
    validator.clearValidationHistory();
  }, []);

  return {
    manualValidation,
    getReport,
    clearHistory,
    isTracking: !!snapshotIdRef.current,
  };
};

// Hook for stress testing component mounting/unmounting
export const useComponentStressTesting = () => {
  const mountCountRef = useRef(0);
  const unmountCountRef = useRef(0);
  const validator = CleanupValidator.getInstance();

  const stressTestComponent = useCallback(async (
    ComponentToTest: React.ComponentType<any>,
    props: any = {},
    iterations: number = 100,
    delayBetweenIterations: number = 50
  ) => {
    if (!__DEV__) {
      logWarn('[CleanupValidator] Stress testing only available in development', "Warning");
      return;
    }

    logDebug(`[CleanupValidator] Starting stress test: ${iterations} iterations`, "Debug");
    const startTime = Date.now();
    const initialReport = validator.getValidationReport();

    for (let i = 0; i < iterations; i++) {
      // This would need to be implemented with a testing framework
      // For now, we'll just simulate the concept
      mountCountRef.current++;
      
      // Simulate component lifecycle
      await new Promise(resolve => setTimeout(resolve, delayBetweenIterations));
      
      unmountCountRef.current++;
    }

    const endTime = Date.now();
    const finalReport = validator.getValidationReport();

    const testResults = {
      iterations,
      duration: endTime - startTime,
      mountCount: mountCountRef.current,
      unmountCount: unmountCountRef.current,
      newIssues: finalReport.totalValidations - initialReport.totalValidations,
      performanceImpact: {
        averageIterationTime: (endTime - startTime) / iterations,
      }
    };

    logDebug('[CleanupValidator] Stress test completed:', "Debug", testResults);
    return testResults;
  }, []);

  return {
    stressTestComponent,
    mountCount: mountCountRef.current,
    unmountCount: unmountCountRef.current,
  };
};

// Global cleanup validation setup
export const setupGlobalCleanupValidation = (options: CleanupValidationOptions = {}) => {
  if (!__DEV__) return;

  const validator = CleanupValidator.getInstance();

  // Set up global counters that our hooks will update
  (window as any).__activeTimersCount = 0;
  (window as any).__activeAsyncOperationsCount = 0;
  (window as any).__activeNetworkRequestsCount = 0;
  (window as any).__activeEventListenersCount = 0;

  // Set up periodic reporting
  const reportInterval = setInterval(() => {
    const report = validator.getValidationReport();
    
    if (report.totalValidations > 0 && report.issuesBySeverity.high > 0) {
      logError('[CleanupValidator] High severity memory leaks detected!', "Error", report);
    } else if (report.issuesBySeverity.medium > 5) {
      logWarn('[CleanupValidator] Multiple medium severity issues detected', "Warning", report);
    }
  }, 30000); // Every 30 seconds

  // Global cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(reportInterval);
    const finalReport = validator.getValidationReport();
    logDebug('[CleanupValidator] Final validation report:', "Debug", finalReport);
  });

  return {
    getReport: () => validator.getValidationReport(),
    clearHistory: () => validator.clearValidationHistory(),
  };
};

// Development-only component wrapper for automatic validation
export const withCleanupValidation = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  validationOptions: CleanupValidationOptions = {}
) => {
  if (!__DEV__) {
    return WrappedComponent;
  }

  const ValidatedComponent = (props: P) => {
    const componentName = validationOptions.componentName || WrappedComponent.displayName || WrappedComponent.name || 'Anonymous';
    
    const { getReport } = useCleanupValidation({
      ...validationOptions,
      componentName,
      trackingEnabled: true,
    });

    // Add debug methods to component (development only)
    useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__cleanupValidator = {
          getReport,
          component: componentName,
        };
      }
    }, [getReport, componentName]);

    return React.createElement(WrappedComponent, props);
  };

  ValidatedComponent.displayName = `withCleanupValidation(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ValidatedComponent;
};
