import PostHog from 'posthog-react-native'
import Constants from 'expo-constants'
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export function initializePostHog() {
  const apiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.EXPO_PUBLIC_POSTHOG_API_KEY
  const host = Constants.expoConfig?.extra?.EXPO_PUBLIC_POSTHOG_HOST || process.env.EXPO_PUBLIC_POSTHOG_HOST

  if (!apiKey) {
    logWarn('PostHog API key not found', "Warning")
    return null
  }

  try {
    const client = new PostHog(apiKey, {
      host: host || 'https://us.i.posthog.com',
      enableSessionReplay: false,
      captureAppLifecycleEvents: true,
      // captureDeepLinks deprecated/unsupported in types; rely on default link capture if available
      // debug flag is not in typed options; log level handled separately
    })
    return client
  } catch (e) {
    logError('PostHog initialization failed:', 'Error', e as any)
    return null
  }
}

export { PostHog }
