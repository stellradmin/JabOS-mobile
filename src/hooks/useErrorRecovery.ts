import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { trackCriticalError } from '../lib/sentry-enhanced';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onError?: (error: Error, retryCount: number) => void;
  onMaxRetriesReached?: (error: Error) => void;
  onRecoverySuccess?: (retryCount: number) => void;
}

export interface ErrorRecoveryState {
  isError: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
  canRetry: boolean;
}

export interface ErrorRecoveryActions {
  executeWithRecovery: <T>(
    operation: () => Promise<T>,
    context?: string
  ) => Promise<T | null>;
  retry: () => Promise<void>;
  reset: () => void;
  reportError: (additionalContext?: Record<string, any>) => void;
}

/**
 * Hook for managing error recovery in React components
 * Provides automatic retry logic with exponential backoff
 */
export const useErrorRecovery = (
  options: ErrorRecoveryOptions = {}
): ErrorRecoveryState & ErrorRecoveryActions => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onError,
    onMaxRetriesReached,
    onRecoverySuccess,
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    isError: false,
    error: null,
    retryCount: 0,
    isRetrying: false,
    canRetry: true,
  });

  // Store the last failed operation for retry
  const lastOperationRef = useRef<{
    operation: () => Promise<any>;
    context?: string;
  } | null>(null);

  const reset = useCallback(() => {
    setState({
      isError: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
      canRetry: true,
    });
    lastOperationRef.current = null;
  }, []);

  const calculateRetryDelay = useCallback((retryCount: number): number => {
    if (!exponentialBackoff) return retryDelay;
    return retryDelay * Math.pow(2, retryCount);
  }, [retryDelay, exponentialBackoff]);

  const reportError = useCallback((additionalContext: Record<string, any> = {}) => {
    if (!state.error) return;

    const errorContext = {
      retry_count: state.retryCount,
      max_retries: maxRetries,
      can_retry: state.canRetry,
      timestamp: new Date().toISOString(),
      ...additionalContext,
    };

    trackCriticalError(state.error, errorContext);

    // Log for development
    console.group('🔄 Error Recovery Report');
    logError('Error:', "Error", state.error);
    logDebug('Context:', "Debug", errorContext);
    console.groupEnd();
  }, [state.error, state.retryCount, state.canRetry, maxRetries]);

  const executeWithRecovery = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      setState(prev => ({ ...prev, isRetrying: true, isError: false }));
      
      const result = await operation();
      
      // Success - reset error state and call success callback
      if (state.retryCount > 0 && onRecoverySuccess) {
        onRecoverySuccess(state.retryCount);
      }
      
      setState(prev => ({ 
        ...prev, 
        isRetrying: false, 
        isError: false, 
        error: null 
      }));
      
      return result;
    } catch (error) {
      const err = error as Error;
      
      // Store operation for potential retry
      lastOperationRef.current = { operation, context };
      
      const newRetryCount = state.retryCount;
      const canRetry = newRetryCount < maxRetries;
      
      setState(prev => ({
        ...prev,
        isError: true,
        error: err,
        isRetrying: false,
        canRetry,
      }));

      // Call error callback
      if (onError) {
        onError(err, newRetryCount);
      }

      // Check if we've reached max retries
      if (!canRetry && onMaxRetriesReached) {
        onMaxRetriesReached(err);
      }

      // Log error with context
      logError(`🚨 Operation failed${context ? ` in ${context}` : ''}:`, "Error", err);
      
      return null;
    }
  }, [state.retryCount, maxRetries, onError, onMaxRetriesReached, onRecoverySuccess]);

  const retry = useCallback(async (): Promise<void> => {
    if (!state.canRetry || !lastOperationRef.current) {
      logWarn('Cannot retry: no retryable operation available', "Warning");
      return;
    }

    const { operation, context } = lastOperationRef.current;
    const newRetryCount = state.retryCount + 1;
    
    // Update retry count
    setState(prev => ({ 
      ...prev, 
      retryCount: newRetryCount,
      canRetry: newRetryCount < maxRetries 
    }));

    // Wait for retry delay
    const delay = calculateRetryDelay(newRetryCount - 1);
    if (delay > 0) {
      logDebug(`⏳ Retrying in ${delay}ms (attempt ${newRetryCount}/${maxRetries}, "Debug")`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Retry the operation
    await executeWithRecovery(operation, context);
  }, [state.canRetry, state.retryCount, maxRetries, calculateRetryDelay, executeWithRecovery]);

  return {
    ...state,
    executeWithRecovery,
    retry,
    reset,
    reportError,
  };
};

/**
 * Specialized hook for network operations with common error handling
 */
export const useNetworkErrorRecovery = () => {
  return useErrorRecovery({
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    onError: (error, retryCount) => {
      logDebug(`🌐 Network operation failed (attempt ${retryCount + 1}, "Debug"):`, error.message);
    },
    onMaxRetriesReached: (error) => {
      Alert.alert(
        'Connection Problem',
        'Unable to connect after multiple attempts. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    },
    onRecoverySuccess: (retryCount) => {
      logDebug(`✅ Network operation recovered after ${retryCount} retries`, "Debug");
    },
  });
};

/**
 * Specialized hook for matching system operations
 */
export const useMatchingErrorRecovery = () => {
  return useErrorRecovery({
    maxRetries: 2,
    retryDelay: 500,
    exponentialBackoff: false,
    onError: (error, retryCount) => {
      logDebug(`💕 Matching operation failed (attempt ${retryCount + 1}, "Debug"):`, error.message);
    },
    onMaxRetriesReached: (error) => {
      Alert.alert(
        'Matching System Error',
        'The matching system is experiencing issues. Please try again later.',
        [{ text: 'OK' }]
      );
    },
  });
};

/**
 * Specialized hook for UI component errors with immediate feedback
 */
export const useUIErrorRecovery = () => {
  return useErrorRecovery({
    maxRetries: 1,
    retryDelay: 0,
    exponentialBackoff: false,
    onError: (error, retryCount) => {
      logDebug(`🎨 UI component error:`, "Debug", error.message);
    },
    onMaxRetriesReached: (error) => {
      // UI errors usually require user intervention
      logError('UI error could not be recovered:', "Error", error);
    },
  });
};

export default useErrorRecovery;
