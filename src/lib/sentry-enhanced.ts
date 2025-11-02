// Enhanced Sentry Configuration for Stellr Production
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export const initSentry = () => {
  try {
    Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    
    // Production optimizations
    environment: __DEV__ ? 'development' : 'production',
    // enableInExpoDevelopment removed for type compatibility
    debug: __DEV__,
    
    // Performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
    // advanced flags pruned for type-compat; keep defaults
    
    // Enhanced context
    beforeSend(event, hint) {
      // Add custom context for dating app specific data
      event.contexts = {
        ...event.contexts,
        app: {
          user_onboarding_completed: false, // Will be set dynamically
          subscription_status: 'unknown',
          app_version: process.env.EXPO_PUBLIC_APP_VERSION,
          build_number: process.env.EXPO_PUBLIC_BUILD_NUMBER,
        }
      };
      
      // Filter out sensitive data
      if (event.request && (event.request as any).data) {
        // Remove passwords, tokens, personal data
        const sensitiveFields = ['password', 'token', 'birth_date', 'location', 'email', 'phone'];
        try {
          const data: any = (event.request as any).data;
          sensitiveFields.forEach(field => {
            if (data && data[field]) {
              data[field] = '[Filtered]';
            }
          });
          (event.request as any).data = data;
        } catch {}
      }
      
      // Filter sensitive URLs
      if (event.request && (event.request as any).url) {
        try {
          // Check if URL constructor is available (might not be in React Native)
          if (typeof URL !== 'undefined') {
            // Remove query parameters that might contain sensitive data
            const url = new URL((event.request as any).url as string);
            const sensitiveParams = ['token', 'email', 'user_id'];
            sensitiveParams.forEach(param => {
              if (url.searchParams.has(param)) {
                url.searchParams.set(param, '[Filtered]');
              }
            });
            event.request.url = url.toString();
          } else {
            // Fallback for React Native - simple string replacement
            let filteredUrl: string = (event.request as any).url as string;
            const sensitiveParams = ['token', 'email', 'user_id'];
            sensitiveParams.forEach(param => {
              const regex = new RegExp(`([?&])${param}=([^&]*)`, 'gi');
              filteredUrl = filteredUrl.replace(regex, `$1${param}=[Filtered]`);
            });
            (event.request as any).url = filteredUrl;
          }
        } catch (error) {
          // If URL parsing fails, leave the URL as is
          logWarn('Failed to filter sensitive URL parameters:', "Warning", error);
        }
      }
      
      return event;
    },
    
    // Custom integrations
    integrations: (integrations) => {
      const defaultIntegrations = integrations || [];
      try {
        // Keep default integrations; optional tracing integrations can be added conditionally here if available.
      } catch (error) {
        logWarn('Failed to add Sentry tracing integration:', "Warning", error);
      }
      return defaultIntegrations;
    },
    
    // Release and user tracking
    release: process.env.EXPO_PUBLIC_APP_VERSION,
    dist: process.env.EXPO_PUBLIC_BUILD_NUMBER,
  });
    
    logDebug('✅ Sentry initialized', "Debug");
  } catch (error) {
    logError('Failed to initialize Sentry:', "Error", error);
    // Don't throw - allow app to continue without Sentry
  }
};

// Enhanced error tracking functions
export const trackError = (error: Error, context?: Record<string, any>) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('custom', context);
        }
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    } else {
      logError('Sentry not initialized, "Error", logging error locally:', error, context);
    }
  } catch (sentryError) {
    logError('Failed to track error with Sentry:', "Error", sentryError);
    logError('Original error:', "Error", error, context);
  }
};

export const trackCriticalError = (error: Error, context?: Record<string, any>) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('custom', context);
        }
        scope.setLevel('fatal');
        scope.setTag('critical', true);
        scope.setTag('needs_immediate_attention', true);
        Sentry.captureException(error);
      });
    } else {
      logError('CRITICAL ERROR - Sentry not initialized:', "Error", error, context);
    }
  } catch (sentryError) {
    logError('Failed to track critical error with Sentry:', "Error", sentryError);
    logError('Original critical error:', "Error", error, context);
  }
};

export const trackUserAction = (action: string, data?: Record<string, any>) => {
  try {
    if (Sentry && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        message: action,
        category: 'user_action',
        level: 'info',
        data,
        timestamp: Date.now() / 1000,
      });
    }
  } catch (error) {
    logDebug('Failed to track user action:', "Debug", error);
  }
};

export const trackAPICall = (
  endpoint: string, 
  method: string, 
  duration: number, 
  status: number,
  error?: string
) => {
  try {
    if (Sentry && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        message: `API ${method} ${endpoint}`,
        category: 'api_call',
        level: error ? 'error' : 'info',
        data: {
          endpoint,
          method,
          duration,
          status,
          error,
        },
        timestamp: Date.now() / 1000,
      });
      
      // Track slow API calls as performance issues
      if (duration > 3000 && Sentry.withScope) {
        Sentry.withScope((scope) => {
          scope.setTag('performance_issue', true);
          scope.setContext('slow_api_call', {
            endpoint,
            method,
            duration,
            status,
          });
          Sentry.captureMessage(`Slow API call: ${method} ${endpoint} took ${duration}ms`, 'warning');
        });
      }
    }
  } catch (error) {
    logDebug('Failed to track API call:', "Debug", error);
  }
};

export const setUserContext = (user: {
  id: string;
  email?: string;
  onboardingCompleted?: boolean;
  subscriptionStatus?: string;
  profileCompleted?: boolean;
  totalMatches?: number;
  totalMessages?: number;
}) => {
  try {
    if (Sentry && Sentry.setUser) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
      });
      
      if (Sentry.setContext) {
        Sentry.setContext('user_status', {
          onboarding_completed: user.onboardingCompleted,
          subscription_status: user.subscriptionStatus,
          profile_completed: user.profileCompleted,
          total_matches: user.totalMatches,
          total_messages: user.totalMessages,
        });
      }
    }
  } catch (error) {
    logDebug('Failed to set user context:', "Debug", error);
  }
};

export const trackBusinessMetric = (metric: string, value: number, context?: Record<string, any>) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        scope.setTag('business_metric', true);
        scope.setContext('metric_data', {
          metric,
          value,
          timestamp: new Date().toISOString(),
          ...context,
        });
        Sentry.captureMessage(`Business metric: ${metric} = ${value}`, 'info');
      });
    }
  } catch (error) {
    logDebug('Failed to track business metric:', "Debug", error);
  }
};

// Dating app specific error tracking
export const trackMatchingError = (error: Error, context: {
  userId?: string;
  matchUserId?: string;
  action?: 'approve' | 'reject' | 'view_compatibility';
}) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'matching');
        scope.setContext('matching_context', context);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    } else {
      logError('Matching error:', "Error", error, context);
    }
  } catch (sentryError) {
    logError('Failed to track matching error:', "Error", sentryError);
    logError('Original error:', "Error", error, context);
  }
};

export const trackMessagingError = (error: Error, context: {
  conversationId?: string;
  messageType?: 'text' | 'image' | 'date_proposal';
}) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'messaging');
        scope.setContext('messaging_context', context);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    } else {
      logError('Messaging error:', "Error", error, context);
    }
  } catch (sentryError) {
    logError('Failed to track messaging error:', "Error", sentryError);
    logError('Original error:', "Error", error, context);
  }
};

export const trackOnboardingError = (error: Error, context: {
  step?: string;
  stepNumber?: number;
}) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'onboarding');
        scope.setContext('onboarding_context', context);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    } else {
      logError('Onboarding error:', "Error", error, context);
    }
  } catch (sentryError) {
    logError('Failed to track onboarding error:', "Error", sentryError);
    logError('Original error:', "Error", error, context);
  }
};

export const trackPaymentError = (error: Error, context: {
  plan?: string;
  amount?: number;
  paymentMethod?: string;
}) => {
  try {
    if (Sentry && Sentry.withScope) {
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'payment');
        scope.setContext('payment_context', context);
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    } else {
      logError('Payment error:', "Error", error, context);
    }
  } catch (sentryError) {
    logError('Failed to track payment error:', "Error", sentryError);
    logError('Original error:', "Error", error, context);
  }
};

// Performance monitoring
export const trackScreenLoad = (screenName: string, loadTime: number) => {
  try {
    if (Sentry && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        message: `Screen loaded: ${screenName}`,
        category: 'navigation',
        level: 'info',
        data: {
          screen_name: screenName,
          load_time: loadTime,
        },
        timestamp: Date.now() / 1000,
      });
      
      // Track slow screen loads
      if (loadTime > 3000 && Sentry.withScope) {
        Sentry.withScope((scope) => {
          scope.setTag('performance_issue', true);
          scope.setContext('slow_screen_load', {
            screen_name: screenName,
            load_time: loadTime,
          });
          Sentry.captureMessage(`Slow screen load: ${screenName} took ${loadTime}ms`, 'warning');
        });
      }
    }
  } catch (error) {
    logDebug('Failed to track screen load:', "Debug", error);
  }
};

export const trackAppLaunch = (launchTime: number, isFirstLaunch: boolean) => {
  try {
    if (Sentry && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        message: 'App launched',
        category: 'app_lifecycle',
        level: 'info',
        data: {
          launch_time: launchTime,
          is_first_launch: isFirstLaunch,
        },
        timestamp: Date.now() / 1000,
      });
  
      // Track slow app launches
      if (launchTime > 5000 && Sentry.withScope) {
        Sentry.withScope((scope) => {
          scope.setTag('performance_issue', true);
          scope.setContext('slow_app_launch', {
            launch_time: launchTime,
            is_first_launch: isFirstLaunch,
          });
          Sentry.captureMessage(`Slow app launch: ${launchTime}ms`, 'warning');
        });
      }
    }
  } catch (error) {
    logDebug('Failed to track app launch:', "Debug", error);
  }
};
