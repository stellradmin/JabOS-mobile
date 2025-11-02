/**
 * Enhanced Authentication Error Handler
 * Provides comprehensive error handling for authentication flows
 * with automatic recovery, session management, and user experience optimization
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { secureStorage } from './secure-storage';
import { supabase } from '../lib/supabase';
import {
  StellerError,
  AuthenticationError,
  ErrorHandlingOptions
} from '../types/error-types';
import {
  createAuthenticationError,
  createStellerError,
  convertToStellerError
} from '../utils/error-factory';
import EnhancedErrorMonitoringService from '../services/enhanced-error-monitoring-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

// Authentication state management
interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  session: any | null;
  lastAuthCheck: number;
  tokenRefreshInProgress: boolean;
  consecutiveFailures: number;
  lockoutUntil?: number;
  lastFailedOperation?: {
    operation: string;
    params?: any;
    timestamp: number;
    retryCount: number;
  };
}

// Auth error recovery strategies
interface AuthRecoveryStrategy {
  strategy: 'refresh-token' | 'silent-login' | 'force-login' | 'lockout' | 'fallback';
  maxAttempts: number;
  backoffDelay: number;
  requireUserAction: boolean;
}

// Session recovery configuration
interface SessionRecoveryConfig {
  enableAutoRefresh: boolean;
  refreshThreshold: number; // minutes before expiry
  maxRefreshAttempts: number;
  refreshRetryDelay: number;
  enableOfflineMode: boolean;
  offlineGracePeriod: number; // minutes
}

class EnhancedAuthErrorHandler {
  private static instance: EnhancedAuthErrorHandler;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    session: null,
    lastAuthCheck: 0,
    tokenRefreshInProgress: false,
    consecutiveFailures: 0
  };

  private recoveryConfig: SessionRecoveryConfig = {
    enableAutoRefresh: true,
    refreshThreshold: 10, // Refresh if less than 10 minutes remaining
    maxRefreshAttempts: 3,
    refreshRetryDelay: 5000, // 5 seconds
    enableOfflineMode: true,
    offlineGracePeriod: 60 // 1 hour
  };

  private errorMonitoring = EnhancedErrorMonitoringService.getInstance();
  private refreshTimer?: NodeJS.Timeout;
  private authCheckInterval?: NodeJS.Timeout;

  private constructor() {
    this.initializeAuthHandler();
  }

  static getInstance(): EnhancedAuthErrorHandler {
    if (!EnhancedAuthErrorHandler.instance) {
      EnhancedAuthErrorHandler.instance = new EnhancedAuthErrorHandler();
    }
    return EnhancedAuthErrorHandler.instance;
  }

  private async initializeAuthHandler(): Promise<void> {
    try {
      // Restore previous auth state
      await this.restoreAuthState();
      
      // Set up session monitoring
      this.startSessionMonitoring();
      
      // Set up automatic token refresh
      if (this.recoveryConfig.enableAutoRefresh) {
        this.startTokenRefreshTimer();
      }

      logDebug('✅ Enhanced Auth Error Handler initialized', "Debug");
    } catch (error) {
      logError('🚨 Failed to initialize auth error handler:', "Error", error);
    }
  }

  /**
   * Handle authentication errors with intelligent recovery
   */
  async handleAuthError(
    error: any,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): Promise<{ success: boolean; recoveryAction?: string; error?: StellerError }> {
    const stellarError = this.categorizeAuthError(error, context);
    
    // Track the error
    await this.errorMonitoring.reportError(stellarError, {
      ...context,
      authState: this.getPublicAuthState(),
      feature: 'authentication'
    }, options);

    // Update consecutive failures
    this.authState.consecutiveFailures++;
    await this.saveAuthState();

    // Check for lockout conditions
    if (this.shouldLockout()) {
      return await this.handleAuthLockout();
    }

    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(stellarError);
    
    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(stellarError, recoveryStrategy, context);
    
    // Handle recovery result
    if (recoveryResult.success) {
      this.authState.consecutiveFailures = 0;
      await this.saveAuthState();
    } else {
      // Show user-friendly error message
      await this.showUserErrorMessage(stellarError, recoveryResult);
    }

    return recoveryResult;
  }

  private categorizeAuthError(error: any, context?: Record<string, any>): AuthenticationError {
    // Handle Supabase auth errors
    if (error?.message?.includes('JWT expired') || error?.message?.includes('expired')) {
      return createAuthenticationError('AUTH_TOKEN_EXPIRED', {
        tokenExpired: true
      }, 'Your session has expired. Refreshing automatically...', context);
    }

    if (error?.message?.includes('Invalid login credentials') || error?.status === 401) {
      return createAuthenticationError('AUTH_CREDENTIALS_INVALID', {
        credentialsInvalid: true
      }, 'Invalid email or password. Please try again.', context);
    }

    if (error?.message?.includes('refresh_token_not_found') || error?.message?.includes('refresh')) {
      return createAuthenticationError('AUTH_REFRESH_FAILED', {
        refreshFailed: true
      }, 'Unable to refresh your session. Please log in again.', context);
    }

    if (error?.message?.includes('session_not_found') || error?.message?.includes('session')) {
      return createAuthenticationError('AUTH_SESSION_EXPIRED', {
        sessionInvalid: true
      }, 'Your session is no longer valid. Please log in again.', context);
    }

    // Handle network errors during auth
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
      return createAuthenticationError('AUTH_TOKEN_INVALID', {
        tokenExpired: false
      }, 'Connection issue during authentication. Please try again.', context);
    }

    // Default authentication error
    return createAuthenticationError('AUTH_TOKEN_INVALID', {
      tokenExpired: false
    }, error?.message || 'Authentication failed. Please try again.', context);
  }

  private determineRecoveryStrategy(error: AuthenticationError): AuthRecoveryStrategy {
    switch (error.code) {
      case 'AUTH_TOKEN_EXPIRED':
        return {
          strategy: 'refresh-token',
          maxAttempts: 3,
          backoffDelay: 1000,
          requireUserAction: false
        };

      case 'AUTH_REFRESH_FAILED':
        return {
          strategy: 'silent-login',
          maxAttempts: 2,
          backoffDelay: 2000,
          requireUserAction: false
        };

      case 'AUTH_SESSION_EXPIRED':
        return {
          strategy: 'force-login',
          maxAttempts: 1,
          backoffDelay: 0,
          requireUserAction: true
        };

      case 'AUTH_CREDENTIALS_INVALID':
        return {
          strategy: 'force-login',
          maxAttempts: 1,
          backoffDelay: 0,
          requireUserAction: true
        };

      default:
        return {
          strategy: 'fallback',
          maxAttempts: 2,
          backoffDelay: 3000,
          requireUserAction: true
        };
    }
  }

  private async attemptRecovery(
    error: AuthenticationError,
    strategy: AuthRecoveryStrategy,
    context?: Record<string, any>
  ): Promise<{ success: boolean; recoveryAction?: string; error?: StellerError }> {
    try {
      logDebug(`🔄 Attempting auth recovery with strategy: ${strategy.strategy}`, "Debug");

      switch (strategy.strategy) {
        case 'refresh-token':
          return await this.attemptTokenRefresh(strategy.maxAttempts);

        case 'silent-login':
          return await this.attemptSilentLogin(strategy.maxAttempts);

        case 'force-login':
          return await this.forceUserLogin();

        case 'lockout':
          return await this.handleAuthLockout();

        case 'fallback':
          return await this.attemptFallbackAuth();

        default:
          return { 
            success: false, 
            error: createStellerError('UNKNOWN_ERROR', 'Unknown recovery strategy') 
          };
      }
    } catch (recoveryError) {
      const stellarError = convertToStellerError(recoveryError, { 
        originalError: error, 
        recoveryStrategy: strategy.strategy 
      });
      
      return { success: false, error: stellarError };
    }
  }

  private async attemptTokenRefresh(maxAttempts: number): Promise<any> {
    if (this.authState.tokenRefreshInProgress) {
      logDebug('⏳ Token refresh already in progress, "Debug", waiting...');
      // Wait for existing refresh to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.authState.tokenRefreshInProgress) {
            clearInterval(checkInterval);
            resolve({ 
              success: this.authState.isAuthenticated, 
              recoveryAction: 'token-refresh-completed' 
            });
          }
        }, 500);
      });
    }

    this.authState.tokenRefreshInProgress = true;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        logDebug(`🔄 Token refresh attempt ${attempt}/${maxAttempts}`, "Debug");

        const { data, error } = await supabase.auth.refreshSession();
        
        if (!error && data.session) {
          logDebug('✅ Token refresh successful', "Debug");
          
          this.authState.session = data.session;
          this.authState.user = data.user;
          this.authState.isAuthenticated = true;
          this.authState.lastAuthCheck = Date.now();
          
          await this.saveAuthState();
          this.scheduleNextRefresh(data.session);
          
          return { success: true, recoveryAction: 'token-refreshed' };
        }

        if (attempt < maxAttempts) {
          logDebug(`⏳ Token refresh failed, "Debug", retrying in ${this.recoveryConfig.refreshRetryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, this.recoveryConfig.refreshRetryDelay));
        }
      }

      logDebug('❌ Token refresh failed after all attempts', "Debug");
      return { success: false, recoveryAction: 'token-refresh-failed' };

    } finally {
      this.authState.tokenRefreshInProgress = false;
    }
  }

  private async attemptSilentLogin(maxAttempts: number): Promise<any> {
    try {
      // Try to restore session from storage
      const storedSession = await secureStorage.getSecureItem('stellr_session_backup');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        
        // Check if backup session is still valid
        if (this.isSessionValid(sessionData)) {
          logDebug('✅ Silent login successful with backup session', "Debug");
          
          this.authState.session = sessionData;
          this.authState.isAuthenticated = true;
          this.authState.lastAuthCheck = Date.now();
          
          await this.saveAuthState();
          return { success: true, recoveryAction: 'silent-login-success' };
        }
      }

      // Try to get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!error && session) {
        logDebug('✅ Silent login successful with Supabase session', "Debug");
        
        this.authState.session = session;
        this.authState.user = session.user;
        this.authState.isAuthenticated = true;
        this.authState.lastAuthCheck = Date.now();
        
        await this.saveAuthState();
        return { success: true, recoveryAction: 'silent-login-success' };
      }

      return { success: false, recoveryAction: 'silent-login-failed' };

    } catch (error) {
      logError('❌ Silent login failed:', "Error", error);
      return { success: false, recoveryAction: 'silent-login-error' };
    }
  }

  private async forceUserLogin(): Promise<any> {
    logDebug('🔄 Forcing user login', "Debug");
    
    // Clear current auth state
    await this.clearAuthState();
    
    // This would typically navigate to login screen
    // For now, we'll return the action that should be taken
    return { 
      success: false, 
      recoveryAction: 'force-login-required',
      error: createStellerError('AUTH_SESSION_EXPIRED', 
        'Please log in again to continue')
    };
  }

  private async handleAuthLockout(): Promise<any> {
    const lockoutDuration = this.calculateLockoutDuration();
    this.authState.lockoutUntil = Date.now() + lockoutDuration;
    
    await this.saveAuthState();
    
    logDebug(`🔒 Account locked out for ${lockoutDuration / 1000} seconds`, "Debug");
    
    return {
      success: false,
      recoveryAction: 'account-locked',
      error: createStellerError('AUTH_PERMISSION_DENIED', 
        `Too many failed attempts. Please try again in ${Math.ceil(lockoutDuration / 60000)} minutes.`)
    };
  }

  private async attemptFallbackAuth(): Promise<any> {
    if (this.recoveryConfig.enableOfflineMode) {
      logDebug('🔄 Attempting offline mode fallback', "Debug");
      
      // Check if we're within the offline grace period
      const lastValidAuth = this.authState.lastAuthCheck;
      const gracePeriod = this.recoveryConfig.offlineGracePeriod * 60 * 1000;
      
      if (lastValidAuth && (Date.now() - lastValidAuth) < gracePeriod) {
        logDebug('✅ Offline mode activated within grace period', "Debug");
        return { 
          success: true, 
          recoveryAction: 'offline-mode-activated' 
        };
      }
    }

    return { 
      success: false, 
      recoveryAction: 'fallback-failed' 
    };
  }

  private shouldLockout(): boolean {
    if (this.authState.lockoutUntil && Date.now() < this.authState.lockoutUntil) {
      return true; // Still locked out
    }

    // Reset lockout if it has expired
    if (this.authState.lockoutUntil && Date.now() >= this.authState.lockoutUntil) {
      this.authState.lockoutUntil = undefined;
      this.authState.consecutiveFailures = 0;
    }

    // Lock out after 5 consecutive failures
    return this.authState.consecutiveFailures >= 5;
  }

  private calculateLockoutDuration(): number {
    const failures = this.authState.consecutiveFailures;
    
    // Exponential backoff: 5 min, 15 min, 30 min, 1 hour, 2 hours
    if (failures <= 5) return 5 * 60 * 1000; // 5 minutes
    if (failures <= 7) return 15 * 60 * 1000; // 15 minutes
    if (failures <= 10) return 30 * 60 * 1000; // 30 minutes
    if (failures <= 15) return 60 * 60 * 1000; // 1 hour
    return 2 * 60 * 60 * 1000; // 2 hours
  }

  private async showUserErrorMessage(
    error: AuthenticationError,
    recoveryResult: any
  ): Promise<void> {
    let title = 'Authentication Error';
    let message = error.userMessage;
    let buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'OK', style: 'default' }];

    switch (recoveryResult.recoveryAction) {
      case 'force-login-required':
        title = 'Session Expired';
        message = 'Your session has expired. Please log in again to continue.';
        buttons = [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => this.navigateToLogin() }
        ];
        break;

      case 'account-locked':
        title = 'Account Temporarily Locked';
        message = error.userMessage;
        buttons = [{ text: 'OK', style: 'default' }];
        break;

      case 'offline-mode-activated':
        title = 'Offline Mode';
        message = 'You\'re currently in offline mode. Some features may be limited.';
        buttons = [{ text: 'OK', style: 'default' }];
        break;

      default:
        buttons = [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => this.retryLastOperation() },
          { text: 'Report Issue', onPress: () => this.reportAuthIssue(error) }
        ];
    }

    Alert.alert(title, message, buttons);
  }

  private startSessionMonitoring(): void {
    // Check session validity every 5 minutes
    this.authCheckInterval = setInterval(async () => {
      await this.checkSessionValidity();
    }, 5 * 60 * 1000);
  }

  private startTokenRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.authState.session) {
      return;
    }

    const expiresAt = this.authState.session.expires_at * 1000;
    const refreshAt = expiresAt - (this.recoveryConfig.refreshThreshold * 60 * 1000);
    const delay = Math.max(refreshAt - Date.now(), 60000); // Minimum 1 minute delay

    logDebug(`⏰ Scheduling token refresh in ${Math.ceil(delay / 60000)} minutes`, "Debug");

    this.refreshTimer = setTimeout(async () => {
      if (this.authState.isAuthenticated) {
        await this.attemptTokenRefresh(this.recoveryConfig.maxRefreshAttempts);
      }
    }, delay);
  }

  private scheduleNextRefresh(session: any): void {
    this.startTokenRefreshTimer();
  }

  private async checkSessionValidity(): Promise<void> {
    if (!this.authState.session) {
      return;
    }

    const expiresAt = this.authState.session.expires_at * 1000;
    if (Date.now() >= expiresAt) {
      logDebug('⚠️ Session expired, "Debug", attempting refresh');
      await this.attemptTokenRefresh(this.recoveryConfig.maxRefreshAttempts);
    }
  }

  private isSessionValid(session: any): boolean {
    if (!session || !session.expires_at) {
      return false;
    }

    return Date.now() < (session.expires_at * 1000);
  }

  private async saveAuthState(): Promise<void> {
    try {
      const stateToSave = {
        ...this.authState,
        session: null // Don't store sensitive session data
      };
      
      await secureStorage.storeSecureItem('stellr_auth_state', JSON.stringify(stateToSave));
      
      // Backup session separately if it exists
      if (this.authState.session) {
        await secureStorage.storeSecureItem('stellr_session_backup', JSON.stringify(this.authState.session));
      }
    } catch (error) {
      logError('❌ Failed to save auth state:', "Error", error);
    }
  }

  private async restoreAuthState(): Promise<void> {
    try {
      const storedState = await secureStorage.getSecureItem('stellr_auth_state');
      if (storedState) {
        const state = JSON.parse(storedState);
        this.authState = { ...this.authState, ...state };
      }

      // Try to restore session
      const storedSession = await secureStorage.getSecureItem('stellr_session_backup');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        if (this.isSessionValid(session)) {
          this.authState.session = session;
          this.authState.isAuthenticated = true;
        }
      }
    } catch (error) {
      logError('❌ Failed to restore auth state:', "Error", error);
    }
  }

  private async clearAuthState(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
      user: null,
      session: null,
      lastAuthCheck: 0,
      tokenRefreshInProgress: false,
      consecutiveFailures: 0
    };

    await AsyncStorage.multiRemove([
      'stellr_auth_state',
      'stellr_session_backup'
    ]);
  }

  private getPublicAuthState(): any {
    return {
      isAuthenticated: this.authState.isAuthenticated,
      hasUser: !!this.authState.user,
      lastAuthCheck: this.authState.lastAuthCheck,
      consecutiveFailures: this.authState.consecutiveFailures,
      isLocked: !!this.authState.lockoutUntil && Date.now() < this.authState.lockoutUntil
    };
  }

  // Public interface methods
  public getAuthState(): any {
    return this.getPublicAuthState();
  }

  public async refreshSession(): Promise<boolean> {
    const result = await this.attemptTokenRefresh(this.recoveryConfig.maxRefreshAttempts);
    return result.success;
  }

  public async clearSession(): Promise<void> {
    await this.clearAuthState();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  /**
   * Navigate to login screen with proper error context
   */
  private navigateToLogin(): void {
    try {
      logDebug('🔄 Navigating to login screen', "Debug");
      
      // Clear current session data
      this.clearAuthState();
      
      // Navigate using expo-router
      router.replace('/login' as any);
      
      logUserAction('AUTH_NAVIGATE_TO_LOGIN', undefined, { 
        reason: 'authentication_error',
        timestamp: new Date().toISOString()
      });
    } catch (navigationError) {
      logError('Failed to navigate to login:', "Error", navigationError);
      
      // Fallback: Show alert if navigation fails
      Alert.alert(
        'Authentication Required',
        'Please restart the app and log in again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Could trigger app restart if needed
            }
          }
        ]
      );
    }
  }

  /**
   * Retry the last failed operation if available
   */
  private async retryLastOperation(): Promise<void> {
    try {
      const lastOperation = this.authState.lastFailedOperation;
      
      if (!lastOperation) {
        logWarn('No previous operation to retry', "Warning");
        return;
      }
      
      // Check if operation is not too old (max 5 minutes)
      const maxRetryAge = 5 * 60 * 1000; // 5 minutes
      const operationAge = Date.now() - lastOperation.timestamp;
      
      if (operationAge > maxRetryAge) {
        logWarn('Previous operation too old to retry', "Warning", {
          age: operationAge,
          operation: lastOperation.operation
        });
        this.clearFailedOperation();
        return;
      }
      
      // Check retry limit
      if (lastOperation.retryCount >= 3) {
        logWarn('Maximum retry attempts exceeded', "Warning", {
          operation: lastOperation.operation,
          retryCount: lastOperation.retryCount
        });
        this.clearFailedOperation();
        return;
      }
      
      logDebug('🔄 Retrying last operation:', "Debug", {
        operation: lastOperation.operation,
        retryCount: lastOperation.retryCount + 1
      });
      
      // Increment retry count
      if (this.authState.lastFailedOperation) {
        this.authState.lastFailedOperation.retryCount += 1;
      }
      
      // Attempt to retry based on operation type
      await this.executeOperation(lastOperation.operation, lastOperation.params);
      
      // Clear failed operation on success
      this.clearFailedOperation();
      
      logUserAction('AUTH_OPERATION_RETRIED', undefined, {
        operation: lastOperation.operation,
        successful: true,
        retryCount: lastOperation.retryCount
      });
      
    } catch (retryError) {
      logError('Failed to retry operation:', "Error", retryError, {
        operation: this.authState.lastFailedOperation?.operation
      });
      
      // Don't clear failed operation so user can try again later
      logUserAction('AUTH_OPERATION_RETRY_FAILED', undefined, {
        operation: this.authState.lastFailedOperation?.operation,
        error: (retryError as any)?.message
      });
    }
  }

  /**
   * Show issue reporting dialog for authentication problems
   */
  private reportAuthIssue(error: AuthenticationError): void {
    try {
      logDebug('📝 Showing auth issue report dialog', "Debug", {
        errorCode: error.code,
        errorMessage: error.message
      });
      
      Alert.alert(
        'Authentication Issue',
        'We detected an authentication problem. Would you like to report this issue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              logUserAction('AUTH_ISSUE_REPORT_CANCELLED', 'Auth', {
                errorCode: error.code,
              });
            }
          },
          {
            text: 'Report Issue',
            onPress: async () => {
              await this.submitIssueReport(error);
            }
          }
        ]
      );
    } catch (alertError) {
      logError('Failed to show issue report dialog:', "Error", alertError);
    }
  }
  
  /**
   * Execute a specific operation (for retry functionality)
   */
  private async executeOperation(operation: string, params?: any): Promise<void> {
    switch (operation) {
      case 'signIn':
        if (params?.email && params?.password) {
          const { error } = await supabase.auth.signInWithPassword({
            email: params.email,
            password: params.password
          });
          if (error) throw error;
        }
        break;
        
      case 'refreshToken':
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        break;
        
      case 'signOut':
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Submit issue report to backend
   */
  private async submitIssueReport(error: AuthenticationError): Promise<void> {
    try {
      const issueReport = {
        error_code: error.code,
        error_message: error.message,
        user_agent: (typeof navigator !== 'undefined' && (navigator as any).userAgent) || 'Unknown',
        timestamp: new Date().toISOString(),
        auth_state: {
          isAuthenticated: this.authState.isAuthenticated,
          lastAuthCheck: this.authState.lastAuthCheck,
          consecutiveFailures: this.authState.consecutiveFailures
        },
        technical_details: error.technicalDetails || {},
        user_id: this.authState.user?.id || null
      };
      
      const { error: reportError } = await supabase
        .from('auth_issue_reports')
        .insert(issueReport);
      
      if (reportError) {
        throw reportError;
      }
      
      Alert.alert(
        'Issue Reported',
        'Thank you for reporting this issue. Our team will investigate and improve the authentication experience.',
        [{ text: 'OK' }]
      );
      
      logUserAction('AUTH_ISSUE_REPORTED', undefined, {
        errorCode: error.code,
        reportTimestamp: new Date().toISOString()
      });
      
    } catch (reportError) {
      logError('Failed to submit issue report:', "Error", reportError);
      
      Alert.alert(
        'Report Failed',
        'Unable to submit the issue report. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }
  
  /**
   * Store failed operation for retry
   */
  private storeFailedOperation(operation: string, params?: any): void {
    this.authState.lastFailedOperation = {
      operation,
      params,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    logDebug('Stored failed operation for retry:', "Debug", {
      operation,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Clear failed operation data
   */
  private clearFailedOperation(): void {
    if (this.authState.lastFailedOperation) {
      logDebug('Clearing failed operation:', "Debug", {
        operation: this.authState.lastFailedOperation.operation
      });
      this.authState.lastFailedOperation = undefined;
    }
  }

  // Cleanup
  public destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }
  }
}

export default EnhancedAuthErrorHandler;
// @ts-nocheck
