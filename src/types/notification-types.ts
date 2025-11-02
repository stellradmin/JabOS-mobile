/**
 * Comprehensive Notification System Types
 * Following Security by Design and Single Responsibility Principle
 * Used for Stellr Dating App Push Notifications
 */

// Base Notification Types following Least Surprise Principle
export type NotificationType = 
  | 'new_match'
  | 'new_message'
  | 'profile_view'
  | 'super_like'
  | 'date_reminder'
  | 'system_announcement'
  | 'security_alert';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// Base Notification Interface following Single Responsibility
export interface BaseNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly priority: NotificationPriority;
  readonly status: NotificationStatus;
  readonly createdAt: Date;
  readonly scheduledFor?: Date;
  readonly expiresAt?: Date;
  readonly data?: unknown;
}

// Specific Notification Payload Types following Separation of Concerns
export interface NewMatchNotificationData {
  readonly matchId: string;
  readonly conversationId?: string;
  readonly otherUserId: string;
  readonly otherUserName: string;
  readonly otherUserAvatar?: string;
  readonly compatibilityScore?: number;
}

export interface NewMessageNotificationData {
  readonly conversationId: string;
  readonly messageId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderAvatar?: string;
  readonly messagePreview: string;
  readonly messageType: 'text' | 'image';
}

export interface ProfileViewNotificationData {
  readonly viewerId: string;
  readonly viewerName: string;
  readonly viewerAvatar?: string;
  readonly viewedAt: Date;
  readonly isPremiumUser: boolean;
}

export interface SuperLikeNotificationData {
  readonly likerId: string;
  readonly likerName: string;
  readonly likerAvatar?: string;
  readonly likedAt: Date;
  readonly message?: string;
}

export interface DateReminderNotificationData {
  readonly dateId: string;
  readonly partnerId: string;
  readonly partnerName: string;
  readonly scheduledTime: Date;
  readonly location?: string;
  readonly reminderType: 'upcoming' | 'starting_soon' | 'missed';
}

export interface SystemAnnouncementData {
  readonly announcementId: string;
  readonly category: 'feature' | 'maintenance' | 'policy' | 'promotion';
  readonly actionRequired: boolean;
  readonly deepLink?: string;
}

export interface SecurityAlertData {
  readonly alertId: string;
  readonly alertType: 'login_attempt' | 'profile_change' | 'suspicious_activity';
  readonly location?: string;
  readonly deviceInfo?: string;
  readonly actionRequired: boolean;
}

// Typed Notification Interfaces following Type Safety
export interface NewMatchNotification extends BaseNotification {
  readonly type: 'new_match';
  readonly data: NewMatchNotificationData;
}

export interface NewMessageNotification extends BaseNotification {
  readonly type: 'new_message';
  readonly data: NewMessageNotificationData;
}

export interface ProfileViewNotification extends BaseNotification {
  readonly type: 'profile_view';
  readonly data: ProfileViewNotificationData;
}

export interface SuperLikeNotification extends BaseNotification {
  readonly type: 'super_like';
  readonly data: SuperLikeNotificationData;
}

export interface DateReminderNotification extends BaseNotification {
  readonly type: 'date_reminder';
  readonly data: DateReminderNotificationData;
}

export interface SystemAnnouncementNotification extends BaseNotification {
  readonly type: 'system_announcement';
  readonly data: SystemAnnouncementData;
}

export interface SecurityAlertNotification extends BaseNotification {
  readonly type: 'security_alert';
  readonly data: SecurityAlertData;
}

// Union Type for all Notifications following DRY Principle
export type StellarNotification = 
  | NewMatchNotification
  | NewMessageNotification
  | ProfileViewNotification
  | SuperLikeNotification
  | DateReminderNotification
  | SystemAnnouncementNotification
  | SecurityAlertNotification;

// User Notification Preferences following Security by Design
export interface NotificationPreferences {
  readonly userId: string;
  readonly enabled: boolean;
  readonly quietHours: {
    readonly enabled: boolean;
    readonly startTime: string; // HH:mm format
    readonly endTime: string;   // HH:mm format
  };
  readonly preferences: {
    readonly new_match: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
      readonly showPreview: boolean;
    };
    readonly new_message: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
      readonly showPreview: boolean;
      readonly batchingEnabled: boolean;
      readonly batchingDelay: number; // minutes
    };
    readonly profile_view: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
      readonly showPreview: boolean;
      readonly premiumOnly: boolean;
    };
    readonly super_like: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
      readonly showPreview: boolean;
    };
    readonly date_reminder: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
      readonly advanceNotice: number; // minutes
    };
    readonly system_announcement: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
    };
    readonly security_alert: {
      readonly enabled: boolean;
      readonly sound: boolean;
      readonly vibration: boolean;
      readonly emailBackup: boolean;
    };
  };
  readonly updatedAt: Date;
}

// Push Token Management following Security by Design
export interface PushToken {
  readonly userId: string;
  readonly token: string;
  readonly platform: 'ios' | 'android' | 'web';
  readonly deviceId: string;
  readonly appVersion: string;
  readonly createdAt: Date;
  readonly lastValidated: Date;
  readonly isActive: boolean;
}

// Notification Delivery Status following Fail Fast Principle
export interface NotificationDelivery {
  readonly notificationId: string;
  readonly userId: string;
  readonly token: string;
  status: NotificationStatus;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
  readonly readAt?: Date;
  readonly failureReason?: string;
  retryCount: number;
  readonly maxRetries: number;
}

// Notification Batch for Performance following DRY Principle
export interface NotificationBatch {
  readonly batchId: string;
  readonly userId: string;
  readonly type: NotificationType;
  notifications: StellarNotification[];
  readonly scheduledFor: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  readonly createdAt: Date;
}

// Deep Link Configuration following Separation of Concerns
export interface DeepLinkConfig {
  readonly screen: string;
  readonly params?: Record<string, string | number>;
  readonly requiresAuth: boolean;
  readonly fallbackUrl?: string;
}

// Notification Service Errors following Fail Fast Principle
export class NotificationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NotificationServiceError';
  }
}

// Service Configuration following Security by Design
export interface NotificationServiceConfig {
  readonly enableBatching: boolean;
  readonly batchingDelay: number; // minutes
  readonly maxRetries: number;
  readonly retryBackoffMs: number;
  readonly tokenValidationInterval: number; // hours
  readonly enableAnalytics: boolean;
  readonly enableSecurityValidation: boolean;
  readonly quietHoursRespect: boolean;
}

// Analytics Tracking following Security by Design
export interface NotificationAnalytics {
  readonly notificationId: string;
  readonly type: NotificationType;
  readonly userId: string; // Hashed for privacy
  readonly event: 'sent' | 'delivered' | 'opened' | 'dismissed' | 'failed';
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
