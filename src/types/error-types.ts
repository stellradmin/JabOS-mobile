/**
 * Centralized Error Types and Categorization for Stellr Dating App
 * Provides comprehensive error handling across all application layers
 */

// Base error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories for systematic classification
export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'compatibility-calculation'
  | 'matching-system'
  | 'data-parsing'
  | 'animation'
  | 'user-interaction'
  | 'file-upload'
  | 'location-services'
  | 'performance'
  | 'external-service'
  | 'database'
  | 'rate-limiting'
  | 'unknown';

// Error recovery strategies
export type RecoveryStrategy = 
  | 'retry'
  | 'fallback'
  | 'refresh-auth'
  | 'navigate-back'
  | 'clear-state'
  | 'manual-intervention'
  | 'none';

// Base error interface for consistency
export interface StellerError {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  timestamp: string;
  context?: Record<string, any>;
  stack?: string;
  userMessage: string;
  technicalDetails?: Record<string, any>;
}

// Network-related errors
export interface NetworkError extends StellerError {
  category: 'network';
  networkDetails: {
    status?: number;
    statusText?: string;
    url?: string;
    timeout?: boolean;
    offline?: boolean;
  };
}

// Authentication errors
export interface AuthenticationError extends StellerError {
  category: 'authentication';
  authDetails: {
    tokenExpired?: boolean;
    refreshFailed?: boolean;
    sessionInvalid?: boolean;
    credentialsInvalid?: boolean;
  };
}

// Validation errors with field-specific details
export interface ValidationError extends StellerError {
  category: 'validation';
  validationDetails: {
    fields: Record<string, string[]>;
    formErrors?: string[];
    validationRules?: string[];
  };
}

// Compatibility calculation errors
export interface CompatibilityError extends StellerError {
  category: 'compatibility-calculation';
  compatibilityDetails: {
    user1Id?: string;
    user2Id?: string;
    calculationType?: string;
    missingData?: string[];
  };
}

// Matching system errors
export interface MatchingError extends StellerError {
  category: 'matching-system';
  matchingDetails: {
    matchRequestId?: string;
    targetUserId?: string;
    matchType?: string;
    eligibilityCheck?: boolean;
  };
}

// File upload errors
export interface FileUploadError extends StellerError {
  category: 'file-upload';
  uploadDetails: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    uploadStage?: 'validation' | 'upload' | 'processing';
  };
}

// Location services errors
export interface LocationError extends StellerError {
  category: 'location-services';
  locationDetails: {
    permissionDenied?: boolean;
    unavailable?: boolean;
    timeout?: boolean;
    accuracy?: number;
  };
}

// Union type for all specific error types
export type SpecificStellerError = 
  | NetworkError
  | AuthenticationError
  | ValidationError
  | CompatibilityError
  | MatchingError
  | FileUploadError
  | LocationError;

// Error state for components and contexts
export interface ErrorState {
  hasError: boolean;
  error: StellerError | null;
  errorHistory: StellerError[];
  retryCount: number;
  recoveryAttempts: number;
  lastRecoveryAction?: string;
  isRecovering: boolean;
}

// Error reporting interface
export interface ErrorReport {
  error: StellerError;
  userAgent: string;
  appVersion: string;
  userId?: string;
  sessionId?: string;
  breadcrumbs: string[];
  additionalContext?: Record<string, any>;
}

// Error configuration for different components
export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  enableFallback: boolean;
  fallbackData?: any;
  enableRecovery: boolean;
  autoRecover: boolean;
  logErrors: boolean;
  reportErrors: boolean;
  showUserNotification: boolean;
  customRecoveryActions?: Record<string, () => void>;
}

// Error handling options for different scenarios
export interface ErrorHandlingOptions {
  silent?: boolean;
  preventFallback?: boolean;
  customMessage?: string;
  onError?: (error: StellerError) => void;
  onRecovery?: () => void;
  metadata?: Record<string, any>;
}

// Predefined error codes with standardized messages
export const ERROR_CODES = {
  // Network errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_FAILED: 'NETWORK_FAILED',
  NETWORK_RATE_LIMITED: 'NETWORK_RATE_LIMITED',
  
  // Authentication errors
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_CREDENTIALS_INVALID: 'AUTH_CREDENTIALS_INVALID',
  AUTH_REFRESH_FAILED: 'AUTH_REFRESH_FAILED',
  
  // Authorization errors
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',
  AUTH_INSUFFICIENT_PRIVILEGES: 'AUTH_INSUFFICIENT_PRIVILEGES',
  
  // Validation errors
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_DUPLICATE_VALUE: 'VALIDATION_DUPLICATE_VALUE',
  
  // Compatibility errors
  COMPATIBILITY_CALCULATION_FAILED: 'COMPATIBILITY_CALCULATION_FAILED',
  COMPATIBILITY_MISSING_DATA: 'COMPATIBILITY_MISSING_DATA',
  COMPATIBILITY_INVALID_PROFILES: 'COMPATIBILITY_INVALID_PROFILES',
  
  // Matching errors
  MATCHING_NO_ELIGIBLE_USERS: 'MATCHING_NO_ELIGIBLE_USERS',
  MATCHING_REQUEST_FAILED: 'MATCHING_REQUEST_FAILED',
  MATCHING_ALREADY_EXISTS: 'MATCHING_ALREADY_EXISTS',
  MATCHING_CONFIRMATION_FAILED: 'MATCHING_CONFIRMATION_FAILED',
  
  // File upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE: 'FILE_INVALID_TYPE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED',
  
  // Location errors
  LOCATION_PERMISSION_DENIED: 'LOCATION_PERMISSION_DENIED',
  LOCATION_UNAVAILABLE: 'LOCATION_UNAVAILABLE',
  LOCATION_TIMEOUT: 'LOCATION_TIMEOUT',
  LOCATION_ACCURACY_LOW: 'LOCATION_ACCURACY_LOW',
  
  // Database errors
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  DATABASE_CONSTRAINT_VIOLATION: 'DATABASE_CONSTRAINT_VIOLATION',
  
  // External service errors
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_TIMEOUT: 'EXTERNAL_SERVICE_TIMEOUT',
  EXTERNAL_SERVICE_RATE_LIMITED: 'EXTERNAL_SERVICE_RATE_LIMITED',
  
  // Performance errors
  PERFORMANCE_MEMORY_LIMIT: 'PERFORMANCE_MEMORY_LIMIT',
  PERFORMANCE_TIMEOUT: 'PERFORMANCE_TIMEOUT',
  PERFORMANCE_RESOURCE_EXHAUSTED: 'PERFORMANCE_RESOURCE_EXHAUSTED',
  
  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR'
} as const;

// User-friendly messages for error codes
export const ERROR_MESSAGES: Record<keyof typeof ERROR_CODES, string> = {
  // Network errors
  NETWORK_OFFLINE: 'You appear to be offline. Please check your internet connection.',
  NETWORK_TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_FAILED: 'Network request failed. Please check your connection and try again.',
  NETWORK_RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  
  // Authentication errors
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_TOKEN_INVALID: 'Authentication failed. Please log in again.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_CREDENTIALS_INVALID: 'Invalid email or password. Please try again.',
  AUTH_REFRESH_FAILED: 'Unable to refresh session. Please log in again.',
  
  // Authorization errors
  AUTH_PERMISSION_DENIED: 'You don\'t have permission to perform this action.',
  AUTH_INSUFFICIENT_PRIVILEGES: 'Insufficient privileges for this operation.',
  
  // Validation errors
  VALIDATION_REQUIRED_FIELD: 'Please fill in all required fields.',
  VALIDATION_INVALID_FORMAT: 'Please check the format of your input.',
  VALIDATION_OUT_OF_RANGE: 'Value is outside the allowed range.',
  VALIDATION_DUPLICATE_VALUE: 'This value already exists.',
  
  // Compatibility errors
  COMPATIBILITY_CALCULATION_FAILED: 'Unable to calculate compatibility. Please try again.',
  COMPATIBILITY_MISSING_DATA: 'Insufficient profile data for compatibility calculation.',
  COMPATIBILITY_INVALID_PROFILES: 'Invalid profile data detected.',
  
  // Matching errors
  MATCHING_NO_ELIGIBLE_USERS: 'No potential matches found at this time.',
  MATCHING_REQUEST_FAILED: 'Unable to find matches. Please try again.',
  MATCHING_ALREADY_EXISTS: 'You\'ve already interacted with this user.',
  MATCHING_CONFIRMATION_FAILED: 'Unable to confirm match. Please try again.',
  
  // File upload errors
  FILE_TOO_LARGE: 'File is too large. Please choose a smaller file.',
  FILE_INVALID_TYPE: 'Invalid file type. Please choose a supported format.',
  FILE_UPLOAD_FAILED: 'File upload failed. Please try again.',
  FILE_PROCESSING_FAILED: 'File processing failed. Please try a different file.',
  
  // Location errors
  LOCATION_PERMISSION_DENIED: 'Location permission denied. Please enable location services.',
  LOCATION_UNAVAILABLE: 'Location services unavailable. Please try again later.',
  LOCATION_TIMEOUT: 'Location request timed out. Please try again.',
  LOCATION_ACCURACY_LOW: 'Location accuracy is too low. Please move to a better location.',
  
  // Database errors
  DATABASE_CONNECTION_FAILED: 'Database connection failed. Please try again.',
  DATABASE_QUERY_FAILED: 'Database operation failed. Please try again.',
  DATABASE_CONSTRAINT_VIOLATION: 'Data constraint violation. Please check your input.',
  
  // External service errors
  EXTERNAL_SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
  EXTERNAL_SERVICE_TIMEOUT: 'Service request timed out. Please try again.',
  EXTERNAL_SERVICE_RATE_LIMITED: 'Service rate limit exceeded. Please wait and try again.',
  
  // Performance errors
  PERFORMANCE_MEMORY_LIMIT: 'Memory limit exceeded. Please restart the app.',
  PERFORMANCE_TIMEOUT: 'Operation timed out. Please try again.',
  PERFORMANCE_RESOURCE_EXHAUSTED: 'System resources exhausted. Please try again later.',
  
  // Unknown errors
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please contact support if this persists.'
};

// Recovery strategies for each error code
export const ERROR_RECOVERY_STRATEGIES: Record<keyof typeof ERROR_CODES, RecoveryStrategy> = {
  // Network errors
  NETWORK_OFFLINE: 'retry',
  NETWORK_TIMEOUT: 'retry',
  NETWORK_FAILED: 'retry',
  NETWORK_RATE_LIMITED: 'retry',
  
  // Authentication errors
  AUTH_TOKEN_EXPIRED: 'refresh-auth',
  AUTH_TOKEN_INVALID: 'refresh-auth',
  AUTH_SESSION_EXPIRED: 'refresh-auth',
  AUTH_CREDENTIALS_INVALID: 'manual-intervention',
  AUTH_REFRESH_FAILED: 'manual-intervention',
  
  // Authorization errors
  AUTH_PERMISSION_DENIED: 'navigate-back',
  AUTH_INSUFFICIENT_PRIVILEGES: 'navigate-back',
  
  // Validation errors
  VALIDATION_REQUIRED_FIELD: 'manual-intervention',
  VALIDATION_INVALID_FORMAT: 'manual-intervention',
  VALIDATION_OUT_OF_RANGE: 'manual-intervention',
  VALIDATION_DUPLICATE_VALUE: 'manual-intervention',
  
  // Compatibility errors
  COMPATIBILITY_CALCULATION_FAILED: 'fallback',
  COMPATIBILITY_MISSING_DATA: 'fallback',
  COMPATIBILITY_INVALID_PROFILES: 'fallback',
  
  // Matching errors
  MATCHING_NO_ELIGIBLE_USERS: 'fallback',
  MATCHING_REQUEST_FAILED: 'retry',
  MATCHING_ALREADY_EXISTS: 'none',
  MATCHING_CONFIRMATION_FAILED: 'retry',
  
  // File upload errors
  FILE_TOO_LARGE: 'manual-intervention',
  FILE_INVALID_TYPE: 'manual-intervention',
  FILE_UPLOAD_FAILED: 'retry',
  FILE_PROCESSING_FAILED: 'retry',
  
  // Location errors
  LOCATION_PERMISSION_DENIED: 'manual-intervention',
  LOCATION_UNAVAILABLE: 'fallback',
  LOCATION_TIMEOUT: 'retry',
  LOCATION_ACCURACY_LOW: 'retry',
  
  // Database errors
  DATABASE_CONNECTION_FAILED: 'retry',
  DATABASE_QUERY_FAILED: 'retry',
  DATABASE_CONSTRAINT_VIOLATION: 'manual-intervention',
  
  // External service errors
  EXTERNAL_SERVICE_UNAVAILABLE: 'fallback',
  EXTERNAL_SERVICE_TIMEOUT: 'retry',
  EXTERNAL_SERVICE_RATE_LIMITED: 'retry',
  
  // Performance errors
  PERFORMANCE_MEMORY_LIMIT: 'clear-state',
  PERFORMANCE_TIMEOUT: 'retry',
  PERFORMANCE_RESOURCE_EXHAUSTED: 'fallback',
  
  // Unknown errors
  UNKNOWN_ERROR: 'retry',
  UNEXPECTED_ERROR: 'manual-intervention'
};

// Error severity mapping
export const ERROR_SEVERITIES: Record<keyof typeof ERROR_CODES, ErrorSeverity> = {
  // Network errors
  NETWORK_OFFLINE: 'medium',
  NETWORK_TIMEOUT: 'medium',
  NETWORK_FAILED: 'medium',
  NETWORK_RATE_LIMITED: 'low',
  
  // Authentication errors
  AUTH_TOKEN_EXPIRED: 'medium',
  AUTH_TOKEN_INVALID: 'high',
  AUTH_SESSION_EXPIRED: 'medium',
  AUTH_CREDENTIALS_INVALID: 'low',
  AUTH_REFRESH_FAILED: 'high',
  
  // Authorization errors
  AUTH_PERMISSION_DENIED: 'medium',
  AUTH_INSUFFICIENT_PRIVILEGES: 'medium',
  
  // Validation errors
  VALIDATION_REQUIRED_FIELD: 'low',
  VALIDATION_INVALID_FORMAT: 'low',
  VALIDATION_OUT_OF_RANGE: 'low',
  VALIDATION_DUPLICATE_VALUE: 'low',
  
  // Compatibility errors
  COMPATIBILITY_CALCULATION_FAILED: 'high',
  COMPATIBILITY_MISSING_DATA: 'medium',
  COMPATIBILITY_INVALID_PROFILES: 'medium',
  
  // Matching errors
  MATCHING_NO_ELIGIBLE_USERS: 'low',
  MATCHING_REQUEST_FAILED: 'high',
  MATCHING_ALREADY_EXISTS: 'low',
  MATCHING_CONFIRMATION_FAILED: 'high',
  
  // File upload errors
  FILE_TOO_LARGE: 'low',
  FILE_INVALID_TYPE: 'low',
  FILE_UPLOAD_FAILED: 'medium',
  FILE_PROCESSING_FAILED: 'medium',
  
  // Location errors
  LOCATION_PERMISSION_DENIED: 'medium',
  LOCATION_UNAVAILABLE: 'medium',
  LOCATION_TIMEOUT: 'medium',
  LOCATION_ACCURACY_LOW: 'low',
  
  // Database errors
  DATABASE_CONNECTION_FAILED: 'critical',
  DATABASE_QUERY_FAILED: 'high',
  DATABASE_CONSTRAINT_VIOLATION: 'medium',
  
  // External service errors
  EXTERNAL_SERVICE_UNAVAILABLE: 'medium',
  EXTERNAL_SERVICE_TIMEOUT: 'medium',
  EXTERNAL_SERVICE_RATE_LIMITED: 'low',
  
  // Performance errors
  PERFORMANCE_MEMORY_LIMIT: 'critical',
  PERFORMANCE_TIMEOUT: 'high',
  PERFORMANCE_RESOURCE_EXHAUSTED: 'high',
  
  // Unknown errors
  UNKNOWN_ERROR: 'medium',
  UNEXPECTED_ERROR: 'high'
};