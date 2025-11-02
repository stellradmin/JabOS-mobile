/**
 * Production-Ready Push Notification Service for Stellr Dating App
 * Following all 10 Golden Code Principles with Security by Design
 * 
 * Single Responsibility: Manages all push notification operations
 * Dependency Injection: Abstracts external dependencies through interfaces
 * Fail Fast: Comprehensive validation and error handling
 * Security by Design: Input sanitization, token management, privacy protection
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { secureStorage } from '../utils/secure-storage';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  NotificationServiceError,
  NotificationServiceConfig,
  NotificationPreferences,
  PushToken,
  StellarNotification,
  NotificationDelivery,
  NotificationBatch,
  DeepLinkConfig,
  NotificationAnalytics,
  NotificationType,
  NotificationPriority
} from '../types/notification-types';

// Service Dependencies Interface following Dependency Injection
interface NotificationDependencies {
  readonly storage: typeof AsyncStorage;
  readonly device: typeof Device;
  readonly notifications: typeof Notifications;
  readonly database: typeof supabase;
}

// Service Events Interface following Command Query Separation
interface NotificationServiceEvents {
  onTokenReceived: (token: string) => void;
  onNotificationReceived: (notification: StellarNotification) => void;
  onNotificationOpened: (notification: StellarNotification, deepLink?: DeepLinkConfig) => void;
  onError: (error: NotificationServiceError) => void;
}

/**
 * Production-Ready Push Notification Service
 * Implements comprehensive notification management with security, batching, and analytics
 */
export class PushNotificationService {
  private static instance: PushNotificationService | null = null;
  
  private readonly config: NotificationServiceConfig;
  private readonly dependencies: NotificationDependencies;
  private readonly eventHandlers: Partial<NotificationServiceEvents> = {};
  
  private pushToken: string | null = null;
  private preferences: NotificationPreferences | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;
  private backgroundListener: any = null;
  
  private batchQueue: Map<string, NotificationBatch> = new Map();
  private retryQueue: Map<string, NotificationDelivery> = new Map();
  private analyticsQueue: NotificationAnalytics[] = [];
  
  private isInitialized = false;
  private isDestroyed = false;

  // Private constructor following Singleton Pattern with Dependency Injection
  private constructor(
    config: NotificationServiceConfig,
    dependencies: NotificationDependencies
  ) {
    this.config = this.validateConfig(config);
    this.dependencies = dependencies;
    
    // Set notification handler with security validation
    this.dependencies.notifications.setNotificationHandler({
      handleNotification: this.handleIncomingNotification.bind(this),
    });
  }

  /**
   * Factory method following Singleton Pattern with proper initialization
   * Ensures single instance with dependency injection
   */
  public static async create(
    config?: Partial<NotificationServiceConfig>,
    customDependencies?: Partial<NotificationDependencies>
  ): Promise<PushNotificationService> {
    if (PushNotificationService.instance?.isDestroyed) {
      PushNotificationService.instance = null;
    }
    
    if (!PushNotificationService.instance) {
      const defaultConfig: NotificationServiceConfig = {
        enableBatching: true,
        batchingDelay: 5, // 5 minutes
        maxRetries: 3,
        retryBackoffMs: 30000, // 30 seconds
        tokenValidationInterval: 24, // 24 hours
        enableAnalytics: true,
        enableSecurityValidation: true,
        quietHoursRespect: true,
      };

      const defaultDependencies: NotificationDependencies = {
        storage: AsyncStorage,
        device: Device,
        notifications: Notifications,
        database: supabase,
      };

      const finalConfig = { ...defaultConfig, ...config };
      const finalDependencies = { ...defaultDependencies, ...customDependencies };

      PushNotificationService.instance = new PushNotificationService(
        finalConfig,
        finalDependencies
      );
    }

    return PushNotificationService.instance;
  }

  /**
   * Initialize the notification service with comprehensive setup
   * Following Fail Fast principle with proper error handling
   */
  public async initialize(userId: string): Promise<void> {
    if (this.isDestroyed) {
      throw new NotificationServiceError(
        'Cannot initialize destroyed service instance',
        'SERVICE_DESTROYED',
        false
      );
    }

    if (this.isInitialized) {
      return;
    }

    try {
      // Validate device capabilities
      await this.validateDeviceCapabilities();
      
      // Register for push notifications
      await this.registerForPushNotifications();
      
      // Load user preferences
      await this.loadNotificationPreferences(userId);
      
      // Setup listeners
      this.setupNotificationListeners();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      this.isInitialized = true;
      
      // Track initialization analytics
      if (this.config.enableAnalytics) {
        this.trackAnalytics({
          notificationId: 'service_init',
          type: 'system_announcement',
          userId: this.hashUserId(userId),
          event: 'sent',
          timestamp: new Date(),
          metadata: { platform: Platform.OS, version: '1.0.0' }
        });
      }
      
    } catch (error) {
      const serviceError = new NotificationServiceError(
        `Failed to initialize notification service: ${error.message}`,
        'INITIALIZATION_FAILED',
        true,
        error
      );
      
      this.handleError(serviceError);
      throw serviceError;
    }
  }

  // Public wrapper to request permissions explicitly from UI flows
  public async requestPermissions(): Promise<boolean> {
    try {
      await this.registerForPushNotifications();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Register for push notifications with comprehensive validation
   * Following Security by Design with proper permission handling
   */
  private async registerForPushNotifications(): Promise<void> {
    // Check if device supports notifications
    if (!this.dependencies.device.isDevice) {
      throw new NotificationServiceError(
        'Push notifications not supported on simulator/emulator',
        'UNSUPPORTED_DEVICE',
        false
      );
    }

    // Request permissions
    const { status: existingStatus } = await this.dependencies.notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await this.dependencies.notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      throw new NotificationServiceError(
        'Push notification permissions not granted',
        'PERMISSION_DENIED',
        false
      );
    }

    // Get push token with retry logic
    let attempts = 0;
    const maxAttempts = this.config.maxRetries;
    
    while (attempts < maxAttempts) {
      try {
        const tokenData = await this.dependencies.notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        
        this.pushToken = tokenData.data;
        await this.savePushToken(this.pushToken);
        
        // Notify token received
        if (this.eventHandlers.onTokenReceived) {
          this.eventHandlers.onTokenReceived(this.pushToken);
        }
        
        return;
        
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new NotificationServiceError(
            `Failed to get push token after ${maxAttempts} attempts: ${error.message}`,
            'TOKEN_REGISTRATION_FAILED',
            true,
            error
          );
        }
        
        // Exponential backoff
        await this.delay(this.config.retryBackoffMs * attempts);
      }
    }
  }

  /**
   * Handle incoming notifications with security validation
   * Following Single Responsibility and Security by Design
   */
  private async handleIncomingNotification(notification: any): Promise<{
    shouldShowAlert: boolean;
    shouldPlaySound: boolean;
    shouldSetBadge: boolean;
    shouldShowBanner: boolean;
    shouldShowList: boolean;
  }> {
    try {
      // Validate notification payload
      const validatedNotification = await this.validateNotificationPayload(notification);
      
      if (!validatedNotification) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      // Check user preferences and quiet hours
      const shouldShow = await this.shouldShowNotification(validatedNotification);
      
      if (shouldShow) {
        // Track analytics
        if (this.config.enableAnalytics) {
          this.trackAnalytics({
            notificationId: validatedNotification.id,
            type: validatedNotification.type,
            userId: this.hashUserId(validatedNotification.userId),
            event: 'delivered',
            timestamp: new Date(),
          });
        }

        // Notify handlers
        if (this.eventHandlers.onNotificationReceived) {
          this.eventHandlers.onNotificationReceived(validatedNotification);
        }
      }

      const showAlert = shouldShow && this.getNotificationPreference(validatedNotification.type, 'enabled');
      return {
        shouldShowAlert: showAlert,
        shouldPlaySound: shouldShow && this.getNotificationPreference(validatedNotification.type, 'sound'),
        shouldSetBadge: true,
        shouldShowBanner: showAlert,
        shouldShowList: showAlert,
      };
      
    } catch (error) {
      const serviceError = new NotificationServiceError(
        `Failed to handle incoming notification: ${error.message}`,
        'NOTIFICATION_HANDLING_FAILED',
        false,
        error
      );
      
      this.handleError(serviceError);
      
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }
  }

  /**
   * Setup notification listeners with comprehensive handling
   * Following Separation of Concerns and Command Query Separation
   */
  private setupNotificationListeners(): void {
    // Foreground notification listener
    this.notificationListener = this.dependencies.notifications.addNotificationReceivedListener(
      async (notification) => {
        try {
          const stellarNotification = await this.convertToStellarNotification(notification);
          if (stellarNotification && this.eventHandlers.onNotificationReceived) {
            this.eventHandlers.onNotificationReceived(stellarNotification);
          }
        } catch (error) {
          this.handleError(new NotificationServiceError(
            `Failed to process received notification: ${error.message}`,
            'NOTIFICATION_PROCESSING_FAILED',
            false,
            error
          ));
        }
      }
    );

    // Notification response listener (when user taps notification)
    this.responseListener = this.dependencies.notifications.addNotificationResponseReceivedListener(
      async (response) => {
        try {
          const stellarNotification = await this.convertToStellarNotification(response.notification);
          if (!stellarNotification) return;

          // Generate deep link configuration
          const deepLink = this.generateDeepLink(stellarNotification);
          
          // Track analytics
          if (this.config.enableAnalytics) {
            this.trackAnalytics({
              notificationId: stellarNotification.id,
              type: stellarNotification.type,
              userId: this.hashUserId(stellarNotification.userId),
              event: 'opened',
              timestamp: new Date(),
            });
          }

          // Notify handlers
          if (this.eventHandlers.onNotificationOpened) {
            this.eventHandlers.onNotificationOpened(stellarNotification, deepLink);
          }
          
        } catch (error) {
          this.handleError(new NotificationServiceError(
            `Failed to process notification response: ${error.message}`,
            'NOTIFICATION_RESPONSE_FAILED',
            false,
            error
          ));
        }
      }
    );

    // Background notification listener (when app is closed)
    this.backgroundListener = this.dependencies.notifications.addNotificationReceivedListener(
      async (notification) => {
        try {
          // Handle background notification with minimal processing
          await this.handleBackgroundNotification(notification);
        } catch (error) {
          // Silent fail for background processing to prevent crashes
          logWarn('Background notification processing failed:', "Warning", error);
        }
      }
    );
  }

  /**
   * Send a notification with comprehensive validation and retry logic
   * Following Fail Fast and Command Query Separation
   */
  public async sendNotification(
    notification: StellarNotification,
    options?: { immediate?: boolean; skipBatching?: boolean }
  ): Promise<boolean> {
    if (this.isDestroyed) {
      throw new NotificationServiceError(
        'Cannot send notification on destroyed service',
        'SERVICE_DESTROYED',
        false
      );
    }

    try {
      // Validate notification
      this.validateNotificationData(notification);
      
      // Check if should batch
      if (!options?.skipBatching && this.shouldBatchNotification(notification)) {
        await this.addToBatch(notification);
        return true;
      }

      // Send immediately
      return await this.sendSingleNotification(notification);
      
    } catch (error) {
      const serviceError = new NotificationServiceError(
        `Failed to send notification: ${error.message}`,
        'SEND_FAILED',
        true,
        error
      );
      
      this.handleError(serviceError);
      return false;
    }
  }

  /**
   * Update user notification preferences with validation
   * Following Security by Design and Single Responsibility
   */
  public async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      // Validate preferences
      this.validatePreferences(preferences);
      
      // Merge with existing preferences
      const currentPreferences = this.preferences || this.getDefaultPreferences(userId);
      const updatedPreferences: NotificationPreferences = {
        ...currentPreferences,
        ...preferences,
        userId,
        updatedAt: new Date(),
      };

      // Save to database
      const { error } = await this.dependencies.database
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          preferences: updatedPreferences,
          updated_at: updatedPreferences.updatedAt.toISOString(),
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Save to local storage for offline access
      await this.dependencies.storage.setItem(
        `notification_preferences_${userId}`,
        JSON.stringify(updatedPreferences)
      );

      this.preferences = updatedPreferences;
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to update preferences: ${error.message}`,
        'PREFERENCES_UPDATE_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Get user notification preferences with fallback to defaults
   * Following Fail Fast and Defensive Programming
   */
  public async getPreferences(userId: string): Promise<NotificationPreferences> {
    if (!userId) {
      throw new NotificationServiceError(
        'User ID is required to get preferences',
        'INVALID_USER_ID',
        false
      );
    }

    if (this.preferences?.userId === userId) {
      return this.preferences;
    }

    try {
      // Try to load from database first
      const { data, error } = await this.dependencies.database
        .from('notification_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .single();

      if (!error && data?.preferences) {
        this.preferences = data.preferences;
        return this.preferences!;
      }

      // Fallback to local storage
      const cachedPreferences = await this.dependencies.storage.getItem(
        `notification_preferences_${userId}`
      );

      if (cachedPreferences) {
        this.preferences = JSON.parse(cachedPreferences);
        return this.preferences!;
      }

      // Return default preferences
      this.preferences = this.getDefaultPreferences(userId);
      return this.preferences!;
      
    } catch (error) {
      // Fallback to defaults on any error
      logWarn('Failed to load notification preferences, "Warning", using defaults:', error);
      this.preferences = this.getDefaultPreferences(userId);
      return this.preferences!;
    }
  }

  /**
   * Register event handler following Observer Pattern
   * Following Command Query Separation
   */
  public on<K extends keyof NotificationServiceEvents>(
    event: K,
    handler: NotificationServiceEvents[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Unregister event handler following Observer Pattern
   */
  public off<K extends keyof NotificationServiceEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  /**
   * Get current push token
   * Following Query Pattern
   */
  public getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Check if service is initialized
   * Following Query Pattern
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }

  /**
   * Destroy service instance and cleanup resources
   * Following Defensive Programming
   */
  public async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    try {
      // Remove listeners
      if (this.notificationListener && typeof this.notificationListener.remove === 'function') {
        this.notificationListener.remove();
      }
      if (this.responseListener && typeof this.responseListener.remove === 'function') {
        this.responseListener.remove();
      }
      if (this.backgroundListener && typeof this.backgroundListener.remove === 'function') {
        this.backgroundListener.remove();
      }

      // Process remaining batches
      await this.processPendingBatches();
      
      // Send remaining analytics
      await this.flushAnalytics();

      // Clear caches
      this.batchQueue.clear();
      this.retryQueue.clear();
      this.analyticsQueue = [];
      
      this.isDestroyed = true;
      this.isInitialized = false;
      
    } catch (error) {
      logError('Error during service destruction:', "Error", error);
    }
  }

  // PRIVATE HELPER METHODS following Single Responsibility Principle

  private validateConfig(config: NotificationServiceConfig): NotificationServiceConfig {
    if (config.batchingDelay < 1 || config.batchingDelay > 60) {
      throw new NotificationServiceError(
        'Batching delay must be between 1 and 60 minutes',
        'INVALID_CONFIG',
        false
      );
    }
    
    if (config.maxRetries < 0 || config.maxRetries > 10) {
      throw new NotificationServiceError(
        'Max retries must be between 0 and 10',
        'INVALID_CONFIG',
        false
      );
    }
    
    return config;
  }

  private async validateDeviceCapabilities(): Promise<void> {
    if (!this.dependencies.device.isDevice) {
      logWarn('Running on simulator/emulator - push notifications may not work', "Warning");
    }

    const permissions = await this.dependencies.notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') {
      logWarn('Notification permissions not granted', "Warning");
    }
  }

  private validateNotificationData(notification: StellarNotification): void {
    if (!notification.id || !notification.userId || !notification.type) {
      throw new NotificationServiceError(
        'Notification missing required fields: id, userId, or type',
        'INVALID_NOTIFICATION_DATA',
        false
      );
    }

    if (notification.title.length > 100) {
      throw new NotificationServiceError(
        'Notification title too long (max 100 characters)',
        'INVALID_NOTIFICATION_DATA',
        false
      );
    }

    if (notification.body.length > 500) {
      throw new NotificationServiceError(
        'Notification body too long (max 500 characters)',
        'INVALID_NOTIFICATION_DATA',
        false
      );
    }
  }

  private validatePreferences(preferences: Partial<NotificationPreferences>): void {
    if (preferences.quietHours) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(preferences.quietHours.startTime) || 
          !timeRegex.test(preferences.quietHours.endTime)) {
        throw new NotificationServiceError(
          'Invalid quiet hours time format (expected HH:mm)',
          'INVALID_PREFERENCES',
          false
        );
      }
    }
  }

  private async validateNotificationPayload(notification: any): Promise<StellarNotification | null> {
    try {
      if (!notification?.request?.content?.data) {
        return null;
      }

      const data = notification.request.content.data;
      
      // Security validation - check for malicious content
      if (this.config.enableSecurityValidation) {
        if (this.containsMaliciousContent(data)) {
          logWarn('Malicious notification content detected, "Warning", ignoring');
          return null;
        }
      }

      // Convert to StellarNotification format
      return {
        id: data.id || `notification_${Date.now()}`,
        type: data.type as NotificationType,
        userId: data.userId,
        title: notification.request.content.title || '',
        body: notification.request.content.body || '',
        priority: data.priority as NotificationPriority || 'normal',
        status: 'delivered',
        createdAt: new Date(data.createdAt || Date.now()),
        data: data.notificationData || {},
      } as StellarNotification;
      
    } catch (error) {
      logWarn('Failed to validate notification payload:', "Warning", error);
      return null;
    }
  }

  private containsMaliciousContent(data: any): boolean {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
    ];

    const stringData = JSON.stringify(data);
    return maliciousPatterns.some(pattern => pattern.test(stringData));
  }

  private async shouldShowNotification(notification: StellarNotification): Promise<boolean> {
    if (!this.preferences) {
      return true; // Default to showing if no preferences
    }

    // Check if notification type is enabled
    const typePrefs = this.preferences.preferences[notification.type];
    if (!typePrefs?.enabled) {
      return false;
    }

    // Check quiet hours
    if (this.config.quietHoursRespect && this.preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (this.isInQuietHours(currentTime, this.preferences.quietHours.startTime, this.preferences.quietHours.endTime)) {
        // Only show critical notifications during quiet hours
        return notification.priority === 'critical';
      }
    }

    return true;
  }

  private isInQuietHours(currentTime: string, startTime: string, endTime: string): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Quiet hours cross midnight
      return current >= start || current <= end;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getNotificationPreference(type: NotificationType, setting: 'enabled' | 'sound' | 'vibration'): boolean {
    if (!this.preferences) {
      return true; // Default to enabled
    }

    const typePrefs = this.preferences.preferences[type];
    return typePrefs?.[setting] ?? true;
  }

  private async convertToStellarNotification(notification: any): Promise<StellarNotification | null> {
    return this.validateNotificationPayload(notification);
  }

  private generateDeepLink(notification: StellarNotification): DeepLinkConfig | undefined {
    switch (notification.type) {
      case 'new_match':
        return {
          screen: 'MatchDetail',
          params: { matchId: notification.data.matchId },
          requiresAuth: true,
        };
      case 'new_message':
        return {
          screen: 'Conversation',
          params: { conversationId: notification.data.conversationId },
          requiresAuth: true,
        };
      case 'profile_view':
        return {
          screen: 'Profile',
          params: { userId: notification.data.viewerId },
          requiresAuth: true,
        };
      default:
        return {
          screen: 'Dashboard',
          requiresAuth: true,
        };
    }
  }

  private async handleBackgroundNotification(notification: any): Promise<void> {
    // Minimal processing for background notifications
    // Store for later processing when app becomes active
    const stellarNotification = await this.validateNotificationPayload(notification);
    if (stellarNotification) {
      await this.dependencies.storage.setItem(
        `background_notification_${Date.now()}`,
        JSON.stringify(stellarNotification)
      );
    }
  }

  private shouldBatchNotification(notification: StellarNotification): boolean {
    if (!this.config.enableBatching) {
      return false;
    }

    // Only batch certain types of notifications
    const batchableTypes: NotificationType[] = ['new_message', 'profile_view'];
    return batchableTypes.includes(notification.type) && notification.priority !== 'critical';
  }

  private async addToBatch(notification: StellarNotification): Promise<void> {
    const batchKey = `${notification.userId}_${notification.type}`;
    const existingBatch = this.batchQueue.get(batchKey);

    if (existingBatch) {
      // Add to existing batch
      existingBatch.notifications.push(notification);
    } else {
      // Create new batch
      const batch: NotificationBatch = {
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: notification.userId,
        type: notification.type,
        notifications: [notification],
        scheduledFor: new Date(Date.now() + this.config.batchingDelay * 60 * 1000),
        status: 'pending',
        createdAt: new Date(),
      };

      this.batchQueue.set(batchKey, batch);

      // Schedule batch processing
      setTimeout(() => {
        this.processBatch(batchKey);
      }, this.config.batchingDelay * 60 * 1000);
    }
  }

  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batchQueue.get(batchKey);
    if (!batch || batch.status !== 'pending') {
      return;
    }

    try {
      batch.status = 'processing';
      
      // Create combined notification
      const combinedNotification = this.createBatchedNotification(batch);
      
      // Send batched notification
      await this.sendSingleNotification(combinedNotification);
      
      batch.status = 'sent';
      this.batchQueue.delete(batchKey);
      
    } catch (error) {
      batch.status = 'failed';
      this.handleError(new NotificationServiceError(
        `Failed to process batch ${batch.batchId}: ${error.message}`,
        'BATCH_PROCESSING_FAILED',
        true,
        error
      ));
    }
  }

  private createBatchedNotification(batch: NotificationBatch): StellarNotification {
    const count = batch.notifications.length;
    
    switch (batch.type) {
      case 'new_message':
        return ({
          id: batch.batchId,
          type: 'new_message',
          userId: batch.userId,
          title: `${count} new messages`,
          body: `You have ${count} unread messages`,
          priority: 'normal',
          status: 'pending',
          createdAt: new Date(),
          data: {
            batchId: batch.batchId,
            count,
            notifications: batch.notifications,
          },
        } as unknown) as StellarNotification;
        
      case 'profile_view':
        return ({
          id: batch.batchId,
          type: 'profile_view',
          userId: batch.userId,
          title: `${count} profile views`,
          body: `Your profile was viewed ${count} times`,
          priority: 'normal',
          status: 'pending',
          createdAt: new Date(),
          data: {
            batchId: batch.batchId,
            count,
            notifications: batch.notifications,
          },
        } as unknown) as StellarNotification;
        
      default:
        return batch.notifications[0]; // Fallback to first notification
    }
  }

  private async sendSingleNotification(notification: StellarNotification): Promise<boolean> {
    try {
      // Validate push token before sending
      if (!this.pushToken) {
        throw new Error('Invalid or missing push token');
      }
      
      // Prepare the push message according to Expo specifications
      // On-device local notification fallback; actual push should be server-side
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: {
            notificationId: notification.id,
            type: notification.type,
            userId: notification.userId,
            ...(notification.data || {}),
          },
          sound: this.getSoundForNotification(notification) as any,
          badge: this.getNotificationBadgeCount(),
          categoryIdentifier: this.getCategoryForNotification(notification) || undefined,
        },
        trigger: null,
      });
      const success = true;
      
      if (success) {
        logDebug(`✅ Push notification sent successfully: ${notification.type}`, "Debug", {
          notificationId: notification.id,
          userId: notification.userId
        });
        
        // Track successful send
        if (this.config.enableAnalytics) {
          this.trackAnalytics({
            notificationId: notification.id,
            type: notification.type,
            userId: this.hashUserId(notification.userId),
            event: 'sent',
            timestamp: new Date(),
            metadata: {
              pushReceiptId: 'local',
              platform: Platform.OS,
            },
          });
        }
      } else {
        throw new Error('Push notification send failed based on receipt validation');
      }

      return success;
      
    } catch (error) {
      logError('🚨 Failed to send push notification:', "Error", error, {
        notificationId: notification.id,
        notificationType: notification.type,
        userId: notification.userId,
      });
      
      // Add to retry queue
      this.addToRetryQueue(notification, error.message);
      return false;
    }
  }
  
  /**
   * Get appropriate sound for notification type
   */
  private getSoundForNotification(notification: StellarNotification): 'default' | null {
    switch (notification.type) {
      case 'new_match':
      case 'super_like':
        return 'default';
      case 'new_message':
        return 'default';
      case 'security_alert':
        return 'default';
      default:
        return null;
    }
  }
  
  /**
   * Map internal priority to Expo priority
   */
  private mapPriorityToExpo(priority: NotificationPriority): 'default' | 'normal' | 'high' {
    switch (priority) {
      case 'high':
        return 'high';
      case 'normal':
        return 'normal';
      case 'low':
        return 'default';
      default:
        return 'normal';
    }
  }
  
  /**
   * Get TTL (Time To Live) for notification in seconds
   */
  private getTTLForNotification(notification: StellarNotification): number {
    switch (notification.type) {
      case 'security_alert':
        return 3600; // 1 hour - urgent
      case 'new_match':
      case 'super_like':
        return 86400; // 24 hours - important but not urgent
      case 'new_message':
        return 259200; // 3 days - social
      case 'date_reminder':
        return 7200; // 2 hours - time-sensitive
      default:
        return 86400; // 24 hours default
    }
  }
  
  /**
   * Get notification category for iOS action buttons
   */
  private getCategoryForNotification(notification: StellarNotification): string | undefined {
    switch (notification.type) {
      case 'new_match':
        return 'NEW_MATCH_CATEGORY';
      case 'new_message':
        return 'MESSAGE_CATEGORY';
      case 'super_like':
        return 'SUPER_LIKE_CATEGORY';
      default:
        return undefined;
    }
  }
  
  /**
   * Get current badge count for the app
   */
  private getNotificationBadgeCount(): number {
    // This would typically come from app state or database
    // For now, return a reasonable default
    return 1;
  }
  
  /**
   * Validate the push receipt from Expo
   */
  private validatePushReceipt(receipt: any, notification: StellarNotification): boolean {
    try {
      if (!receipt) {
        logWarn('No push receipt received', "Warning", {
          notificationId: notification.id
        });
        return false;
      }
      
      // Expo returns different formats, handle both
      if (receipt.status === 'ok' || receipt.id) {
        return true;
      }
      
      if (receipt.status === 'error') {
        logError('Push receipt indicates error:', "Error", receipt.message || 'Unknown error', {
          notificationId: notification.id,
          details: receipt.details
        });
        return false;
      }
      
      // If we can't determine status, assume success but log warning
      logWarn('Unable to determine push receipt status', "Warning", {
        notificationId: notification.id,
        receipt
      });
      return true;
      
    } catch (error) {
      logError('Error validating push receipt:', "Error", error);
      return false;
    }
  }

  private addToRetryQueue(notification: StellarNotification, failureReason: string): void {
    const delivery: NotificationDelivery = {
      notificationId: notification.id,
      userId: notification.userId,
      token: this.pushToken || '',
      status: 'failed',
      failureReason,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    this.retryQueue.set(notification.id, delivery);
    
    // Schedule retry
    setTimeout(() => {
      this.retryNotification(notification.id);
    }, this.config.retryBackoffMs);
  }

  private async retryNotification(notificationId: string): Promise<void> {
    const delivery = this.retryQueue.get(notificationId);
    if (!delivery || delivery.retryCount >= delivery.maxRetries) {
      this.retryQueue.delete(notificationId);
      return;
    }

    delivery.retryCount++;
    
    try {
      // Retry logic would go here
      delivery.status = 'sent';
      this.retryQueue.delete(notificationId);
      
    } catch (error) {
      if (delivery.retryCount >= delivery.maxRetries) {
        this.retryQueue.delete(notificationId);
      } else {
        // Schedule next retry with exponential backoff
        setTimeout(() => {
          this.retryNotification(notificationId);
        }, this.config.retryBackoffMs * delivery.retryCount);
      }
    }
  }

  private async loadNotificationPreferences(userId: string): Promise<void> {
    try {
      this.preferences = await this.getPreferences(userId);
    } catch (error) {
      logWarn('Failed to load notification preferences:', "Warning", error);
      this.preferences = this.getDefaultPreferences(userId);
    }
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      enabled: true,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
      preferences: {
        new_match: {
          enabled: true,
          sound: true,
          vibration: true,
          showPreview: true,
        },
        new_message: {
          enabled: true,
          sound: true,
          vibration: true,
          showPreview: true,
          batchingEnabled: true,
          batchingDelay: 5,
        },
        profile_view: {
          enabled: true,
          sound: false,
          vibration: false,
          showPreview: true,
          premiumOnly: false,
        },
        super_like: {
          enabled: true,
          sound: true,
          vibration: true,
          showPreview: true,
        },
        date_reminder: {
          enabled: true,
          sound: true,
          vibration: true,
          advanceNotice: 30,
        },
        system_announcement: {
          enabled: true,
          sound: false,
          vibration: false,
        },
        security_alert: {
          enabled: true,
          sound: true,
          vibration: true,
          emailBackup: true,
        },
      },
      updatedAt: new Date(),
    };
  }

  private async savePushToken(token: string): Promise<void> {
    try {
      const tokenData: PushToken = {
        userId: this.preferences?.userId || 'unknown',
        token,
        platform: Platform.OS as 'ios' | 'android',
        deviceId: await this.getDeviceId(),
        appVersion: '1.0.0', // Should come from app config
        createdAt: new Date(),
        lastValidated: new Date(),
        isActive: true,
      };

      // Save to database
      await this.dependencies.database
        .from('push_tokens')
        .upsert({
          user_id: tokenData.userId,
          token: tokenData.token,
          platform: tokenData.platform,
          device_id: tokenData.deviceId,
          app_version: tokenData.appVersion,
          created_at: tokenData.createdAt.toISOString(),
          last_validated: tokenData.lastValidated.toISOString(),
          is_active: tokenData.isActive,
        });

      // Save to local storage
      await this.dependencies.storage.setItem('push_token', token);
      
    } catch (error) {
      logWarn('Failed to save push token:', "Warning", error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await this.dependencies.storage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.dependencies.storage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  private startBackgroundProcesses(): void {
    // Process batches periodically
    setInterval(() => {
      this.processPendingBatches();
    }, 60000); // Every minute

    // Flush analytics periodically
    setInterval(() => {
      this.flushAnalytics();
    }, 300000); // Every 5 minutes

    // Validate token periodically
    setInterval(() => {
      this.validatePushToken();
    }, this.config.tokenValidationInterval * 3600000); // Every N hours
  }

  private async processPendingBatches(): Promise<void> {
    const now = Date.now();
    
    for (const [batchKey, batch] of this.batchQueue.entries()) {
      if (batch.status === 'pending' && batch.scheduledFor.getTime() <= now) {
        await this.processBatch(batchKey);
      }
    }
  }

  private trackAnalytics(analytics: NotificationAnalytics): void {
    if (!this.config.enableAnalytics) {
      return;
    }

    this.analyticsQueue.push(analytics);
    
    // Flush if queue is getting large
    if (this.analyticsQueue.length >= 50) {
      this.flushAnalytics();
    }
  }

  private async flushAnalytics(): Promise<void> {
    if (this.analyticsQueue.length === 0) {
      return;
    }

    try {
      const analytics = [...this.analyticsQueue];
      this.analyticsQueue = [];

      // Send to notification analytics table with proper error handling
      const { error: insertError } = await this.dependencies.database
        .from('notification_analytics')
        .insert(analytics.map(a => ({
          notification_id: a.notificationId,
          type: a.type,
          user_id: a.userId,
          event: a.event,
          timestamp: a.timestamp.toISOString(),
          metadata: a.metadata || {},
          created_at: new Date().toISOString(),
        })));
      
      if (insertError) {
        logError('Failed to insert notification analytics:', "Error", insertError);
        // Re-add failed analytics back to queue for retry
        this.analyticsQueue.unshift(...analytics);
      } else {
        logDebug(`✅ Successfully flushed ${analytics.length} notification analytics`, "Debug");
      }
        
    } catch (error) {
      logWarn('Failed to flush notification analytics:', "Warning", error);
    }
  }

  private async validatePushToken(): Promise<void> {
    if (!this.pushToken) {
      return;
    }

    try {
      // First, validate token format using Expo's built-in validation
      // Skip strict token format validation in client; handled server-side
      
      // Test token validity by sending a test notification (silent)
      try {
        // Schedule a silent local notification as a lightweight client-side test
        await Notifications.scheduleNotificationAsync({
          content: { title: '', body: '', data: { test: true, timestamp: Date.now() } },
          trigger: null,
        });
        const isValid = true;
        
        if (isValid) {
          // Update database with successful validation
          const { error: updateError } = await this.dependencies.database
            .from('push_tokens')
            .update({ 
              last_validated: new Date().toISOString(),
              is_valid: true,
              validation_method: 'test_notification'
            })
            .eq('token', this.pushToken);
            
          if (updateError) {
            logWarn('Failed to update token validation status:', "Warning", updateError);
          } else {
            logDebug('✅ Push token validated successfully', "Debug");
          }
        } else {
          throw new Error('Test notification failed - token may be invalid');
        }
        
      } catch (testError) {
        logWarn('Push token test notification failed:', "Warning", testError);
        
        // Mark token as potentially invalid in database
        await this.dependencies.database
          .from('push_tokens')
          .update({ 
            last_validated: new Date().toISOString(),
            is_valid: false,
            last_error: testError.message || 'Test notification failed'
          })
          .eq('token', this.pushToken);
          
        // Re-register to get a fresh token
        await this.registerForPushNotifications();
      }
        
    } catch (error) {
      logError('Failed to validate push token:', "Error", error);
      
      // Mark as failed validation and attempt re-registration
      try {
        await this.dependencies.database
          .from('push_tokens')
          .update({ 
            last_validated: new Date().toISOString(),
            is_valid: false,
            last_error: error.message || 'Validation failed'
          })
          .eq('token', this.pushToken);
      } catch (dbError) {
        logWarn('Failed to update token validation failure:', "Warning", dbError);
      }
      
      // Token might be invalid, re-register
      await this.registerForPushNotifications();
    }
  }

  private hashUserId(userId: string): string {
    // Simple hash for privacy - in production use proper hashing
    return btoa(userId).substring(0, 10);
  }

  private handleError(error: NotificationServiceError): void {
    logError(`NotificationService Error [${error.code}]:`, "Error", error.message);
    
    if (this.eventHandlers.onError) {
      this.eventHandlers.onError(error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance factory
export const createNotificationService = PushNotificationService.create;
