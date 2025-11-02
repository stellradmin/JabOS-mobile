import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { PotentialMatchProfile } from '../../components/MatchReceptionContent';
import CompatibilityMatchingService from '../services/compatibility-matching-service';
import {
  createStellerError,
  createNetworkError,
  createMatchingError,
  convertToStellerError
} from '../utils/error-factory';
import { StellerError, ErrorState, ErrorHandlingOptions } from '../types/error-types';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTimers } from '../hooks/useTimers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  CircuitBreakerState,
  LastOperationDetails,
  OperationParams,
  ErrorContext,
} from '../types/potential-match.types';

interface PotentialMatchContextType {
  currentPotentialMatch: PotentialMatchProfile | null;
  isLoading: boolean;
  error: StellerError | null;
  errorState: ErrorState;
  startFetchingPotentialMatches: (matchRequestId: string) => void;
  acceptCurrentPotentialMatch: () => Promise<void>;
  declineCurrentPotentialMatch: () => void;
  activeMatchRequestId: string | null;
  // Enhanced error handling methods
  retryLastOperation: () => Promise<void>;
  clearError: () => void;
  recoverFromError: () => Promise<void>;
  getCircuitBreakerState: () => CircuitBreakerState;
}

const PotentialMatchContext = createContext<PotentialMatchContextType | undefined>(undefined);

export const usePotentialMatch = () => {
  const context = useContext(PotentialMatchContext);
  if (!context) {
    throw new Error('usePotentialMatch must be used within a PotentialMatchProvider');
  }
  return context;
};

interface PotentialMatchProviderProps {
  children: ReactNode;
}

const MATCH_PRESENTATION_DELAY = 3 * 60 * 1000; // 3 minutes

// Enhanced circuit breaker for context operations
class ContextCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold = 3;
  private readonly timeout = 30000; // 30 seconds

  async execute<T>(operation: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        if (fallback) {
          logDebug('🔄 Context circuit breaker open, "Debug", using fallback');
          return fallback();
        }
        throw createStellerError('EXTERNAL_SERVICE_UNAVAILABLE', 
          'Matching service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      threshold: this.threshold,
      timeout: this.timeout
    };
  }
}

const PotentialMatchProviderBase: React.FC<PotentialMatchProviderProps> = ({ children }) => {
  const router = useRouter();
  const [matchQueue, setMatchQueue] = useState<PotentialMatchProfile[]>([]);
  const [currentPotentialMatch, setCurrentPotentialMatch] = useState<PotentialMatchProfile | null>(null);
  const [activeMatchRequestId, setActiveMatchRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false); // For accept/decline
  const { createTimeout, clearTimer, clearAllTimers } = useTimers();
  
  // Enhanced error state management
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorHistory: [],
    retryCount: 0,
    recoveryAttempts: 0,
    isRecovering: false
  });

  // Circuit breaker instance
  const [circuitBreaker] = useState(() => new ContextCircuitBreaker());
  
  // Last operation details for retry functionality
  const [lastOperation, setLastOperation] = useState<LastOperationDetails | null>(null);

  // Enhanced error handling utilities
  const handleError = useCallback((error: unknown, context?: ErrorContext) => {
    const stellarError = convertToStellerError(error, context);
    
    setErrorState(prev => ({
      ...prev,
      hasError: true,
      error: stellarError,
      errorHistory: [...prev.errorHistory.slice(-4), stellarError], // Keep last 5 errors
      retryCount: prev.retryCount + 1
    }));

    logError('🚨 PotentialMatchContext error:', "Error", {
      error: stellarError,
      context,
      timestamp: new Date().toISOString()
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      hasError: false,
      error: null,
      isRecovering: false
    }));
  }, []);

  const retryLastOperation = useCallback(async () => {
    if (!lastOperation) {
      logWarn('⚠️ No last operation to retry', "Warning");
      return;
    }

    logDebug('🔄 Retrying last operation:', "Debug", lastOperation);
    setErrorState(prev => ({ ...prev, isRecovering: true }));

    try {
      switch (lastOperation.type) {
        case 'fetch':
          if (!lastOperation.params.matchRequestId) {
            logWarn('⚠️ Missing matchRequestId for retry', "Warning");
            break;
          }
          await startFetchingPotentialMatches(lastOperation.params.matchRequestId);
          break;
        case 'accept':
          await acceptCurrentPotentialMatch();
          break;
        case 'decline':
          declineCurrentPotentialMatch();
          break;
        default:
          logWarn('⚠️ Unknown operation type for retry:', "Warning", lastOperation.type);
      }
      
      clearError();
    } catch (error) {
      handleError(error, { operation: lastOperation.type, metadata: { retryAttempt: true } });
    } finally {
      setErrorState(prev => ({ ...prev, isRecovering: false }));
    }
  }, [lastOperation]);

  const recoverFromError = useCallback(async () => {
    logDebug('🔧 Attempting error recovery', "Debug");
    setErrorState(prev => ({ 
      ...prev, 
      isRecovering: true, 
      recoveryAttempts: prev.recoveryAttempts + 1 
    }));

    try {
      // Clear current state
      setCurrentPotentialMatch(null);
      setMatchQueue([]);
      setActiveMatchRequestId(null);
      setIsLoading(false);
      setIsProcessingAction(false);
      
      clearTimer('match_presentation_timer');

      // Reset circuit breaker if needed
      if (circuitBreaker.getState().state === 'open') {
        logDebug('🔄 Resetting circuit breaker', "Debug");
      }

      clearError();
      logDebug('✅ Error recovery completed', "Debug");
    } catch (error) {
      logError('🚨 Error recovery failed:', "Error", error);
      handleError(error, { metadata: { recoveryAttempt: true } });
    } finally {
      setErrorState(prev => ({ ...prev, isRecovering: false }));
    }
  }, [clearTimer, circuitBreaker, clearError, handleError]);

  const getCircuitBreakerState = useCallback(() => {
    return circuitBreaker.getState();
  }, [circuitBreaker]);

  const presentNextMatchFromQueue = useCallback(() => {
    clearTimer('match_presentation_timer');
    setMatchQueue(prevQueue => {
      if (prevQueue.length > 0) {
        const [nextMatch, ...rest] = prevQueue;
        setCurrentPotentialMatch(nextMatch);
        // router.push('/match-reception'); // Or use a modal presentation method
        // For now, we assume MatchReceptionScreen is presented modally by a parent component observing currentPotentialMatch
        logDebug("✅ Presenting potential match:", "Debug", nextMatch.display_name);
        return rest;
      } else {
        setCurrentPotentialMatch(null);
        setActiveMatchRequestId(null); // No more matches for this request
        logDebug("ℹ️ No more potential matches in queue for request:", "Debug", activeMatchRequestId);
        return [];
      }
    });
  }, [activeMatchRequestId, clearTimer]);


  const startFetchingPotentialMatches = useCallback(async (matchRequestId: string) => {
    if (isLoading || activeMatchRequestId === matchRequestId) return; // Already processing or same request

    logDebug("🔄 Starting to fetch potential matches for request:", "Debug", matchRequestId);
    
    // Set last operation for retry capability
    setLastOperation({ type: 'fetch', params: { matchRequestId } });
    
    setIsLoading(true);
    clearError();
    setActiveMatchRequestId(matchRequestId);
    setCurrentPotentialMatch(null); // Clear previous potential match
    setMatchQueue([]); // Clear previous queue
    clearTimer('match_presentation_timer');

    try {
      const fetchedMatches = await circuitBreaker.execute(
        async () => {
          // Get the auth session for authorization header with timeout
          const { data: session, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session?.session?.access_token) {
            throw createStellerError('AUTH_SESSION_EXPIRED', 
              'Authentication session is not available');
          }

          // Create the URL with query parameters for GET request
          const url = new URL(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-potential-matches-optimized`);
          url.searchParams.append('match_request_id', matchRequestId);
          
          // Make API call with timeout protection
          const response = await Promise.race([
            fetch(url.toString(), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session.session.access_token}`,
                'Content-Type': 'application/json',
              },
            }),
            new Promise<never>((_, reject) => {
              const timerId = createTimeout(() => {
                reject(createNetworkError('NETWORK_TIMEOUT', {
                  timeout: true,
                  url: url.toString()
                }, 'Request timeout while fetching potential matches'));
              }, 15000, 'network_request_timeout');
              return timerId;
            })
          ]);
          
          if (!response.ok) {
            if (response.status === 401) {
              throw createStellerError('AUTH_TOKEN_EXPIRED', 
                'Authentication token has expired');
            } else if (response.status === 403) {
              throw createStellerError('AUTH_PERMISSION_DENIED', 
                'Permission denied for fetching matches');
            } else if (response.status >= 500) {
              throw createNetworkError('NETWORK_FAILED', {
                status: response.status,
                statusText: response.statusText,
                url: url.toString()
              }, `Server error: ${response.status}`);
            } else {
              throw createNetworkError('NETWORK_FAILED', {
                status: response.status,
                statusText: response.statusText,
                url: url.toString()
              }, `HTTP error: ${response.status}`);
            }
          }
          
          const data = await response.json();

          // Check if the response contains an error property
          if (data.error) {
            throw createMatchingError('MATCHING_REQUEST_FAILED', {
              matchRequestId
            }, data.error);
          }
          
          return data || [];
        },
        () => {
          // Fallback when circuit breaker is open
          logDebug('⚠️ Circuit breaker open, "Debug", showing cached or empty results');
          return [];
        }
      );
      
      logDebug(`✅ Fetched ${fetchedMatches.length} potential matches for ${matchRequestId}`, "Debug");
      
      if (fetchedMatches.length > 0) {
        setMatchQueue(fetchedMatches);
        // presentNextMatchFromQueue will be called by useEffect watching matchQueue
      } else {
        Alert.alert("No Matches", "No potential matches found for your Date Night request at this time.");
        setActiveMatchRequestId(null);
      }
      
    } catch (e) {
      logError("🚨 Failed to fetch potential matches in context:", "Error", e);
      
      const error = convertToStellerError(e, {
        operation: 'startFetchingPotentialMatches',
        matchRequestId
      });
      
      handleError(error, { 
        operation: 'fetch_potential_matches',
        matchRequestId 
      });
      
      setActiveMatchRequestId(null);
      
      // Show user-friendly error message
      Alert.alert(
        "Unable to Find Matches", 
        error.userMessage || "We're having trouble finding matches right now. Please try again.",
        [
          { text: "Try Again", onPress: () => retryLastOperation() },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, activeMatchRequestId, clearTimer, circuitBreaker, clearError, handleError, retryLastOperation]);

  // Effect to present the first match when queue is populated
  useEffect(() => {
    if (matchQueue.length > 0 && !currentPotentialMatch && !isLoading) {
      presentNextMatchFromQueue();
    }
  }, [matchQueue, currentPotentialMatch, isLoading, presentNextMatchFromQueue]);


  const acceptCurrentPotentialMatch = async () => {
    if (!currentPotentialMatch || !activeMatchRequestId || isProcessingAction) return;

    logDebug("Accepting potential match:", "Debug", currentPotentialMatch.display_name, "for request:", activeMatchRequestId);
    setIsProcessingAction(true);
    setErrorState(prev => ({ ...prev, hasError: false, error: null }));
    try {
      // Use the CompatibilityMatchingService to confirm the match
      const confirmData = await CompatibilityMatchingService.confirmMatch(
        currentPotentialMatch.id,
        activeMatchRequestId || undefined
      );

      if (confirmData && confirmData.success && confirmData.conversation_id) {
        Alert.alert("Match Confirmed!", `You can now chat with ${currentPotentialMatch.display_name}.`);
        setCurrentPotentialMatch(null); // Clear current potential match
        setMatchQueue([]); // Clear queue as request is fulfilled
        clearTimer('match_presentation_timer');
        
        // Record the interaction for tracking
        try {
          await CompatibilityMatchingService.recordMatchInteraction(
            currentPotentialMatch.id,
            'potential_match',
            'interested',
            { match_confirmed: true },
            confirmData.match_id,
            confirmData.conversation_id
          );
        } catch (trackingError) {
          logWarn('Error recording match interaction:', "Warning", trackingError);
          // Don't block the flow for tracking errors
        }
        
        // Navigate to the conversation screen
        router.push({
          pathname: "/conversation", 
          params: { 
            conversation_id: confirmData.conversation_id,
            // Pass additional useful params
            matchedUserId: currentPotentialMatch.id, 
            matchedUserName: currentPotentialMatch.display_name 
          },
        });
        setActiveMatchRequestId(null); // Reset active request ID
      } else {
        throw new Error(confirmData.error || "Failed to confirm match: Invalid response from server.");
      }
    } catch (e: any) {
      logError("Failed to confirm match in context:", "Error", e);
      Alert.alert("Error", e?.message || "Could not confirm match.");
      setErrorState(prev => ({
        ...prev,
        hasError: true,
        error: convertToStellerError(e)
      }));
    } finally {
      setIsProcessingAction(false);
    }
  };

  const declineCurrentPotentialMatch = useCallback(async () => {
    if (!currentPotentialMatch || isProcessingAction) return;
    logDebug("Declining potential match:", "Debug", currentPotentialMatch.display_name);
    
    // Record the decline interaction for tracking
    try {
      await CompatibilityMatchingService.recordMatchInteraction(
        currentPotentialMatch.id,
        'potential_match',
        'not_interested',
        { declined: true },
        undefined,
        undefined
      );
    } catch (trackingError) {
      logWarn('Error recording decline interaction:', "Warning", trackingError);
      // Don't block the flow for tracking errors
    }
    
    setCurrentPotentialMatch(null); // Dismiss current

    if (matchQueue.length > 0) {
      logDebug(`Setting timer for next match presentation (${MATCH_PRESENTATION_DELAY / 1000}s)`, "Debug");
      createTimeout(() => {
        logDebug("Timer elapsed, presenting next match.", "Debug");
        presentNextMatchFromQueue();
      }, MATCH_PRESENTATION_DELAY, 'match_presentation_timer');
    } else {
      Alert.alert("No More Matches", "That was the last potential match for now.");
      setActiveMatchRequestId(null); // No more matches for this request
    }
  }, [currentPotentialMatch, isProcessingAction, matchQueue.length, createTimeout, presentNextMatchFromQueue]);
  
  // Timer cleanup is automatically handled by useTimers hook


  return (
    <PotentialMatchContext.Provider value={{ 
      currentPotentialMatch, 
      isLoading: isLoading || isProcessingAction, 
      error: errorState.error, 
      errorState,
      startFetchingPotentialMatches,
      acceptCurrentPotentialMatch,
      declineCurrentPotentialMatch,
      activeMatchRequestId,
      // Enhanced error handling methods
      retryLastOperation,
      clearError,
      recoverFromError,
      getCircuitBreakerState
    }}>
      {children}
    </PotentialMatchContext.Provider>
  );
};

// Error boundary wrapper for the context
const PotentialMatchContextErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    errorType="context-provider"
    onError={(error, errorInfo) => {
      logError('🚨 PotentialMatchContext Error Boundary caught error:', "Error", {
        error,
        errorInfo,
        timestamp: new Date().toISOString()
      });
    }}
    onRetry={() => {
      logDebug('🔄 PotentialMatchContext Error Boundary retry', "Debug");
    }}
    customMessage="There was an issue with the matching system. Please try refreshing the screen."
  >
    {children}
  </ErrorBoundary>
);

// Export the provider wrapped with error boundary
export const PotentialMatchProvider: React.FC<PotentialMatchProviderProps> = ({ children }) => (
  <PotentialMatchContextErrorBoundary>
    <PotentialMatchProviderBase>{children}</PotentialMatchProviderBase>
  </PotentialMatchContextErrorBoundary>
);
