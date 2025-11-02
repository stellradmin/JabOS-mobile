// Authentication Type Definitions - STRICT TYPING, NO ANY TYPES
// Following all 10 Golden Code Principles

// ============= ACTIVITY PREFERENCES =============
// Single Responsibility: Each interface represents one clear domain

export interface ActivityPreference {
  id: string;
  category: ActivityCategory;
  preferences: ActivityOption[];
  priority: 'high' | 'medium' | 'low';
}

export type ActivityCategory = 
  | 'outdoor'
  | 'indoor'
  | 'cultural'
  | 'culinary'
  | 'entertainment'
  | 'wellness'
  | 'social'
  | 'creative';

export interface ActivityOption {
  id: string;
  name: string;
  description?: string;
  selected: boolean;
  frequency: 'always' | 'sometimes' | 'never';
}

// ============= QUESTIONNAIRE TYPES =============
// Meaningful Names: Clear, self-documenting type names

export interface QuestionnaireResponse {
  questionId: string;
  question: string;
  answer: string | string[] | number | boolean;
  answeredAt: Date;
  category: QuestionCategory;
  metadata?: QuestionMetadata;
}

export type QuestionCategory = 
  | 'personality'
  | 'lifestyle'
  | 'values'
  | 'relationship'
  | 'interests'
  | 'communication'
  | 'goals'
  | 'dealbreakers';

export interface QuestionMetadata {
  importance: 'critical' | 'important' | 'nice_to_have';
  isPrivate: boolean;
  tags?: string[];
}

export interface QuestionnaireData {
  responses: QuestionnaireResponse[];
  completedAt: Date;
  version: string;
  completionPercentage: number;
  skippedQuestions: string[];
}

// ============= NATAL CHART TYPES =============
// Separation of Concerns: Astrology data separate from other profile data

export interface NatalChartData {
  birthDate: Date;
  birthTime: string; // HH:mm format
  birthLocation: BirthLocation;
  chartData: AstrologicalChart;
  interpretation?: ChartInterpretation;
}

export interface BirthLocation {
  city: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface AstrologicalChart {
  sunSign: ZodiacSign;
  moonSign: ZodiacSign;
  risingSign: ZodiacSign;
  planets: PlanetPosition[];
  houses: HouseData[];
  aspects: AspectData[];
}

export type ZodiacSign = 
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export interface PlanetPosition {
  planet: string;
  sign: ZodiacSign;
  degree: number;
  house: number;
  retrograde: boolean;
}

export interface HouseData {
  number: number;
  sign: ZodiacSign;
  degree: number;
  planets: string[];
}

export interface AspectData {
  planet1: string;
  planet2: string;
  aspect: AspectType;
  degree: number;
  orb: number;
}

export type AspectType = 
  | 'conjunction'
  | 'opposition'
  | 'trine'
  | 'square'
  | 'sextile'
  | 'quincunx';

export interface ChartInterpretation {
  personality: string;
  strengths: string[];
  challenges: string[];
  compatibility: CompatibilityInsight[];
}

export interface CompatibilityInsight {
  withSign: ZodiacSign;
  score: number;
  description: string;
}

// ============= ERROR CONTEXT TYPES =============
// Fail Fast: Comprehensive error typing for auth operations

export interface AuthErrorContext {
  res?: {
    text?: string;
    status?: number;
    statusText?: string;
  };
  body?: unknown;
  details?: string;
  step?: string;
}

export interface AuthError extends Error {
  context?: AuthErrorContext;
  code?: string;
  statusCode?: number;
}

// ============= DELETION LOG TYPES =============
// Security by Design: Track account deletion properly

export interface DeletionLog {
  userId: string;
  deletedAt: Date;
  datasetsDeleted: string[];
  filesDeleted: number;
  success: boolean;
  errors?: string[];
}

export interface DeleteAccountResponse {
  success: boolean;
  deletionLog?: DeletionLog;
  error?: string;
  details?: string;
  step?: string;
}

// ============= TYPE GUARDS =============
// Defensive Programming: Runtime type validation

export function isQuestionnaireData(obj: unknown): obj is QuestionnaireData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'responses' in obj &&
    Array.isArray((obj as QuestionnaireData).responses) &&
    'completedAt' in obj &&
    'version' in obj
  );
}

export function isNatalChartData(obj: unknown): obj is NatalChartData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'birthDate' in obj &&
    'birthTime' in obj &&
    'birthLocation' in obj &&
    'chartData' in obj
  );
}

export function isActivityPreference(obj: unknown): obj is ActivityPreference {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'category' in obj &&
    'preferences' in obj &&
    Array.isArray((obj as ActivityPreference).preferences)
  );
}

export function isAuthError(error: unknown): error is AuthError {
  return (
    error instanceof Error &&
    'context' in error
  );
}

// ============= PROFILE UPDATE TYPES =============
// Command Query Separation: Separate types for updates vs queries

export interface ProfileUpdateData {
  username?: string;
  display_name?: string;
  avatar_url?: string;
  age?: number;
  gender?: string;
  education_level?: string;
  politics?: string;
  is_single?: boolean;
  has_kids?: boolean;
  wants_kids?: string;
  traits?: string[];
  interests?: string[];
  activity_preferences?: ActivityPreference[];
  zodiac_sign?: ZodiacSign;
  website?: string;
}

export interface UserDataUpdateData {
  birth_date?: string;
  birth_location?: string;
  birth_time?: string;
  questionnaire_responses?: QuestionnaireData;
  natal_chart_data?: NatalChartData;
}