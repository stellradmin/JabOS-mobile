/**
 * Validation Utilities
 * 
 * Single Responsibility: Input validation and sanitization
 * Following Fail Fast and Security by Design principles
 */

// UUID validation for user and entity IDs
export const validateUserId = (userId: string): boolean => {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
};

// Sanitize user input to prevent XSS
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags and special characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .trim();
};

// Validate email format
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate message content
export const validateMessage = (message: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required' };
  }
  
  const trimmed = message.trim();
  
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > 5000) {
    return { isValid: false, error: 'Message is too long (max 5000 characters)' };
  }
  
  return { isValid: true };
};

// Validate conversation ID
export const validateConversationId = (id: string): boolean => {
  return validateUserId(id); // Same format as UUID
};

// Validate deletion reason
export const validateDeletionReason = (reason: string): boolean => {
  const validReasons = [
    'user_unmatch',
    'user_block',
    'admin_action',
    'policy_violation',
    'account_deletion'
  ];
  
  return validReasons.includes(reason);
};

// Sanitize metadata object
export const sanitizeMetadata = (metadata: any): Record<string, any> => {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Only allow safe keys
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Sanitize values based on type
    if (typeof value === 'string') {
      sanitized[safeKey] = sanitizeInput(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[safeKey] = value;
    } else if (value === null) {
      sanitized[safeKey] = null;
    }
    // Skip objects and arrays for security
  }
  
  return sanitized;
};

// Validate pagination parameters
export const validatePagination = (page: number, limit: number): {
  isValid: boolean;
  error?: string;
  safePage?: number;
  safeLimit?: number;
} => {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
  
  if (safePage > 1000) {
    return { isValid: false, error: 'Page number too large' };
  }
  
  return {
    isValid: true,
    safePage,
    safeLimit
  };
};

// Validate date range
export const validateDateRange = (
  startDate: Date | string,
  endDate: Date | string
): {
  isValid: boolean;
  error?: string;
} => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  if (start > end) {
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (end.getTime() - start.getTime() > maxRange) {
    return { isValid: false, error: 'Date range too large (max 1 year)' };
  }
  
  return { isValid: true };
};

// Validate user permissions
export const validatePermission = (
  userRole: string,
  requiredRole: string | string[]
): boolean => {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(userRole);
};

// Export validation utilities as a namespace for organization
export const ValidationUtils = {
  validateUserId,
  sanitizeInput,
  validateEmail,
  validateMessage,
  validateConversationId,
  validateDeletionReason,
  sanitizeMetadata,
  validatePagination,
  validateDateRange,
  validatePermission
};

export default ValidationUtils;