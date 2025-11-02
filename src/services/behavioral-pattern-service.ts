/**
 * Behavioral Pattern Analysis Service
 * 
 * Analyzes user interactions and behaviors to identify patterns for improved matching
 * Following all 10 Golden Code Principles with privacy-first design
 * 
 * Features:
 * - Real-time behavior tracking
 * - Pattern recognition algorithms
 * - Privacy-preserving analytics
 * - Behavioral compatibility assessment
 * - Dynamic pattern evolution
 */

import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  createStellerError,
  createAnalyticsError,
  convertToStellerError
} from '../utils/error-factory';
import { StellerError, ErrorHandlingOptions } from '../types/error-types';
import {
  BehavioralPattern,
  CommunicationPattern,
  EngagementPattern,
  DecisionMakingPattern,
  ConflictPattern,
  IntimacyPacePattern,
  FeatureUsage
} from './ml-compatibility-service';

// ============= BEHAVIOR TRACKING TYPES =============

export interface BehaviorEvent {
  userId: string;
  eventType: BehaviorEventType;
  eventData: any;
  timestamp: Date;
  sessionId: string;
  context?: BehaviorContext;
}

export type BehaviorEventType = 
  | 'message_sent'
  | 'message_received'
  | 'profile_viewed'
  | 'photo_liked'
  | 'swipe_left'
  | 'swipe_right'
  | 'match_accepted'
  | 'match_declined'
  | 'conversation_started'
  | 'conversation_ended'
  | 'question_asked'
  | 'question_answered'
  | 'game_played'
  | 'app_opened'
  | 'app_closed'
  | 'feature_used'
  | 'search_performed'
  | 'filter_changed'
  | 'notification_opened';

export interface BehaviorContext {
  screenName?: string;
  featureName?: string;
  userAgent?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  networkType?: string;
  batteryLevel?: number;
  locationContext?: 'home' | 'work' | 'travel' | 'unknown';
}

// ============= PATTERN ANALYSIS TYPES =============

export interface PatternAnalysisResult {
  userId: string;
  patterns: BehavioralPattern;
  insights: BehavioralInsights;
  recommendations: PatternRecommendations;
  confidence: number;
  analysisDate: Date;
  dataPoints: number;
}

export interface BehavioralInsights {
  primaryCommunicationStyle: string;
  engagementTrends: EngagementTrend[];
  decisionMakingSpeed: string;
  emotionalIntelligence: number;
  socialComfort: number;
  relationshipReadiness: number;
  compatibilityIndicators: CompatibilityIndicator[];
}

export interface EngagementTrend {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'variable';
  value: number;
  change: number;
}

export interface CompatibilityIndicator {
  indicator: string;
  value: number;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export interface PatternRecommendations {
  improvementAreas: string[];
  communicationTips: string[];
  matchingOptimizations: string[];
  behaviorInsights: string[];
}

// ============= BEHAVIOR TRACKING SERVICE =============

class BehavioralPatternService {
  private static behaviorBuffer: BehaviorEvent[] = [];
  private static flushInterval = 30000; // 30 seconds
  private static maxBufferSize = 100;

  /**
   * Track a user behavior event
   * Implements privacy-first approach with minimal data collection
   */
  static async trackBehaviorEvent(
    userId: string,
    eventType: BehaviorEventType,
    eventData: any,
    context?: BehaviorContext,
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    try {
      const event: BehaviorEvent = {
        userId,
        eventType,
        eventData: this.sanitizeEventData(eventData),
        timestamp: new Date(),
        sessionId: this.getCurrentSessionId(userId),
        context: context ? this.sanitizeContext(context) : undefined
      };

      // Add to buffer for batch processing
      this.behaviorBuffer.push(event);

      // Flush if buffer is full
      if (this.behaviorBuffer.length >= this.maxBufferSize) {
        await this.flushBehaviorBuffer();
      }

      logDebug('Behavior event tracked:', "Debug", { userId, eventType });

    } catch (error) {
      const stellarError = convertToStellerError(error, {
        operation: 'trackBehaviorEvent',
        userId,
        eventType
      });

      logError('Failed to track behavior event:', "Error", stellarError);

      if (!options.silent) {
        throw stellarError;
      }
    }
  }

  /**
   * Flush behavior buffer to database
   * Implements batch processing for efficiency
   */
  private static async flushBehaviorBuffer(): Promise<void> {
    if (this.behaviorBuffer.length === 0) return;

    const events = [...this.behaviorBuffer];
    this.behaviorBuffer = [];

    try {
      // Group events by user for privacy compliance
      const eventsByUser = this.groupEventsByUser(events);

      // Process each user's events
      for (const [userId, userEvents] of eventsByUser) {
        await this.processBehaviorEvents(userId, userEvents);
      }

      logDebug('Flushed behavior buffer:', "Debug", { eventCount: events.length });

    } catch (error) {
      logError('Failed to flush behavior buffer:', "Error", error);
      
      // Re-add events to buffer for retry
      this.behaviorBuffer = [...events, ...this.behaviorBuffer];
    }
  }

  /**
   * Process behavior events for a specific user
   */
  private static async processBehaviorEvents(
    userId: string,
    events: BehaviorEvent[]
  ): Promise<void> {
    try {
      // Aggregate events for privacy protection
      const aggregatedData = this.aggregateBehaviorEvents(events);

      // Store aggregated behavior data
      const { error } = await supabase
        .from('user_behavior_patterns')
        .upsert({
          user_id: userId,
          behavior_summary: aggregatedData,
          last_updated: new Date().toISOString(),
          data_points_count: events.length
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw createAnalyticsError('BEHAVIOR_STORAGE_FAILED', { userId }, 
          'Failed to store behavior pattern data');
      }

      // Update real-time patterns if significant behavior detected
      if (this.isSignificantBehaviorChange(aggregatedData)) {
        await this.updateBehavioralPattern(userId);
      }

    } catch (error) {
      logError('Failed to process behavior events:', "Error", { userId, error });
      throw error;
    }
  }

  /**
   * Analyze and update behavioral patterns for a user
   */
  static async updateBehavioralPattern(
    userId: string,
    options: ErrorHandlingOptions = {}
  ): Promise<PatternAnalysisResult> {
    const operationName = 'updateBehavioralPattern';
    const startTime = Date.now();

    try {
      logDebug('Updating behavioral pattern:', "Debug", { userId });

      // Fetch recent behavior data
      const behaviorData = await this.fetchBehaviorData(userId);
      
      if (!behaviorData || behaviorData.length === 0) {
        throw createAnalyticsError('INSUFFICIENT_BEHAVIOR_DATA', { userId },
          'Insufficient behavior data for pattern analysis');
      }

      // Analyze patterns
      const patterns = await this.analyzeBehavioralPatterns(userId, behaviorData);
      const insights = await this.generateBehavioralInsights(patterns, behaviorData);
      const recommendations = await this.generatePatternRecommendations(patterns, insights);
      
      // Calculate confidence based on data quality and quantity
      const confidence = this.calculatePatternConfidence(behaviorData, patterns);

      const result: PatternAnalysisResult = {
        userId,
        patterns,
        insights,
        recommendations,
        confidence,
        analysisDate: new Date(),
        dataPoints: behaviorData.length
      };

      // Store updated patterns
      await this.storeBehavioralPattern(result);

      const duration = Date.now() - startTime;
      logDebug('Behavioral pattern updated:', "Debug", {
        userId,
        confidence,
        dataPoints: behaviorData.length,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const stellarError = convertToStellerError(error, {
        operationName,
        userId,
        duration
      });

      logError('Failed to update behavioral pattern:', "Error", stellarError);
      throw stellarError;
    }
  }

  /**
   * Fetch behavior data for analysis
   */
  private static async fetchBehaviorData(userId: string): Promise<any[]> {
    try {
      // Fetch aggregated behavior data from the last 30 days
      const { data, error } = await supabase
        .from('user_behavior_patterns')
        .select('*')
        .eq('user_id', userId)
        .gte('last_updated', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('last_updated', { ascending: false });

      if (error) throw error;

      // Also fetch interaction summaries
      const { data: interactions, error: interactionError } = await supabase
        .from('interaction_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (interactionError) {
        logWarn('Failed to fetch interaction summaries:', "Warning", interactionError);
      }

      return [...(data || []), ...(interactions || [])];

    } catch (error) {
      logError('Failed to fetch behavior data:', "Error", { userId, error });
      throw error;
    }
  }

  /**
   * Analyze behavioral patterns from data
   */
  private static async analyzeBehavioralPatterns(
    userId: string,
    behaviorData: any[]
  ): Promise<BehavioralPattern> {
    
    const communicationPattern = await this.analyzeCommunicationPattern(behaviorData);
    const engagementPattern = await this.analyzeEngagementPattern(behaviorData);
    const decisionMakingPattern = await this.analyzeDecisionMakingPattern(behaviorData);
    const conflictPattern = await this.analyzeConflictPattern(behaviorData);
    const intimacyPacePattern = await this.analyzeIntimacyPacePattern(behaviorData);

    return {
      userId,
      patterns: {
        communicationStyle: communicationPattern,
        engagementPattern,
        decisionMaking: decisionMakingPattern,
        conflictStyle: conflictPattern,
        intimacyPace: intimacyPacePattern
      },
      reliability: this.calculatePatternReliability(behaviorData),
      lastUpdated: new Date()
    };
  }

  /**
   * Analyze communication patterns from behavior data
   */
  private static async analyzeCommunicationPattern(
    behaviorData: any[]
  ): Promise<CommunicationPattern> {
    
    const messageEvents = behaviorData.filter(d => 
      d.behavior_summary?.message_events || d.event_type?.includes('message')
    );

    // Analyze message frequency
    const messageFrequency = this.categorizeMessageFrequency(messageEvents);
    
    // Analyze response time patterns
    const responseTime = this.categorizeResponseTime(messageEvents);
    
    // Analyze message length patterns
    const messageLength = this.categorizeMessageLength(messageEvents);
    
    // Analyze emotion expression
    const emotionExpression = this.categorizeEmotionExpression(messageEvents);
    
    // Analyze question asking behavior
    const questionAsking = this.categorizeQuestionAsking(behaviorData);

    return {
      messageFrequency,
      responseTime,
      messageLength,
      emotionExpression,
      questionAsking
    };
  }

  /**
   * Analyze engagement patterns from behavior data
   */
  private static async analyzeEngagementPattern(
    behaviorData: any[]
  ): Promise<EngagementPattern> {
    
    // Calculate activity level
    const activityLevel = this.calculateActivityLevel(behaviorData);
    
    // Identify peak engagement hours
    const peakEngagementHours = this.identifyPeakEngagementHours(behaviorData);
    
    // Categorize session duration
    const sessionDuration = this.categorizeSessionDuration(behaviorData);
    
    // Analyze feature usage
    const featureUsage = this.analyzeFeatureUsage(behaviorData);
    
    // Calculate social engagement
    const socialEngagement = this.calculateSocialEngagement(behaviorData);

    return {
      activityLevel,
      peakEngagementHours,
      sessionDuration,
      featureUsage,
      socialEngagement
    };
  }

  /**
   * Analyze decision making patterns
   */
  private static async analyzeDecisionMakingPattern(
    behaviorData: any[]
  ): Promise<DecisionMakingPattern> {
    
    const swipeEvents = behaviorData.filter(d => 
      d.behavior_summary?.swipe_events || d.event_type?.includes('swipe')
    );

    // Analyze swipe speed
    const swipeSpeed = this.categorizeSwipeSpeed(swipeEvents);
    
    // Calculate selectivity
    const selectivity = this.calculateSelectivity(swipeEvents);
    
    // Calculate reversal rate
    const reversalRate = this.calculateReversalRate(behaviorData);
    
    // Analyze criteria priority
    const criteriaPriority = this.analyzeCriteriaPriority(behaviorData);

    return {
      swipeSpeed,
      selectivity,
      reversalRate,
      criteriaPriority
    };
  }

  /**
   * Analyze conflict handling patterns
   */
  private static async analyzeConflictPattern(
    behaviorData: any[]
  ): Promise<ConflictPattern> {
    
    // This would analyze how users handle disagreements, blocking, unmatching, etc.
    // For now, provide reasonable defaults based on available data
    
    const conflictEvents = behaviorData.filter(d => 
      d.behavior_summary?.conflict_indicators || 
      d.event_type?.includes('unmatch') ||
      d.event_type?.includes('block')
    );

    return {
      avoidanceLevel: this.calculateAvoidanceLevel(conflictEvents),
      directnessLevel: this.calculateDirectnessLevel(behaviorData),
      emotionalReactivity: this.calculateEmotionalReactivity(behaviorData),
      resolutionStyle: this.determineResolutionStyle(behaviorData)
    };
  }

  /**
   * Analyze intimacy pace patterns
   */
  private static async analyzeIntimacyPacePattern(
    behaviorData: any[]
  ): Promise<IntimacyPacePattern> {
    
    return {
      emotionalOpenness: this.categorizeEmotionalOpenness(behaviorData),
      physicalComfort: this.categorizePhysicalComfort(behaviorData),
      vulnerabilitySharing: this.categorizeVulnerabilitySharing(behaviorData),
      commitmentReadiness: this.categorizeCommitmentReadiness(behaviorData)
    };
  }

  // ============= PATTERN ANALYSIS HELPERS =============

  private static categorizeMessageFrequency(messageEvents: any[]): 'low' | 'moderate' | 'high' | 'variable' {
    if (messageEvents.length === 0) return 'low';
    
    const avgMessagesPerDay = this.calculateAverageMessagesPerDay(messageEvents);
    
    if (avgMessagesPerDay < 3) return 'low';
    if (avgMessagesPerDay < 10) return 'moderate';
    if (avgMessagesPerDay < 25) return 'high';
    return 'variable'; // Very high, likely variable
  }

  private static categorizeResponseTime(messageEvents: any[]): 'immediate' | 'quick' | 'delayed' | 'inconsistent' {
    const responseTimes = this.extractResponseTimes(messageEvents);
    if (responseTimes.length === 0) return 'quick';
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const variance = this.calculateVariance(responseTimes);
    
    if (variance > avgResponseTime * 2) return 'inconsistent';
    if (avgResponseTime < 300000) return 'immediate'; // < 5 minutes
    if (avgResponseTime < 3600000) return 'quick'; // < 1 hour
    return 'delayed';
  }

  private static categorizeMessageLength(messageEvents: any[]): 'brief' | 'moderate' | 'detailed' | 'variable' {
    const lengths = this.extractMessageLengths(messageEvents);
    if (lengths.length === 0) return 'moderate';
    
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = this.calculateVariance(lengths);
    
    if (variance > avgLength) return 'variable';
    if (avgLength < 50) return 'brief';
    if (avgLength < 200) return 'moderate';
    return 'detailed';
  }

  private static categorizeEmotionExpression(messageEvents: any[]): 'reserved' | 'moderate' | 'expressive' | 'intense' {
    // This would analyze emoji usage, emotional language, etc.
    // For now, provide a reasonable default based on message patterns
    return 'moderate';
  }

  private static categorizeQuestionAsking(behaviorData: any[]): 'rare' | 'occasional' | 'frequent' | 'constant' {
    const questionEvents = behaviorData.filter(d => 
      d.behavior_summary?.questions_asked || 
      d.event_type?.includes('question')
    );
    
    const questionsPerConversation = this.calculateQuestionsPerConversation(questionEvents);
    
    if (questionsPerConversation < 1) return 'rare';
    if (questionsPerConversation < 3) return 'occasional';
    if (questionsPerConversation < 8) return 'frequent';
    return 'constant';
  }

  private static calculateActivityLevel(behaviorData: any[]): number {
    const totalEvents = behaviorData.reduce((sum, d) => 
      sum + (d.data_points_count || d.event_count || 1), 0
    );
    const daysSpan = Math.max(1, this.calculateDaysSpan(behaviorData));
    
    const eventsPerDay = totalEvents / daysSpan;
    
    // Scale to 0-100
    return Math.min(100, Math.max(0, eventsPerDay * 2));
  }

  private static identifyPeakEngagementHours(behaviorData: any[]): number[] {
    const hourCounts: { [hour: number]: number } = {};
    
    behaviorData.forEach(d => {
      if (d.behavior_summary?.peak_hours) {
        d.behavior_summary.peak_hours.forEach((hour: number) => {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
      }
    });
    
    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    return sortedHours.length > 0 ? sortedHours : [19, 20, 21]; // Default evening hours
  }

  private static categorizeSessionDuration(behaviorData: any[]): 'short' | 'medium' | 'long' | 'variable' {
    const durations = this.extractSessionDurations(behaviorData);
    if (durations.length === 0) return 'medium';
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = this.calculateVariance(durations);
    
    if (variance > avgDuration) return 'variable';
    if (avgDuration < 300000) return 'short'; // < 5 minutes
    if (avgDuration < 1800000) return 'medium'; // < 30 minutes
    return 'long';
  }

  private static analyzeFeatureUsage(behaviorData: any[]): FeatureUsage {
    const messagingFreq = this.calculateFeatureFrequency(behaviorData, 'messaging');
    const profileViewingTime = this.calculateFeatureFrequency(behaviorData, 'profile_viewing');
    const photoEngagement = this.calculateFeatureFrequency(behaviorData, 'photo_interaction');
    const gameParticipation = this.calculateFeatureFrequency(behaviorData, 'game_playing');
    const questionsAsked = this.calculateFeatureFrequency(behaviorData, 'question_asking');
    
    return {
      messagingFrequency: messagingFreq,
      profileViewingTime: profileViewingTime,
      photoEngagement: photoEngagement,
      gameParticipation: gameParticipation,
      questionsAsked: questionsAsked
    };
  }

  private static calculateSocialEngagement(behaviorData: any[]): number {
    // Calculate social interaction metrics
    const socialEvents = behaviorData.filter(d => 
      d.behavior_summary?.social_interactions || 
      d.event_type?.includes('match') ||
      d.event_type?.includes('message') ||
      d.event_type?.includes('conversation')
    );
    
    return Math.min(1, socialEvents.length / Math.max(1, behaviorData.length));
  }

  private static categorizeSwipeSpeed(swipeEvents: any[]): 'deliberate' | 'moderate' | 'fast' | 'impulsive' {
    if (swipeEvents.length === 0) return 'moderate';
    
    const avgTimePerSwipe = this.calculateAverageTimePerSwipe(swipeEvents);
    
    if (avgTimePerSwipe > 30000) return 'deliberate'; // > 30 seconds
    if (avgTimePerSwipe > 10000) return 'moderate'; // > 10 seconds
    if (avgTimePerSwipe > 3000) return 'fast'; // > 3 seconds
    return 'impulsive';
  }

  private static calculateSelectivity(swipeEvents: any[]): number {
    if (swipeEvents.length === 0) return 50;
    
    const rightSwipes = swipeEvents.filter(e => 
      e.behavior_summary?.right_swipes || e.event_type === 'swipe_right'
    ).length;
    
    const totalSwipes = swipeEvents.length;
    const selectivityRatio = 1 - (rightSwipes / totalSwipes);
    
    return Math.round(selectivityRatio * 100);
  }

  private static calculateReversalRate(behaviorData: any[]): number {
    // Calculate how often users change their minds (unmatch, block, etc.)
    const reversalEvents = behaviorData.filter(d => 
      d.behavior_summary?.reversals || 
      d.event_type?.includes('unmatch') ||
      d.event_type?.includes('block')
    );
    
    const totalDecisions = behaviorData.filter(d => 
      d.event_type?.includes('match') || 
      d.event_type?.includes('swipe')
    ).length;
    
    return totalDecisions > 0 ? reversalEvents.length / totalDecisions : 0.1;
  }

  private static analyzeCriteriaPriority(behaviorData: any[]): any {
    // This would analyze what factors influence user decisions most
    // For now, return reasonable defaults
    return {
      appearance: 0.35,
      personality: 0.25,
      values: 0.20,
      lifestyle: 0.10,
      intelligence: 0.05,
      humor: 0.03,
      ambition: 0.02
    };
  }

  // Additional helper methods for conflict and intimacy analysis
  private static calculateAvoidanceLevel(conflictEvents: any[]): number {
    // Higher unmatch/block rate suggests higher avoidance
    return Math.min(100, conflictEvents.length * 10);
  }

  private static calculateDirectnessLevel(behaviorData: any[]): number {
    // This would analyze communication directness
    return 60; // Default moderate directness
  }

  private static calculateEmotionalReactivity(behaviorData: any[]): number {
    // This would analyze emotional responses in messages
    return 50; // Default moderate reactivity
  }

  private static determineResolutionStyle(behaviorData: any[]): 'collaborative' | 'competitive' | 'accommodating' | 'avoiding' {
    // This would analyze how conflicts are handled
    return 'collaborative'; // Default positive style
  }

  private static categorizeEmotionalOpenness(behaviorData: any[]): 'guarded' | 'gradual' | 'open' | 'immediate' {
    // Analyze progression of emotional sharing in conversations
    return 'gradual'; // Default healthy pace
  }

  private static categorizePhysicalComfort(behaviorData: any[]): 'conservative' | 'moderate' | 'progressive' | 'variable' {
    // This would be analyzed very carefully for appropriateness
    return 'moderate'; // Default appropriate level
  }

  private static categorizeVulnerabilitySharing(behaviorData: any[]): 'minimal' | 'selective' | 'open' | 'extensive' {
    // Analyze depth of personal sharing
    return 'selective'; // Default healthy sharing
  }

  private static categorizeCommitmentReadiness(behaviorData: any[]): 'cautious' | 'exploring' | 'ready' | 'eager' {
    // Analyze relationship goal indicators
    return 'exploring'; // Default dating app appropriate level
  }

  // ============= UTILITY METHODS =============

  private static sanitizeEventData(eventData: any): any {
    // Remove PII and sensitive data
    const sanitized = { ...eventData };
    
    // Remove sensitive fields
    delete sanitized.full_name;
    delete sanitized.email;
    delete sanitized.phone;
    delete sanitized.location_precise;
    delete sanitized.ip_address;
    delete sanitized.device_id;
    
    return sanitized;
  }

  private static sanitizeContext(context: BehaviorContext): BehaviorContext {
    // Remove identifying information from context
    return {
      screenName: context.screenName,
      featureName: context.featureName,
      deviceType: context.deviceType,
      networkType: context.networkType?.substring(0, 10), // Truncate
      locationContext: context.locationContext
    };
  }

  private static getCurrentSessionId(userId: string): string {
    // Generate or retrieve current session ID
    return `session_${userId}_${Date.now()}`;
  }

  private static groupEventsByUser(events: BehaviorEvent[]): Map<string, BehaviorEvent[]> {
    const grouped = new Map<string, BehaviorEvent[]>();
    
    events.forEach(event => {
      if (!grouped.has(event.userId)) {
        grouped.set(event.userId, []);
      }
      grouped.get(event.userId)!.push(event);
    });
    
    return grouped;
  }

  private static aggregateBehaviorEvents(events: BehaviorEvent[]): any {
    // Aggregate events to protect privacy while preserving insights
    const aggregated = {
      event_types: this.aggregateEventTypes(events),
      time_patterns: this.aggregateTimePatterns(events),
      interaction_patterns: this.aggregateInteractionPatterns(events),
      engagement_metrics: this.aggregateEngagementMetrics(events),
      timestamp: new Date().toISOString()
    };
    
    return aggregated;
  }

  private static aggregateEventTypes(events: BehaviorEvent[]): any {
    const typeCounts: { [key: string]: number } = {};
    
    events.forEach(event => {
      typeCounts[event.eventType] = (typeCounts[event.eventType] || 0) + 1;
    });
    
    return typeCounts;
  }

  private static aggregateTimePatterns(events: BehaviorEvent[]): any {
    const hourCounts: { [hour: number]: number } = {};
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return {
      peak_hours: Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour))
    };
  }

  private static aggregateInteractionPatterns(events: BehaviorEvent[]): any {
    const messageEvents = events.filter(e => e.eventType.includes('message'));
    const swipeEvents = events.filter(e => e.eventType.includes('swipe'));
    
    return {
      message_events: messageEvents.length,
      swipe_events: swipeEvents.length,
      total_interactions: events.length
    };
  }

  private static aggregateEngagementMetrics(events: BehaviorEvent[]): any {
    if (events.length === 0) return {};
    
    const firstEvent = events[events.length - 1]; // Oldest
    const lastEvent = events[0]; // Newest
    const sessionDuration = lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime();
    
    return {
      session_duration: sessionDuration,
      event_frequency: events.length / Math.max(1, sessionDuration / 60000), // events per minute
      active_features: [...new Set(events.map(e => e.context?.featureName).filter(Boolean))]
    };
  }

  private static isSignificantBehaviorChange(aggregatedData: any): boolean {
    // Determine if the behavior change is significant enough to trigger pattern update
    return aggregatedData.total_interactions > 10 || 
           aggregatedData.event_frequency > 5;
  }

  private static generateBehavioralInsights(
    patterns: BehavioralPattern, 
    behaviorData: any[]
  ): BehavioralInsights {
    // Generate insights based on patterns
    return {
      primaryCommunicationStyle: patterns.patterns.communicationStyle.messageFrequency,
      engagementTrends: [],
      decisionMakingSpeed: patterns.patterns.decisionMaking.swipeSpeed,
      emotionalIntelligence: 70, // Would be calculated from communication patterns
      socialComfort: Math.round(patterns.patterns.engagementPattern.socialEngagement * 100),
      relationshipReadiness: this.calculateRelationshipReadiness(patterns),
      compatibilityIndicators: []
    };
  }

  private static generatePatternRecommendations(
    patterns: BehavioralPattern,
    insights: BehavioralInsights
  ): PatternRecommendations {
    return {
      improvementAreas: [],
      communicationTips: [],
      matchingOptimizations: [],
      behaviorInsights: []
    };
  }

  private static calculatePatternConfidence(behaviorData: any[], patterns: BehavioralPattern): number {
    const dataPoints = behaviorData.reduce((sum, d) => sum + (d.data_points_count || 1), 0);
    const daysSpan = this.calculateDaysSpan(behaviorData);
    
    let confidence = 0.5; // Base confidence
    
    // More data points increase confidence
    confidence += Math.min(0.3, dataPoints / 1000);
    
    // Longer time span increases confidence
    confidence += Math.min(0.2, daysSpan / 30);
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  private static calculatePatternReliability(behaviorData: any[]): number {
    // Calculate how reliable the patterns are based on data consistency
    return Math.min(1.0, behaviorData.length / 100);
  }

  private static async storeBehavioralPattern(result: PatternAnalysisResult): Promise<void> {
    try {
      const { error } = await supabase
        .from('behavioral_patterns')
        .upsert({
          user_id: result.userId,
          patterns: result.patterns,
          insights: result.insights,
          recommendations: result.recommendations,
          confidence: result.confidence,
          analysis_date: result.analysisDate.toISOString(),
          data_points: result.dataPoints
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

    } catch (error) {
      logError('Failed to store behavioral pattern:', "Error", error);
      throw error;
    }
  }

  private static calculateRelationshipReadiness(patterns: BehavioralPattern): number {
    // Calculate readiness based on behavioral patterns
    let readiness = 50; // Base readiness
    
    // Communication positively affects readiness
    if (patterns.patterns.communicationStyle.responseTime === 'quick') readiness += 10;
    if (patterns.patterns.communicationStyle.emotionExpression === 'expressive') readiness += 10;
    
    // Engagement positively affects readiness
    if (patterns.patterns.engagementPattern.activityLevel > 60) readiness += 10;
    
    // Conflict resolution style affects readiness
    if (patterns.patterns.conflictStyle.resolutionStyle === 'collaborative') readiness += 15;
    
    return Math.min(100, Math.max(0, readiness));
  }

  // Additional utility methods
  private static calculateAverageMessagesPerDay(messageEvents: any[]): number {
    if (messageEvents.length === 0) return 0;
    
    const daysSpan = this.calculateDaysSpan(messageEvents);
    return messageEvents.length / Math.max(1, daysSpan);
  }

  private static extractResponseTimes(messageEvents: any[]): number[] {
    // Extract response times from message events
    return []; // Would implement based on actual data structure
  }

  private static extractMessageLengths(messageEvents: any[]): number[] {
    // Extract message lengths from message events
    return []; // Would implement based on actual data structure
  }

  private static calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return variance;
  }

  private static calculateQuestionsPerConversation(questionEvents: any[]): number {
    return questionEvents.length; // Simplified
  }

  private static calculateDaysSpan(behaviorData: any[]): number {
    if (behaviorData.length === 0) return 1;
    
    const dates = behaviorData.map(d => new Date(d.last_updated || d.created_at || Date.now()));
    const minDate = Math.min(...dates.map(d => d.getTime()));
    const maxDate = Math.max(...dates.map(d => d.getTime()));
    
    return Math.max(1, (maxDate - minDate) / (24 * 60 * 60 * 1000));
  }

  private static extractSessionDurations(behaviorData: any[]): number[] {
    return behaviorData
      .map(d => d.behavior_summary?.session_duration)
      .filter(Boolean) as number[];
  }

  private static calculateFeatureFrequency(behaviorData: any[], featureName: string): number {
    const featureEvents = behaviorData.filter(d => 
      d.behavior_summary?.active_features?.includes(featureName) ||
      d.event_type?.includes(featureName)
    );
    
    return featureEvents.length / Math.max(1, behaviorData.length);
  }

  private static calculateAverageTimePerSwipe(swipeEvents: BehaviorEvent[]): number {
    try {
      if (swipeEvents.length < 2) {
        // Not enough data for meaningful calculation
        return 5000; // Default 5 seconds per swipe
      }
      
      // Sort events by timestamp to ensure correct order
      const sortedEvents = swipeEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      let totalSwipeTime = 0;
      let validIntervals = 0;
      
      for (let i = 1; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i];
        const previousEvent = sortedEvents[i - 1];
        
        // Calculate time between consecutive swipes
        const timeBetweenSwipes = currentEvent.timestamp.getTime() - previousEvent.timestamp.getTime();
        
        // Filter out unrealistic intervals (too short or too long)
        // Reasonable swipe decision time: 500ms to 30 seconds
        const MIN_SWIPE_TIME = 500; // 0.5 seconds minimum
        const MAX_SWIPE_TIME = 30000; // 30 seconds maximum
        
        if (timeBetweenSwipes >= MIN_SWIPE_TIME && timeBetweenSwipes <= MAX_SWIPE_TIME) {
          // Check if events are from the same session to avoid cross-session timing
          if (currentEvent.sessionId === previousEvent.sessionId) {
            totalSwipeTime += timeBetweenSwipes;
            validIntervals++;
          }
        }
      }
      
      if (validIntervals === 0) {
        // No valid intervals found, return default
        return 5000; // 5 seconds default
      }
      
      // Calculate average time per swipe
      const averageTime = Math.round(totalSwipeTime / validIntervals);
      
      // Additional refinement: consider event data if available
      const refinedAverage = this.refineSwipeTimingWithEventData(swipeEvents, averageTime);
      
      // Log analytics for insight
      logDebug(`Calculated average swipe time: ${refinedAverage}ms from ${validIntervals} valid intervals`, "Debug", {
        totalEvents: swipeEvents.length,
        validIntervals,
        averageTime: refinedAverage,
        rawAverage: averageTime
      });
      
      return refinedAverage;
      
    } catch (error) {
      logError('Error calculating average swipe time:', "Error", error);
      return 7500; // Conservative default (7.5 seconds)
    }
  }
  
  /**
   * Refine swipe timing calculation using additional event data
   */
  private static refineSwipeTimingWithEventData(swipeEvents: BehaviorEvent[], baseAverage: number): number {
    try {
      let adjustmentFactor = 1.0;
      
      // Analyze swipe patterns for refinement
      const rightSwipes = swipeEvents.filter(e => e.eventType === 'swipe_right').length;
      const leftSwipes = swipeEvents.filter(e => e.eventType === 'swipe_left').length;
      const totalSwipes = rightSwipes + leftSwipes;
      
      if (totalSwipes > 0) {
        const rightSwipeRatio = rightSwipes / totalSwipes;
        
        // Users who swipe right more often tend to decide faster
        if (rightSwipeRatio > 0.7) {
          adjustmentFactor *= 0.8; // 20% faster for very selective right swipers
        } else if (rightSwipeRatio < 0.2) {
          adjustmentFactor *= 1.2; // 20% slower for very selective users
        }
      }
      
      // Check for event data that might indicate viewing time
      const eventsWithViewTime = swipeEvents.filter(event => {
        return event.eventData?.viewDuration || 
               event.eventData?.profileViewTime ||
               event.eventData?.photoViewTime;
      });
      
      if (eventsWithViewTime.length > swipeEvents.length * 0.3) { // If 30%+ have view time data
        const avgViewTime = eventsWithViewTime.reduce((sum, event) => {
          const viewTime = event.eventData.viewDuration || 
                          event.eventData.profileViewTime || 
                          event.eventData.photoViewTime || 0;
          return sum + viewTime;
        }, 0) / eventsWithViewTime.length;
        
        // If we have view time data, use it to refine the calculation
        if (avgViewTime > 0 && avgViewTime < 60000) { // Less than 1 minute is reasonable
          // Weight the view time data with our calculated time
          const refinedTime = (baseAverage * 0.6) + (avgViewTime * 0.4);
          return Math.round(refinedTime * adjustmentFactor);
        }
      }
      
      // Check for rapid-fire swipe sessions (potential speed mode)
      const rapidSwipeSessions = this.detectRapidSwipeSessions(swipeEvents);
      if (rapidSwipeSessions > 0) {
        adjustmentFactor *= 0.7; // Account for speed-swiping behavior
      }
      
      return Math.round(baseAverage * adjustmentFactor);
      
    } catch (error) {
      logWarn('Error refining swipe timing:', "Warning", error);
      return baseAverage; // Return base calculation if refinement fails
    }
  }
  
  /**
   * Detect rapid swipe sessions where user was swiping very quickly
   */
  private static detectRapidSwipeSessions(swipeEvents: BehaviorEvent[]): number {
    try {
      const sessions = new Map<string, BehaviorEvent[]>();
      
      // Group events by session
      swipeEvents.forEach(event => {
        if (!sessions.has(event.sessionId)) {
          sessions.set(event.sessionId, []);
        }
        sessions.get(event.sessionId)!.push(event);
      });
      
      let rapidSessions = 0;
      
      sessions.forEach((sessionEvents, sessionId) => {
        if (sessionEvents.length < 5) return; // Need at least 5 swipes to detect rapid swiping
        
        const sortedEvents = sessionEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        let rapidSwipeCount = 0;
        
        for (let i = 1; i < sortedEvents.length; i++) {
          const timeDiff = sortedEvents[i].timestamp.getTime() - sortedEvents[i - 1].timestamp.getTime();
          if (timeDiff < 1500) { // Less than 1.5 seconds between swipes
            rapidSwipeCount++;
          }
        }
        
        // If more than 70% of swipes in session were rapid
        if (rapidSwipeCount / (sortedEvents.length - 1) > 0.7) {
          rapidSessions++;
        }
      });
      
      return rapidSessions;
      
    } catch (error) {
      logWarn('Error detecting rapid swipe sessions:', "Warning", error);
      return 0;
    }
  }

  /**
   * Initialize behavior tracking with flush timer
   */
  static initialize(): void {
    // Set up periodic flushing
    setInterval(() => {
      this.flushBehaviorBuffer().catch(error => {
        logError('Failed to flush behavior buffer on schedule:', "Error", error);
      });
    }, this.flushInterval);

    logInfo('Behavioral pattern service initialized', "Info");
  }

  /**
   * Get behavioral pattern for a user
   */
  static async getBehavioralPattern(userId: string): Promise<BehavioralPattern | null> {
    try {
      const { data, error } = await supabase
        .from('behavioral_patterns')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Return default pattern if none exists
        return this.getDefaultBehavioralPattern(userId);
      }

      return data.patterns;

    } catch (error) {
      logError('Failed to get behavioral pattern:', "Error", { userId, error });
      return this.getDefaultBehavioralPattern(userId);
    }
  }

  /**
   * Get default behavioral pattern for new users
   */
  private static getDefaultBehavioralPattern(userId: string): BehavioralPattern {
    return {
      userId,
      patterns: {
        communicationStyle: {
          messageFrequency: 'moderate',
          responseTime: 'quick',
          messageLength: 'moderate',
          emotionExpression: 'moderate',
          questionAsking: 'occasional'
        },
        engagementPattern: {
          activityLevel: 60,
          peakEngagementHours: [19, 20, 21],
          sessionDuration: 'medium',
          featureUsage: {
            messagingFrequency: 0.6,
            profileViewingTime: 0.7,
            photoEngagement: 0.8,
            gameParticipation: 0.3,
            questionsAsked: 0.4
          },
          socialEngagement: 0.6
        },
        decisionMaking: {
          swipeSpeed: 'moderate',
          selectivity: 60,
          reversalRate: 0.1,
          criteriaPriority: {
            appearance: 0.35,
            personality: 0.25,
            values: 0.20,
            lifestyle: 0.10,
            intelligence: 0.05,
            humor: 0.03,
            ambition: 0.02
          }
        },
        conflictStyle: {
          avoidanceLevel: 40,
          directnessLevel: 60,
          emotionalReactivity: 50,
          resolutionStyle: 'collaborative'
        },
        intimacyPace: {
          emotionalOpenness: 'gradual',
          physicalComfort: 'moderate',
          vulnerabilitySharing: 'selective',
          commitmentReadiness: 'exploring'
        }
      },
      reliability: 0.5, // Lower reliability for default patterns
      lastUpdated: new Date()
    };
  }
}

export default BehavioralPatternService;
