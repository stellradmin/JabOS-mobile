/**
 * Authentication and Authorization Error Handling Utilities
 * Provides comprehensive error handling for auth flows with automatic recovery
 */

import { supabase } from '../lib/supabase';
import {
  createAuthenticationError,
  createStellerError,
  convertToStellerError
} from './error-factory';
import { StellerError, ErrorHandlingOptions } from '../types/error-types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

// Authentication state for recovery mechanisms
interface AuthState {
  isRefreshing: boolean;
  refreshPromise: Promise<void> | null;
  lastRefreshAttempt: number;
  refreshAttempts: number;
}

// Global auth state management
let authState: AuthState = {
  isRefreshing: false,
  refreshPromise: null,
  lastRefreshAttempt: 0,
  refreshAttempts: 0
};

// Auth error recovery strategies
export interface AuthRecoveryOptions extends ErrorHandlingOptions {
  maxRefreshAttempts?: number;
  refreshCooldown?: number;
  forceLogout?: boolean;
  redirectTo?: string;
  onAuthRecover?: () => void;
  onAuthFailed?: (error: StellerError) => void;
}

/**
 * Enhanced authentication error handler with automatic recovery
 */
export async function handleAuthError(
  error: any,
  options: AuthRecoveryOptions = {}
): Promise<{ success: boolean; error?: StellerError; recovered?: boolean }> {
  const {
    maxRefreshAttempts = 3,
    refreshCooldown = 30000, // 30 seconds
    forceLogout = false,
    onAuthRecover,
    onAuthFailed
  } = options;

  logDebug('🔐 Handling authentication error:', "Debug", error);

  // Convert to standardized error format
  const stellarError = convertToStellerError(error, {
    operation: 'authentication',
    timestamp: new Date().toISOString()
  });

  // Determine if this is a recoverable auth error
  const isRecoverable = isRecoverableAuthError(stellarError);
  
  if (!isRecoverable || forceLogout) {
    logDebug('❌ Auth error not recoverable or forced logout', "Debug");
    await handleAuthFailure(stellarError, options);
    if (onAuthFailed) onAuthFailed(stellarError);
    return { success: false, error: stellarError };
  }

  // Attempt recovery for recoverable errors
  try {
    const recovered = await attemptAuthRecovery(stellarError, {
      maxRefreshAttempts,
      refreshCooldown
    });

    if (recovered) {
      logDebug('✅ Authentication recovered successfully', "Debug");
      if (onAuthRecover) onAuthRecover();
      return { success: true, recovered: true };
    } else {
      logDebug('❌ Authentication recovery failed', "Debug");
      await handleAuthFailure(stellarError, options);
      if (onAuthFailed) onAuthFailed(stellarError);
      return { success: false, error: stellarError };
    }
  } catch (recoveryError) {
    logError('🚨 Auth recovery attempt failed:', "Error", recoveryError);
    const finalError = convertToStellerError(recoveryError);
    await handleAuthFailure(finalError, options);
    if (onAuthFailed) onAuthFailed(finalError);
    return { success: false, error: finalError };
  }
}

/**
 * Determine if an authentication error is recoverable
 */
function isRecoverableAuthError(error: StellerError): boolean {
  const recoverableCodes = [
    'AUTH_TOKEN_EXPIRED',
    'AUTH_SESSION_EXPIRED',
    'NETWORK_TIMEOUT',
    'NETWORK_FAILED'
  ];

  return recoverableCodes.includes(error.code) && 
         error.severity !== 'critical';
}

/**
 * Attempt to recover from authentication errors
 */
async function attemptAuthRecovery(
  error: StellerError,
  options: { maxRefreshAttempts: number; refreshCooldown: number }
): Promise<boolean> {
  const { maxRefreshAttempts, refreshCooldown } = options;
  
  // Check if we're already refreshing
  if (authState.isRefreshing && authState.refreshPromise) {
    logDebug('⏳ Auth refresh already in progress, "Debug", waiting...');
    await authState.refreshPromise;
    return await verifyAuthRecovery();
  }

  // Check cooldown period
  const timeSinceLastAttempt = Date.now() - authState.lastRefreshAttempt;
  if (timeSinceLastAttempt < refreshCooldown) {
    logDebug(`⏳ Auth refresh cooldown active, "Debug", waiting ${refreshCooldown - timeSinceLastAttempt}ms`);
    return false;
  }

  // Check max attempts
  if (authState.refreshAttempts >= maxRefreshAttempts) {
    logDebug(`❌ Max auth refresh attempts reached: ${authState.refreshAttempts}/${maxRefreshAttempts}`, "Debug");
    return false;
  }

  // Attempt token refresh
  authState.isRefreshing = true;
  authState.lastRefreshAttempt = Date.now();
  authState.refreshAttempts++;

  try {
    authState.refreshPromise = performTokenRefresh();
    await authState.refreshPromise;
    
    // Verify the refresh was successful
    const isRecovered = await verifyAuthRecovery();
    
    if (isRecovered) {
      // Reset attempts on successful recovery
      authState.refreshAttempts = 0;
    }
    
    return isRecovered;
  } finally {
    authState.isRefreshing = false;
    authState.refreshPromise = null;
  }
}

/**
 * Perform the actual token refresh operation
 */
async function performTokenRefresh(): Promise<void> {
  logDebug('🔄 Attempting token refresh...', "Debug");
  
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      throw createAuthenticationError('AUTH_REFRESH_FAILED', {
        refreshFailed: true
      }, `Token refresh failed: ${error.message}`);
    }

    if (!data?.session) {
      throw createAuthenticationError('AUTH_REFRESH_FAILED', {
        refreshFailed: true,
        sessionInvalid: true
      }, 'No session returned from refresh');
    }

    logDebug('✅ Token refresh successful', "Debug");
  } catch (error) {
    logError('🚨 Token refresh error:', "Error", error);
    throw error;
  }
}

/**
 * Verify that authentication recovery was successful
 */
async function verifyAuthRecovery(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logError('❌ Auth verification failed:', "Error", error);
      return false;
    }

    if (!session || !session.access_token) {
      logDebug('❌ No valid session after recovery attempt', "Debug");
      return false;
    }

    // Additional validation - check token expiry
    const tokenExp = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    
    if (tokenExp && tokenExp <= now) {
      logDebug('❌ Token still expired after refresh', "Debug");
      return false;
    }

    logDebug('✅ Auth recovery verification successful', "Debug");
    return true;
  } catch (error) {
    logError('🚨 Auth verification error:', "Error", error);
    return false;
  }
}

/**
 * Handle authentication failure by cleaning up and redirecting
 */
async function handleAuthFailure(
  error: StellerError,
  options: AuthRecoveryOptions
): Promise<void> {
  logDebug('🚪 Handling authentication failure', "Debug");

  try {
    // Clear local session data
    await supabase.auth.signOut({ scope: 'local' });
    
    // Reset auth state
    authState = {
      isRefreshing: false,
      refreshPromise: null,
      lastRefreshAttempt: 0,
      refreshAttempts: 0
    };

    // Log security event
    logWarn('🔒 User logged out due to auth failure:', "Warning", {
      errorCode: error.code,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });

  } catch (signOutError) {
    logError('🚨 Error during auth cleanup:', "Error", signOutError);
  }
}

/**
 * Enhanced auth wrapper for API calls with automatic retry
 */
export async function withAuthRetry<T>(
  operation: () => Promise<T>,
  options: AuthRecoveryOptions = {}
): Promise<T> {
  const maxAttempts = 2;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      logDebug(`🔄 Auth-protected operation failed (attempt ${attempt}/${maxAttempts}, "Debug"):`, error);

      // Only retry on auth errors and if we have attempts left
      if (attempt < maxAttempts && isAuthRelatedError(error)) {
        const recovery = await handleAuthError(error, {
          ...options,
          silent: true // Don't show UI during auto-retry
        });

        if (recovery.success) {
          logDebug('✅ Auth recovered, "Debug", retrying operation...');
          continue; // Retry the operation
        }
      }

      // If we get here, either it's not an auth error or recovery failed
      break;
    }
  }

  // All attempts failed
  throw lastError;
}

/**
 * Check if an error is authentication-related
 */
function isAuthRelatedError(error: any): boolean {
  const stellarError = convertToStellerError(error);
  return stellarError.category === 'authentication' ||
         stellarError.code.startsWith('AUTH_') ||
         (typeof error === 'object' && error?.status === 401);
}

/**
 * Enhanced session validation with health check
 */
export async function validateSession(): Promise<{
  valid: boolean;
  session: any | null;
  error?: StellarError;
}> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return {
        valid: false,
        session: null,
        error: createAuthenticationError('AUTH_SESSION_EXPIRED', {
          sessionInvalid: true
        }, `Session validation failed: ${error.message}`)
      };
    }

    if (!session) {
      return {
        valid: false,
        session: null,
        error: createAuthenticationError('AUTH_SESSION_EXPIRED', {
          sessionInvalid: true
        }, 'No active session found')
      };
    }

    // Check token expiry with buffer
    const now = Math.floor(Date.now() / 1000);
    const tokenExp = session.expires_at;
    const bufferMinutes = 5; // Refresh 5 minutes before expiry
    
    if (tokenExp && tokenExp <= (now + bufferMinutes * 60)) {
      logDebug('⚠️ Token expires soon, "Debug", attempting refresh...');
      
      try {
        await performTokenRefresh();
        const refreshedResult = await validateSession();
        return refreshedResult;
      } catch (refreshError) {
        return {
          valid: false,
          session: null,
          error: createAuthenticationError('AUTH_TOKEN_EXPIRED', {
            tokenExpired: true,
            refreshFailed: true
          }, 'Token expired and refresh failed')
        };
      }
    }

    return {
      valid: true,
      session,
      error: undefined
    };
  } catch (error) {
    return {
      valid: false,
      session: null,
      error: convertToStellerError(error, { operation: 'validateSession' })
    };
  }
}

/**
 * Permission check with detailed error reporting
 */
export function checkPermission(
  requiredRole: string | string[],
  userRole?: string
): { hasPermission: boolean; error?: StellarError } {
  if (!userRole) {
    return {
      hasPermission: false,
      error: createStellerError('AUTH_PERMISSION_DENIED', 
        'User role not available for permission check')
    };
  }

  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasPermission = requiredRoles.includes(userRole);

  if (!hasPermission) {
    return {
      hasPermission: false,
      error: createStellerError('AUTH_INSUFFICIENT_PRIVILEGES', 
        `Required role(s): ${requiredRoles.join(', ')}, user role: ${userRole}`)
    };
  }

  return { hasPermission: true };
}

/**
 * Reset auth state (useful for testing or manual recovery)
 */
export function resetAuthState(): void {
  authState = {
    isRefreshing: false,
    refreshPromise: null,
    lastRefreshAttempt: 0,
    refreshAttempts: 0
  };
  logDebug('🔄 Auth state reset', "Debug");
}

/**
 * Get current auth state for debugging
 */
export function getAuthState(): AuthState {
  return { ...authState };
}
