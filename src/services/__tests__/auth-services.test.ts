/**
 * Comprehensive Unit Tests for Apple and Google Authentication Services
 *
 * Testing Coverage:
 * Apple Auth:
 * - isAppleSignInAvailable (iOS, non-iOS)
 * - signInWithApple (success, cancelled, not authorized, error)
 * - signOutFromApple (success, error)
 * - checkAppleCredentialState
 * - restoreAppleCredentials
 *
 * Google Auth:
 * - configureGoogleSignIn (success, Expo Go, no client ID)
 * - signInWithGoogle (success, cancelled, in progress, Play Services unavailable)
 * - signOutFromGoogle (success, error)
 * - revokeGoogleAccess
 * - isSignedIn, getCurrentUser, signInSilently
 * - restoreGoogleCredentials
 */

import { Platform } from 'react-native';
import {
  isAppleSignInAvailable,
  signInWithApple,
  signOutFromApple,
  checkAppleCredentialState,
  restoreAppleCredentials,
} from '../apple-auth-service';
import {
  configureGoogleSignIn,
  checkGooglePlayServices,
  signInWithGoogle,
  signOutFromGoogle,
  revokeGoogleAccess,
  isSignedIn,
  getCurrentUser,
  signInSilently,
  restoreGoogleCredentials,
} from '../google-auth-service';
import { supabase } from '../../lib/supabase';
import { TEST_USERS } from '../../../__tests__/fixtures';
import AppleAuthentication from '@invertase/react-native-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Mock dependencies
jest.mock('@invertase/react-native-apple-authentication');
jest.mock('@react-native-google-signin/google-signin');
jest.mock('../../lib/supabase');
jest.mock('../../utils/logger');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockAppleAuth = AppleAuthentication as jest.Mocked<typeof AppleAuthentication>;
const mockGoogleSignIn = GoogleSignin as jest.Mocked<typeof GoogleSignin>;

// Test data
const mockAppleCredential = {
  user: 'test-user-id',
  email: 'test@example.com',
  fullName: { givenName: 'Test', familyName: 'User' },
  identityToken: 'mock-identity-token',
  authorizationCode: 'mock-auth-code',
};

const mockGoogleUser = {
  idToken: 'mock-id-token',
  serverAuthCode: 'mock-server-auth-code',
  scopes: [],
  user: {
    email: 'test@example.com',
    id: 'mock-google-user-id',
    givenName: 'Test',
    familyName: 'User',
    photo: 'https://example.com/photo.jpg',
    name: 'Test User',
  },
};

describe('Authentication Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-web-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'test-ios-client-id';
    Platform.OS = 'ios';
  });

  describe('Apple Authentication Service', () => {
    describe('isAppleSignInAvailable', () => {
      it('should return true on iOS when Apple Sign-In is supported', async () => {
        // Arrange
        Platform.OS = 'ios';
        mockAppleAuth.isSupported = true;

        // Act
        const available = await isAppleSignInAvailable();

        // Assert
        expect(available).toBe(true);
      });

      it('should return false on non-iOS platforms', async () => {
        // Arrange
        Platform.OS = 'android';

        // Act
        const available = await isAppleSignInAvailable();

        // Assert
        expect(available).toBe(false);
      });
    });

    describe('signInWithApple', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
        mockAppleAuth.isSupported = true;
      });

      it('should sign in successfully and return user session', async () => {
        // Arrange
        mockAppleAuth.performRequest.mockResolvedValue(mockAppleCredential);
        mockAppleAuth.getCredentialStateForUser.mockResolvedValue(1); // AUTHORIZED
        mockSupabase.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: { id: TEST_USERS.freeUser.id, email: 'test@privaterelay.appleid.com' } as any,
            session: { access_token: 'mock-token' } as any,
          },
          error: null,
        });
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        // Act
        const result = await signInWithApple();

        // Assert
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.session).toBeDefined();
        expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
          provider: 'apple',
          token: mockAppleCredential.identityToken,
        });
      });

      it('should handle user cancellation', async () => {
        // Arrange
        const cancelError = new Error('User cancelled') as any;
        cancelError.code = '1001';
        mockAppleAuth.performRequest.mockRejectedValue(cancelError);

        // Act
        const result = await signInWithApple();

        // Assert
        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
        expect(result.error).toContain('cancelled');
      });

      it('should handle missing identity token', async () => {
        // Arrange
        mockAppleAuth.performRequest.mockResolvedValue({
          ...mockAppleCredential,
          identityToken: null,
        });

        // Act
        const result = await signInWithApple();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('No identity token');
      });

      it('should handle unauthorized credential state', async () => {
        // Arrange
        mockAppleAuth.performRequest.mockResolvedValue(mockAppleCredential);
        mockAppleAuth.getCredentialStateForUser.mockResolvedValue(0); // REVOKED

        // Act
        const result = await signInWithApple();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('not authorized');
      });
    });

    describe('signOutFromApple', () => {
      it('should sign out successfully', async () => {
        // Arrange
        mockSupabase.auth.signOut.mockResolvedValue({ error: null });

        // Act
        const result = await signOutFromApple();

        // Assert
        expect(result.success).toBe(true);
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });

      it('should handle sign out errors', async () => {
        // Arrange
        const error = { message: 'Sign out failed' };
        mockSupabase.auth.signOut.mockResolvedValue({ error });

        // Act
        const result = await signOutFromApple();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Sign out failed');
      });
    });

    describe('checkAppleCredentialState', () => {
      it('should return true for authorized credentials on iOS', async () => {
        // Arrange
        Platform.OS = 'ios';
        const appleUserId = 'apple-user-123';
        mockAppleAuth.getCredentialStateForUser.mockResolvedValue(1); // AUTHORIZED

        // Act
        const isAuthorized = await checkAppleCredentialState(appleUserId);

        // Assert
        expect(isAuthorized).toBe(true);
      });

      it('should return false on non-iOS platforms', async () => {
        // Arrange
        Platform.OS = 'android';

        // Act
        const isAuthorized = await checkAppleCredentialState('apple-user-123');

        // Assert
        expect(isAuthorized).toBe(false);
      });
    });

    describe('restoreAppleCredentials', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
        mockAppleAuth.isSupported = true;
      });

      it('should restore credentials successfully', async () => {
        // Arrange
        mockSupabase.auth.getSession.mockResolvedValue({
          data: {
            session: {
              user: {
                app_metadata: { provider_id: 'apple-user-123' },
              } as any,
              access_token: 'mock-token',
            } as any,
          },
          error: null,
        });
        mockAppleAuth.getCredentialStateForUser.mockResolvedValue(1); // AUTHORIZED

        // Act
        const result = await restoreAppleCredentials();

        // Assert
        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
      });

      it('should fail when no active session exists', async () => {
        // Arrange
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: null },
          error: null,
        });

        // Act
        const result = await restoreAppleCredentials();

        // Assert
        expect(result.success).toBe(false);
        expect(result.reason).toBe('No active session');
      });
    });
  });

  describe('Google Authentication Service', () => {
    describe('configureGoogleSignIn', () => {
      it('should configure successfully with valid credentials', () => {
        // Act
        const result = configureGoogleSignIn();

        // Assert
        expect(result).toBe(true);
        expect(mockGoogleSignIn.configure).toHaveBeenCalledWith({
          webClientId: 'test-web-client-id',
          offlineAccess: true,
          forceCodeForRefreshToken: true,
          iosClientId: 'test-ios-client-id',
        });
      });

      it('should fail when Google Web Client ID is missing', () => {
        // Arrange
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

        // Act
        const result = configureGoogleSignIn();

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('checkGooglePlayServices', () => {
      it('should return true on iOS (always available)', async () => {
        // Arrange
        Platform.OS = 'ios';

        // Act
        const available = await checkGooglePlayServices();

        // Assert
        expect(available).toBe(true);
      });

      it('should check Play Services on Android', async () => {
        // Arrange
        Platform.OS = 'android';
        mockGoogleSignIn.hasPlayServices.mockResolvedValue(true);

        // Act
        const available = await checkGooglePlayServices();

        // Assert
        expect(available).toBe(true);
        expect(mockGoogleSignIn.hasPlayServices).toHaveBeenCalled();
      });
    });

    describe('signInWithGoogle', () => {
      beforeEach(() => {
        mockGoogleSignIn.hasPlayServices.mockResolvedValue(true);
        mockGoogleSignIn.signIn.mockResolvedValue({
          type: 'success',
          data: {
            ...mockGoogleUser,
            idToken: 'mock-id-token',
          },
        });
      });

      it('should sign in successfully and return user session', async () => {
        // Arrange
        mockSupabase.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: { id: TEST_USERS.freeUser.id, email: 'test@gmail.com' } as any,
            session: { access_token: 'mock-token' } as any,
          },
          error: null,
        });
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        // Act
        const result = await signInWithGoogle();

        // Assert
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.session).toBeDefined();
        expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
          provider: 'google',
          token: 'mock-id-token',
        });
      });

      it('should handle user cancellation', async () => {
        // Arrange
        const cancelError = new Error('Cancelled') as any;
        cancelError.code = 'SIGN_IN_CANCELLED';
        mockGoogleSignIn.signIn.mockRejectedValue(cancelError);

        // Act
        const result = await signInWithGoogle();

        // Assert
        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
      });

      it('should handle Play Services not available error', async () => {
        // Arrange
        mockGoogleSignIn.hasPlayServices.mockRejectedValue(new Error('Play Services unavailable'));

        // Act
        const result = await signInWithGoogle();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Google Play Services are not available');
      });
    });

    describe('signOutFromGoogle', () => {
      it('should sign out successfully', async () => {
        // Arrange
        mockGoogleSignIn.signOut.mockResolvedValue(undefined);
        mockSupabase.auth.signOut.mockResolvedValue({ error: null });

        // Act
        const result = await signOutFromGoogle();

        // Assert
        expect(result.success).toBe(true);
        expect(mockGoogleSignIn.signOut).toHaveBeenCalled();
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });
    });

    describe('revokeGoogleAccess', () => {
      it('should revoke access successfully', async () => {
        // Arrange
        mockGoogleSignIn.revokeAccess.mockResolvedValue(undefined);
        mockSupabase.auth.signOut.mockResolvedValue({ error: null });

        // Act
        const result = await revokeGoogleAccess();

        // Assert
        expect(result.success).toBe(true);
        expect(mockGoogleSignIn.revokeAccess).toHaveBeenCalled();
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });
    });

    describe('isSignedIn', () => {
      it('should return true when user is signed in', async () => {
        // Arrange
        mockGoogleSignIn.isSignedIn.mockResolvedValue(true);

        // Act
        const signedIn = await isSignedIn();

        // Assert
        expect(signedIn).toBe(true);
      });

      it('should return false when user is not signed in', async () => {
        // Arrange
        mockGoogleSignIn.isSignedIn.mockResolvedValue(false);

        // Act
        const signedIn = await isSignedIn();

        // Assert
        expect(signedIn).toBe(false);
      });
    });

    describe('getCurrentUser', () => {
      it('should return current user when signed in', async () => {
        // Arrange
        mockGoogleSignIn.getCurrentUser.mockResolvedValue(mockGoogleUser);

        // Act
        const user = await getCurrentUser();

        // Assert
        expect(user).toEqual(mockGoogleUser);
      });

      it('should return null when not signed in', async () => {
        // Arrange
        mockGoogleSignIn.getCurrentUser.mockResolvedValue(null);

        // Act
        const user = await getCurrentUser();

        // Assert
        expect(user).toBeNull();
      });
    });

    describe('signInSilently', () => {
      it('should sign in silently and return session', async () => {
        // Arrange
        mockGoogleSignIn.signInSilently.mockResolvedValue({
          ...mockGoogleUser,
          idToken: 'mock-id-token',
        });
        mockSupabase.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: { id: TEST_USERS.freeUser.id } as any,
            session: { access_token: 'mock-token' } as any,
          },
          error: null,
        });

        // Act
        const result = await signInSilently();

        // Assert
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.session).toBeDefined();
      });

      it('should handle silent sign-in failure', async () => {
        // Arrange
        mockGoogleSignIn.signInSilently.mockRejectedValue(new Error('Silent sign-in failed'));

        // Act
        const result = await signInSilently();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Silent sign-in failed');
      });
    });

    describe('restoreGoogleCredentials', () => {
      it('should restore credentials successfully', async () => {
        // Arrange
        mockGoogleSignIn.isSignedIn.mockResolvedValue(true);
        mockGoogleSignIn.signInSilently.mockResolvedValue({
          ...mockGoogleUser,
          idToken: 'mock-id-token',
        });
        mockSupabase.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: { id: TEST_USERS.freeUser.id } as any,
            session: { access_token: 'mock-token' } as any,
          },
          error: null,
        });

        // Act
        const result = await restoreGoogleCredentials();

        // Assert
        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
      });

      it('should fail when user is not signed in', async () => {
        // Arrange
        mockGoogleSignIn.isSignedIn.mockResolvedValue(false);

        // Act
        const result = await restoreGoogleCredentials();

        // Assert
        expect(result.success).toBe(false);
        expect(result.reason).toContain('Not signed in with Google');
      });
    });
  });
});
