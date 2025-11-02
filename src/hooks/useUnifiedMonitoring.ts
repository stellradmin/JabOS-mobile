/**
 * Unified Monitoring Hook for Stellr Dating App
 * 
 * Purpose: React hook for easy integration of monitoring in components
 * Security: Provides secure monitoring integration with privacy controls
 * Features: Auto-tracking, performance monitoring, error boundaries, consent management
 * 
 * Architecture: Follows the 10 Golden Code Principles
 * - Easy integration with components
 * - Automatic lifecycle tracking
 * - Performance measurements
 * - Privacy-compliant by default
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { 
  unifiedMonitoring,
  monitorUnmatch,
  monitorMessaging,
  monitorAccessibility,
  monitorError,
  monitorAuthentication,
  monitorDataAccess,
  getMonitoringStatus,
  recordMonitoringConsent
} from '../services/unified-monitoring-service';
import { useErrorRecovery } from './useErrorRecovery';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import type { 
  MonitoringDashboard, 
  Alert,
  UserConsent 
} from '../services/unified-monitoring-service';

// ===============================================================================
// TYPES
// ===============================================================================

export interface UseUnifiedMonitoringOptions {
  screenName?: string;
  feature?: string;
  trackScreenTime?: boolean;
  trackPerformance?: boolean;
  trackErrors?: boolean;
  customMetadata?: Record<string, any>;
}

export interface MonitoringActions {
  // Feature monitoring
  trackUnmatch: typeof monitorUnmatch;
  trackMessaging: typeof monitorMessaging;
  trackAccessibility: typeof monitorAccessibility;
  
  // Error monitoring
  trackError: typeof monitorError;
  trackRecoveredError: (error: Error, component: string, action: string) => void;
  
  // Security monitoring
  trackAuthentication: typeof monitorAuthentication;
  trackDataAccess: typeof monitorDataAccess;
  
  // Custom events
  trackCustomEvent: (eventName: string, metadata?: Record<string, any>) => void;
  trackConversion: (conversionType: string, value?: number) => void;
  
  // Performance
  measurePerformance: (operation: () => Promise<any>, operationName: string) => Promise<any>;
  
  // Consent
  recordConsent: typeof recordMonitoringConsent;
  checkConsent: (type: keyof UserConsent) => boolean;
}

export interface MonitoringState {
  isInitialized: boolean;
  hasConsent: boolean;
  dashboard: MonitoringDashboard | null;
  activeAlerts: Alert[];
  isLoading: boolean;
  error: Error | null;
}

// ===============================================================================
// MAIN HOOK
// ===============================================================================

/**
 * Hook for unified monitoring integration
 * Principle 1: Single Responsibility - One hook for all monitoring needs
 */
export function useUnifiedMonitoring(
  options: UseUnifiedMonitoringOptions = {}
): [MonitoringState, MonitoringActions] {
  const {
    screenName,
    feature,
    trackScreenTime = true,
    trackPerformance = true,
    trackErrors = true,
    customMetadata = {}
  } = options;

  // State management
  const [state, setState] = useState<MonitoringState>({
    isInitialized: false,
    hasConsent: false,
    dashboard: null,
    activeAlerts: [],
    isLoading: false,
    error: null
  });

  // Performance tracking refs
  const screenLoadStartTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Error recovery integration
  const { recoverFromError } = useErrorRecovery();

  // ===============================================================================
  // INITIALIZATION
  // ===============================================================================

  useEffect(() => {
    initializeMonitoring();
  }, []);

  const initializeMonitoring = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Initialize unified monitoring
      await unifiedMonitoring.initialize({
        enableBusinessMetrics: true,
        enablePerformanceMonitoring: trackPerformance,
        enableSecurityMonitoring: true,
        enablePrivacyAnalytics: true,
        enableFeatureMonitoring: true,
        enableRealTimeAlerts: true,
        requireUserConsent: true
      });

      // Check consent status
      const hasAnalyticsConsent = unifiedMonitoring.hasConsent('analytics');
      const hasPerformanceConsent = unifiedMonitoring.hasConsent('performance');

      setState(prev => ({
        ...prev,
        isInitialized: true,
        hasConsent: hasAnalyticsConsent && hasPerformanceConsent,
        isLoading: false
      }));

      // Track screen load if enabled
      if (trackScreenTime && screenName) {
        const loadTime = Date.now() - screenLoadStartTime.current;
        trackScreenLoad(screenName, loadTime);
      }

    } catch (error) {
      logError('Monitoring initialization failed:', "Error", error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        isLoading: false
      }));
    }
  };

  // ===============================================================================
  // LIFECYCLE TRACKING
  // ===============================================================================

  useEffect(() => {
    if (!state.isInitialized || !trackScreenTime || !screenName) return;

    // Track screen enter
    unifiedMonitoring.trackUserJourney('screen_view', screenName, {
      action: 'enter',
      feature,
      ...customMetadata
    });

    // Track screen exit on unmount
    return () => {
      unifiedMonitoring.trackUserJourney('screen_view', screenName, {
        action: 'exit',
        feature,
        duration: Date.now() - screenLoadStartTime.current,
        ...customMetadata
      });
    };
  }, [state.isInitialized, screenName, feature, trackScreenTime]);

  // Track app state changes
  useEffect(() => {
    if (!state.isInitialized) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && 
          nextAppState === 'active') {
        // App has come to foreground
        unifiedMonitoring.trackUserJourney('user_action', 'app_foreground', {
          previousState: appStateRef.current,
          screenName
        });
      } else if (appStateRef.current === 'active' && 
                 nextAppState.match(/inactive|background/)) {
        // App has gone to background
        unifiedMonitoring.trackUserJourney('user_action', 'app_background', {
          screenName,
          sessionDuration: Date.now() - screenLoadStartTime.current
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [state.isInitialized, screenName]);

  // Track render performance
  useEffect(() => {
    if (!state.isInitialized || !trackPerformance) return;

    renderCount.current++;
    
    // Alert on excessive re-renders
    if (renderCount.current > 50) {
      monitorError(
        new Error('Excessive re-renders detected'),
        {
          component: screenName || 'unknown',
          action: 'render',
          recovered: false,
          userImpact: 'minimal',
          metadata: {
            renderCount: renderCount.current,
            ...customMetadata
          }
        }
      );
    }
  });

  // ===============================================================================
  // MONITORING ACTIONS
  // ===============================================================================

  /**
   * Tracks recovered errors with context
   * Principle 3: Small, Focused Functions - Single purpose method
   */
  const trackRecoveredError = useCallback((
    error: Error,
    component: string,
    action: string
  ) => {
    monitorError(error, {
      component,
      action,
      recovered: true,
      userImpact: 'none',
      metadata: {
        screenName,
        feature,
        ...customMetadata
      }
    });

    // Attempt recovery
    recoverFromError(error, {
      component,
      action,
      severity: 'low'
    });
  }, [screenName, feature, customMetadata, recoverFromError]);

  /**
   * Tracks custom events with privacy compliance
   */
  const trackCustomEvent = useCallback((
    eventName: string,
    metadata?: Record<string, any>
  ) => {
    if (!state.hasConsent) {
      logDebug('📋 Custom event tracking skipped - no consent', "Debug");
      return;
    }

    unifiedMonitoring.trackUserJourney(
      'user_action',
      eventName,
      {
        screenName,
        feature,
        ...customMetadata,
        ...metadata
      }
    );
  }, [state.hasConsent, screenName, feature, customMetadata]);

  /**
   * Tracks conversion events
   */
  const trackConversion = useCallback((
    conversionType: string,
    value?: number
  ) => {
    if (!state.hasConsent) {
      logDebug('📋 Conversion tracking skipped - no consent', "Debug");
      return;
    }

    unifiedMonitoring.trackBusinessMetric(
      `conversion_${conversionType}`,
      value,
      {
        screenName,
        feature,
        ...customMetadata
      }
    );
  }, [state.hasConsent, screenName, feature, customMetadata]);

  /**
   * Measures async operation performance
   * Principle 8: Command Query Separation - Performs action and returns result
   */
  const measurePerformance = useCallback(async (
    operation: () => Promise<any>,
    operationName: string
  ): Promise<any> => {
    const startTime = Date.now();
    let result;
    let error;

    try {
      result = await operation();
    } catch (err) {
      error = err;
    }

    const duration = Date.now() - startTime;

    // Track performance
    if (trackPerformance) {
      unifiedMonitoring.trackPerformanceMetric(
        'api',
        operationName,
        duration,
        {
          screenName,
          feature,
          success: !error,
          ...customMetadata
        }
      );
    }

    // Track slow operations
    if (duration > 3000) {
      monitorError(
        new Error(`Slow operation: ${operationName}`),
        {
          component: screenName || 'unknown',
          action: operationName,
          recovered: false,
          userImpact: 'minimal',
          metadata: {
            duration,
            ...customMetadata
          }
        }
      );
    }

    if (error) {
      throw error;
    }

    return result;
  }, [trackPerformance, screenName, feature, customMetadata]);

  /**
   * Checks consent for specific monitoring type
   */
  const checkConsent = useCallback((type: keyof UserConsent): boolean => {
    return unifiedMonitoring.hasConsent(type);
  }, []);

  // ===============================================================================
  // DASHBOARD UPDATES
  // ===============================================================================

  useEffect(() => {
    if (!state.isInitialized) return;

    const updateDashboard = async () => {
      try {
        const dashboard = await getMonitoringStatus();
        setState(prev => ({
          ...prev,
          dashboard,
          activeAlerts: dashboard.activeAlerts
        }));
      } catch (error) {
        logError('Dashboard update failed:', "Error", error);
      }
    };

    // Initial load
    updateDashboard();

    // Update every 30 seconds
    const interval = setInterval(updateDashboard, 30000);

    return () => clearInterval(interval);
  }, [state.isInitialized]);

  // ===============================================================================
  // ERROR BOUNDARY INTEGRATION
  // ===============================================================================

  useEffect(() => {
    if (!trackErrors) return;

    const errorHandler = (error: Error, isFatal?: boolean) => {
      monitorError(error, {
        component: screenName || 'global',
        action: 'unhandled_error',
        recovered: false,
        userImpact: isFatal ? 'severe' : 'moderate',
        metadata: {
          isFatal,
          ...customMetadata
        }
      });
    };

    // Set up global error handler
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      errorHandler(error, isFatal);
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    return () => {
      // Restore original handler
      if (originalHandler) {
        ErrorUtils.setGlobalHandler(originalHandler);
      }
    };
  }, [trackErrors, screenName, customMetadata]);

  // ===============================================================================
  // ACTIONS OBJECT
  // ===============================================================================

  const actions: MonitoringActions = {
    // Feature monitoring
    trackUnmatch: monitorUnmatch,
    trackMessaging: monitorMessaging,
    trackAccessibility: monitorAccessibility,
    
    // Error monitoring
    trackError: monitorError,
    trackRecoveredError,
    
    // Security monitoring
    trackAuthentication: monitorAuthentication,
    trackDataAccess: monitorDataAccess,
    
    // Custom events
    trackCustomEvent,
    trackConversion,
    
    // Performance
    measurePerformance,
    
    // Consent
    recordConsent: recordMonitoringConsent,
    checkConsent
  };

  return [state, actions];
}

// ===============================================================================
// SPECIALIZED HOOKS
// ===============================================================================

/**
 * Hook for monitoring unmatch feature
 */
export function useUnmatchMonitoring() {
  const [state, actions] = useUnifiedMonitoring({
    feature: 'unmatch',
    trackErrors: true
  });

  const trackUnmatchFlow = useCallback(async (
    matchId: string,
    reason?: string
  ): Promise<boolean> => {
    const startTime = Date.now();
    
    try {
      // Track initiation
      actions.trackUnmatch('initiated', matchId, reason);
      
      // Simulate unmatch operation
      // In real app, this would call the unmatch service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Track confirmation
      const duration = Date.now() - startTime;
      actions.trackUnmatch('confirmed', matchId, reason, duration);
      
      return true;
    } catch (error) {
      // Track failure
      actions.trackUnmatch('failed', matchId, reason, undefined, error as Error);
      return false;
    }
  }, [actions]);

  return {
    ...state,
    trackUnmatchFlow,
    trackUnmatchCancel: (matchId: string) => 
      actions.trackUnmatch('cancelled', matchId)
  };
}

/**
 * Hook for monitoring messaging features
 */
export function useMessagingMonitoring(conversationId: string) {
  const [state, actions] = useUnifiedMonitoring({
    feature: 'messaging',
    trackPerformance: true
  });

  const trackMessageSend = useCallback(async (
    messageType: string,
    hasAttachment: boolean = false
  ): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Track send action with performance
      actions.trackMessaging('send', conversationId, {
        messageType,
        responseTime: Date.now() - startTime,
        attachmentSize: hasAttachment ? 1024 : undefined
      });
    } catch (error) {
      actions.trackMessaging('error', conversationId, {
        messageType,
        error: error as Error
      });
    }
  }, [conversationId, actions]);

  const trackPagination = useCallback(async (
    pageSize: number
  ): Promise<void> => {
    const startTime = Date.now();
    
    actions.trackMessaging('paginate', conversationId, {
      pageSize,
      responseTime: Date.now() - startTime
    });
  }, [conversationId, actions]);

  return {
    ...state,
    trackMessageSend,
    trackPagination,
    trackMessageReceive: () => 
      actions.trackMessaging('receive', conversationId),
    trackAttachment: (size: number) =>
      actions.trackMessaging('attach', conversationId, { attachmentSize: size })
  };
}

/**
 * Hook for monitoring accessibility features
 */
export function useAccessibilityMonitoring() {
  const [state, actions] = useUnifiedMonitoring({
    feature: 'accessibility'
  });

  const trackFeatureToggle = useCallback((
    feature: 'screen_reader' | 'voice_command' | 'high_contrast',
    enabled: boolean
  ) => {
    actions.trackAccessibility(feature, enabled ? 'enabled' : 'disabled');
    
    // Track as conversion if enabling accessibility
    if (enabled) {
      actions.trackConversion('accessibility_adoption', 1);
    }
  }, [actions]);

  const trackFeatureUsage = useCallback((
    feature: 'screen_reader' | 'voice_command' | 'high_contrast'
  ) => {
    actions.trackAccessibility(feature, 'used');
  }, [actions]);

  return {
    ...state,
    trackFeatureToggle,
    trackFeatureUsage,
    trackAccessibilityError: (feature: any, error: Error) =>
      actions.trackAccessibility(feature, 'error', error)
  };
}

// ===============================================================================
// EXPORTS
// ===============================================================================

export default useUnifiedMonitoring;
export {
  useUnmatchMonitoring,
  useMessagingMonitoring,
  useAccessibilityMonitoring
};