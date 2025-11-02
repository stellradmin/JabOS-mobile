// ===============================================================================
// STELLR SECURITY HOOKS
// ===============================================================================
// Purpose: React hooks for security monitoring and compliance in components
// Features: Real-time threat detection, user verification, secure data handling
// ===============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../utils/secure-storage';
import { 
  securityMonitor, 
  logAuthEvent, 
  logDataAccess, 
  logSecurityViolation,
  SecurityEvent,
  SecurityMetrics 
} from '../lib/security-monitor';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// ===============================================================================
// MAIN SECURITY HOOK
// ===============================================================================

export interface SecurityHookOptions {
  enableRealTimeMonitoring?: boolean;
  enableThreatDetection?: boolean;
  enableDataLossProtection?: boolean;
  riskThreshold?: number; // 0-100
  autoLockThreshold?: number; // Minutes of inactivity
}

export interface SecurityState {
  isSecure: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threatDetected: boolean;
  requiresVerification: boolean;
  sessionValid: boolean;
  metrics: SecurityMetrics;
}

export const useSecurity = (options: SecurityHookOptions = {}) => {
  const {
    enableRealTimeMonitoring = true,
    enableThreatDetection = true,
    enableDataLossProtection = true,
    riskThreshold = 70,
    autoLockThreshold = 30
  } = options;

  const [securityState, setSecurityState] = useState<SecurityState>({
    isSecure: true,
    riskLevel: 'LOW',
    threatDetected: false,
    requiresVerification: false,
    sessionValid: true,
    metrics: securityMonitor.getSecurityMetrics()
  });

  const lastActivityTime = useRef(Date.now());
  const securityCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // ===============================================================================
  // SECURITY STATE MONITORING
  // ===============================================================================

  useEffect(() => {
    if (!enableRealTimeMonitoring) return;

    const startMonitoring = async () => {
      // Check initial security state
      await checkSecurityState();

      // Set up periodic security checks
      securityCheckInterval.current = setInterval(async () => {
        await checkSecurityState();
        await checkSessionValidity();
        await checkInactivity();
      }, 30000); // Every 30 seconds

      // Monitor app state changes
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          lastActivityTime.current = Date.now();
          logAuthEvent('app_resumed', 'INFO', { 
            previousState: AppState.currentState,
            newState: nextAppState 
          });
        } else if (nextAppState === 'background') {
          logAuthEvent('app_backgrounded', 'INFO', { 
            sessionDuration: Date.now() - lastActivityTime.current 
          });
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);

      return () => {
        if (securityCheckInterval.current) {
          clearInterval(securityCheckInterval.current as NodeJS.Timeout);
        }
        subscription?.remove();
      };
    };

    startMonitoring();
  }, [enableRealTimeMonitoring]);

  const checkSecurityState = async () => {
    try {
      const metrics = securityMonitor.getSecurityMetrics();
      const currentRiskLevel = calculateRiskLevel(metrics);
      const threatDetected = metrics.suspiciousPatterns.length > 0;
      
      setSecurityState(prev => ({
        ...prev,
        metrics,
        riskLevel: currentRiskLevel,
        threatDetected,
        isSecure: currentRiskLevel !== 'CRITICAL' && !threatDetected
      }));

      // Log security state change if risk level changed
      if (securityState.riskLevel !== currentRiskLevel) {
        logSecurityViolation('risk_level_changed', 'MEDIUM', {
          previousLevel: securityState.riskLevel,
          newLevel: currentRiskLevel,
          metrics
        });
      }

    } catch (error) {
      logError('Security state check failed:', "Error", error);
    }
  };

  const checkSessionValidity = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionValid = !!session;
      
      if (!sessionValid && securityState.sessionValid) {
        logAuthEvent('session_expired', 'MEDIUM', {
          lastActivity: lastActivityTime.current,
          sessionDuration: Date.now() - lastActivityTime.current
        });
        
        setSecurityState(prev => ({
          ...prev,
          sessionValid: false,
          isSecure: false,
          requiresVerification: true
        }));
      }
    } catch (error) {
      logError('Session validity check failed:', "Error", error);
    }
  };

  const checkInactivity = async () => {
    const inactivityDuration = Date.now() - lastActivityTime.current;
    const inactivityMinutes = inactivityDuration / (1000 * 60);

    if (inactivityMinutes > autoLockThreshold) {
      await handleAutoLock();
    } else if (inactivityMinutes > autoLockThreshold * 0.8) {
      // Warn user about upcoming auto-lock
      logSecurityViolation('inactivity_warning', 'MEDIUM', {
        inactivityMinutes,
        thresholdMinutes: autoLockThreshold
      });
    }
  };

  const calculateRiskLevel = (metrics: SecurityMetrics): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    const totalActions = metrics.totalActions || 1;
    const riskRatio = metrics.highRiskActions / totalActions;
    const suspiciousPatterns = metrics.suspiciousPatterns.length;
    
    if (suspiciousPatterns > 3 || riskRatio > 0.5) return 'CRITICAL';
    if (suspiciousPatterns > 1 || riskRatio > 0.3) return 'HIGH';
    if (suspiciousPatterns > 0 || riskRatio > 0.1) return 'MEDIUM';
    return 'LOW';
  };

  // ===============================================================================
  // SECURITY ACTIONS
  // ===============================================================================

  const logUserAction = useCallback((action: string, context?: any) => {
    lastActivityTime.current = Date.now();
    
    securityMonitor.logSecurityEvent({
      eventCategory: 'data_access',
      eventType: `user_action_${action}`,
      severity: 'INFO',
      context: {
        ...context,
        timestamp: Date.now(),
        sessionId: securityMonitor.getSessionId()
      }
    });
  }, []);

  const logDataAccess = useCallback((resourceType: string, resourceId: string, operation: string, sensitiveData?: boolean) => {
    lastActivityTime.current = Date.now();
    
    const severity = sensitiveData ? 'MEDIUM' : 'INFO';
    const riskScore = sensitiveData ? 30 : 10;
    
    securityMonitor.logSecurityEvent({
      eventCategory: 'data_access',
      eventType: `${resourceType}_${operation}`,
      severity,
      resourceType,
      resourceId,
      riskScore,
      context: {
        sensitiveData,
        timestamp: Date.now()
      }
    });
  }, []);

  const reportSecurityIncident = useCallback(async (
    incidentType: string, 
    details: any, 
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH'
  ) => {
    await securityMonitor.logSecurityEvent({
      eventCategory: 'security_violation',
      eventType: incidentType,
      severity,
      context: details,
      riskScore: severity === 'CRITICAL' ? 100 : severity === 'HIGH' ? 80 : 60
    });

    // Update security state to reflect the incident
    setSecurityState(prev => ({
      ...prev,
      threatDetected: true,
      isSecure: false,
      riskLevel: severity
    }));
  }, []);

  const requestUserVerification = useCallback(async (reason: string) => {
    logSecurityViolation('user_verification_requested', 'MEDIUM', {
      reason,
      timestamp: Date.now(),
      sessionId: securityMonitor.getSessionId()
    });

    setSecurityState(prev => ({
      ...prev,
      requiresVerification: true,
      isSecure: false
    }));

    // Show verification dialog
    Alert.alert(
      'Security Verification Required',
      'Please verify your identity to continue using the app safely.',
      [
        { text: 'Verify Now', onPress: handleUserVerification },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  const handleUserVerification = useCallback(async () => {
    // This would integrate with biometric authentication or re-authentication
    try {
      // For now, simulate verification
      logAuthEvent('user_verification_completed', 'INFO', {
        verificationMethod: 'user_action',
        timestamp: Date.now()
      });

      setSecurityState(prev => ({
        ...prev,
        requiresVerification: false,
        isSecure: true,
        riskLevel: 'LOW'
      }));
    } catch (error) {
      logError('User verification failed:', "Error", error);
    }
  }, []);

  const handleAutoLock = useCallback(async () => {
    logAuthEvent('auto_lock_triggered', 'MEDIUM', {
      inactivityDuration: Date.now() - lastActivityTime.current,
      thresholdMinutes: autoLockThreshold
    });

    // Clear sensitive data from memory
    await AsyncStorage.multiRemove(['sessionData', 'tempUserData']);
    
    // Sign out user
    await supabase.auth.signOut();
    
    setSecurityState(prev => ({
      ...prev,
      sessionValid: false,
      isSecure: false,
      requiresVerification: true
    }));

    Alert.alert(
      'Session Locked',
      'Your session has been locked due to inactivity. Please sign in again.',
      [{ text: 'OK' }]
    );
  }, [autoLockThreshold]);

  const clearSecurityWarnings = useCallback(() => {
    setSecurityState(prev => ({
      ...prev,
      threatDetected: false,
      riskLevel: 'LOW',
      isSecure: true
    }));
  }, []);

  return {
    // State
    securityState,
    
    // Actions
    logUserAction,
    logDataAccess,
    reportSecurityIncident,
    requestUserVerification,
    handleUserVerification,
    clearSecurityWarnings,
    
    // Utils
    updateActivity: () => { lastActivityTime.current = Date.now(); }
  };
};

// ===============================================================================
// SPECIALIZED SECURITY HOOKS
// ===============================================================================

// Hook for secure data handling
export const useSecureData = () => {
  const { logDataAccess, reportSecurityIncident } = useSecurity();

  const secureStore = useCallback(async (key: string, data: any, sensitive = false) => {
    try {
      const serializedData = JSON.stringify(data);
      await secureStorage.storeSecureItem(key, serializedData);
      
      logDataAccess('local_storage', key, 'write', sensitive);
    } catch (error) {
      reportSecurityIncident('secure_storage_failed', {
        key,
        error: error.message,
        sensitive
      }, 'HIGH');
      throw error;
    }
  }, [logDataAccess, reportSecurityIncident]);

  const secureRetrieve = useCallback(async (key: string, sensitive = false) => {
    try {
      const data = await secureStorage.getSecureItem(key);
      
      logDataAccess('local_storage', key, 'read', sensitive);
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      reportSecurityIncident('secure_retrieval_failed', {
        key,
        error: error.message,
        sensitive
      }, 'HIGH');
      throw error;
    }
  }, [logDataAccess, reportSecurityIncident]);

  const secureRemove = useCallback(async (key: string) => {
    try {
      await secureStorage.deleteSecureItem(key);
      logDataAccess('local_storage', key, 'delete', false);
    } catch (error) {
      reportSecurityIncident('secure_removal_failed', {
        key,
        error: error.message
      }, 'MEDIUM');
      throw error;
    }
  }, [logDataAccess, reportSecurityIncident]);

  return {
    secureStore,
    secureRetrieve,
    secureRemove
  };
};

// Hook for authentication security
export const useAuthSecurity = () => {
  const { securityState, requestUserVerification } = useSecurity();
  
  const [authAttempts, setAuthAttempts] = useState(0);
  const maxAuthAttempts = 3;

  const trackAuthAttempt = useCallback((success: boolean, method: string) => {
    if (success) {
      logAuthEvent('login_success', 'INFO', { method });
      setAuthAttempts(0);
    } else {
      const newAttempts = authAttempts + 1;
      setAuthAttempts(newAttempts);
      
      logAuthEvent('login_failure', 'MEDIUM', { 
        method, 
        attemptCount: newAttempts 
      });

      if (newAttempts >= maxAuthAttempts) {
        requestUserVerification('too_many_failed_attempts');
      }
    }
  }, [authAttempts, requestUserVerification]);

  const isAuthSecure = useCallback(() => {
    return securityState.isSecure && 
           securityState.sessionValid && 
           !securityState.requiresVerification &&
           authAttempts < maxAuthAttempts;
  }, [securityState, authAttempts]);

  return {
    trackAuthAttempt,
    isAuthSecure,
    authAttempts,
    maxAuthAttempts
  };
};

// Hook for component-level security monitoring
export const useComponentSecurity = (componentName: string) => {
  const { logUserAction, logDataAccess, securityState } = useSecurity();

  const logComponentMount = useCallback(() => {
    logUserAction(`${componentName}_mounted`);
  }, [componentName, logUserAction]);

  const logComponentAction = useCallback((action: string, context?: any) => {
    logUserAction(`${componentName}_${action}`, {
      ...context,
      component: componentName
    });
  }, [componentName, logUserAction]);

  const logComponentDataAccess = useCallback((
    resourceType: string, 
    resourceId: string, 
    operation: string
  ) => {
    logDataAccess(resourceType, resourceId, operation);
  }, [logDataAccess]);

  // Auto-log component mount
  useEffect(() => {
    logComponentMount();
  }, [logComponentMount]);

  return {
    logComponentAction,
    logComponentDataAccess,
    isSecure: securityState.isSecure,
    riskLevel: securityState.riskLevel
  };
};
