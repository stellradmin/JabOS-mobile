import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { logWarn, logDebug } from "./logger";

// Control native splash handling depending on environment
// - In Expo Go / Dev Client, let Expo auto-hide the splash by default
// - In standalone builds, use manual control (prevent auto-hide)
// - Can be forced via EXPO_PUBLIC_MANUAL_SPLASH=true
const shouldUseManualSplash = (() => {
  const explicit = (process.env.EXPO_PUBLIC_MANUAL_SPLASH || '').toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  const appOwnership = (Constants.appOwnership ?? '') as unknown as string;
  return appOwnership === 'standalone';
})();

if (shouldUseManualSplash) {
  // Keep the native splash visible until we explicitly hide it
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Avoid noisy errors during fast-refresh or duplicate calls
  });
  logDebug('Manual splash control enabled');
} else {
  logDebug('Using Expo auto-hide for splash screen');
}

export const hideSplashScreen = async () => {
  try {
    await SplashScreen.hideAsync();
  } catch (error) {
    logWarn('Error hiding splash screen:', "Warning", error);
  }
};

export const showSplashScreen = async () => {
  try {
    await SplashScreen.preventAutoHideAsync();
  } catch (error) {
    logWarn('Error showing splash screen:', "Warning", error);
  }
};
