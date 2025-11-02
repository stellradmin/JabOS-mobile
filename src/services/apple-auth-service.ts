/**
 * Apple Sign-In Service for Stellr
 *
 * Handles Apple authentication using @invertase/react-native-apple-authentication
 * Integrates with Supabase Auth for session management
 *
 * Prerequisites:
 * - Apple Developer account with Sign In with Apple capability
 * - Configured in Supabase Dashboard (Authentication > Providers > Apple)
 * - iOS app configured with Sign in with Apple entitlement
 */

import { Platform } from 'react-native';
import appleAuth, {
  AppleRequestOperation,
  AppleRequestScope,
  AppleCredentialState,
} from '@invertase/react-native-apple-authentication';
import { supabase } from '../lib/supabase';
import { logError, logInfo, logWarn, logDebug } from '../utils/logger';

/**
 * Check if Apple Sign-In is available on this device
 * Only available on iOS 13+ and macOS 10.15+
 */
export const isAppleSignInAvailable = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'ios') {
      return false;
    }

    const isAvailable = appleAuth.isSupported;
    return isAvailable;
  } catch (error) {
    logError('Error checking Apple Sign-In availability:', "Error", error);
    return false;
  }
};

/**
 * Sign in with Apple
 *
 * Flow:
 * 1. Request Apple credentials (ID token + nonce)
 * 2. Exchange credentials with Supabase
 * 3. Create/update user profile
 * 4. Return session
 */
export const signInWithApple = async () => {
  try {
    // Check if Apple Sign-In is supported
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS devices');
    }

    const isSupported = appleAuth.isSupported;
    if (!isSupported) {
      throw new Error('Apple Sign-In is not supported on this device (requires iOS 13+)');
    }

    logDebug('Initiating Apple Sign-In request', "Debug");

    // Perform Apple Sign-In request
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: AppleRequestOperation.LOGIN,
      requestedScopes: [
        AppleRequestScope.EMAIL,
        AppleRequestScope.FULL_NAME,
      ],
    });

    // Validate the response
    if (!appleAuthRequestResponse.identityToken) {
      throw new Error('Apple Sign-In failed: No identity token received');
    }

    logDebug('Apple Sign-In request successful, exchanging credentials with Supabase', "Debug", {
      user: appleAuthRequestResponse.user,
      hasEmail: !!appleAuthRequestResponse.email,
      hasFullName: !!(appleAuthRequestResponse.fullName?.givenName || appleAuthRequestResponse.fullName?.familyName),
    });

    // Check credential state
    const credentialState = await appleAuth.getCredentialStateForUser(appleAuthRequestResponse.user);

    if (credentialState !== AppleCredentialState.AUTHORIZED) {
      throw new Error('Apple Sign-In credentials are not authorized');
    }

    // Exchange Apple credentials with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: appleAuthRequestResponse.identityToken,
    });

    if (error) {
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error('Apple Sign-In succeeded but no user/session returned from Supabase');
    }

    logInfo('Apple Sign-In successful', "Info", {
      userId: data.user.id,
      email: data.user.email,
    });

    // Update profile with Apple-provided information (if available)
    // This only happens on first sign-in, as Apple only provides this data once
    if (appleAuthRequestResponse.fullName?.givenName || appleAuthRequestResponse.email) {
      await updateProfileWithAppleData(
        data.user.id,
        appleAuthRequestResponse.email,
        appleAuthRequestResponse.fullName?.givenName,
        appleAuthRequestResponse.fullName?.familyName
      );
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    // Handle user cancellation
    if (error.code === '1001' || error.message?.includes('canceled')) {
      logDebug('Apple Sign-In cancelled by user', "Debug");
      return {
        success: false,
        error: 'User cancelled Apple Sign-In',
        cancelled: true,
      };
    }

    logError('Apple Sign-In failed:', "Error", error);
    return {
      success: false,
      error: error.message || 'Apple Sign-In failed',
      cancelled: false,
    };
  }
};

/**
 * Update user profile with Apple-provided data
 * Only called on first sign-in when Apple provides name/email
 */
const updateProfileWithAppleData = async (
  userId: string,
  email: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined
) => {
  try {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .single();

    // If profile exists and already has a display name, don't override
    if (existingProfile?.display_name) {
      logDebug('Profile already has display_name, skipping Apple data update', "Debug");
      return;
    }

    // Construct display name from Apple-provided names
    let displayName: string | null = null;
    if (firstName && lastName) {
      displayName = `${firstName} ${lastName}`.trim();
    } else if (firstName) {
      displayName = firstName;
    } else if (lastName) {
      displayName = lastName;
    }

    // Update or insert profile
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (displayName) {
      updateData.display_name = displayName;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...updateData,
      }, {
        onConflict: 'id',
      });

    if (error) {
      logWarn('Failed to update profile with Apple data:', "Warning", error);
    } else {
      logDebug('Profile updated with Apple-provided data', "Debug", { displayName, email });
    }
  } catch (error) {
    logWarn('Error updating profile with Apple data:', "Warning", error);
  }
};

/**
 * Sign out from Apple
 * Note: Apple doesn't have a programmatic sign-out, but we clear the Supabase session
 */
export const signOutFromApple = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    logInfo('Successfully signed out from Apple', "Info");
    return { success: true };
  } catch (error) {
    logError('Error signing out from Apple:', "Error", error);
    return {
      success: false,
      error: error.message || 'Sign out failed',
    };
  }
};

/**
 * Get Apple credential state for current user
 * Useful for checking if user is still authorized
 */
export const checkAppleCredentialState = async (appleUserId: string): Promise<boolean> => {
  try {
    if (Platform.OS !== 'ios') {
      return false;
    }

    const credentialState = await appleAuth.getCredentialStateForUser(appleUserId);
    return credentialState === AppleCredentialState.AUTHORIZED;
  } catch (error) {
    logError('Error checking Apple credential state:', "Error", error);
    return false;
  }
};

/**
 * Restore Apple credentials on app launch
 * Call this in your app initialization to check if user is still signed in with Apple
 */
export const restoreAppleCredentials = async () => {
  try {
    if (Platform.OS !== 'ios') {
      return { success: false, reason: 'Not on iOS' };
    }

    const isSupported = appleAuth.isSupported;
    if (!isSupported) {
      return { success: false, reason: 'Apple Sign-In not supported' };
    }

    // Check if we have a Supabase session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, reason: 'No active session' };
    }

    // If we have an Apple user ID in session metadata, check its credential state
    const appleUserId = session.user?.app_metadata?.provider_id;

    if (appleUserId) {
      const credentialState = await appleAuth.getCredentialStateForUser(appleUserId);

      if (credentialState !== AppleCredentialState.AUTHORIZED) {
        logWarn('Apple credentials are no longer authorized, signing out', "Warning");
        await supabase.auth.signOut();
        return { success: false, reason: 'Credentials not authorized' };
      }
    }

    logDebug('Apple credentials restored successfully', "Debug");
    return { success: true, session };
  } catch (error) {
    logError('Error restoring Apple credentials:', "Error", error);
    return { success: false, reason: 'Restore failed' };
  }
};

/**
 * Export all Apple auth functions
 */
export const AppleAuthService = {
  isAvailable: isAppleSignInAvailable,
  signIn: signInWithApple,
  signOut: signOutFromApple,
  checkCredentialState: checkAppleCredentialState,
  restoreCredentials: restoreAppleCredentials,
};
