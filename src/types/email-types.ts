/**
 * Comprehensive Email Service Types for Stellr Dating App
 * Following Security by Design and Single Responsibility Principle
 * Production-ready with GDPR and CAN-SPAM compliance
 */

// Email Types following Least Surprise Principle
export type EmailType = 
  | 'verification'
  | 'password_reset'
  | 'welcome'
  | 'match_notification'
  | 'weekly_digest'
  | 'security_alert'
  | 'account_update'
  | 'subscription_update'
  | 'date_reminder'
  | 'engagement_summary'
  | 'promotional'
  | 'system_announcement';

export type EmailPriority = 'low' | 'normal' | 'high' | 'critical';
export type EmailStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'unsubscribed';
export type EmailProvider = 'sendgrid' | 'resend' | 'postmark';

// Base Email Interface following Single Responsibility
export interface BaseEmail {
  readonly id: string;
  readonly type: EmailType;
  readonly userId: string;
  readonly recipientEmail: string;
  readonly recipientName?: string;
  readonly subject: string;
  readonly priority: EmailPriority;
  readonly status: EmailStatus;
  readonly createdAt: Date;
  readonly scheduledFor?: Date;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
  readonly openedAt?: Date;
  readonly clickedAt?: Date;
  readonly expiresAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

// Email Content Interface following Separation of Concerns
export interface EmailContent {
  readonly templateId: string;
  readonly htmlBody: string;
  readonly textBody: string;
  readonly variables: Record<string, string | number | boolean>;
  readonly attachments?: readonly EmailAttachment[];
  readonly trackingEnabled: boolean;
  readonly unsubscribeUrl: string;
}

// Email Attachment Interface
export interface EmailAttachment {
  readonly filename: string;
  readonly contentType: string;
  readonly content: string; // Base64 encoded
  readonly size: number;
  readonly cid?: string; // For inline attachments
}

// Email Template Interface following DRY Principle
export interface EmailTemplate {
  readonly id: string;
  readonly name: string;
  readonly type: EmailType;
  readonly subject: string;
  readonly htmlTemplate: string;
  readonly textTemplate: string;
  readonly requiredVariables: readonly string[];
  readonly optionalVariables: readonly string[];
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly previewUrl?: string;
}

// Specific Email Data Types following Type Safety
export interface VerificationEmailData {
  readonly verificationCode: string;
  readonly verificationUrl: string;
  readonly expiresInHours: number;
}

export interface PasswordResetEmailData {
  readonly resetToken: string;
  readonly resetUrl: string;
  readonly expiresInHours: number;
  readonly requestedFromIp?: string;
  readonly requestedFromLocation?: string;
}

export interface WelcomeEmailData {
  readonly firstName: string;
  readonly profileCompletionUrl: string;
  readonly matchingTipsUrl: string;
  readonly communityGuidelinesUrl: string;
}

export interface MatchNotificationEmailData {
  readonly matchId: string;
  readonly partnerName: string;
  readonly partnerAge: number;
  readonly partnerPhotoUrl?: string;
  readonly compatibilityScore: number;
  readonly conversationUrl: string;
  readonly unsubscribeUrl: string;
}

export interface WeeklyDigestEmailData {
  readonly weekStartDate: Date;
  readonly weekEndDate: Date;
  readonly stats: {
    readonly newMatches: number;
    readonly newMessages: number;
    readonly profileViews: number;
    readonly likes: number;
  };
  readonly featuredMatches: readonly {
    readonly id: string;
    readonly name: string;
    readonly age: number;
    readonly photoUrl?: string;
    readonly compatibilityScore: number;
  }[];
  readonly recommendedActions: readonly string[];
  readonly unsubscribeUrl: string;
}

export interface SecurityAlertEmailData {
  readonly alertType: 'login_attempt' | 'password_change' | 'email_change' | 'suspicious_activity';
  readonly timestamp: Date;
  readonly location?: string;
  readonly deviceInfo?: string;
  readonly ipAddress: string;
  readonly actionRequired: boolean;
  readonly secureUrl: string;
}

export interface DateReminderEmailData {
  readonly dateId: string;
  readonly partnerName: string;
  readonly scheduledTime: Date;
  readonly location: string;
  readonly reminderType: 'upcoming' | 'today' | 'starting_soon';
  readonly confirmationUrl: string;
  readonly rescheduleUrl: string;
}

export interface EngagementSummaryEmailData {
  readonly period: 'weekly' | 'monthly';
  readonly startDate: Date;
  readonly endDate: Date;
  readonly achievements: readonly {
    readonly type: string;
    readonly description: string;
    readonly earnedAt: Date;
  }[];
  readonly suggestions: readonly string[];
  readonly personalizedTips: readonly string[];
  readonly unsubscribeUrl: string;
}

// Typed Email Interfaces following Type Safety
export interface VerificationEmail extends BaseEmail {
  readonly type: 'verification';
  readonly content: EmailContent;
  readonly data: VerificationEmailData;
}

export interface PasswordResetEmail extends BaseEmail {
  readonly type: 'password_reset';
  readonly content: EmailContent;
  readonly data: PasswordResetEmailData;
}

export interface WelcomeEmail extends BaseEmail {
  readonly type: 'welcome';
  readonly content: EmailContent;
  readonly data: WelcomeEmailData;
}

export interface MatchNotificationEmail extends BaseEmail {
  readonly type: 'match_notification';
  readonly content: EmailContent;
  readonly data: MatchNotificationEmailData;
}

export interface WeeklyDigestEmail extends BaseEmail {
  readonly type: 'weekly_digest';
  readonly content: EmailContent;
  readonly data: WeeklyDigestEmailData;
}

export interface SecurityAlertEmail extends BaseEmail {
  readonly type: 'security_alert';
  readonly content: EmailContent;
  readonly data: SecurityAlertEmailData;
}

export interface DateReminderEmail extends BaseEmail {
  readonly type: 'date_reminder';
  readonly content: EmailContent;
  readonly data: DateReminderEmailData;
}

export interface EngagementSummaryEmail extends BaseEmail {
  readonly type: 'engagement_summary';
  readonly content: EmailContent;
  readonly data: EngagementSummaryEmailData;
}

// Union Type for all Emails following DRY Principle
export type StellarEmail = 
  | VerificationEmail
  | PasswordResetEmail
  | WelcomeEmail
  | MatchNotificationEmail
  | WeeklyDigestEmail
  | SecurityAlertEmail
  | DateReminderEmail
  | EngagementSummaryEmail;

// Email Preferences following Security by Design and GDPR Compliance
export interface EmailPreferences {
  readonly userId: string;
  readonly emailAddress: string;
  readonly globalOptIn: boolean;
  readonly verifiedAt?: Date;
  readonly preferences: {
    readonly verification: {
      readonly enabled: boolean;
    };
    readonly password_reset: {
      readonly enabled: boolean;
    };
    readonly welcome: {
      readonly enabled: boolean;
    };
    readonly match_notification: {
      readonly enabled: boolean;
      readonly frequency: 'immediate' | 'daily' | 'weekly' | 'never';
      readonly batchingEnabled: boolean;
    };
    readonly weekly_digest: {
      readonly enabled: boolean;
      readonly dayOfWeek: number; // 0-6, Sunday = 0
      readonly timeOfDay: string; // HH:mm format
    };
    readonly security_alert: {
      readonly enabled: boolean;
      readonly criticalOnly: boolean;
    };
    readonly account_update: {
      readonly enabled: boolean;
    };
    readonly subscription_update: {
      readonly enabled: boolean;
    };
    readonly date_reminder: {
      readonly enabled: boolean;
      readonly advanceHours: number;
    };
    readonly engagement_summary: {
      readonly enabled: boolean;
      readonly frequency: 'weekly' | 'monthly' | 'never';
    };
    readonly promotional: {
      readonly enabled: boolean;
      readonly maxPerWeek: number;
    };
    readonly system_announcement: {
      readonly enabled: boolean;
      readonly importantOnly: boolean;
    };
  };
  readonly unsubscribeToken: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Email Queue Interface following Fail Fast Principle
export interface EmailQueue {
  readonly id: string;
  readonly userId: string;
  readonly emailType: EmailType;
  readonly priority: EmailPriority;
  readonly scheduledFor: Date;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  readonly emailData: Partial<StellarEmail>;
  readonly lastAttemptAt?: Date;
  readonly lastError?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Email Provider Configuration
export interface EmailProviderConfig {
  readonly provider: EmailProvider;
  readonly apiKey: string;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly replyToEmail?: string;
  readonly webhookUrl?: string;
  readonly webhookSecret?: string;
  readonly trackingDomain?: string;
  readonly customDomain?: string;
}

// Email Analytics following Privacy by Design
export interface EmailAnalytics {
  readonly emailId: string;
  readonly userId: string; // Hashed for privacy
  readonly emailType: EmailType;
  readonly event: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed';
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
  readonly userAgent?: string;
  readonly ipAddress?: string; // Anonymized
  readonly location?: string; // City/Country only
}

// Email Service Errors following Fail Fast Principle
export class EmailServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly emailId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

// Email Template Errors
export class EmailTemplateError extends Error {
  constructor(
    message: string,
    public readonly templateId: string,
    public readonly missingVariables?: readonly string[],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EmailTemplateError';
  }
}

// Email Validation Errors
export class EmailValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EmailValidationError';
  }
}

// Service Configuration following Security by Design
export interface EmailServiceConfig {
  readonly provider: EmailProviderConfig;
  readonly enableQueue: boolean;
  readonly queueProcessingInterval: number; // milliseconds
  readonly maxConcurrentEmails: number;
  readonly retryBackoffMs: number;
  readonly defaultFromEmail: string;
  readonly defaultFromName: string;
  readonly trackingEnabled: boolean;
  readonly analyticsEnabled: boolean;
  readonly enableUnsubscribe: boolean;
  readonly unsubscribeBaseUrl: string;
  readonly webhookSecret: string;
  readonly enableRateLimiting: boolean;
  readonly rateLimitPerMinute: number;
  readonly enableSpamFiltering: boolean;
  readonly enableContentValidation: boolean;
}

// Email Delivery Status
export interface EmailDelivery {
  readonly emailId: string;
  readonly userId: string;
  readonly status: EmailStatus;
  readonly providerMessageId?: string;
  readonly providerResponse?: Record<string, unknown>;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
  readonly openedAt?: Date;
  readonly clickedAt?: Date;
  readonly bouncedAt?: Date;
  readonly bounceReason?: string;
  readonly complainedAt?: Date;
  readonly unsubscribedAt?: Date;
  readonly failureReason?: string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly nextRetryAt?: Date;
}

// Email Batch for Performance
export interface EmailBatch {
  readonly batchId: string;
  readonly userId?: string;
  readonly emailType: EmailType;
  readonly emails: readonly string[]; // Email IDs
  readonly scheduledFor: Date;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  readonly totalEmails: number;
  readonly sentEmails: number;
  readonly failedEmails: number;
  readonly createdAt: Date;
  readonly completedAt?: Date;
}

// Unsubscribe Management
export interface UnsubscribeRequest {
  readonly token: string;
  readonly userId: string;
  readonly emailAddress: string;
  readonly emailTypes: readonly EmailType[];
  readonly requestedAt: Date;
  readonly processedAt?: Date;
  readonly source: 'link' | 'api' | 'manual';
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

// Email Compliance following GDPR and CAN-SPAM
export interface EmailCompliance {
  readonly hasValidUnsubscribe: boolean;
  readonly hasPhysicalAddress: boolean;
  readonly hasPrivacyPolicy: boolean;
  readonly isTransactional: boolean;
  readonly hasConsent: boolean;
  readonly consentTimestamp?: Date;
  readonly consentSource?: string;
  readonly dataRetentionDays: number;
  readonly isGDPRCompliant: boolean;
  readonly isCANSPAMCompliant: boolean;
}

// Email Template Variables Validator
export interface TemplateValidator {
  readonly requiredVariables: readonly string[];
  readonly optionalVariables: readonly string[];
  readonly validateVariables: (variables: Record<string, unknown>) => {
    readonly isValid: boolean;
    readonly missingRequired: readonly string[];
    readonly invalidTypes: readonly string[];
  };
}

// Email Service Metrics
export interface EmailServiceMetrics {
  readonly sent: number;
  readonly delivered: number;
  readonly opened: number;
  readonly clicked: number;
  readonly bounced: number;
  readonly complained: number;
  readonly unsubscribed: number;
  readonly deliveryRate: number;
  readonly openRate: number;
  readonly clickRate: number;
  readonly bounceRate: number;
  readonly complaintRate: number;
  readonly unsubscribeRate: number;
}