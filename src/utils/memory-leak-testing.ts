// @ts-nocheck
// Comprehensive memory leak testing utilities for development environments
// Automated testing tools that detect various types of memory leaks
// Development-only testing utilities with zero production impact

import React from 'react';
import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface MemoryLeakTestResult {
  testName: string;
  testType: 'timer-leak' | 'ref-leak' | 'animation-leak' | 'subscription-leak' | 'event-listener-leak' | 'memory-growth' | 'component-leak';
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  leaksDetected: number;
  details: {
    description: string;
    leakType?: string;
    resourcesFound?: number;
    expectedMax?: number;
    actualCount?: number;
    recommendations: string[];
  };
  duration: number;
  timestamp: number;
}

interface MemoryTestSuite {
  suiteName: string;
  tests: MemoryLeakTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalLeaksDetected: number;
  duration: number;
  summary: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
}

interface ComponentMemorySnapshot {
  componentName: string;
  timestamp: number;
  timers: {
    active: number;
    pending: number;
    byType: Record<string, number>;
  };
  refs: {
    total: number;
    attached: number;
    detached: number;
  };
  animations: {
    activeSharedValues: number;
    activeGestures: number;
    runningAnimations: number;
  };
  subscriptions: {
    contexts: number;
    supabase: number;
    websockets: number;
    eventListeners: number;
  };
  memoryUsage?: {
    jsHeapUsed: number;
    jsHeapTotal: number;
    jsHeapLimit: number;
  };
}

class MemoryLeakTester {
  private static instance: MemoryLeakTester;
  private testSuites: MemoryTestSuite[] = [];
  private snapshots: ComponentMemorySnapshot[] = [];
  private isRunning = false;
  private currentTestSuite?: MemoryTestSuite;

  static getInstance(): MemoryLeakTester {
    if (!MemoryLeakTester.instance) {
      MemoryLeakTester.instance = new MemoryLeakTester();
    }
    return MemoryLeakTester.instance;
  }

  // Start a new test suite
  startTestSuite(suiteName: string): void {
    if (!__DEV__) return;

    this.currentTestSuite = {
      suiteName,
      tests: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalLeaksDetected: 0,
      duration: 0,
      summary: {
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
      },
    };

    this.isRunning = true;
    logDebug(`[MemoryLeakTester] Starting test suite: ${suiteName}`, "Debug");
  }

  // End current test suite
  endTestSuite(): MemoryTestSuite | null {
    if (!this.currentTestSuite || !this.isRunning) return null;

    this.currentTestSuite.duration = Date.now() - (this.currentTestSuite.tests[0]?.timestamp || Date.now());
    this.testSuites.push(this.currentTestSuite);
    this.isRunning = false;

    logDebug(`[MemoryLeakTester] Completed test suite: ${this.currentTestSuite.suiteName}`, "Debug");
    logDebug(`Tests: ${this.currentTestSuite.passedTests}/${this.currentTestSuite.totalTests} passed`, "Debug");
    
    if (this.currentTestSuite.totalLeaksDetected > 0) {
      logWarn(`⚠️  ${this.currentTestSuite.totalLeaksDetected} memory leaks detected!`, "Warning");
    }

    const suite = this.currentTestSuite;
    this.currentTestSuite = undefined;
    return suite;
  }

  // Test for timer memory leaks
  async testTimerLeaks(componentName: string, expectedMaxTimers = 5): Promise<MemoryLeakTestResult> {
    const startTime = Date.now();
    
    // Access timer tracking from our useTimers hook
    const timerTracker = (global as any).__timerTracker;
    const activeTimers = timerTracker?.getActiveTimers() || { count: 0, timers: [] };
    
    const leaksDetected = Math.max(0, activeTimers.count - expectedMaxTimers);
    const passed = leaksDetected === 0;

    const result: MemoryLeakTestResult = {
      testName: `Timer Leak Test - ${componentName}`,
      testType: 'timer-leak',
      passed,
      severity: leaksDetected > 10 ? 'critical' : leaksDetected > 5 ? 'high' : leaksDetected > 2 ? 'medium' : 'low',
      leaksDetected,
      details: {
        description: `Detected ${activeTimers.count} active timers (expected max: ${expectedMaxTimers})`,
        resourcesFound: activeTimers.count,
        expectedMax: expectedMaxTimers,
        actualCount: activeTimers.count,
        recommendations: [
          'Ensure all timers are cleared on component unmount',
          'Use useTimers hook for automatic cleanup',
          'Check for timers created in render loops',
          'Review timer lifecycle management',
        ],
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    this.recordTestResult(result);
    return result;
  }

  // Test for ref memory leaks
  async testRefLeaks(componentName: string, expectedMaxRefs = 10): Promise<MemoryLeakTestResult> {
    const startTime = Date.now();
    
    // Access ref tracking from our useRefs hook
    const refTracker = (global as any).__refTracker;
    const activeRefs = refTracker?.getActiveRefs() || { count: 0, attached: 0, detached: 0 };
    
    const detachedRefs = activeRefs.detached || 0;
    const leaksDetected = Math.max(0, detachedRefs);
    const passed = leaksDetected === 0 && activeRefs.count <= expectedMaxRefs;

    const result: MemoryLeakTestResult = {
      testName: `Ref Leak Test - ${componentName}`,
      testType: 'ref-leak',
      passed,
      severity: detachedRefs > 5 ? 'high' : detachedRefs > 2 ? 'medium' : 'low',
      leaksDetected,
      details: {
        description: `Found ${detachedRefs} detached refs out of ${activeRefs.count} total refs`,
        resourcesFound: activeRefs.count,
        expectedMax: expectedMaxRefs,
        actualCount: detachedRefs,
        recommendations: [
          'Clean up detached refs immediately',
          'Use useRefs hook for automatic ref management',
          'Check for refs holding onto unmounted components',
          'Review ref assignment patterns',
        ],
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    this.recordTestResult(result);
    return result;
  }

  // Test for animation memory leaks
  async testAnimationLeaks(componentName: string, expectedMaxAnimations = 3): Promise<MemoryLeakTestResult> {
    const startTime = Date.now();
    
    // Access animation tracking from our animation hooks
    const animationTracker = (global as any).__animationTracker;
    const activeAnimations = animationTracker?.getActiveAnimations() || { 
      sharedValues: 0, 
      gestures: 0, 
      worklets: 0,
      total: 0 
    };
    
    const totalAnimations = activeAnimations.total || 0;
    const leaksDetected = Math.max(0, totalAnimations - expectedMaxAnimations);
    const passed = leaksDetected === 0;

    const result: MemoryLeakTestResult = {
      testName: `Animation Leak Test - ${componentName}`,
      testType: 'animation-leak',
      passed,
      severity: totalAnimations > 15 ? 'critical' : totalAnimations > 8 ? 'high' : totalAnimations > 5 ? 'medium' : 'low',
      leaksDetected,
      details: {
        description: `Found ${totalAnimations} active animations (${activeAnimations.sharedValues} shared values, ${activeAnimations.gestures} gestures)`,
        resourcesFound: totalAnimations,
        expectedMax: expectedMaxAnimations,
        actualCount: totalAnimations,
        recommendations: [
          'Ensure shared values are cleaned up on unmount',
          'Cancel running animations before component unmount',
          'Use useAnimatedValues hook for automatic cleanup',
          'Review gesture handler lifecycle',
        ],
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    this.recordTestResult(result);
    return result;
  }

  // Test for subscription memory leaks
  async testSubscriptionLeaks(componentName: string, expectedMaxSubscriptions = 5): Promise<MemoryLeakTestResult> {
    const startTime = Date.now();
    
    // Access subscription tracking from our subscription hooks
    const subscriptionTracker = (global as any).__subscriptionTracker;
    const activeSubscriptions = subscriptionTracker?.getActiveSubscriptions() || {
      contexts: 0,
      supabase: 0,
      websockets: 0,
      total: 0
    };
    
    const totalSubscriptions = activeSubscriptions.total || 0;
    const leaksDetected = Math.max(0, totalSubscriptions - expectedMaxSubscriptions);
    const passed = leaksDetected === 0;

    const result: MemoryLeakTestResult = {
      testName: `Subscription Leak Test - ${componentName}`,
      testType: 'subscription-leak',
      passed,
      severity: totalSubscriptions > 20 ? 'critical' : totalSubscriptions > 10 ? 'high' : totalSubscriptions > 7 ? 'medium' : 'low',
      leaksDetected,
      details: {
        description: `Found ${totalSubscriptions} active subscriptions (contexts: ${activeSubscriptions.contexts}, supabase: ${activeSubscriptions.supabase}, websockets: ${activeSubscriptions.websockets})`,
        resourcesFound: totalSubscriptions,
        expectedMax: expectedMaxSubscriptions,
        actualCount: totalSubscriptions,
        recommendations: [
          'Ensure all subscriptions are unsubscribed on unmount',
          'Use subscription management hooks for automatic cleanup',
          'Check for duplicate subscriptions',
          'Review subscription lifecycle patterns',
        ],
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    this.recordTestResult(result);
    return result;
  }

  // Test for event listener memory leaks
  async testEventListenerLeaks(componentName: string, expectedMaxListeners = 8): Promise<MemoryLeakTestResult> {
    const startTime = Date.now();
    
    // Access event listener tracking from our useEventListeners hook
    const eventTracker = (global as any).__eventListenerTracker;
    const activeListeners = eventTracker?.getActiveListeners() || {
      total: 0,
      dom: 0,
      reactNative: 0,
      orphaned: 0
    };
    
    const totalListeners = activeListeners.total || 0;
    const orphanedListeners = activeListeners.orphaned || 0;
    const leaksDetected = Math.max(0, totalListeners - expectedMaxListeners) + orphanedListeners;
    const passed = leaksDetected === 0;

    const result: MemoryLeakTestResult = {
      testName: `Event Listener Leak Test - ${componentName}`,
      testType: 'event-listener-leak',
      passed,
      severity: orphanedListeners > 5 || totalListeners > 30 ? 'critical' : 
                orphanedListeners > 2 || totalListeners > 20 ? 'high' : 
                orphanedListeners > 0 || totalListeners > 15 ? 'medium' : 'low',
      leaksDetected,
      details: {
        description: `Found ${totalListeners} active listeners (${orphanedListeners} orphaned)`,
        resourcesFound: totalListeners,
        expectedMax: expectedMaxListeners,
        actualCount: totalListeners,
        recommendations: [
          'Remove orphaned event listeners immediately',
          'Use useEventListeners hook for automatic cleanup',
          'Check for listeners added in render cycles',
          'Review event delegation patterns',
        ],
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    this.recordTestResult(result);
    return result;
  }

  // Test for memory growth patterns
  async testMemoryGrowth(componentName: string, maxGrowthMB = 10): Promise<MemoryLeakTestResult> {
    const startTime = Date.now();
    
    let memoryUsage = { used: 0, total: 0, growth: 0 };
    let passed = true;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check memory usage if available
    if (Platform.OS === 'web' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      
      // Compare with previous snapshots
      const previousSnapshots = this.snapshots.filter(s => s.componentName === componentName);
      if (previousSnapshots.length > 0) {
        const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];
        const lastUsedMB = lastSnapshot.memoryUsage?.jsHeapUsed || 0;
        const growthMB = usedMB - lastUsedMB;
        
        memoryUsage = { used: usedMB, total: totalMB, growth: growthMB };
        passed = growthMB <= maxGrowthMB;
        severity = growthMB > 50 ? 'critical' : growthMB > 25 ? 'high' : growthMB > 15 ? 'medium' : 'low';
      }
    }

    const result: MemoryLeakTestResult = {
      testName: `Memory Growth Test - ${componentName}`,
      testType: 'memory-growth',
      passed,
      severity,
      leaksDetected: Math.max(0, memoryUsage.growth - maxGrowthMB),
      details: {
        description: `Memory usage: ${memoryUsage.used}MB (growth: +${memoryUsage.growth}MB, max allowed: ${maxGrowthMB}MB)`,
        resourcesFound: memoryUsage.used,
        expectedMax: maxGrowthMB,
        actualCount: memoryUsage.growth,
        recommendations: [
          'Monitor memory usage patterns over time',
          'Check for accumulated objects not being garbage collected',
          'Review subscription and timer cleanup',
          'Force garbage collection and retest',
        ],
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    this.recordTestResult(result);
    return result;
  }

  // Run comprehensive component memory leak test
  async runComponentMemoryTest(componentName: string, options: {
    expectedMaxTimers?: number;
    expectedMaxRefs?: number;
    expectedMaxAnimations?: number;
    expectedMaxSubscriptions?: number;
    expectedMaxListeners?: number;
    maxMemoryGrowthMB?: number;
  } = {}): Promise<MemoryLeakTestResult[]> {
    if (!__DEV__) return [];

    logDebug(`[MemoryLeakTester] Running comprehensive memory test for ${componentName}`, "Debug");
    
    const {
      expectedMaxTimers = 5,
      expectedMaxRefs = 10,
      expectedMaxAnimations = 3,
      expectedMaxSubscriptions = 5,
      expectedMaxListeners = 8,
      maxMemoryGrowthMB = 10,
    } = options;

    const results: MemoryLeakTestResult[] = [];

    try {
      // Take a memory snapshot before testing
      this.takeComponentSnapshot(componentName);

      // Run all memory leak tests
      results.push(await this.testTimerLeaks(componentName, expectedMaxTimers));
      results.push(await this.testRefLeaks(componentName, expectedMaxRefs));
      results.push(await this.testAnimationLeaks(componentName, expectedMaxAnimations));
      results.push(await this.testSubscriptionLeaks(componentName, expectedMaxSubscriptions));
      results.push(await this.testEventListenerLeaks(componentName, expectedMaxListeners));
      results.push(await this.testMemoryGrowth(componentName, maxMemoryGrowthMB));

      // Take another snapshot after testing
      this.takeComponentSnapshot(componentName);

      const failedTests = results.filter(r => !r.passed);
      const totalLeaks = results.reduce((sum, r) => sum + r.leaksDetected, 0);

      if (failedTests.length > 0) {
        logWarn(`⚠️  ${componentName}: ${failedTests.length} tests failed, "Warning", ${totalLeaks} leaks detected`);
        failedTests.forEach(test => {
          logWarn(`   ${test.testName}: ${test.details.description}`, "Warning");
        });
      } else {
        logDebug(`✅ ${componentName}: All memory leak tests passed`, "Debug");
      }

    } catch (error) {
      logError(`Error running memory tests for ${componentName}:`, "Error", error);
    }

    return results;
  }

  // Take a memory snapshot for a component
  takeComponentSnapshot(componentName: string): ComponentMemorySnapshot {
    const snapshot: ComponentMemorySnapshot = {
      componentName,
      timestamp: Date.now(),
      timers: this.getTimerSnapshot(),
      refs: this.getRefSnapshot(),
      animations: this.getAnimationSnapshot(),
      subscriptions: this.getSubscriptionSnapshot(),
    };

    // Add memory usage if available
    if (Platform.OS === 'web' && 'memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.memoryUsage = {
        jsHeapUsed: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        jsHeapTotal: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        jsHeapLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }

    this.snapshots.push(snapshot);

    // Keep only last 20 snapshots per component
    const componentSnapshots = this.snapshots.filter(s => s.componentName === componentName);
    if (componentSnapshots.length > 20) {
      this.snapshots = this.snapshots.filter(s => 
        s.componentName !== componentName || 
        componentSnapshots.slice(-20).includes(s)
      );
    }

    return snapshot;
  }

  private getTimerSnapshot() {
    const timerTracker = (global as any).__timerTracker;
    const timers = timerTracker?.getActiveTimers() || { count: 0, timers: [], byType: {} };
    return {
      active: timers.count,
      pending: timers.timers?.filter((t: any) => t.isPending).length || 0,
      byType: timers.byType || {},
    };
  }

  private getRefSnapshot() {
    const refTracker = (global as any).__refTracker;
    const refs = refTracker?.getActiveRefs() || { count: 0, attached: 0, detached: 0 };
    return {
      total: refs.count,
      attached: refs.attached,
      detached: refs.detached,
    };
  }

  private getAnimationSnapshot() {
    const animationTracker = (global as any).__animationTracker;
    const animations = animationTracker?.getActiveAnimations() || { 
      sharedValues: 0, gestures: 0, worklets: 0 
    };
    return {
      activeSharedValues: animations.sharedValues,
      activeGestures: animations.gestures,
      runningAnimations: animations.worklets,
    };
  }

  private getSubscriptionSnapshot() {
    const subscriptionTracker = (global as any).__subscriptionTracker;
    const eventTracker = (global as any).__eventListenerTracker;
    
    const subscriptions = subscriptionTracker?.getActiveSubscriptions() || {
      contexts: 0, supabase: 0, websockets: 0
    };
    const listeners = eventTracker?.getActiveListeners() || { total: 0 };
    
    return {
      contexts: subscriptions.contexts,
      supabase: subscriptions.supabase,
      websockets: subscriptions.websockets,
      eventListeners: listeners.total,
    };
  }

  private recordTestResult(result: MemoryLeakTestResult): void {
    if (!this.currentTestSuite) return;

    this.currentTestSuite.tests.push(result);
    this.currentTestSuite.totalTests++;
    
    if (result.passed) {
      this.currentTestSuite.passedTests++;
    } else {
      this.currentTestSuite.failedTests++;
      this.currentTestSuite.totalLeaksDetected += result.leaksDetected;
      
      // Update severity summary
      switch (result.severity) {
        case 'critical':
          this.currentTestSuite.summary.criticalIssues++;
          break;
        case 'high':
          this.currentTestSuite.summary.highIssues++;
          break;
        case 'medium':
          this.currentTestSuite.summary.mediumIssues++;
          break;
        case 'low':
          this.currentTestSuite.summary.lowIssues++;
          break;
      }
    }
  }

  // Generate test report
  generateTestReport(): {
    suites: MemoryTestSuite[];
    summary: {
      totalSuites: number;
      totalTests: number;
      passedTests: number;
      failedTests: number;
      totalLeaksDetected: number;
      averageTestDuration: number;
    };
    recommendations: string[];
  } {
    const summary = this.testSuites.reduce(
      (acc, suite) => ({
        totalSuites: acc.totalSuites + 1,
        totalTests: acc.totalTests + suite.totalTests,
        passedTests: acc.passedTests + suite.passedTests,
        failedTests: acc.failedTests + suite.failedTests,
        totalLeaksDetected: acc.totalLeaksDetected + suite.totalLeaksDetected,
        averageTestDuration: acc.averageTestDuration + suite.duration,
      }),
      {
        totalSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalLeaksDetected: 0,
        averageTestDuration: 0,
      }
    );

    if (summary.totalSuites > 0) {
      summary.averageTestDuration = Math.round(summary.averageTestDuration / summary.totalSuites);
    }

    const recommendations = this.generateRecommendations();

    return {
      suites: this.testSuites,
      summary,
      recommendations,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const allTests = this.testSuites.flatMap(suite => suite.tests);
    
    const failedTimerTests = allTests.filter(t => t.testType === 'timer-leak' && !t.passed).length;
    const failedRefTests = allTests.filter(t => t.testType === 'ref-leak' && !t.passed).length;
    const failedAnimationTests = allTests.filter(t => t.testType === 'animation-leak' && !t.passed).length;
    const failedSubscriptionTests = allTests.filter(t => t.testType === 'subscription-leak' && !t.passed).length;
    const failedListenerTests = allTests.filter(t => t.testType === 'event-listener-leak' && !t.passed).length;
    const failedMemoryTests = allTests.filter(t => t.testType === 'memory-growth' && !t.passed).length;

    if (failedTimerTests > 0) {
      recommendations.push('Multiple timer leaks detected - implement automatic timer cleanup in useTimers hook');
    }
    
    if (failedRefTests > 0) {
      recommendations.push('Ref memory leaks found - review ref lifecycle and cleanup patterns');
    }
    
    if (failedAnimationTests > 0) {
      recommendations.push('Animation leaks detected - ensure shared values and gestures are properly cleaned up');
    }
    
    if (failedSubscriptionTests > 0) {
      recommendations.push('Subscription leaks found - implement automatic unsubscription on component unmount');
    }
    
    if (failedListenerTests > 0) {
      recommendations.push('Event listener leaks detected - use event listener management hooks for cleanup');
    }
    
    if (failedMemoryTests > 0) {
      recommendations.push('Memory growth detected - monitor object retention and garbage collection patterns');
    }

    const criticalTests = allTests.filter(t => t.severity === 'critical' && !t.passed).length;
    if (criticalTests > 0) {
      recommendations.unshift('CRITICAL: Severe memory leaks detected - immediate investigation required');
    }

    return recommendations;
  }

  // Clear all test data
  clearTestHistory(): void {
    this.testSuites = [];
    this.snapshots = [];
    this.currentTestSuite = undefined;
    this.isRunning = false;
  }
}

// React hook for automated component memory testing
export const useMemoryLeakTesting = (
  componentName: string,
  options: {
    enabled?: boolean;
    testOnMount?: boolean;
    testOnUnmount?: boolean;
    expectedLimits?: {
      timers?: number;
      refs?: number;
      animations?: number;
      subscriptions?: number;
      listeners?: number;
      memoryGrowthMB?: number;
    };
  } = {}
) => {
  const { enabled = __DEV__, testOnMount = true, testOnUnmount = true, expectedLimits = {} } = options;
  
  const tester = MemoryLeakTester.getInstance();

  // Test on mount
  React.useEffect(() => {
    if (enabled && testOnMount) {
      setTimeout(() => {
        tester.runComponentMemoryTest(componentName, expectedLimits);
      }, 100); // Small delay to let component initialize
    }
  }, [enabled, testOnMount, componentName]);

  // Test on unmount
  React.useEffect(() => {
    return () => {
      if (enabled && testOnUnmount) {
        // Test after a brief delay to catch cleanup issues
        setTimeout(() => {
          tester.runComponentMemoryTest(`${componentName}_unmount`, expectedLimits);
        }, 500);
      }
    };
  }, [enabled, testOnUnmount, componentName]);

  const runManualTest = React.useCallback(() => {
    return tester.runComponentMemoryTest(componentName, expectedLimits);
  }, [componentName, expectedLimits]);

  const takeSnapshot = React.useCallback(() => {
    return tester.takeComponentSnapshot(componentName);
  }, [componentName]);

  return {
    runManualTest,
    takeSnapshot,
    isTestingEnabled: enabled,
  };
};

// Global setup function for memory leak testing
export const setupGlobalMemoryLeakTesting = (options: {
  autoStart?: boolean;
  testInterval?: number;
  reportToConsole?: boolean;
  criticalThreshold?: number;
} = {}) => {
  if (!__DEV__) return;

  const { autoStart = true, testInterval = 60000, reportToConsole = true, criticalThreshold = 5 } = options;
  const tester = MemoryLeakTester.getInstance();

  if (autoStart) {
    tester.startTestSuite('Global Memory Monitoring');
  }

  // Global testing functions
  (global as any).__memoryLeakTester = {
    runTest: (componentName: string, limits?: any) => tester.runComponentMemoryTest(componentName, limits),
    generateReport: () => tester.generateTestReport(),
    clearHistory: () => tester.clearTestHistory(),
    takeSnapshot: (componentName: string) => tester.takeComponentSnapshot(componentName),
    startSuite: (name: string) => tester.startTestSuite(name),
    endSuite: () => tester.endTestSuite(),
  };

  // Periodic reporting
  if (reportToConsole) {
    setInterval(() => {
      const report = tester.generateTestReport();
      
      if (report.summary.totalLeaksDetected > 0) {
        console.group('[MemoryLeakTester] Periodic Report');
        logDebug('Total tests:', "Debug", report.summary.totalTests);
        logDebug('Failed tests:', "Debug", report.summary.failedTests);
        logDebug('Total leaks:', "Debug", report.summary.totalLeaksDetected);
        
        const criticalIssues = report.suites.reduce((sum, s) => sum + s.summary.criticalIssues, 0);
        if (criticalIssues >= criticalThreshold) {
          logError(`🚨 ${criticalIssues} CRITICAL memory leak issues detected!`, "Error");
        }
        
        logDebug('Recommendations:', "Debug", report.recommendations);
        console.groupEnd();
      }
    }, testInterval);
  }

  logDebug('[MemoryLeakTester] Global testing enabled', "Debug");
};

export default MemoryLeakTester;
