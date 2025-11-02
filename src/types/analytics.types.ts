// Analytics Type Definitions - STRICT TYPING, NO ANY TYPES
// Following all 10 Golden Code Principles

// ============= EVENT PROPERTY TYPES =============
// Single Responsibility: Each type represents one analytics concept

export type EventPropertyValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | null 
  | undefined
  | EventPropertyValue[]
  | { [key: string]: EventPropertyValue };

export interface EventProperties {
  [key: string]: EventPropertyValue;
}

// ============= ANONYMIZATION TYPES =============
// Meaningful Names: Clear types for anonymization

export type AnonymizationFunction = (value: EventPropertyValue) => string;

export interface AnonymizedData {
  [key: string]: string | AnonymizedData;
}

// ============= COHORT CRITERIA TYPES =============
// Separation of Concerns: Cohort logic separate from events

export interface CohortCriteria {
  ageRange?: { min: number; max: number };
  engagementLevel?: 'low' | 'medium' | 'high' | 'very_high';
  registrationPeriod?: { start: Date; end: Date };
  activityScore?: { min: number; max: number };
  features?: string[];
  segments?: string[];
  customRules?: CohortRule[];
}

export interface CohortRule {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: EventPropertyValue | EventPropertyValue[];
}

// ============= USER SEGMENT DATA TYPES =============
// Defensive Programming: Strong typing for user data

export interface UserSegmentData {
  segmentId: string;
  segmentName: string;
  joinedAt: Date;
  attributes: SegmentAttributes;
  behaviors: SegmentBehaviors;
}

export interface SegmentAttributes {
  activityLevel: 'inactive' | 'low' | 'moderate' | 'high' | 'power_user';
  lifecycleStage: 'new' | 'onboarding' | 'active' | 'at_risk' | 'churned' | 'reactivated';
  valueSegment: 'free' | 'trial' | 'basic' | 'premium' | 'enterprise';
  engagementScore: number;
}

export interface SegmentBehaviors {
  lastActiveAt: Date;
  totalSessions: number;
  averageSessionDuration: number;
  featureUsage: Record<string, number>;
  conversionEvents: string[];
}

// ============= PERFORMANCE METRICS TYPES =============
// Small, Focused: Each metric type is specific

export interface PerformanceMetrics {
  apiLatency: LatencyMetrics;
  pageLoadTimes: PageLoadMetrics;
  errorRates: ErrorRateMetrics;
  resourceUsage: ResourceMetrics;
  userFlowMetrics: UserFlowMetrics;
}

export interface LatencyMetrics {
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  average: number;
  sampleSize: number;
}

export interface PageLoadMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
}

export interface ErrorRateMetrics {
  total: number;
  byCategory: Record<string, number>;
  criticalErrors: number;
  warningCount: number;
  errorRate: number;
}

export interface ResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkBandwidth: number;
  storageUsed: number;
}

export interface UserFlowMetrics {
  completionRate: number;
  dropOffPoints: Record<string, number>;
  averageTimeToComplete: number;
  retryAttempts: number;
}

// ============= CONFIGURATION TYPES =============
// DRY Principle: Reusable configuration types

export interface SanitizedConfiguration {
  enableAnonymousTracking: boolean;
  enableCohortAnalysis: boolean;
  dataRetentionDays: number;
  anonymizationStrength: string;
  allowCrossDomainTracking: boolean;
  enableConsentManagement: boolean;
  requireExplicitConsent: boolean;
  timestamp: Date;
  version: string;
}

// ============= METADATA TYPES =============
// Command Query Separation: Metadata for commands vs queries

export interface EventMetadata {
  source?: string;
  version?: string;
  environment?: 'development' | 'staging' | 'production';
  sessionId?: string;
  correlationId?: string;
  timestamp?: Date;
  tags?: string[];
}

export interface ConsentMetadata {
  ipHash: string;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  consentMethod: 'explicit' | 'implicit' | 'imported';
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest';
}

// ============= PRIVACY DASHBOARD TYPES =============
// Least Surprise: Dashboard data structure is predictable

export interface PrivacyDashboard {
  consentStatus: ConsentStatus;
  dataCollection: DataCollectionSummary;
  anonymizationStatus: AnonymizationStatus;
  retentionPolicy: RetentionPolicySummary;
  userRights: UserRightsSummary;
  lastUpdated: Date;
}

export interface ConsentStatus {
  hasConsent: boolean;
  consentTypes: Record<string, boolean>;
  consentDate?: Date;
  expiryDate?: Date;
}

export interface DataCollectionSummary {
  eventsCollected: number;
  dataPointsAnonymized: number;
  categoriesTracked: string[];
  collectionPaused: boolean;
}

export interface AnonymizationStatus {
  isActive: boolean;
  level: string;
  methodsUsed: string[];
  lastProcessed: Date;
}

export interface RetentionPolicySummary {
  retentionDays: number;
  dataToBeDeleted: number;
  nextDeletionDate: Date;
  complianceStatus: 'compliant' | 'review_needed' | 'non_compliant';
}

export interface UserRightsSummary {
  canAccess: boolean;
  canDelete: boolean;
  canExport: boolean;
  canOptOut: boolean;
  pendingRequests: number;
}

// ============= TYPE GUARDS =============
// Security by Design: Runtime type validation

export function isEventPropertyValue(value: unknown): value is EventPropertyValue {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.every(isEventPropertyValue);
  if (typeof value === 'object') {
    return Object.values(value).every(isEventPropertyValue);
  }
  return false;
}

export function isCohortCriteria(obj: unknown): obj is CohortCriteria {
  return (
    typeof obj === 'object' &&
    obj !== null
  );
}

export function isUserSegmentData(obj: unknown): obj is UserSegmentData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'segmentId' in obj &&
    'segmentName' in obj &&
    'attributes' in obj &&
    'behaviors' in obj
  );
}