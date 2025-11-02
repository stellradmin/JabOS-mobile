/**
 * CRITICAL SECURITY COMPONENT - Input Validation & XSS Prevention
 * 
 * Purpose: Comprehensive input validation and sanitization for all user inputs
 * Security Level: MAXIMUM - Zero tolerance for injection attacks
 * Features: XSS prevention, SQL injection prevention, input sanitization
 * 
 * SECURITY REQUIREMENTS:
 * - ALL user inputs MUST pass through these validators
 * - NO raw user input should ever reach the database or be rendered
 * - Automatic threat detection and blocking
 * - Real-time security monitoring integration
 */

import DOMPurify from 'isomorphic-dompurify';
import { trackSecurityIncident } from '../services/enhanced-monitoring-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

// Security configuration
const SECURITY_CONFIG = {
  // Maximum input lengths
  MAX_USERNAME_LENGTH: 30,
  MAX_EMAIL_LENGTH: 254,
  MAX_PASSWORD_LENGTH: 128,
  MAX_BIO_LENGTH: 500,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_GENERIC_TEXT_LENGTH: 5000,
  
  // Regex patterns for validation
  PATTERNS: {
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    USERNAME: /^[a-zA-Z0-9_-]{3,30}$/,
    PHONE: /^\+?[1-9]\d{1,14}$/,
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
    NUMERIC: /^\d+$/,
    DATE: /^\d{4}-\d{2}-\d{2}$/,
    TIME: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  },
  
  // Blocked patterns (potential attacks)
  BLOCKED_PATTERNS: [
    // SQL Injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi,
    /(--|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+|\bAND\b\s*\d+\s*=\s*\d+)/gi,
    
    // XSS patterns
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi,
    
    // Command injection patterns
    /[;&|`$]/g,
    /\.\.\//g,
    
    // LDAP injection patterns
    /[()&|*]/g,
  ],
  
  // Allowed HTML tags for rich text (if needed)
  ALLOWED_HTML_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p'],
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_VALIDATION_ATTEMPTS: 100,
};

// Track validation attempts for rate limiting
const validationAttempts = new Map<string, { count: number; timestamp: number }>();

/**
 * Core validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: string[];
  securityThreats: string[];
}

/**
 * Input validation options
 */
interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean;
  allowHtml?: boolean;
  type?: 'email' | 'username' | 'password' | 'phone' | 'url' | 'text' | 'number' | 'date';
}

class SecurityValidator {
  private static instance: SecurityValidator;
  private threatDetectionEnabled: boolean = true;
  private validationStats = {
    totalValidations: 0,
    blockedThreats: 0,
    xssAttemptsBlocked: 0,
    sqlInjectionAttemptsBlocked: 0,
  };

  private constructor() {
    this.initializeValidator();
  }

  public static getInstance(): SecurityValidator {
    if (!SecurityValidator.instance) {
      SecurityValidator.instance = new SecurityValidator();
    }
    return SecurityValidator.instance;
  }

  private initializeValidator(): void {
    logDebug('✅ Security Validator initialized with maximum protection', "Debug");
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const attempts = validationAttempts.get(identifier);
    
    if (!attempts) {
      validationAttempts.set(identifier, { count: 1, timestamp: now });
      return true;
    }
    
    if (now - attempts.timestamp > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      validationAttempts.set(identifier, { count: 1, timestamp: now });
      return true;
    }
    
    if (attempts.count >= SECURITY_CONFIG.MAX_VALIDATION_ATTEMPTS) {
      this.reportSecurityThreat('rate_limit_exceeded', { identifier });
      return false;
    }
    
    attempts.count++;
    return true;
  }

  /**
   * Detect potential security threats in input
   */
  private detectThreats(input: string): string[] {
    const threats: string[] = [];
    
    for (const pattern of SECURITY_CONFIG.BLOCKED_PATTERNS) {
      if (pattern.test(input)) {
        const threatType = this.identifyThreatType(pattern);
        threats.push(threatType);
        
        // Update stats
        if (threatType.includes('XSS')) {
          this.validationStats.xssAttemptsBlocked++;
        } else if (threatType.includes('SQL')) {
          this.validationStats.sqlInjectionAttemptsBlocked++;
        }
      }
    }
    
    return threats;
  }

  /**
   * Identify threat type from pattern
   */
  private identifyThreatType(pattern: RegExp): string {
    const patternStr = pattern.toString();
    
    if (patternStr.includes('SELECT') || patternStr.includes('INSERT')) {
      return 'SQL_INJECTION_ATTEMPT';
    }
    if (patternStr.includes('script') || patternStr.includes('javascript')) {
      return 'XSS_ATTEMPT';
    }
    if (patternStr.includes('..\/')) {
      return 'PATH_TRAVERSAL_ATTEMPT';
    }
    if (patternStr.includes(';&|')) {
      return 'COMMAND_INJECTION_ATTEMPT';
    }
    
    return 'UNKNOWN_THREAT';
  }

  /**
   * Report security threat
   */
  private reportSecurityThreat(
    threatType: string,
    details: any
  ): void {
    this.validationStats.blockedThreats++;
    
    // Log to monitoring service
    trackSecurityIncident(
      threatType,
      'critical',
      {
        ...details,
        timestamp: new Date().toISOString(),
        validationStats: this.validationStats,
      }
    );
    
    logError(`🚨 SECURITY THREAT DETECTED: ${threatType}`, "Error", details);
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeHtml(input: string, allowedTags?: string[]): string {
    const config = {
      ALLOWED_TAGS: allowedTags || SECURITY_CONFIG.ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
    };
    
    return DOMPurify.sanitize(input, config);
  }

  /**
   * Main validation method
   */
  public validate(
    value: any,
    options: ValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const securityThreats: string[] = [];
    let sanitizedValue = value;
    
    this.validationStats.totalValidations++;
    
    // Check rate limiting
    if (!this.checkRateLimit('global')) {
      return {
        isValid: false,
        errors: ['Rate limit exceeded. Please try again later.'],
        securityThreats: ['RATE_LIMIT_EXCEEDED'],
      };
    }
    
    // Null/undefined check
    if (value === null || value === undefined) {
      if (options.required) {
        errors.push('This field is required');
      }
      return { isValid: !options.required, sanitizedValue: '', errors, securityThreats };
    }
    
    // Convert to string for validation
    const stringValue = String(value);
    
    // Length validation
    if (options.minLength && stringValue.length < options.minLength) {
      errors.push(`Minimum length is ${options.minLength} characters`);
    }
    
    const maxLength = options.maxLength || SECURITY_CONFIG.MAX_GENERIC_TEXT_LENGTH;
    if (stringValue.length > maxLength) {
      errors.push(`Maximum length is ${maxLength} characters`);
      sanitizedValue = stringValue.substring(0, maxLength);
    }
    
    // Threat detection
    if (this.threatDetectionEnabled) {
      const threats = this.detectThreats(stringValue);
      if (threats.length > 0) {
        securityThreats.push(...threats);
        this.reportSecurityThreat('validation_threat_detected', {
          threats,
          input: stringValue.substring(0, 100), // Log only first 100 chars
        });
      }
    }
    
    // Type-specific validation
    if (options.type) {
      const typeValidation = this.validateType(stringValue, options.type);
      if (!typeValidation.isValid) {
        errors.push(...typeValidation.errors);
      }
      sanitizedValue = typeValidation.sanitizedValue || sanitizedValue;
    }
    
    // Pattern validation
    if (options.pattern && !options.pattern.test(stringValue)) {
      errors.push('Invalid format');
    }
    
    // Custom validation
    if (options.customValidator && !options.customValidator(sanitizedValue)) {
      errors.push('Validation failed');
    }
    
    // HTML sanitization
    if (options.allowHtml) {
      sanitizedValue = this.sanitizeHtml(sanitizedValue);
    } else {
      // Strip all HTML
      sanitizedValue = this.stripHtml(sanitizedValue);
    }
    
    // Final sanitization - escape special characters
    sanitizedValue = this.escapeSpecialChars(sanitizedValue);
    
    return {
      isValid: errors.length === 0 && securityThreats.length === 0,
      sanitizedValue,
      errors,
      securityThreats,
    };
  }

  /**
   * Type-specific validation
   */
  private validateType(
    value: string,
    type: string
  ): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;
    
    switch (type) {
      case 'email':
        if (!SECURITY_CONFIG.PATTERNS.EMAIL.test(value)) {
          errors.push('Invalid email address');
        }
        sanitizedValue = value.toLowerCase().trim();
        break;
        
      case 'username':
        if (!SECURITY_CONFIG.PATTERNS.USERNAME.test(value)) {
          errors.push('Username must be 3-30 characters, alphanumeric with _ or -');
        }
        sanitizedValue = value.trim();
        break;
        
      case 'password':
        if (value.length < 8) {
          errors.push('Password must be at least 8 characters');
        }
        if (!/[A-Z]/.test(value)) {
          errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(value)) {
          errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(value)) {
          errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*]/.test(value)) {
          errors.push('Password must contain at least one special character');
        }
        break;
        
      case 'phone':
        if (!SECURITY_CONFIG.PATTERNS.PHONE.test(value)) {
          errors.push('Invalid phone number');
        }
        sanitizedValue = value.replace(/[^\d+]/g, '');
        break;
        
      case 'url':
        if (!SECURITY_CONFIG.PATTERNS.URL.test(value)) {
          errors.push('Invalid URL');
        }
        break;
        
      case 'number':
        if (!SECURITY_CONFIG.PATTERNS.NUMERIC.test(value)) {
          errors.push('Must be a number');
        }
        break;
        
      case 'date':
        if (!SECURITY_CONFIG.PATTERNS.DATE.test(value)) {
          errors.push('Invalid date format (YYYY-MM-DD)');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      sanitizedValue,
      errors,
      securityThreats: [],
    };
  }

  /**
   * Strip HTML tags from input
   */
  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Escape special characters
   */
  private escapeSpecialChars(input: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    
    return input.replace(/[&<>"'\/]/g, (char) => map[char] || char);
  }

  /**
   * Validate form data
   */
  public validateForm(
    formData: Record<string, any>,
    schema: Record<string, ValidationOptions>
  ): {
    isValid: boolean;
    sanitizedData: Record<string, any>;
    errors: Record<string, string[]>;
    hasSecurityThreats: boolean;
  } {
    const sanitizedData: Record<string, any> = {};
    const errors: Record<string, string[]> = {};
    let hasSecurityThreats = false;
    
    for (const [field, options] of Object.entries(schema)) {
      const result = this.validate(formData[field], options);
      
      if (!result.isValid) {
        errors[field] = result.errors;
      }
      
      if (result.securityThreats.length > 0) {
        hasSecurityThreats = true;
        errors[field] = [...(errors[field] || []), ...result.securityThreats];
      }
      
      sanitizedData[field] = result.sanitizedValue;
    }
    
    return {
      isValid: Object.keys(errors).length === 0 && !hasSecurityThreats,
      sanitizedData,
      errors,
      hasSecurityThreats,
    };
  }

  /**
   * Validate and sanitize user message
   */
  public validateMessage(message: string): ValidationResult {
    return this.validate(message, {
      required: true,
      maxLength: SECURITY_CONFIG.MAX_MESSAGE_LENGTH,
      type: 'text',
      allowHtml: false,
    });
  }

  /**
   * Validate and sanitize user bio
   */
  public validateBio(bio: string): ValidationResult {
    return this.validate(bio, {
      maxLength: SECURITY_CONFIG.MAX_BIO_LENGTH,
      type: 'text',
      allowHtml: false,
    });
  }

  /**
   * Validate login credentials
   */
  public validateLoginCredentials(
    email: string,
    password: string
  ): {
    isValid: boolean;
    sanitizedEmail: string;
    errors: string[];
  } {
    const emailValidation = this.validate(email, {
      required: true,
      type: 'email',
    });
    
    const passwordValidation = this.validate(password, {
      required: true,
      minLength: 1, // Don't validate password format on login
      maxLength: SECURITY_CONFIG.MAX_PASSWORD_LENGTH,
    });
    
    const errors = [
      ...emailValidation.errors,
      ...passwordValidation.errors,
    ];
    
    return {
      isValid: emailValidation.isValid && passwordValidation.isValid,
      sanitizedEmail: emailValidation.sanitizedValue as string,
      errors,
    };
  }

  /**
   * Get validation statistics
   */
  public getStatistics(): typeof this.validationStats {
    return { ...this.validationStats };
  }

  /**
   * Reset validation statistics
   */
  public resetStatistics(): void {
    this.validationStats = {
      totalValidations: 0,
      blockedThreats: 0,
      xssAttemptsBlocked: 0,
      sqlInjectionAttemptsBlocked: 0,
    };
  }

  /**
   * Enable/disable threat detection
   */
  public setThreatDetection(enabled: boolean): void {
    this.threatDetectionEnabled = enabled;
  }
}

// Export singleton instance
export const securityValidator = SecurityValidator.getInstance();

// Export convenience functions
export const validateInput = (value: any, options?: ValidationOptions) =>
  securityValidator.validate(value, options);

export const validateForm = (
  formData: Record<string, any>,
  schema: Record<string, ValidationOptions>
) => securityValidator.validateForm(formData, schema);

export const validateMessage = (message: string) =>
  securityValidator.validateMessage(message);

export const validateBio = (bio: string) =>
  securityValidator.validateBio(bio);

export const validateLoginCredentials = (email: string, password: string) =>
  securityValidator.validateLoginCredentials(email, password);

export const getValidationStats = () =>
  securityValidator.getStatistics();

export default securityValidator;
