/**
 * Global Error State Management Context
 * Provides centralized error state management across the entire application
 * Follows the Context pattern for sharing error state between components
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { StellerError, ErrorState, RecoveryStrategy } from '../types/error-types';
import ErrorRecoveryService, { RecoveryContext } from '../services/ErrorRecoveryService';
import NetworkResilienceService, { NetworkState } from '../services/NetworkResilienceService';
import { trackError, trackCriticalError } from '../lib/sentry-enhanced';
import {
  RecoveryResult,
  ErrorReportContext,
  CustomRecoveryAction,
} from '../types/error-context.types';

// Global error state
interface GlobalErrorState {
  errors: Map<string, StellerError>;
  activeError: StellerError | null;
  recoveryStates: Map<string, ErrorState>;
  networkState: NetworkState;
  lastErrorTimestamp: Date | null;
  errorHistory: StellerError[];
  isRecovering: boolean;
  recoveryAttempts: number;
}

// Error actions
type ErrorAction = 
  | { type: 'ADD_ERROR'; payload: StellerError }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'UPDATE_ERROR'; payload: { id: string; updates: Partial<StellerError> } }
  | { type: 'SET_ACTIVE_ERROR'; payload: StellerError | null }
  | { type: 'START_RECOVERY'; payload: string }
  | { type: 'RECOVERY_SUCCESS'; payload: { id: string; result?: RecoveryResult } }
  | { type: 'RECOVERY_FAILURE'; payload: { id: string; error: Error } }
  | { type: 'UPDATE_NETWORK_STATE'; payload: NetworkState }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'CLEAR_ERROR_HISTORY' }
  | { type: 'INCREMENT_RECOVERY_ATTEMPTS'; payload: string };

// Context interface
interface GlobalErrorContextType {
  // State
  state: GlobalErrorState;
  
  // Error management
  addError: (error: StellerError) => void;
  removeError: (errorId: string) => void;
  updateError: (errorId: string, updates: Partial<StellerError>) => void;
  setActiveError: (error: StellerError | null) => void;
  clearAllErrors: () => void;
  clearErrorHistory: () => void;
  
  // Recovery management
  attemptRecovery: (errorId: string, customAction?: CustomRecoveryAction) => Promise<boolean>;
  isErrorRecovering: (errorId: string) => boolean;
  getRecoveryAttempts: (errorId: string) => number;
  
  // Utilities
  hasError: (category?: string) => boolean;
  getErrorsByCategory: (category: string) => StellerError[];
  getErrorById: (errorId: string) => StellerError | undefined;
  isNetworkAvailable: () => boolean;
  getNetworkState: () => NetworkState;
  
  // Error reporting
  reportError: (error: StellerError, context?: ErrorReportContext) => void;
}

// Initial state
const initialState: GlobalErrorState = {
  errors: new Map(),
  activeError: null,
  recoveryStates: new Map(),
  networkState: {
    isConnected: false,
    isInternetReachable: false,
    type: 'unknown',
    strength: 'poor',
    timestamp: new Date(),
  },
  lastErrorTimestamp: null,
  errorHistory: [],
  isRecovering: false,
  recoveryAttempts: 0,
};

// Error reducer
function errorReducer(state: GlobalErrorState, action: ErrorAction): GlobalErrorState {
  switch (action.type) {
    case 'ADD_ERROR': {
      const error = action.payload;
      const newErrors = new Map(state.errors);
      newErrors.set(error.id, error);

      const newHistory = [...state.errorHistory, error].slice(-50); // Keep last 50 errors

      // Create recovery state
      const newRecoveryStates = new Map(state.recoveryStates);
      newRecoveryStates.set(error.id, {
        hasError: true,
        error,
        errorHistory: newHistory.filter(e => e.id === error.id),
        retryCount: 0,
        recoveryAttempts: 0,
        isRecovering: false,
      });

      return {
        ...state,
        errors: newErrors,
        activeError: error.severity === 'critical' ? error : state.activeError,
        recoveryStates: newRecoveryStates,
        errorHistory: newHistory,
        lastErrorTimestamp: new Date(),
      };
    }

    case 'REMOVE_ERROR': {
      const errorId = action.payload;
      const newErrors = new Map(state.errors);
      newErrors.delete(errorId);

      const newRecoveryStates = new Map(state.recoveryStates);
      newRecoveryStates.delete(errorId);

      return {
        ...state,
        errors: newErrors,
        recoveryStates: newRecoveryStates,
        activeError: state.activeError?.id === errorId ? null : state.activeError,
      };
    }

    case 'UPDATE_ERROR': {
      const { id, updates } = action.payload;
      const newErrors = new Map(state.errors);
      const existingError = newErrors.get(id);

      if (existingError) {
        newErrors.set(id, { ...existingError, ...updates });
      }

      return {
        ...state,
        errors: newErrors,
      };
    }

    case 'SET_ACTIVE_ERROR': {
      return {
        ...state,
        activeError: action.payload,
      };
    }

    case 'START_RECOVERY': {
      const errorId = action.payload;
      const newRecoveryStates = new Map(state.recoveryStates);
      const recoveryState = newRecoveryStates.get(errorId);

      if (recoveryState) {
        newRecoveryStates.set(errorId, {
          ...recoveryState,
          isRecovering: true,
          recoveryAttempts: recoveryState.recoveryAttempts + 1,
        });
      }

      return {
        ...state,
        recoveryStates: newRecoveryStates,
        isRecovering: true,
        recoveryAttempts: state.recoveryAttempts + 1,
      };
    }

    case 'RECOVERY_SUCCESS': {
      const { id } = action.payload;
      const newRecoveryStates = new Map(state.recoveryStates);
      const recoveryState = newRecoveryStates.get(id);

      if (recoveryState) {
        newRecoveryStates.set(id, {
          ...recoveryState,
          isRecovering: false,
          hasError: false,
          lastRecoveryAction: 'success',
        });
      }

      // Remove error from active errors
      const newErrors = new Map(state.errors);
      newErrors.delete(id);

      return {
        ...state,
        errors: newErrors,
        recoveryStates: newRecoveryStates,
        isRecovering: Array.from(newRecoveryStates.values()).some(s => s.isRecovering),
        activeError: state.activeError?.id === id ? null : state.activeError,
      };
    }

    case 'RECOVERY_FAILURE': {
      const { id } = action.payload;
      const newRecoveryStates = new Map(state.recoveryStates);
      const recoveryState = newRecoveryStates.get(id);

      if (recoveryState) {
        newRecoveryStates.set(id, {
          ...recoveryState,
          isRecovering: false,
          retryCount: recoveryState.retryCount + 1,
          lastRecoveryAction: 'failure',
        });
      }

      return {
        ...state,
        recoveryStates: newRecoveryStates,
        isRecovering: Array.from(newRecoveryStates.values()).some(s => s.isRecovering),
      };
    }

    case 'UPDATE_NETWORK_STATE': {
      return {
        ...state,
        networkState: action.payload,
      };
    }

    case 'CLEAR_ALL_ERRORS': {
      return {
        ...state,
        errors: new Map(),
        activeError: null,
        recoveryStates: new Map(),
        isRecovering: false,
      };
    }

    case 'CLEAR_ERROR_HISTORY': {
      return {
        ...state,
        errorHistory: [],
      };
    }

    case 'INCREMENT_RECOVERY_ATTEMPTS': {
      const errorId = action.payload;
      const newRecoveryStates = new Map(state.recoveryStates);
      const recoveryState = newRecoveryStates.get(errorId);

      if (recoveryState) {
        newRecoveryStates.set(errorId, {
          ...recoveryState,
          recoveryAttempts: recoveryState.recoveryAttempts + 1,
        });
      }

      return {
        ...state,
        recoveryStates: newRecoveryStates,
      };
    }

    default:
      return state;
  }
}

// Create context
const GlobalErrorContext = createContext<GlobalErrorContextType | undefined>(undefined);

// Provider component
interface GlobalErrorProviderProps {
  children: ReactNode;
}

export const GlobalErrorProvider: React.FC<GlobalErrorProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(errorReducer, initialState);
  const errorRecoveryService = ErrorRecoveryService.getInstance();
  const networkService = NetworkResilienceService.getInstance();

  // Initialize network monitoring
  useEffect(() => {
    const unsubscribe = networkService.addNetworkStateListener((networkState) => {
      dispatch({ type: 'UPDATE_NETWORK_STATE', payload: networkState });
    });

    return unsubscribe;
  }, [networkService]);

  // Error management functions
  const addError = useCallback((error: StellerError) => {
    dispatch({ type: 'ADD_ERROR', payload: error });
    
    // Track error with Sentry
    if (error.severity === 'critical') {
      trackCriticalError(new Error(error.message), {
        error_id: error.id,
        error_code: error.code,
        error_category: error.category,
        error_context: error.context,
      });
    } else {
      trackError(new Error(error.message), {
        error_id: error.id,
        error_code: error.code,
        error_category: error.category,
        error_severity: error.severity,
        error_context: error.context,
      });
    }
  }, []);

  const removeError = useCallback((errorId: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: errorId });
  }, []);

  const updateError = useCallback((errorId: string, updates: Partial<StellerError>) => {
    dispatch({ type: 'UPDATE_ERROR', payload: { id: errorId, updates } });
  }, []);

  const setActiveError = useCallback((error: StellerError | null) => {
    dispatch({ type: 'SET_ACTIVE_ERROR', payload: error });
  }, []);

  const clearAllErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_ERRORS' });
  }, []);

  const clearErrorHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR_HISTORY' });
  }, []);

  // Recovery management functions
  const attemptRecovery = useCallback(async (
    errorId: string, 
    customAction?: CustomRecoveryAction
  ): Promise<boolean> => {
    const error = state.errors.get(errorId);
    if (!error) {
      return false;
    }

    dispatch({ type: 'START_RECOVERY', payload: errorId });

    try {
      const recoveryContext: RecoveryContext = {
        originalError: error,
        userContext: {
          userId: 'current_user_id', // Would come from auth context
          sessionId: 'current_session_id',
        },
        technicalContext: {
          networkStatus: state.networkState.isConnected ? 'online' : 'offline',
          memoryPressure: 'normal', // Would be determined by system monitoring
        },
        metadata: error.context,
      };

      const result = await errorRecoveryService.attemptRecovery(
        error,
        recoveryContext,
        customAction
      );

      if (result.success) {
        dispatch({ type: 'RECOVERY_SUCCESS', payload: { id: errorId, result: result.result } });
        return true;
      } else {
        dispatch({ type: 'RECOVERY_FAILURE', payload: { id: errorId, error: new Error('Recovery failed') } });
        return false;
      }

    } catch (recoveryError) {
      dispatch({ type: 'RECOVERY_FAILURE', payload: { id: errorId, error: recoveryError as Error } });
      return false;
    }
  }, [state.errors, state.networkState, errorRecoveryService]);

  const isErrorRecovering = useCallback((errorId: string): boolean => {
    const recoveryState = state.recoveryStates.get(errorId);
    return recoveryState?.isRecovering ?? false;
  }, [state.recoveryStates]);

  const getRecoveryAttempts = useCallback((errorId: string): number => {
    const recoveryState = state.recoveryStates.get(errorId);
    return recoveryState?.recoveryAttempts ?? 0;
  }, [state.recoveryStates]);

  // Utility functions
  const hasError = useCallback((category?: string): boolean => {
    if (!category) {
      return state.errors.size > 0;
    }
    
    return Array.from(state.errors.values()).some(error => error.category === category);
  }, [state.errors]);

  const getErrorsByCategory = useCallback((category: string): StellerError[] => {
    return Array.from(state.errors.values()).filter(error => error.category === category);
  }, [state.errors]);

  const getErrorById = useCallback((errorId: string): StellerError | undefined => {
    return state.errors.get(errorId);
  }, [state.errors]);

  const isNetworkAvailable = useCallback((): boolean => {
    return state.networkState.isConnected && state.networkState.isInternetReachable;
  }, [state.networkState]);

  const getNetworkState = useCallback((): NetworkState => {
    return state.networkState;
  }, [state.networkState]);

  const reportError = useCallback((error: StellerError, context?: ErrorReportContext) => {
    const reportContext = {
      error_id: error.id,
      error_code: error.code,
      error_category: error.category,
      error_severity: error.severity,
      recovery_strategy: error.recoveryStrategy,
      network_state: state.networkState,
      active_errors_count: state.errors.size,
      ...error.context,
      ...context,
    };

    if (error.severity === 'critical') {
      trackCriticalError(new Error(error.message), reportContext);
    } else {
      trackError(new Error(error.message), reportContext);
    }
  }, [state.networkState, state.errors.size]);

  // Auto-recovery for network-related errors when connection is restored
  useEffect(() => {
    if (state.networkState.isConnected && state.networkState.isInternetReachable) {
      const networkErrors = getErrorsByCategory('network');
      
      networkErrors.forEach(error => {
        if (!isErrorRecovering(error.id) && getRecoveryAttempts(error.id) < 3) {
          // Auto-retry network errors when connection is restored
          setTimeout(() => {
            attemptRecovery(error.id);
          }, 2000); // Wait 2 seconds before retry
        }
      });
    }
  }, [state.networkState.isConnected, state.networkState.isInternetReachable, getErrorsByCategory, isErrorRecovering, getRecoveryAttempts, attemptRecovery]);

  const contextValue: GlobalErrorContextType = {
    state,
    addError,
    removeError,
    updateError,
    setActiveError,
    clearAllErrors,
    clearErrorHistory,
    attemptRecovery,
    isErrorRecovering,
    getRecoveryAttempts,
    hasError,
    getErrorsByCategory,
    getErrorById,
    isNetworkAvailable,
    getNetworkState,
    reportError,
  };

  return (
    <GlobalErrorContext.Provider value={contextValue}>
      {children}
    </GlobalErrorContext.Provider>
  );
};

// Hook for using the error context
export const useGlobalError = (): GlobalErrorContextType => {
  const context = useContext(GlobalErrorContext);
  
  if (!context) {
    throw new Error('useGlobalError must be used within a GlobalErrorProvider');
  }
  
  return context;
};

// Hook for error-specific functionality
export const useError = (errorId?: string) => {
  const globalError = useGlobalError();
  
  if (!errorId) {
    return {
      error: null,
      isRecovering: false,
      recoveryAttempts: 0,
      attemptRecovery: () => Promise.resolve(false),
      removeError: () => {},
    };
  }

  return {
    error: globalError.getErrorById(errorId),
    isRecovering: globalError.isErrorRecovering(errorId),
    recoveryAttempts: globalError.getRecoveryAttempts(errorId),
    attemptRecovery: (customAction?: CustomRecoveryAction) => globalError.attemptRecovery(errorId, customAction),
    removeError: () => globalError.removeError(errorId),
  };
};

// Hook for network-aware operations
export const useNetworkAwareError = () => {
  const globalError = useGlobalError();
  
  return {
    isOnline: globalError.isNetworkAvailable(),
    networkState: globalError.getNetworkState(),
    hasNetworkErrors: globalError.hasError('network'),
    networkErrors: globalError.getErrorsByCategory('network'),
  };
};

export default GlobalErrorContext;