import { secureStorage } from '../utils/secure-storage';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/react-native';

interface PrivacySettings {
  // Read receipts
  readReceipts: {
    enabled: boolean;
    showToEveryone: boolean;
    showToMatches: boolean;
    exceptions: string[]; // User IDs who can/cannot see read receipts
  };
  
  // Online status
  onlineStatus: {
    enabled: boolean;
    showToEveryone: boolean;
    showToMatches: boolean;
    showLastSeen: boolean;
    lastSeenAccuracy: 'exact' | 'approximate' | 'hidden';
    exceptions: string[];
  };
  
  // Typing indicators
  typingIndicators: {
    enabled: boolean;
    showToEveryone: boolean;
    showToMatches: boolean;
    exceptions: string[];
  };
  
  // Message deletion
  messageDeletion: {
    allowDeleteForEveryone: boolean;
    deleteTimeLimit: number; // in minutes
    showDeletedMessageStub: boolean;
  };
  
  // Photo messages
  photoMessages: {
    allowSaving: boolean;
    allowScreenshots: boolean;
    autoDeleteAfterDays: number;
    blurInNotifications: boolean;
  };
  
  // General privacy
  general: {
    showProfileInMessages: boolean;
    allowForwarding: boolean;
    dataRetentionDays: number;
    requireFaceIdForMessages: boolean;
  };
}

interface PrivacyRule {
  id: string;
  userId: string;
  setting: string;
  targetUserId: string;
  allowed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PrivacyAuditLog {
  id: string;
  userId: string;
  action: string;
  setting: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
  ipAddress?: string;
}

class PrivacyControlsService {
  private defaultSettings: PrivacySettings = {
    readReceipts: {
      enabled: true,
      showToEveryone: false,
      showToMatches: true,
      exceptions: [],
    },
    onlineStatus: {
      enabled: true,
      showToEveryone: false,
      showToMatches: true,
      showLastSeen: true,
      lastSeenAccuracy: 'approximate',
      exceptions: [],
    },
    typingIndicators: {
      enabled: true,
      showToEveryone: false,
      showToMatches: true,
      exceptions: [],
    },
    messageDeletion: {
      allowDeleteForEveryone: false,
      deleteTimeLimit: 15,
      showDeletedMessageStub: true,
    },
    photoMessages: {
      allowSaving: false,
      allowScreenshots: false,
      autoDeleteAfterDays: 30,
      blurInNotifications: true,
    },
    general: {
      showProfileInMessages: true,
      allowForwarding: false,
      dataRetentionDays: 90,
      requireFaceIdForMessages: false,
    },
  };

  private currentSettings: PrivacySettings;
  private userId: string | null = null;

  constructor() {
    this.currentSettings = { ...this.defaultSettings };
  }

  // Initialize privacy settings for user
  async initializePrivacySettings(userId: string): Promise<void> {
    try {
      this.userId = userId;
      
      // Load settings from local storage first
      const localSettings = await this.loadLocalSettings();
      if (localSettings) {
        this.currentSettings = { ...this.defaultSettings, ...localSettings };
      }

      // Sync with server
      await this.syncWithServer();

      logger.info('Privacy settings initialized', undefined, { userId }, 'PRIVACY');
    } catch (error) {
      logger.error('Failed to initialize privacy settings', error instanceof Error ? error : undefined, { userId }, 'PRIVACY');
      throw error;
    }
  }

  // Get current privacy settings
  getPrivacySettings(): PrivacySettings {
    return { ...this.currentSettings };
  }

  // Update privacy settings
  async updatePrivacySettings(
    updates: Partial<PrivacySettings>,
    auditReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.userId) {
      return { success: false, error: 'User not initialized' };
    }

    try {
      const oldSettings = { ...this.currentSettings };
      const newSettings = this.mergeSettings(this.currentSettings, updates);

      // Validate settings
      const validation = this.validateSettings(newSettings);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Update local settings
      this.currentSettings = newSettings;

      // Save locally
      await this.saveLocalSettings(newSettings);

      // Sync with server
      await this.syncWithServer();

      // Log privacy changes
      await this.logPrivacyChanges(oldSettings, newSettings, auditReason);

      logger.info('Privacy settings updated', undefined, { userId: this.userId, hasAuditReason: !!auditReason }, 'PRIVACY');
      
      return { success: true };

    } catch (error) {
      logger.error('Failed to update privacy settings', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update settings' 
      };
    }
  }

  // Check if user can see read receipts from another user
  async canSeeReadReceipts(fromUserId: string, toUserId: string): Promise<boolean> {
    try {
      // Get recipient's privacy settings
      const recipientSettings = await this.getUserPrivacySettings(fromUserId);
      if (!recipientSettings.readReceipts.enabled) {
        return false;
      }

      // Check exceptions first
      if (recipientSettings.readReceipts.exceptions.includes(toUserId)) {
        // Exception means opposite of default rule
        return !recipientSettings.readReceipts.showToMatches;
      }

      // Check if they're matches
      const areMatched = await this.areUsersMatched(fromUserId, toUserId);
      
      if (recipientSettings.readReceipts.showToEveryone) {
        return true;
      } else if (recipientSettings.readReceipts.showToMatches && areMatched) {
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to check read receipt permissions', error instanceof Error ? error : undefined, { fromUserId, toUserId }, 'PRIVACY');
      return false; // Default to not showing for privacy
    }
  }

  // Check if user can see online status from another user
  async canSeeOnlineStatus(fromUserId: string, toUserId: string): Promise<{
    canSee: boolean;
    showLastSeen: boolean;
    lastSeenAccuracy: 'exact' | 'approximate' | 'hidden';
  }> {
    try {
      const recipientSettings = await this.getUserPrivacySettings(fromUserId);
      
      if (!recipientSettings.onlineStatus.enabled) {
        return { canSee: false, showLastSeen: false, lastSeenAccuracy: 'hidden' };
      }

      // Check exceptions
      if (recipientSettings.onlineStatus.exceptions.includes(toUserId)) {
        const baseAllowed = recipientSettings.onlineStatus.showToMatches;
        return {
          canSee: !baseAllowed,
          showLastSeen: !baseAllowed && recipientSettings.onlineStatus.showLastSeen,
          lastSeenAccuracy: !baseAllowed ? recipientSettings.onlineStatus.lastSeenAccuracy : 'hidden',
        };
      }

      const areMatched = await this.areUsersMatched(fromUserId, toUserId);
      
      if (recipientSettings.onlineStatus.showToEveryone) {
        return {
          canSee: true,
          showLastSeen: recipientSettings.onlineStatus.showLastSeen,
          lastSeenAccuracy: recipientSettings.onlineStatus.lastSeenAccuracy,
        };
      } else if (recipientSettings.onlineStatus.showToMatches && areMatched) {
        return {
          canSee: true,
          showLastSeen: recipientSettings.onlineStatus.showLastSeen,
          lastSeenAccuracy: recipientSettings.onlineStatus.lastSeenAccuracy,
        };
      }

      return { canSee: false, showLastSeen: false, lastSeenAccuracy: 'hidden' };

    } catch (error) {
      logger.error('Failed to check online status permissions', error instanceof Error ? error : undefined, { fromUserId, toUserId }, 'PRIVACY');
      return { canSee: false, showLastSeen: false, lastSeenAccuracy: 'hidden' };
    }
  }

  // Check if user can see typing indicators from another user
  async canSeeTypingIndicators(fromUserId: string, toUserId: string): Promise<boolean> {
    try {
      const recipientSettings = await this.getUserPrivacySettings(fromUserId);
      
      if (!recipientSettings.typingIndicators.enabled) {
        return false;
      }

      if (recipientSettings.typingIndicators.exceptions.includes(toUserId)) {
        return !recipientSettings.typingIndicators.showToMatches;
      }

      const areMatched = await this.areUsersMatched(fromUserId, toUserId);
      
      if (recipientSettings.typingIndicators.showToEveryone) {
        return true;
      } else if (recipientSettings.typingIndicators.showToMatches && areMatched) {
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to check typing indicator permissions', error instanceof Error ? error : undefined, { fromUserId, toUserId }, 'PRIVACY');
      return false;
    }
  }

  // Add privacy exception for a user
  async addPrivacyException(
    setting: keyof PrivacySettings,
    targetUserId: string,
    allow: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.userId) {
      return { success: false, error: 'User not initialized' };
    }

    try {
      const currentSetting = this.currentSettings[setting] as any;
      if (!currentSetting || !('exceptions' in currentSetting)) {
        return { success: false, error: 'Invalid setting type' };
      }

      // Remove existing exception if any
      const exceptions = currentSetting.exceptions.filter((id: string) => id !== targetUserId);
      
      // Add new exception (only if different from default behavior)
      const defaultBehavior = currentSetting.showToMatches;
      if (allow !== defaultBehavior) {
        exceptions.push(targetUserId);
      }

      // Update settings
      const updates = {
        [setting]: {
          ...currentSetting,
          exceptions,
        },
      };

      return await this.updatePrivacySettings(updates as Partial<PrivacySettings>, `Exception for ${targetUserId}`);

    } catch (error) {
      logger.error('Failed to add privacy exception', error instanceof Error ? error : undefined, { setting, targetUserId, allow }, 'PRIVACY');
      return { success: false, error: 'Failed to add exception' };
    }
  }

  // Get privacy audit log
  async getPrivacyAuditLog(limit: number = 50): Promise<PrivacyAuditLog[]> {
    if (!this.userId) return [];

    try {
      const { data, error } = await supabase
        .from('privacy_audit_logs')
        .select('*')
        .eq('user_id', this.userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error('Failed to get privacy audit log', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      return [];
    }
  }

  // Export privacy settings
  async exportPrivacyData(): Promise<{
    settings: PrivacySettings;
    auditLog: PrivacyAuditLog[];
    rules: PrivacyRule[];
  }> {
    if (!this.userId) {
      throw new Error('User not initialized');
    }

    try {
      const [auditLog, rules] = await Promise.all([
        this.getPrivacyAuditLog(1000), // Get all logs
        this.getPrivacyRules(),
      ]);

      return {
        settings: this.getPrivacySettings(),
        auditLog,
        rules,
      };

    } catch (error) {
      logger.error('Failed to export privacy data', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      throw error;
    }
  }

  // Delete all privacy data
  async deletePrivacyData(): Promise<{ success: boolean; error?: string }> {
    if (!this.userId) {
      return { success: false, error: 'User not initialized' };
    }

    try {
      // Delete from server
      await Promise.all([
        supabase.from('user_privacy_settings').delete().eq('user_id', this.userId),
        supabase.from('privacy_rules').delete().eq('user_id', this.userId),
        supabase.from('privacy_audit_logs').delete().eq('user_id', this.userId),
      ]);

      // Clear local storage
      await secureStorage.deleteSecureItem(`privacy_settings_${this.userId}`);

      // Reset to defaults
      this.currentSettings = { ...this.defaultSettings };

      logger.info('Privacy data deleted', undefined, { userId: this.userId }, 'PRIVACY');
      return { success: true };

    } catch (error) {
      logger.error('Failed to delete privacy data', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      return { success: false, error: 'Failed to delete privacy data' };
    }
  }

  // Private helper methods
  private async loadLocalSettings(): Promise<PrivacySettings | null> {
    if (!this.userId) return null;

    try {
      const stored = await secureStorage.getSecureItem(`privacy_settings_${this.userId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      logger.error('Failed to load local privacy settings', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      return null;
    }
  }

  private async saveLocalSettings(settings: PrivacySettings): Promise<void> {
    if (!this.userId) return;

    try {
      await secureStorage.storeSecureItem(`privacy_settings_${this.userId}`, JSON.stringify(settings));
    } catch (error) {
      logger.error('Failed to save local privacy settings', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
    }
  }

  private async syncWithServer(): Promise<void> {
    if (!this.userId) return;

    try {
      // Update server settings
      const { error } = await supabase
        .from('user_privacy_settings')
        .upsert({
          user_id: this.userId,
          settings: this.currentSettings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

    } catch (error) {
      logger.error('Failed to sync privacy settings with server', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      // Don't throw - local settings still work
    }
  }

  private async getUserPrivacySettings(userId: string): Promise<PrivacySettings> {
    try {
      const { data, error } = await supabase
        .from('user_privacy_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { ...this.defaultSettings }; // Return defaults if not found
      }

      return { ...this.defaultSettings, ...data.settings };

    } catch (error) {
      logger.error('Failed to get user privacy settings', error instanceof Error ? error : undefined, { userId }, 'PRIVACY');
      return { ...this.defaultSettings };
    }
  }

  private async areUsersMatched(userId1: string, userId2: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`)
        .limit(1);

      if (error) throw error;

      return (data?.length || 0) > 0;

    } catch (error) {
      logger.error('Failed to check if users are matched', error instanceof Error ? error : undefined, { userId1, userId2 }, 'PRIVACY');
      return false;
    }
  }

  private mergeSettings(current: PrivacySettings, updates: Partial<PrivacySettings>): PrivacySettings {
    const merged = { ...current };

    for (const [key, value] of Object.entries(updates)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        (merged as any)[key] = { ...(merged as any)[key], ...value };
      } else {
        (merged as any)[key] = value;
      }
    }

    return merged;
  }

  private validateSettings(settings: PrivacySettings): { valid: boolean; error?: string } {
    // Validate retention periods
    if (settings.general.dataRetentionDays < 1 || settings.general.dataRetentionDays > 365) {
      return { valid: false, error: 'Data retention must be between 1-365 days' };
    }

    

    if (settings.photoMessages.autoDeleteAfterDays < 1 || settings.photoMessages.autoDeleteAfterDays > 365) {
      return { valid: false, error: 'Photo message retention must be between 1-365 days' };
    }

    // Validate delete time limit
    if (settings.messageDeletion.deleteTimeLimit < 1 || settings.messageDeletion.deleteTimeLimit > 1440) {
      return { valid: false, error: 'Delete time limit must be between 1 minute and 24 hours' };
    }

    return { valid: true };
  }

  private async logPrivacyChanges(
    oldSettings: PrivacySettings,
    newSettings: PrivacySettings,
    reason?: string
  ): Promise<void> {
    if (!this.userId) return;

    try {
      const changes: PrivacyAuditLog[] = [];
      
      // Deep comparison to find changes
      this.findSettingsChanges(oldSettings, newSettings, '', changes);

      if (changes.length > 0) {
        for (const change of changes) {
          change.userId = this.userId;
          change.timestamp = new Date().toISOString();
        }

        await supabase.from('privacy_audit_logs').insert(changes);
        
        Sentry.addBreadcrumb({
          message: 'Privacy settings changed',
          category: 'privacy',
          level: 'info',
          data: {
            userId: this.userId,
            changesCount: changes.length,
            reason,
          },
        });
      }

    } catch (error) {
      logger.error('Failed to log privacy changes', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
    }
  }

  private findSettingsChanges(
    oldObj: any,
    newObj: any,
    path: string,
    changes: PrivacyAuditLog[]
  ): void {
    for (const key in newObj) {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldObj[key];
      const newValue = newObj[key];

      if (typeof newValue === 'object' && !Array.isArray(newValue) && newValue !== null) {
        this.findSettingsChanges(oldValue || {}, newValue, currentPath, changes);
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          id: '', // Will be set by database
          userId: '', // Will be set by caller
          action: 'update',
          setting: currentPath,
          oldValue,
          newValue,
          timestamp: '', // Will be set by caller
        });
      }
    }
  }

  private async getPrivacyRules(): Promise<PrivacyRule[]> {
    if (!this.userId) return [];

    try {
      const { data, error } = await supabase
        .from('privacy_rules')
        .select('*')
        .eq('user_id', this.userId);

      if (error) throw error;

      return data || [];

    } catch (error) {
      logger.error('Failed to get privacy rules', error instanceof Error ? error : undefined, { userId: this.userId }, 'PRIVACY');
      return [];
    }
  }
}

// Singleton instance
let privacyControlsService: PrivacyControlsService | null = null;

export const getPrivacyControlsService = (): PrivacyControlsService => {
  if (!privacyControlsService) {
    privacyControlsService = new PrivacyControlsService();
  }
  return privacyControlsService;
};

export type { PrivacySettings, PrivacyRule, PrivacyAuditLog };
export default PrivacyControlsService;
