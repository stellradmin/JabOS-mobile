/**
 * Enhanced Validation Error Handler
 * Provides comprehensive validation error handling with real-time feedback,
 * intelligent field validation, and user experience optimizations
 */

import { Alert } from 'react-native';
import {
  ValidationError,
  StellerError,
  ErrorHandlingOptions
} from '../types/error-types';
import {
  createValidationError,
  createStellerError,
  convertToStellerError
} from '../utils/error-factory';
import EnhancedErrorMonitoringService from '../services/enhanced-error-monitoring-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

// Validation rule types
export type ValidationRule = 
  | 'required'
  | 'email'
  | 'password'
  | 'password-confirm'
  | 'age'
  | 'phone'
  | 'url'
  | 'date'
  | 'time'
  | 'location'
  | 'file-size'
  | 'file-type'
  | 'text-length'
  | 'numeric-range'
  | 'custom';

// Validation configuration
interface ValidationConfig {
  rule: ValidationRule;
  value?: any;
  message?: string;
  severity?: 'error' | 'warning' | 'info';
  realTimeValidation?: boolean;
  debounceMs?: number;
  dependencies?: string[]; // Other fields this validation depends on
}

// Field validation state
interface FieldValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  isValidating: boolean;
  lastValidated: number;
  hasBeenTouched: boolean;
  validationAttempts: number;
}

// Form validation state
interface FormValidationState {
  isValid: boolean;
  fields: Record<string, FieldValidationState>;
  formLevelErrors: string[];
  validationInProgress: boolean;
  submissionAttempts: number;
  lastValidationTime: number;
}

// Validation context for better error messages
interface ValidationContext {
  formName: string;
  fieldName: string;
  fieldLabel?: string;
  fieldType?: string;
  userInput?: any;
  previousValue?: any;
  validationRules: ValidationConfig[];
  formData?: Record<string, any>;
}

// Smart validation suggestions
interface ValidationSuggestion {
  type: 'correction' | 'completion' | 'format' | 'alternative';
  message: string;
  suggestedValue?: any;
  action?: () => void;
}

class EnhancedValidationErrorHandler {
  private static instance: EnhancedValidationErrorHandler;
  private formStates = new Map<string, FormValidationState>();
  private validationRules = new Map<string, Map<string, ValidationConfig[]>>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private errorMonitoring = EnhancedErrorMonitoringService.getInstance();

  // Common validation patterns
  private validationPatterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+?[\d\s\-\(\)]+$/,
    url: /^https?:\/\/.+\..+/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/
  };

  // User-friendly error messages
  private validationMessages = {
    required: (field: string) => `${field} is required`,
    email: 'Please enter a valid email address',
    password: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    passwordConfirm: 'Passwords do not match',
    age: 'Age must be between 18 and 100',
    phone: 'Please enter a valid phone number',
    url: 'Please enter a valid URL',
    date: 'Please enter a valid date',
    time: 'Please enter a valid time',
    location: 'Please provide a valid location',
    fileSize: 'File size is too large',
    fileType: 'File type is not supported',
    textLength: (min: number, max: number) => `Text must be between ${min} and ${max} characters`,
    numericRange: (min: number, max: number) => `Value must be between ${min} and ${max}`
  };

  private constructor() {
    this.initializeHandler();
  }

  static getInstance(): EnhancedValidationErrorHandler {
    if (!EnhancedValidationErrorHandler.instance) {
      EnhancedValidationErrorHandler.instance = new EnhancedValidationErrorHandler();
    }
    return EnhancedValidationErrorHandler.instance;
  }

  private initializeHandler(): void {
    logDebug('✅ Enhanced Validation Error Handler initialized', "Debug");
  }

  /**
   * Register validation rules for a form field
   */
  registerFieldValidation(
    formName: string,
    fieldName: string,
    rules: ValidationConfig[]
  ): void {
    if (!this.validationRules.has(formName)) {
      this.validationRules.set(formName, new Map());
    }
    
    const formRules = this.validationRules.get(formName)!;
    formRules.set(fieldName, rules);

    // Initialize field state
    this.initializeFieldState(formName, fieldName);
  }

  /**
   * Validate a single field with comprehensive error handling
   */
  async validateField(
    formName: string,
    fieldName: string,
    value: any,
    context?: Partial<ValidationContext>
  ): Promise<FieldValidationState> {
    const validationContext: ValidationContext = {
      formName,
      fieldName,
      fieldLabel: context?.fieldLabel || fieldName,
      fieldType: context?.fieldType || 'text',
      userInput: value,
      previousValue: context?.previousValue,
      validationRules: this.getFieldRules(formName, fieldName),
      formData: context?.formData || {}
    };

    // Get current field state
    const fieldState = this.getFieldState(formName, fieldName);
    fieldState.isValidating = true;
    fieldState.hasBeenTouched = true;
    fieldState.validationAttempts++;

    try {
      // Clear previous validation results
      fieldState.errors = [];
      fieldState.warnings = [];
      fieldState.info = [];

      // Run validation rules
      const validationResults = await this.runValidationRules(value, validationContext);
      
      // Process results
      fieldState.errors = validationResults.errors;
      fieldState.warnings = validationResults.warnings;
      fieldState.info = validationResults.info;
      fieldState.isValid = validationResults.errors.length === 0;
      fieldState.lastValidated = Date.now();

      // Update form state
      this.updateFormState(formName);

      // Track validation analytics
      if (!fieldState.isValid) {
        await this.trackValidationError(validationContext, validationResults);
      }

      return fieldState;

    } catch (error) {
      logError(`🚨 Field validation error for ${formName}.${fieldName}:`, "Error", error);
      
      fieldState.errors = ['Validation error occurred'];
      fieldState.isValid = false;
      
      // Report validation system error
      await this.errorMonitoring.reportError(
        convertToStellerError(error, { validationContext }),
        { feature: 'field-validation' }
      );

      return fieldState;

    } finally {
      fieldState.isValidating = false;
    }
  }

  /**
   * Validate entire form
   */
  async validateForm(
    formName: string,
    formData: Record<string, any>,
    options: { showErrors?: boolean; focusFirstError?: boolean } = {}
  ): Promise<FormValidationState> {
    const formState = this.getFormState(formName);
    formState.validationInProgress = true;
    formState.submissionAttempts++;

    try {
      logDebug(`🔍 Validating form: ${formName}`, "Debug");

      // Validate all fields
      const fieldNames = Array.from(this.validationRules.get(formName)?.keys() || []);
      const fieldValidations = await Promise.all(
        fieldNames.map(fieldName => 
          this.validateField(formName, fieldName, formData[fieldName], {
            formData,
            fieldType: this.inferFieldType(fieldName, formData[fieldName])
          })
        )
      );

      // Run form-level validations
      const formLevelErrors = await this.runFormLevelValidations(formName, formData);
      formState.formLevelErrors = formLevelErrors;

      // Update overall form validity
      const hasFieldErrors = fieldValidations.some(field => !field.isValid);
      const hasFormErrors = formLevelErrors.length > 0;
      formState.isValid = !hasFieldErrors && !hasFormErrors;
      formState.lastValidationTime = Date.now();

      // Show errors if requested
      if (options.showErrors && !formState.isValid) {
        await this.showFormValidationErrors(formName, formState);
      }

      // Focus first error if requested
      if (options.focusFirstError && !formState.isValid) {
        this.focusFirstErrorField(formName, formState);
      }

      // Track form validation analytics
      await this.trackFormValidation(formName, formState, formData);

      return formState;

    } catch (error) {
      logError(`🚨 Form validation error for ${formName}:`, "Error", error);
      
      formState.formLevelErrors = ['Form validation failed'];
      formState.isValid = false;

      // Report form validation system error
      await this.errorMonitoring.reportError(
        convertToStellerError(error, { formName, formData }),
        { feature: 'form-validation' }
      );

      return formState;

    } finally {
      formState.validationInProgress = false;
    }
  }

  /**
   * Real-time field validation with debouncing
   */
  validateFieldRealTime(
    formName: string,
    fieldName: string,
    value: any,
    options: { debounceMs?: number; formData?: Record<string, any> } = {}
  ): Promise<FieldValidationState> {
    const debounceKey = `${formName}_${fieldName}`;
    const debounceMs = options.debounceMs || 500;

    // Clear existing timer
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        try {
          const result = await this.validateField(formName, fieldName, value, {
            formData: options.formData,
            fieldType: this.inferFieldType(fieldName, value)
          });
          this.debounceTimers.delete(debounceKey);
          resolve(result);
        } catch (error) {
          logError(`🚨 Real-time validation error:`, "Error", error);
          resolve(this.getFieldState(formName, fieldName));
        }
      }, debounceMs);

      this.debounceTimers.set(debounceKey, timer);
    });
  }

  private async runValidationRules(
    value: any,
    context: ValidationContext
  ): Promise<{ errors: string[]; warnings: string[]; info: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    for (const config of context.validationRules) {
      try {
        const result = await this.applyValidationRule(value, config, context);
        
        switch (result.severity) {
          case 'error':
            if (result.message) errors.push(result.message);
            break;
          case 'warning':
            if (result.message) warnings.push(result.message);
            break;
          case 'info':
            if (result.message) info.push(result.message);
            break;
        }
      } catch (ruleError) {
        logError(`🚨 Validation rule error:`, "Error", ruleError);
        errors.push(`Validation error: ${config.rule}`);
      }
    }

    return { errors, warnings, info };
  }

  private async applyValidationRule(
    value: any,
    config: ValidationConfig,
    context: ValidationContext
  ): Promise<{ severity: 'error' | 'warning' | 'info'; message?: string; valid: boolean }> {
    const { rule, value: ruleValue, message, severity = 'error' } = config;

    switch (rule) {
      case 'required':
        const isEmpty = value === null || value === undefined || value === '' || 
                       (Array.isArray(value) && value.length === 0);
        return {
          severity,
          message: isEmpty ? (message || this.validationMessages.required(context.fieldLabel!)) : undefined,
          valid: !isEmpty
        };

      case 'email':
        const isValidEmail = !value || this.validationPatterns.email.test(value);
        return {
          severity,
          message: !isValidEmail ? (message || this.validationMessages.email) : undefined,
          valid: isValidEmail
        };

      case 'password':
        const isValidPassword = !value || this.validationPatterns.password.test(value);
        return {
          severity,
          message: !isValidPassword ? (message || this.validationMessages.password) : undefined,
          valid: isValidPassword
        };

      case 'password-confirm':
        const originalPassword = context.formData?.[ruleValue as string];
        const passwordsMatch = !value || value === originalPassword;
        return {
          severity,
          message: !passwordsMatch ? (message || this.validationMessages.passwordConfirm) : undefined,
          valid: passwordsMatch
        };

      case 'age':
        const age = parseInt(value, 10);
        const isValidAge = !value || (!isNaN(age) && age >= 18 && age <= 100);
        return {
          severity,
          message: !isValidAge ? (message || this.validationMessages.age) : undefined,
          valid: isValidAge
        };

      case 'phone':
        const isValidPhone = !value || this.validationPatterns.phone.test(value);
        return {
          severity,
          message: !isValidPhone ? (message || this.validationMessages.phone) : undefined,
          valid: isValidPhone
        };

      case 'text-length':
        const { min = 0, max = Infinity } = ruleValue as { min?: number; max?: number } || {};
        const length = value ? value.length : 0;
        const isValidLength = length >= min && length <= max;
        return {
          severity,
          message: !isValidLength ? (message || this.validationMessages.textLength(min, max)) : undefined,
          valid: isValidLength
        };

      case 'numeric-range':
        const { min: numMin = -Infinity, max: numMax = Infinity } = ruleValue as { min?: number; max?: number } || {};
        const numValue = parseFloat(value);
        const isValidRange = !value || (!isNaN(numValue) && numValue >= numMin && numValue <= numMax);
        return {
          severity,
          message: !isValidRange ? (message || this.validationMessages.numericRange(numMin, numMax)) : undefined,
          valid: isValidRange
        };

      case 'file-size':
        const maxSize = ruleValue as number || (5 * 1024 * 1024); // 5MB default
        const fileSize = value?.size || 0;
        const isValidSize = fileSize <= maxSize;
        return {
          severity,
          message: !isValidSize ? (message || this.validationMessages.fileSize) : undefined,
          valid: isValidSize
        };

      case 'file-type':
        const allowedTypes = ruleValue as string[] || [];
        const fileType = value?.type || '';
        const isValidType = !value || allowedTypes.length === 0 || allowedTypes.includes(fileType);
        return {
          severity,
          message: !isValidType ? (message || this.validationMessages.fileType) : undefined,
          valid: isValidType
        };

      case 'custom':
        // Custom validation function
        if (typeof ruleValue === 'function') {
          const customResult = await ruleValue(value, context);
          return {
            severity,
            message: customResult.valid ? undefined : (customResult.message || message),
            valid: customResult.valid
          };
        }
        return { severity, valid: true };

      default:
        return { severity, valid: true };
    }
  }

  private async runFormLevelValidations(
    formName: string,
    formData: Record<string, any>
  ): Promise<string[]> {
    const errors: string[] = [];

    // Add form-specific validation logic here
    // For example, checking relationships between fields

    if (formName === 'profile-setup') {
      // Validate birth date and age consistency
      if (formData.birth_date && formData.age) {
        const birthYear = new Date(formData.birth_date).getFullYear();
        const currentYear = new Date().getFullYear();
        const calculatedAge = currentYear - birthYear;
        
        if (Math.abs(calculatedAge - formData.age) > 1) {
          errors.push('Birth date and age do not match');
        }
      }
    }

    if (formName === 'preferences') {
      // Validate age range
      if (formData.min_age && formData.max_age && formData.min_age > formData.max_age) {
        errors.push('Minimum age cannot be greater than maximum age');
      }
    }

    return errors;
  }

  private async trackValidationError(
    context: ValidationContext,
    results: { errors: string[]; warnings: string[]; info: string[] }
  ): Promise<void> {
    const validationError = createValidationError('VALIDATION_INVALID_FORMAT', {
      fields: { [context.fieldName]: results.errors },
      formErrors: [],
      validationRules: context.validationRules.map(r => r.rule)
    }, `Validation failed for ${context.fieldLabel}`, {
      formName: context.formName,
      fieldName: context.fieldName,
      userInput: context.userInput
    });

    await this.errorMonitoring.reportError(validationError, {
      feature: 'field-validation',
      screen: context.formName,
      userAction: 'input-validation'
    });
  }

  private async trackFormValidation(
    formName: string,
    formState: FormValidationState,
    formData: Record<string, any>
  ): Promise<void> {
    if (!formState.isValid) {
      const allErrors: string[] = [];
      const fieldErrors: Record<string, string[]> = {};

      // Collect field errors
      Object.entries(formState.fields).forEach(([fieldName, fieldState]) => {
        if (fieldState.errors.length > 0) {
          fieldErrors[fieldName] = fieldState.errors;
          allErrors.push(...fieldState.errors);
        }
      });

      // Add form-level errors
      allErrors.push(...formState.formLevelErrors);

      const validationError = createValidationError('VALIDATION_INVALID_FORMAT', {
        fields: fieldErrors,
        formErrors: formState.formLevelErrors
      }, `Form validation failed: ${formName}`, {
        formName,
        submissionAttempts: formState.submissionAttempts
      });

      await this.errorMonitoring.reportError(validationError, {
        feature: 'form-validation',
        screen: formName,
        userAction: 'form-submission'
      });
    }
  }

  private async showFormValidationErrors(
    formName: string,
    formState: FormValidationState
  ): Promise<void> {
    const errorMessages: string[] = [];

    // Collect field errors
    Object.entries(formState.fields).forEach(([fieldName, fieldState]) => {
      if (fieldState.errors.length > 0) {
        errorMessages.push(`${fieldName}: ${fieldState.errors.join(', ')}`);
      }
    });

    // Add form-level errors
    errorMessages.push(...formState.formLevelErrors);

    if (errorMessages.length > 0) {
      Alert.alert(
        'Validation Errors',
        errorMessages.join('\n\n'),
        [
          { text: 'OK', style: 'default' },
          { text: 'Get Help', onPress: () => this.showValidationHelp(formName) }
        ]
      );
    }
  }

  private focusFirstErrorField(formName: string, formState: FormValidationState): void {
    // Find first field with errors
    const firstErrorField = Object.entries(formState.fields)
      .find(([_, fieldState]) => fieldState.errors.length > 0);

    if (firstErrorField) {
      logDebug(`🔍 Focusing first error field: ${firstErrorField[0]}`, "Debug");
      // Implementation would focus the field in the UI
    }
  }

  private showValidationHelp(formName: string): void {
    logDebug(`❓ Showing validation help for form: ${formName}`, "Debug");
    // Implementation would show contextual help
  }

  // Utility methods
  private getFieldRules(formName: string, fieldName: string): ValidationConfig[] {
    return this.validationRules.get(formName)?.get(fieldName) || [];
  }

  private initializeFieldState(formName: string, fieldName: string): void {
    const formState = this.getFormState(formName);
    
    if (!formState.fields[fieldName]) {
      formState.fields[fieldName] = {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        isValidating: false,
        lastValidated: 0,
        hasBeenTouched: false,
        validationAttempts: 0
      };
    }
  }

  private getFieldState(formName: string, fieldName: string): FieldValidationState {
    const formState = this.getFormState(formName);
    this.initializeFieldState(formName, fieldName);
    return formState.fields[fieldName];
  }

  private getFormState(formName: string): FormValidationState {
    if (!this.formStates.has(formName)) {
      this.formStates.set(formName, {
        isValid: true,
        fields: {},
        formLevelErrors: [],
        validationInProgress: false,
        submissionAttempts: 0,
        lastValidationTime: 0
      });
    }
    return this.formStates.get(formName)!;
  }

  private updateFormState(formName: string): void {
    const formState = this.getFormState(formName);
    
    // Update overall form validity based on field states
    const hasInvalidFields = Object.values(formState.fields).some(field => !field.isValid);
    const hasFormErrors = formState.formLevelErrors.length > 0;
    
    formState.isValid = !hasInvalidFields && !hasFormErrors;
  }

  private inferFieldType(fieldName: string, value: any): string {
    const name = fieldName.toLowerCase();
    
    if (name.includes('email')) return 'email';
    if (name.includes('password')) return 'password';
    if (name.includes('phone')) return 'phone';
    if (name.includes('age')) return 'number';
    if (name.includes('date')) return 'date';
    if (name.includes('time')) return 'time';
    if (name.includes('url') || name.includes('website')) return 'url';
    
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    
    return 'text';
  }

  // Public interface methods
  public getFormValidationState(formName: string): FormValidationState {
    return this.getFormState(formName);
  }

  public getFieldValidationState(formName: string, fieldName: string): FieldValidationState {
    return this.getFieldState(formName, fieldName);
  }

  public clearFormValidation(formName: string): void {
    this.formStates.delete(formName);
    
    // Clear any pending debounce timers for this form
    Array.from(this.debounceTimers.keys())
      .filter(key => key.startsWith(`${formName}_`))
      .forEach(key => {
        clearTimeout(this.debounceTimers.get(key)!);
        this.debounceTimers.delete(key);
      });
  }

  public clearFieldValidation(formName: string, fieldName: string): void {
    const formState = this.getFormState(formName);
    delete formState.fields[fieldName];
    
    const debounceKey = `${formName}_${fieldName}`;
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
      this.debounceTimers.delete(debounceKey);
    }
  }

  // Cleanup
  public destroy(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // Clear all states
    this.formStates.clear();
    this.validationRules.clear();
  }
}

export default EnhancedValidationErrorHandler;
