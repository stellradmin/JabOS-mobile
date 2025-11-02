// Compatibility Matching Type Definitions - STRICT TYPING, NO ANY TYPES
// Following all 10 Golden Code Principles

// ============= MATCH INTERACTION TYPES =============
// Single Responsibility: Each type represents one interaction concept

export interface MatchMetadata {
  location?: GeographicLocation;
  source: MatchSource;
  algorithm_version: string;
  calculated_at: Date;
  score_breakdown: ScoreBreakdown;
  flags?: MatchFlag[];
}

export interface GeographicLocation {
  city?: string;
  state?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  distance?: number; // in kilometers
}

export type MatchSource = 
  | 'algorithm'
  | 'manual_curation'
  | 'user_preference'
  | 'social_graph'
  | 'compatibility_quiz';

export interface ScoreBreakdown {
  astrologicalFactors: number;
  personalityAlignment: number;
  preferenceMatch: number;
  interestOverlap: number;
  valueAlignment: number;
  communicationStyle: number;
}

export type MatchFlag = 
  | 'premium_match'
  | 'verified_profile'
  | 'high_compatibility'
  | 'mutual_interests'
  | 'geographic_proximity';

// ============= PROFILE DATA TYPES =============
// Meaningful Names: Clear profile structure

export interface BasicProfileData {
  id: string;
  display_name: string;
  age?: number;
  location?: GeographicLocation;
  photos: ProfilePhoto[];
  verification_status: VerificationStatus;
  last_active: Date;
  privacy_settings: PrivacySettings;
}

export interface ProfilePhoto {
  id: string;
  url: string;
  thumbnail_url?: string;
  order: number;
  is_primary: boolean;
  upload_date: Date;
  verification_status: 'pending' | 'verified' | 'rejected';
}

export interface VerificationStatus {
  email_verified: boolean;
  phone_verified: boolean;
  photo_verified: boolean;
  id_verified: boolean;
  badge_level: 'basic' | 'standard' | 'premium';
}

export interface PrivacySettings {
  show_age: boolean;
  show_location: boolean;
  show_last_active: boolean;
  allow_messaging: boolean;
  discoverable: boolean;
}

// ============= SCORE VALIDATION TYPES =============
// Defensive Programming: Strong validation types

export type ScoreValue = number;
export type ValidatedScore = {
  value: ScoreValue;
  isValid: boolean;
  source: 'calculated' | 'default' | 'fallback';
};

export interface ScoreValidationResult {
  overallScore: ValidatedScore;
  astrologicalScore: ValidatedScore;
  personalityScore: ValidatedScore;
  preferenceScore: ValidatedScore;
  isReliable: boolean;
  confidenceLevel: 'low' | 'medium' | 'high';
}

// ============= RECOMMENDATION FILTERS =============
// Separation of Concerns: Filter logic separate from matching

export interface MatchingFilters {
  ageRange?: {
    min: number;
    max: number;
  };
  location?: {
    maxDistance: number; // in kilometers
    preferredCities?: string[];
    excludeRegions?: string[];
  };
  compatibility?: {
    minimumScore: number;
    preferredTraits?: string[];
    dealBreakers?: string[];
  };
  verification?: {
    requirePhotoVerification: boolean;
    requireEmailVerification: boolean;
    minimumBadgeLevel?: 'basic' | 'standard' | 'premium';
  };
  activity?: {
    activeWithinDays: number;
    minimumActivityLevel?: 'low' | 'medium' | 'high';
  };
  preferences?: UserPreferences;
}

export interface UserPreferences {
  relationshipGoals: RelationshipGoal[];
  lifestyle: LifestylePreferences;
  communication: CommunicationPreferences;
  values: ValuePreferences;
}

export type RelationshipGoal = 
  | 'casual_dating'
  | 'serious_relationship'
  | 'marriage'
  | 'friendship'
  | 'networking';

export interface LifestylePreferences {
  smokingPreference: 'never' | 'socially' | 'regularly' | 'no_preference';
  drinkingPreference: 'never' | 'socially' | 'regularly' | 'no_preference';
  exerciseFrequency: 'never' | 'rarely' | 'regularly' | 'daily' | 'no_preference';
  petPreference: 'love_pets' | 'allergic' | 'no_pets' | 'no_preference';
}

export interface CommunicationPreferences {
  preferredStyle: 'text' | 'video' | 'in_person' | 'no_preference';
  responseFrequency: 'immediate' | 'same_day' | 'within_days' | 'no_preference';
  conflictResolution: 'direct' | 'diplomatic' | 'avoidant' | 'no_preference';
}

export interface ValuePreferences {
  politicalViews?: 'liberal' | 'moderate' | 'conservative' | 'no_preference';
  religiousViews?: 'very_important' | 'somewhat_important' | 'not_important' | 'no_preference';
  familyPlans?: 'want_children' | 'have_children' | 'no_children' | 'no_preference';
  careerPriority?: 'high' | 'medium' | 'low' | 'no_preference';
}

// ============= ERROR HANDLING TYPES =============
// Fail Fast: Comprehensive error types for compatibility service

export interface CompatibilityError extends Error {
  code: CompatibilityErrorCode;
  category: 'matching' | 'validation' | 'service' | 'data';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  context?: CompatibilityErrorContext;
}

export type CompatibilityErrorCode = 
  | 'PROFILE_NOT_FOUND'
  | 'INSUFFICIENT_DATA'
  | 'ALGORITHM_FAILURE'
  | 'VALIDATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'COMPATIBILITY_CALCULATION_FAILED';

export interface CompatibilityErrorContext {
  userId?: string;
  targetUserId?: string;
  operation: string;
  timestamp: Date;
  attemptCount?: number;
  lastKnownState?: Record<string, unknown>;
}

// ============= SERVICE RESPONSE TYPES =============
// DRY Principle: Reusable response structures

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: CompatibilityError;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  requestId: string;
  duration: number;
  source: 'cache' | 'database' | 'algorithm' | 'fallback';
  timestamp: Date;
  version: string;
}

// ============= TYPE GUARDS =============
// Security by Design: Runtime type validation

export function isBasicProfileData(obj: unknown): obj is BasicProfileData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'display_name' in obj &&
    'photos' in obj &&
    Array.isArray((obj as BasicProfileData).photos)
  );
}

export function isValidScore(value: unknown): value is ScoreValue {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    value >= 0 &&
    value <= 100
  );
}

export function isMatchingFilters(obj: unknown): obj is MatchingFilters {
  return (
    typeof obj === 'object' &&
    obj !== null
  );
}

// ============= UTILITY TYPES =============
// Command Query Separation: Clear distinction between commands and queries

export type MatchQuery = {
  userId: string;
  filters?: MatchingFilters;
  limit?: number;
  offset?: number;
};

export type MatchCommand = {
  action: 'like' | 'pass' | 'super_like' | 'block';
  userId: string;
  targetUserId: string;
  metadata?: MatchMetadata;
};
