import { useEffect, useCallback, useRef } from 'react';
import { trackUserJourney } from '../lib/posthog-enhanced';
import { trackUserAction, trackAPICall, trackScreenLoad } from '../lib/sentry-enhanced';
import { useAsyncOperations } from './useAsyncOperations';
import { useTimers } from './useTimers';
import { useNetworkRequests } from './useNetworkRequests';
import MemoryLeakTester from '../utils/memory-leak-testing';
import MemoryPerformanceIntegrator from '../utils/memory-performance-integration';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export const usePerformanceMonitoring = () => {
  const screenStartTime = useRef<number>(0);
  const apiCallStartTimes = useRef<Map<string, number>>(new Map());
  
  // Integration with our memory management hooks
  const { getOperationStatus } = useAsyncOperations();
  const { getActiveTimerCount, getTimerDetails } = useTimers();
  const { getRequestStatus, getCacheStatus } = useNetworkRequests();
  
  // Enhanced memory leak detection integration
  const memoryTester = useRef(MemoryLeakTester.getInstance());
  const performanceIntegrator = useRef(MemoryPerformanceIntegrator.getInstance());

  const trackScreenLoadStart = useCallback((screenName: string) => {
    screenStartTime.current = Date.now();
    
    return () => {
      const loadTime = Date.now() - screenStartTime.current;
      
      // Track in both PostHog and Sentry
      trackUserJourney.screenLoaded(screenName, loadTime);
      trackScreenLoad(screenName, loadTime);
      
      // Track slow screen loads in Sentry with additional context
      if (loadTime > 3000) {
        trackUserAction('slow_screen_load', { 
          screenName, 
          loadTime,
          performance_impact: 'high',
        });
      }
    };
  }, []);

  const trackUserInteraction = useCallback((action: string, data?: Record<string, any>) => {
    // Track in Sentry for debugging
    trackUserAction(action, data);
    
    // Track specific dating app interactions in PostHog
    if (action.includes('match') || action.includes('approve') || action.includes('reject')) {
      // This will be handled by specific tracking functions
    } else if (action.includes('message')) {
      // This will be handled by messaging tracking
    } else {
      // Track generic feature usage
      trackUserJourney.featureUsed(action, data);
    }
  }, []);

  const trackAPICallStart = useCallback((endpoint: string, method: string = 'GET') => {
    const callId = `${method}:${endpoint}:${Date.now()}`;
    apiCallStartTimes.current.set(callId, Date.now());
    return callId;
  }, []);

  const trackAPICallEnd = useCallback((
    callId: string, 
    endpoint: string, 
    method: string = 'GET',
    status: number,
    error?: string
  ) => {
    const startTime = apiCallStartTimes.current.get(callId);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    apiCallStartTimes.current.delete(callId);

    // Track in Sentry
    trackAPICall(endpoint, method, duration, status, error);

    // Track API errors in PostHog
    if (error || status >= 400) {
      trackUserJourney.apiError(endpoint, status, error || 'Unknown error', duration);
    }
  }, []);

  const trackMemoryUsage = useCallback(async () => {
    const memoryData: any = { timestamp: Date.now() };
    
    // Browser memory information
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      
      memoryData.browser = {
        usedMB,
        totalMB,
        limitMB,
        usage_percentage: Math.round((usedMB / totalMB) * 100),
        limit_percentage: Math.round((usedMB / limitMB) * 100),
      };
      
      // Track high memory usage with enhanced detection
      if (usedMB > 100) { // 100MB threshold
        trackUserAction('high_memory_usage', memoryData.browser);
        
        // Run comprehensive memory leak test for critical memory usage
        if (usedMB > 200) {
          const leakTestResults = await memoryTester.current.runComponentMemoryTest('high_memory_detection', {
            expectedMaxTimers: 10,
            expectedMaxRefs: 15,
            expectedMaxAnimations: 5,
            expectedMaxSubscriptions: 8,
            expectedMaxListeners: 12,
            maxMemoryGrowthMB: 5,
          });
          
          const failedTests = leakTestResults.filter(r => !r.passed);
          if (failedTests.length > 0) {
            trackUserAction('memory_leak_detected', {
              usedMemoryMB: usedMB,
              failedTests: failedTests.length,
              leakTypes: failedTests.map(t => t.testType),
              criticalIssues: failedTests.filter(t => t.severity === 'critical').length,
            });
          }
        }
      }
    }
    
    // Our memory management system status
    const asyncStatus = getOperationStatus();
    const timerStatus = getActiveTimerCount();
    const networkStatus = getRequestStatus();
    const cacheStatus = getCacheStatus();
    
    memoryData.operations = {
      async_operations: asyncStatus.total,
      async_by_type: asyncStatus.byType,
      long_running_async: asyncStatus.longRunning.length,
      active_timers: timerStatus,
      network_requests: networkStatus.total,
      network_by_method: networkStatus.byMethod,
      long_running_requests: networkStatus.longRunning.length,
      cache_entries: cacheStatus.total,
      expired_cache: cacheStatus.expired,
    };
    
    // Enhanced tracking with memory leak detection integration
    if (asyncStatus.total > 20) {
      trackUserAction('high_async_operation_count', {
        count: asyncStatus.total,
        details: asyncStatus.details,
      });
      
      // Trigger async operation leak test
      if (asyncStatus.total > 30) {
        const leakTest = await memoryTester.current.runComponentMemoryTest('async_operations_leak', {
          expectedMaxTimers: 25,
          expectedMaxSubscriptions: 10,
        });
        
        const asyncLeaks = leakTest.filter(t => !t.passed && t.testType.includes('subscription'));
        if (asyncLeaks.length > 0) {
          trackUserAction('async_operation_leak_detected', {
            operationCount: asyncStatus.total,
            leakDetails: asyncLeaks.map(l => ({ type: l.testType, leaks: l.leaksDetected })),
          });
        }
      }
    }
    
    if (timerStatus > 15) {
      trackUserAction('high_timer_count', {
        count: timerStatus,
        details: getTimerDetails(),
      });
      
      // Trigger timer leak test
      if (timerStatus > 25) {
        const timerLeakTest = await memoryTester.current.testTimerLeaks('timer_monitoring', 20);
        if (!timerLeakTest.passed) {
          trackUserAction('timer_leak_detected', {
            activeTimers: timerStatus,
            leaksDetected: timerLeakTest.leaksDetected,
            severity: timerLeakTest.severity,
          });
        }
      }
    }
    
    if (networkStatus.total > 10) {
      trackUserAction('high_network_request_count', {
        count: networkStatus.total,
        details: networkStatus.details,
      });
    }
    
    if (cacheStatus.expired > 20) {
      trackUserAction('high_expired_cache_count', {
        expired: cacheStatus.expired,
        total: cacheStatus.total,
      });
    }
    
    // Capture comprehensive performance metrics
    try {
      const performanceMetrics = await performanceIntegrator.current.captureMemoryPerformanceMetrics('performance_monitoring');
      memoryData.comprehensive = {
        leakRisk: performanceMetrics.leakRisk,
        resourceCounts: performanceMetrics.resourceCounts,
        performance: performanceMetrics.performance,
        recommendations: performanceMetrics.recommendations,
      };
      
      // Alert on high leak risk
      if (performanceMetrics.leakRisk === 'high' || performanceMetrics.leakRisk === 'critical') {
        trackUserAction('high_memory_leak_risk', {
          riskLevel: performanceMetrics.leakRisk,
          totalResources: Object.values(performanceMetrics.resourceCounts).reduce((sum, count) => sum + count, 0),
          memoryGrowth: performanceMetrics.memoryUsage.growth,
          recommendations: performanceMetrics.recommendations,
        });
      }
    } catch (error) {
      logError('Error capturing comprehensive metrics:', "Error", error);
    }
    
    return memoryData;
  }, [getOperationStatus, getActiveTimerCount, getTimerDetails, getRequestStatus, getCacheStatus]);

  const trackAppPerformance = useCallback(() => {
    // Monitor memory every 60 seconds
    const memoryInterval = setInterval(trackMemoryUsage, 60000);

    // Monitor frame rate if available
    if ('requestIdleCallback' in window) {
      const frameRateMonitor = () => {
        (window as any).requestIdleCallback((deadline: any) => {
          const timeRemaining = deadline.timeRemaining();
          if (timeRemaining < 5) { // Less than 5ms remaining indicates potential frame drops
            trackUserAction('low_frame_rate', {
              time_remaining: timeRemaining,
              did_timeout: deadline.didTimeout,
            });
          }
        });
      };

      const frameInterval = setInterval(frameRateMonitor, 5000); // Check every 5 seconds

      return () => {
        clearInterval(memoryInterval);
        clearInterval(frameInterval);
      };
    }

    return () => {
      clearInterval(memoryInterval);
    };
  }, [trackMemoryUsage]);

  useEffect(() => {
    const cleanup = trackAppPerformance();
    return cleanup;
  }, [trackAppPerformance]);

  // Enhanced memory and operation monitoring
  const getMemoryLeakReport = useCallback(async () => {
    const memoryData = await trackMemoryUsage();
    const leakTestResults = await memoryTester.current.runComponentMemoryTest('performance_monitoring', {
      expectedMaxTimers: 10,
      expectedMaxRefs: 15,
      expectedMaxAnimations: 5,
      expectedMaxSubscriptions: 8,
      expectedMaxListeners: 12,
      maxMemoryGrowthMB: 10,
    });
    
    const performanceMetrics = await performanceIntegrator.current.captureMemoryPerformanceMetrics('performance_monitoring');
    
    return {
      ...memoryData,
      timestamp: Date.now(),
      leakTestResults: leakTestResults.map(test => ({
        type: test.testType,
        passed: test.passed,
        severity: test.severity,
        leaksDetected: test.leaksDetected,
        details: test.details.description,
        recommendations: test.details.recommendations,
      })),
      performanceMetrics: {
        leakRisk: performanceMetrics.leakRisk,
        resourceCounts: performanceMetrics.resourceCounts,
        recommendations: performanceMetrics.recommendations,
      },
      recommendations: generateMemoryRecommendations(memoryData),
    };
  }, [trackMemoryUsage]);

  const generateMemoryRecommendations = useCallback((data: any) => {
    const recommendations: string[] = [];
    
    if (data.operations?.async_operations > 15) {
      recommendations.push('Consider cancelling long-running async operations');
    }
    
    if (data.operations?.active_timers > 10) {
      recommendations.push('High timer count detected - check for timer leaks');
    }
    
    if (data.operations?.network_requests > 8) {
      recommendations.push('Many concurrent network requests - consider request batching');
    }
    
    if (data.operations?.expired_cache > 15) {
      recommendations.push('High expired cache count - consider cache cleanup');
    }
    
    if (data.browser?.limit_percentage > 80) {
      recommendations.push('Approaching memory limit - force garbage collection recommended');
    }
    
    return recommendations;
  }, []);

  // Force cleanup of all managed resources with leak detection
  const forceMemoryCleanup = useCallback(async () => {
    const beforeMemory = await trackMemoryUsage();
    const beforeTests = await memoryTester.current.runComponentMemoryTest('cleanup_before', {
      expectedMaxTimers: 20,
      expectedMaxRefs: 25,
      expectedMaxAnimations: 10,
      expectedMaxSubscriptions: 15,
      expectedMaxListeners: 20,
      maxMemoryGrowthMB: 20,
    });

    const cleanupReport = {
      before: {
        memory: beforeMemory,
        leakTests: beforeTests.map(test => ({
          type: test.testType,
          passed: test.passed,
          leaksDetected: test.leaksDetected,
        })),
      },
      timestamp: Date.now(),
      cleanupActions: [] as string[],
    };

    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      cleanupReport.cleanupActions.push('Force garbage collection executed');
    }

    // Trigger cleanup in our memory management systems
    try {
      // Force cleanup in timer tracker
      const timerTracker = (global as any).__timerTracker;
      if (timerTracker?.forceCleanup) {
        timerTracker.forceCleanup();
        cleanupReport.cleanupActions.push('Timer tracker cleanup executed');
      }

      // Force cleanup in ref tracker
      const refTracker = (global as any).__refTracker;
      if (refTracker?.forceCleanup) {
        refTracker.forceCleanup();
        cleanupReport.cleanupActions.push('Ref tracker cleanup executed');
      }

      // Force cleanup in subscription tracker
      const subscriptionTracker = (global as any).__subscriptionTracker;
      if (subscriptionTracker?.forceCleanup) {
        subscriptionTracker.forceCleanup();
        cleanupReport.cleanupActions.push('Subscription tracker cleanup executed');
      }

      // Force cleanup in event listener tracker
      const eventTracker = (global as any).__eventListenerTracker;
      if (eventTracker?.forceCleanup) {
        eventTracker.forceCleanup();
        cleanupReport.cleanupActions.push('Event listener tracker cleanup executed');
      }
    } catch (error) {
      logError('Error during forced cleanup:', "Error", error);
      cleanupReport.cleanupActions.push(`Cleanup error: ${error}`);
    }

    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const afterMemory = await trackMemoryUsage();
    const afterTests = await memoryTester.current.runComponentMemoryTest('cleanup_after', {
      expectedMaxTimers: 5,
      expectedMaxRefs: 10,
      expectedMaxAnimations: 3,
      expectedMaxSubscriptions: 5,
      expectedMaxListeners: 8,
      maxMemoryGrowthMB: 5,
    });

    const finalReport = {
      ...cleanupReport,
      after: {
        memory: afterMemory,
        leakTests: afterTests.map(test => ({
          type: test.testType,
          passed: test.passed,
          leaksDetected: test.leaksDetected,
        })),
      },
      improvement: {
        memoryFreed: beforeMemory.browser?.usedMB && afterMemory.browser?.usedMB 
          ? beforeMemory.browser.usedMB - afterMemory.browser.usedMB 
          : 0,
        leaksResolved: beforeTests.reduce((sum, test) => sum + test.leaksDetected, 0) - 
                      afterTests.reduce((sum, test) => sum + test.leaksDetected, 0),
        testsImproved: afterTests.filter(test => test.passed).length - 
                      beforeTests.filter(test => test.passed).length,
      },
    };
    
    trackUserAction('manual_memory_cleanup', finalReport);
    
    if (finalReport.improvement.memoryFreed > 0) {
      logDebug(`✅ Memory cleanup successful: ${finalReport.improvement.memoryFreed}MB freed`, "Debug");
    }
    
    if (finalReport.improvement.leaksResolved > 0) {
      logDebug(`✅ Leak cleanup successful: ${finalReport.improvement.leaksResolved} leaks resolved`, "Debug");
    }
    
    return finalReport;
  }, [trackMemoryUsage]);

  // Real-time memory leak monitoring
  const startRealTimeMonitoring = useCallback((options: {
    componentName?: string;
    alertThresholds?: {
      memoryGrowthMB?: number;
      timerCount?: number;
      subscriptionCount?: number;
      listenerCount?: number;
    };
    monitoringInterval?: number;
  } = {}) => {
    const {
      componentName = 'RealTimeMonitor',
      alertThresholds = {
        memoryGrowthMB: 15,
        timerCount: 15,
        subscriptionCount: 10,
        listenerCount: 20,
      },
      monitoringInterval = 30000, // 30 seconds
    } = options;

    // Start performance integrator monitoring
    performanceIntegrator.current.startMonitoring({
      interval: monitoringInterval,
      alertThresholds: {
        memoryGrowthMB: alertThresholds.memoryGrowthMB,
        resourceCount: 50,
        gcPressure: 0.8,
      },
      components: [componentName],
    });

    const monitoringId = setInterval(async () => {
      try {
        const memoryData = await trackMemoryUsage();
        const timerCount = getActiveTimerCount();
        const asyncStatus = getOperationStatus();
        
        // Check for critical thresholds
        let alertTriggered = false;
        const alertData: any = {
          timestamp: Date.now(),
          componentName,
        };

        if (memoryData.browser?.growth && memoryData.browser.growth > alertThresholds.memoryGrowthMB!) {
          alertTriggered = true;
          alertData.memoryAlert = {
            growth: memoryData.browser.growth,
            threshold: alertThresholds.memoryGrowthMB,
            current: memoryData.browser.usedMB,
          };
        }

        if (timerCount > alertThresholds.timerCount!) {
          alertTriggered = true;
          alertData.timerAlert = {
            count: timerCount,
            threshold: alertThresholds.timerCount,
            details: getTimerDetails(),
          };
        }

        if (asyncStatus.total > alertThresholds.subscriptionCount!) {
          alertTriggered = true;
          alertData.subscriptionAlert = {
            count: asyncStatus.total,
            threshold: alertThresholds.subscriptionCount,
            longRunning: asyncStatus.longRunning.length,
          };
        }

        // Trigger comprehensive leak test if alerts detected
        if (alertTriggered) {
          logWarn(`⚠️ Real-time monitoring alert for ${componentName}`, "Warning");
          
          const emergencyTests = await memoryTester.current.runComponentMemoryTest(
            `emergency_${componentName}`,
            {
              expectedMaxTimers: alertThresholds.timerCount,
              expectedMaxRefs: 15,
              expectedMaxAnimations: 5,
              expectedMaxSubscriptions: alertThresholds.subscriptionCount,
              expectedMaxListeners: alertThresholds.listenerCount,
              maxMemoryGrowthMB: alertThresholds.memoryGrowthMB,
            }
          );

          const failedTests = emergencyTests.filter(test => !test.passed);
          if (failedTests.length > 0) {
            alertData.emergencyTestResults = failedTests.map(test => ({
              type: test.testType,
              severity: test.severity,
              leaksDetected: test.leaksDetected,
              recommendations: test.details.recommendations,
            }));

            trackUserAction('real_time_memory_leak_alert', alertData);
            
            logError(`🚨 CRITICAL: Real-time leak detection found ${failedTests.length} failed tests`, "Error");
            failedTests.forEach(test => {
              logError(`   ${test.testName}: ${test.details.description}`, "Error");
            });
          }
        }
      } catch (error) {
        logError('Error in real-time memory monitoring:', "Error", error);
      }
    }, monitoringInterval);

    return {
      monitoringId,
      stop: () => {
        clearInterval(monitoringId);
        performanceIntegrator.current.stopMonitoring();
        logDebug(`Real-time monitoring stopped for ${componentName}`, "Debug");
      },
    };
  }, [trackMemoryUsage, getActiveTimerCount, getTimerDetails, getOperationStatus]);

  // Manual memory leak test runner
  const runMemoryLeakTest = useCallback(async (componentName: string, customThresholds?: any) => {
    logDebug(`[usePerformanceMonitoring] Running manual memory leak test for ${componentName}`, "Debug");
    
    const results = await memoryTester.current.runComponentMemoryTest(componentName, {
      expectedMaxTimers: 8,
      expectedMaxRefs: 12,
      expectedMaxAnimations: 4,
      expectedMaxSubscriptions: 6,
      expectedMaxListeners: 10,
      maxMemoryGrowthMB: 12,
      ...customThresholds,
    });

    const performanceMetrics = await performanceIntegrator.current.captureMemoryPerformanceMetrics(componentName);
    
    const report = {
      componentName,
      timestamp: Date.now(),
      testResults: results.map(test => ({
        type: test.testType,
        passed: test.passed,
        severity: test.severity,
        leaksDetected: test.leaksDetected,
        description: test.details.description,
        recommendations: test.details.recommendations,
      })),
      performanceMetrics: {
        leakRisk: performanceMetrics.leakRisk,
        resourceCounts: performanceMetrics.resourceCounts,
        memoryUsage: performanceMetrics.memoryUsage,
        recommendations: performanceMetrics.recommendations,
      },
      summary: {
        totalTests: results.length,
        passedTests: results.filter(r => r.passed).length,
        failedTests: results.filter(r => !r.passed).length,
        totalLeaksDetected: results.reduce((sum, r) => sum + r.leaksDetected, 0),
        overallRisk: performanceMetrics.leakRisk,
      },
    };

    if (report.summary.failedTests > 0) {
      logWarn(`⚠️ Memory leak test failed for ${componentName}:`, "Warning");
      logWarn(`   ${report.summary.failedTests}/${report.summary.totalTests} tests failed`, "Warning");
      logWarn(`   ${report.summary.totalLeaksDetected} total leaks detected`, "Warning");
      logWarn(`   Risk level: ${report.summary.overallRisk}`, "Warning");
    } else {
      logDebug(`✅ Memory leak test passed for ${componentName}`, "Debug");
    }

    trackUserAction('manual_memory_leak_test', report);
    return report;
  }, []);

  return {
    // Original monitoring functions
    trackScreenLoadStart,
    trackUserInteraction,
    trackAPICallStart,
    trackAPICallEnd,
    trackMemoryUsage,
    
    // Enhanced memory management functions
    getMemoryLeakReport,
    forceMemoryCleanup,
    
    // Real-time monitoring functions
    startRealTimeMonitoring,
    runMemoryLeakTest,
  };
};

// Specialized hook for dating app specific tracking
export const useDatingAppTracking = () => {
  const { trackUserInteraction, trackAPICallStart, trackAPICallEnd } = usePerformanceMonitoring();

  const trackMatchingAction = useCallback((
    action: 'approve' | 'reject' | 'view_profile' | 'view_compatibility',
    targetUserId: string,
    additionalData?: Record<string, any>
  ) => {
    const baseData = {
      target_user_id: targetUserId,
      action,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    switch (action) {
      case 'approve':
        trackUserJourney.userApproved(targetUserId, 'button', 'discover');
        break;
      case 'reject':
        trackUserJourney.userRejected(targetUserId, 'button', 'discover');
        break;
      case 'view_profile':
        // Will be tracked with duration when view ends
        break;
      case 'view_compatibility':
        if (additionalData?.compatibility_scores) {
          trackUserJourney.compatibilityViewed(targetUserId, additionalData.compatibility_scores);
        }
        break;
    }

    trackUserInteraction(`matching_${action}`, baseData);
  }, [trackUserInteraction]);

  const trackMessagingAction = useCallback((
    action: 'send_message' | 'start_conversation' | 'propose_date',
    conversationId: string,
    additionalData?: Record<string, any>
  ) => {
    const baseData = {
      conversation_id: conversationId,
      action,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    switch (action) {
      case 'send_message':
        if (additionalData) {
          trackUserJourney.messageSent(conversationId, {
            messageLength: additionalData.messageLength || 0,
            hasMedia: additionalData.hasMedia || false,
            mediaType: additionalData.mediaType,
            isFirstMessage: additionalData.isFirstMessage || false,
          });
        }
        break;
      case 'start_conversation':
        if (additionalData?.matchUserId) {
          trackUserJourney.conversationStarted(additionalData.matchUserId, 'self');
        }
        break;
      case 'propose_date':
        if (additionalData?.targetUserId && additionalData?.activityType) {
          trackUserJourney.dateProposed(additionalData.targetUserId, additionalData.activityType);
        }
        break;
    }

    trackUserInteraction(`messaging_${action}`, baseData);
  }, [trackUserInteraction]);

  const trackOnboardingAction = useCallback((
    step: string,
    stepNumber: number,
    additionalData?: Record<string, any>
  ) => {
    const baseData = {
      step,
      step_number: stepNumber,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    if (additionalData?.duration) {
      trackUserJourney.onboardingStepCompleted(step, stepNumber, additionalData.duration);
    }

    trackUserInteraction('onboarding_step', baseData);
  }, [trackUserInteraction]);

  const trackSubscriptionAction = useCallback((
    action: 'view' | 'start' | 'complete' | 'cancel',
    plan: string,
    additionalData?: Record<string, any>
  ) => {
    const baseData = {
      action,
      plan,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    switch (action) {
      case 'view':
        trackUserJourney.subscriptionViewed(plan, additionalData?.source || 'unknown', additionalData?.price || 0);
        break;
      case 'start':
        trackUserJourney.subscriptionStarted(plan, additionalData?.price || 0);
        break;
      case 'complete':
        trackUserJourney.subscriptionCompleted(plan, additionalData?.price || 0, additionalData?.duration || 0);
        break;
      case 'cancel':
        trackUserJourney.subscriptionCancelled(plan, additionalData?.reason);
        break;
    }

    trackUserInteraction(`subscription_${action}`, baseData);
  }, [trackUserInteraction]);

  return {
    trackMatchingAction,
    trackMessagingAction,
    trackOnboardingAction,
    trackSubscriptionAction,
    trackAPICallStart,
    trackAPICallEnd,
  };
};
