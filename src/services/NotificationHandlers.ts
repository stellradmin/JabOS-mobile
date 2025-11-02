/**
 * Specialized Notification Handlers for Stellr Dating App
 * Following Single Responsibility and Strategy Pattern
 * Each handler is responsible for one specific type of notification
 */

import { Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import {
  StellarNotification,
  NewMatchNotification,
  NewMessageNotification,
  ProfileViewNotification,
  SuperLikeNotification,
  DateReminderNotification,
  SystemAnnouncementNotification,
  SecurityAlertNotification,
  DeepLinkConfig,
  NotificationServiceError
} from '../types/notification-types';

// Base Handler Interface following Strategy Pattern
interface NotificationHandler<T extends StellarNotification> {
  readonly type: T['type'];
  handle(notification: T): Promise<NotificationHandlingResult>;
  createDeepLink(notification: T): DeepLinkConfig;
  shouldShowPreview(notification: T): boolean;
  formatForDisplay(notification: T): DisplayNotification;
}

// Handler Result Interface following Command Query Separation
export interface NotificationHandlingResult {
  readonly success: boolean;
  readonly action?: 'navigate' | 'update_ui' | 'show_modal' | 'none';
  readonly deepLink?: DeepLinkConfig;
  readonly shouldVibrate?: boolean;
  readonly shouldPlaySound?: boolean;
  readonly errorMessage?: string;
}

// Display Notification Interface for UI consumption
export interface DisplayNotification {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly timestamp: Date;
  readonly avatar?: string;
  readonly icon: string;
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly actions?: NotificationAction[];
}

export interface NotificationAction {
  readonly id: string;
  readonly title: string;
  readonly type: 'primary' | 'secondary' | 'destructive';
  readonly requiresAuth?: boolean;
}

/**
 * Handler for new match notifications
 * Creates excitement and encourages engagement
 */
export class NewMatchNotificationHandler implements NotificationHandler<NewMatchNotification> {
  readonly type = 'new_match' as const;

  async handle(notification: NewMatchNotification): Promise<NotificationHandlingResult> {
    try {
      // Play celebratory haptic feedback for new matches
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Show exciting notification
      await this.showLocalNotification(notification);

      return {
        success: true,
        action: 'show_modal',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: true,
        shouldPlaySound: true,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle new match notification: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: NewMatchNotification): DeepLinkConfig {
    return {
      screen: 'MatchDetail',
      params: {
        matchId: notification.data.matchId,
        userId: notification.data.otherUserId,
        conversationId: notification.data.conversationId || '',
      },
      requiresAuth: true,
      fallbackUrl: 'stellr://matches',
    };
  }

  shouldShowPreview(notification: NewMatchNotification): boolean {
    // Always show previews for matches to create excitement
    return true;
  }

  formatForDisplay(notification: NewMatchNotification): DisplayNotification {
    return {
      id: notification.id,
      title: '🎉 It\'s a Match!',
      subtitle: `You and ${notification.data.otherUserName} liked each other`,
      body: notification.data.compatibilityScore 
        ? `${notification.data.compatibilityScore}% compatibility • Start a conversation!`
        : 'Start a conversation!',
      timestamp: notification.createdAt,
      avatar: notification.data.otherUserAvatar,
      icon: 'heart',
      priority: 'high',
      actions: [
        {
          id: 'start_chat',
          title: 'Start Chat',
          type: 'primary',
          requiresAuth: true,
        },
        {
          id: 'view_profile',
          title: 'View Profile',
          type: 'secondary',
          requiresAuth: true,
        },
      ],
    };
  }

  private async showLocalNotification(notification: NewMatchNotification): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 It\'s a Match!',
        body: `You and ${notification.data.otherUserName} liked each other!`,
        data: {
          type: 'new_match',
          matchId: notification.data.matchId,
          deepLink: this.createDeepLink(notification),
        },
      },
      trigger: null, // Show immediately
    });
  }
}

/**
 * Handler for new message notifications
 * Optimized for quick response and engagement
 */
export class NewMessageNotificationHandler implements NotificationHandler<NewMessageNotification> {
  readonly type = 'new_message' as const;

  async handle(notification: NewMessageNotification): Promise<NotificationHandlingResult> {
    try {
      // Gentle haptic for messages
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      return {
        success: true,
        action: 'update_ui',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: true,
        shouldPlaySound: true,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle new message notification: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: NewMessageNotification): DeepLinkConfig {
    return {
      screen: 'Conversation',
      params: {
        conversationId: notification.data.conversationId,
        partnerId: notification.data.senderId,
      },
      requiresAuth: true,
      fallbackUrl: 'stellr://messages',
    };
  }

  shouldShowPreview(notification: NewMessageNotification): boolean {
    // Show preview only if message type is text (privacy concern for images)
    return notification.data.messageType === 'text';
  }

  formatForDisplay(notification: NewMessageNotification): DisplayNotification {
    const messagePreview = this.shouldShowPreview(notification) 
      ? notification.data.messagePreview
      : this.getMessageTypeDescription(notification.data.messageType);

    return {
      id: notification.id,
      title: notification.data.senderName,
      subtitle: 'New message',
      body: messagePreview,
      timestamp: notification.createdAt,
      avatar: notification.data.senderAvatar,
      icon: 'message-circle',
      priority: 'normal',
      actions: [
        {
          id: 'reply',
          title: 'Reply',
          type: 'primary',
          requiresAuth: true,
        },
        {
          id: 'mark_read',
          title: 'Mark Read',
          type: 'secondary',
        },
      ],
    };
  }

  private getMessageTypeDescription(messageType: 'text' | 'image'): string {
    switch (messageType) {
      case 'image':
        return '📷 Photo';
      case 'text':
      default:
        return 'Message';
    }
  }
}

/**
 * Handler for profile view notifications
 * Builds confidence and encourages profile optimization
 */
export class ProfileViewNotificationHandler implements NotificationHandler<ProfileViewNotification> {
  readonly type = 'profile_view' as const;

  async handle(notification: ProfileViewNotification): Promise<NotificationHandlingResult> {
    try {
      return {
        success: true,
        action: 'update_ui',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: false, // Subtle notification
        shouldPlaySound: false,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle profile view notification: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: ProfileViewNotification): DeepLinkConfig {
    return {
      screen: 'ProfileVisitors',
      params: {
        viewerId: notification.data.viewerId,
      },
      requiresAuth: true,
      fallbackUrl: 'stellr://profile/visitors',
    };
  }

  shouldShowPreview(notification: ProfileViewNotification): boolean {
    // Show preview based on privacy settings and premium status
    return notification.data.isPremiumUser || this.isPremiumFeatureEnabled();
  }

  formatForDisplay(notification: ProfileViewNotification): DisplayNotification {
    const title = notification.data.isPremiumUser
      ? `${notification.data.viewerName} viewed your profile`
      : 'Someone viewed your profile';

    return {
      id: notification.id,
      title: 'Profile View',
      subtitle: title,
      body: this.formatViewTime(notification.data.viewedAt),
      timestamp: notification.createdAt,
      avatar: notification.data.viewerAvatar,
      icon: 'eye',
      priority: 'low',
      actions: notification.data.isPremiumUser ? [
        {
          id: 'view_profile',
          title: 'View Profile',
          type: 'primary',
          requiresAuth: true,
        },
      ] : [
        {
          id: 'upgrade_premium',
          title: 'See Who Viewed',
          type: 'primary',
          requiresAuth: true,
        },
      ],
    };
  }

  private formatViewTime(viewedAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - viewedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private isPremiumFeatureEnabled(): boolean {
    try {
      // Check if we have access to the app context and subscription state
      const g: any = globalThis as any;
      if (typeof g !== 'undefined' && 
          g.__STELLR_APP_STATE__ && 
          g.__STELLR_APP_STATE__.subscription) {
        const subscription = g.__STELLR_APP_STATE__.subscription;
        return subscription.isActive && subscription.plan !== null;
      }
      
      // Fallback to assuming non-premium if context unavailable
      return false;
    } catch (error) {
      // Fail safe - if we can't determine subscription status, assume non-premium
      console.warn('Failed to check premium status:', error);
      return false;
    }
  }
}

/**
 * Handler for super like notifications
 * Creates high-value interaction opportunity
 */
export class SuperLikeNotificationHandler implements NotificationHandler<SuperLikeNotification> {
  readonly type = 'super_like' as const;

  async handle(notification: SuperLikeNotification): Promise<NotificationHandlingResult> {
    try {
      // Strong haptic for super likes
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      return {
        success: true,
        action: 'show_modal',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: true,
        shouldPlaySound: true,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle super like notification: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: SuperLikeNotification): DeepLinkConfig {
    return {
      screen: 'SuperLikeDetail',
      params: {
        likerId: notification.data.likerId,
      },
      requiresAuth: true,
      fallbackUrl: 'stellr://likes',
    };
  }

  shouldShowPreview(notification: SuperLikeNotification): boolean {
    return true; // Always show super like previews
  }

  formatForDisplay(notification: SuperLikeNotification): DisplayNotification {
    return {
      id: notification.id,
      title: '⭐ Super Like!',
      subtitle: `${notification.data.likerName} super liked you!`,
      body: notification.data.message || 'They really want to meet you!',
      timestamp: notification.createdAt,
      avatar: notification.data.likerAvatar,
      icon: 'star',
      priority: 'high',
      actions: [
        {
          id: 'like_back',
          title: 'Like Back',
          type: 'primary',
          requiresAuth: true,
        },
        {
          id: 'super_like_back',
          title: 'Super Like Back',
          type: 'primary',
          requiresAuth: true,
        },
        {
          id: 'view_profile',
          title: 'View Profile',
          type: 'secondary',
          requiresAuth: true,
        },
      ],
    };
  }
}

/**
 * Handler for date reminder notifications
 * Ensures users don't miss important dates
 */
export class DateReminderNotificationHandler implements NotificationHandler<DateReminderNotification> {
  readonly type = 'date_reminder' as const;

  async handle(notification: DateReminderNotification): Promise<NotificationHandlingResult> {
    try {
      // Important haptic for date reminders
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      return {
        success: true,
        action: 'navigate',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: true,
        shouldPlaySound: true,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle date reminder notification: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: DateReminderNotification): DeepLinkConfig {
    return {
      screen: 'DateDetail',
      params: {
        dateId: notification.data.dateId,
        partnerId: notification.data.partnerId,
      },
      requiresAuth: true,
      fallbackUrl: 'stellr://dates',
    };
  }

  shouldShowPreview(notification: DateReminderNotification): boolean {
    return true; // Always show date reminders
  }

  formatForDisplay(notification: DateReminderNotification): DisplayNotification {
    const { reminderType, partnerName, scheduledTime, location } = notification.data;
    
    const titles = {
      upcoming: '📅 Date Reminder',
      starting_soon: '⏰ Date Starting Soon',
      missed: '😟 Missed Date',
    };

    const bodies = {
      upcoming: `Your date with ${partnerName} is ${this.formatTimeUntil(scheduledTime)}`,
      starting_soon: `Your date with ${partnerName} starts in 15 minutes`,
      missed: `You missed your date with ${partnerName}`,
    };

    return {
      id: notification.id,
      title: titles[reminderType],
      subtitle: `Date with ${partnerName}`,
      body: location ? `${bodies[reminderType]} • ${location}` : bodies[reminderType],
      timestamp: notification.createdAt,
      icon: 'calendar',
      priority: reminderType === 'starting_soon' ? 'critical' : 'high',
      actions: this.getActionsForReminderType(reminderType),
    };
  }

  private formatTimeUntil(scheduledTime: Date): string {
    const now = new Date();
    const diffMs = scheduledTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffHours > 0) {
      return `in ${diffHours}h ${diffMins}m`;
    } else {
      return `in ${diffMins}m`;
    }
  }

  private getActionsForReminderType(type: 'upcoming' | 'starting_soon' | 'missed'): NotificationAction[] {
    switch (type) {
      case 'upcoming':
        return [
          { id: 'view_details', title: 'View Details', type: 'primary', requiresAuth: true },
          { id: 'reschedule', title: 'Reschedule', type: 'secondary', requiresAuth: true },
        ];
      case 'starting_soon':
        return [
          { id: 'on_my_way', title: 'On My Way', type: 'primary', requiresAuth: true },
          { id: 'running_late', title: 'Running Late', type: 'secondary', requiresAuth: true },
        ];
      case 'missed':
        return [
          { id: 'apologize', title: 'Send Apology', type: 'primary', requiresAuth: true },
          { id: 'reschedule', title: 'Reschedule', type: 'secondary', requiresAuth: true },
        ];
      default:
        return [];
    }
  }
}

/**
 * Handler for system announcements
 * Communicates important app updates and features
 */
export class SystemAnnouncementNotificationHandler implements NotificationHandler<SystemAnnouncementNotification> {
  readonly type = 'system_announcement' as const;

  async handle(notification: SystemAnnouncementNotification): Promise<NotificationHandlingResult> {
    try {
      return {
        success: true,
        action: notification.data.actionRequired ? 'show_modal' : 'update_ui',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: notification.data.actionRequired,
        shouldPlaySound: false,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle system announcement: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: SystemAnnouncementNotification): DeepLinkConfig {
    if (notification.data.deepLink) {
      return {
        screen: 'WebView',
        params: { url: notification.data.deepLink },
        requiresAuth: false,
        fallbackUrl: notification.data.deepLink,
      };
    }

    return {
      screen: 'Announcements',
      params: { announcementId: notification.data.announcementId },
      requiresAuth: false,
      fallbackUrl: 'stellr://announcements',
    };
  }

  shouldShowPreview(notification: SystemAnnouncementNotification): boolean {
    return true; // System announcements are always safe to preview
  }

  formatForDisplay(notification: SystemAnnouncementNotification): DisplayNotification {
    const categoryIcons = {
      feature: '✨',
      maintenance: '🔧',
      policy: '📋',
      promotion: '🎉',
    };

    return {
      id: notification.id,
      title: `${categoryIcons[notification.data.category]} ${notification.title}`,
      subtitle: 'Stellr Update',
      body: notification.body,
      timestamp: notification.createdAt,
      icon: 'info',
      priority: notification.data.actionRequired ? 'high' : 'normal',
      actions: notification.data.actionRequired ? [
        { id: 'take_action', title: 'View Details', type: 'primary' },
      ] : [],
    };
  }
}

/**
 * Handler for security alerts
 * Critical notifications requiring immediate attention
 */
export class SecurityAlertNotificationHandler implements NotificationHandler<SecurityAlertNotification> {
  readonly type = 'security_alert' as const;

  async handle(notification: SecurityAlertNotification): Promise<NotificationHandlingResult> {
    try {
      // Critical haptic for security alerts
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      return {
        success: true,
        action: 'show_modal',
        deepLink: this.createDeepLink(notification),
        shouldVibrate: true,
        shouldPlaySound: true,
      };
      
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to handle security alert: ${error.message}`,
      };
    }
  }

  createDeepLink(notification: SecurityAlertNotification): DeepLinkConfig {
    return {
      screen: 'SecurityAlert',
      params: {
        alertId: notification.data.alertId,
        alertType: notification.data.alertType,
      },
      requiresAuth: true,
      fallbackUrl: 'stellr://security',
    };
  }

  shouldShowPreview(notification: SecurityAlertNotification): boolean {
    return true; // Security alerts should always be visible
  }

  formatForDisplay(notification: SecurityAlertNotification): DisplayNotification {
    const alertTypeDescriptions = {
      login_attempt: 'Suspicious login attempt detected',
      profile_change: 'Your profile was modified',
      suspicious_activity: 'Unusual activity detected',
    };

    return {
      id: notification.id,
      title: '🔒 Security Alert',
      subtitle: alertTypeDescriptions[notification.data.alertType],
      body: this.formatSecurityBody(notification),
      timestamp: notification.createdAt,
      icon: 'shield-alert',
      priority: 'critical',
      actions: [
        {
          id: 'secure_account',
          title: 'Secure Account',
          type: 'primary',
          requiresAuth: true,
        },
        {
          id: 'view_details',
          title: 'View Details',
          type: 'secondary',
          requiresAuth: true,
        },
      ],
    };
  }

  private formatSecurityBody(notification: SecurityAlertNotification): string {
    const { location, deviceInfo } = notification.data;
    let body = notification.body;

    if (location) {
      body += ` • Location: ${location}`;
    }

    if (deviceInfo) {
      body += ` • Device: ${deviceInfo}`;
    }

    return body;
  }
}

/**
 * Notification Handler Registry
 * Manages all notification handlers following Registry Pattern
 */
export class NotificationHandlerRegistry {
  private static instance: NotificationHandlerRegistry | null = null;
  private readonly handlers: Map<string, NotificationHandler<any>> = new Map();

  private constructor() {
    this.registerDefaultHandlers();
  }

  static getInstance(): NotificationHandlerRegistry {
    if (!NotificationHandlerRegistry.instance) {
      NotificationHandlerRegistry.instance = new NotificationHandlerRegistry();
    }
    return NotificationHandlerRegistry.instance;
  }

  private registerDefaultHandlers(): void {
    this.registerHandler(new NewMatchNotificationHandler());
    this.registerHandler(new NewMessageNotificationHandler());
    this.registerHandler(new ProfileViewNotificationHandler());
    this.registerHandler(new SuperLikeNotificationHandler());
    this.registerHandler(new DateReminderNotificationHandler());
    this.registerHandler(new SystemAnnouncementNotificationHandler());
    this.registerHandler(new SecurityAlertNotificationHandler());
  }

  registerHandler<T extends StellarNotification>(handler: NotificationHandler<T>): void {
    this.handlers.set(handler.type, handler);
  }

  getHandler<T extends StellarNotification>(type: T['type']): NotificationHandler<T> | null {
    return this.handlers.get(type) || null;
  }

  async handleNotification(notification: StellarNotification): Promise<NotificationHandlingResult> {
    const handler = this.getHandler(notification.type);
    
    if (!handler) {
      throw new NotificationServiceError(
        `No handler registered for notification type: ${notification.type}`,
        'NO_HANDLER_FOUND',
        false
      );
    }

    try {
      return await handler.handle(notification);
    } catch (error) {
      throw new NotificationServiceError(
        `Handler failed for notification type ${notification.type}: ${error.message}`,
        'HANDLER_EXECUTION_FAILED',
        true,
        error
      );
    }
  }

  createDeepLink(notification: StellarNotification): DeepLinkConfig | null {
    const handler = this.getHandler(notification.type);
    return handler ? handler.createDeepLink(notification) : null;
  }

  formatForDisplay(notification: StellarNotification): DisplayNotification | null {
    const handler = this.getHandler(notification.type);
    return handler ? handler.formatForDisplay(notification) : null;
  }
}

// Export singleton instance
export const notificationHandlerRegistry = NotificationHandlerRegistry.getInstance();
