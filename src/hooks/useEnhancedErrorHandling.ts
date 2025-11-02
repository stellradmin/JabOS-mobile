/**
 * Enhanced Error Handling Hook
 * Provides a unified interface for error handling across all app contexts
 * Integrates all error handling services into a single, easy-to-use hook
 */

import { useCallback, useEffect, useState } from 'react';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import ErrorRecoveryService from '../services/ErrorRecoveryService';
import NetworkResilienceService from '../services/NetworkResilienceService';
import ErrorAnalyticsService, { UserJourneyStage, FeatureContext } from '../services/ErrorAnalyticsService';
import { StellerError, ErrorCategory, ErrorSeverity, RecoveryStrategy } from '../types/error-types';
import { ERROR_CODES, ERROR_MESSAGES, ERROR_RECOVERY_STRATEGIES, ERROR_SEVERITIES } from '../types/error-types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Hook configuration options
interface ErrorHandlingOptions {
  autoRetry?: boolean;
  maxRetries?: number;
  enableAnalytics?: boolean;
  enableNetworkQueue?: boolean;
  userJourneyStage?: UserJourneyStage;
  featureContext?: Partial<FeatureContext>;
  onError?: (error: StellerError) => void;
  onRecovery?: (success: boolean, result?: any) => void;
}

// Hook return interface
interface UseEnhancedErrorHandlingReturn {
  // Error state
  errors: StellerError[];
  hasErrors: boolean;
  isRecovering: boolean;
  networkState: any;
  
  // Error handling methods
  handleError: (error: Error | StellerError, context?: Record<string, any>) => Promise<string>;
  handleAsyncOperation: <T>(
    operation: () => Promise<T>,
    context?: {
      category?: ErrorCategory;
      fallbackValue?: T;
      retryOptions?: { maxRetries?: number; delay?: number };
    }
  ) => Promise<T | undefined>;
  
  // Recovery methods
  attemptRecovery: (errorId: string) => Promise<boolean>;
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;
  
  // Network-aware operations
  queueIfOffline: <T>(
    operation: () => Promise<T>,
    priority?: 'low' | 'medium' | 'high' | 'critical'
  ) => Promise<T | string>; // Returns result or queue ID
  
  // Utility methods
  createStellerError: (
    message: string,
    category: ErrorCategory,
    severity?: ErrorSeverity,
    code?: string
  ) => StellerError;
  isNetworkError: (error: Error) => boolean;
  getErrorMessage: (error: Error | StellerError) => string;
}

/**
 * Enhanced Error Handling Hook
 * Provides comprehensive error handling capabilities for React components
 */
export const useEnhancedErrorHandling = (
  options: ErrorHandlingOptions = {}
): UseEnhancedErrorHandlingReturn => {
  const globalError = useGlobalError();
  const [isRecovering, setIsRecovering] = useState(false);
  
  // Get service instances
  const recoveryService = ErrorRecoveryService.getInstance();
  const networkService = NetworkResilienceService.getInstance();
  const analyticsService = ErrorAnalyticsService.getInstance();

  // Default configuration
  const config = {
    autoRetry: options.autoRetry ?? true,
    maxRetries: options.maxRetries ?? 3,
    enableAnalytics: options.enableAnalytics ?? true,
    enableNetworkQueue: options.enableNetworkQueue ?? true,
    userJourneyStage: options.userJourneyStage ?? 'discovery',
    featureContext: {
      feature: 'unknown',
      ...options.featureContext,
    },
  };

  /**
   * Create a standardized StellerError from various error types
   */
  const createStellerError = useCallback((
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = 'medium',
    code?: string
  ): StellerError => {
    const errorCode = code || `${category.toUpperCase()}_ERROR`;
    const timestamp = new Date().toISOString();
    const errorId = `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: errorId,
      code: errorCode,
      message,
      category,
      severity,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES[errorCode as keyof typeof ERROR_RECOVERY_STRATEGIES] || 'retry',
      timestamp,
      userMessage: ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES] || message,
      context: {
        journey_stage: config.userJourneyStage,
        feature_context: config.featureContext,
        timestamp,
      },
    };
  }, [config.userJourneyStage, config.featureContext]);

  /**
   * Convert regular Error to StellerError with intelligent categorization
   */
  const convertToStellerError = useCallback((error: Error, context?: Record<string, any>): StellerError => {
    if ('id' in error && 'category' in error) {
      return error as StellerError;
    }

    const category = categorizeError(error);
    const severity = determineSeverity(error, category);
    const code = determineErrorCode(error, category);

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      code,
      message: error.message,
      category,
      severity,
      recoveryStrategy: ERROR_RECOVERY_STRATEGIES[code as keyof typeof ERROR_RECOVERY_STRATEGIES] || 'retry',
      timestamp: new Date().toISOString(),
      userMessage: ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || error.message,
      context: {
        ...context,
        stack: error.stack,
        original_error: error.constructor.name,
      },
    };
  }, []);

  /**
   * Main error handling method
   */
  const handleError = useCallback(async (
    error: Error | StellerError,
    context?: Record<string, any>
  ): Promise<string> => {
    try {
      // Convert to StellerError if needed
      const stellerError = 'id' in error 
        ? error as StellerError
        : convertToStellerError(error, context);

      // Add to global error state
      globalError.addError(stellerError);

      // Track with analytics if enabled
      if (config.enableAnalytics) {
        await analyticsService.trackErrorWithAnalytics(stellerError, {
          userJourneyStage: config.userJourneyStage,
          featureContext: config.featureContext as FeatureContext,
          customMetrics: context,
        });
      }

      // Call custom error handler
      if (options.onError) {
        options.onError(stellerError);
      }

      // Attempt auto-recovery if enabled
      if (config.autoRetry && stellerError.recoveryStrategy !== 'manual-intervention') {
        setTimeout(async () => {
          const success = await attemptRecovery(stellerError.id);
          if (options.onRecovery) {
            options.onRecovery(success);
          }
        }, 1000);
      }

      return stellerError.id;

    } catch (handlingError) {
      logError('Failed to handle error:', "Error", handlingError);
      return 'error_handling_failed';
    }
  }, [globalError, analyticsService, config, options, convertToStellerError]);

  /**
   * Handle async operations with comprehensive error handling
   */
  const handleAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: {
      category?: ErrorCategory;
      fallbackValue?: T;
      retryOptions?: { maxRetries?: number; delay?: number };
    }
  ): Promise<T | undefined> => {
    const maxRetries = context?.retryOptions?.maxRetries ?? config.maxRetries;
    const retryDelay = context?.retryOptions?.delay ?? 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt) {
          // Handle the error on final failure
          await handleError(error as Error, {
            category: context?.category,
            attempt_number: attempt + 1,
            max_retries: maxRetries,
            operation_context: 'async_operation',
          });
          
          return context?.fallbackValue;
        }

        // Wait before retry (with exponential backoff)
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return context?.fallbackValue;
  }, [config.maxRetries, handleError]);

  /**
   * Attempt error recovery
   */
  const attemptRecovery = useCallback(async (errorId: string): Promise<boolean> => {
    setIsRecovering(true);
    
    try {
      const success = await globalError.attemptRecovery(errorId);
      
      // Track recovery attempt
      if (config.enableAnalytics) {
        const error = globalError.getErrorById(errorId);
        if (error) {
          await analyticsService.trackRecoveryCompletion(errorId, success);
        }
      }
      
      return success;

    } finally {
      setIsRecovering(false);
    }
  }, [globalError, analyticsService, config.enableAnalytics]);

  /**
   * Queue operation for offline execution
   */
  const queueIfOffline = useCallback(async <T>(
    operation: () => Promise<T>,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<T | string> => {
    const networkState = globalError.getNetworkState();
    
    if (networkState.isConnected) {
      // Execute immediately if online
      try {
        return await operation();
      } catch (error) {
        await handleError(error as Error, { operation_type: 'immediate' });
        throw error;
      }
    } else {
      // Queue for later execution if offline
      if (config.enableNetworkQueue) {
        try {
          // This is a simplified example - in practice, you'd need to serialize the operation
          const queueId = await networkService.queueRequest({
            url: 'placeholder_url', // Would be extracted from operation
            method: 'POST',
            priority,
            category: 'general',
            maxRetries: config.maxRetries,
          });
          
          return queueId;
        } catch (error) {
          await handleError(error as Error, { operation_type: 'queue' });
          throw error;
        }
      } else {
        const offlineError = createStellerError(
          'Operation requires internet connection',
          'network',
          'medium',
          'NETWORK_OFFLINE'
        );
        await handleError(offlineError);
        throw new Error(offlineError.userMessage);
      }
    }
  }, [globalError, networkService, config, createStellerError, handleError]);

  /**
   * Utility to check if an error is network-related
   */
  const isNetworkError = useCallback((error: Error): boolean => {
    const networkIndicators = [
      'network',
      'fetch',
      'timeout',
      'connection',
      'offline',
      'unreachable',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ];

    return networkIndicators.some(indicator => 
      error.message.toLowerCase().includes(indicator) ||
      error.name.toLowerCase().includes(indicator)
    );
  }, []);

  /**
   * Get user-friendly error message
   */
  const getErrorMessage = useCallback((error: Error | StellerError): string => {
    if ('userMessage' in error) {
      return error.userMessage;
    }

    // Try to match against known error codes
    const errorCode = Object.keys(ERROR_MESSAGES).find(code => 
      error.message.toLowerCase().includes(code.toLowerCase().replace(/_/g, ' '))
    );

    if (errorCode) {
      return ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES];
    }

    return error.message || 'An unexpected error occurred';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending recovery operations
      setIsRecovering(false);
    };
  }, []);

  return {
    // State
    errors: Array.from(globalError.state.errors.values()),
    hasErrors: globalError.hasError(),
    isRecovering: isRecovering || globalError.state.isRecovering,
    networkState: globalError.getNetworkState(),

    // Methods
    handleError,
    handleAsyncOperation,
    attemptRecovery,
    clearError: globalError.removeError,
    clearAllErrors: globalError.clearAllErrors,
    queueIfOffline,
    createStellerError,
    isNetworkError,
    getErrorMessage,
  };
};

// Helper functions for error categorization
function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (message.includes('network') || message.includes('fetch') || name.includes('networkerror')) {
    return 'network';
  }
  
  if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
    return 'authentication';
  }
  
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  
  if (message.includes('parse') || message.includes('json') || name.includes('syntaxerror')) {
    return 'data-parsing';
  }
  
  if (message.includes('timeout') || message.includes('abort')) {
    return 'performance';
  }

  return 'unknown';
}

function determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
  // Critical categories
  if (['authentication', 'database', 'matching-system'].includes(category)) {
    return 'high';
  }
  
  // Network errors are usually medium unless they indicate complete failure
  if (category === 'network') {
    return error.message.toLowerCase().includes('offline') ? 'high' : 'medium';
  }
  
  // Performance errors can be critical if they indicate resource exhaustion
  if (category === 'performance') {
    return error.message.toLowerCase().includes('memory') ? 'critical' : 'medium';
  }
  
  // Validation errors are usually low severity
  if (category === 'validation') {
    return 'low';
  }
  
  return 'medium';
}

function determineErrorCode(error: Error, category: ErrorCategory): string {
  const message = error.message.toLowerCase();
  
  // Map common error patterns to codes
  if (category === 'network') {
    if (message.includes('offline')) return 'NETWORK_OFFLINE';
    if (message.includes('timeout')) return 'NETWORK_TIMEOUT';
    return 'NETWORK_FAILED';
  }
  
  if (category === 'authentication') {
    if (message.includes('expired')) return 'AUTH_TOKEN_EXPIRED';
    if (message.includes('invalid')) return 'AUTH_TOKEN_INVALID';
    return 'AUTH_CREDENTIALS_INVALID';
  }
  
  if (category === 'validation') {
    if (message.includes('required')) return 'VALIDATION_REQUIRED_FIELD';
    if (message.includes('format')) return 'VALIDATION_INVALID_FORMAT';
    return 'VALIDATION_REQUIRED_FIELD';
  }
  
  return 'UNKNOWN_ERROR';
}

export default useEnhancedErrorHandling;
