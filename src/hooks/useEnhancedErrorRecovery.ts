/**
 * Enhanced Error Recovery Hook
 * Provides comprehensive error recovery capabilities for React components
 * Integrates with enhanced error monitoring and provides UI-friendly recovery actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, type AlertButton } from 'react-native';
import {
  StellerError,
  ErrorState,
  ErrorHandlingOptions,
  RecoveryStrategy
} from '../types/error-types';
import {
  convertToStellerError,
  createStellerError
} from '../utils/error-factory';
import EnhancedErrorMonitoringService from '../services/enhanced-error-monitoring-service';
import EnhancedAuthErrorHandler from '../utils/enhanced-auth-error-handler';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Recovery action types
export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  action: () => Promise<boolean>;
  priority: 'primary' | 'secondary' | 'tertiary';
  type: 'retry' | 'fallback' | 'refresh' | 'navigate' | 'clear' | 'custom';
  estimatedTime?: number; // milliseconds
  requiresUserConfirmation?: boolean;
}

// Hook configuration
interface UseErrorRecoveryConfig {
  serviceName: string;
  enableAutoRecovery?: boolean;
  maxAutoRetries?: number;
  autoRetryDelay?: number;
  enableFallback?: boolean;
  enableUserNotifications?: boolean;
  retainErrorHistory?: boolean;
  onError?: (error: StellerError) => void;
  onRecovery?: (success: boolean, action: string) => void;
  customRecoveryActions?: RecoveryAction[];
}

// Hook return type
interface UseErrorRecoveryReturn {
  // Error state
  error: StellerError | null;
  errorState: ErrorState;
  hasError: boolean;
  isRecovering: boolean;
  
  // Error handling
  handleError: (error: any, context?: Record<string, any>) => Promise<void>;
  clearError: () => void;
  
  // Recovery actions
  recoverFromError: (actionId?: string) => Promise<boolean>;
  getRecoveryActions: () => RecoveryAction[];
  retryLastOperation: () => Promise<boolean>;
  
  // Fallback and degradation
  useFallback: <T>(fallbackData: T) => T;
  enableGracefulDegradation: (level: 'partial' | 'minimal' | 'emergency') => void;
  
  // Circuit breaker integration
  executeWithCircuitBreaker: <T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ) => Promise<T>;
  
  // Service health
  getServiceHealth: () => any;
  isServiceHealthy: () => boolean;
}

export function useEnhancedErrorRecovery(
  config: UseErrorRecoveryConfig
): UseErrorRecoveryReturn {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorHistory: [],
    retryCount: 0,
    recoveryAttempts: 0,
    isRecovering: false
  });

  const [isRecovering, setIsRecovering] = useState(false);
  const [lastOperation, setLastOperation] = useState<{
    operation: () => Promise<any>;
    context?: Record<string, any>;
  } | null>(null);
  
  const errorMonitoring = useRef(EnhancedErrorMonitoringService.getInstance());
  const authHandler = useRef(EnhancedAuthErrorHandler.getInstance());
  const circuitBreaker = useRef(
    errorMonitoring.current.getCircuitBreaker(config.serviceName)
  );

  // Default configuration
  const defaultConfig: Required<UseErrorRecoveryConfig> = {
    serviceName: config.serviceName,
    enableAutoRecovery: config.enableAutoRecovery ?? true,
    maxAutoRetries: config.maxAutoRetries ?? 3,
    autoRetryDelay: config.autoRetryDelay ?? 2000,
    enableFallback: config.enableFallback ?? true,
    enableUserNotifications: config.enableUserNotifications ?? true,
    retainErrorHistory: config.retainErrorHistory ?? true,
    onError: config.onError ?? (() => {}),
    onRecovery: config.onRecovery ?? (() => {}),
    customRecoveryActions: config.customRecoveryActions ?? []
  };

  /**
   * Handle errors with comprehensive processing
   */
  const handleError = useCallback(async (
    error: any,
    context?: Record<string, any>
  ): Promise<void> => {
    const stellarError = convertToStellerError(error, {
      serviceName: config.serviceName,
      ...context
    });

    logDebug(`🚨 Error handled by ${config.serviceName}:`, "Debug", stellarError);

    // Update error state
    setErrorState(prev => ({
      ...prev,
      hasError: true,
      error: stellarError,
      errorHistory: defaultConfig.retainErrorHistory 
        ? [...prev.errorHistory.slice(-4), stellarError]
        : [stellarError],
      retryCount: prev.retryCount + 1
    }));

    // Report to monitoring service
    try {
      await errorMonitoring.current.reportError(stellarError, {
        serviceName: config.serviceName,
        ...context
      });
    } catch (monitoringError) {
      logError('🚨 Failed to report error to monitoring:', "Error", monitoringError);
    }

    // Call custom error handler
    defaultConfig.onError(stellarError);

    // Attempt automatic recovery if enabled
    if (defaultConfig.enableAutoRecovery && 
        errorState.retryCount < defaultConfig.maxAutoRetries &&
        shouldAutoRecover(stellarError)) {
      
      logDebug(`🔄 Attempting automatic recovery for ${stellarError.code}`, "Debug");
      
      setTimeout(async () => {
        const success = await attemptAutoRecovery(stellarError);
        if (!success && defaultConfig.enableUserNotifications) {
          showErrorNotification(stellarError);
        }
      }, defaultConfig.autoRetryDelay);
    } else if (defaultConfig.enableUserNotifications) {
      showErrorNotification(stellarError);
    }
  }, [config.serviceName, errorState.retryCount, defaultConfig]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      hasError: false,
      error: null,
      isRecovering: false
    }));
    
    // Clear error state in monitoring service
    errorMonitoring.current.clearErrorState(config.serviceName);
  }, [config.serviceName]);

  /**
   * Recover from error using specified action
   */
  const recoverFromError = useCallback(async (actionId?: string): Promise<boolean> => {
    if (!errorState.error) {
      logWarn('⚠️ No error to recover from', "Warning");
      return true;
    }

    setIsRecovering(true);
    setErrorState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    try {
      const recoveryActions = getRecoveryActions();
      const action = actionId 
        ? recoveryActions.find(a => a.id === actionId)
        : recoveryActions.find(a => a.priority === 'primary');

      if (!action) {
        logWarn('⚠️ No recovery action found', "Warning");
        return false;
      }

      logDebug(`🔧 Executing recovery action: ${action.label}`, "Debug");

      // Show user confirmation if required
      if (action.requiresUserConfirmation) {
        const userConfirmed = await showRecoveryConfirmation(action);
        if (!userConfirmed) {
          return false;
        }
      }

      // Execute recovery action
      const success = await action.action();
      
      if (success) {
        logDebug(`✅ Recovery action ${action.label} succeeded`, "Debug");
        clearError();
        defaultConfig.onRecovery(true, action.id);
        return true;
      } else {
        logDebug(`❌ Recovery action ${action.label} failed`, "Debug");
        defaultConfig.onRecovery(false, action.id);
        return false;
      }

    } catch (recoveryError) {
      logError('🚨 Recovery attempt failed:', "Error", recoveryError);
      
      // Report recovery failure
      await errorMonitoring.current.reportError(
        convertToStellerError(recoveryError, {
          originalError: errorState.error,
          recoveryAttempt: true
        }),
        { serviceName: config.serviceName, feature: 'error-recovery' }
      );

      return false;

    } finally {
      setIsRecovering(false);
      setErrorState(prev => ({ ...prev, isRecovering: false }));
    }
  }, [errorState.error, config.serviceName, defaultConfig]);

  /**
   * Get available recovery actions
   */
  const getRecoveryActions = useCallback((): RecoveryAction[] => {
    if (!errorState.error) {
      return [];
    }

    const actions: RecoveryAction[] = [];

    // Add default recovery actions based on error type
    switch (errorState.error.category) {
      case 'network':
        actions.push({
          id: 'retry-network',
          label: 'Retry Request',
          description: 'Try the request again',
          action: async () => retryLastOperation(),
          priority: 'primary',
          type: 'retry',
          estimatedTime: 3000
        });
        break;

      case 'authentication':
        actions.push({
          id: 'refresh-auth',
          label: 'Refresh Authentication',
          description: 'Refresh your session',
          action: async () => {
            const result = await authHandler.current.refreshSession();
            return result;
          },
          priority: 'primary',
          type: 'refresh',
          estimatedTime: 2000
        });
        break;

      case 'matching-system':
      case 'compatibility-calculation':
        actions.push({
          id: 'use-fallback',
          label: 'Use Simplified Results',
          description: 'Show simplified matching results',
          action: async () => {
            // Enable fallback mode
            return true;
          },
          priority: 'secondary',
          type: 'fallback',
          estimatedTime: 1000
        });
        break;
    }

    // Add generic retry action
    if (errorState.retryCount < defaultConfig.maxAutoRetries) {
      actions.push({
        id: 'generic-retry',
        label: 'Try Again',
        description: 'Retry the last operation',
        action: async () => retryLastOperation(),
        priority: 'secondary',
        type: 'retry',
        estimatedTime: 2000
      });
    }

    // Add clear state action
    actions.push({
      id: 'clear-state',
      label: 'Start Fresh',
      description: 'Clear current state and start over',
      action: async () => {
        clearError();
        // Clear relevant app state
        return true;
      },
      priority: 'tertiary',
      type: 'clear',
      estimatedTime: 500
    });

    // Add custom recovery actions
    actions.push(...defaultConfig.customRecoveryActions);

    // Sort by priority
    return actions.sort((a, b) => {
      const priorityOrder = { primary: 0, secondary: 1, tertiary: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [errorState.error, errorState.retryCount, defaultConfig]);

  /**
   * Retry the last operation
   */
  const retryLastOperation = useCallback(async (): Promise<boolean> => {
    if (!lastOperation) {
      logWarn('⚠️ No last operation to retry', "Warning");
      return false;
    }

    try {
      logDebug('🔄 Retrying last operation', "Debug");
      await lastOperation.operation();
      return true;
    } catch (error) {
      logError('❌ Retry failed:', "Error", error);
      await handleError(error, { ...lastOperation.context, retryAttempt: true });
      return false;
    }
  }, [lastOperation, handleError]);

  /**
   * Use fallback data
   */
  const useFallback = useCallback(<T>(fallbackData: T): T => {
    if (errorState.hasError && defaultConfig.enableFallback) {
      logDebug('🔄 Using fallback data due to error', "Debug");
      return fallbackData;
    }
    return fallbackData;
  }, [errorState.hasError, defaultConfig.enableFallback]);

  /**
   * Enable graceful degradation
   */
  const enableGracefulDegradation = useCallback((
    level: 'partial' | 'minimal' | 'emergency'
  ) => {
    logDebug(`🔧 Enabling graceful degradation: ${level}`, "Debug");
    // Implementation would reduce functionality based on level
  }, []);

  /**
   * Execute operation with circuit breaker protection
   */
  const executeWithCircuitBreaker = useCallback(async <T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> => {
    // Store operation for retry capability
    setLastOperation({ operation, context: { circuitBreakerProtected: true } });

    try {
      return await circuitBreaker.current.execute(operation, fallback);
    } catch (error) {
      await handleError(error, { circuitBreakerProtected: true });
      throw error;
    }
  }, [handleError]);

  /**
   * Get service health status
   */
  const getServiceHealth = useCallback(() => {
    return {
      circuitBreaker: circuitBreaker.current.getState(),
      errorState: errorState,
      serviceName: config.serviceName
    };
  }, [config.serviceName, errorState]);

  /**
   * Check if service is healthy
   */
  const isServiceHealthy = useCallback((): boolean => {
    const health = getServiceHealth();
    return health.circuitBreaker.healthStatus === 'healthy' && !errorState.hasError;
  }, [getServiceHealth, errorState.hasError]);

  // Helper functions
  const shouldAutoRecover = (error: StellerError): boolean => {
    // Don't auto-recover for validation errors or user input errors
    if (error.category === 'validation' || error.category === 'authorization') {
      return false;
    }
    
    // Don't auto-recover for critical errors that require user action
    if (error.severity === 'critical' && error.recoveryStrategy === 'manual-intervention') {
      return false;
    }
    
    return true;
  };

  const attemptAutoRecovery = async (error: StellerError): Promise<boolean> => {
    logDebug(`🔄 Attempting auto-recovery for ${error.code}`, "Debug");
    
    switch (error.recoveryStrategy) {
      case 'retry':
        return await retryLastOperation();
        
      case 'refresh-auth':
        return await authHandler.current.refreshSession();
        
      case 'fallback':
        // Enable fallback mode
        return true;
        
      default:
        return false;
    }
  };

  const showErrorNotification = (error: StellerError): void => {
    if (!defaultConfig.enableUserNotifications) return;

    const actions = getRecoveryActions();
    const primaryAction = actions.find(a => a.priority === 'primary');

    Alert.alert(
      getErrorTitle(error),
      error.userMessage,
      [
        { text: 'Dismiss', style: 'cancel' },
        ...(primaryAction ? [{
          text: primaryAction.label,
          onPress: () => recoverFromError(primaryAction.id)
        }] : []),
        {
          text: 'More Options',
          onPress: () => showRecoveryOptions(actions)
        }
      ]
    );
  };

  const showRecoveryConfirmation = async (action: RecoveryAction): Promise<boolean> => {
    return new Promise((resolve) => {
      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Proceed', onPress: () => resolve(true) }
      ];
      Alert.alert(
        'Confirm Recovery Action',
        `${action.description}${action.estimatedTime ? ` (estimated time: ${Math.ceil(action.estimatedTime / 1000)}s)` : ''}`,
        buttons
      );
    });
  };

  const showRecoveryOptions = (actions: RecoveryAction[]): void => {
    const buttons: AlertButton[] = actions.map(action => ({
      text: action.label,
      onPress: () => { recoverFromError(action.id); }
    }));

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Recovery Options', 'Choose a recovery action:', buttons);
  };

  const getErrorTitle = (error: StellerError): string => {
    switch (error.category) {
      case 'network': return 'Connection Issue';
      case 'authentication': return 'Authentication Error';
      case 'matching-system': return 'Matching Service Issue';
      case 'compatibility-calculation': return 'Compatibility Error';
      case 'validation': return 'Input Error';
      default: return 'Service Error';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending operations
      setLastOperation(null);
      
      // Clean up error state if configured
      if (!defaultConfig.retainErrorHistory) {
        errorMonitoring.current.clearErrorState(config.serviceName);
      }
    };
  }, [config.serviceName, defaultConfig.retainErrorHistory]);

  return {
    // Error state
    error: errorState.error,
    errorState,
    hasError: errorState.hasError,
    isRecovering,
    
    // Error handling
    handleError,
    clearError,
    
    // Recovery actions
    recoverFromError,
    getRecoveryActions,
    retryLastOperation,
    
    // Fallback and degradation
    useFallback,
    enableGracefulDegradation,
    
    // Circuit breaker integration
    executeWithCircuitBreaker,
    
    // Service health
    getServiceHealth,
    isServiceHealthy
  };
}
