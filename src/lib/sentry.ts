import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export function initializeSentry() {
  const dsn = Constants.expoConfig?.extra?.EXPO_PUBLIC_SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN

  if (!dsn || dsn === 'YOUR_SENTRY_DSN_HERE') {
    logWarn('Sentry DSN not found or not configured', "Warning")
    return null
  }

  Sentry.init({
    dsn: dsn,
    debug: __DEV__, // Enable debug mode in development
    environment: __DEV__ ? 'development' : 'production',
    
    // Performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 100% in dev, 10% in production
    
    // Release tracking
    release: Constants.expoConfig?.version,
    
    // Integrations
    // Advanced tracing integrations removed for type compatibility; defaults remain

    // Before send hook for filtering sensitive data
    beforeSend(event) {
      // Filter out sensitive information
      if (event.exception) {
        const error = event.exception.values?.[0]
        if (error?.value?.includes('password') || error?.value?.includes('token')) {
          return null // Don't send events with sensitive data
        }
      }
      return event
    },

    // Initial scope
    beforeSendTransaction(event) {
      // You can modify transaction events here
      return event
    },
  })

  // Set user context if needed
  // Initial scope can be configured here if needed

  logDebug('Sentry initialized successfully', "Debug")
  return Sentry
}

export { Sentry }
