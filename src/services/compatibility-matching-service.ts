import { supabase } from '../lib/supabase';
import {
  createStellerError,
  createNetworkError,
  createCompatibilityError,
  createMatchingError,
  convertToStellerError,
  createErrorFromResponse
} from '../utils/error-factory';
import { StellerError, ErrorHandlerConfig, ErrorHandlingOptions } from '../types/error-types';
import EnhancedErrorMonitoringService from './enhanced-error-monitoring-service';
import EnhancedAuthErrorHandler from '../utils/enhanced-auth-error-handler';
import { useEnhancedErrorRecovery } from '../hooks/useEnhancedErrorRecovery';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  MatchMetadata,
  BasicProfileData,
  MatchingFilters,
  ScoreValidationResult,
  ValidatedScore,
  ScoreValue,
  isBasicProfileData,
  isValidScore,
} from '../types/compatibility.types';

export interface CompatibilityResult {
  overallScore: number;
  astrological_score: number;
  personality_score: number;
  preference_score: number;
  compatibility_grade: string;
  questionnaire_grade?: string;
  astrological_grade?: string;
  overall_desc?: string;
}

export interface MatchInteraction {
  interaction_type: string;
  interaction_result: string;
  metadata?: MatchMetadata;
  match_id?: string;
  conversation_id?: string;
}

export interface MatchRecommendation {
  id: string;
  display_name: string;
  age?: number;
  interests?: string[];
  traits?: string[];
  compatibility_score?: number;
  photo_urls?: string[];
  bio?: string;
}

// Enhanced service configuration with comprehensive error handling
interface ServiceConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  enableFallback: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Default configuration for different operation types
const DEFAULT_CONFIG: ServiceConfig = {
  timeout: 15000, // 15 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  enableFallback: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000 // 1 minute
};

// Circuit breaker implementation for service reliability
class ServiceCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        if (fallback) {
          logDebug('🔄 Circuit breaker open, "Debug", using fallback');
          return await fallback();
        }
        throw createStellerError('EXTERNAL_SERVICE_UNAVAILABLE', 
          'Service temporarily unavailable due to repeated failures');
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

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Enhanced timeout wrapper with proper cleanup
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(createNetworkError('NETWORK_TIMEOUT', {
        timeout: true,
        url: operation
      }, `Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

// Enhanced retry mechanism with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  operationName: string
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry certain error types
      const stellarError = convertToStellerError(error);
      if (stellarError.category === 'authentication' || 
          stellarError.category === 'authorization' ||
          stellarError.category === 'validation') {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        10000 // Max 10 seconds
      );
      
      logDebug(`⏳ Retrying ${operationName} (attempt ${attempt + 1}/${maxRetries + 1}, "Debug") after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw convertToStellerError(lastError, { 
    operationName, 
    totalAttempts: maxRetries + 1,
    finalAttempt: true 
  });
}

// Service circuit breakers for different operations
const circuitBreakers = {
  compatibility: new ServiceCircuitBreaker(3, 30000),
  matching: new ServiceCircuitBreaker(5, 60000),
  interaction: new ServiceCircuitBreaker(3, 30000)
};

class CompatibilityMatchingService {
  private static errorMonitoring = EnhancedErrorMonitoringService.getInstance();
  private static authHandler = EnhancedAuthErrorHandler.getInstance();
  /**
   * Calculate compatibility between two users using the Supabase RPC function
   * Enhanced with comprehensive error handling, retries, and fallback mechanisms
   */
  static async calculateCompatibility(
    user1Id: string, 
    user2Id: string,
    options: ErrorHandlingOptions = {}
  ): Promise<CompatibilityResult> {
    const operationName = 'calculateCompatibility';
    const startTime = Date.now();
    
    try {
      logDebug('🔄 Calculating compatibility for users:', "Debug", { user1Id, user2Id, timestamp: new Date().toISOString() });
      
      // Validate input parameters
      if (!user1Id || !user2Id) {
        throw createCompatibilityError('COMPATIBILITY_INVALID_PROFILES', {
          user1Id,
          user2Id
        }, 'Invalid user IDs provided for compatibility calculation');
      }

      if (user1Id === user2Id) {
        throw createCompatibilityError('COMPATIBILITY_INVALID_PROFILES', {
          user1Id,
          user2Id
        }, 'Cannot calculate compatibility with the same user');
      }

      // Execute with circuit breaker protection
      const result = await circuitBreakers.compatibility.execute(
        async () => {
          return await retryOperation(
            async () => {
              // Avoid passing Postgrest builders directly; wrap in a real Promise
              type RpcRow = {
                overall_score: number | null;
                astrological_score: number | null;
                questionnaire_score: number | null;
                preference_score: number | null;
                questionnaire_grade?: string | null;
                astrological_grade?: string | null;
                IsMatchRecommended?: boolean | null;
              };
              const rpcPromise = (async () =>
                await supabase
                  .rpc('calculate_compatibility_scores', {
                    user_a_id: user1Id,
                    user_b_id: user2Id,
                  })
                  .single()
              )();
              return await withTimeout(
                rpcPromise as unknown as Promise<{ data: RpcRow | null; error: unknown | null }>,
                DEFAULT_CONFIG.timeout,
                operationName
              );
            },
            DEFAULT_CONFIG.maxRetries,
            DEFAULT_CONFIG.retryDelay,
            operationName
          );
        }
      );

      // Check for RPC errors
      if ((result as any).error) {
        throw createCompatibilityError('COMPATIBILITY_CALCULATION_FAILED', {
          user1Id,
          user2Id,
          calculationType: 'rpc'
        }, `RPC failed: ${(result as any).error.message}`);
      }

      // Handle empty data response
      if (!(result as any).data) {
        logWarn('⚠️ No compatibility data returned, "Warning", using fallback');
        return await this.calculateFallbackCompatibility(user1Id, user2Id);
      }

      // Transform and validate the RPC response
      const data: any = (result as any).data;
      const compatibilityResult: CompatibilityResult = {
        overallScore: this.validateScore(data.overall_score, 50),
        astrological_score: this.validateScore(data.astrological_score, 50),
        personality_score: this.validateScore(data.questionnaire_score, 50),
        preference_score: this.validateScore(data.preference_score, 50),
        compatibility_grade: data.questionnaire_grade || 'C',
        questionnaire_grade: data.questionnaire_grade,
        astrological_grade: data.astrological_grade,
        overall_desc: data.IsMatchRecommended ? 'Recommended' : 'Not Recommended'
      };

      const duration = Date.now() - startTime;
      logDebug('✅ Compatibility calculated successfully:', "Debug", {
        ...compatibilityResult,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      return compatibilityResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const stellarError = convertToStellerError(error, {
        operationName,
        user1Id,
        user2Id,
        duration,
        ...options.metadata
      });

      // Report error to enhanced monitoring service
      await this.errorMonitoring.reportError(stellarError, {
        feature: 'compatibility-calculation',
        service: 'compatibility-matching',
        operation: 'calculateCompatibility',
        userImpact: stellarError.severity,
        context: {
          user1Id,
          user2Id,
          duration,
          circuitBreakerState: circuitBreakers.compatibility.getState()
        }
      }, options);

      logError('🚨 Error in calculateCompatibility:', "Error", {
        error: stellarError,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      // Call custom error handler if provided
      if (options.onError) {
        options.onError(stellarError);
      }

      // Return fallback data if not in silent mode
      if (!options.silent && DEFAULT_CONFIG.enableFallback) {
        logDebug('🔄 Returning fallback compatibility data', "Debug");
        try {
          return await this.calculateFallbackCompatibility(user1Id, user2Id);
        } catch (fallbackError) {
          // Report fallback failure
          await this.errorMonitoring.reportError(
            convertToStellerError(fallbackError, { fallbackAttempt: true }),
            { feature: 'compatibility-fallback' },
            { silent: true }
          );
          throw stellarError; // Throw original error if fallback fails
        }
      }

      // Re-throw error if fallback is disabled or in silent mode
      throw stellarError;
    }
  }

  /**
   * Fallback compatibility calculation using simplified algorithm
   */
  private static async calculateFallbackCompatibility(user1Id: string, user2Id: string): Promise<CompatibilityResult> {
    try {
      // Fetch basic profile data for simple compatibility calculation
      const [user1Profile, user2Profile] = await Promise.all([
        this.getBasicProfileData(user1Id),
        this.getBasicProfileData(user2Id)
      ]);

      // Simple compatibility algorithm based on available data
      let score = 50; // Base score
      let astrologicalGrade = 'C';
      let questionnaireGrade = 'C';

      // Zodiac compatibility boost
      if (user1Profile?.zodiac_sign && user2Profile?.zodiac_sign) {
        if (user1Profile.zodiac_sign === user2Profile.zodiac_sign) {
          score += 20;
          astrologicalGrade = 'A';
        } else {
          score += 10;
          astrologicalGrade = 'B';
        }
      }

      // Age compatibility
      if (user1Profile?.age && user2Profile?.age) {
        const ageDiff = Math.abs(user1Profile.age - user2Profile.age);
        if (ageDiff <= 3) {
          score += 15;
        } else if (ageDiff <= 7) {
          score += 10;
        } else if (ageDiff <= 12) {
          score += 5;
        }
      }

      // Shared interests boost
      if (user1Profile?.interests && user2Profile?.interests) {
        const sharedInterests = user1Profile.interests.filter(
          (interest: string) => user2Profile.interests.includes(interest)
        );
        if (sharedInterests.length > 0) {
          score += Math.min(sharedInterests.length * 5, 20);
          questionnaireGrade = 'B';
        }
      }

      // Cap score at 100
      score = Math.min(score, 100);

      return {
        overallScore: score,
        astrological_score: score * 0.8, // Slightly lower for astrological
        personality_score: score * 0.9, // Slightly lower for personality
        preference_score: score * 0.85, // Slightly lower for preferences
        compatibility_grade: score >= 80 ? 'A' : score >= 65 ? 'B' : 'C',
        questionnaire_grade: questionnaireGrade,
        astrological_grade: astrologicalGrade,
        overall_desc: score >= 70 ? 'Recommended' : 'Not Recommended'
      };

    } catch (error) {
      logError('⚠️ Fallback compatibility calculation failed:', "Error", error);
      
      // Ultimate fallback - return neutral compatibility
      return {
        overallScore: 50,
        astrological_score: 50,
        personality_score: 50,
        preference_score: 50,
        compatibility_grade: 'C',
        questionnaire_grade: 'C',
        astrological_grade: 'C',
        overall_desc: 'Compatibility unknown'
      };
    }
  }

  /**
   * Get basic profile data for fallback calculations
   */
  private static async getBasicProfileData(userId: string): Promise<any> {
    try {
      // Avoid passing Postgrest builders directly; wrap in a real Promise
      type ProfileRow = { zodiac_sign: string | null; age: number | null; interests: string[] | null };
      const profilePromise = (async () =>
        await supabase
          .from('profiles')
          .select('zodiac_sign, age, interests')
          .eq('id', userId)
          .single()
      )();
      const { data, error } = await withTimeout<{ data: ProfileRow | null; error: unknown | null }>(
        profilePromise,
        5000, // 5 second timeout for profile data
        'getBasicProfileData'
      );

      if (error) throw error;
      return data;
    } catch (error) {
      logWarn(`⚠️ Could not fetch profile data for user ${userId}:`, "Warning", error);
      return null;
    }
  }

  /**
   * Validate and sanitize compatibility scores
   */
  private static validateScore(score: any, defaultValue: number): number {
    if (typeof score === 'number' && score >= 0 && score <= 100) {
      return Math.round(score);
    }
    return defaultValue;
  }

  /**
   * Record a match interaction (like, pass, etc.) using the record-swipe Edge Function
   * Enhanced with comprehensive error handling and fallback mechanisms
   */
  static async recordMatchInteraction(
    targetUserId: string, 
    interactionType: string, 
    result: string, 
    metadata?: any,
    matchId?: string,
    conversationId?: string,
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    const operationName = 'recordMatchInteraction';
    const startTime = Date.now();

    try {
      logDebug('🔄 Recording match interaction:', "Debug", {
        targetUserId,
        interactionType,
        result,
        metadata,
        matchId,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Validate input parameters
      if (!targetUserId || !interactionType || !result) {
        throw createMatchingError('MATCHING_REQUEST_FAILED', {
          targetUserId,
          matchType: interactionType
        }, 'Missing required parameters for match interaction');
      }

      // Map our interaction types to swipe types
      const swipeType = result === 'interested' || result === 'like' ? 'like' : 'pass';

      // Execute with circuit breaker protection
      await circuitBreakers.interaction.execute(
        async () => {
          return await retryOperation(
            async () => {
              // Get current session for authorization with timeout
              const { data: session } = await withTimeout(
                supabase.auth.getSession(),
                5000, // 5 second timeout for auth
                'getSession'
              );

              if (!session?.session?.access_token) {
                throw createStellerError('AUTH_SESSION_EXPIRED', 
                  'User session is not available for match interaction recording');
              }

              // Make the API call with timeout protection
              const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
              const response = await withTimeout(
                fetch(`${baseUrl}/functions/v1/record-swipe`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    swiped_id: targetUserId,
                    swipe_type: swipeType
                  })
                }),
                DEFAULT_CONFIG.timeout,
                'record-swipe API call'
              );

              // Handle different response scenarios
              if (!response.ok) {
                if (response.status === 409) {
                  // Duplicate swipe - not an error, just log and continue
                  logDebug('ℹ️ User has already swiped on this profile', "Debug");
                  return { success: true, duplicate: true };
                }

                // Try to get error details from response
                const errorData = await createErrorFromResponse(response, {
                  targetUserId,
                  swipeType,
                  operationName
                });
                throw errorData;
              }

              const data = await response.json();
              
              // Log match creation if it occurred
              if (data.match && data.match.match_created) {
                logDebug('🎉 Match created from swipe:', "Debug", data.match.match_details);
              }

              return data;
            },
            2, // Max 2 retries for interaction recording
            1000, // 1 second base delay
            operationName
          );
        },
        () => {
          // Silent fallback - don't break user flow for tracking failures
          logDebug('⚠️ Circuit breaker open for interactions, "Debug", skipping recording');
          return Promise.resolve({ success: false, skipped: true });
        }
      );

      const duration = Date.now() - startTime;
      logDebug('✅ Match interaction recorded successfully:', "Debug", {
        targetUserId,
        swipeType,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const stellarError = convertToStellerError(error, {
        operationName,
        targetUserId,
        interactionType,
        result,
        duration,
        ...options.metadata
      });

      // Report error to enhanced monitoring service
      await this.errorMonitoring.reportError(stellarError, {
        feature: 'match-interaction',
        service: 'compatibility-matching',
        operation: 'recordMatchInteraction',
        userImpact: 'minor', // Don't break user flow for tracking
        context: {
          targetUserId,
          interactionType,
          result,
          duration,
          circuitBreakerState: circuitBreakers.interaction.getState()
        }
      }, { ...options, silent: true }); // Silent to avoid user notifications

      logError('🚨 Error in recordMatchInteraction:', "Error", {
        error: stellarError,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      // Call custom error handler if provided
      if (options.onError) {
        options.onError(stellarError);
      }

      // Don't re-throw by default - we don't want tracking errors to break the user flow
      // Only throw if explicitly requested in silent mode
      if (options.silent) {
        throw stellarError;
      }

      logWarn('⚠️ Failed to record match interaction, "Warning", continuing anyway');
    }
  }

  /**
   * Get match recommendations based on user preferences and filters
   * Enhanced with comprehensive error handling and circuit breaker protection
   */
  static async getMatchRecommendations(
    userId: string, 
    filters?: any,
    options: ErrorHandlingOptions = {}
  ): Promise<MatchRecommendation[]> {
    const operationName = 'getMatchRecommendations';
    const startTime = Date.now();

    try {
      logDebug('🔄 Getting match recommendations for user:', "Debug", userId, 'with filters:', filters);

      // Execute with circuit breaker protection
      const result = await circuitBreakers.matching.execute(
        async () => {
          return await retryOperation(
            async () => {
              // Get current session with auth error handling
              const { data: session } = await withTimeout(
                supabase.auth.getSession(),
                5000,
                'getSession'
              );

              if (!session?.session?.access_token) {
                // Try to handle auth issues with enhanced auth handler
                const authResult = await this.authHandler.refreshSession();
                if (!authResult) {
                  throw createStellerError('AUTH_SESSION_EXPIRED',
                    'User authentication required for match recommendations');
                }

                // Get updated session after refresh
                const { data: refreshedSession } = await supabase.auth.getSession();
                if (!refreshedSession?.session?.access_token) {
                  throw createStellerError('AUTH_SESSION_EXPIRED',
                    'Unable to refresh user session');
                }
                session.session = refreshedSession.session;
              }

              // Build query parameters from filters
              const url = new URL(`${process.env.EXPO_PUBLIC_SUPABASE_URL as string}/functions/v1/get-potential-matches-optimized`);

              if (filters) {
                if (filters.page) url.searchParams.append('page', filters.page.toString());
                if (filters.pageSize) url.searchParams.append('pageSize', filters.pageSize.toString());
                if (filters.match_request_id) url.searchParams.append('match_request_id', filters.match_request_id);
                if (filters.zodiac_sign) url.searchParams.append('zodiac_sign', filters.zodiac_sign);
                if (filters.activity_type) url.searchParams.append('activity_type', filters.activity_type);
                if (filters.gender_preference) url.searchParams.append('gender_preference', filters.gender_preference);
                if (filters.min_age) url.searchParams.append('min_age', filters.min_age.toString());
                if (filters.max_age) url.searchParams.append('max_age', filters.max_age.toString());
                if (filters.max_distance_km) url.searchParams.append('max_distance_km', filters.max_distance_km.toString());
              }

              // Call the get-potential-matches-optimized Edge Function
              const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${session.session.access_token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }

              const data = await response.json();

              if (data.error) {
                throw new Error(data.error);
              }

              const recommendations: MatchRecommendation[] = (data || []).map((profile: any) => ({
                id: profile.id,
                display_name: profile.display_name,
                age: profile.age,
                interests: profile.interests,
                traits: profile.traits,
                compatibility_score: profile.compatibility_score,
                photo_urls: profile.photo_urls,
                bio: profile.bio
              }));

              logDebug(`Retrieved ${recommendations.length} match recommendations`, "Debug");
              return recommendations;
            },
            DEFAULT_CONFIG.maxRetries,
            DEFAULT_CONFIG.retryDelay,
            operationName
          );
        }
      );

      return result;

    } catch (error) {
      logError('Error in getMatchRecommendations:', "Error", error);
      throw error;
    }
  }

  /**
   * Confirm a match with another user using the confirm-system-match Edge Function
   */
  static async confirmMatch(targetUserId: string, matchRequestId?: string): Promise<{
    success: boolean;
    match_id?: string;
    conversation_id?: string;
    error?: string;
  }> {
    try {
      logDebug('Confirming match with user:', "Debug", targetUserId, 'for request:', matchRequestId);

      // Get current session for authorization
      const { data: session } = await supabase.auth.getSession();
      if (!(session && session.session && session.session.access_token)) {
        throw new Error('User not authenticated');
      }

      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
      const response = await fetch(`${baseUrl}/functions/v1/confirm-system-match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_id: targetUserId,
          source_match_request_id: matchRequestId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        match_id: data.match_id,
        conversation_id: data.conversation_id
      };

    } catch (error) {
      logError('Error in confirmMatch:', "Error", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Respond to a compatibility match (interested / not_interested)
   */
  static async respondToMatch(
    matchId: string,
    response: 'interested' | 'not_interested'
  ): Promise<{ success: boolean; mutual_match?: boolean; error?: string }> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('User not authenticated');
      }

      const baseUrlResp = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
      const resp = await fetch(`${baseUrlResp}/functions/v1/respond-system-match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id: matchId,
          response,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        throw new Error(err.error || `HTTP error! status: ${resp.status}`);
      }

      const data = await resp.json();
      if (data.error) {
        return { success: false, error: data.error };
      }
      return { success: true, mutual_match: !!data.mutual_match };
    } catch (error) {
      logError('Error in respondToMatch:', "Error", error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }
}

export default CompatibilityMatchingService;
