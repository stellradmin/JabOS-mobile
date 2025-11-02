/**
 * Core Error Monitoring Service
 * Consolidated error monitoring with Sentry integration, recovery mechanisms, and analytics
 * 
 * This service consolidates functionality from:
 * - error-monitoring-service.ts
 * - enhanced-error-monitoring-service.ts
 * - ErrorAnalyticsService.ts
 * - ErrorRecoveryService.ts
 */
import { secureStorage } from '../../utils/secure-storage';

import * as Sentry from '@sentry/react-native';
import { secureStorage } from '../../utils/secure-storage';
import { supabase } from '../../lib/supabase';
import { logError, logWarn, logInfo, logDebug } from '../../../utils/logger';

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory = 
  | 'authentication'
  | 'network'
  | 'database'
  | 'validation'
  | 'business-logic'
  | 'user-interaction'
  | 'performance'
  | 'external-service'
  | 'unknown';

export interface StellerError {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
  stack?: string;
  context?: Record<string, any>;
  recoveryStrategy?: ErrorRecoveryStrategy;
}

export type ErrorRecoveryStrategy = 
  | 'retry'
  | 'fallback'
  | 'refresh-auth'
  | 'clear-cache'
  | 'manual'
  | 'none';

export interface ErrorState {
  hasError: boolean;
  error: StellerError | null;
  errorHistory: StellerError[];
  retryCount: number;
  recoveryAttempts: number;
  isRecovering: boolean;
  lastRecoveryTimestamp?: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  userImpact: 'none' | 'minimal' | 'moderate' | 'severe';
}

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableFallback?: boolean;
  notifyUser?: boolean;
  trackAnalytics?: boolean;
}

// Circuit Breaker for error resilience
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private successCount = 0;

  constructor(
    private threshold = 5,
    private timeout = 60000,
    private serviceName = 'unknown'
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else if (fallback) {
        logDebug(`Circuit breaker open for ${this.serviceName}, using fallback`);
        return await fallback();
      } else {
        throw new Error(`Service ${this.serviceName} is temporarily unavailable`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successCount++;
    
    if (this.state === 'half-open' && this.successCount >= 3) {
      this.state = 'closed';
      logDebug(`Circuit breaker for ${this.serviceName} closed after recovery`);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      logWarn(`Circuit breaker for ${this.serviceName} opened after ${this.failures} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      serviceName: this.serviceName
    };
  }
}

// ===============================================================================
// MAIN ERROR MONITORING SERVICE
// ===============================================================================

export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private errorStates = new Map<string, ErrorState>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private errorQueue: StellerError[] = [];
  private sessionId: string;
  private isInitialized = false;
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService();
    }
    return ErrorMonitoringService.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Sentry
      if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
        Sentry.init({
          dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
          environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
          tracesSampleRate: 0.1,
          beforeSend: (event) => this.sentryBeforeSend(event)
        });
      }

      // Load persisted error states
      await this.loadPersistedStates();

      // Start periodic flush
      this.flushTimer = setInterval(() => {
        this.flushErrorQueue();
      }, 30000); // 30 seconds

      this.isInitialized = true;
      logDebug('ErrorMonitoringService initialized');
    } catch (error) {
      logError('Failed to initialize ErrorMonitoringService:', error);
    }
  }

  // ===============================================================================
  // PUBLIC API - ERROR TRACKING
  // ===============================================================================

  /**
   * Track an error with automatic recovery and analytics
   */
  async trackError(
    error: Error | StellerError | any,
    context?: Record<string, any>,
    options?: ErrorRecoveryOptions
  ): Promise<void> {
    try {
      const stellerError = this.normalizeError(error, context);
      
      // Add to queue for analytics
      this.errorQueue.push(stellerError);

      // Update error state
      this.updateErrorState(stellerError, context?.component);

      // Send to Sentry
      this.sendToSentry(stellerError, context);

      // Attempt recovery if configured
      if (options?.trackAnalytics !== false) {
        await this.attemptRecovery(stellerError, options);
      }

      // Log based on severity
      this.logError(stellerError);

      // Flush if critical
      if (stellerError.severity === 'critical') {
        await this.flushErrorQueue();
      }

    } catch (trackingError) {
      logError('Error tracking failed:', trackingError);
    }
  }

  /**
   * Attempt automatic error recovery
   */
  async attemptRecovery(
    error: StellerError,
    options?: ErrorRecoveryOptions
  ): Promise<boolean> {
    const strategy = error.recoveryStrategy || this.determineRecoveryStrategy(error);
    
    try {
      switch (strategy) {
        case 'retry':
          return await this.retryOperation(error, options);
        
        case 'fallback':
          return await this.useFallback(error, options);
        
        case 'refresh-auth':
          return await this.refreshAuthentication();
        
        case 'clear-cache':
          return await this.clearCache();
        
        default:
          return false;
      }
    } catch (recoveryError) {
      logError('Recovery attempt failed:', recoveryError);
      return false;
    }
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getCircuitBreaker(serviceName: string, threshold = 5, timeout = 60000): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(threshold, timeout, serviceName));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Get error state for a component
   */
  getErrorState(component: string): ErrorState | null {
    return this.errorStates.get(component) || null;
  }

  /**
   * Clear error state for a component
   */
  clearErrorState(component: string): void {
    this.errorStates.delete(component);
  }

  /**
   * Get error metrics summary
   */
  async getErrorMetrics(timeRange?: { start: Date; end: Date }): Promise<ErrorMetrics> {
    const errors = timeRange 
      ? this.errorQueue.filter(e => {
          const timestamp = new Date(e.timestamp);
          return timestamp >= timeRange.start && timestamp <= timeRange.end;
        })
      : this.errorQueue;

    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;

    errors.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    const recoveredErrors = errors.filter(e => e.context?.recovered).length;
    const recoveryRate = errors.length > 0 ? recoveredErrors / errors.length : 0;

    return {
      totalErrors: errors.length,
      errorsByCategory,
      errorsBySeverity,
      recoverySuccessRate: recoveryRate,
      averageRecoveryTime: this.calculateAverageRecoveryTime(errors),
      userImpact: this.calculateUserImpact(errors)
    };
  }

  // ===============================================================================
  // PRIVATE METHODS
  // ===============================================================================

  private normalizeError(error: any, context?: Record<string, any>): StellerError {
    if (error.id && error.category) {
      return error as StellerError;
    }

    return {
      id: this.generateErrorId(),
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      category: this.categorizeError(error),
      severity: this.determineSeverity(error),
      timestamp: new Date().toISOString(),
      stack: error.stack,
      context,
      recoveryStrategy: this.determineRecoveryStrategy(error)
    };
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private categorizeError(error: any): ErrorCategory {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('auth') || message.includes('token')) return 'authentication';
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('database') || message.includes('query')) return 'database';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('performance') || message.includes('timeout')) return 'performance';
    
    return 'unknown';
  }

  private determineSeverity(error: any): ErrorSeverity {
    if (error.severity) return error.severity;
    
    const category = this.categorizeError(error);
    
    if (category === 'authentication' || category === 'database') return 'high';
    if (category === 'network') return 'medium';
    if (category === 'validation') return 'low';
    
    return 'medium';
  }

  private determineRecoveryStrategy(error: StellerError | any): ErrorRecoveryStrategy {
    if (error.recoveryStrategy) return error.recoveryStrategy;
    
    switch (error.category) {
      case 'network':
        return 'retry';
      case 'authentication':
        return 'refresh-auth';
      case 'database':
        return 'fallback';
      default:
        return 'none';
    }
  }

  private updateErrorState(error: StellerError, component?: string): void {
    const key = component || error.category;
    const currentState = this.errorStates.get(key) || {
      hasError: false,
      error: null,
      errorHistory: [],
      retryCount: 0,
      recoveryAttempts: 0,
      isRecovering: false
    };

    this.errorStates.set(key, {
      ...currentState,
      hasError: true,
      error,
      errorHistory: [...currentState.errorHistory.slice(-9), error],
      retryCount: currentState.retryCount + 1
    });
  }

  private sentryBeforeSend(event: any): any {
    // Add custom context
    event.tags = {
      ...event.tags,
      sessionId: this.sessionId
    };

    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }

    return event;
  }

  private sendToSentry(error: StellerError, context?: Record<string, any>): void {
    if (!this.isInitialized) return;

    Sentry.withScope((scope) => {
      scope.setTag('error.category', error.category);
      scope.setTag('error.severity', error.severity);
      scope.setContext('stellerError', {
        id: error.id,
        code: error.code,
        category: error.category,
        severity: error.severity,
        recoveryStrategy: error.recoveryStrategy
      });
      
      if (context) {
        scope.setContext('errorContext', context);
      }

      if (error.severity === 'critical') {
        Sentry.captureException(new Error(error.message), {
          level: 'fatal'
        });
      } else {
        Sentry.captureException(new Error(error.message));
      }
    });
  }

  private logError(error: StellerError): void {
    const logData = {
      id: error.id,
      code: error.code,
      category: error.category,
      severity: error.severity,
      message: error.message
    };

    switch (error.severity) {
      case 'critical':
        logError('CRITICAL ERROR:', logData);
        break;
      case 'high':
        logError('HIGH SEVERITY ERROR:', logData);
        break;
      case 'medium':
        logWarn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case 'low':
        logInfo('LOW SEVERITY ERROR:', logData);
        break;
    }
  }

  private async retryOperation(error: StellerError, options?: ErrorRecoveryOptions): Promise<boolean> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 1000;
    
    const state = this.errorStates.get(error.category);
    if (!state || state.retryCount >= maxRetries) {
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
    
    // Mark as recovering
    this.errorStates.set(error.category, {
      ...state,
      isRecovering: true,
      recoveryAttempts: state.recoveryAttempts + 1
    });

    return true;
  }

  private async useFallback(error: StellerError, options?: ErrorRecoveryOptions): Promise<boolean> {
    if (!options?.enableFallback) return false;
    
    logDebug('Using fallback for error:', error.code);
    return true;
  }

  private async refreshAuthentication(): Promise<boolean> {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        logError('Authentication refresh failed:', error);
        return false;
      }
      logDebug('Authentication refreshed successfully');
      return true;
    } catch (error) {
      logError('Authentication refresh error:', error);
      return false;
    }
  }

  private async clearCache(): Promise<boolean> {
    try {
      await AsyncStorage.multiRemove(['cache', 'temp_data']);
      logDebug('Cache cleared successfully');
      return true;
    } catch (error) {
      logError('Cache clear failed:', error);
      return false;
    }
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    try {
      // Send batch to analytics service
      const batch = this.errorQueue.splice(0, 50);
      logDebug(`Flushing ${batch.length} errors to analytics`);
      
      // Save to persistent storage for analytics
      await this.persistErrors(batch);
      
    } catch (error) {
      logError('Failed to flush error queue:', error);
    }
  }

  private calculateAverageRecoveryTime(errors: StellerError[]): number {
    const recoveredErrors = errors.filter(e => e.context?.recoveryTime);
    if (recoveredErrors.length === 0) return 0;
    
    const totalTime = recoveredErrors.reduce((sum, e) => sum + (e.context?.recoveryTime || 0), 0);
    return totalTime / recoveredErrors.length;
  }

  private calculateUserImpact(errors: StellerError[]): 'none' | 'minimal' | 'moderate' | 'severe' {
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const highErrors = errors.filter(e => e.severity === 'high').length;
    
    if (criticalErrors > 0) return 'severe';
    if (highErrors > 5) return 'moderate';
    if (errors.length > 10) return 'minimal';
    return 'none';
  }

  private async loadPersistedStates(): Promise<void> {
    try {
      const data = await secureStorage.getSecureItem('error_states');
      if (data) {
        const states = JSON.parse(data);
        Object.entries(states).forEach(([key, state]) => {
          this.errorStates.set(key, state as ErrorState);
        });
      }
    } catch (error) {
      logWarn('Failed to load persisted error states:', error);
    }
  }

  private async persistErrors(errors: StellerError[]): Promise<void> {
    try {
      const existing = await secureStorage.getSecureItem('error_analytics');
      const analytics = existing ? JSON.parse(existing) : [];
      analytics.push(...errors);
      
      // Keep only last 1000 errors
      const trimmed = analytics.slice(-1000);
      await secureStorage.storeSecureItem('error_analytics', JSON.stringify(trimmed));
    } catch (error) {
      logWarn('Failed to persist errors:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushErrorQueue();
    this.errorStates.clear();
    this.circuitBreakers.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const errorMonitoring = ErrorMonitoringService.getInstance();

// Convenience functions
export const trackError = (error: any, context?: Record<string, any>, options?: ErrorRecoveryOptions) =>
  errorMonitoring.trackError(error, context, options);

export const getCircuitBreaker = (serviceName: string) =>
  errorMonitoring.getCircuitBreaker(serviceName);

export const getErrorState = (component: string) =>
  errorMonitoring.getErrorState(component);

export const clearErrorState = (component: string) =>
  errorMonitoring.clearErrorState(component);

export const getErrorMetrics = (timeRange?: { start: Date; end: Date }) =>
  errorMonitoring.getErrorMetrics(timeRange);