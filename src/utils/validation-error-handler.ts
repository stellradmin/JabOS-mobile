/**
 * User Input Validation with Real-time Feedback System
 * Provides comprehensive form validation with immediate user feedback
 */

import {
  createValidationError,
  createStellerError,
  convertToStellerError
} from './error-factory';
import { StellerError, ValidationError } from '../types/error-types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

// Validation rule types
export type ValidationRule = 
  | 'required'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'phone'
  | 'date'
  | 'age'
  | 'name'
  | 'bio'
  | 'url'
  | 'number'
  | 'zipCode'
  | 'custom';

// Validation configuration for each rule
export interface ValidationConfig {
  rule: ValidationRule;
  message?: string;
  options?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean | string;
    compareField?: string; // For password confirmation
    allowEmpty?: boolean;
  };
}

// Field validation result
export interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Form validation result
export interface FormValidationResult {
  isValid: boolean;
  fields: Record<string, FieldValidationResult>;
  errors: string[];
  warnings: string[];
}

// Real-time validation state
export interface ValidationState {
  touched: Record<string, boolean>;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  isValidating: Record<string, boolean>;
  lastValidation: Record<string, number>;
}

// Pre-defined validation rules
const VALIDATION_RULES: Record<ValidationRule, ValidationConfig> = {
  required: {
    rule: 'required',
    message: 'This field is required',
    options: { allowEmpty: false }
  },
  email: {
    rule: 'email',
    message: 'Please enter a valid email address',
    options: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      maxLength: 254
    }
  },
  password: {
    rule: 'password',
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    options: {
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    }
  },
  confirmPassword: {
    rule: 'confirmPassword',
    message: 'Passwords do not match',
    options: { compareField: 'password' }
  },
  phone: {
    rule: 'phone',
    message: 'Please enter a valid phone number',
    options: {
      pattern: /^\+?[\d\s\-\(\)]+$/,
      minLength: 10,
      maxLength: 15
    }
  },
  date: {
    rule: 'date',
    message: 'Please enter a valid date',
    options: {}
  },
  age: {
    rule: 'age',
    message: 'Age must be between 18 and 100',
    options: { min: 18, max: 100 }
  },
  name: {
    rule: 'name',
    message: 'Name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes',
    options: {
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s\-']+$/
    }
  },
  bio: {
    rule: 'bio',
    message: 'Bio must be 10-500 characters',
    options: {
      minLength: 10,
      maxLength: 500
    }
  },
  url: {
    rule: 'url',
    message: 'Please enter a valid URL',
    options: {
      pattern: /^https?:\/\/.+\..+/
    }
  },
  number: {
    rule: 'number',
    message: 'Please enter a valid number',
    options: {}
  },
  zipCode: {
    rule: 'zipCode',
    message: 'Please enter a valid zip code',
    options: {
      pattern: /^\d{5}(-\d{4})?$/
    }
  },
  custom: {
    rule: 'custom',
    message: 'Invalid value',
    options: {}
  }
};

/**
 * Enhanced form validator with real-time feedback
 */
export class FormValidator {
  private validationState: ValidationState = {
    touched: {},
    errors: {},
    warnings: {},
    isValidating: {},
    lastValidation: {}
  };

  private fieldConfigs: Record<string, ValidationConfig[]> = {};
  private debounceTimers: Record<string, NodeJS.Timeout> = {};
  private asyncValidators: Record<string, (value: any) => Promise<FieldValidationResult>> = {};

  constructor(
    private onStateChange?: (state: ValidationState) => void,
    private debounceMs: number = 300
  ) {}

  /**
   * Configure validation rules for a field
   */
  configureField(
    fieldName: string,
    rules: (ValidationRule | ValidationConfig)[],
    asyncValidator?: (value: any) => Promise<FieldValidationResult>
  ): void {
    this.fieldConfigs[fieldName] = rules.map(rule => {
      if (typeof rule === 'string') {
        return { ...VALIDATION_RULES[rule] };
      }
      return rule;
    });

    if (asyncValidator) {
      this.asyncValidators[fieldName] = asyncValidator;
    }
  }

  /**
   * Validate a single field with real-time feedback
   */
  async validateField(
    fieldName: string,
    value: any,
    formData?: Record<string, any>,
    immediate: boolean = false
  ): Promise<FieldValidationResult> {
    // Mark field as touched
    this.validationState.touched[fieldName] = true;
    this.validationState.lastValidation[fieldName] = Date.now();

    // Clear existing debounce timer
    if (this.debounceTimers[fieldName]) {
      clearTimeout(this.debounceTimers[fieldName]);
    }

    // Set validating state
    this.validationState.isValidating[fieldName] = true;
    this.notifyStateChange();

    const performValidation = async (): Promise<FieldValidationResult> => {
      try {
        const rules = this.fieldConfigs[fieldName] || [];
        const result: FieldValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
          suggestions: []
        };

        // Run synchronous validations
        for (const rule of rules) {
          const fieldResult = await this.runValidationRule(rule, value, formData);
          if (!fieldResult.isValid) {
            result.isValid = false;
            result.errors.push(...fieldResult.errors);
          }
          result.warnings.push(...fieldResult.warnings);
          result.suggestions.push(...fieldResult.suggestions);
        }

        // Run async validation if configured
        if (this.asyncValidators[fieldName]) {
          try {
            const asyncResult = await this.asyncValidators[fieldName](value);
            if (!asyncResult.isValid) {
              result.isValid = false;
              result.errors.push(...asyncResult.errors);
            }
            result.warnings.push(...asyncResult.warnings);
            result.suggestions.push(...asyncResult.suggestions);
          } catch (error) {
            logError(`🚨 Async validation failed for ${fieldName}:`, "Error", error);
            result.warnings.push('Validation temporarily unavailable');
          }
        }

        // Update validation state
        this.validationState.errors[fieldName] = result.errors;
        this.validationState.warnings[fieldName] = result.warnings;
        this.validationState.isValidating[fieldName] = false;

        this.notifyStateChange();
        return result;

      } catch (error) {
        logError(`🚨 Validation error for ${fieldName}:`, "Error", error);
        this.validationState.isValidating[fieldName] = false;
        this.notifyStateChange();
        
        return {
          isValid: false,
          errors: ['Validation failed'],
          warnings: [],
          suggestions: []
        };
      }
    };

    if (immediate) {
      return await performValidation();
    } else {
      // Debounced validation for real-time feedback
      return new Promise((resolve) => {
        this.debounceTimers[fieldName] = setTimeout(async () => {
          const result = await performValidation();
          resolve(result);
        }, this.debounceMs);
      });
    }
  }

  /**
   * Run a specific validation rule
   */
  private async runValidationRule(
    config: ValidationConfig,
    value: any,
    formData?: Record<string, any>
  ): Promise<FieldValidationResult> {
    const { rule, message, options } = config;
    const result: FieldValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Handle empty values
    if (value === null || value === undefined || value === '') {
      if (rule === 'required' || !options?.allowEmpty) {
        result.isValid = false;
        result.errors.push(message || 'This field is required');
      }
      return result;
    }

    const stringValue = String(value).trim();

    switch (rule) {
      case 'required':
        if (!stringValue) {
          result.isValid = false;
          result.errors.push(message || 'This field is required');
        }
        break;

      case 'email':
        if (!options?.pattern?.test(stringValue)) {
          result.isValid = false;
          result.errors.push(message || 'Please enter a valid email address');
        } else if (stringValue.length > (options?.maxLength || 254)) {
          result.isValid = false;
          result.errors.push('Email address is too long');
        } else {
          // Email format suggestions
          if (stringValue.includes(' ')) {
            result.suggestions.push('Remove spaces from email address');
          }
          if (!stringValue.includes('.')) {
            result.suggestions.push('Email should contain a domain (e.g., .com)');
          }
        }
        break;

      case 'password':
        const issues = this.validatePasswordStrength(stringValue, options);
        if (issues.length > 0) {
          result.isValid = false;
          result.errors.push(...issues);
        } else {
          result.suggestions.push('Strong password! ✓');
        }
        break;

      case 'confirmPassword':
        const compareValue = formData?.[options?.compareField || 'password'];
        if (stringValue !== compareValue) {
          result.isValid = false;
          result.errors.push(message || 'Passwords do not match');
        }
        break;

      case 'phone':
        const phonePattern = options?.pattern || /^\+?[\d\s\-\(\)]+$/;
        const cleanPhone = stringValue.replace(/[\s\-\(\)]/g, '');
        
        if (!phonePattern.test(stringValue)) {
          result.isValid = false;
          result.errors.push(message || 'Please enter a valid phone number');
        } else if (cleanPhone.length < (options?.minLength || 10)) {
          result.isValid = false;
          result.errors.push('Phone number is too short');
        } else if (cleanPhone.length > (options?.maxLength || 15)) {
          result.isValid = false;
          result.errors.push('Phone number is too long');
        }
        break;

      case 'date':
        const dateValue = new Date(stringValue);
        if (isNaN(dateValue.getTime())) {
          result.isValid = false;
          result.errors.push(message || 'Please enter a valid date');
        }
        break;

      case 'age':
        const ageValue = parseInt(stringValue, 10);
        if (isNaN(ageValue)) {
          result.isValid = false;
          result.errors.push('Age must be a number');
        } else if (ageValue < (options?.min || 18)) {
          result.isValid = false;
          result.errors.push(`You must be at least ${options?.min || 18} years old`);
        } else if (ageValue > (options?.max || 100)) {
          result.isValid = false;
          result.errors.push(`Age cannot be more than ${options?.max || 100}`);
        }
        break;

      case 'name':
        if (stringValue.length < (options?.minLength || 2)) {
          result.isValid = false;
          result.errors.push(`Name must be at least ${options?.minLength || 2} characters`);
        } else if (stringValue.length > (options?.maxLength || 50)) {
          result.isValid = false;
          result.errors.push(`Name cannot be more than ${options?.maxLength || 50} characters`);
        } else if (options?.pattern && !options.pattern.test(stringValue)) {
          result.isValid = false;
          result.errors.push(message || 'Name contains invalid characters');
        }
        break;

      case 'bio':
        if (stringValue.length < (options?.minLength || 10)) {
          result.isValid = false;
          result.errors.push(`Bio must be at least ${options?.minLength || 10} characters`);
        } else if (stringValue.length > (options?.maxLength || 500)) {
          result.isValid = false;
          result.errors.push(`Bio cannot be more than ${options?.maxLength || 500} characters`);
        } else {
          // Bio suggestions
          const wordCount = stringValue.split(/\s+/).length;
          if (wordCount < 5) {
            result.suggestions.push('Consider adding more details to your bio');
          }
        }
        break;

      case 'url':
        if (options?.pattern && !options.pattern.test(stringValue)) {
          result.isValid = false;
          result.errors.push(message || 'Please enter a valid URL');
        }
        break;

      case 'number':
        const numValue = parseFloat(stringValue);
        if (isNaN(numValue)) {
          result.isValid = false;
          result.errors.push(message || 'Please enter a valid number');
        } else if (options?.min !== undefined && numValue < options.min) {
          result.isValid = false;
          result.errors.push(`Value must be at least ${options.min}`);
        } else if (options?.max !== undefined && numValue > options.max) {
          result.isValid = false;
          result.errors.push(`Value cannot be more than ${options.max}`);
        }
        break;

      case 'zipCode':
        if (options?.pattern && !options.pattern.test(stringValue)) {
          result.isValid = false;
          result.errors.push(message || 'Please enter a valid zip code');
        }
        break;

      case 'custom':
        if (options?.customValidator) {
          const customResult = options.customValidator(value);
          if (typeof customResult === 'string') {
            result.isValid = false;
            result.errors.push(customResult);
          } else if (!customResult) {
            result.isValid = false;
            result.errors.push(message || 'Invalid value');
          }
        }
        break;
    }

    return result;
  }

  /**
   * Validate password strength with detailed feedback
   */
  private validatePasswordStrength(
    password: string,
    options?: ValidationConfig['options']
  ): string[] {
    const issues: string[] = [];
    
    if (password.length < (options?.minLength || 8)) {
      issues.push(`Password must be at least ${options?.minLength || 8} characters`);
    }
    
    if (password.length > (options?.maxLength || 128)) {
      issues.push(`Password cannot be more than ${options?.maxLength || 128} characters`);
    }
    
    if (!/[a-z]/.test(password)) {
      issues.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      issues.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      issues.push('Password must contain at least one number');
    }
    
    if (!/[@$!%*?&]/.test(password)) {
      issues.push('Password must contain at least one special character (@$!%*?&)');
    }
    
    // Check for common weak patterns
    if (/(.)\1{2,}/.test(password)) {
      issues.push('Password should not contain repeated characters');
    }
    
    if (/^(123|abc|qwe)/i.test(password)) {
      issues.push('Password should not start with common sequences');
    }
    
    return issues;
  }

  /**
   * Validate entire form
   */
  async validateForm(formData: Record<string, any>): Promise<FormValidationResult> {
    const result: FormValidationResult = {
      isValid: true,
      fields: {},
      errors: [],
      warnings: []
    };

    // Validate all configured fields
    const validationPromises = Object.keys(this.fieldConfigs).map(async (fieldName) => {
      const fieldResult = await this.validateField(
        fieldName,
        formData[fieldName],
        formData,
        true // immediate validation for form submission
      );
      
      result.fields[fieldName] = fieldResult;
      
      if (!fieldResult.isValid) {
        result.isValid = false;
        result.errors.push(...fieldResult.errors);
      }
      
      result.warnings.push(...fieldResult.warnings);
    });

    await Promise.all(validationPromises);

    return result;
  }

  /**
   * Get current validation state
   */
  getValidationState(): ValidationState {
    return { ...this.validationState };
  }

  /**
   * Clear validation state for a field
   */
  clearField(fieldName: string): void {
    delete this.validationState.touched[fieldName];
    delete this.validationState.errors[fieldName];
    delete this.validationState.warnings[fieldName];
    delete this.validationState.isValidating[fieldName];
    delete this.validationState.lastValidation[fieldName];
    
    if (this.debounceTimers[fieldName]) {
      clearTimeout(this.debounceTimers[fieldName]);
      delete this.debounceTimers[fieldName];
    }
    
    this.notifyStateChange();
  }

  /**
   * Clear all validation state
   */
  clearAll(): void {
    Object.keys(this.debounceTimers).forEach(fieldName => {
      clearTimeout(this.debounceTimers[fieldName]);
    });
    
    this.validationState = {
      touched: {},
      errors: {},
      warnings: {},
      isValidating: {},
      lastValidation: {}
    };
    
    this.debounceTimers = {};
    this.notifyStateChange();
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.validationState);
    }
  }

  /**
   * Destroy validator and cleanup
   */
  destroy(): void {
    Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
    this.debounceTimers = {};
    this.fieldConfigs = {};
    this.asyncValidators = {};
  }
}

/**
 * Create validation error from form validation result
 */
export function createFormValidationError(
  formResult: FormValidationResult,
  formName?: string
): ValidationError {
  const fieldErrors: Record<string, string[]> = {};
  
  Object.entries(formResult.fields).forEach(([fieldName, fieldResult]) => {
    if (!fieldResult.isValid) {
      fieldErrors[fieldName] = fieldResult.errors;
    }
  });

  return createValidationError('VALIDATION_INVALID_FORMAT', {
    fields: fieldErrors,
    formErrors: formResult.errors
  }, `Form validation failed for ${formName || 'form'}`, {
    formName,
    fieldCount: Object.keys(formResult.fields).length,
    errorCount: Object.keys(fieldErrors).length
  });
}

/**
 * Utility function to create async validators for external validation
 */
export function createAsyncValidator(
  validationFn: (value: any) => Promise<{ isValid: boolean; message?: string; suggestions?: string[] }>,
  timeout: number = 5000
): (value: any) => Promise<FieldValidationResult> {
  return async (value: any): Promise<FieldValidationResult> => {
    try {
      const result = await Promise.race([
        validationFn(value),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Validation timeout')), timeout)
        )
      ]);

      return {
        isValid: result.isValid,
        errors: result.isValid ? [] : [result.message || 'Validation failed'],
        warnings: [],
        suggestions: result.suggestions || []
      };
    } catch (error) {
      logError('🚨 Async validation error:', "Error", error);
      return {
        isValid: true, // Don't block on validation failures
        errors: [],
        warnings: ['Validation temporarily unavailable'],
        suggestions: []
      };
    }
  };
}
