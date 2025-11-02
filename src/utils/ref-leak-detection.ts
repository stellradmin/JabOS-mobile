// @ts-nocheck
// Ref leak detection utilities for development environments
// Detects and reports ref-related memory leaks and improper cleanup

import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface RefLeakReport {
  timestamp: number;
  componentName?: string;
  leakType: 'stale-ref' | 'detached-dom' | 'circular-ref' | 'retained-element' | 'animation-ref';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  elementInfo?: {
    tagName?: string;
    id?: string;
    className?: string;
    parentExists?: boolean;
    isInDocument?: boolean;
  };
  recommendations: string[];
}

interface RefMemorySnapshot {
  timestamp: number;
  totalRefs: number;
  refsByType: Record<string, number>;
  domNodes: number;
  detachedNodes: number;
  memoryUsage?: {
    usedMB: number;
    totalMB: number;
  };
}

class RefLeakDetector {
  private static instance: RefLeakDetector;
  private snapshots: RefMemorySnapshot[] = [];
  private leakReports: RefLeakReport[] = [];
  private monitoringActive = false;
  private monitorInterval?: NodeJS.Timeout;
  private mutationObserver?: MutationObserver;
  private weakRefRegistry = new WeakMap();

  static getInstance(): RefLeakDetector {
    if (!RefLeakDetector.instance) {
      RefLeakDetector.instance = new RefLeakDetector();
    }
    return RefLeakDetector.instance;
  }

  startMonitoring(options: {
    interval?: number;
    trackDOMChanges?: boolean;
    trackMemoryUsage?: boolean;
  } = {}): void {
    if (this.monitoringActive || !__DEV__) return;

    const { interval = 30000, trackDOMChanges = true, trackMemoryUsage = true } = options;

    this.monitoringActive = true;

    // Periodic snapshots
    this.monitorInterval = setInterval(() => {
      this.takeSnapshot(trackMemoryUsage);
      this.analyzeForLeaks();
    }, interval);

    // DOM mutation tracking (web only)
    if (trackDOMChanges && Platform.OS === 'web' && typeof MutationObserver !== 'undefined') {
      this.setupDOMMutationTracking();
    }

    logDebug('[RefLeakDetector] Monitoring started', "Debug");
  }

  stopMonitoring(): void {
    if (!this.monitoringActive) return;

    this.monitoringActive = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }

    logDebug('[RefLeakDetector] Monitoring stopped', "Debug");
  }

  private takeSnapshot(trackMemoryUsage: boolean = true): RefMemorySnapshot {
    const snapshot: RefMemorySnapshot = {
      timestamp: Date.now(),
      totalRefs: this.getTotalRefCount(),
      refsByType: this.getRefCountByType(),
      domNodes: Platform.OS === 'web' ? document.querySelectorAll('*').length : 0,
      detachedNodes: Platform.OS === 'web' ? this.countDetachedNodes() : 0,
    };

    // Add memory usage if available
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

  private getTotalRefCount(): number {
    // This would integrate with our useRefs hook
    return (window as any).__totalRefCount || 0;
  }

  private getRefCountByType(): Record<string, number> {
    // This would integrate with our useRefs hook
    return (window as any).__refCountByType || {};
  }

  private countDetachedNodes(): number {
    if (Platform.OS !== 'web') return 0;

    let detachedCount = 0;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node: Element | null;
    while (node = walker.nextNode() as Element) {
      // Check if node is detached (not in document but still referenced)
      if (!document.contains(node) && node.parentNode === null) {
        detachedCount++;
      }
    }

    return detachedCount;
  }

  private setupDOMMutationTracking(): void {
    if (Platform.OS !== 'web' || typeof MutationObserver === 'undefined') return;

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Track removed nodes that might still be referenced
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.trackRemovedElement(node as Element);
          }
        });
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private trackRemovedElement(element: Element): void {
    // Use WeakRef to track if element is still referenced after removal
    const weakRef = new WeakRef(element);
    
    // Check after a delay if element is still referenced
    setTimeout(() => {
      const stillExists = weakRef.deref();
      if (stillExists && !document.contains(stillExists)) {
        this.reportLeak({
          timestamp: Date.now(),
          leakType: 'detached-dom',
          severity: 'medium',
          description: `DOM element removed but still referenced: ${stillExists.tagName}`,
          elementInfo: {
            tagName: stillExists.tagName,
            id: stillExists.id || undefined,
            className: stillExists.className || undefined,
            isInDocument: false,
            parentExists: !!stillExists.parentNode,
          },
          recommendations: [
            'Ensure refs to this element are nulled when component unmounts',
            'Check for event listeners that might keep the element alive',
            'Verify cleanup in useEffect hooks',
          ],
        });
      }
    }, 5000); // Check after 5 seconds
  }

  private analyzeForLeaks(): void {
    if (this.snapshots.length < 2) return;

    const current = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    // Check for concerning increases
    this.checkRefCountIncrease(previous, current);
    this.checkMemoryIncrease(previous, current);
    this.checkDetachedNodeIncrease(previous, current);
  }

  private checkRefCountIncrease(previous: RefMemorySnapshot, current: RefMemorySnapshot): void {
    const refIncrease = current.totalRefs - previous.totalRefs;
    
    if (refIncrease > 10) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'stale-ref',
        severity: refIncrease > 25 ? 'high' : 'medium',
        description: `Significant ref count increase: +${refIncrease} refs in ${current.timestamp - previous.timestamp}ms`,
        recommendations: [
          'Check components for missing cleanup in useEffect',
          'Verify ref nulling on unmount',
          'Look for circular references between components',
        ],
      });
    }
  }

  private checkMemoryIncrease(previous: RefMemorySnapshot, current: RefMemorySnapshot): void {
    if (!previous.memoryUsage || !current.memoryUsage) return;

    const memoryIncrease = current.memoryUsage.usedMB - previous.memoryUsage.usedMB;
    
    if (memoryIncrease > 20) { // 20MB increase
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'retained-element',
        severity: memoryIncrease > 50 ? 'critical' : 'high',
        description: `Significant memory increase: +${memoryIncrease}MB, possibly due to retained refs`,
        recommendations: [
          'Force garbage collection and check if memory is released',
          'Audit large object references in components',
          'Check for retained closures with large objects',
        ],
      });
    }
  }

  private checkDetachedNodeIncrease(previous: RefMemorySnapshot, current: RefMemorySnapshot): void {
    const detachedIncrease = current.detachedNodes - previous.detachedNodes;
    
    if (detachedIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'detached-dom',
        severity: detachedIncrease > 15 ? 'high' : 'medium',
        description: `Detached DOM nodes increased by ${detachedIncrease}`,
        recommendations: [
          'Check for refs to removed DOM elements',
          'Ensure event listeners are removed from deleted elements',
          'Verify cleanup of third-party library references',
        ],
      });
    }
  }

  private reportLeak(leak: RefLeakReport): void {
    this.leakReports.push(leak);

    // Keep only last 100 reports
    if (this.leakReports.length > 100) {
      this.leakReports = this.leakReports.slice(-100);
    }

    // Console output based on severity
    const logMethod = leak.severity === 'critical' ? 'error' : 
                     leak.severity === 'high' ? 'error' :
                     leak.severity === 'medium' ? 'warn' : 'log';

    console[logMethod](`[RefLeakDetector] ${leak.severity.toUpperCase()}: ${leak.description}`);
    
    if (leak.elementInfo) {
      console[logMethod]('Element info:', leak.elementInfo);
    }
    
    console[logMethod]('Recommendations:', leak.recommendations);
  }

  // Manual leak detection methods
  detectStaleRefs(refMap: Map<string, any>): RefLeakReport[] {
    const leaks: RefLeakReport[] = [];

    refMap.forEach((ref, id) => {
      if (ref.current && Platform.OS === 'web') {
        // Check if DOM element is detached
        if (ref.current instanceof Element && !document.contains(ref.current)) {
          leaks.push({
            timestamp: Date.now(),
            leakType: 'detached-dom',
            severity: 'medium',
            description: `Ref ${id} points to detached DOM element`,
            elementInfo: {
              tagName: ref.current.tagName,
              id: ref.current.id || undefined,
              className: ref.current.className || undefined,
              isInDocument: false,
            },
            recommendations: [
              'Null this ref when component unmounts',
              'Check if cleanup is happening in the correct lifecycle',
            ],
          });
        }
      }
    });

    return leaks;
  }

  detectCircularRefs(objectToCheck: any, path: string[] = [], visited = new WeakSet()): RefLeakReport[] {
    const leaks: RefLeakReport[] = [];

    if (!objectToCheck || typeof objectToCheck !== 'object') return leaks;
    if (visited.has(objectToCheck)) {
      leaks.push({
        timestamp: Date.now(),
        leakType: 'circular-ref',
        severity: 'high',
        description: `Circular reference detected at path: ${path.join('.')}`,
        recommendations: [
          'Break the circular reference by nulling one of the refs',
          'Use WeakRef or WeakMap for parent-child relationships',
          'Implement proper cleanup in component unmount',
        ],
      });
      return leaks;
    }

    visited.add(objectToCheck);

    try {
      Object.keys(objectToCheck).forEach(key => {
        if (key.includes('ref') || key.includes('Ref')) {
          const newPath = [...path, key];
          leaks.push(...this.detectCircularRefs(objectToCheck[key], newPath, visited));
        }
      });
    } catch (error) {
      // Handle cases where object properties can't be enumerated
    }

    visited.delete(objectToCheck);
    return leaks;
  }

  // Report generation
  generateLeakReport(): {
    summary: {
      totalLeaks: number;
      leaksBySeverity: Record<string, number>;
      leaksByType: Record<string, number>;
      recentLeaks: RefLeakReport[];
    };
    snapshots: RefMemorySnapshot[];
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

    const recommendations = this.generateRecommendations();

    return {
      summary: {
        totalLeaks: this.leakReports.length,
        leaksBySeverity,
        leaksByType,
        recentLeaks: this.leakReports.slice(-10),
      },
      snapshots: this.snapshots.slice(-10),
      recommendations,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const criticalLeaks = this.leakReports.filter(l => l.severity === 'critical').length;
    const highLeaks = this.leakReports.filter(l => l.severity === 'high').length;
    const detachedDOMLeaks = this.leakReports.filter(l => l.leakType === 'detached-dom').length;
    const circularRefLeaks = this.leakReports.filter(l => l.leakType === 'circular-ref').length;

    if (criticalLeaks > 0) {
      recommendations.push('URGENT: Critical memory leaks detected - investigate immediately');
    }

    if (highLeaks > 5) {
      recommendations.push('Multiple high-severity leaks detected - review ref cleanup patterns');
    }

    if (detachedDOMLeaks > 3) {
      recommendations.push('Consider implementing automatic ref nulling on component unmount');
    }

    if (circularRefLeaks > 0) {
      recommendations.push('Use WeakRef or WeakMap to prevent circular reference memory leaks');
    }

    if (this.snapshots.length > 5) {
      const recent = this.snapshots.slice(-5);
      const memoryTrend = recent.map(s => s.memoryUsage?.usedMB || 0);
      const isIncreasing = memoryTrend.every((val, i) => i === 0 || val >= memoryTrend[i - 1]);
      
      if (isIncreasing) {
        recommendations.push('Memory usage consistently increasing - audit for memory leaks');
      }
    }

    return recommendations;
  }

  clearHistory(): void {
    this.snapshots = [];
    this.leakReports = [];
  }
}

// Hook for automatic ref leak detection
export const useRefLeakDetection = (options: {
  enabled?: boolean;
  interval?: number;
  trackDOMChanges?: boolean;
  componentName?: string;
} = {}) => {
  const { enabled = __DEV__, interval = 30000, trackDOMChanges = true, componentName } = options;

  const detector = RefLeakDetector.getInstance();

  // Start monitoring when enabled
  useEffect(() => {
    if (enabled) {
      detector.startMonitoring({ interval, trackDOMChanges });
    }

    return () => {
      if (enabled) {
        detector.stopMonitoring();
      }
    };
  }, [enabled, interval, trackDOMChanges]);

  const manualDetection = useCallback((refMap: Map<string, any>) => {
    return detector.detectStaleRefs(refMap);
  }, []);

  const generateReport = useCallback(() => {
    return detector.generateLeakReport();
  }, []);

  const clearHistory = useCallback(() => {
    detector.clearHistory();
  }, []);

  return {
    manualDetection,
    generateReport,
    clearHistory,
    isMonitoring: detector['monitoringActive'],
  };
};

// Global setup function
export const setupGlobalRefLeakDetection = (options: {
  autoStart?: boolean;
  interval?: number;
  trackDOMChanges?: boolean;
  reportToConsole?: boolean;
} = {}) => {
  if (!__DEV__) return;

  const { autoStart = true, interval = 30000, trackDOMChanges = true, reportToConsole = true } = options;
  const detector = RefLeakDetector.getInstance();

  if (autoStart) {
    detector.startMonitoring({ interval, trackDOMChanges });
  }

  // Global report function
  (window as any).__refLeakDetector = {
    generateReport: () => detector.generateLeakReport(),
    clearHistory: () => detector.clearHistory(),
    startMonitoring: (opts?: any) => detector.startMonitoring(opts),
    stopMonitoring: () => detector.stopMonitoring(),
  };

  // Periodic console reports
  if (reportToConsole) {
    setInterval(() => {
      const report = detector.generateLeakReport();
      
      if (report.summary.totalLeaks > 0) {
        console.group('[RefLeakDetector] Periodic Report');
        logDebug('Total leaks:', "Debug", report.summary.totalLeaks);
        logDebug('By severity:', "Debug", report.summary.leaksBySeverity);
        logDebug('By type:', "Debug", report.summary.leaksByType);
        logDebug('Recommendations:', "Debug", report.recommendations);
        console.groupEnd();
      }
    }, 60000); // Every minute
  }

  logDebug('[RefLeakDetector] Global detection enabled', "Debug");
};

export default RefLeakDetector;
