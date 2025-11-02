/**
 * Core Services Export
 * Unified interface for all monitoring and analytics services
 */

// Import core services
import { 
  errorMonitoring,
  trackError,
  getCircuitBreaker,
  getErrorState,
  clearErrorState,
  getErrorMetrics,
  type StellerError,
  type ErrorSeverity,
  type ErrorCategory,
  type ErrorState,
  type ErrorMetrics,
  type ErrorRecoveryOptions,
  CircuitBreaker
} from './ErrorMonitoringService';

import {
  performanceMonitoring,
  trackAppStart,
  trackScreenLoad,
  trackScreenTransition,
  trackAPICall,
  trackFrameDrops,
  trackImageLoad,
  getPerformanceMetrics,
  getPerformanceSummary,
  type PerformanceMetrics,
  type PerformanceThresholds,
  type PerformanceAlert,
  type PerformanceSummary,
  type PerformanceContext
} from './PerformanceMonitoringService';

import {
  analytics,
  recordConsent,
  trackEvent,
  trackDatingMetric,
  trackScreenView,
  trackFeatureUsage,
  trackJourneyStage,
  getDatingMetrics,
  getAnalyticsReport,
  type UserConsent,
  type AnonymousEvent,
  type DatingMetrics,
  type UserJourney,
  type JourneyStage,
  type AnalyticsInsight,
  type CohortData,
  type AnalyticsConfig
} from './AnalyticsService';

// ===============================================================================
// UNIFIED MONITORING SERVICE
// ===============================================================================

/**
 * Unified Monitoring Service
 * Single interface for all monitoring needs
 */
class UnifiedMonitoringService {
  private static instance: UnifiedMonitoringService;
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): UnifiedMonitoringService {
    if (!UnifiedMonitoringService.instance) {
      UnifiedMonitoringService.instance = new UnifiedMonitoringService();
    }
    return UnifiedMonitoringService.instance;
  }

  private async initialize(): Promise<void> {
    // Services are self-initializing through their singletons
    this.isInitialized = true;
  }

  // ===============================================================================
  // ERROR MONITORING
  // ===============================================================================

  /**
   * Track an error with recovery options
   */
  async trackError(
    error: Error | any,
    context?: Record<string, any>,
    options?: ErrorRecoveryOptions
  ): Promise<void> {
    return errorMonitoring.trackError(error, context, options);
  }

  /**
   * Get error metrics for reporting
   */
  async getErrorMetrics(timeRange?: { start: Date; end: Date }): Promise<ErrorMetrics> {
    return errorMonitoring.getErrorMetrics(timeRange);
  }

  /**
   * Get circuit breaker for service resilience
   */
  getCircuitBreaker(serviceName: string): CircuitBreaker {
    return errorMonitoring.getCircuitBreaker(serviceName);
  }

  // ===============================================================================
  // PERFORMANCE MONITORING
  // ===============================================================================

  /**
   * Track screen performance
   */
  trackScreenPerformance(screenName: string, loadTime: number): void {
    performanceMonitoring.trackScreenLoad(screenName, loadTime);
    analytics.trackScreenView(screenName, { loadTime });
  }

  /**
   * Track API performance
   */
  trackAPIPerformance(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    error?: Error
  ): void {
    performanceMonitoring.trackAPICall(endpoint, method, duration, status, error);
    
    if (error) {
      errorMonitoring.trackError(error, { endpoint, method, status });
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(
    period?: { start: Date; end: Date }
  ): Promise<PerformanceSummary> {
    return performanceMonitoring.getPerformanceSummary(period);
  }

  // ===============================================================================
  // ANALYTICS
  // ===============================================================================

  /**
   * Track user action with privacy compliance
   */
  trackUserAction(action: string, properties?: Record<string, any>): void {
    analytics.trackEvent('user_action', action, properties);
  }

  /**
   * Track dating app metrics
   */
  trackDatingMetric(
    metric: string,
    value: number = 1,
    properties?: Record<string, any>
  ): void {
    analytics.trackDatingMetric(metric, value, properties);
  }

  /**
   * Track user journey progress
   */
  trackUserJourney(stage: string, completed: boolean = false): void {
    analytics.trackJourneyStage(stage, completed);
  }

  /**
   * Get comprehensive analytics report
   */
  async getAnalyticsReport(timeRange?: { start: Date; end: Date }) {
    return analytics.generateAnalyticsReport(timeRange);
  }

  // ===============================================================================
  // CONSENT MANAGEMENT
  // ===============================================================================

  /**
   * Record user consent for analytics
   */
  async recordUserConsent(consent: Partial<UserConsent>): Promise<void> {
    return analytics.recordUserConsent(consent);
  }

  /**
   * Check if user has given consent
   */
  hasConsent(type: keyof UserConsent): boolean {
    return analytics.hasConsent(type);
  }

  // ===============================================================================
  // UNIFIED DASHBOARD
  // ===============================================================================

  /**
   * Get unified monitoring dashboard
   */
  async getUnifiedDashboard() {
    const [errorMetrics, performanceSummary, analyticsReport] = await Promise.all([
      this.getErrorMetrics(),
      this.getPerformanceSummary(),
      this.getAnalyticsReport()
    ]);

    return {
      timestamp: new Date().toISOString(),
      health: this.calculateSystemHealth(errorMetrics, performanceSummary),
      errors: errorMetrics,
      performance: performanceSummary,
      analytics: analyticsReport,
      recommendations: this.generateRecommendations(errorMetrics, performanceSummary, analyticsReport)
    };
  }

  private calculateSystemHealth(
    errors: ErrorMetrics,
    performance: PerformanceSummary
  ): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    if (errors.userImpact === 'severe' || performance.healthScore < 50) {
      return 'critical';
    }
    if (errors.userImpact === 'moderate' || performance.healthScore < 70) {
      return 'unhealthy';
    }
    if (errors.userImpact === 'minimal' || performance.healthScore < 85) {
      return 'degraded';
    }
    return 'healthy';
  }

  private generateRecommendations(
    errors: ErrorMetrics,
    performance: PerformanceSummary,
    analytics: any
  ): string[] {
    const recommendations: string[] = [];

    // Error recommendations
    if (errors.totalErrors > 100) {
      recommendations.push('High error rate detected - investigate error patterns and implement fixes');
    }
    if (errors.recoverySuccessRate < 0.5) {
      recommendations.push('Low error recovery rate - improve error handling and recovery mechanisms');
    }

    // Performance recommendations
    recommendations.push(...performance.recommendations);

    // Analytics recommendations
    if (analytics.metrics.matchRate < 0.05) {
      recommendations.push('Low match rate - consider improving matching algorithm');
    }
    if (analytics.journeyCompletion < 0.3) {
      recommendations.push('Low journey completion - optimize onboarding flow');
    }

    return recommendations;
  }

  /**
   * Cleanup all services
   */
  destroy(): void {
    errorMonitoring.destroy();
    performanceMonitoring.destroy();
    analytics.destroy();
    this.isInitialized = false;
  }
}

// ===============================================================================
// EXPORTS
// ===============================================================================

// Export singleton instance
export const monitoring = UnifiedMonitoringService.getInstance();

// Export all services
export {
  // Error Monitoring
  errorMonitoring,
  trackError,
  getCircuitBreaker,
  getErrorState,
  clearErrorState,
  getErrorMetrics,
  
  // Performance Monitoring
  performanceMonitoring,
  trackAppStart,
  trackScreenLoad,
  trackScreenTransition,
  trackAPICall,
  trackFrameDrops,
  trackImageLoad,
  getPerformanceMetrics,
  getPerformanceSummary,
  
  // Analytics
  analytics,
  recordConsent,
  trackEvent,
  trackDatingMetric,
  trackScreenView,
  trackFeatureUsage,
  trackJourneyStage,
  getDatingMetrics,
  getAnalyticsReport
};

// Export types
export type {
  // Error types
  StellerError,
  ErrorSeverity,
  ErrorCategory,
  ErrorState,
  ErrorMetrics,
  ErrorRecoveryOptions,
  
  // Performance types
  PerformanceMetrics,
  PerformanceThresholds,
  PerformanceAlert,
  PerformanceSummary,
  PerformanceContext,
  
  // Analytics types
  UserConsent,
  AnonymousEvent,
  DatingMetrics,
  UserJourney,
  JourneyStage,
  AnalyticsInsight,
  CohortData,
  AnalyticsConfig
};

// Export CircuitBreaker class
export { CircuitBreaker };

// Default export
export default monitoring;