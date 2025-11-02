/**
 * Enhanced Error Monitoring Service
 * Provides comprehensive error tracking, analytics, and recovery mechanisms
 * Builds on existing error-monitoring-service.ts with advanced features
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { secureStorage } from '../utils/secure-storage';
import { supabase } from '../lib/supabase';
import {
  StellerError,
  ErrorState,
  ErrorReport,
  ErrorHandlerConfig,
  ErrorHandlingOptions,
  ERROR_CODES,
  ERROR_RECOVERY_STRATEGIES
} from '../types/error-types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { 
  createStellerError,
  createNetworkError,
  convertToStellerError 
} from '../utils/error-factory';

// Enhanced error monitoring configuration
interface EnhancedMonitoringConfig {
  enableRealTimeTracking: boolean;
  enableErrorAggregation: boolean;
  enableUserImpactAnalysis: boolean;
  enableRecoveryTracking: boolean;
  batchSize: number;
  flushInterval: number;
  offlineBufferSize: number;
  enableCrashRecovery: boolean;
}

// Error analytics data
interface ErrorAnalytics {
  errorId: string;
  sessionId: string;
  userId?: string;
  timestamp: string;
  errorCode: string;
  category: string;
  severity: string;
  recoveryStrategy: string;
  userImpact: string;
  deviceInfo: {
    platform: string;
    version: string;
    model?: string;
    networkType?: string;
    batteryLevel?: number;
  };
  appContext: {
    screen: string;
    feature: string;
    userAction?: string;
    dataState?: any;
  };
  performanceMetrics: {
    memoryUsage?: number;
    cpuUsage?: number;
    networkLatency?: number;
    renderTime?: number;
  };
  recoveryAttempts: number;
  recoverySuccess: boolean;
  userFeedback?: string;
}

// Error impact assessment
interface ErrorImpactAssessment {
  immediateImpact: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  businessImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  userExperienceImpact: 'none' | 'minor' | 'noticeable' | 'frustrating' | 'blocking';
  technicalImpact: 'none' | 'isolated' | 'component' | 'feature' | 'system';
  estimatedRecoveryTime: number; // milliseconds
  affectedUserPercentage: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Enhanced circuit breaker for frontend services
class FrontendCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private successCount = 0;
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    responseTimeHistory: [] as number[]
  };

  constructor(
    private threshold = 5,
    private timeout = 60000,
    private serviceName = 'unknown'
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        if (fallback) {
          logDebug(`🔄 Circuit breaker open for ${this.serviceName}, "Debug", using fallback`);
          return await fallback();
        }
        throw createStellerError('EXTERNAL_SERVICE_UNAVAILABLE', 
          `Service ${this.serviceName} is temporarily unavailable`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(responseTime: number): void {
    this.failures = 0;
    this.successCount++;
    this.metrics.successfulRequests++;
    
    // Update response time metrics
    this.metrics.responseTimeHistory.push(responseTime);
    if (this.metrics.responseTimeHistory.length > 100) {
      this.metrics.responseTimeHistory = this.metrics.responseTimeHistory.slice(-100);
    }
    
    this.metrics.averageResponseTime = 
      this.metrics.responseTimeHistory.reduce((a, b) => a + b, 0) / 
      this.metrics.responseTimeHistory.length;

    if (this.state === 'half-open' && this.successCount >= 3) {
      this.state = 'closed';
      logDebug(`✅ Circuit breaker for ${this.serviceName} closed after successful recovery`, "Debug");
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.metrics.failedRequests++;

    if (this.failures >= this.threshold) {
      this.state = 'open';
      logDebug(`🚨 Circuit breaker for ${this.serviceName} opened after ${this.failures} failures`, "Debug");
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      serviceName: this.serviceName,
      metrics: this.metrics,
      healthStatus: this.getHealthStatus()
    };
  }

  private getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' | 'offline' {
    if (this.state === 'open') return 'offline';
    
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    if (successRate > 0.95) return 'healthy';
    if (successRate > 0.8) return 'degraded';
    return 'unhealthy';
  }
}

class EnhancedErrorMonitoringService {
  private static instance: EnhancedErrorMonitoringService;
  private errorBuffer: ErrorAnalytics[] = [];
  private sessionId: string;
  private isOnline = true;
  private circuitBreakers = new Map<string, FrontendCircuitBreaker>();
  private errorStates = new Map<string, ErrorState>();
  
  private config: EnhancedMonitoringConfig = {
    enableRealTimeTracking: true,
    enableErrorAggregation: true,
    enableUserImpactAnalysis: true,
    enableRecoveryTracking: true,
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    offlineBufferSize: 100,
    enableCrashRecovery: true
  };

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
  }

  static getInstance(): EnhancedErrorMonitoringService {
    if (!EnhancedErrorMonitoringService.instance) {
      EnhancedErrorMonitoringService.instance = new EnhancedErrorMonitoringService();
    }
    return EnhancedErrorMonitoringService.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initializeMonitoring(): Promise<void> {
    try {
      // Start periodic error buffer flush
      setInterval(() => {
        this.flushErrorBuffer();
      }, this.config.flushInterval);

      // Monitor network status
      // Note: This would need to be implemented with React Native's NetInfo
      this.monitorNetworkStatus();

      // Recover from previous crashes if enabled
      if (this.config.enableCrashRecovery) {
        await this.recoverFromCrash();
      }

      logDebug('✅ Enhanced Error Monitoring Service initialized', "Debug");
    } catch (error) {
      logError('🚨 Failed to initialize error monitoring:', "Error", error);
    }
  }

  // Small helper to add timeout support to fetch via AbortController
  private async fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input as any, { ...(init || {}), signal: controller.signal });
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  private monitorNetworkStatus(): void {
    // Implementation would use NetInfo from React Native
    // For now, we'll assume online status
    this.isOnline = true;
  }

  private async recoverFromCrash(): Promise<void> {
    try {
      const crashData = await secureStorage.getCrashData();
      if (crashData) {
        const crashInfo = crashData;
        logDebug('🔧 Recovering from previous crash:', "Debug", crashInfo);
        
        // Send crash report
        await this.reportError(createStellerError('UNEXPECTED_ERROR', 
          'Application recovered from crash', crashInfo));
        
        // Clear crash data
        await secureStorage.clearCrashData();
      }
    } catch (error) {
      logWarn('⚠️ Failed to recover from crash:', "Warning", error);
    }
  }

  /**
   * Enhanced error reporting with comprehensive analytics
   */
  async reportError(
    error: StellerError,
    context?: Record<string, any>,
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    try {
      // Create comprehensive error analytics
      const analytics = await this.createErrorAnalytics(error, context);
      
      // Assess error impact
      const impactAssessment = this.assessErrorImpact(error, analytics);
      
      // Add to buffer for batch processing
      this.errorBuffer.push(analytics);
      
      // Handle critical errors immediately
      if (impactAssessment.riskLevel === 'critical' || error.severity === 'critical') {
        await this.handleCriticalError(error, analytics, impactAssessment);
      }
      
      // Update error state for the service/component
      this.updateErrorState(error, context);
      
      // Send to Sentry with enhanced context
      this.sendToSentry(error, analytics, impactAssessment);
      
      // Attempt automatic recovery if configured
      if (this.config.enableRecoveryTracking && !options.silent) {
        await this.attemptAutomaticRecovery(error, analytics);
      }
      
      // Flush buffer if it's getting full
      if (this.errorBuffer.length >= this.config.batchSize) {
        await this.flushErrorBuffer();
      }
      
    } catch (reportingError) {
      logError('🚨 Failed to report error:', "Error", reportingError);
      // Store error locally for later retry
      await this.storeErrorForRetry(error, context);
    }
  }

  private async createErrorAnalytics(
    error: StellerError,
    context?: Record<string, any>
  ): Promise<ErrorAnalytics> {
    const deviceInfo = await this.getDeviceInfo();
    const appContext = await this.getAppContext(context);
    const performanceMetrics = await this.getPerformanceMetrics();

    return {
      errorId: error.id,
      sessionId: this.sessionId,
      userId: context?.userId,
      timestamp: error.timestamp,
      errorCode: error.code,
      category: error.category,
      severity: error.severity,
      recoveryStrategy: error.recoveryStrategy,
      userImpact: this.determineUserImpact(error),
      deviceInfo,
      appContext,
      performanceMetrics,
      recoveryAttempts: context?.retryCount || 0,
      recoverySuccess: false,
      userFeedback: context?.userFeedback
    };
  }

  private assessErrorImpact(
    error: StellerError,
    analytics: ErrorAnalytics
  ): ErrorImpactAssessment {
    let immediateImpact: any = 'minor';
    let businessImpact: any = 'low';
    let userExperienceImpact: any = 'minor';
    let technicalImpact: any = 'isolated';

    // Assess based on error category and severity
    if (error.category === 'authentication' || error.category === 'authorization') {
      immediateImpact = 'severe';
      businessImpact = 'high';
      userExperienceImpact = 'blocking';
      technicalImpact = 'feature';
    } else if (error.category === 'matching-system' || error.category === 'compatibility-calculation') {
      immediateImpact = 'moderate';
      businessImpact = 'medium';
      userExperienceImpact = 'frustrating';
      technicalImpact = 'component';
    } else if (error.category === 'network') {
      immediateImpact = 'moderate';
      businessImpact = 'medium';
      userExperienceImpact = 'noticeable';
      technicalImpact = 'component';
    }

    // Adjust based on severity
    if (error.severity === 'critical') {
      immediateImpact = 'critical';
      businessImpact = 'critical';
      userExperienceImpact = 'blocking';
      technicalImpact = 'system';
    }

    return {
      immediateImpact,
      businessImpact,
      userExperienceImpact,
      technicalImpact,
      estimatedRecoveryTime: this.getEstimatedRecoveryTime(error),
      affectedUserPercentage: this.estimateAffectedUsers(error),
      riskLevel: this.calculateRiskLevel(immediateImpact, businessImpact, userExperienceImpact)
    };
  }

  private async handleCriticalError(
    error: StellerError,
    analytics: ErrorAnalytics,
    impactAssessment: ErrorImpactAssessment
  ): Promise<void> {
    // Store crash data for recovery
    await secureStorage.storeCrashData({
      error,
      analytics,
      impactAssessment,
      timestamp: new Date().toISOString()
    });

    // Send immediate alert to monitoring system
    await this.sendImmediateAlert(error, analytics, impactAssessment);

    // Show user notification if appropriate
    if (impactAssessment.userExperienceImpact === 'blocking') {
      Alert.alert(
        'Service Temporarily Unavailable',
        'We\'re experiencing technical difficulties. Our team has been notified and is working to resolve this quickly.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Report Issue', onPress: () => this.showErrorReportDialog(error) }
        ]
      );
    }
  }

  private updateErrorState(error: StellerError, context?: Record<string, any>): void {
    const serviceKey = context?.service || error.category;
    const currentState = this.errorStates.get(serviceKey) || {
      hasError: false,
      error: null,
      errorHistory: [],
      retryCount: 0,
      recoveryAttempts: 0,
      isRecovering: false
    };

    const updatedState: ErrorState = {
      ...currentState,
      hasError: true,
      error,
      errorHistory: [...currentState.errorHistory.slice(-4), error],
      retryCount: currentState.retryCount + 1
    };

    this.errorStates.set(serviceKey, updatedState);
  }

  private sendToSentry(
    error: StellerError,
    analytics: ErrorAnalytics,
    impactAssessment: ErrorImpactAssessment
  ): void {
    Sentry.withScope((scope) => {
      scope.setTag('error.category', error.category);
      scope.setTag('error.severity', error.severity);
      scope.setTag('error.recovery_strategy', error.recoveryStrategy);
      scope.setTag('impact.risk_level', impactAssessment.riskLevel);
      scope.setTag('impact.user_experience', impactAssessment.userExperienceImpact);
      
      scope.setContext('error_analytics', analytics as unknown as Record<string, unknown>);
      scope.setContext('impact_assessment', impactAssessment as unknown as Record<string, unknown>);
      
      scope.setLevel(error.severity as any);
      
      Sentry.captureException(new Error(error.message), {
        fingerprint: [error.code, error.category]
      });
    });
  }

  private async attemptAutomaticRecovery(
    error: StellerError,
    analytics: ErrorAnalytics
  ): Promise<boolean> {
    const strategy = ERROR_RECOVERY_STRATEGIES[error.code as keyof typeof ERROR_RECOVERY_STRATEGIES];
    
    try {
      switch (strategy) {
        case 'retry':
          return await this.retryOperation(error, analytics);
          
        case 'fallback':
          return await this.useFallbackData(error, analytics);
          
        case 'refresh-auth':
          return await this.refreshAuthentication(error, analytics);
          
        case 'clear-state':
          return await this.clearApplicationState(error, analytics);
          
        default:
          return false;
      }
    } catch (recoveryError) {
      logError('🚨 Automatic recovery failed:', "Error", recoveryError);
      return false;
    }
  }

  private async retryOperation(
    error: StellerError,
    analytics: ErrorAnalytics
  ): Promise<boolean> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      logDebug('🔄 Attempting to retry operation for error:', "Debug", error.code);
      
      // Extract operation context from error
      const operationContext = error.context?.operationContext;
      const retryAttempt = (error.context?.retryAttempt || 0) + 1;
      
      if (retryAttempt > maxRetries) {
        logWarn('🚫 Maximum retry attempts exceeded for operation:', "Warning", error.code);
        return false;
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, retryAttempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry based on error category
      switch (error.category) {
        case 'network':
          return await this.retryNetworkOperation(operationContext, retryAttempt);
        case 'database':
          return await this.retryDatabaseOperation(operationContext, retryAttempt);
        case 'external-service':
          return await this.retryExternalServiceOperation(operationContext, retryAttempt);
        case 'matching-system':
          return await this.retryMatchingOperation(operationContext, retryAttempt);
        case 'compatibility-calculation':
          return await this.retryCompatibilityOperation(operationContext, retryAttempt);
        default:
          logWarn('⚠️ No retry strategy available for error category:', "Warning", error.category);
          return false;
      }
    } catch (retryError) {
      logError('🚨 Retry operation failed:', "Error", retryError);
      return false;
    }
  }
  
  private async retryNetworkOperation(context: any, attempt: number): Promise<boolean> {
    if (!context?.url || !context?.method) {
      return false;
    }
    
    try {
      logDebug(`🌐 Retrying network operation (attempt ${attempt}):`, "Debug", context.url);
      
      // Use exponential backoff for network retries with an AbortController-based timeout
      const response = await this.fetchWithTimeout(
        context.url,
        {
          method: context.method,
          headers: context.headers || {},
          body: context.body,
        },
        Math.min(30000, 5000 * attempt)
      );
      
      return response.ok;
    } catch (error) {
      logError('🚨 Network retry failed:', "Error", error);
      return false;
    }
  }
  
  private async retryDatabaseOperation(context: any, attempt: number): Promise<boolean> {
    if (!context?.query) {
      return false;
    }
    
    try {
      logDebug(`💾 Retrying database operation (attempt ${attempt})`, "Debug");
      
      // Retry database operation with fresh connection
      const { error } = await supabase.rpc(context.query, context.params || {});
      return !error;
    } catch (error) {
      logError('🚨 Database retry failed:', "Error", error);
      return false;
    }
  }
  
  private async retryExternalServiceOperation(context: any, attempt: number): Promise<boolean> {
    logDebug(`🔌 Retrying external service operation (attempt ${attempt})`, "Debug");
    
    // Wait longer for external services (they might be temporarily down)
    const serviceDelay = 2000 * attempt;
    await new Promise(resolve => setTimeout(resolve, serviceDelay));
    
    // Generic retry for external services
    return await this.retryNetworkOperation(context, attempt);
  }
  
  private async retryMatchingOperation(context: any, attempt: number): Promise<boolean> {
    try {
      logDebug(`💕 Retrying matching operation (attempt ${attempt})`, "Debug");
      
      // For matching operations, we can retry with simplified parameters
      if (context?.userId && context?.operation === 'getMatches') {
        // Retry with fallback matching parameters
        const { error } = await supabase
          .from('user_matches')
          .select('*')
          .eq('user_id', context.userId)
          .limit(10);
        
        return !error;
      }
      
      return false;
    } catch (error) {
      logError('🚨 Matching retry failed:', "Error", error);
      return false;
    }
  }
  
  private async retryCompatibilityOperation(context: any, attempt: number): Promise<boolean> {
    try {
      logDebug(`🧮 Retrying compatibility operation (attempt ${attempt})`, "Debug");
      
      // For compatibility calculations, retry with cached data if available
      if (context?.user1Id && context?.user2Id) {
        // Check if we have cached compatibility score
        const cacheKey = `compat_${context.user1Id}_${context.user2Id}`;
        const cached = await secureStorage.getMetricsData(cacheKey);
        
        if (cached) {
          logDebug('✅ Using cached compatibility score', "Debug");
          return true;
        }
        
        // Retry with simplified calculation
        const { error } = await supabase
          .rpc('calculate_basic_compatibility', {
            user1_id: context.user1Id,
            user2_id: context.user2Id
          });
        
        return !error;
      }
      
      return false;
    } catch (error) {
      logError('🚨 Compatibility retry failed:', "Error", error);
      return false;
    }
  }

  private async useFallbackData(
    error: StellerError,
    analytics: ErrorAnalytics
  ): Promise<boolean> {
    // Implementation would use cached or simplified data
    logDebug('🔄 Using fallback data for error:', "Debug", error.code);
    return true;
  }

  private async refreshAuthentication(
    error: StellerError,
    analytics: ErrorAnalytics
  ): Promise<boolean> {
    try {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        logError('🚨 Authentication refresh failed:', "Error", refreshError);
        return false;
      }
      logDebug('✅ Authentication refreshed successfully', "Debug");
      return true;
    } catch (refreshError) {
      logError('🚨 Authentication refresh error:', "Error", refreshError);
      return false;
    }
  }

  private async clearApplicationState(
    error: StellerError,
    analytics: ErrorAnalytics
  ): Promise<boolean> {
    try {
      // Clear relevant application state
      await AsyncStorage.multiRemove(['user_cache', 'match_cache', 'compatibility_cache']);
      logDebug('✅ Application state cleared', "Debug");
      return true;
    } catch (clearError) {
      logError('🚨 Failed to clear application state:', "Error", clearError);
      return false;
    }
  }

  private async flushErrorBuffer(): Promise<void> {
    if (this.errorBuffer.length === 0 || !this.isOnline) {
      return;
    }

    try {
      const batch = this.errorBuffer.splice(0, this.config.batchSize);
      
      // Send batch to analytics service
      await this.sendErrorBatch(batch);
      
      logDebug(`📊 Sent ${batch.length} error analytics records`, "Debug");
    } catch (error) {
      logError('🚨 Failed to flush error buffer:', "Error", error);
      // Put errors back in buffer for retry
      this.errorBuffer.unshift(...this.errorBuffer);
    }
  }

  private async sendErrorBatch(batch: ErrorAnalytics[]): Promise<void> {
    // Implementation would send to analytics service
    // For now, we'll just log the batch
    logDebug('📊 Error analytics batch:', "Debug", batch.map(e => ({
      errorCode: e.errorCode,
      severity: e.severity,
      timestamp: e.timestamp
    })));
  }

  private async sendImmediateAlert(
    error: StellerError,
    analytics: ErrorAnalytics,
    impactAssessment: ErrorImpactAssessment
  ): Promise<void> {
    // Implementation would send to monitoring/alerting system
    logDebug('🚨 CRITICAL ERROR ALERT:', "Debug", {
      error: error.code,
      impact: impactAssessment.riskLevel,
      timestamp: analytics.timestamp
    });
  }

  private showErrorReportDialog(error: StellerError): void {
    // Implementation would show a user-friendly error reporting dialog
    logDebug('📝 User error report dialog for:', "Debug", error.code);
  }

  // Utility methods
  private async getDeviceInfo(): Promise<any> {
    // Implementation would get actual device info
    return {
      platform: 'react-native',
      version: '1.0.0',
      model: 'unknown',
      networkType: 'wifi',
      batteryLevel: 85
    };
  }

  private async getAppContext(context?: Record<string, any>): Promise<any> {
    return {
      screen: context?.screen || 'unknown',
      feature: context?.feature || 'unknown',
      userAction: context?.userAction,
      dataState: context?.dataState
    };
  }

  private async getPerformanceMetrics(): Promise<any> {
    // Implementation would get actual performance metrics
    return {
      memoryUsage: 0,
      cpuUsage: 0,
      networkLatency: 0,
      renderTime: 0
    };
  }

  private determineUserImpact(error: StellerError): string {
    switch (error.severity) {
      case 'critical': return 'blocking';
      case 'high': return 'major';
      case 'medium': return 'noticeable';
      case 'low': return 'minor';
      default: return 'none';
    }
  }

  private getEstimatedRecoveryTime(error: StellerError): number {
    switch (error.recoveryStrategy) {
      case 'retry': return 5000; // 5 seconds
      case 'fallback': return 1000; // 1 second
      case 'refresh-auth': return 3000; // 3 seconds
      case 'clear-state': return 2000; // 2 seconds
      default: return 10000; // 10 seconds
    }
  }

  private estimateAffectedUsers(error: StellerError): number {
    // This would be based on actual user data and error patterns
    if (error.category === 'authentication') return 100; // All users
    if (error.category === 'network') return 25; // 25% of users
    return 10; // 10% of users by default
  }

  private calculateRiskLevel(
    immediateImpact: string,
    businessImpact: string,
    userExperienceImpact: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (immediateImpact === 'critical' || businessImpact === 'critical' || userExperienceImpact === 'blocking') {
      return 'critical';
    }
    if (immediateImpact === 'severe' || businessImpact === 'high' || userExperienceImpact === 'frustrating') {
      return 'high';
    }
    if (immediateImpact === 'moderate' || businessImpact === 'medium' || userExperienceImpact === 'noticeable') {
      return 'medium';
    }
    return 'low';
  }

  private async storeErrorForRetry(error: StellerError, context?: Record<string, any>): Promise<void> {
    try {
      const errors = await secureStorage.getMetricsData('retry_errors') || [];
      errors.push({ error, context, timestamp: new Date().toISOString() });
      
      // Keep only last 20 errors to prevent storage bloat
      const trimmedErrors = errors.slice(-20);
      await secureStorage.storeMetricsData('retry_errors', trimmedErrors);
    } catch (storageError) {
      logError('🚨 Failed to store error for retry:', "Error", storageError);
    }
  }

  /**
   * Get circuit breaker for a specific service
   */
  getCircuitBreaker(serviceName: string): FrontendCircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new FrontendCircuitBreaker(5, 60000, serviceName));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Get error state for a specific service
   */
  getErrorState(serviceKey: string): ErrorState | null {
    return this.errorStates.get(serviceKey) || null;
  }

  /**
   * Clear error state for a specific service
   */
  clearErrorState(serviceKey: string): void {
    this.errorStates.delete(serviceKey);
  }

  /**
   * Get comprehensive service health status
   */
  getServiceHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    this.circuitBreakers.forEach((breaker, serviceName) => {
      const state = breaker.getState();
      const errorState = this.errorStates.get(serviceName);
      
      status[serviceName] = {
        circuitBreaker: state,
        errorState,
        overallHealth: this.calculateOverallHealth(state, errorState)
      };
    });
    
    return status;
  }

  private calculateOverallHealth(
    circuitBreakerState: any, 
    errorState: ErrorState | undefined
  ): 'healthy' | 'degraded' | 'unhealthy' | 'offline' {
    if (circuitBreakerState.state === 'open') return 'offline';
    if (errorState?.hasError && errorState.error?.severity === 'critical') return 'unhealthy';
    if (errorState?.hasError && errorState.retryCount > 3) return 'degraded';
    return circuitBreakerState.healthStatus || 'healthy';
  }
}

export default EnhancedErrorMonitoringService;
