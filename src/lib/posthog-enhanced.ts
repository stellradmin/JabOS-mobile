import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
// Enhanced PostHog Analytics Configuration for Stellr Production
let PostHog: any = null;
try {
  PostHog = require('posthog-react-native').default;
} catch (error) {
  logWarn('PostHog package not available:', "Warning", error);
}

let isPostHogInitialized = false;
let posthogInstance: any = null;

export const initPostHog = async () => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    if (!apiKey) {
      logWarn('PostHog API key not found, "Warning", analytics will be disabled');
      isPostHogInitialized = false;
      posthogInstance = null;
      return;
    }

    // Check if PostHog is available and has setup method
    if (!PostHog || typeof PostHog.setup !== 'function') {
      logWarn('PostHog setup method not available, "Warning", analytics will be disabled');
      isPostHogInitialized = false;
      posthogInstance = null;
      return;
    }

    await PostHog.setup(apiKey, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      
      // Production optimizations
      flushAt: __DEV__ ? 1 : 20, // Batch events in production
      flushInterval: __DEV__ ? 1000 : 30000, // 30 seconds in production
      
      // Privacy settings
      opt_out_capturing_by_default: false,
      capture_pageviews: false, // We'll manually track screen views
      capture_pageleaves: false,
      
      // Feature flags
      preloadFeatureFlags: true,
      bootstrapFlags: {
        // Default feature flags for Stellr
        'new-matching-algorithm': false,
        'premium-features': false,
        'chat-improvements': false,
        'astrological-matching': true,
        'questionnaire-matching': true,
        'date-night-features': true,
        'push-notifications': true,
      }
    });
    
    posthogInstance = PostHog;
    isPostHogInitialized = true;
    logDebug('Enhanced PostHog initialized successfully', "Debug");
  } catch (error) {
    logWarn('PostHog initialization failed:', "Warning", error);
    isPostHogInitialized = false;
    posthogInstance = null;
  }
};

// Safe PostHog capture function
const safeCapture = (event: string, properties?: Record<string, any>) => {
  try {
    if (isPostHogInitialized && posthogInstance && typeof posthogInstance.capture === 'function') {
      posthogInstance.capture(event, properties);
    } else if (__DEV__) {
      logDebug(`[PostHog Mock] ${event}:`, "Debug", properties);
    }
  } catch (error) {
    if (__DEV__) {
      logWarn('PostHog capture error:', "Warning", error);
    }
    // Silently fail in production to avoid crashes
  }
};

// Dating app specific tracking functions
export const trackUserJourney = {
  // Authentication events
  signupStarted: (method: 'email' | 'google' | 'apple') => {
    safeCapture('signup_started', { 
      method,
      timestamp: new Date().toISOString(),
    });
  },
  
  signupCompleted: (method: 'email' | 'google' | 'apple', duration: number) => {
    safeCapture('signup_completed', { 
      method,
      duration,
      timestamp: new Date().toISOString(),
    });
  },
  
  loginCompleted: (method: 'email' | 'google' | 'apple') => {
    safeCapture('login_completed', { 
      method,
      timestamp: new Date().toISOString(),
    });
  },

  // Onboarding events
  onboardingStarted: () => {
    safeCapture('onboarding_started', {
      timestamp: new Date().toISOString(),
    });
  },
  
  onboardingStepCompleted: (step: string, stepNumber: number, duration: number) => {
    safeCapture('onboarding_step_completed', { 
      step, 
      step_number: stepNumber,
      duration,
      timestamp: new Date().toISOString(),
    });
  },
  
  onboardingCompleted: (totalTime: number, totalSteps: number) => {
    safeCapture('onboarding_completed', { 
      total_time: totalTime,
      total_steps: totalSteps,
      timestamp: new Date().toISOString(),
    });
  },
  
  profileCreated: (data: {
    hasPhoto: boolean;
    bioLength: number;
    hasAstrologyData: boolean;
    questionsAnswered: number;
  }) => {
    safeCapture('profile_created', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  },

  // Matching events
  profileViewed: (targetUserId: string, viewDuration: number, source: 'discover' | 'match_list') => {
    safeCapture('profile_viewed', { 
      target_user_id: targetUserId,
      view_duration: viewDuration,
      source,
      timestamp: new Date().toISOString(),
    });
  },
  
  userApproved: (targetUserId: string, method: 'button' | 'swipe', source: 'discover' | 'suggestions') => {
    safeCapture('user_approved', { 
      target_user_id: targetUserId,
      method,
      source,
      timestamp: new Date().toISOString(),
    });
  },
  
  userRejected: (targetUserId: string, method: 'button' | 'swipe', source: 'discover' | 'suggestions') => {
    safeCapture('user_rejected', { 
      target_user_id: targetUserId,
      method,
      source,
      timestamp: new Date().toISOString(),
    });
  },
  
  matchCreated: (matchUserId: string, compatibilityScore: number, isMutual: boolean) => {
    safeCapture('match_created', { 
      match_user_id: matchUserId,
      compatibility_score: Math.round(compatibilityScore),
      is_mutual: isMutual,
      timestamp: new Date().toISOString(),
    });
  },
  
  compatibilityViewed: (targetUserId: string, scores: {
    overallScore: number;
    questionnaireGrade: string;
    astrologicalGrade: string;
  }) => {
    safeCapture('compatibility_viewed', { 
      target_user_id: targetUserId,
      overall_score: Math.round(scores.overallScore),
      questionnaire_grade: scores.questionnaireGrade,
      astrological_grade: scores.astrologicalGrade,
      timestamp: new Date().toISOString(),
    });
  },

  // Messaging events
  conversationStarted: (matchUserId: string, initiator: 'self' | 'other') => {
    safeCapture('conversation_started', { 
      match_user_id: matchUserId,
      initiator,
      timestamp: new Date().toISOString(),
    });
  },
  
  messageSent: (conversationId: string, data: {
    messageLength: number;
    hasMedia: boolean;
    mediaType?: 'image' | 'video';
    isFirstMessage: boolean;
  }) => {
    safeCapture('message_sent', { 
      conversation_id: conversationId,
      message_length: data.messageLength,
      has_media: data.hasMedia,
      media_type: data.mediaType,
      is_first_message: data.isFirstMessage,
      timestamp: new Date().toISOString(),
    });
  },
  
  dateProposed: (targetUserId: string, activityType: string, location?: string) => {
    safeCapture('date_proposed', { 
      target_user_id: targetUserId,
      activity_type: activityType,
      has_location: !!location,
      timestamp: new Date().toISOString(),
    });
  },
  
  dateAccepted: (proposerId: string, activityType: string) => {
    safeCapture('date_accepted', { 
      proposer_id: proposerId,
      activity_type: activityType,
      timestamp: new Date().toISOString(),
    });
  },

  // Subscription events
  subscriptionViewed: (plan: string, source: string, price: number) => {
    safeCapture('subscription_viewed', { 
      plan, 
      source,
      price,
      timestamp: new Date().toISOString(),
    });
  },
  
  subscriptionStarted: (plan: string, price: number) => {
    safeCapture('subscription_started', { 
      plan, 
      price,
      timestamp: new Date().toISOString(),
    });
  },
  
  subscriptionCompleted: (plan: string, price: number, duration: number) => {
    safeCapture('subscription_completed', { 
      plan, 
      price,
      purchase_duration: duration,
      timestamp: new Date().toISOString(),
    });
  },
  
  subscriptionCancelled: (plan: string, reason?: string) => {
    safeCapture('subscription_cancelled', { 
      plan,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  // Performance events
  appLaunched: (launchTime: number, isFirstLaunch: boolean, isColdStart: boolean) => {
    safeCapture('app_launched', { 
      launch_time: launchTime,
      is_first_launch: isFirstLaunch,
      is_cold_start: isColdStart,
      timestamp: new Date().toISOString(),
    });
  },
  
  screenLoaded: (screenName: string, loadTime: number, cacheHit: boolean = false) => {
    safeCapture('screen_loaded', { 
      screen_name: screenName,
      load_time: loadTime,
      cache_hit: cacheHit,
      timestamp: new Date().toISOString(),
    });
  },
  
  apiError: (endpoint: string, errorCode: number, errorMessage: string, duration: number) => {
    safeCapture('api_error', { 
      endpoint,
      error_code: errorCode,
      error_message: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
    });
  },

  // Engagement events
  appBackgrounded: (sessionDuration: number) => {
    safeCapture('app_backgrounded', { 
      session_duration: sessionDuration,
      timestamp: new Date().toISOString(),
    });
  },
  
  featureUsed: (featureName: string, context?: Record<string, any>) => {
    safeCapture('feature_used', { 
      feature_name: featureName,
      ...context,
      timestamp: new Date().toISOString(),
    });
  },
  
  searchPerformed: (query: string, resultsCount: number, filters?: Record<string, any>) => {
    safeCapture('search_performed', { 
      query_length: query.length,
      results_count: resultsCount,
      filters,
      timestamp: new Date().toISOString(),
    });
  },

  // Settings and preferences
  settingsChanged: (setting: string, oldValue: any, newValue: any) => {
    safeCapture('settings_changed', { 
      setting,
      old_value: oldValue,
      new_value: newValue,
      timestamp: new Date().toISOString(),
    });
  },
  
  notificationPermissionChanged: (granted: boolean, type: 'push' | 'email') => {
    safeCapture('notification_permission_changed', { 
      granted,
      type,
      timestamp: new Date().toISOString(),
    });
  },
};

// User properties
export const setUserProperties = (properties: {
  age?: number;
  gender?: string;
  location?: string;
  subscriptionStatus?: string;
  onboardingCompleted?: boolean;
  profilePhotoCount?: number;
  totalMatches?: number;
  totalMessages?: number;
  totalDateProposals?: number;
  registrationDate?: string;
  lastActiveDate?: string;
}) => {
  try {
    if (isPostHogInitialized && posthogInstance && typeof posthogInstance.setPersonProperties === 'function') {
      posthogInstance.setPersonProperties({
        ...properties,
        last_updated: new Date().toISOString(),
      });
    } else if (__DEV__) {
      logDebug('[PostHog Mock] setPersonProperties:', "Debug", properties);
    }
  } catch (error) {
    if (__DEV__) {
      logWarn('PostHog setPersonProperties error:', "Warning", error);
    }
    // Silently fail in production
  }
};

// Feature flags
export const getFeatureFlag = (flagName: string): boolean => {
  try {
    if (isPostHogInitialized && posthogInstance && typeof posthogInstance.isFeatureEnabled === 'function') {
      return posthogInstance.isFeatureEnabled(flagName);
    } else {
      if (__DEV__) {
        logDebug(`[PostHog Mock] getFeatureFlag(${flagName}, "Debug"): false`);
      }
      return false;
    }
  } catch (error) {
    if (__DEV__) {
      logWarn('PostHog getFeatureFlag error:', "Warning", error);
    }
    return false;
  }
};

export const trackFeatureFlagUsage = (flagName: string, enabled: boolean, context?: Record<string, any>) => {
  safeCapture('feature_flag_used', { 
    flag_name: flagName,
    enabled,
    ...context,
    timestamp: new Date().toISOString(),
  });
};

// Funnel analysis helpers
export const trackFunnelStep = (funnelName: string, step: string, stepNumber: number, data?: Record<string, any>) => {
  safeCapture(`funnel_${funnelName}_${step}`, { 
    funnel_name: funnelName,
    step_name: step,
    step_number: stepNumber,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// A/B Testing helpers
export const trackExperiment = (experimentName: string, variant: string, outcome?: string) => {
  safeCapture('experiment_exposure', { 
    experiment_name: experimentName,
    variant,
    outcome,
    timestamp: new Date().toISOString(),
  });
};

// Revenue tracking
export const trackRevenue = (amount: number, currency: string, source: string, metadata?: Record<string, any>) => {
  safeCapture('revenue_generated', { 
    amount,
    currency,
    source,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

export const captureAnalyticsEvent = (event: string, properties?: Record<string, any>) => {
  safeCapture(event, properties);
};

export const identifyAnalyticsUser = (userId: string, properties?: Record<string, any>) => {
  try {
    if (isPostHogInitialized && posthogInstance && typeof posthogInstance.identify === 'function') {
      posthogInstance.identify(userId, { ...properties });
    } else if (__DEV__) {
      logDebug(`[PostHog Mock] identify ${userId}`, 'Debug', properties);
    }
  } catch (error) {
    if (__DEV__) {
      logWarn('PostHog identify error:', 'Warning', error);
    }
  }
};

export const resetAnalyticsIdentity = () => {
  try {
    if (isPostHogInitialized && posthogInstance && typeof posthogInstance.reset === 'function') {
      posthogInstance.reset();
    } else if (__DEV__) {
      logDebug('[PostHog Mock] reset identity', 'Debug');
    }
  } catch (error) {
    if (__DEV__) {
      logWarn('PostHog reset error:', 'Warning', error);
    }
  }
};
