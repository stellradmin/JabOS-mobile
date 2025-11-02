/**
 * Notification Preferences Service for Stellr Dating App
 * Single Responsibility: Manages user notification preferences
 * Security by Design: Input validation, secure storage, privacy protection
 * Following all 10 Golden Code Principles
 */

import { secureStorage } from '../utils/secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  NotificationPreferences,
  NotificationType,
  NotificationServiceError
} from '../types/notification-types';

// Service Dependencies Interface following Dependency Injection
interface PreferencesDependencies {
  readonly storage: typeof AsyncStorage;
  readonly database: typeof supabase;
}

// Preferences Validation Schema following Fail Fast Principle
interface PreferencesValidationSchema {
  readonly userId: (value: string) => boolean;
  readonly quietHours: (value: any) => boolean;
  readonly notificationTypePrefs: (value: any) => boolean;
  readonly timeFormat: (value: string) => boolean;
}

/**
 * Service for managing user notification preferences with comprehensive validation
 * Implements caching, validation, and secure storage following best practices
 */
export class NotificationPreferencesService {
  private static instance: NotificationPreferencesService | null = null;
  
  private readonly dependencies: PreferencesDependencies;
  private readonly validationSchema: PreferencesValidationSchema;
  private readonly cache: Map<string, NotificationPreferences> = new Map();
  
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly cacheTimestamps: Map<string, number> = new Map();

  // Private constructor following Singleton Pattern
  private constructor(dependencies: PreferencesDependencies) {
    this.dependencies = dependencies;
    this.validationSchema = this.createValidationSchema();
  }

  /**
   * Factory method for singleton instance with dependency injection
   */
  public static create(customDependencies?: Partial<PreferencesDependencies>): NotificationPreferencesService {
    if (!NotificationPreferencesService.instance) {
      const defaultDependencies: PreferencesDependencies = {
        storage: AsyncStorage,
        database: supabase,
      };

      const finalDependencies = { ...defaultDependencies, ...customDependencies };
      NotificationPreferencesService.instance = new NotificationPreferencesService(finalDependencies);
    }

    return NotificationPreferencesService.instance;
  }

  /**
   * Get user notification preferences with multi-layer caching
   * Following Fail Fast and Defensive Programming principles
   */
  public async getPreferences(userId: string): Promise<NotificationPreferences> {
    // Input validation
    if (!this.validationSchema.userId(userId)) {
      throw new NotificationServiceError(
        'Invalid user ID provided',
        'INVALID_USER_ID',
        false
      );
    }

    // Check cache first
    const cached = this.getCachedPreferences(userId);
    if (cached) {
      return cached;
    }

    try {
      // Try database first
      const dbPreferences = await this.getPreferencesFromDatabase(userId);
      if (dbPreferences) {
        this.setCachedPreferences(userId, dbPreferences);
        return dbPreferences;
      }

      // Fallback to local storage
      const localPreferences = await this.getPreferencesFromStorage(userId);
      if (localPreferences) {
        this.setCachedPreferences(userId, localPreferences);
        // Sync to database in background
        this.syncToDatabase(userId, localPreferences).catch(error => 
          logWarn('Failed to sync preferences to database:', "Warning", error)
        );
        return localPreferences;
      }

      // Return default preferences
      const defaultPreferences = this.createDefaultPreferences(userId);
      this.setCachedPreferences(userId, defaultPreferences);
      
      // Save defaults to storage and database
      await Promise.all([
        this.savePreferencesToStorage(userId, defaultPreferences),
        this.savePreferencesToDatabase(userId, defaultPreferences)
      ]);

      return defaultPreferences;
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to get preferences for user ${userId}: ${error.message}`,
        'PREFERENCES_FETCH_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Update user notification preferences with comprehensive validation
   * Following Command Pattern and Security by Design
   */
  public async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // Input validation
    if (!this.validationSchema.userId(userId)) {
      throw new NotificationServiceError(
        'Invalid user ID provided',
        'INVALID_USER_ID',
        false
      );
    }

    // Validate updates
    this.validatePreferencesUpdate(updates);

    try {
      // Get current preferences
      const currentPreferences = await this.getPreferences(userId);
      
      // Merge updates with current preferences
      const updatedPreferences: NotificationPreferences = {
        ...currentPreferences,
        ...updates,
        userId, // Ensure userId cannot be changed
        updatedAt: new Date(),
      };

      // Final validation of merged preferences
      this.validateCompletePreferences(updatedPreferences);

      // Save to all storage layers
      await Promise.all([
        this.savePreferencesToDatabase(userId, updatedPreferences),
        this.savePreferencesToStorage(userId, updatedPreferences)
      ]);

      // Update cache
      this.setCachedPreferences(userId, updatedPreferences);

      return updatedPreferences;
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to update preferences for user ${userId}: ${error.message}`,
        'PREFERENCES_UPDATE_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Update specific notification type preferences
   * Following Single Responsibility and Command Pattern
   */
  public async updateNotificationTypePreference(
    userId: string,
    notificationType: NotificationType,
    enabled: boolean,
    additionalSettings?: {
      sound?: boolean;
      vibration?: boolean;
      showPreview?: boolean;
    }
  ): Promise<void> {
    try {
      const currentPreferences = await this.getPreferences(userId);
      
      const typePreferences = {
        ...currentPreferences.preferences[notificationType],
        enabled,
        ...additionalSettings,
      };

      const updates: Partial<NotificationPreferences> = {
        preferences: {
          ...currentPreferences.preferences,
          [notificationType]: typePreferences,
        },
      };

      await this.updatePreferences(userId, updates);
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to update ${notificationType} preferences: ${error.message}`,
        'TYPE_PREFERENCE_UPDATE_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Update quiet hours settings with time validation
   * Following Single Responsibility and Fail Fast principles
   */
  public async updateQuietHours(
    userId: string,
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    }
  ): Promise<void> {
    // Validate time format
    if (!this.validationSchema.timeFormat(quietHours.startTime) || 
        !this.validationSchema.timeFormat(quietHours.endTime)) {
      throw new NotificationServiceError(
        'Invalid time format. Expected HH:mm format',
        'INVALID_TIME_FORMAT',
        false
      );
    }

    // Validate logical time range (optional warning)
    if (quietHours.enabled && quietHours.startTime === quietHours.endTime) {
      logWarn('Quiet hours start and end times are identical', "Warning");
    }

    try {
      const updates: Partial<NotificationPreferences> = {
        quietHours,
      };

      await this.updatePreferences(userId, updates);
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to update quiet hours: ${error.message}`,
        'QUIET_HOURS_UPDATE_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Check if notifications should be delivered based on preferences and quiet hours
   * Following Query Pattern and Least Surprise principle
   */
  public async shouldDeliverNotification(
    userId: string,
    notificationType: NotificationType,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<{
    shouldDeliver: boolean;
    reason?: string;
    allowSound: boolean;
    allowVibration: boolean;
    showPreview: boolean;
  }> {
    try {
      const preferences = await this.getPreferences(userId);
      
      // Check if notifications are globally enabled
      if (!preferences.enabled) {
        return {
          shouldDeliver: false,
          reason: 'Notifications disabled globally',
          allowSound: false,
          allowVibration: false,
          showPreview: false,
        };
      }

      // Check if this notification type is enabled
      const typePrefs = preferences.preferences[notificationType];
      if (!typePrefs.enabled) {
        return {
          shouldDeliver: false,
          reason: `${notificationType} notifications disabled`,
          allowSound: false,
          allowVibration: false,
          showPreview: false,
        };
      }

      // Check quiet hours
      const isQuietHours = this.isInQuietHours(preferences.quietHours);
      if (isQuietHours && priority !== 'critical') {
        const showPreviewPref = (typePrefs as any).showPreview ?? true;
        return {
          shouldDeliver: false,
          reason: 'In quiet hours (non-critical notification)',
          allowSound: false,
          allowVibration: false,
          showPreview: showPreviewPref,
        };
      }

      // Allow delivery with appropriate settings
      const showPreviewPref = (typePrefs as any).showPreview ?? true;
      return {
        shouldDeliver: true,
        allowSound: typePrefs.sound && (!isQuietHours || priority === 'critical'),
        allowVibration: typePrefs.vibration && (!isQuietHours || priority === 'critical'),
        showPreview: showPreviewPref,
      };
      
    } catch (error) {
      // Fail safe - allow notification on error
      logWarn('Failed to check notification delivery preferences:', "Warning", error);
      return {
        shouldDeliver: true,
        allowSound: true,
        allowVibration: true,
        showPreview: true,
      };
    }
  }

  /**
   * Reset preferences to defaults for a user
   * Following Command Pattern
   */
  public async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    if (!this.validationSchema.userId(userId)) {
      throw new NotificationServiceError(
        'Invalid user ID provided',
        'INVALID_USER_ID',
        false
      );
    }

    try {
      const defaultPreferences = this.createDefaultPreferences(userId);
      
      // Save to all storage layers
      await Promise.all([
        this.savePreferencesToDatabase(userId, defaultPreferences),
        this.savePreferencesToStorage(userId, defaultPreferences)
      ]);

      // Clear cache to force fresh load
      this.cache.delete(userId);
      this.cacheTimestamps.delete(userId);

      return defaultPreferences;
      
    } catch (error) {
      throw new NotificationServiceError(
        `Failed to reset preferences to defaults: ${error.message}`,
        'PREFERENCES_RESET_FAILED',
        true,
        error
      );
    }
  }

  /**
   * Clear cached preferences for a user
   * Following Command Pattern
   */
  public clearCachedPreferences(userId: string): void {
    this.cache.delete(userId);
    this.cacheTimestamps.delete(userId);
  }

  /**
   * Clear all cached preferences
   * Following Command Pattern
   */
  public clearAllCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  // PRIVATE HELPER METHODS following Single Responsibility Principle

  private createValidationSchema(): PreferencesValidationSchema {
    return {
      userId: (value: string) => {
        return typeof value === 'string' && 
               value.length > 0 && 
               value.length <= 255 &&
               /^[a-zA-Z0-9\-_]+$/.test(value); // Alphanumeric, hyphens, underscores only
      },
      
      quietHours: (value: any) => {
        return value &&
               typeof value === 'object' &&
               typeof value.enabled === 'boolean' &&
               this.validationSchema.timeFormat(value.startTime) &&
               this.validationSchema.timeFormat(value.endTime);
      },
      
      notificationTypePrefs: (value: any) => {
        return value &&
               typeof value === 'object' &&
               typeof value.enabled === 'boolean' &&
               typeof value.sound === 'boolean' &&
               typeof value.vibration === 'boolean' &&
               typeof value.showPreview === 'boolean';
      },
      
      timeFormat: (value: string) => {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return typeof value === 'string' && timeRegex.test(value);
      },
    };
  }

  private validatePreferencesUpdate(updates: Partial<NotificationPreferences>): void {
    if (updates.userId) {
      throw new NotificationServiceError(
        'User ID cannot be updated',
        'INVALID_UPDATE',
        false
      );
    }

    if (updates.quietHours && !this.validationSchema.quietHours(updates.quietHours)) {
      throw new NotificationServiceError(
        'Invalid quiet hours configuration',
        'INVALID_QUIET_HOURS',
        false
      );
    }

    if (updates.preferences) {
      for (const [type, prefs] of Object.entries(updates.preferences)) {
        if (!this.validationSchema.notificationTypePrefs(prefs)) {
          throw new NotificationServiceError(
            `Invalid preferences for notification type: ${type}`,
            'INVALID_TYPE_PREFERENCES',
            false
          );
        }
      }
    }
  }

  private validateCompletePreferences(preferences: NotificationPreferences): void {
    if (!this.validationSchema.userId(preferences.userId)) {
      throw new NotificationServiceError(
        'Invalid user ID in preferences',
        'INVALID_PREFERENCES',
        false
      );
    }

    if (!this.validationSchema.quietHours(preferences.quietHours)) {
      throw new NotificationServiceError(
        'Invalid quiet hours in preferences',
        'INVALID_PREFERENCES',
        false
      );
    }

    // Validate all notification type preferences
    const requiredTypes: NotificationType[] = [
      'new_match', 'new_message', 'profile_view', 'super_like',
      'date_reminder', 'system_announcement', 'security_alert'
    ];

    for (const type of requiredTypes) {
      if (!preferences.preferences[type] || 
          !this.validationSchema.notificationTypePrefs(preferences.preferences[type])) {
        throw new NotificationServiceError(
          `Missing or invalid preferences for notification type: ${type}`,
          'INVALID_PREFERENCES',
          false
        );
      }
    }
  }

  private getCachedPreferences(userId: string): NotificationPreferences | null {
    const cached = this.cache.get(userId);
    const timestamp = this.cacheTimestamps.get(userId);
    
    if (cached && timestamp && (Date.now() - timestamp) < this.CACHE_EXPIRY_MS) {
      return cached;
    }
    
    // Cache expired
    this.cache.delete(userId);
    this.cacheTimestamps.delete(userId);
    return null;
  }

  private setCachedPreferences(userId: string, preferences: NotificationPreferences): void {
    this.cache.set(userId, preferences);
    this.cacheTimestamps.set(userId, Date.now());
  }

  private async getPreferencesFromDatabase(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await this.dependencies.database
        .from('notification_preferences')
        .select('preferences, updated_at')
        .eq('user_id', userId)
        .single();

      if (error || !data?.preferences) {
        return null;
      }

      return {
        ...data.preferences,
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error) {
      logWarn('Failed to fetch preferences from database:', "Warning", error);
      return null;
    }
  }

  private async getPreferencesFromStorage(userId: string): Promise<NotificationPreferences | null> {
    try {
      const stored = await this.dependencies.storage.getItem(`notification_preferences_${userId}`);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        updatedAt: new Date(parsed.updatedAt),
      };
      
    } catch (error) {
      logWarn('Failed to fetch preferences from storage:', "Warning", error);
      return null;
    }
  }

  private async savePreferencesToDatabase(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    const { error } = await this.dependencies.database
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        preferences: {
          ...preferences,
          updatedAt: preferences.updatedAt.toISOString(),
        },
        updated_at: preferences.updatedAt.toISOString(),
      });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  private async savePreferencesToStorage(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    const serializable = {
      ...preferences,
      updatedAt: preferences.updatedAt.toISOString(),
    };

    await this.dependencies.storage.setItem(
      `notification_preferences_${userId}`,
      JSON.stringify(serializable)
    );
  }

  private async syncToDatabase(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      await this.savePreferencesToDatabase(userId, preferences);
    } catch (error) {
      logWarn('Failed to sync preferences to database:', "Warning", error);
    }
  }

  private createDefaultPreferences(userId: string): NotificationPreferences {
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
          batchingDelay: 5, // minutes
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
          advanceNotice: 30, // minutes
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

  private isInQuietHours(quietHours: NotificationPreferences['quietHours']): boolean {
    if (!quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const currentMinutes = this.timeToMinutes(currentTime);
    const startMinutes = this.timeToMinutes(quietHours.startTime);
    const endMinutes = this.timeToMinutes(quietHours.endTime);

    if (startMinutes <= endMinutes) {
      // Quiet hours within same day (e.g., 22:00 to 23:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Quiet hours cross midnight (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

// Export singleton instance factory
export const notificationPreferencesService = NotificationPreferencesService.create();
