/**
 * Error Analytics Service
 * Enhanced error reporting with business impact assessment and comprehensive analytics
 * Follows the Single Responsibility Principle for error analytics and reporting
 */
import { StellerError, ErrorCategory, ErrorSeverity } from '../types/error-types';
import { trackError, trackCriticalError, trackBusinessMetric } from '../lib/sentry-enhanced';
import { secureStorage } from '../utils/secure-storage';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Business impact levels
export type BusinessImpact = 'none' | 'low' | 'medium' | 'high' | 'critical';

// Error analytics data
interface ErrorAnalytics {
  errorId: string;
  sessionId: string;
  userId?: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  businessImpact: BusinessImpact;
  userJourneyStage: UserJourneyStage;
  featureContext: FeatureContext;
  performanceMetrics: PerformanceMetrics;
  recoveryMetrics: RecoveryMetrics;
  userExperienceMetrics: UserExperienceMetrics;
  technicalContext: TechnicalContext;
}

// User journey stages in the dating app
export type UserJourneyStage = 
  | 'app-launch'
  | 'authentication'
  | 'onboarding'
  | 'profile-setup'
  | 'discovery'
  | 'matching'
  | 'messaging'
  | 'date-planning'
  | 'subscription'
  | 'settings';

// Feature-specific context
interface FeatureContext {
  feature: string;
  subFeature?: string;
  action?: string;
  screenName?: string;
  componentName?: string;
  isFirstTime?: boolean;
  isPremiumFeature?: boolean;
}

// Performance impact metrics
interface PerformanceMetrics {
  errorOccurredAt: number; // timestamp
  renderTime?: number;
  memoryUsage?: number;
  networkLatency?: number;
  batteryImpact?: 'low' | 'medium' | 'high';
  cpuImpact?: 'low' | 'medium' | 'high';
}

// Recovery attempt metrics
interface RecoveryMetrics {
  recoveryAttempted: boolean;
  recoveryStrategy?: string;
  recoveryTimeMs?: number;
  recoverySuccess: boolean;
  fallbackUsed: boolean;
  userInterventionRequired: boolean;
}

// User experience impact metrics
interface UserExperienceMetrics {
  userFrustrationLevel: 'none' | 'low' | 'medium' | 'high';
  featureAccessibility: 'full' | 'partial' | 'blocked';
  dataLossRisk: 'none' | 'low' | 'medium' | 'high';
  workflowInterruption: boolean;
  alternativeFlowAvailable: boolean;
}

// Technical context
interface TechnicalContext {
  deviceInfo: DeviceInfo;
  appState: AppStateInfo;
  networkInfo: NetworkInfo;
  previousErrors?: string[];
  stackTrace?: string;
  componentStack?: string;
}

interface DeviceInfo {
  platform: 'ios' | 'android';
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  buildNumber: string;
  memoryTotal?: number;
  memoryAvailable?: number;
  storageAvailable?: number;
}

interface AppStateInfo {
  currentScreen: string;
  navigationHistory: string[];
  userSessionDuration: number;
  backgroundTime?: number;
  isFirstSession: boolean;
  subscriptionStatus?: 'free' | 'premium' | 'trial';
}

interface NetworkInfo {
  connectionType: string;
  isConnected: boolean;
  strength: 'poor' | 'moderate' | 'excellent';
  latency?: number;
}

// Business metrics tracking
interface BusinessMetrics {
  userRetention: {
    riskLevel: 'low' | 'medium' | 'high';
    likelyChurnReason?: string;
  };
  revenueImpact: {
    estimatedLoss?: number;
    subscriptionRisk: boolean;
    featureUsageImpact: number; // 0-1 scale
  };
  matchingEfficiency: {
    impactedMatches: number;
    successRateImpact: number; // percentage impact
  };
  userEngagement: {
    sessionImpact: 'none' | 'minor' | 'major' | 'session-ending';
    featureAdoption: number; // 0-1 scale impact
  };
}

// Aggregated analytics data
interface ErrorAnalyticsSummary {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByJourneyStage: Record<UserJourneyStage, number>;
  errorsByBusinessImpact: Record<BusinessImpact, number>;
  averageRecoveryTime: number;
  recoverySuccessRate: number;
  topErrorPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: BusinessImpact;
  }>;
  userImpactMetrics: {
    usersAffected: number;
    sessionsImpacted: number;
    averageFrustrationLevel: number;
  };
  performanceImpact: {
    averageRenderDelay: number;
    memoryImpact: number;
    batteryImpact: number;
  };
}

class ErrorAnalyticsService {
  private static instance: ErrorAnalyticsService;
  private analyticsQueue: ErrorAnalytics[] = [];
  private sessionStartTime = Date.now();
  private currentSessionId = this.generateSessionId();

  private constructor() {
    this.initializeAnalytics();
  }

  static getInstance(): ErrorAnalyticsService {
    if (!ErrorAnalyticsService.instance) {
      ErrorAnalyticsService.instance = new ErrorAnalyticsService();
    }
    return ErrorAnalyticsService.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initializeAnalytics(): Promise<void> {
    try {
      // Load any persisted analytics data
      await this.loadAnalyticsQueue();
      
      // Start periodic reporting
      this.startPeriodicReporting();
      
    } catch (error) {
      logWarn('Failed to initialize error analytics:', "Warning", error);
    }
  }

  /**
   * Main method for tracking errors with comprehensive analytics
   */
  async trackErrorWithAnalytics(
    error: StellerError,
    context: {
      userId?: string;
      userJourneyStage: UserJourneyStage;
      featureContext: FeatureContext;
      technicalContext?: Partial<TechnicalContext>;
      customMetrics?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Calculate business impact
      const businessImpact = this.calculateBusinessImpact(error, context.userJourneyStage, context.featureContext);
      
      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(error);
      
      // Calculate user experience impact
      const userExperienceMetrics = this.calculateUserExperienceMetrics(error, context.featureContext);
      
      // Build complete analytics record
      const analytics: ErrorAnalytics = {
        errorId: error.id,
        sessionId: this.currentSessionId,
        userId: context.userId,
        timestamp: new Date(),
        category: error.category,
        severity: error.severity,
        businessImpact,
        userJourneyStage: context.userJourneyStage,
        featureContext: context.featureContext,
        performanceMetrics,
        recoveryMetrics: {
          recoveryAttempted: false,
          recoverySuccess: false,
          fallbackUsed: false,
          userInterventionRequired: false,
        },
        userExperienceMetrics,
        technicalContext: await this.buildTechnicalContext(context.technicalContext),
      };

      // Add to queue for processing
      this.analyticsQueue.push(analytics);
      
      // Track business metrics
      await this.trackBusinessMetrics(analytics);
      
      // Send to monitoring services
      await this.sendToMonitoringServices(analytics);
      
      // Persist queue
      await this.saveAnalyticsQueue();
      
    } catch (analyticsError) {
      logError('Failed to track error analytics:', "Error", analyticsError);
      // Still track the original error even if analytics fail
      trackError(new Error(error.message), { error_id: error.id });
    }
  }

  /**
   * Track recovery attempt and update analytics
   */
  async trackRecoveryAttempt(
    errorId: string,
    recoveryStrategy: string,
    startTime: number
  ): Promise<void> {
    const analytics = this.analyticsQueue.find(a => a.errorId === errorId);
    if (!analytics) return;

    const recoveryTime = Date.now() - startTime;
    
    analytics.recoveryMetrics = {
      ...analytics.recoveryMetrics,
      recoveryAttempted: true,
      recoveryStrategy,
      recoveryTimeMs: recoveryTime,
    };

    await this.saveAnalyticsQueue();
  }

  /**
   * Track recovery completion
   */
  async trackRecoveryCompletion(
    errorId: string,
    success: boolean,
    fallbackUsed: boolean = false
  ): Promise<void> {
    const analytics = this.analyticsQueue.find(a => a.errorId === errorId);
    if (!analytics) return;

    analytics.recoveryMetrics = {
      ...analytics.recoveryMetrics,
      recoverySuccess: success,
      fallbackUsed,
      userInterventionRequired: !success && !fallbackUsed,
    };

    // Update business impact if recovery was successful
    if (success && analytics.businessImpact !== 'none') {
      analytics.businessImpact = this.reduceBusinessImpact(analytics.businessImpact);
    }

    await this.saveAnalyticsQueue();
  }

  /**
   * Calculate business impact of error
   */
  private calculateBusinessImpact(
    error: StellerError,
    journeyStage: UserJourneyStage,
    featureContext: FeatureContext
  ): BusinessImpact {
    // High impact scenarios
    if (error.severity === 'critical') {
      return 'critical';
    }

    // Journey stage impact
    const highImpactStages: UserJourneyStage[] = [
      'authentication',
      'matching',
      'messaging',
      'subscription'
    ];

    const mediumImpactStages: UserJourneyStage[] = [
      'onboarding',
      'profile-setup',
      'discovery',
      'date-planning'
    ];

    if (highImpactStages.includes(journeyStage)) {
      if (error.severity === 'high') return 'high';
      if (error.severity === 'medium') return 'medium';
      return 'low';
    }

    if (mediumImpactStages.includes(journeyStage)) {
      if (error.severity === 'high') return 'medium';
      return 'low';
    }

    // Category-specific impact
    const highImpactCategories: ErrorCategory[] = [
      'matching-system',
      'authentication',
      'database'
    ];

    if (highImpactCategories.includes(error.category)) {
      return error.severity === 'high' ? 'high' : 'medium';
    }

    // Premium feature impact
    if (featureContext.isPremiumFeature) {
      return error.severity === 'high' ? 'medium' : 'low';
    }

    return error.severity === 'high' ? 'low' : 'none';
  }

  /**
   * Calculate performance impact metrics
   */
  private async calculatePerformanceMetrics(error: StellerError): Promise<PerformanceMetrics> {
    // This would integrate with performance monitoring tools
    return {
      errorOccurredAt: Date.now(),
      renderTime: this.estimateRenderImpact(error),
      memoryUsage: await this.getCurrentMemoryUsage(),
      networkLatency: await this.measureNetworkLatency(),
      batteryImpact: this.estimateBatteryImpact(error),
      cpuImpact: this.estimateCPUImpact(error),
    };
  }

  /**
   * Calculate user experience impact
   */
  private calculateUserExperienceMetrics(
    error: StellerError,
    featureContext: FeatureContext
  ): UserExperienceMetrics {
    const frustrationMap: Record<ErrorSeverity, UserExperienceMetrics['userFrustrationLevel']> = {
      low: 'none',
      medium: 'low',
      high: 'medium',
      critical: 'high',
    };

    const accessibilityMap: Record<ErrorCategory, UserExperienceMetrics['featureAccessibility']> = {
      'matching-system': 'blocked',
      'authentication': 'blocked',
      'network': 'partial',
      'validation': 'partial',
      'animation': 'full',
      'user-interaction': 'partial',
      'data-parsing': 'partial',
      'file-upload': 'partial',
      'location-services': 'partial',
      'performance': 'partial',
      'external-service': 'partial',
      'database': 'blocked',
      'rate-limiting': 'partial',
      'authorization': 'blocked',
      'compatibility-calculation': 'partial',
      'unknown': 'partial',
    };

    return {
      userFrustrationLevel: frustrationMap[error.severity],
      featureAccessibility: accessibilityMap[error.category],
      dataLossRisk: this.assessDataLossRisk(error, featureContext),
      workflowInterruption: this.assessWorkflowInterruption(error, featureContext),
      alternativeFlowAvailable: this.checkAlternativeFlows(error, featureContext),
    };
  }

  /**
   * Build comprehensive technical context
   */
  private async buildTechnicalContext(
    partialContext?: Partial<TechnicalContext>
  ): Promise<TechnicalContext> {
    const deviceInfo = await this.getDeviceInfo();
    const appState = await this.getAppStateInfo();
    const networkInfo = await this.getNetworkInfo();

    return {
      deviceInfo,
      appState,
      networkInfo,
      ...partialContext,
    };
  }

  /**
   * Track business-specific metrics
   */
  private async trackBusinessMetrics(analytics: ErrorAnalytics): Promise<void> {
    const businessMetrics = this.calculateBusinessMetrics(analytics);

    // Track user retention risk
    if (businessMetrics.userRetention.riskLevel !== 'low') {
      trackBusinessMetric('user_churn_risk', this.getChurnRiskScore(businessMetrics.userRetention.riskLevel), {
        error_category: analytics.category,
        journey_stage: analytics.userJourneyStage,
        session_id: analytics.sessionId,
      });
    }

    // Track revenue impact
    if (businessMetrics.revenueImpact.subscriptionRisk) {
      trackBusinessMetric('subscription_risk', 1, {
        error_category: analytics.category,
        estimated_loss: businessMetrics.revenueImpact.estimatedLoss,
        feature_context: analytics.featureContext.feature,
      });
    }

    // Track matching system efficiency
    if (analytics.category === 'matching-system') {
      trackBusinessMetric('matching_efficiency_impact', businessMetrics.matchingEfficiency.successRateImpact, {
        impacted_matches: businessMetrics.matchingEfficiency.impactedMatches,
        business_impact: analytics.businessImpact,
      });
    }

    // Track user engagement impact
    if (businessMetrics.userEngagement.sessionImpact !== 'none') {
      trackBusinessMetric('user_engagement_impact', this.getEngagementImpactScore(businessMetrics.userEngagement.sessionImpact), {
        session_impact: businessMetrics.userEngagement.sessionImpact,
        feature_adoption_impact: businessMetrics.userEngagement.featureAdoption,
      });
    }
  }

  /**
   * Calculate comprehensive business metrics
   */
  private calculateBusinessMetrics(analytics: ErrorAnalytics): BusinessMetrics {
    return {
      userRetention: this.calculateUserRetentionImpact(analytics),
      revenueImpact: this.calculateRevenueImpact(analytics),
      matchingEfficiency: this.calculateMatchingEfficiencyImpact(analytics),
      userEngagement: this.calculateUserEngagementImpact(analytics),
    };
  }

  /**
   * Send analytics to external monitoring services
   */
  private async sendToMonitoringServices(analytics: ErrorAnalytics): Promise<void> {
    try {
      // Send to Sentry with business context
      const sentryContext = {
        business_impact: analytics.businessImpact,
        journey_stage: analytics.userJourneyStage,
        feature_context: analytics.featureContext,
        performance_metrics: analytics.performanceMetrics,
        user_experience: analytics.userExperienceMetrics,
        session_id: analytics.sessionId,
        error_analytics_id: analytics.errorId,
      };

      if (analytics.businessImpact === 'critical' || analytics.severity === 'critical') {
        trackCriticalError(new Error(`Business Critical Error: ${analytics.category}`), sentryContext);
      } else {
        trackError(new Error(`Error Analytics: ${analytics.category}`), sentryContext);
      }

      // Could also send to other analytics platforms
      // await this.sendToCustomAnalytics(analytics);
      
    } catch (error) {
      logWarn('Failed to send analytics to monitoring services:', "Warning", error);
    }
  }

  /**
   * Generate analytics summary for reporting
   */
  async getAnalyticsSummary(
    timeRange?: { start: Date; end: Date }
  ): Promise<ErrorAnalyticsSummary> {
    const analyticsData = timeRange 
      ? this.analyticsQueue.filter(a => 
          a.timestamp >= timeRange.start && a.timestamp <= timeRange.end
        )
      : this.analyticsQueue;

    return {
      totalErrors: analyticsData.length,
      errorsByCategory: this.groupByCategory(analyticsData),
      errorsBySeverity: this.groupBySeverity(analyticsData),
      errorsByJourneyStage: this.groupByJourneyStage(analyticsData),
      errorsByBusinessImpact: this.groupByBusinessImpact(analyticsData),
      averageRecoveryTime: this.calculateAverageRecoveryTime(analyticsData),
      recoverySuccessRate: this.calculateRecoverySuccessRate(analyticsData),
      topErrorPatterns: this.identifyErrorPatterns(analyticsData),
      userImpactMetrics: this.calculateUserImpactMetrics(analyticsData),
      performanceImpact: this.calculatePerformanceImpactSummary(analyticsData),
    };
  }

  // Helper methods for calculations and data processing
  private estimateRenderImpact(error: StellerError): number {
    // Estimate render time impact based on error type
    const impactMap: Record<ErrorCategory, number> = {
      'animation': 500,
      'user-interaction': 200,
      'network': 100,
      'data-parsing': 150,
      'matching-system': 300,
      'compatibility-calculation': 400,
      'file-upload': 100,
      'location-services': 100,
      'performance': 1000,
      'external-service': 200,
      'database': 500,
      'rate-limiting': 50,
      'authentication': 200,
      'authorization': 100,
      'validation': 50,
      'unknown': 100,
    };
    return impactMap[error.category] || 100;
  }

  private async getCurrentMemoryUsage(): Promise<number> {
    // This would use a memory monitoring library
    // For now, return a placeholder
    return Math.random() * 100; // MB
  }

  private async measureNetworkLatency(): Promise<number> {
    try {
      const start = Date.now();
      await fetch('https://httpbin.org/status/200', { method: 'HEAD' });
      return Date.now() - start;
    } catch {
      return -1; // Unable to measure
    }
  }

  private estimateBatteryImpact(error: StellerError): 'low' | 'medium' | 'high' {
    if (error.category === 'performance' || error.category === 'location-services') {
      return 'high';
    }
    if (error.category === 'network' || error.category === 'external-service') {
      return 'medium';
    }
    return 'low';
  }

  private estimateCPUImpact(error: StellerError): 'low' | 'medium' | 'high' {
    if (error.category === 'compatibility-calculation' || error.category === 'animation') {
      return 'high';
    }
    if (error.category === 'data-parsing' || error.category === 'matching-system') {
      return 'medium';
    }
    return 'low';
  }

  private assessDataLossRisk(error: StellerError, featureContext: FeatureContext): UserExperienceMetrics['dataLossRisk'] {
    if (error.category === 'database' || error.category === 'file-upload') {
      return 'high';
    }
    if (featureContext.feature === 'messaging' || featureContext.feature === 'profile-setup') {
      return 'medium';
    }
    return 'low';
  }

  private assessWorkflowInterruption(error: StellerError, featureContext: FeatureContext): boolean {
    const interruptiveCategories: ErrorCategory[] = [
      'authentication',
      'matching-system',
      'database',
      'network'
    ];
    return interruptiveCategories.includes(error.category);
  }

  private checkAlternativeFlows(error: StellerError, featureContext: FeatureContext): boolean {
    // Most features have some alternative flow except critical system errors
    return !(error.category === 'authentication' || error.category === 'database');
  }

  private reduceBusinessImpact(currentImpact: BusinessImpact): BusinessImpact {
    const reductionMap: Record<BusinessImpact, BusinessImpact> = {
      critical: 'high',
      high: 'medium',
      medium: 'low',
      low: 'none',
      none: 'none',
    };
    return reductionMap[currentImpact];
  }

  // Analytics aggregation methods
  private groupByCategory(analytics: ErrorAnalytics[]): Record<ErrorCategory, number> {
    return analytics.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);
  }

  private groupBySeverity(analytics: ErrorAnalytics[]): Record<ErrorSeverity, number> {
    return analytics.reduce((acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
  }

  private groupByJourneyStage(analytics: ErrorAnalytics[]): Record<UserJourneyStage, number> {
    return analytics.reduce((acc, a) => {
      acc[a.userJourneyStage] = (acc[a.userJourneyStage] || 0) + 1;
      return acc;
    }, {} as Record<UserJourneyStage, number>);
  }

  private groupByBusinessImpact(analytics: ErrorAnalytics[]): Record<BusinessImpact, number> {
    return analytics.reduce((acc, a) => {
      acc[a.businessImpact] = (acc[a.businessImpact] || 0) + 1;
      return acc;
    }, {} as Record<BusinessImpact, number>);
  }

  private calculateUserRetentionImpact(analytics: ErrorAnalytics) {
    // Implementation for user retention impact calculation
    return {
      riskLevel: 'medium' as const,
      likelyChurnReason: `Error in ${analytics.userJourneyStage}`,
    };
  }

  private calculateRevenueImpact(analytics: ErrorAnalytics) {
    // Implementation for revenue impact calculation
    return {
      estimatedLoss: analytics.businessImpact === 'high' ? 100 : 0,
      subscriptionRisk: analytics.userJourneyStage === 'subscription',
      featureUsageImpact: analytics.businessImpact === 'high' ? 0.5 : 0.1,
    };
  }

  private calculateMatchingEfficiencyImpact(analytics: ErrorAnalytics) {
    return {
      impactedMatches: analytics.category === 'matching-system' ? 10 : 0,
      successRateImpact: analytics.businessImpact === 'high' ? 20 : 5,
    };
  }

  private calculateUserEngagementImpact(analytics: ErrorAnalytics) {
    return {
      sessionImpact: analytics.severity === 'critical' ? 'session-ending' as const : 'minor' as const,
      featureAdoption: 0.1,
    };
  }

  private getChurnRiskScore(riskLevel: string): number {
    const scoreMap: Record<string, number> = { low: 0.1, medium: 0.5, high: 0.9 };
    return scoreMap[riskLevel] || 0.1;
  }

  private getEngagementImpactScore(impact: string): number {
    const scoreMap: Record<string, number> = { 
      none: 0, minor: 0.2, major: 0.7, 'session-ending': 1.0 
    };
    return scoreMap[impact] || 0;
  }

  private calculateAverageRecoveryTime(analytics: ErrorAnalytics[]): number {
    const withRecovery = analytics.filter(a => a.recoveryMetrics.recoveryTimeMs);
    if (withRecovery.length === 0) return 0;
    
    const total = withRecovery.reduce((sum, a) => sum + (a.recoveryMetrics.recoveryTimeMs || 0), 0);
    return total / withRecovery.length;
  }

  private calculateRecoverySuccessRate(analytics: ErrorAnalytics[]): number {
    const attempted = analytics.filter(a => a.recoveryMetrics.recoveryAttempted);
    if (attempted.length === 0) return 0;
    
    const successful = attempted.filter(a => a.recoveryMetrics.recoverySuccess);
    return successful.length / attempted.length;
  }

  private identifyErrorPatterns(analytics: ErrorAnalytics[]) {
    // Simplified pattern identification
    const patterns = analytics.reduce((acc, a) => {
      const pattern = `${a.category}-${a.userJourneyStage}`;
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(patterns)
      .map(([pattern, frequency]) => ({
        pattern,
        frequency,
        impact: 'medium' as BusinessImpact,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private calculateUserImpactMetrics(analytics: ErrorAnalytics[]) {
    const uniqueUsers = new Set(analytics.filter(a => a.userId).map(a => a.userId));
    const uniqueSessions = new Set(analytics.map(a => a.sessionId));
    
    const frustrationLevels = analytics.map(a => {
      const levelMap = { none: 0, low: 1, medium: 2, high: 3 };
      return levelMap[a.userExperienceMetrics.userFrustrationLevel];
    });
    
    const avgFrustration = frustrationLevels.length > 0 
      ? frustrationLevels.reduce((a, b) => a + b, 0) / frustrationLevels.length 
      : 0;

    return {
      usersAffected: uniqueUsers.size,
      sessionsImpacted: uniqueSessions.size,
      averageFrustrationLevel: avgFrustration,
    };
  }

  private calculatePerformanceImpactSummary(analytics: ErrorAnalytics[]) {
    const renderTimes = analytics.map(a => a.performanceMetrics.renderTime || 0);
    const memoryUsage = analytics.map(a => a.performanceMetrics.memoryUsage || 0);
    
    return {
      averageRenderDelay: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      memoryImpact: memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length,
      batteryImpact: analytics.filter(a => a.performanceMetrics.batteryImpact === 'high').length / analytics.length,
    };
  }

  private async getDeviceInfo(): Promise<DeviceInfo> {
    // This would use device info libraries
    return {
      platform: 'ios',
      osVersion: '17.0',
      deviceModel: 'iPhone 15',
      appVersion: '1.0.0',
      buildNumber: '100',
    };
  }

  private async getAppStateInfo(): Promise<AppStateInfo> {
    return {
      currentScreen: 'current_screen',
      navigationHistory: ['home', 'discover', 'matches'],
      userSessionDuration: Date.now() - this.sessionStartTime,
      isFirstSession: false,
      subscriptionStatus: 'free',
    };
  }

  private async getNetworkInfo(): Promise<NetworkInfo> {
    return {
      connectionType: 'wifi',
      isConnected: true,
      strength: 'excellent',
      latency: 50,
    };
  }

  private startPeriodicReporting(): void {
    // Send analytics data periodically (every 5 minutes)
    setInterval(async () => {
      if (this.analyticsQueue.length > 0) {
        await this.flushAnalytics();
      }
    }, 5 * 60 * 1000);
  }

  private async flushAnalytics(): Promise<void> {
    // Implementation for sending batched analytics data
    logDebug(`Flushing ${this.analyticsQueue.length} analytics records`, "Debug");
    // Would send to analytics service here
  }

  private async saveAnalyticsQueue(): Promise<void> {
    try {
      const data = JSON.stringify(this.analyticsQueue.slice(-100)); // Keep last 100 records
      await secureStorage.storeSecureItem('error_analytics_queue', data);
    } catch (error) {
      logWarn('Failed to save analytics queue:', "Warning", error);
    }
  }

  private async loadAnalyticsQueue(): Promise<void> {
    try {
      const data = await secureStorage.getSecureItem('error_analytics_queue');
      if (data) {
        this.analyticsQueue = JSON.parse(data);
      }
    } catch (error) {
      logWarn('Failed to load analytics queue:', "Warning", error);
    }
  }
}

export default ErrorAnalyticsService;
export { 
  ErrorAnalytics, 
  BusinessImpact, 
  UserJourneyStage, 
  FeatureContext,
  ErrorAnalyticsSummary,
  BusinessMetrics 
};
