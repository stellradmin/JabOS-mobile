/**
 * Notification Deep Link Service for Stellr Dating App
 * Single Responsibility: Handles deep linking from notifications
 * Security by Design: Validates and sanitizes deep link parameters
 * Following all 10 Golden Code Principles
 */
import { secureStorage } from '../utils/secure-storage';
import { inputSanitizer } from '../utils/enhanced-input-sanitization';

import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  DeepLinkConfig,
  NotificationServiceError,
  StellarNotification
} from '../types/notification-types';

// Deep Link Route Configuration following Least Surprise Principle
interface DeepLinkRoute {
  readonly screen: string;
  readonly component: string;
  readonly requiresAuth: boolean;
  readonly requiresOnboarding: boolean;
  readonly paramValidation?: Record<string, (value: any) => boolean>;
  readonly allowedRoles?: string[];
}

// Navigation Result Interface following Command Query Separation
export interface NavigationResult {
  readonly success: boolean;
  readonly action: 'navigate' | 'authenticate' | 'onboard' | 'external' | 'blocked';
  readonly screen?: string;
  readonly params?: Record<string, any>;
  readonly error?: string;
  readonly requiresModal?: boolean;
}

// Background Task Interface for queued navigation
interface PendingNavigation {
  readonly id: string;
  readonly deepLink: DeepLinkConfig;
  readonly timestamp: Date;
  attempts: number;
  readonly maxAttempts: number;
}

/**
 * Service for handling deep links from notifications with comprehensive validation
 * Manages authentication requirements, parameter validation, and fallback handling
 */
export class NotificationDeepLinkService {
  private static instance: NotificationDeepLinkService | null = null;
  
  private readonly routes: Map<string, DeepLinkRoute> = new Map();
  private readonly pendingNavigations: Map<string, PendingNavigation> = new Map();
  
  private isInitialized = false;
  private currentUserId: string | null = null;
  private currentUserRole: string | null = null;
  private isUserOnboarded = false;

  // Private constructor following Singleton Pattern
  private constructor() {
    this.initializeRoutes();
  }

  /**
   * Factory method for singleton instance
   */
  public static getInstance(): NotificationDeepLinkService {
    if (!NotificationDeepLinkService.instance) {
      NotificationDeepLinkService.instance = new NotificationDeepLinkService();
    }
    return NotificationDeepLinkService.instance;
  }

  /**
   * Initialize the service with user context
   * Following Fail Fast principle with proper validation
   */
  public async initialize(userId: string, userRole?: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) {
      return;
    }

    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new NotificationServiceError(
          'Invalid user ID provided for deep link service',
          'INVALID_USER_ID',
          false
        );
      }

      this.currentUserId = userId;
      this.currentUserRole = userRole || 'user';
      
      // Check onboarding status
      await this.checkOnboardingStatus(userId);
      
      // Process any pending navigations
      await this.processPendingNavigations();
      
      this.isInitialized = true;
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to initialize deep link service: ${error.message}`,
        'INITIALIZATION_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Handle deep link navigation with comprehensive validation
   * Following Security by Design and Fail Fast principles
   */
  public async handleDeepLink(deepLink: DeepLinkConfig): Promise<NavigationResult> {
    try {
      // Validate deep link configuration
      this.validateDeepLinkConfig(deepLink);
      
      // Get route configuration
      const route = this.routes.get(deepLink.screen);
      if (!route) {
        return this.handleUnknownRoute(deepLink);
      }

      // Validate parameters
      const validatedParams = this.validateParameters(deepLink.params || {}, route);
      if (!validatedParams.valid) {
        return {
          success: false,
          action: 'blocked',
          error: `Invalid parameters: ${validatedParams.error}`,
        };
      }

      // Check authentication requirements
      if (route.requiresAuth && !this.currentUserId) {
        return await this.handleAuthenticationRequired(deepLink);
      }

      // Check role permissions
      if (route.allowedRoles && !this.hasRequiredRole(route.allowedRoles)) {
        return {
          success: false,
          action: 'blocked',
          error: 'Insufficient permissions for this action',
        };
      }

      // Check onboarding requirements
      if (route.requiresOnboarding && !this.isUserOnboarded) {
        return await this.handleOnboardingRequired(deepLink);
      }

      // Execute navigation
      return await this.executeNavigation(route, validatedParams.params);
      
    } catch (error) {
      return await this.handleNavigationError(deepLink, error);
    }
  }

  /**
   * Queue navigation for later when user is authenticated
   * Following Command Pattern
   */
  public async queuePendingNavigation(deepLink: DeepLinkConfig): Promise<string> {
    const navigationId = `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingNavigation: PendingNavigation = {
      id: navigationId,
      deepLink,
      timestamp: new Date(),
      attempts: 0,
      maxAttempts: 3,
    };

    this.pendingNavigations.set(navigationId, pendingNavigation);
    
    // Persist to storage for app restart recovery
    await this.savePendingNavigation(pendingNavigation);
    
    return navigationId;
  }

  /**
   * Process queued navigations after authentication
   * Following Command Pattern
   */
  public async processPendingNavigations(): Promise<void> {
    if (!this.currentUserId) {
      return;
    }

    const pendingNavigations = Array.from(this.pendingNavigations.values());
    
    for (const pending of pendingNavigations) {
      try {
        const result = await this.handleDeepLink(pending.deepLink);
        
        if (result.success) {
          // Remove successful navigation
          this.pendingNavigations.delete(pending.id);
          await this.removePendingNavigation(pending.id);
        } else {
          // Increment attempt count
          pending.attempts++;
          
          if (pending.attempts >= pending.maxAttempts) {
            // Remove failed navigation after max attempts
            this.pendingNavigations.delete(pending.id);
            await this.removePendingNavigation(pending.id);
          }
        }
        
      } catch (error) {
        logWarn(`Failed to process pending navigation ${pending.id}:`, "Warning", error);
      }
    }
  }

  /**
   * Check if a deep link is valid and accessible
   * Following Query Pattern
   */
  public canHandleDeepLink(deepLink: DeepLinkConfig): boolean {
    try {
      this.validateDeepLinkConfig(deepLink);
      
      const route = this.routes.get(deepLink.screen);
      if (!route) {
        return false;
      }

      // Check authentication if required
      if (route.requiresAuth && !this.currentUserId) {
        return false;
      }

      // Check role permissions
      if (route.allowedRoles && !this.hasRequiredRole(route.allowedRoles)) {
        return false;
      }

      // Check parameter validation
      const validatedParams = this.validateParameters(deepLink.params || {}, route);
      return validatedParams.valid;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate deep link URL for sharing
   * Following Query Pattern
   */
  public generateDeepLinkUrl(deepLink: DeepLinkConfig): string {
    try {
      this.validateDeepLinkConfig(deepLink);
      
      const baseUrl = 'stellr://';
      const params = new URLSearchParams();
      
      // Add screen
      params.set('screen', deepLink.screen);
      
      // Add parameters
      if (deepLink.params) {
        Object.entries(deepLink.params).forEach(([key, value]) => {
          params.set(key, String(value));
        });
      }

      return `${baseUrl}?${params.toString()}`;
      
    } catch (error) {
      return deepLink.fallbackUrl || 'stellr://';
    }
  }

  /**
   * Parse incoming deep link URL with comprehensive security validation
   * Following Query Pattern with Fail Fast validation and threat detection
   */
  public parseDeepLinkUrl(url: string): DeepLinkConfig | null {
    try {
      if (!url || typeof url !== 'string') {
        logWarn('Invalid deep link input: non-string or empty URL', "Warning");
        return null;
      }

      // SECURITY: Comprehensive URL validation and sanitization
      const urlValidation = inputSanitizer.validateUrl(url);
      if (!urlValidation.valid) {
        logError('Deep link security validation failed', undefined, {
          url,
          threats: urlValidation.threats
        }, 'SECURITY');
        return null;
      }

      // Use sanitized URL for further processing
      const sanitizedUrl = urlValidation.sanitized;

      // Protocol validation - only allow stellr protocol
      if (!sanitizedUrl.startsWith('stellr://')) {
        logWarn('Deep link protocol validation failed', "Warning", { 
          url: sanitizedUrl,
          expectedProtocol: 'stellr://'
        });
        return null;
      }

      // Remove protocol and parse path
      const cleanUrl = sanitizedUrl.replace(/^stellr:\/\//, '');
      const [path, queryString] = cleanUrl.split('?');
      
      // SECURITY: Sanitize path component
      const pathSanitization = inputSanitizer.sanitizeInput(path || '', {
        maxLength: 100,
        allowedTags: [],
        allowedAttributes: []
      });

      if (!pathSanitization.safe) {
        logError('Deep link path contains threats', undefined, {
          path,
          threats: pathSanitization.threats
        }, 'SECURITY');
        return null;
      }

      const sanitizedPath = pathSanitization.sanitized;
      
      // SECURITY: Sanitize query parameters
      const params: Record<string, string | number> = {};
      
      if (queryString) {
        const urlParams = new URLSearchParams(queryString);
        const rawParams: Record<string, any> = {};
        
        urlParams.forEach((value, key) => {
          rawParams[key] = value;
        });

        // Use enhanced sanitization for deep link parameters
        const sanitizedParams = inputSanitizer.sanitizeDeepLinkParams(rawParams);
        
        // Validate each parameter
        Object.entries(sanitizedParams).forEach(([key, value]) => {
          // Additional validation for specific parameter types
          if (key === 'userId' || key === 'id') {
            // UUID validation for ID parameters
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
              logWarn('Invalid ID format in deep link parameter', "Warning", { key, value });
              return;
            }
          }
          
          // Try to convert numbers safely
          const numValue = Number(value);
          params[key] = (isNaN(numValue) || value === '') ? value : numValue;
        });
      }

      // SECURITY: Validate screen parameter
      const screen = (params.screen as string) || sanitizedPath || 'Dashboard';
      delete params.screen;

      // Screen allowlist - only allow known safe screens
      const allowedScreens = [
        'Dashboard', 'Profile', 'Messages', 'Matches', 'Settings',
        'Conversation', 'UserProfile', 'Notifications', 'Help'
      ];

      if (!allowedScreens.includes(screen)) {
        logError('Deep link navigation to unauthorized screen blocked', undefined, {
          requestedScreen: screen,
          allowedScreens
        }, 'SECURITY');
        return null;
      }

      // SECURITY: Log successful deep link parsing for audit
      logInfo('Deep link parsed successfully', undefined, {
        screen,
        paramCount: Object.keys(params).length,
        hasParams: Object.keys(params).length > 0
      }, 'SECURITY');

      return {
        screen,
        params: Object.keys(params).length > 0 ? params : undefined,
        requiresAuth: true, // Always require auth for security
      };
      
    } catch (error) {
      logError('Deep link parsing failed', error instanceof Error ? error : undefined, { url }, 'SECURITY');
      return null;
    }
  }

  /**
   * Clear all pending navigations
   * Following Command Pattern
   */
  public async clearPendingNavigations(): Promise<void> {
    const pendingIds = Array.from(this.pendingNavigations.keys());
    
    this.pendingNavigations.clear();
    
    // Remove from storage
    await Promise.all(
      pendingIds.map(id => this.removePendingNavigation(id))
    );
  }

  /**
   * Update user context when authentication status changes
   * Following Command Pattern
   */
  public updateUserContext(userId: string | null, userRole?: string): void {
    this.currentUserId = userId;
    this.currentUserRole = userRole || 'user';
    
    if (userId) {
      // Process pending navigations when user logs in
      this.processPendingNavigations().catch(error => 
        logWarn('Failed to process pending navigations:', "Warning", error)
      );
    } else {
      // Clear context when user logs out
      this.isUserOnboarded = false;
    }
  }

  // PRIVATE HELPER METHODS following Single Responsibility Principle

  private initializeRoutes(): void {
    // Define all available routes with their configurations
    const routes: Array<[string, DeepLinkRoute]> = [
      ['Dashboard', {
        screen: 'Dashboard',
        component: 'DashboardScreen',
        requiresAuth: true,
        requiresOnboarding: true,
      }],
      ['MatchDetail', {
        screen: 'MatchDetail',
        component: 'MatchDetailScreen',
        requiresAuth: true,
        requiresOnboarding: true,
        paramValidation: {
          matchId: (value) => typeof value === 'string' && value.length > 0,
          userId: (value) => typeof value === 'string' && value.length > 0,
        },
      }],
      ['Conversation', {
        screen: 'Conversation',
        component: 'ConversationScreen',
        requiresAuth: true,
        requiresOnboarding: true,
        paramValidation: {
          conversationId: (value) => typeof value === 'string' && value.length > 0,
        },
      }],
      ['Profile', {
        screen: 'Profile',
        component: 'ProfileScreen',
        requiresAuth: true,
        requiresOnboarding: true,
        paramValidation: {
          userId: (value) => typeof value === 'string' && value.length > 0,
        },
      }],
      ['ProfileVisitors', {
        screen: 'ProfileVisitors',
        component: 'ProfileVisitorsScreen',
        requiresAuth: true,
        requiresOnboarding: true,
        allowedRoles: ['premium', 'admin'],
      }],
      ['SuperLikeDetail', {
        screen: 'SuperLikeDetail',
        component: 'SuperLikeDetailScreen',
        requiresAuth: true,
        requiresOnboarding: true,
        paramValidation: {
          likerId: (value) => typeof value === 'string' && value.length > 0,
        },
      }],
      ['DateDetail', {
        screen: 'DateDetail',
        component: 'DateDetailScreen',
        requiresAuth: true,
        requiresOnboarding: true,
        paramValidation: {
          dateId: (value) => typeof value === 'string' && value.length > 0,
        },
      }],
      ['SecurityAlert', {
        screen: 'SecurityAlert',
        component: 'SecurityAlertScreen',
        requiresAuth: true,
        requiresOnboarding: false, // Security alerts bypass onboarding
        paramValidation: {
          alertId: (value) => typeof value === 'string' && value.length > 0,
        },
      }],
      ['Announcements', {
        screen: 'Announcements',
        component: 'AnnouncementsScreen',
        requiresAuth: false,
        requiresOnboarding: false,
      }],
      ['WebView', {
        screen: 'WebView',
        component: 'WebViewScreen',
        requiresAuth: false,
        requiresOnboarding: false,
        paramValidation: {
          url: (value) => typeof value === 'string' && this.isValidUrl(value),
        },
      }],
    ];

    routes.forEach(([screen, route]) => {
      this.routes.set(screen, route);
    });
  }

  private validateDeepLinkConfig(deepLink: DeepLinkConfig): void {
    if (!deepLink || typeof deepLink !== 'object') {
      throw new NotificationServiceError(
        'Invalid deep link configuration',
        'INVALID_DEEP_LINK',
        false
      );
    }

    if (!deepLink.screen || typeof deepLink.screen !== 'string') {
      throw new NotificationServiceError(
        'Deep link must have a valid screen name',
        'INVALID_SCREEN',
        false
      );
    }
  }

  private validateParameters(
    params: Record<string, any>,
    route: DeepLinkRoute
  ): { valid: boolean; params: Record<string, any>; error?: string } {
    if (!route.paramValidation) {
      return { valid: true, params };
    }

    const validatedParams: Record<string, any> = {};

    for (const [key, validator] of Object.entries(route.paramValidation)) {
      const value = params[key];
      
      if (value === undefined) {
        return {
          valid: false,
          params: {},
          error: `Missing required parameter: ${key}`,
        };
      }

      if (!validator(value)) {
        return {
          valid: false,
          params: {},
          error: `Invalid parameter: ${key}`,
        };
      }

      // Sanitize parameter value
      validatedParams[key] = this.sanitizeParameterValue(value);
    }

    // Include non-validated parameters as-is (for optional params)
    Object.keys(params).forEach(key => {
      if (!(key in route.paramValidation!)) {
        validatedParams[key] = this.sanitizeParameterValue(params[key]);
      }
    });

    return { valid: true, params: validatedParams };
  }

  private sanitizeParameterValue(value: any): any {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value.replace(/[<>\"'&]/g, '').trim();
    }
    return value;
  }

  private hasRequiredRole(allowedRoles: string[]): boolean {
    if (!this.currentUserRole) {
      return false;
    }
    return allowedRoles.includes(this.currentUserRole);
  }

  private async checkOnboardingStatus(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      if (error) {
        logWarn('Failed to check onboarding status:', "Warning", error);
        this.isUserOnboarded = false; // Fail safe
      } else {
        this.isUserOnboarded = data?.onboarding_completed || false;
      }
      
    } catch (error) {
      logWarn('Error checking onboarding status:', "Warning", error);
      this.isUserOnboarded = false;
    }
  }

  private handleUnknownRoute(deepLink: DeepLinkConfig): NavigationResult {
    if (deepLink.fallbackUrl) {
      return {
        success: true,
        action: 'external',
        screen: 'WebView',
        params: { url: deepLink.fallbackUrl },
      };
    }

    return {
      success: false,
      action: 'blocked',
      error: `Unknown route: ${deepLink.screen}`,
    };
  }

  private async handleAuthenticationRequired(deepLink: DeepLinkConfig): Promise<NavigationResult> {
    // Queue the navigation for after authentication
    const navigationId = await this.queuePendingNavigation(deepLink);
    
    return {
      success: true,
      action: 'authenticate',
      screen: 'Login',
      params: { returnTo: navigationId },
    };
  }

  private async handleOnboardingRequired(deepLink: DeepLinkConfig): Promise<NavigationResult> {
    // Queue the navigation for after onboarding
    const navigationId = await this.queuePendingNavigation(deepLink);
    
    return {
      success: true,
      action: 'onboard',
      screen: 'Onboarding',
      params: { returnTo: navigationId },
    };
  }

  private async executeNavigation(
    route: DeepLinkRoute,
    params: Record<string, any>
  ): Promise<NavigationResult> {
    try {
      // Special handling for external URLs
      if (route.screen === 'WebView' && params.url) {
        if (this.shouldOpenInExternalBrowser(params.url)) {
          await WebBrowser.openBrowserAsync(params.url);
          return {
            success: true,
            action: 'external',
          };
        }
      }

      return {
        success: true,
        action: 'navigate',
        screen: route.screen,
        params,
        requiresModal: this.shouldOpenAsModal(route.screen),
      };
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to execute navigation to ${route.screen}: ${error.message}`,
        'NAVIGATION_EXECUTION_FAILED',
        true,
        error
      );
    }
  }

  private async handleNavigationError(
    deepLink: DeepLinkConfig,
    error: Error
  ): Promise<NavigationResult> {
    logError('Navigation error:', "Error", error);

    // Try fallback URL if available
    if (deepLink.fallbackUrl) {
      try {
        await WebBrowser.openBrowserAsync(deepLink.fallbackUrl);
        return {
          success: true,
          action: 'external',
        };
      } catch (fallbackError) {
        logError('Fallback navigation failed:', "Error", fallbackError);
      }
    }

    return {
      success: false,
      action: 'blocked',
      error: error.message || 'Navigation failed',
    };
  }

  private shouldOpenInExternalBrowser(url: string): boolean {
    // Open external domains in browser
    try {
      const urlObj = new URL(url);
      const externalDomains = ['google.com', 'apple.com', 'stellr.app'];
      return externalDomains.some(domain => urlObj.hostname.includes(domain));
    } catch (error) {
      return false;
    }
  }

  private shouldOpenAsModal(screen: string): boolean {
    const modalScreens = ['SecurityAlert', 'Announcements', 'WebView'];
    return modalScreens.includes(screen);
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch (error) {
      return false;
    }
  }

  private async savePendingNavigation(pending: PendingNavigation): Promise<void> {
    try {
      const key = `pending_nav_${pending.id}`;
      const serialized = {
        ...pending,
        timestamp: pending.timestamp.toISOString(),
      };
      await secureStorage.storeSecureItem(key, JSON.stringify(serialized));
    } catch (error) {
      logWarn('Failed to save pending navigation:', "Warning", error);
    }
  }

  private async removePendingNavigation(id: string): Promise<void> {
    try {
      const key = `pending_nav_${id}`;
      await secureStorage.deleteSecureItem(key);
    } catch (error) {
      logWarn('Failed to remove pending navigation:', "Warning", error);
    }
  }
}

// Export singleton instance
export const notificationDeepLinkService = NotificationDeepLinkService.getInstance();
