/**
 * Google Sign-In Service for Stellr
 *
 * Handles Google authentication using @react-native-google-signin/google-signin
 * Integrates with Supabase Auth for session management
 *
 * Prerequisites:
 * - Google Cloud Console project with OAuth 2.0 credentials
 * - Configured in Supabase Dashboard (Authentication > Providers > Google)
 * - iOS: Google-Info.plist with REVERSED_CLIENT_ID
 * - Android: google-services.json
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { logError, logInfo, logWarn, logDebug } from '../utils/logger';

// Detect if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Google Sign-In (not available in Expo Go)
let GoogleSignin: any = null;
let statusCodes: any = null;
let GoogleUser: any = null;

if (!isExpoGo) {
  try {
    const GoogleSignInModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleSignInModule.GoogleSignin;
    statusCodes = GoogleSignInModule.statusCodes;
    GoogleUser = GoogleSignInModule.User;
  } catch (error) {
    logWarn('Google Sign-In module not available (expected in Expo Go)', "Warning");
  }
}

// Google OAuth Web Client ID (from Google Cloud Console)
// This should be set in your environment variables
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * Configure Google Sign-In
 * Must be called before any other Google Sign-In operations
 * Call this in your app initialization (_layout.tsx or App.tsx)
 */
export const configureGoogleSignIn = () => {
  try {
    if (isExpoGo || !GoogleSignin) {
      logWarn('Google Sign-In not available in Expo Go. Build a development client to use this feature.', "Warning");
      return false;
    }

    if (!GOOGLE_WEB_CLIENT_ID) {
      logError('Google Web Client ID not found in environment variables', "Error");
      return false;
    }

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID, // From Google Cloud Console
      offlineAccess: true, // To get refresh token
      forceCodeForRefreshToken: true, // Force code for refresh token (Android)
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, // Optional: iOS-specific client ID
    });

    logDebug('Google Sign-In configured successfully', "Debug");
    return true;
  } catch (error) {
    logError('Error configuring Google Sign-In:', "Error", error);
    return false;
  }
};

/**
 * Check if Google Play Services are available (Android only)
 */
export const checkGooglePlayServices = async (): Promise<boolean> => {
  try {
    if (isExpoGo || !GoogleSignin) {
      return false;
    }

    if (Platform.OS !== 'android') {
      return true; // Always available on iOS
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    return true;
  } catch (error: any) {
    if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      logWarn('Google Play Services not available', "Warning");
      return false;
    }
    logError('Error checking Google Play Services:', "Error", error);
    return false;
  }
};

/**
 * Sign in with Google
 *
 * Flow:
 * 1. Check Google Play Services (Android)
 * 2. Request Google Sign-In
 * 3. Get ID token
 * 4. Exchange with Supabase
 * 5. Create/update user profile
 * 6. Return session
 */
export const signInWithGoogle = async () => {
  try {
    if (isExpoGo || !GoogleSignin) {
      return {
        success: false,
        error: 'Google Sign-In not available in Expo Go. Build a development client to use this feature.',
        cancelled: false,
      };
    }

    // Check if Google Play Services are available (Android)
    const playServicesAvailable = await checkGooglePlayServices();
    if (!playServicesAvailable) {
      throw new Error('Google Play Services are not available on this device');
    }

    logDebug('Initiating Google Sign-In request', "Debug");

    // Initiate Google Sign-In
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    // Validate the response
    if (!userInfo.idToken) {
      throw new Error('Google Sign-In failed: No ID token received');
    }

    logDebug('Google Sign-In request successful, exchanging credentials with Supabase', "Debug", {
      user: userInfo.user.id,
      hasEmail: !!userInfo.user.email,
      hasName: !!userInfo.user.name,
    });

    // Exchange Google credentials with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: userInfo.idToken,
    });

    if (error) {
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error('Google Sign-In succeeded but no user/session returned from Supabase');
    }

    logInfo('Google Sign-In successful', "Info", {
      userId: data.user.id,
      email: data.user.email,
    });

    // Update profile with Google-provided information
    await updateProfileWithGoogleData(
      data.user.id,
      userInfo.user.email,
      userInfo.user.name,
      userInfo.user.photo
    );

    return {
      success: true,
      user: data.user,
      session: data.session,
      googleUser: userInfo.user,
    };
  } catch (error: any) {
    // Handle specific Google Sign-In error codes
    if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
      logDebug('Google Sign-In cancelled by user', "Debug");
      return {
        success: false,
        error: 'User cancelled Google Sign-In',
        cancelled: true,
      };
    } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
      logWarn('Google Sign-In already in progress', "Warning");
      return {
        success: false,
        error: 'Sign-in already in progress',
        cancelled: false,
      };
    } else if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      logError('Google Play Services not available', "Error");
      return {
        success: false,
        error: 'Google Play Services not available on this device',
        cancelled: false,
      };
    }

    logError('Google Sign-In failed:', "Error", error);
    return {
      success: false,
      error: error.message || 'Google Sign-In failed',
      cancelled: false,
    };
  }
};

/**
 * Update user profile with Google-provided data
 */
const updateProfileWithGoogleData = async (
  userId: string,
  email: string | null,
  name: string | null,
  photoUrl: string | null
) => {
  try {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .single();

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Only update display_name if not already set
    if (!existingProfile?.display_name && name) {
      updateData.display_name = name;
    }

    // Only update avatar_url if not already set
    if (!existingProfile?.avatar_url && photoUrl) {
      updateData.avatar_url = photoUrl;
    }

    // If there's nothing to update, skip
    if (Object.keys(updateData).length === 1) { // Only updated_at
      logDebug('Profile already has Google data, skipping update', "Debug");
      return;
    }

    // Update or insert profile
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...updateData,
      }, {
        onConflict: 'id',
      });

    if (error) {
      logWarn('Failed to update profile with Google data:', "Warning", error);
    } else {
      logDebug('Profile updated with Google-provided data', "Debug", { name, email, hasPhoto: !!photoUrl });
    }
  } catch (error) {
    logWarn('Error updating profile with Google data:', "Warning", error);
  }
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async () => {
  try {
    if (isExpoGo || !GoogleSignin) {
      // Just sign out from Supabase in Expo Go
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    }

    // Sign out from Google
    await GoogleSignin.signOut();

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    logInfo('Successfully signed out from Google', "Info");
    return { success: true };
  } catch (error: any) {
    logError('Error signing out from Google:', "Error", error);
    return {
      success: false,
      error: error.message || 'Sign out failed',
    };
  }
};

/**
 * Revoke Google access
 * Completely removes app access to user's Google account
 * More aggressive than sign-out
 */
export const revokeGoogleAccess = async () => {
  try {
    if (isExpoGo || !GoogleSignin) {
      await supabase.auth.signOut();
      return { success: true };
    }

    await GoogleSignin.revokeAccess();
    await supabase.auth.signOut();

    logInfo('Successfully revoked Google access', "Info");
    return { success: true };
  } catch (error: any) {
    logError('Error revoking Google access:', "Error", error);
    return {
      success: false,
      error: error.message || 'Revoke access failed',
    };
  }
};

/**
 * Check if user is currently signed in with Google
 */
export const isSignedIn = async (): Promise<boolean> => {
  try {
    if (isExpoGo || !GoogleSignin) {
      return false;
    }
    const isSignedIn = await GoogleSignin.isSignedIn();
    return isSignedIn;
  } catch (error) {
    logError('Error checking Google sign-in status:', "Error", error);
    return false;
  }
};

/**
 * Get current Google user info (if signed in)
 */
export const getCurrentUser = async (): Promise<any | null> => {
  try {
    if (isExpoGo || !GoogleSignin) {
      return null;
    }
    const user = await GoogleSignin.getCurrentUser();
    return user;
  } catch (error) {
    logError('Error getting current Google user:', "Error", error);
    return null;
  }
};

/**
 * Silent sign-in
 * Attempt to sign in without showing the Google Sign-In UI
 * Useful for restoring sessions on app launch
 */
export const signInSilently = async () => {
  try {
    if (isExpoGo || !GoogleSignin) {
      return {
        success: false,
        error: 'Google Sign-In not available in Expo Go',
      };
    }

    const userInfo = await GoogleSignin.signInSilently();

    if (!userInfo.idToken) {
      throw new Error('Silent sign-in failed: No ID token received');
    }

    // Exchange with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: userInfo.idToken,
    });

    if (error) {
      throw error;
    }

    logInfo('Silent Google Sign-In successful', "Info", {
      userId: data.user?.id,
    });

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    logDebug('Silent Google Sign-In failed (user likely needs to sign in manually)', "Debug");
    return {
      success: false,
      error: error.message || 'Silent sign-in failed',
    };
  }
};

/**
 * Restore Google credentials on app launch
 * Attempts silent sign-in to restore session
 */
export const restoreGoogleCredentials = async () => {
  try {
    if (isExpoGo || !GoogleSignin) {
      return { success: false, reason: 'Not available in Expo Go' };
    }

    // Check if user is signed in with Google
    const isSignedIn = await GoogleSignin.isSignedIn();

    if (!isSignedIn) {
      return { success: false, reason: 'Not signed in with Google' };
    }

    // Attempt silent sign-in
    const result = await signInSilently();

    if (result.success) {
      logDebug('Google credentials restored successfully', "Debug");
      return { success: true, session: result.session };
    } else {
      return { success: false, reason: result.error };
    }
  } catch (error) {
    logError('Error restoring Google credentials:', "Error", error);
    return { success: false, reason: 'Restore failed' };
  }
};

/**
 * Export all Google auth functions
 */
export const GoogleAuthService = {
  configure: configureGoogleSignIn,
  checkPlayServices: checkGooglePlayServices,
  signIn: signInWithGoogle,
  signOut: signOutFromGoogle,
  revokeAccess: revokeGoogleAccess,
  isSignedIn,
  getCurrentUser,
  signInSilently,
  restoreCredentials: restoreGoogleCredentials,
};
