// Unified App Type Definitions - STRICT TYPING, NO ANY TYPES
// Following all 10 Golden Code Principles

import { SharedValue } from 'react-native-reanimated';

// ============= MESSAGING TYPES =============
// Single Responsibility: Each interface has one clear purpose

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  attachments?: MessageAttachment[];
  metadata?: MessageMetadata;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
}

export interface MessageMetadata {
  deliveredAt?: Date;
  readAt?: Date;
  editedAt?: Date;
  replyToMessageId?: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  isPinned: boolean;
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  matchScore?: number;
  matchDate?: Date;
  sharedInterests?: string[];
}

// ============= MATCHING TYPES =============
// Meaningful Names: Clear, self-documenting type names

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  displayName: string;
  age: number;
  bio: string;
  photos: UserPhoto[];
  location: UserLocation;
  interests: string[];
  preferences: MatchingPreferences;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  order: number;
  isMain: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  uploadedAt: Date;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

export interface MatchingPreferences {
  ageRange: {
    min: number;
    max: number;
  };
  maxDistance: number; // in kilometers
  interests: string[];
  dealBreakers: string[];
  relationshipGoals: RelationshipGoal[];
}

export type RelationshipGoal = 
  | 'casual_dating'
  | 'serious_relationship'
  | 'marriage'
  | 'friendship'
  | 'networking';

export interface VerificationStatus {
  emailVerified: boolean;
  phoneVerified: boolean;
  photoVerified: boolean;
  idVerified: boolean;
  verificationLevel: 'basic' | 'standard' | 'premium';
}

export interface PotentialMatch {
  id: string;
  user: UserProfile;
  compatibilityScore: number;
  matchReasons: string[];
  distance: number;
  lastActive: Date;
  hasLiked: boolean;
  hasSuperLiked: boolean;
  matchedAt?: Date;
}

export interface MatchingFilters {
  ageRange: {
    min: number;
    max: number;
  };
  distance: number;
  interests: string[];
  onlineNow: boolean;
  verifiedOnly: boolean;
  hasPhotos: boolean;
  relationshipGoals: RelationshipGoal[];
}

// ============= NOTIFICATION TYPES =============
// Separation of Concerns: Notification types separate from other domains

export interface NotificationPreferences {
  push: {
    enabled: boolean;
    matches: boolean;
    messages: boolean;
    likes: boolean;
    profileViews: boolean;
    promotions: boolean;
  };
  email: {
    enabled: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    matches: boolean;
    messages: boolean;
    newsletter: boolean;
  };
  sms: {
    enabled: boolean;
    criticalOnly: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;
    timezone: string;
  };
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export type NotificationType = 
  | 'match'
  | 'message'
  | 'like'
  | 'super_like'
  | 'profile_view'
  | 'promotion'
  | 'system'
  | 'security';

export interface NotificationData {
  userId?: string;
  conversationId?: string;
  matchId?: string;
  promotionId?: string;
  metadata?: Record<string, unknown>;
}

// ============= EMAIL TYPES =============
// Defensive Programming: Strong typing for email preferences

export interface EmailPreferences {
  userId: string;
  categories: {
    marketing: boolean;
    transactional: boolean;
    social: boolean;
    updates: boolean;
  };
  frequency: EmailFrequency;
  unsubscribeToken: string;
  lastUpdated: Date;
}

export type EmailFrequency = 
  | 'immediate'
  | 'daily_digest'
  | 'weekly_digest'
  | 'monthly_digest'
  | 'never';

export interface EmailQueueStatus {
  isProcessing: boolean;
  queueSize: number;
  processingCount: number;
  deadLetterQueueSize: number;
}

export interface EmailAnalytics {
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate?: number;
  bounceRate?: number;
  spamRate?: number;
}

// ============= ANIMATION TYPES =============
// Small, Focused: Animation types are minimal and specific

export interface AnimationSharedValue {
  key: string;
  value: SharedValue<number>;
  description?: string;
}

// ============= SUBSCRIPTION TYPES =============
// DRY Principle: Reusable subscription feature types

export type SubscriptionPlan = 
  | 'free'
  | 'basic'
  | 'premium'
  | 'elite';

export interface SubscriptionFeature {
  id: string;
  name: string;
  description: string;
  availableInPlans: SubscriptionPlan[];
}

export interface SubscriptionState {
  isActive: boolean;
  plan: SubscriptionPlan | null;
  features: string[];
  expiresAt?: Date;
  autoRenew?: boolean;
  paymentMethod?: PaymentMethod;
}

export interface PaymentMethod {
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

// ============= ERROR TYPES =============
// Fail Fast: Comprehensive error typing

export interface AppError {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, unknown>;
  timestamp: Date;
  stack?: string;
}

// ============= TYPE GUARDS =============
// Security by Design: Runtime type validation

export function isUserProfile(obj: unknown): obj is UserProfile {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    'firstName' in obj &&
    'age' in obj &&
    'photos' in obj &&
    Array.isArray((obj as UserProfile).photos)
  );
}

export function isConversation(obj: unknown): obj is Conversation {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'participantIds' in obj &&
    Array.isArray((obj as Conversation).participantIds) &&
    'unreadCount' in obj &&
    typeof (obj as Conversation).unreadCount === 'number'
  );
}

export function isPotentialMatch(obj: unknown): obj is PotentialMatch {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'user' in obj &&
    'compatibilityScore' in obj &&
    typeof (obj as PotentialMatch).compatibilityScore === 'number'
  );
}

export function isAppNotification(obj: unknown): obj is AppNotification {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'title' in obj &&
    'body' in obj &&
    'createdAt' in obj
  );
}

// ============= UTILITY TYPES =============
// Command Query Separation: Pure utility types

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: AppError | null;
};