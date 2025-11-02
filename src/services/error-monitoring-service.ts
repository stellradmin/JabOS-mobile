/**
 * Comprehensive Error Logging and Monitoring Integration
 * Provides centralized error tracking, analytics, and monitoring capabilities
 */

import * as Sentry from '@sentry/react-native';
import { StellerError, ErrorState, ErrorSeverity } from '../types/error-types';
import { convertToStellerError } from '../utils/error-factory';
import {
  logError as baseLogError,
  logWarn as baseLogWarn,
  logInfo as baseLogInfo,
  logDebug as baseLogDebug,
  logUserAction as baseLogUserAction,
} from "../utils/logger";

// Error monitoring configuration
interface MonitoringConfig {
  enableSentry: boolean;
  enableLocalLogging: boolean;
  enableAnalytics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  enableUserContext: boolean;
  enablePerformanceTracking: boolean;
}

// Error analytics data
interface ErrorAnalytics {
  errorId: string;
  sessionId: string;
  timestamp: string;
  errorCode: string;
  errorCategory: string;
  errorSeverity: ErrorSeverity;
  errorMessage: string;
  stackTrace?: string;
  userAgent: string;
  appVersion: string;
  platform: string;
  buildNumber?: string;
  userId?: string;
  userEmail?: string;
  breadcrumbs: BreadcrumbEntry[];
  context: Record<string, any>;
  tags: Record<string, string>;
  fingerprint: string[];
  environment: string;
  release: string;
  networkInfo?: NetworkInfo;
  deviceInfo?: DeviceInfo;
  performanceMetrics?: PerformanceMetrics;
}

// Breadcrumb for error tracking
interface BreadcrumbEntry {
  timestamp: string;
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

// Network information for error context
interface NetworkInfo {
  effectiveType?: string;
  type?: string;
  online: boolean;
  rtt?: number;
  downlink?: number;
}

// Device information for error context
interface DeviceInfo {
  platform: string;
  model?: string;
  osVersion?: string;
  screenResolution?: string;
  orientation?: string;
  memory?: number;
}

// Performance metrics for error correlation
interface PerformanceMetrics {
  memoryUsage?: number;
  responseTime?: number;
  renderTime?: number;
  apiCallDuration?: number;
  errorOccurredAt?: number;
}

// Error batch for efficient reporting
interface ErrorBatch {
  errors: ErrorAnalytics[];
  metadata: {
    batchId: string;
    timestamp: string;
    deviceId: string;
    sessionId: string;
  };
}

/**
 * Enhanced Error Monitoring Service
 */
export class ErrorMonitoringService {
  private config: MonitoringConfig;
  private breadcrumbs: BreadcrumbEntry[] = [];
  private errorQueue: ErrorAnalytics[] = [];
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;
  private isInitialized = false;
  private deviceId: string;
  private retryCount = 0;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableSentry: true,
      enableLocalLogging: true,
      enableAnalytics: true,
      logLevel: 'error',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      enableUserContext: true,
      enablePerformanceTracking: true,
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.deviceId = this.generateDeviceId();
    this.initializeMonitoring();
  }

  /**
   * Initialize error monitoring systems
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      if (this.config.enableSentry) {
        await this.initializeSentry();
      }

      if (this.config.enableAnalytics) {
        this.startPeriodicFlush();
      }

      this.addBreadcrumb('monitoring', 'Error monitoring service initialized', 'info');
      this.isInitialized = true;

      baseLogDebug('✅ Error monitoring service initialized', "Debug");
    } catch (error) {
      baseLogError('🚨 Failed to initialize error monitoring:', "Error", error);
      // Continue without monitoring rather than breaking the app
    }
  }

  /**
   * Initialize Sentry for error tracking
   */
  private async initializeSentry(): Promise<void> {
    try {
      Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || 'development',
        release: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
        enableAutoSessionTracking: true,
        // In recent Sentry RN, the correct option is enableAutoPerformanceTracing
        enableAutoPerformanceTracing: this.config.enablePerformanceTracking as any,
        tracesSampleRate: 0.1, // Sample 10% of transactions
        beforeSend: (event) => this.sentryBeforeSend(event),
        beforeBreadcrumb: (breadcrumb) => this.sentryBeforeBreadcrumb(breadcrumb),
      });

      baseLogDebug('✅ Sentry initialized', "Debug");
    } catch (error) {
      baseLogError('🚨 Sentry initialization failed:', "Error", error);
      throw error;
    }
  }

  /**
   * Filter and enhance Sentry events before sending
   */
  private sentryBeforeSend(event: any): any {
    // Add custom context
    if (event.exception) {
      event.tags = {
        ...event.tags,
        sessionId: this.sessionId,
        deviceId: this.deviceId,
        component: 'stellr-dating-app'
      };
    }

    // Filter out sensitive information
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }

    return event;
  }

  /**
   * Filter Sentry breadcrumbs
   */
  private sentryBeforeBreadcrumb(breadcrumb: any): any {
    // Filter out sensitive data from breadcrumbs
    if (breadcrumb.data) {
      delete breadcrumb.data.password;
      delete breadcrumb.data.token;
      delete breadcrumb.data.authorization;
    }

    return breadcrumb;
  }

  /**
   * Log and track a Stellar error
   */
  async logError(
    error: StellerError | Error | any,
    context: Record<string, any> = {},
    userInfo?: { userId?: string; email?: string }
  ): Promise<void> {
    try {
      const stellarError = error instanceof Error ? convertToStellerError(error) : error;
      const errorAnalytics = await this.createErrorAnalytics(stellarError, context, userInfo);

      // Log to console based on severity
      this.logToConsole(stellarError, context);

      // Add to Sentry if enabled
      if (this.config.enableSentry && this.shouldReportToSentry(stellarError)) {
        this.reportToSentry(stellarError, context, userInfo);
      }

      // Add to analytics queue if enabled
      if (this.config.enableAnalytics) {
        this.errorQueue.push(errorAnalytics);
        
        // Flush immediately for critical errors
        if (stellarError.severity === 'critical') {
          await this.flushErrorQueue();
        } else if (this.errorQueue.length >= this.config.batchSize) {
          await this.flushErrorQueue();
        }
      }

      // Add breadcrumb for error tracking
      this.addBreadcrumb(
        'error',
        `${stellarError.category}: ${stellarError.message}`,
        'error',
        {
          errorId: stellarError.id,
          errorCode: stellarError.code,
          severity: stellarError.severity
        }
      );

    } catch (monitoringError) {
      baseLogError('🚨 Error in error monitoring:', "Error", monitoringError);
      // Fallback to basic console logging
      baseLogError('Original error:', "Error", error);
    }
  }

  /**
   * Create comprehensive error analytics data
   */
  private async createErrorAnalytics(
    error: StellerError,
    context: Record<string, any>,
    userInfo?: { userId?: string; email?: string }
  ): Promise<ErrorAnalytics> {
    return {
      errorId: error.id,
      userId: userInfo?.userId,
      sessionId: this.sessionId,
      timestamp: error.timestamp,
      errorCode: error.code,
      errorCategory: error.category,
      errorSeverity: error.severity,
      errorMessage: error.message,
      stackTrace: error.stack,
      userAgent: navigator.userAgent,
      appVersion: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
      platform: 'react-native',
      buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER,
      userEmail: userInfo?.email,
      breadcrumbs: [...this.breadcrumbs],
      context: {
        ...error.context,
        ...context,
        timestamp: new Date().toISOString()
      },
      tags: {
        environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
        component: context.component || 'unknown',
        operation: context.operation || 'unknown'
      },
      fingerprint: this.generateErrorFingerprint(error),
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
      release: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
      networkInfo: await this.getNetworkInfo(),
      deviceInfo: await this.getDeviceInfo(),
      performanceMetrics: await this.getPerformanceMetrics()
    };
  }

  /**
   * Log error to console with appropriate level
   */
  private logToConsole(error: StellerError, context: Record<string, any>): void {
    const logData = {
      errorId: error.id,
      code: error.code,
      category: error.category,
      severity: error.severity,
      message: error.message,
      context,
      timestamp: error.timestamp
    };

    switch (error.severity) {
      case 'critical':
        baseLogError('🔥 CRITICAL ERROR:', "Error", logData);
        break;
      case 'high':
        baseLogError('🚨 HIGH SEVERITY ERROR:', "Error", logData);
        break;
      case 'medium':
        baseLogWarn('⚠️ MEDIUM SEVERITY ERROR:', "Warning", logData);
        break;
      case 'low':
        baseLogInfo('ℹ️ LOW SEVERITY ERROR:', "Info", logData);
        break;
      default:
        baseLogDebug('📝 ERROR:', "Debug", logData);
    }
  }

  /**
   * Determine if error should be reported to Sentry
   */
  private shouldReportToSentry(error: StellerError): boolean {
    // Always report critical and high severity errors
    if (error.severity === 'critical' || error.severity === 'high') {
      return true;
    }

    // Report medium severity errors in production
    if (error.severity === 'medium' && process.env.NODE_ENV === 'production') {
      return true;
    }

    // Don't report validation errors and low severity errors
    if (error.category === 'validation' || error.severity === 'low') {
      return false;
    }

    return true;
  }

  /**
   * Report error to Sentry
   */
  private reportToSentry(
    error: StellerError,
    context: Record<string, any>,
    userInfo?: { userId?: string; email?: string }
  ): void {
    try {
      Sentry.withScope((scope) => {
        // Set user context
        if (userInfo && this.config.enableUserContext) {
          scope.setUser({
            id: userInfo.userId,
            email: userInfo.email
          });
        }

        // Set error context
        scope.setContext('stellarError', {
          id: error.id,
          code: error.code,
          category: error.category,
          severity: error.severity,
          recoveryStrategy: error.recoveryStrategy
        });

        // Set additional context
        scope.setContext('errorContext', context);

        // Set tags
        scope.setTag('errorCategory', error.category);
        scope.setTag('errorSeverity', error.severity);
        scope.setTag('errorCode', error.code);
        scope.setTag('sessionId', this.sessionId);

        // Set fingerprint for grouping
        scope.setFingerprint(this.generateErrorFingerprint(error));

        // Report the error
        if (error.stack) {
          const syntheticError = new Error(error.message);
          syntheticError.stack = error.stack;
          syntheticError.name = error.code;
          Sentry.captureException(syntheticError);
        } else {
          Sentry.captureMessage(error.message, 'error');
        }
      });
    } catch (sentryError) {
      baseLogError('🚨 Failed to report to Sentry:', "Error", sentryError);
    }
  }

  /**
   * Add breadcrumb for error tracking
   */
  addBreadcrumb(
    category: string,
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    const breadcrumb: BreadcrumbEntry = {
      timestamp: new Date().toISOString(),
      category,
      message,
      level,
      data
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }

    // Add to Sentry if enabled
    if (this.config.enableSentry) {
      Sentry.addBreadcrumb({
        category,
        message,
        level: level === 'warning' ? 'warning' : level,
        data
      });
    }
  }

  /**
   * Set user context for error tracking
   */
  setUserContext(userInfo: { userId: string; email?: string; name?: string }): void {
    if (this.config.enableSentry && this.config.enableUserContext) {
      Sentry.setUser({
        id: userInfo.userId,
        email: userInfo.email,
        name: userInfo.name
      });
    }

    this.addBreadcrumb('user', `User context set: ${userInfo.userId}`, 'info');
  }

  /**
   * Clear user context
   */
  clearUserContext(): void {
    if (this.config.enableSentry) {
      Sentry.setUser(null);
    }

    this.addBreadcrumb('user', 'User context cleared', 'info');
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    this.addBreadcrumb(
      'performance',
      `${operation} took ${duration}ms`,
      duration > 5000 ? 'warning' : 'info',
      { operation, duration, ...metadata }
    );

    // Report slow operations to Sentry
    if (this.config.enableSentry && duration > 10000) { // 10 seconds
      Sentry.withScope((scope) => {
        scope.setTag('performance_issue', 'slow_operation');
        scope.setContext('performance', {
          operation,
          duration,
          metadata
        });
        Sentry.captureMessage(`Slow operation detected: ${operation}`, 'warning');
      });
    }
  }

  /**
   * Flush error queue to analytics service
   */
  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    try {
      const batch: ErrorBatch = {
        errors: [...this.errorQueue],
        metadata: {
          batchId: this.generateBatchId(),
          timestamp: new Date().toISOString(),
          deviceId: this.deviceId,
          sessionId: this.sessionId
        }
      };

      // Send to analytics service (implement your analytics endpoint)
      await this.sendToAnalytics(batch);

      // Clear the queue after successful send
      this.errorQueue = [];
      this.retryCount = 0;

      baseLogDebug(`✅ Flushed ${batch.errors.length} errors to analytics`, "Debug");

    } catch (error) {
      baseLogError('🚨 Failed to flush error queue:', "Error", error);
      
      // Retry logic
      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.flushErrorQueue(), 5000 * this.retryCount);
      } else {
        // Clear queue to prevent memory buildup
        baseLogWarn('⚠️ Max retries reached, "Warning", clearing error queue');
        this.errorQueue = [];
        this.retryCount = 0;
      }
    }
  }

  /**
   * Send error batch to analytics service
   */
  private async sendToAnalytics(batch: ErrorBatch): Promise<void> {
    // Implement your analytics endpoint here
    // This could be PostHog, Mixpanel, or your own analytics service
    
    try {
      // Example implementation - replace with your actual analytics service
      const response = await fetch('/api/analytics/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch)
      });

      if (!response.ok) {
        throw new Error(`Analytics API failed: ${response.status}`);
      }
    } catch (error) {
      // For now, just log to console if analytics service is not available
      baseLogDebug('📊 Error analytics (service unavailable, "Debug"):', batch);
    }
  }

  /**
   * Start periodic error queue flushing
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.errorQueue.length > 0) {
        this.flushErrorQueue();
      }
    }, this.config.flushInterval);
  }

  /**
   * Generate error fingerprint for grouping
   */
  private generateErrorFingerprint(error: StellerError): string[] {
    return [
      error.code,
      error.category,
      error.message.substring(0, 100) // First 100 chars of message
    ];
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    // In a real app, you might use expo-device or async-storage for persistent device ID
    return `device_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get network information
   */
  private async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      // In React Native, you might use @react-native-community/netinfo
      return {
        online: navigator.onLine,
        effectiveType: (navigator as any).connection?.effectiveType,
        type: (navigator as any).connection?.type,
        rtt: (navigator as any).connection?.rtt,
        downlink: (navigator as any).connection?.downlink
      };
    } catch {
      return { online: true };
    }
  }

  /**
   * Get device information
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      return {
        platform: 'react-native',
        screenResolution: `${screen.width}x${screen.height}`,
        orientation: screen.orientation?.type || 'unknown',
        memory: (performance as any)?.memory?.usedJSHeapSize
      };
    } catch {
      return { platform: 'react-native' };
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      return {
        memoryUsage: (performance as any)?.memory?.usedJSHeapSize,
        errorOccurredAt: performance.now()
      };
    } catch {
      return {};
    }
  }

  /**
   * Clean up monitoring service
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining errors
    if (this.errorQueue.length > 0) {
      this.flushErrorQueue();
    }

    this.breadcrumbs = [];
    this.errorQueue = [];
    this.isInitialized = false;
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    isInitialized: boolean;
    sessionId: string;
    breadcrumbCount: number;
    queuedErrors: number;
    retryCount: number;
  } {
    return {
      isInitialized: this.isInitialized,
      sessionId: this.sessionId,
      breadcrumbCount: this.breadcrumbs.length,
      queuedErrors: this.errorQueue.length,
      retryCount: this.retryCount
    };
  }
}

// Global error monitoring service instance
export const errorMonitoringService = new ErrorMonitoringService();

// Convenience functions for easy usage
export const logError = (error: any, context?: Record<string, any>, userInfo?: { userId?: string; email?: string }) =>
  errorMonitoringService.logError(error, context, userInfo);

export const addBreadcrumb = (category: string, message: string, level?: 'debug' | 'info' | 'warning' | 'error', data?: Record<string, any>) =>
  errorMonitoringService.addBreadcrumb(category, message, level, data);

export const setUserContext = (userInfo: { userId: string; email?: string; name?: string }) =>
  errorMonitoringService.setUserContext(userInfo);

export const clearUserContext = () =>
  errorMonitoringService.clearUserContext();

export const trackPerformance = (operation: string, duration: number, metadata?: Record<string, any>) =>
  errorMonitoringService.trackPerformance(operation, duration, metadata);
