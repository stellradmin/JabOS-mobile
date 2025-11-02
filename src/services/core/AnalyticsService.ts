/**
 * Core Analytics Service
 * Consolidated privacy-compliant analytics with business metrics and user journey tracking
 * 
 * This service consolidates functionality from:
 * - privacy-analytics-service.ts
 * - dating-metrics-service.ts
 * - unified-monitoring-service.ts (analytics portions)
 */
import { secureStorage } from '../../utils/secure-storage';

import { secureStorage } from '../../utils/secure-storage';
import * as Crypto from 'expo-crypto';
import { logError, logWarn, logInfo, logDebug } from '../../../utils/logger';
import { trackBusinessMetric, trackUserAction } from '../../lib/sentry-enhanced';

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

// User consent management
export interface UserConsent {
  analytics: boolean;
  performance: boolean;
  marketing: boolean;
  essential: boolean;
  timestamp: string;
  version: string;
}

// Privacy-compliant event tracking
export interface AnonymousEvent {
  eventId: string;
  eventType: 'screen_view' | 'user_action' | 'feature_usage' | 'engagement';
  eventName: string;
  timestamp: string;
  sessionId: string;
  properties?: Record<string, any>;
  anonymized: boolean;
}

// Business metrics for dating app
export interface DatingMetrics {
  // User Engagement
  profileViews: number;
  profileCompletions: number;
  swipeCount: number;
  matchCount: number;
  matchRate: number;
  messagesSent: number;
  conversationStarts: number;
  averageConversationLength: number;
  
  // Feature Usage
  photoUploads: number;
  premiumFeatureUsage: number;
  filterUsage: Record<string, number>;
  discoveryModeUsage: Record<string, number>;
  
  // User Retention
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  sessionDuration: number;
  sessionsPerUser: number;
  
  // Conversion Metrics
  freeToTrialConversion: number;
  trialToPaidConversion: number;
  subscriptionChurnRate: number;
  lifetimeValue: number;
}

// User journey tracking
export interface UserJourney {
  userId?: string; // Optional for anonymous tracking
  anonymousId: string;
  journeyStages: JourneyStage[];
  currentStage: string;
  completedStages: string[];
  dropoffPoints: string[];
  totalDuration: number;
}

export interface JourneyStage {
  name: string;
  timestamp: string;
  duration: number;
  completed: boolean;
  events: AnonymousEvent[];
  metrics?: Record<string, any>;
}

// Analytics insights
export interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'milestone';
  category: 'engagement' | 'retention' | 'conversion' | 'performance';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  data: any;
  timestamp: string;
}

// Cohort analysis
export interface CohortData {
  cohortId: string;
  cohortName: string;
  size: number;
  createdAt: string;
  metrics: {
    retention: number[];
    engagement: number;
    conversion: number;
    ltv: number;
  };
}

// Analytics configuration
export interface AnalyticsConfig {
  enableAnonymousTracking: boolean;
  enableCohortAnalysis: boolean;
  enableInsights: boolean;
  requireExplicitConsent: boolean;
  dataRetentionDays: number;
  anonymizationLevel: 'basic' | 'enhanced' | 'strict';
  excludedProperties: string[];
  samplingRate: number; // 0-1
}

// ===============================================================================
// ANALYTICS SERVICE
// ===============================================================================

export class AnalyticsService {
  private static instance: AnalyticsService;
  private config: AnalyticsConfig;
  private userConsent: UserConsent | null = null;
  private anonymousId: string;
  private sessionId: string;
  private eventQueue: AnonymousEvent[] = [];
  private datingMetrics: DatingMetrics;
  private userJourneys = new Map<string, UserJourney>();
  private cohorts = new Map<string, CohortData>();
  private insights: AnalyticsInsight[] = [];
  private isInitialized = false;
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.anonymousId = this.generateAnonymousId();
    this.sessionId = this.generateSessionId();
    this.config = this.getDefaultConfig();
    this.datingMetrics = this.initializeDatingMetrics();
    this.initialize();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private generateAnonymousId(): string {
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultConfig(): AnalyticsConfig {
    return {
      enableAnonymousTracking: true,
      enableCohortAnalysis: true,
      enableInsights: true,
      requireExplicitConsent: true,
      dataRetentionDays: 90,
      anonymizationLevel: 'enhanced',
      excludedProperties: ['email', 'phone', 'name', 'birthDate', 'location'],
      samplingRate: 1.0
    };
  }

  private initializeDatingMetrics(): DatingMetrics {
    return {
      profileViews: 0,
      profileCompletions: 0,
      swipeCount: 0,
      matchCount: 0,
      matchRate: 0,
      messagesSent: 0,
      conversationStarts: 0,
      averageConversationLength: 0,
      photoUploads: 0,
      premiumFeatureUsage: 0,
      filterUsage: {},
      discoveryModeUsage: {},
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
      sessionDuration: 0,
      sessionsPerUser: 0,
      freeToTrialConversion: 0,
      trialToPaidConversion: 0,
      subscriptionChurnRate: 0,
      lifetimeValue: 0
    };
  }

  private async initialize(): Promise<void> {
    try {
      // Load user consent
      await this.loadUserConsent();
      
      // Load persisted data
      await this.loadPersistedData();
      
      // Start periodic flush
      this.flushTimer = setInterval(() => {
        this.flushEventQueue();
      }, 60000); // Every minute
      
      // Generate initial insights
      this.generateInsights();
      
      this.isInitialized = true;
      logDebug('AnalyticsService initialized');
    } catch (error) {
      logError('Failed to initialize AnalyticsService:', error);
    }
  }

  // ===============================================================================
  // PUBLIC API - CONSENT MANAGEMENT
  // ===============================================================================

  /**
   * Record user consent for analytics
   */
  async recordUserConsent(consent: Partial<UserConsent>): Promise<void> {
    this.userConsent = {
      analytics: consent.analytics ?? false,
      performance: consent.performance ?? false,
      marketing: consent.marketing ?? false,
      essential: consent.essential ?? true,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    await secureStorage.storeSecureItem('user_consent', JSON.stringify(this.userConsent));
    
    logDebug('User consent recorded:', this.userConsent);
    
    // Track consent event (always allowed as essential)
    this.trackEvent('user_action', 'consent_updated', {
      analytics: this.userConsent.analytics,
      performance: this.userConsent.performance,
      marketing: this.userConsent.marketing
    });
  }

  /**
   * Check if user has given consent for a specific type
   */
  hasConsent(type: keyof UserConsent): boolean {
    if (!this.config.requireExplicitConsent) {
      return true;
    }
    return this.userConsent?.[type] ?? false;
  }

  // ===============================================================================
  // PUBLIC API - EVENT TRACKING
  // ===============================================================================

  /**
   * Track an anonymous event with privacy compliance
   */
  trackEvent(
    eventType: AnonymousEvent['eventType'],
    eventName: string,
    properties?: Record<string, any>
  ): void {
    // Check consent
    if (!this.hasConsent('analytics') && eventType !== 'user_action') {
      return;
    }

    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    const event: AnonymousEvent = {
      eventId: this.generateEventId(),
      eventType,
      eventName,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      properties: this.anonymizeProperties(properties),
      anonymized: true
    };

    this.eventQueue.push(event);
    
    // Update user journey
    this.updateUserJourney(event);
    
    // Send to Sentry for correlation
    trackUserAction(`${eventType}:${eventName}`, event.properties);
    
    logDebug('Event tracked:', { eventType, eventName });
  }

  /**
   * Track dating app specific metrics
   */
  trackDatingMetric(
    metric: keyof DatingMetrics | string,
    value: number = 1,
    properties?: Record<string, any>
  ): void {
    // Update internal metrics
    if (metric in this.datingMetrics) {
      const key = metric as keyof DatingMetrics;
      if (typeof this.datingMetrics[key] === 'number') {
        (this.datingMetrics[key] as number) += value;
      }
    }

    // Track as business metric
    trackBusinessMetric(metric, value, properties);
    
    // Track as event
    this.trackEvent('engagement', `metric_${metric}`, {
      value,
      ...properties
    });

    // Update match rate
    if (metric === 'matchCount' || metric === 'swipeCount') {
      this.updateMatchRate();
    }
  }

  /**
   * Track user journey stage
   */
  trackJourneyStage(
    stageName: string,
    completed: boolean = false,
    metrics?: Record<string, any>
  ): void {
    const journey = this.getCurrentUserJourney();
    
    const stage: JourneyStage = {
      name: stageName,
      timestamp: new Date().toISOString(),
      duration: 0,
      completed,
      events: [],
      metrics
    };

    journey.journeyStages.push(stage);
    journey.currentStage = stageName;
    
    if (completed) {
      journey.completedStages.push(stageName);
    }

    this.trackEvent('user_action', `journey_stage_${completed ? 'completed' : 'entered'}`, {
      stage: stageName,
      ...metrics
    });
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    this.trackEvent('screen_view', screenName, properties);
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(featureName: string, properties?: Record<string, any>): void {
    this.trackEvent('feature_usage', featureName, properties);
    
    // Update feature usage metrics
    if (properties?.isPremium) {
      this.datingMetrics.premiumFeatureUsage++;
    }
  }

  // ===============================================================================
  // PUBLIC API - ANALYTICS INSIGHTS
  // ===============================================================================

  /**
   * Get current dating metrics
   */
  getDatingMetrics(): DatingMetrics {
    return { ...this.datingMetrics };
  }

  /**
   * Get user journey for current user
   */
  getUserJourney(): UserJourney | null {
    return this.getCurrentUserJourney();
  }

  /**
   * Get analytics insights
   */
  getInsights(): AnalyticsInsight[] {
    return [...this.insights];
  }

  /**
   * Get cohort data
   */
  getCohortData(cohortId?: string): CohortData | CohortData[] | null {
    if (cohortId) {
      return this.cohorts.get(cohortId) || null;
    }
    return Array.from(this.cohorts.values());
  }

  /**
   * Generate privacy-compliant analytics report
   */
  async generateAnalyticsReport(
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    metrics: DatingMetrics;
    insights: AnalyticsInsight[];
    cohorts: CohortData[];
    journeyCompletion: number;
    topEvents: Array<{ event: string; count: number }>;
  }> {
    const relevantEvents = timeRange
      ? this.eventQueue.filter(e => {
          const timestamp = new Date(e.timestamp);
          return timestamp >= timeRange.start && timestamp <= timeRange.end;
        })
      : this.eventQueue;

    const topEvents = this.calculateTopEvents(relevantEvents);
    const journeyCompletion = this.calculateJourneyCompletion();

    return {
      metrics: this.getDatingMetrics(),
      insights: this.getInsights(),
      cohorts: this.getCohortData() as CohortData[],
      journeyCompletion,
      topEvents
    };
  }

  // ===============================================================================
  // PUBLIC API - COHORT ANALYSIS
  // ===============================================================================

  /**
   * Create a new cohort
   */
  createCohort(name: string, userIds?: string[]): string {
    const cohortId = `cohort_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const cohort: CohortData = {
      cohortId,
      cohortName: name,
      size: userIds?.length || 0,
      createdAt: new Date().toISOString(),
      metrics: {
        retention: [],
        engagement: 0,
        conversion: 0,
        ltv: 0
      }
    };

    this.cohorts.set(cohortId, cohort);
    
    logDebug('Cohort created:', { cohortId, name, size: cohort.size });
    
    return cohortId;
  }

  /**
   * Update cohort metrics
   */
  updateCohortMetrics(
    cohortId: string,
    metrics: Partial<CohortData['metrics']>
  ): void {
    const cohort = this.cohorts.get(cohortId);
    if (!cohort) return;
    
    cohort.metrics = { ...cohort.metrics, ...metrics };
    
    this.trackEvent('engagement', 'cohort_metrics_updated', {
      cohortId,
      metrics
    });
  }

  // ===============================================================================
  // PRIVATE METHODS
  // ===============================================================================

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private anonymizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
    if (!properties) return undefined;
    
    const anonymized = { ...properties };
    
    // Remove excluded properties
    this.config.excludedProperties.forEach(prop => {
      delete anonymized[prop];
    });
    
    // Apply anonymization based on level
    if (this.config.anonymizationLevel === 'strict') {
      // Hash any remaining potentially identifying data
      Object.keys(anonymized).forEach(key => {
        if (typeof anonymized[key] === 'string' && anonymized[key].includes('@')) {
          anonymized[key] = this.hashValue(anonymized[key]);
        }
      });
    }
    
    return anonymized;
  }

  private hashValue(value: string): string {
    // Simple hash for demo - in production use proper hashing
    return `hash_${value.length}_${value.charCodeAt(0)}`;
  }

  private getCurrentUserJourney(): UserJourney {
    let journey = this.userJourneys.get(this.anonymousId);
    
    if (!journey) {
      journey = {
        anonymousId: this.anonymousId,
        journeyStages: [],
        currentStage: 'app_launch',
        completedStages: [],
        dropoffPoints: [],
        totalDuration: 0
      };
      this.userJourneys.set(this.anonymousId, journey);
    }
    
    return journey;
  }

  private updateUserJourney(event: AnonymousEvent): void {
    const journey = this.getCurrentUserJourney();
    
    // Add event to current stage
    const currentStage = journey.journeyStages.find(s => s.name === journey.currentStage);
    if (currentStage) {
      currentStage.events.push(event);
    }
  }

  private updateMatchRate(): void {
    if (this.datingMetrics.swipeCount > 0) {
      this.datingMetrics.matchRate = this.datingMetrics.matchCount / this.datingMetrics.swipeCount;
    }
  }

  private generateInsights(): void {
    // Generate engagement insights
    if (this.datingMetrics.matchRate < 0.05) {
      this.insights.push({
        id: this.generateInsightId(),
        type: 'recommendation',
        category: 'engagement',
        title: 'Low Match Rate Detected',
        description: 'Match rate is below 5%. Consider improving matching algorithm or user onboarding.',
        impact: 'high',
        data: { matchRate: this.datingMetrics.matchRate },
        timestamp: new Date().toISOString()
      });
    }

    // Generate retention insights
    if (this.datingMetrics.sessionDuration < 300000) { // Less than 5 minutes
      this.insights.push({
        id: this.generateInsightId(),
        type: 'anomaly',
        category: 'retention',
        title: 'Short Session Duration',
        description: 'Average session duration is below 5 minutes. Users may be experiencing issues.',
        impact: 'medium',
        data: { sessionDuration: this.datingMetrics.sessionDuration },
        timestamp: new Date().toISOString()
      });
    }

    // Keep only recent insights
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    this.insights = this.insights.filter(i => 
      new Date(i.timestamp).getTime() > cutoff
    );
  }

  private generateInsightId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTopEvents(events: AnonymousEvent[]): Array<{ event: string; count: number }> {
    const eventCounts: Record<string, number> = {};
    
    events.forEach(event => {
      const key = `${event.eventType}:${event.eventName}`;
      eventCounts[key] = (eventCounts[key] || 0) + 1;
    });
    
    return Object.entries(eventCounts)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateJourneyCompletion(): number {
    const journeys = Array.from(this.userJourneys.values());
    if (journeys.length === 0) return 0;
    
    const completionRates = journeys.map(j => {
      const expectedStages = ['app_launch', 'onboarding', 'profile_setup', 'discovery', 'matching'];
      const completed = expectedStages.filter(s => j.completedStages.includes(s)).length;
      return completed / expectedStages.length;
    });
    
    return completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
  }

  private async loadUserConsent(): Promise<void> {
    try {
      const consent = await secureStorage.getSecureItem('user_consent');
      if (consent) {
        this.userConsent = JSON.parse(consent);
      }
    } catch (error) {
      logWarn('Failed to load user consent:', error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      // Load metrics
      const metrics = await secureStorage.getSecureItem('dating_metrics');
      if (metrics) {
        this.datingMetrics = { ...this.datingMetrics, ...JSON.parse(metrics) };
      }
      
      // Load events
      const events = await secureStorage.getSecureItem('analytics_events');
      if (events) {
        this.eventQueue = JSON.parse(events);
      }
    } catch (error) {
      logWarn('Failed to load persisted analytics data:', error);
    }
  }

  private async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    try {
      // Save to persistent storage
      await secureStorage.storeSecureItem('analytics_events', JSON.stringify(this.eventQueue.slice(-1000)));
      
      // Save metrics
      await secureStorage.storeSecureItem('dating_metrics', JSON.stringify(this.datingMetrics));
      
      // In production, send to analytics backend
      logDebug(`Flushed ${this.eventQueue.length} analytics events`);
      
      // Keep only recent events in memory
      const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      this.eventQueue = this.eventQueue.filter(e => 
        new Date(e.timestamp).getTime() > cutoff
      );
      
    } catch (error) {
      logError('Failed to flush analytics queue:', error);
    }
  }

  /**
   * Update analytics configuration
   */
  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
    logDebug('Analytics configuration updated:', this.config);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushEventQueue();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const analytics = AnalyticsService.getInstance();

// Convenience functions
export const recordConsent = (consent: Partial<UserConsent>) =>
  analytics.recordUserConsent(consent);

export const trackEvent = (
  eventType: AnonymousEvent['eventType'],
  eventName: string,
  properties?: Record<string, any>
) => analytics.trackEvent(eventType, eventName, properties);

export const trackDatingMetric = (
  metric: keyof DatingMetrics | string,
  value?: number,
  properties?: Record<string, any>
) => analytics.trackDatingMetric(metric, value, properties);

export const trackScreenView = (screenName: string, properties?: Record<string, any>) =>
  analytics.trackScreenView(screenName, properties);

export const trackFeatureUsage = (featureName: string, properties?: Record<string, any>) =>
  analytics.trackFeatureUsage(featureName, properties);

export const trackJourneyStage = (stageName: string, completed?: boolean, metrics?: Record<string, any>) =>
  analytics.trackJourneyStage(stageName, completed, metrics);

export const getDatingMetrics = () => analytics.getDatingMetrics();

export const getAnalyticsReport = (timeRange?: { start: Date; end: Date }) =>
  analytics.generateAnalyticsReport(timeRange);