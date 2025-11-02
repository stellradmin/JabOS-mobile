/**
 * Error Factory for creating standardized StellerError instances
 * Provides consistent error creation across the application
 */

import {
  StellerError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  CompatibilityError,
  MatchingError,
  FileUploadError,
  LocationError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  ERROR_CODES,
  ERROR_MESSAGES,
  ERROR_RECOVERY_STRATEGIES,
  ERROR_SEVERITIES
} from '../types/error-types';

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Base error factory
export function createStellerError(
  code: keyof typeof ERROR_CODES,
  customMessage?: string,
  context?: Record<string, any>,
  technicalDetails?: Record<string, any>
): StellerError {
  const errorCode = ERROR_CODES[code];
  const defaultMessage = ERROR_MESSAGES[code];
  const severity = ERROR_SEVERITIES[code];
  const recoveryStrategy = ERROR_RECOVERY_STRATEGIES[code];
  
  // Determine category from error code
  const category = determineErrorCategory(errorCode);
  
  return {
    id: generateErrorId(),
    code: errorCode,
    message: customMessage || defaultMessage,
    category,
    severity,
    recoveryStrategy,
    timestamp: new Date().toISOString(),
    context: context || {},
    userMessage: customMessage || defaultMessage,
    technicalDetails: technicalDetails || {}
  };
}

// Network error factory
export function createNetworkError(
  code: 'NETWORK_OFFLINE' | 'NETWORK_TIMEOUT' | 'NETWORK_FAILED' | 'NETWORK_RATE_LIMITED',
  networkDetails: {
    status?: number;
    statusText?: string;
    url?: string;
    timeout?: boolean;
    offline?: boolean;
  },
  customMessage?: string,
  context?: Record<string, any>
): NetworkError {
  const baseError = createStellerError(code, customMessage, context, { networkDetails });
  
  return {
    ...baseError,
    category: 'network',
    networkDetails
  };
}

// Authentication error factory
export function createAuthenticationError(
  code: 'AUTH_TOKEN_EXPIRED' | 'AUTH_TOKEN_INVALID' | 'AUTH_SESSION_EXPIRED' | 'AUTH_CREDENTIALS_INVALID' | 'AUTH_REFRESH_FAILED',
  authDetails: {
    tokenExpired?: boolean;
    refreshFailed?: boolean;
    sessionInvalid?: boolean;
    credentialsInvalid?: boolean;
  },
  customMessage?: string,
  context?: Record<string, any>
): AuthenticationError {
  const baseError = createStellerError(code, customMessage, context, { authDetails });
  
  return {
    ...baseError,
    category: 'authentication',
    authDetails
  };
}

// Validation error factory
export function createValidationError(
  code: 'VALIDATION_REQUIRED_FIELD' | 'VALIDATION_INVALID_FORMAT' | 'VALIDATION_OUT_OF_RANGE' | 'VALIDATION_DUPLICATE_VALUE',
  validationDetails: {
    fields: Record<string, string[]>;
    formErrors?: string[];
    validationRules?: string[];
  },
  customMessage?: string,
  context?: Record<string, any>
): ValidationError {
  const baseError = createStellerError(code, customMessage, context, { validationDetails });
  
  return {
    ...baseError,
    category: 'validation',
    validationDetails
  };
}

// Compatibility error factory
export function createCompatibilityError(
  code: 'COMPATIBILITY_CALCULATION_FAILED' | 'COMPATIBILITY_MISSING_DATA' | 'COMPATIBILITY_INVALID_PROFILES',
  compatibilityDetails: {
    user1Id?: string;
    user2Id?: string;
    calculationType?: string;
    missingData?: string[];
  },
  customMessage?: string,
  context?: Record<string, any>
): CompatibilityError {
  const baseError = createStellerError(code, customMessage, context, { compatibilityDetails });
  
  return {
    ...baseError,
    category: 'compatibility-calculation',
    compatibilityDetails
  };
}

// Matching error factory
export function createMatchingError(
  code: 'MATCHING_NO_ELIGIBLE_USERS' | 'MATCHING_REQUEST_FAILED' | 'MATCHING_ALREADY_EXISTS' | 'MATCHING_CONFIRMATION_FAILED',
  matchingDetails: {
    matchRequestId?: string;
    targetUserId?: string;
    matchType?: string;
    eligibilityCheck?: boolean;
  },
  customMessage?: string,
  context?: Record<string, any>
): MatchingError {
  const baseError = createStellerError(code, customMessage, context, { matchingDetails });
  
  return {
    ...baseError,
    category: 'matching-system',
    matchingDetails
  };
}

// File upload error factory
export function createFileUploadError(
  code: 'FILE_TOO_LARGE' | 'FILE_INVALID_TYPE' | 'FILE_UPLOAD_FAILED' | 'FILE_PROCESSING_FAILED',
  uploadDetails: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    uploadStage?: 'validation' | 'upload' | 'processing';
  },
  customMessage?: string,
  context?: Record<string, any>
): FileUploadError {
  const baseError = createStellerError(code, customMessage, context, { uploadDetails });
  
  return {
    ...baseError,
    category: 'file-upload',
    uploadDetails
  };
}

// Location error factory
export function createLocationError(
  code: 'LOCATION_PERMISSION_DENIED' | 'LOCATION_UNAVAILABLE' | 'LOCATION_TIMEOUT' | 'LOCATION_ACCURACY_LOW',
  locationDetails: {
    permissionDenied?: boolean;
    unavailable?: boolean;
    timeout?: boolean;
    accuracy?: number;
  },
  customMessage?: string,
  context?: Record<string, any>
): LocationError {
  const baseError = createStellerError(code, customMessage, context, { locationDetails });
  
  return {
    ...baseError,
    category: 'location-services',
    locationDetails
  };
}

// Convert generic JavaScript errors to StellerError
export function convertToStellerError(
  error: any,
  context?: Record<string, any>
): StellerError {
  if (error && typeof error === 'object' && 'id' in error && 'code' in error) {
    // Already a StellerError
    return error as StellerError;
  }
  
  let code: keyof typeof ERROR_CODES = 'UNKNOWN_ERROR';
  let customMessage = '';
  let technicalDetails: Record<string, any> = {};
  
  if (error instanceof Error) {
    customMessage = error.message;
    technicalDetails.stack = error.stack;
    technicalDetails.name = error.name;
    
    // Try to determine specific error type from message
    if (error.message.toLowerCase().includes('network')) {
      code = 'NETWORK_FAILED';
    } else if (error.message.toLowerCase().includes('timeout')) {
      code = 'NETWORK_TIMEOUT';
    } else if (error.message.toLowerCase().includes('auth')) {
      code = 'AUTH_TOKEN_INVALID';
    } else if (error.message.toLowerCase().includes('validation')) {
      code = 'VALIDATION_INVALID_FORMAT';
    } else if (error.message.toLowerCase().includes('permission')) {
      code = 'AUTH_PERMISSION_DENIED';
    }
  } else if (typeof error === 'string') {
    customMessage = error;
  } else if (error && typeof error === 'object') {
    // Handle API error responses
    if (error.status >= 400 && error.status < 500) {
      if (error.status === 401) {
        code = 'AUTH_TOKEN_INVALID';
      } else if (error.status === 403) {
        code = 'AUTH_PERMISSION_DENIED';
      } else if (error.status === 429) {
        code = 'NETWORK_RATE_LIMITED';
      } else {
        code = 'VALIDATION_INVALID_FORMAT';
      }
    } else if (error.status >= 500) {
      code = 'DATABASE_CONNECTION_FAILED';
    }
    
    customMessage = error.message || error.error || 'Unknown error occurred';
    technicalDetails = { ...error };
  }
  
  return createStellerError(code, customMessage, context, technicalDetails);
}

// Determine error category from error code
function determineErrorCategory(errorCode: string): ErrorCategory {
  if (errorCode.startsWith('NETWORK_')) return 'network';
  if (errorCode.startsWith('AUTH_')) return 'authentication';
  if (errorCode.startsWith('VALIDATION_')) return 'validation';
  if (errorCode.startsWith('COMPATIBILITY_')) return 'compatibility-calculation';
  if (errorCode.startsWith('MATCHING_')) return 'matching-system';
  if (errorCode.startsWith('FILE_')) return 'file-upload';
  if (errorCode.startsWith('LOCATION_')) return 'location-services';
  if (errorCode.startsWith('DATABASE_')) return 'database';
  if (errorCode.startsWith('EXTERNAL_')) return 'external-service';
  if (errorCode.startsWith('PERFORMANCE_')) return 'performance';
  
  return 'unknown';
}

// Create error from HTTP response
export function createErrorFromResponse(
  response: Response,
  context?: Record<string, any>
): Promise<StellerError> {
  return response.json().then(
    (data) => {
      const networkDetails = {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      };
      
      let code: keyof typeof ERROR_CODES;
      if (response.status === 401) {
        code = 'AUTH_TOKEN_INVALID';
      } else if (response.status === 403) {
        code = 'AUTH_PERMISSION_DENIED';
      } else if (response.status === 429) {
        code = 'NETWORK_RATE_LIMITED';
      } else if (response.status >= 500) {
        code = 'DATABASE_CONNECTION_FAILED';
      } else {
        code = 'NETWORK_FAILED';
      }
      
      return createNetworkError(
        code as any,
        networkDetails,
        data.message || data.error || `HTTP ${response.status} Error`,
        { ...context, responseData: data }
      );
    },
    () => {
      // Failed to parse JSON response
      return createNetworkError(
        'NETWORK_FAILED',
        {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        },
        `HTTP ${response.status} Error`,
        context
      );
    }
  );
}

// Create error with retry information
export function createRetryableError(
  baseError: StellerError,
  retryCount: number,
  maxRetries: number
): StellerError {
  return {
    ...baseError,
    context: {
      ...baseError.context,
      retryCount,
      maxRetries,
      retryable: retryCount < maxRetries
    }
  };
}

// Create error with fallback information
export function createFallbackError(
  baseError: StellerError,
  fallbackUsed: boolean,
  fallbackData?: any
): StellerError {
  return {
    ...baseError,
    context: {
      ...baseError.context,
      fallbackUsed,
      fallbackData: fallbackUsed ? fallbackData : undefined
    }
  };
}