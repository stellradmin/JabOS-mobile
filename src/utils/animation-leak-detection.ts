// Animation leak detection utilities for development environments
// Detects and reports animation-related memory leaks and performance issues
// Development-only utilities with zero production impact

import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface AnimationLeakReport {
  timestamp: number;
  componentName?: string;
  leakType: 'stale-animation' | 'infinite-loop' | 'excessive-recomputations' | 'memory-buildup' | 'gesture-leak' | 'worklet-leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  animationInfo?: {
    id?: string;
    type?: string;
    duration?: number;
    frameCount?: number;
    frameDrops?: number;
    memoryUsage?: number;
  };
  recommendations: string[];
}

interface AnimationMemorySnapshot {
  timestamp: number;
  componentName: string;
  animations: {
    total: number;
    running: number;
    byType: Record<string, number>;
  };
  sharedValues: {
    total: number;
    listening: number;
    byType: Record<string, number>;
  };
  gestureHandlers: {
    total: number;
    active: number;
    byType: Record<string, number>;
  };
  worklets: {
    total: number;
    registered: number;
  };
  memoryUsage?: {
    usedMB: number;
    totalMB: number;
  };
  performance: {
    avgFrameTime: number;
    maxFrameTime: number;
    frameDropCount: number;
  };
}

class AnimationLeakDetector {
  private static instance: AnimationLeakDetector;
  private snapshots: AnimationMemorySnapshot[] = [];
  private leakReports: AnimationLeakReport[] = [];
  private monitoringActive = false;
  private monitorInterval?: NodeJS.Timeout;
  private frameDropMonitor?: number;
  private lastFrameTime = 0;
  private frameDrops = 0;

  static getInstance(): AnimationLeakDetector {
    if (!AnimationLeakDetector.instance) {
      AnimationLeakDetector.instance = new AnimationLeakDetector();
    }
    return AnimationLeakDetector.instance;
  }

  startMonitoring(options: {
    interval?: number;
    trackFrameDrops?: boolean;
    trackMemoryUsage?: boolean;
    componentName?: string;
  } = {}): void {
    if (this.monitoringActive || !__DEV__) return;

    const { 
      interval = 30000, 
      trackFrameDrops = true, 
      trackMemoryUsage = true,
      componentName = 'Global' 
    } = options;

    this.monitoringActive = true;

    // Periodic snapshots and analysis
    this.monitorInterval = setInterval(() => {
      this.takeSnapshot(componentName, trackMemoryUsage);
      this.analyzeForAnimationLeaks();
    }, interval);

    // Frame drop monitoring
    if (trackFrameDrops && Platform.OS === 'web') {
      this.setupFrameDropMonitoring();
    }

    logDebug('[AnimationLeakDetector] Monitoring started', "Debug");
  }

  stopMonitoring(): void {
    if (!this.monitoringActive) return;

    this.monitoringActive = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    if (this.frameDropMonitor) {
      cancelAnimationFrame(this.frameDropMonitor);
      this.frameDropMonitor = undefined;
    }

    logDebug('[AnimationLeakDetector] Monitoring stopped', "Debug");
  }

  private takeSnapshot(componentName: string, trackMemoryUsage: boolean): AnimationMemorySnapshot {
    const snapshot: AnimationMemorySnapshot = {
      timestamp: Date.now(),
      componentName,
      animations: this.getAnimationStats(),
      sharedValues: this.getSharedValueStats(),
      gestureHandlers: this.getGestureHandlerStats(),
      worklets: this.getWorkletStats(),
      performance: this.getPerformanceStats(),
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

  private getAnimationStats() {
    // These would integrate with our animation management hooks
    const animations = (window as any).__animationTracker || { total: 0, running: 0, byType: {} };
    return {
      total: animations.total || 0,
      running: animations.running || 0,
      byType: animations.byType || {},
    };
  }

  private getSharedValueStats() {
    // These would integrate with our useAnimatedValues hook
    const sharedValues = (window as any).__sharedValueTracker || { total: 0, listening: 0, byType: {} };
    return {
      total: sharedValues.total || 0,
      listening: sharedValues.listening || 0,
      byType: sharedValues.byType || {},
    };
  }

  private getGestureHandlerStats() {
    // These would integrate with our useGestureHandlers hook
    const gestureHandlers = (window as any).__gestureHandlerTracker || { total: 0, active: 0, byType: {} };
    return {
      total: gestureHandlers.total || 0,
      active: gestureHandlers.active || 0,
      byType: gestureHandlers.byType || {},
    };
  }

  private getWorkletStats() {
    // These would integrate with our worklet tracking
    const worklets = (window as any).__workletTracker || { total: 0, registered: 0 };
    return {
      total: worklets.total || 0,
      registered: worklets.registered || 0,
    };
  }

  private getPerformanceStats() {
    return {
      avgFrameTime: this.lastFrameTime,
      maxFrameTime: this.lastFrameTime, // Would track max over time
      frameDropCount: this.frameDrops,
    };
  }

  private setupFrameDropMonitoring(): void {
    if (Platform.OS !== 'web') return;

    let lastTime = performance.now();
    const monitorFrame = (currentTime: number) => {
      const frameTime = currentTime - lastTime;
      this.lastFrameTime = frameTime;

      // Detect frame drops (>33ms for 30fps)
      if (frameTime > 33) {
        this.frameDrops++;
        
        // Report severe frame drops
        if (frameTime > 50) {
          this.reportLeak({
            timestamp: Date.now(),
            leakType: 'excessive-recomputations',
            severity: frameTime > 100 ? 'high' : 'medium',
            description: `Severe frame drop detected: ${frameTime.toFixed(2)}ms`,
            animationInfo: {
              frameCount: 1,
              frameDrops: 1,
            },
            recommendations: [
              'Check for expensive computations in animation callbacks',
              'Consider using worklets for smooth animations',
              'Optimize animated style calculations',
              'Reduce the number of animated properties',
            ],
          });
        }
      }

      lastTime = currentTime;
      this.frameDropMonitor = requestAnimationFrame(monitorFrame);
    };

    this.frameDropMonitor = requestAnimationFrame(monitorFrame);
  }

  private analyzeForAnimationLeaks(): void {
    if (this.snapshots.length < 2) return;

    const current = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    this.checkAnimationCountIncrease(previous, current);
    this.checkSharedValueLeaks(previous, current);
    this.checkGestureHandlerLeaks(previous, current);
    this.checkWorkletLeaks(previous, current);
    this.checkMemoryIncrease(previous, current);
    this.checkPerformanceDegradation(previous, current);
  }

  private checkAnimationCountIncrease(previous: AnimationMemorySnapshot, current: AnimationMemorySnapshot): void {
    const animationIncrease = current.animations.total - previous.animations.total;
    const runningIncrease = current.animations.running - previous.animations.running;
    
    if (animationIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'stale-animation',
        severity: animationIncrease > 15 ? 'high' : 'medium',
        description: `Significant animation count increase: +${animationIncrease} animations`,
        animationInfo: {
          frameCount: current.animations.total,
        },
        recommendations: [
          'Check for animations that are not being properly cleaned up',
          'Ensure animation.cleanup() is called on component unmount',
          'Look for infinite animation loops',
          'Consider using animation groups for coordinated animations',
        ],
      });
    }

    if (runningIncrease > 3 && current.animations.running > 10) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'infinite-loop',
        severity: 'high',
        description: `High number of running animations: ${current.animations.running} (increase: +${runningIncrease})`,
        animationInfo: {
          frameCount: current.animations.running,
        },
        recommendations: [
          'Check for animations that never complete',
          'Verify animation duration and end conditions',
          'Look for recursive animation triggers',
          'Consider setting maximum animation duration',
        ],
      });
    }
  }

  private checkSharedValueLeaks(previous: AnimationMemorySnapshot, current: AnimationMemorySnapshot): void {
    const sharedValueIncrease = current.sharedValues.total - previous.sharedValues.total;
    const listeningIncrease = current.sharedValues.listening - previous.sharedValues.listening;
    
    if (sharedValueIncrease > 10) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'memory-buildup',
        severity: sharedValueIncrease > 20 ? 'high' : 'medium',
        description: `Shared value count increased by ${sharedValueIncrease}`,
        recommendations: [
          'Ensure shared values are cleaned up when no longer needed',
          'Check for shared values created in render loops',
          'Consider reusing shared values instead of creating new ones',
          'Verify that derived values properly clean up dependencies',
        ],
      });
    }

    if (listeningIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'memory-buildup',
        severity: 'medium',
        description: `Shared value listeners increased by ${listeningIncrease}`,
        recommendations: [
          'Check for listener leaks in shared value subscriptions',
          'Ensure listeners are removed when components unmount',
          'Verify that derived values clean up their listeners',
        ],
      });
    }
  }

  private checkGestureHandlerLeaks(previous: AnimationMemorySnapshot, current: AnimationMemorySnapshot): void {
    const gestureIncrease = current.gestureHandlers.total - previous.gestureHandlers.total;
    const activeIncrease = current.gestureHandlers.active - previous.gestureHandlers.active;
    
    if (gestureIncrease > 5) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'gesture-leak',
        severity: gestureIncrease > 10 ? 'high' : 'medium',
        description: `Gesture handler count increased by ${gestureIncrease}`,
        recommendations: [
          'Ensure gesture handlers are cleaned up on component unmount',
          'Check for gesture handlers created in render loops',
          'Verify that gesture compositions are properly disposed',
          'Look for circular references in gesture callbacks',
        ],
      });
    }

    if (activeIncrease > 3 && current.gestureHandlers.active > 8) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'gesture-leak',
        severity: 'medium',
        description: `High number of active gestures: ${current.gestureHandlers.active}`,
        recommendations: [
          'Check for gestures that remain active after interaction ends',
          'Verify gesture state management and cleanup',
          'Consider disabling unused gestures',
        ],
      });
    }
  }

  private checkWorkletLeaks(previous: AnimationMemorySnapshot, current: AnimationMemorySnapshot): void {
    const workletIncrease = current.worklets.total - previous.worklets.total;
    
    if (workletIncrease > 8) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'worklet-leak',
        severity: workletIncrease > 15 ? 'high' : 'medium',
        description: `Worklet count increased by ${workletIncrease}`,
        recommendations: [
          'Check for worklets created in render loops',
          'Ensure worklets are disposed when no longer needed',
          'Consider memoizing worklet creation',
          'Verify that gesture worklets are properly cleaned up',
        ],
      });
    }
  }

  private checkMemoryIncrease(previous: AnimationMemorySnapshot, current: AnimationMemorySnapshot): void {
    if (!previous.memoryUsage || !current.memoryUsage) return;

    const memoryIncrease = current.memoryUsage.usedMB - previous.memoryUsage.usedMB;
    
    if (memoryIncrease > 25) { // 25MB increase
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'memory-buildup',
        severity: memoryIncrease > 50 ? 'critical' : 'high',
        description: `Significant memory increase: +${memoryIncrease}MB (possibly animation-related)`,
        animationInfo: {
          memoryUsage: current.memoryUsage.usedMB,
        },
        recommendations: [
          'Check for animation-related memory leaks',
          'Verify that animated values are properly disposed',
          'Look for circular references in animation callbacks',
          'Consider using worklets to reduce main thread memory usage',
          'Force garbage collection and check if memory is released',
        ],
      });
    }
  }

  private checkPerformanceDegradation(previous: AnimationMemorySnapshot, current: AnimationMemorySnapshot): void {
    const frameDropIncrease = current.performance.frameDropCount - previous.performance.frameDropCount;
    const frameTimeIncrease = current.performance.avgFrameTime - previous.performance.avgFrameTime;
    
    if (frameDropIncrease > 10) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'excessive-recomputations',
        severity: frameDropIncrease > 20 ? 'high' : 'medium',
        description: `Frame drops increased by ${frameDropIncrease}`,
        animationInfo: {
          frameDrops: current.performance.frameDropCount,
          avgFrameTime: current.performance.avgFrameTime,
        },
        recommendations: [
          'Optimize animation calculations',
          'Use worklets for smooth animations',
          'Reduce the number of animated properties',
          'Check for expensive operations in animation callbacks',
        ],
      });
    }

    if (frameTimeIncrease > 10 && current.performance.avgFrameTime > 20) {
      this.reportLeak({
        timestamp: Date.now(),
        leakType: 'excessive-recomputations',
        severity: 'medium',
        description: `Average frame time increased by ${frameTimeIncrease.toFixed(2)}ms`,
        animationInfo: {
          avgFrameTime: current.performance.avgFrameTime,
        },
        recommendations: [
          'Profile animation performance',
          'Consider using lower fidelity animations',
          'Optimize animated style calculations',
          'Use requestAnimationFrame for custom animations',
        ],
      });
    }
  }

  private reportLeak(leak: AnimationLeakReport): void {
    this.leakReports.push(leak);

    // Keep only last 100 reports
    if (this.leakReports.length > 100) {
      this.leakReports = this.leakReports.slice(-100);
    }

    // Console output based on severity
    const logMethod = leak.severity === 'critical' ? 'error' : 
                     leak.severity === 'high' ? 'error' :
                     leak.severity === 'medium' ? 'warn' : 'log';

    console[logMethod](`[AnimationLeakDetector] ${leak.severity.toUpperCase()}: ${leak.description}`);
    
    if (leak.animationInfo) {
      console[logMethod]('Animation info:', leak.animationInfo);
    }
    
    console[logMethod]('Recommendations:', leak.recommendations);
  }

  // Manual animation analysis methods
  detectStaleAnimations(animationMap: Map<string, any>): AnimationLeakReport[] {
    const leaks: AnimationLeakReport[] = [];
    const now = Date.now();

    animationMap.forEach((animation, id) => {
      // Check for animations running too long
      if (animation.startedAt && animation.state === 'running') {
        const duration = now - animation.startedAt;
        
        if (duration > 300000) { // 5 minutes
          leaks.push({
            timestamp: now,
            leakType: 'infinite-loop',
            severity: 'high',
            description: `Animation ${id} has been running for ${Math.round(duration / 60000)} minutes`,
            animationInfo: {
              id,
              type: animation.type,
              duration,
            },
            recommendations: [
              'Check if animation should have ended',
              'Verify animation completion conditions',
              'Consider setting a maximum duration',
            ],
          });
        }
      }

      // Check for animations with excessive frame drops
      if (animation.frameDrops > 50) {
        leaks.push({
          timestamp: now,
          leakType: 'excessive-recomputations',
          severity: 'medium',
          description: `Animation ${id} has ${animation.frameDrops} frame drops`,
          animationInfo: {
            id,
            type: animation.type,
            frameDrops: animation.frameDrops,
          },
          recommendations: [
            'Optimize animation calculations',
            'Use worklets for smoother performance',
            'Reduce animated property complexity',
          ],
        });
      }
    });

    return leaks;
  }

  detectSharedValueLeaks(sharedValueMap: Map<string, any>): AnimationLeakReport[] {
    const leaks: AnimationLeakReport[] = [];
    const now = Date.now();

    sharedValueMap.forEach((sharedValue, id) => {
      // Check for shared values with many listeners
      if (sharedValue.listeners && sharedValue.listeners.size > 20) {
        leaks.push({
          timestamp: now,
          leakType: 'memory-buildup',
          severity: 'medium',
          description: `Shared value ${id} has ${sharedValue.listeners.size} listeners`,
          recommendations: [
            'Check for listener leaks',
            'Ensure listeners are removed when components unmount',
            'Consider consolidating listeners',
          ],
        });
      }

      // Check for stale shared values
      if (sharedValue.lastAccessed && (now - sharedValue.lastAccessed) > 600000) { // 10 minutes
        leaks.push({
          timestamp: now,
          leakType: 'stale-animation',
          severity: 'low',
          description: `Shared value ${id} hasn't been accessed for ${Math.round((now - sharedValue.lastAccessed) / 60000)} minutes`,
          recommendations: [
            'Consider cleaning up unused shared values',
            'Check if this value is still needed',
          ],
        });
      }
    });

    return leaks;
  }

  // Report generation
  generateAnimationLeakReport(): {
    summary: {
      totalLeaks: number;
      leaksBySeverity: Record<string, number>;
      leaksByType: Record<string, number>;
      recentLeaks: AnimationLeakReport[];
    };
    snapshots: AnimationMemorySnapshot[];
    performance: {
      avgFrameTime: number;
      totalFrameDrops: number;
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
        avgFrameTime: 0,
        totalFrameDrops: 0,
        memoryTrend: 'unknown' as const,
      };
    }

    const recent = this.snapshots.slice(-5);
    const avgFrameTime = recent.reduce((sum, s) => sum + s.performance.avgFrameTime, 0) / recent.length;
    const totalFrameDrops = recent.reduce((sum, s) => sum + s.performance.frameDropCount, 0);

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
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      totalFrameDrops,
      memoryTrend,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const criticalLeaks = this.leakReports.filter(l => l.severity === 'critical').length;
    const highLeaks = this.leakReports.filter(l => l.severity === 'high').length;
    const infiniteLoops = this.leakReports.filter(l => l.leakType === 'infinite-loop').length;
    const memoryLeaks = this.leakReports.filter(l => l.leakType === 'memory-buildup').length;
    const performanceIssues = this.leakReports.filter(l => l.leakType === 'excessive-recomputations').length;

    if (criticalLeaks > 0) {
      recommendations.push('URGENT: Critical animation memory leaks detected - investigate immediately');
    }

    if (highLeaks > 3) {
      recommendations.push('Multiple high-severity animation issues - review animation cleanup patterns');
    }

    if (infiniteLoops > 0) {
      recommendations.push('Animation infinite loops detected - check animation completion conditions');
    }

    if (memoryLeaks > 2) {
      recommendations.push('Consider implementing automatic cleanup for shared values and gesture handlers');
    }

    if (performanceIssues > 3) {
      recommendations.push('Performance issues detected - consider using worklets for smooth animations');
    }

    const performance = this.calculatePerformanceMetrics();
    if (performance.memoryTrend === 'increasing') {
      recommendations.push('Memory usage consistently increasing - audit animation resource management');
    }

    if (performance.avgFrameTime > 25) {
      recommendations.push('High average frame time - optimize animation calculations');
    }

    if (performance.totalFrameDrops > 20) {
      recommendations.push('Frequent frame drops - consider reducing animation complexity');
    }

    return recommendations;
  }

  clearHistory(): void {
    this.snapshots = [];
    this.leakReports = [];
    this.frameDrops = 0;
  }
}

// Hook for automatic animation leak detection
export const useAnimationLeakDetection = (options: {
  enabled?: boolean;
  interval?: number;
  trackFrameDrops?: boolean;
  componentName?: string;
} = {}) => {
  const { enabled = __DEV__, interval = 30000, trackFrameDrops = true, componentName } = options;

  const detector = AnimationLeakDetector.getInstance();

  // Start monitoring when enabled
  useEffect(() => {
    if (enabled) {
      detector.startMonitoring({ interval, trackFrameDrops, componentName });
    }

    return () => {
      if (enabled) {
        detector.stopMonitoring();
      }
    };
  }, [enabled, interval, trackFrameDrops, componentName]);

  const manualDetection = useCallback((animationMap: Map<string, any>) => {
    return detector.detectStaleAnimations(animationMap);
  }, []);

  const manualSharedValueDetection = useCallback((sharedValueMap: Map<string, any>) => {
    return detector.detectSharedValueLeaks(sharedValueMap);
  }, []);

  const generateReport = useCallback(() => {
    return detector.generateAnimationLeakReport();
  }, []);

  const clearHistory = useCallback(() => {
    detector.clearHistory();
  }, []);

  return {
    manualDetection,
    manualSharedValueDetection,
    generateReport,
    clearHistory,
    isMonitoring: detector['monitoringActive'],
  };
};

// Global setup function for animation leak detection
export const setupGlobalAnimationLeakDetection = (options: {
  autoStart?: boolean;
  interval?: number;
  trackFrameDrops?: boolean;
  reportToConsole?: boolean;
} = {}) => {
  if (!__DEV__) return;

  const { autoStart = true, interval = 30000, trackFrameDrops = true, reportToConsole = true } = options;
  const detector = AnimationLeakDetector.getInstance();

  if (autoStart) {
    detector.startMonitoring({ interval, trackFrameDrops });
  }

  // Global report function
  (window as any).__animationLeakDetector = {
    generateReport: () => detector.generateAnimationLeakReport(),
    clearHistory: () => detector.clearHistory(),
    startMonitoring: (opts?: any) => detector.startMonitoring(opts),
    stopMonitoring: () => detector.stopMonitoring(),
  };

  // Periodic console reports
  if (reportToConsole) {
    setInterval(() => {
      const report = detector.generateAnimationLeakReport();
      
      if (report.summary.totalLeaks > 0) {
        console.group('[AnimationLeakDetector] Periodic Report');
        logDebug('Total leaks:', "Debug", report.summary.totalLeaks);
        logDebug('By severity:', "Debug", report.summary.leaksBySeverity);
        logDebug('By type:', "Debug", report.summary.leaksByType);
        logDebug('Performance:', "Debug", report.performance);
        logDebug('Recommendations:', "Debug", report.recommendations);
        console.groupEnd();
      }
    }, 60000); // Every minute
  }

  logDebug('[AnimationLeakDetector] Global detection enabled', "Debug");
};

export default AnimationLeakDetector;
