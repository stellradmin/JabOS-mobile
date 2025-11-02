/**
 * Production Alerting Service for Stellr Dating App
 * 
 * Purpose: Real-time alerting system for production issues with business impact assessment
 * Security: Addresses audit concerns with secure alerting and data protection
 * Features: Multi-channel alerts, escalation policies, business impact analysis, SLA monitoring
 * 
 * Architecture: Follows the 10 Golden Code Principles
 * - Intelligent alert prioritization
 * - Business impact assessment
 * - Multi-channel notification support
 * - Alert fatigue prevention
 * - Escalation policy management
 */

import { secureStorage } from '../utils/secure-storage';
import * as Notifications from 'expo-notifications';
import { trackError, trackCriticalError, trackBusinessMetric } from '../lib/sentry-enhanced';
import { securityMonitor, logSecurityViolation } from '../lib/security-monitor';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'error' | 'security' | 'business' | 'infrastructure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: AlertCondition[];
  thresholds: AlertThreshold[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'not_contains';
  value: any;
  timeWindow: number; // milliseconds
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

export interface AlertThreshold {
  level: 'warning' | 'critical';
  value: number;
  timeWindow: number;
  consecutiveOccurrences?: number;
}

export interface ActiveAlert {
  id: string;
  alertDefinitionId: string;
  title: string;
  description: string;
  severity: AlertDefinition['severity'];
  category: AlertDefinition['category'];
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  businessImpact: BusinessImpact;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  suppressedUntil?: string;
  escalationLevel: number;
  notificationsSent: NotificationRecord[];
  metadata: Record<string, any>;
}

export interface BusinessImpact {
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  affectedFeatures: string[];
  estimatedUserImpact: number; // percentage
  potentialRevenueLoss: number;
  slaBreaches: SLABreach[];
  recommendation: string;
  autoRecoveryPossible: boolean;
}

export interface SLABreach {
  slaName: string;
  targetValue: number;
  actualValue: number;
  breachDuration: number;
  severityLevel: 'minor' | 'major' | 'critical';
}

export interface NotificationChannel {
  id: string;
  type: 'push' | 'sms' | 'email' | 'slack' | 'webhook' | 'pagerduty';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  priority: number; // Lower number = higher priority
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  steps: EscalationStep[];
  enabled: boolean;
}

export interface EscalationStep {
  id: string;
  level: number;
  delayMinutes: number;
  channels: string[]; // Channel IDs
  assignees: string[]; // User IDs
  conditions?: AlertCondition[];
}

export interface NotificationRecord {
  id: string;
  channelId: string;
  channelType: NotificationChannel['type'];
  sentAt: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  escalationLevel: number;
  recipient: string;
  messageId?: string;
  errorMessage?: string;
}

export interface AlertingConfiguration {
  enablePushNotifications: boolean;
  enableBusinessImpactAnalysis: boolean;
  enableAutoEscalation: boolean;
  enableAlertCorrelation: boolean;
  alertRetentionDays: number;
  maxAlertsPerMinute: number;
  suppressDuplicateWindow: number; // milliseconds
  defaultEscalationPolicy?: string;
  businessHours: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
    weekends: boolean;
  };
}

// ===============================================================================
// BUSINESS IMPACT ANALYZER
// ===============================================================================

class BusinessImpactAnalyzer {
  private featureMetrics = new Map<string, {
    importance: number; // 1-10 scale
    userCount: number;
    revenueImpact: number;
    dependencies: string[];
  }>();

  private slaDefinitions = new Map<string, {
    name: string;
    targetValue: number;
    metric: string;
    breachThreshold: number;
  }>();

  constructor() {
    this.initializeFeatureMetrics();
    this.initializeSLADefinitions();
  }

  /**
   * Initializes feature importance metrics for business impact calculation
   */
  private initializeFeatureMetrics(): void {
    const features = [
      {
        name: 'user_authentication',
        importance: 10,
        userCount: 100, // percentage
        revenueImpact: 10000,
        dependencies: ['database', 'security_service']
      },
      {
        name: 'matching_system',
        importance: 9,
        userCount: 85,
        revenueImpact: 8000,
        dependencies: ['database', 'compatibility_service', 'recommendation_engine']
      },
      {
        name: 'messaging',
        importance: 8,
        userCount: 70,
        revenueImpact: 5000,
        dependencies: ['database', 'real_time_service', 'push_notifications']
      },
      {
        name: 'profile_management',
        importance: 7,
        userCount: 95,
        revenueImpact: 3000,
        dependencies: ['database', 'image_service', 'validation_service']
      },
      {
        name: 'subscription_system',
        importance: 9,
        userCount: 30,
        revenueImpact: 12000,
        dependencies: ['database', 'payment_service', 'billing_service']
      },
      {
        name: 'photo_upload',
        importance: 6,
        userCount: 80,
        revenueImpact: 2000,
        dependencies: ['image_service', 'storage_service', 'content_moderation']
      }
    ];

    features.forEach(feature => {
      this.featureMetrics.set(feature.name, {
        importance: feature.importance,
        userCount: feature.userCount,
        revenueImpact: feature.revenueImpact,
        dependencies: feature.dependencies
      });
    });
  }

  /**
   * Initializes SLA definitions for breach detection
   */
  private initializeSLADefinitions(): void {
    const slas = [
      {
        name: 'app_availability',
        targetValue: 99.9, // 99.9% uptime
        metric: 'availability_percentage',
        breachThreshold: 99.0
      },
      {
        name: 'api_response_time',
        targetValue: 500, // 500ms
        metric: 'avg_response_time',
        breachThreshold: 1000
      },
      {
        name: 'matching_success_rate',
        targetValue: 95, // 95% success rate
        metric: 'matching_success_percentage',
        breachThreshold: 85
      },
      {
        name: 'message_delivery',
        targetValue: 99.5, // 99.5% delivery rate
        metric: 'message_delivery_percentage',
        breachThreshold: 95
      },
      {
        name: 'user_satisfaction',
        targetValue: 4.5, // 4.5/5 rating
        metric: 'avg_user_rating',
        breachThreshold: 4.0
      }
    ];

    slas.forEach(sla => {
      this.slaDefinitions.set(sla.name, sla);
    });
  }

  /**
   * Analyzes business impact of an alert
   * Principle 1: Single Responsibility - Focused on impact analysis
   */
  public analyzeBusinessImpact(
    alertCategory: AlertDefinition['category'],
    alertSeverity: AlertDefinition['severity'],
    alertMetadata: Record<string, any>
  ): BusinessImpact {
    try {
      const impact: BusinessImpact = {
        severity: this.calculateImpactSeverity(alertCategory, alertSeverity, alertMetadata),
        affectedFeatures: this.identifyAffectedFeatures(alertMetadata),
        estimatedUserImpact: this.estimateUserImpact(alertMetadata),
        potentialRevenueLoss: this.calculateRevenueLoss(alertMetadata),
        slaBreaches: this.checkSLABreaches(alertMetadata),
        recommendation: this.generateRecommendation(alertCategory, alertMetadata),
        autoRecoveryPossible: this.assessAutoRecoveryPossibility(alertCategory, alertMetadata)
      };

      // Log business impact for audit
      trackBusinessMetric('alert_business_impact', impact.estimatedUserImpact, {
        category: alertCategory,
        severity: impact.severity,
        affectedFeatures: impact.affectedFeatures.length,
        revenueLoss: impact.potentialRevenueLoss
      });

      return impact;
    } catch (error) {
      logError('Business impact analysis failed:', "Error", error);
      
      // Return conservative impact estimate
      return {
        severity: alertSeverity === 'critical' ? 'high' : 'medium',
        affectedFeatures: ['unknown'],
        estimatedUserImpact: 10,
        potentialRevenueLoss: 1000,
        slaBreaches: [],
        recommendation: 'Investigate immediately',
        autoRecoveryPossible: false
      };
    }
  }

  private calculateImpactSeverity(
    category: AlertDefinition['category'],
    alertSeverity: AlertDefinition['severity'],
    metadata: Record<string, any>
  ): BusinessImpact['severity'] {
    let impactScore = 0;

    // Base score from alert severity
    switch (alertSeverity) {
      case 'critical': impactScore += 40; break;
      case 'high': impactScore += 30; break;
      case 'medium': impactScore += 20; break;
      case 'low': impactScore += 10; break;
    }

    // Category-specific adjustments
    switch (category) {
      case 'security': impactScore += 20; break;
      case 'business': impactScore += 15; break;
      case 'performance': impactScore += 10; break;
      case 'error': impactScore += 10; break;
      case 'infrastructure': impactScore += 5; break;
    }

    // Feature-specific adjustments
    const affectedFeatures = this.identifyAffectedFeatures(metadata);
    affectedFeatures.forEach(feature => {
      const featureData = this.featureMetrics.get(feature);
      if (featureData) {
        impactScore += featureData.importance;
      }
    });

    // Convert score to severity level
    if (impactScore >= 70) return 'critical';
    if (impactScore >= 50) return 'high';
    if (impactScore >= 30) return 'medium';
    if (impactScore >= 15) return 'low';
    return 'none';
  }

  private identifyAffectedFeatures(metadata: Record<string, any>): string[] {
    const features: string[] = [];

    try {
      // Check explicit feature mentions
      if (metadata.feature) {
        features.push(metadata.feature);
      }

      if (metadata.component) {
        // Map component names to features
        const componentFeatureMap: Record<string, string[]> = {
          'AuthService': ['user_authentication'],
          'MatchingService': ['matching_system'],
          'MessagingService': ['messaging'],
          'ProfileService': ['profile_management'],
          'SubscriptionService': ['subscription_system'],
          'PhotoUploadService': ['photo_upload'],
          'CompatibilityService': ['matching_system'],
          'PaymentService': ['subscription_system']
        };

        const componentFeatures = componentFeatureMap[metadata.component] || [];
        features.push(...componentFeatures);
      }

      // Check for endpoint-based feature identification
      if (metadata.endpoint) {
        const endpoint = metadata.endpoint.toLowerCase();
        if (endpoint.includes('auth')) features.push('user_authentication');
        if (endpoint.includes('match')) features.push('matching_system');
        if (endpoint.includes('message')) features.push('messaging');
        if (endpoint.includes('profile')) features.push('profile_management');
        if (endpoint.includes('subscription') || endpoint.includes('payment')) {
          features.push('subscription_system');
        }
        if (endpoint.includes('photo') || endpoint.includes('upload')) {
          features.push('photo_upload');
        }
      }

      return [...new Set(features)]; // Remove duplicates
    } catch (error) {
      logError('Feature identification failed:', "Error", error);
      return ['unknown'];
    }
  }

  private estimateUserImpact(metadata: Record<string, any>): number {
    try {
      let totalImpact = 0;
      let featureCount = 0;

      const affectedFeatures = this.identifyAffectedFeatures(metadata);
      
      affectedFeatures.forEach(feature => {
        const featureData = this.featureMetrics.get(feature);
        if (featureData) {
          totalImpact += featureData.userCount;
          featureCount++;
        }
      });

      // If no specific features identified, assume moderate impact
      if (featureCount === 0) {
        return 25; // 25% user impact
      }

      // Calculate weighted average
      const averageImpact = totalImpact / featureCount;
      
      // Apply severity multiplier
      const severityMultiplier = metadata.severity === 'critical' ? 1.0 :
                                metadata.severity === 'high' ? 0.8 :
                                metadata.severity === 'medium' ? 0.6 : 0.4;

      return Math.min(100, averageImpact * severityMultiplier);
    } catch (error) {
      logError('User impact estimation failed:', "Error", error);
      return 10; // Conservative estimate
    }
  }

  private calculateRevenueLoss(metadata: Record<string, any>): number {
    try {
      let potentialLoss = 0;

      const affectedFeatures = this.identifyAffectedFeatures(metadata);
      
      affectedFeatures.forEach(feature => {
        const featureData = this.featureMetrics.get(feature);
        if (featureData) {
          potentialLoss += featureData.revenueImpact;
        }
      });

      // Apply time-based multiplier (longer outages = higher loss)
      const estimatedDuration = metadata.estimatedDurationHours || 1;
      const timeFactor = Math.min(10, estimatedDuration); // Cap at 10x

      return potentialLoss * timeFactor;
    } catch (error) {
      logError('Revenue loss calculation failed:', "Error", error);
      return 5000; // Conservative estimate
    }
  }

  private checkSLABreaches(metadata: Record<string, any>): SLABreach[] {
    const breaches: SLABreach[] = [];

    try {
      this.slaDefinitions.forEach((slaConfig, slaName) => {
        const metricValue = metadata[slaConfig.metric];
        
        if (metricValue !== undefined && metricValue < slaConfig.breachThreshold) {
          const breach: SLABreach = {
            slaName,
            targetValue: slaConfig.targetValue,
            actualValue: metricValue,
            breachDuration: metadata.breachDuration || 0,
            severityLevel: this.calculateBreachSeverity(
              slaConfig.targetValue,
              metricValue,
              slaConfig.breachThreshold
            )
          };
          
          breaches.push(breach);
        }
      });
    } catch (error) {
      logError('SLA breach checking failed:', "Error", error);
    }

    return breaches;
  }

  private calculateBreachSeverity(
    target: number,
    actual: number,
    threshold: number
  ): SLABreach['severityLevel'] {
    const breachPercentage = ((threshold - actual) / threshold) * 100;
    
    if (breachPercentage > 20) return 'critical';
    if (breachPercentage > 10) return 'major';
    return 'minor';
  }

  private generateRecommendation(
    category: AlertDefinition['category'],
    metadata: Record<string, any>
  ): string {
    const recommendations = {
      security: 'Investigate security incident immediately. Consider isolating affected systems.',
      performance: 'Check system resources and optimize performance bottlenecks.',
      error: 'Review error logs and implement fixes. Consider rollback if necessary.',
      business: 'Assess business impact and communicate with stakeholders.',
      infrastructure: 'Check infrastructure health and scale resources if needed.'
    };

    let baseRecommendation = recommendations[category] || 'Investigate and resolve quickly.';

    // Add feature-specific recommendations
    const affectedFeatures = this.identifyAffectedFeatures(metadata);
    if (affectedFeatures.includes('subscription_system')) {
      baseRecommendation += ' Priority: Revenue-critical system affected.';
    }
    if (affectedFeatures.includes('user_authentication')) {
      baseRecommendation += ' Priority: Core authentication system affected.';
    }

    return baseRecommendation;
  }

  private assessAutoRecoveryPossibility(
    category: AlertDefinition['category'],
    metadata: Record<string, any>
  ): boolean {
    // Security issues typically require manual intervention
    if (category === 'security') return false;

    // High severity issues often need manual review
    if (metadata.severity === 'critical') return false;

    // Some categories have better auto-recovery potential
    const autoRecoverableCategories = ['performance', 'infrastructure'];
    return autoRecoverableCategories.includes(category);
  }
}

// ===============================================================================
// NOTIFICATION MANAGER
// ===============================================================================

class NotificationManager {
  private channels = new Map<string, NotificationChannel>();
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  private notificationHistory: NotificationRecord[] = [];

  constructor() {
    this.initializeDefaultChannels();
  }

  /**
   * Initializes default notification channels
   */
  private initializeDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'push_notifications',
        type: 'push',
        name: 'Push Notifications',
        config: {},
        enabled: true,
        priority: 1
      },
      {
        id: 'sentry_alerts',
        type: 'webhook',
        name: 'Sentry Integration',
        config: { 
          webhook_url: 'sentry://alerts',
          severity_filter: ['high', 'critical']
        },
        enabled: true,
        priority: 2
      },
      {
        id: 'development_console',
        type: 'webhook',
        name: 'Development Console',
        config: { 
          webhook_url: 'console://log'
        },
        enabled: __DEV__,
        priority: 10
      }
    ];

    defaultChannels.forEach(channel => {
      this.channels.set(channel.id, channel);
    });
  }

  /**
   * Sends notification through specified channels
   * Principle 3: Small, Focused Functions - Clear notification sending logic
   */
  public async sendNotification(
    alert: ActiveAlert,
    channelIds: string[],
    escalationLevel: number = 0
  ): Promise<NotificationRecord[]> {
    const records: NotificationRecord[] = [];

    try {
      for (const channelId of channelIds) {
        const channel = this.channels.get(channelId);
        if (!channel || !channel.enabled) {
          logWarn(`Channel ${channelId} not found or disabled`, "Warning");
          continue;
        }

        // Check rate limits
        if (!this.checkRateLimit(channelId)) {
          logWarn(`Rate limit exceeded for channel ${channelId}`, "Warning");
          continue;
        }

        const record = await this.sendToChannel(alert, channel, escalationLevel);
        records.push(record);
      }

      // Store notification history
      this.notificationHistory.push(...records);
      this.pruneNotificationHistory();

      return records;
    } catch (error) {
      logError('Notification sending failed:', "Error", error);
      trackError(error as Error, {
        component: 'NotificationManager',
        method: 'sendNotification',
        alertId: alert.id,
        channels: channelIds
      });
      return records;
    }
  }

  /**
   * Sends notification to a specific channel
   */
  private async sendToChannel(
    alert: ActiveAlert,
    channel: NotificationChannel,
    escalationLevel: number
  ): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: this.generateNotificationId(),
      channelId: channel.id,
      channelType: channel.type,
      sentAt: new Date().toISOString(),
      status: 'sent',
      escalationLevel,
      recipient: 'system' // Would be actual recipient in production
    };

    try {
      switch (channel.type) {
        case 'push':
          await this.sendPushNotification(alert, channel, record);
          break;
          
        case 'webhook':
          await this.sendWebhookNotification(alert, channel, record);
          break;
          
        case 'email':
          await this.sendEmailNotification(alert, channel, record);
          break;
          
        case 'sms':
          await this.sendSMSNotification(alert, channel, record);
          break;
          
        case 'slack':
          await this.sendSlackNotification(alert, channel, record);
          break;
          
        default:
          record.status = 'failed';
          record.errorMessage = `Unsupported channel type: ${channel.type}`;
      }

      // Track notification success
      trackBusinessMetric('notification_sent', 1, {
        channelType: channel.type,
        alertSeverity: alert.severity,
        escalationLevel
      });

    } catch (error) {
      record.status = 'failed';
      record.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      trackError(error as Error, {
        component: 'NotificationManager',
        method: 'sendToChannel',
        channelType: channel.type,
        alertId: alert.id
      });
    }

    return record;
  }

  private async sendPushNotification(
    alert: ActiveAlert,
    channel: NotificationChannel,
    record: NotificationRecord
  ): Promise<void> {
    try {
      // Check if push notifications are available
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Push notification permission not granted');
      }

      const notification = {
        title: this.formatAlertTitle(alert),
        body: this.formatAlertBody(alert),
        data: {
          alertId: alert.id,
          severity: alert.severity,
          category: alert.category
        },
        priority: alert.severity === 'critical' ? 
          Notifications.AndroidImportance.HIGH : 
          Notifications.AndroidImportance.DEFAULT
      };

      await Notifications.scheduleNotificationAsync({
        content: notification,
        trigger: null // Send immediately
      });

      record.status = 'delivered';
    } catch (error) {
      throw new Error(`Push notification failed: ${error}`);
    }
  }

  private async sendWebhookNotification(
    alert: ActiveAlert,
    channel: NotificationChannel,
    record: NotificationRecord
  ): Promise<void> {
    try {
      const webhookUrl = channel.config.webhook_url;
      
      if (webhookUrl === 'sentry://alerts') {
        // Send to Sentry
        if (alert.severity === 'critical') {
          trackCriticalError(
            new Error(`PRODUCTION ALERT: ${alert.title}`),
            {
              alert,
              businessImpact: alert.businessImpact,
              escalationLevel: record.escalationLevel
            }
          );
        } else {
          trackError(
            new Error(`ALERT: ${alert.title}`),
            { alert, businessImpact: alert.businessImpact }
          );
        }
      } else if (webhookUrl === 'console://log') {
        // Log to console in development
        logDebug('🚨 PRODUCTION ALERT:', "Debug", {
          title: alert.title,
          severity: alert.severity,
          businessImpact: alert.businessImpact.severity,
          affectedFeatures: alert.businessImpact.affectedFeatures
        });
      }

      record.status = 'delivered';
    } catch (error) {
      throw new Error(`Webhook notification failed: ${error}`);
    }
  }

  private async sendEmailNotification(
    alert: ActiveAlert,
    channel: NotificationChannel,
    record: NotificationRecord
  ): Promise<void> {
    // Email implementation would go here
    logDebug('📧 Email notification:', "Debug", alert.title);
    record.status = 'sent'; // Would be 'delivered' after actual sending
  }

  private async sendSMSNotification(
    alert: ActiveAlert,
    channel: NotificationChannel,
    record: NotificationRecord
  ): Promise<void> {
    // SMS implementation would go here
    logDebug('📱 SMS notification:', "Debug", alert.title);
    record.status = 'sent';
  }

  private async sendSlackNotification(
    alert: ActiveAlert,
    channel: NotificationChannel,
    record: NotificationRecord
  ): Promise<void> {
    // Slack implementation would go here
    logDebug('💬 Slack notification:', "Debug", alert.title);
    record.status = 'sent';
  }

  private checkRateLimit(channelId: string): boolean {
    const limit = this.rateLimits.get(channelId);
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    const maxNotifications = 10; // Max 10 notifications per minute

    if (!limit || now >= limit.resetTime) {
      this.rateLimits.set(channelId, { count: 1, resetTime: now + windowSize });
      return true;
    }

    if (limit.count >= maxNotifications) {
      return false;
    }

    limit.count++;
    return true;
  }

  private formatAlertTitle(alert: ActiveAlert): string {
    return `${alert.severity.toUpperCase()}: ${alert.title}`;
  }

  private formatAlertBody(alert: ActiveAlert): string {
    const impact = alert.businessImpact;
    return `${alert.description}\nImpact: ${impact.estimatedUserImpact}% of users\nFeatures: ${impact.affectedFeatures.join(', ')}`;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private pruneNotificationHistory(): void {
    // Keep only last 1000 notifications
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(-1000);
    }
  }

  public getNotificationHistory(): NotificationRecord[] {
    return [...this.notificationHistory];
  }

  public getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  public addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  public updateChannel(channelId: string, updates: Partial<NotificationChannel>): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      this.channels.set(channelId, { ...channel, ...updates });
    }
  }

  public removeChannel(channelId: string): void {
    this.channels.delete(channelId);
  }
}

// ===============================================================================
// ESCALATION MANAGER
// ===============================================================================

class EscalationManager {
  private policies = new Map<string, EscalationPolicy>();
  private activeEscalations = new Map<string, {
    alertId: string;
    policyId: string;
    currentStep: number;
    nextEscalationAt: number;
  }>();

  constructor() {
    this.initializeDefaultPolicies();
    this.startEscalationProcessor();
  }

  /**
   * Initializes default escalation policies
   */
  private initializeDefaultPolicies(): void {
    const policies: EscalationPolicy[] = [
      {
        id: 'standard_escalation',
        name: 'Standard Escalation Policy',
        description: 'Standard escalation for production alerts',
        enabled: true,
        steps: [
          {
            id: 'step_1',
            level: 1,
            delayMinutes: 0, // Immediate
            channels: ['push_notifications', 'sentry_alerts'],
            assignees: ['on_call_engineer']
          },
          {
            id: 'step_2',
            level: 2,
            delayMinutes: 15,
            channels: ['push_notifications', 'sentry_alerts', 'development_console'],
            assignees: ['on_call_engineer', 'team_lead']
          },
          {
            id: 'step_3',
            level: 3,
            delayMinutes: 30,
            channels: ['push_notifications', 'sentry_alerts', 'development_console'],
            assignees: ['on_call_engineer', 'team_lead', 'engineering_manager']
          }
        ]
      },
      {
        id: 'critical_escalation',
        name: 'Critical Alert Escalation',
        description: 'Immediate escalation for critical alerts',
        enabled: true,
        steps: [
          {
            id: 'critical_step_1',
            level: 1,
            delayMinutes: 0,
            channels: ['push_notifications', 'sentry_alerts'],
            assignees: ['on_call_engineer', 'team_lead']
          },
          {
            id: 'critical_step_2',
            level: 2,
            delayMinutes: 5, // Faster escalation
            channels: ['push_notifications', 'sentry_alerts', 'development_console'],
            assignees: ['on_call_engineer', 'team_lead', 'engineering_manager', 'cto']
          }
        ]
      }
    ];

    policies.forEach(policy => {
      this.policies.set(policy.id, policy);
    });
  }

  /**
   * Starts the escalation processor
   */
  private startEscalationProcessor(): void {
    // Check for escalations every minute
    setInterval(() => {
      this.processEscalations();
    }, 60000);
  }

  /**
   * Initiates escalation for an alert
   * Principle 1: Single Responsibility - Manages escalation workflow
   */
  public initiateEscalation(
    alert: ActiveAlert,
    policyId?: string
  ): void {
    try {
      // Determine escalation policy
      const selectedPolicyId = policyId || 
        (alert.severity === 'critical' ? 'critical_escalation' : 'standard_escalation');
      
      const policy = this.policies.get(selectedPolicyId);
      if (!policy || !policy.enabled) {
        logError(`Escalation policy ${selectedPolicyId} not found or disabled`, "Error");
        return;
      }

      // Register escalation
      this.activeEscalations.set(alert.id, {
        alertId: alert.id,
        policyId: selectedPolicyId,
        currentStep: 0,
        nextEscalationAt: Date.now() // Start immediately
      });

      logDebug(`🚨 Escalation initiated for alert ${alert.id} with policy ${selectedPolicyId}`, "Debug");
      
      trackBusinessMetric('escalation_initiated', 1, {
        alertId: alert.id,
        policyId: selectedPolicyId,
        severity: alert.severity
      });

    } catch (error) {
      logError('Escalation initiation failed:', "Error", error);
      trackError(error as Error, {
        component: 'EscalationManager',
        method: 'initiateEscalation',
        alertId: alert.id
      });
    }
  }

  /**
   * Processes pending escalations
   */
  private async processEscalations(): Promise<void> {
    const now = Date.now();

    for (const [alertId, escalation] of this.activeEscalations.entries()) {
      try {
        if (now >= escalation.nextEscalationAt) {
          await this.executeEscalationStep(escalation);
        }
      } catch (error) {
        logError(`Escalation processing failed for alert ${alertId}:`, "Error", error);
      }
    }
  }

  /**
   * Executes a specific escalation step
   */
  private async executeEscalationStep(escalation: {
    alertId: string;
    policyId: string;
    currentStep: number;
    nextEscalationAt: number;
  }): Promise<void> {
    const policy = this.policies.get(escalation.policyId);
    if (!policy) return;

    const step = policy.steps[escalation.currentStep];
    if (!step) {
      // No more steps, escalation complete
      this.activeEscalations.delete(escalation.alertId);
      return;
    }

    logDebug(`⬆️ Executing escalation step ${step.level} for alert ${escalation.alertId}`, "Debug");

    // This would trigger notifications through NotificationManager
    // For now, we'll just log the escalation
    trackBusinessMetric('escalation_step_executed', 1, {
      alertId: escalation.alertId,
      step: step.level,
      channels: step.channels.length,
      assignees: step.assignees.length
    });

    // Schedule next step
    escalation.currentStep++;
    const nextStep = policy.steps[escalation.currentStep];
    
    if (nextStep) {
      escalation.nextEscalationAt = Date.now() + (nextStep.delayMinutes * 60000);
    } else {
      // No more steps
      this.activeEscalations.delete(escalation.alertId);
    }
  }

  /**
   * Stops escalation for an alert (e.g., when acknowledged or resolved)
   */
  public stopEscalation(alertId: string): void {
    if (this.activeEscalations.has(alertId)) {
      this.activeEscalations.delete(alertId);
      
      trackBusinessMetric('escalation_stopped', 1, { alertId });
      logDebug(`🛑 Escalation stopped for alert ${alertId}`, "Debug");
    }
  }

  public getPolicies(): EscalationPolicy[] {
    return Array.from(this.policies.values());
  }

  public getActiveEscalations(): Array<{alertId: string; currentStep: number; nextEscalationAt: number}> {
    return Array.from(this.activeEscalations.values()).map(esc => ({
      alertId: esc.alertId,
      currentStep: esc.currentStep,
      nextEscalationAt: esc.nextEscalationAt
    }));
  }
}

// ===============================================================================
// MAIN PRODUCTION ALERTING SERVICE
// ===============================================================================

class ProductionAlertingService {
  private static instance: ProductionAlertingService;
  private businessImpactAnalyzer: BusinessImpactAnalyzer;
  private notificationManager: NotificationManager;
  private escalationManager: EscalationManager;
  private configuration: AlertingConfiguration;
  private alertDefinitions = new Map<string, AlertDefinition>();
  private activeAlerts = new Map<string, ActiveAlert>();
  private suppressedAlerts = new Set<string>();
  private alertHistory: ActiveAlert[] = [];
  private isInitialized = false;

  private constructor() {
    this.businessImpactAnalyzer = new BusinessImpactAnalyzer();
    this.notificationManager = new NotificationManager();
    this.escalationManager = new EscalationManager();
    this.configuration = this.getDefaultConfiguration();
  }

  /**
   * Singleton pattern for service management
   */
  public static getInstance(): ProductionAlertingService {
    if (!ProductionAlertingService.instance) {
      ProductionAlertingService.instance = new ProductionAlertingService();
    }
    return ProductionAlertingService.instance;
  }

  private getDefaultConfiguration(): AlertingConfiguration {
    return {
      enablePushNotifications: true,
      enableBusinessImpactAnalysis: true,
      enableAutoEscalation: true,
      enableAlertCorrelation: false,
      alertRetentionDays: 30,
      maxAlertsPerMinute: 10,
      suppressDuplicateWindow: 300000, // 5 minutes
      defaultEscalationPolicy: 'standard_escalation',
      businessHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'UTC',
        weekends: false
      }
    };
  }

  /**
   * Initializes the production alerting service
   * Principle 6: Fail Fast & Defensive - Comprehensive initialization
   */
  public async initialize(
    config?: Partial<AlertingConfiguration>
  ): Promise<void> {
    try {
      if (this.isInitialized) {
        logWarn('Production Alerting Service already initialized', "Warning");
        return;
      }

      // Apply configuration overrides
      if (config) {
        this.configuration = { ...this.configuration, ...config };
      }

      // Initialize default alert definitions
      this.initializeDefaultAlerts();
      
      // Set up push notifications
      if (this.configuration.enablePushNotifications) {
        await this.setupPushNotifications();
      }

      // Start alert processing
      this.startAlertProcessing();

      this.isInitialized = true;
      
      logDebug('✅ Production Alerting Service initialized', "Debug", {
        pushNotifications: this.configuration.enablePushNotifications,
        businessImpact: this.configuration.enableBusinessImpactAnalysis,
        autoEscalation: this.configuration.enableAutoEscalation
      });

      trackBusinessMetric('alerting_service_initialized', 1, {
        configuration: this.configuration
      });

    } catch (error) {
      logError('❌ Production Alerting Service initialization failed:', "Error", error);
      trackCriticalError(error as Error, {
        component: 'ProductionAlertingService',
        method: 'initialize'
      });
      throw error;
    }
  }

  /**
   * Initializes default alert definitions
   */
  private initializeDefaultAlerts(): void {
    const defaultAlerts: AlertDefinition[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds acceptable threshold',
        category: 'error',
        severity: 'high',
        conditions: [
          {
            metric: 'error_rate',
            operator: 'gt',
            value: 5, // 5% error rate
            timeWindow: 300000, // 5 minutes
            aggregation: 'avg'
          }
        ],
        thresholds: [
          { level: 'warning', value: 3, timeWindow: 300000 },
          { level: 'critical', value: 10, timeWindow: 300000 }
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'slow_response_time',
        name: 'Slow API Response Time',
        description: 'API response time is degraded',
        category: 'performance',
        severity: 'medium',
        conditions: [
          {
            metric: 'avg_response_time',
            operator: 'gt',
            value: 2000, // 2 seconds
            timeWindow: 600000, // 10 minutes
            aggregation: 'avg'
          }
        ],
        thresholds: [
          { level: 'warning', value: 1500, timeWindow: 600000 },
          { level: 'critical', value: 5000, timeWindow: 300000 }
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'security_threat',
        name: 'Security Threat Detected',
        description: 'Potential security threat identified',
        category: 'security',
        severity: 'critical',
        conditions: [
          {
            metric: 'threat_score',
            operator: 'gt',
            value: 80,
            timeWindow: 0 // Immediate
          }
        ],
        thresholds: [
          { level: 'warning', value: 60, timeWindow: 0 },
          { level: 'critical', value: 80, timeWindow: 0 }
        ],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    defaultAlerts.forEach(alert => {
      this.alertDefinitions.set(alert.id, alert);
    });
  }

  private async setupPushNotifications(): Promise<void> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        logWarn('Push notification permissions not granted', "Warning");
        this.configuration.enablePushNotifications = false;
        return;
      }

      // Configure notification handling
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      logDebug('✅ Push notifications configured', "Debug");
    } catch (error) {
      logError('Push notification setup failed:', "Error", error);
      this.configuration.enablePushNotifications = false;
    }
  }

  private startAlertProcessing(): void {
    // Process alert conditions every minute
    setInterval(() => {
      this.processAlerts();
    }, 60000);

    // Clean up old alerts daily
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 24 * 60 * 60 * 1000);
  }

  // ===============================================================================
  // PUBLIC API METHODS
  // ===============================================================================

  /**
   * Triggers an alert based on metric data
   * Principle 2: Meaningful Names - Method name clearly indicates purpose
   */
  public async triggerAlert(
    alertDefinitionId: string,
    metricData: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        logWarn('Production Alerting Service not initialized', "Warning");
        return null;
      }

      const alertDefinition = this.alertDefinitions.get(alertDefinitionId);
      if (!alertDefinition || !alertDefinition.enabled) {
        logWarn(`Alert definition ${alertDefinitionId} not found or disabled`, "Warning");
        return null;
      }

      // Check if alert conditions are met
      if (!this.evaluateAlertConditions(alertDefinition, metricData)) {
        return null; // Conditions not met
      }

      // Check for duplicate suppression
      if (this.isDuplicateAlert(alertDefinitionId, metadata)) {
        logDebug(`Duplicate alert suppressed: ${alertDefinitionId}`, "Debug");
        return null;
      }

      // Analyze business impact
      const businessImpact = this.configuration.enableBusinessImpactAnalysis ?
        this.businessImpactAnalyzer.analyzeBusinessImpact(
          alertDefinition.category,
          alertDefinition.severity,
          { ...metricData, ...metadata }
        ) : this.getDefaultBusinessImpact();

      // Create active alert
      const alertId = this.generateAlertId();
      const activeAlert: ActiveAlert = {
        id: alertId,
        alertDefinitionId,
        title: alertDefinition.name,
        description: this.generateAlertDescription(alertDefinition, metricData),
        severity: alertDefinition.severity,
        category: alertDefinition.category,
        status: 'open',
        businessImpact,
        triggeredAt: new Date().toISOString(),
        escalationLevel: 0,
        notificationsSent: [],
        metadata: { ...metricData, ...metadata }
      };

      // Store active alert
      this.activeAlerts.set(alertId, activeAlert);
      
      // Send initial notifications
      await this.sendAlertNotifications(activeAlert);
      
      // Initiate escalation if enabled
      if (this.configuration.enableAutoEscalation) {
        this.escalationManager.initiateEscalation(
          activeAlert,
          this.configuration.defaultEscalationPolicy
        );
      }

      // Log security events
      if (alertDefinition.category === 'security') {
        logSecurityViolation(
          `alert_${alertDefinition.id}`,
          alertDefinition.severity === 'critical' ? 'CRITICAL' : 'HIGH',
          activeAlert.metadata,
          businessImpact.estimatedUserImpact
        );
      }

      logDebug(`🚨 Alert triggered: ${activeAlert.title} (${alertId}, "Debug")`);
      
      trackBusinessMetric('alert_triggered', 1, {
        alertDefinitionId,
        severity: alertDefinition.severity,
        category: alertDefinition.category,
        businessImpact: businessImpact.severity
      });

      return alertId;

    } catch (error) {
      logError('Alert triggering failed:', "Error", error);
      trackError(error as Error, {
        component: 'ProductionAlertingService',
        method: 'triggerAlert',
        alertDefinitionId,
        metricData
      });
      return null;
    }
  }

  /**
   * Acknowledges an active alert
   */
  public async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert || alert.status !== 'open') {
        return false;
      }

      // Update alert status
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
      alert.acknowledgedBy = acknowledgedBy;
      
      if (notes) {
        alert.metadata.acknowledgmentNotes = notes;
      }

      // Stop escalation
      this.escalationManager.stopEscalation(alertId);

      logDebug(`✅ Alert acknowledged: ${alertId} by ${acknowledgedBy}`, "Debug");
      
      trackBusinessMetric('alert_acknowledged', 1, {
        alertId,
        acknowledgedBy,
        severity: alert.severity,
        timeToAcknowledge: Date.now() - new Date(alert.triggeredAt).getTime()
      });

      return true;
    } catch (error) {
      logError('Alert acknowledgment failed:', "Error", error);
      return false;
    }
  }

  /**
   * Resolves an active alert
   */
  public async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution?: string
  ): Promise<boolean> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        return false;
      }

      // Update alert status
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = resolvedBy;
      
      if (resolution) {
        alert.metadata.resolution = resolution;
      }

      // Stop escalation
      this.escalationManager.stopEscalation(alertId);

      // Move to history
      this.alertHistory.push(alert);
      this.activeAlerts.delete(alertId);

      logDebug(`✅ Alert resolved: ${alertId} by ${resolvedBy}`, "Debug");
      
      trackBusinessMetric('alert_resolved', 1, {
        alertId,
        resolvedBy,
        severity: alert.severity,
        timeToResolve: Date.now() - new Date(alert.triggeredAt).getTime(),
        businessImpact: alert.businessImpact.severity
      });

      return true;
    } catch (error) {
      logError('Alert resolution failed:', "Error", error);
      return false;
    }
  }

  // ===============================================================================
  // PRIVATE HELPER METHODS
  // ===============================================================================

  private evaluateAlertConditions(
    alertDefinition: AlertDefinition,
    metricData: Record<string, any>
  ): boolean {
    try {
      return alertDefinition.conditions.every(condition => {
        const metricValue = metricData[condition.metric];
        if (metricValue === undefined) {
          return false;
        }

        return this.evaluateCondition(condition, metricValue);
      });
    } catch (error) {
      logError('Alert condition evaluation failed:', "Error", error);
      return false;
    }
  }

  private evaluateCondition(condition: AlertCondition, value: any): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'eq': return value === condition.value;
      case 'neq': return value !== condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      case 'not_contains': return !String(value).includes(String(condition.value));
      default: return false;
    }
  }

  private isDuplicateAlert(
    alertDefinitionId: string,
    metadata?: Record<string, any>
  ): boolean {
    const suppressKey = `${alertDefinitionId}:${JSON.stringify(metadata || {})}`;
    
    if (this.suppressedAlerts.has(suppressKey)) {
      return true;
    }

    // Add to suppressed alerts with timeout
    this.suppressedAlerts.add(suppressKey);
    setTimeout(() => {
      this.suppressedAlerts.delete(suppressKey);
    }, this.configuration.suppressDuplicateWindow);

    return false;
  }

  private generateAlertDescription(
    alertDefinition: AlertDefinition,
    metricData: Record<string, any>
  ): string {
    let description = alertDefinition.description;
    
    // Add metric values to description
    Object.entries(metricData).forEach(([key, value]) => {
      description += ` ${key}: ${value}`;
    });

    return description;
  }

  private getDefaultBusinessImpact(): BusinessImpact {
    return {
      severity: 'medium',
      affectedFeatures: ['unknown'],
      estimatedUserImpact: 10,
      potentialRevenueLoss: 1000,
      slaBreaches: [],
      recommendation: 'Investigate and resolve',
      autoRecoveryPossible: false
    };
  }

  private async sendAlertNotifications(alert: ActiveAlert): Promise<void> {
    try {
      // Determine notification channels based on severity and business hours
      const channels = this.selectNotificationChannels(alert);
      
      // Send notifications
      const records = await this.notificationManager.sendNotification(
        alert,
        channels,
        alert.escalationLevel
      );

      // Update alert with notification records
      alert.notificationsSent.push(...records);
    } catch (error) {
      logError('Alert notification sending failed:', "Error", error);
    }
  }

  private selectNotificationChannels(alert: ActiveAlert): string[] {
    const channels: string[] = ['push_notifications', 'sentry_alerts'];

    // Add development console in dev mode
    if (__DEV__) {
      channels.push('development_console');
    }

    // Critical alerts get all channels
    if (alert.severity === 'critical') {
      channels.push(...this.notificationManager.getChannels()
        .filter(c => c.enabled)
        .map(c => c.id));
    }

    return [...new Set(channels)]; // Remove duplicates
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async processAlerts(): Promise<void> {
    // This would normally process metric data against alert definitions
    // For now, it's a placeholder for the alert evaluation engine
    logDebug('🔍 Processing alert conditions...', "Debug");
  }

  private cleanupOldAlerts(): void {
    const cutoffDate = Date.now() - (this.configuration.alertRetentionDays * 24 * 60 * 60 * 1000);
    
    this.alertHistory = this.alertHistory.filter(alert => 
      new Date(alert.triggeredAt).getTime() > cutoffDate
    );

    logDebug('🧹 Old alerts cleaned up', "Debug");
  }

  // ===============================================================================
  // PUBLIC UTILITY METHODS
  // ===============================================================================

  public getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(): ActiveAlert[] {
    return [...this.alertHistory];
  }

  public getAlertDefinitions(): AlertDefinition[] {
    return Array.from(this.alertDefinitions.values());
  }

  public getConfiguration(): AlertingConfiguration {
    return { ...this.configuration };
  }

  /**
   * Gets comprehensive alerting dashboard data
   */
  public async getAlertingDashboard(): Promise<Record<string, any>> {
    try {
      if (!this.isInitialized) {
        throw new Error('Production Alerting Service not initialized');
      }

      const activeAlerts = this.getActiveAlerts();
      const recentHistory = this.alertHistory.slice(-50); // Last 50 alerts

      return {
        activeAlerts,
        recentHistory,
        alertDefinitions: this.getAlertDefinitions(),
        escalationPolicies: this.escalationManager.getPolicies(),
        notificationChannels: this.notificationManager.getChannels(),
        configuration: this.configuration,
        statistics: {
          activeAlertCount: activeAlerts.length,
          criticalAlertCount: activeAlerts.filter(a => a.severity === 'critical').length,
          averageResolutionTime: this.calculateAverageResolutionTime(),
          alertsResolvedToday: this.getAlertsResolvedToday()
        },
        systemHealth: this.calculateAlertingSystemHealth(),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logError('Alerting dashboard generation failed:', "Error", error);
      throw error;
    }
  }

  private calculateAverageResolutionTime(): number {
    const resolvedAlerts = this.alertHistory.filter(a => a.resolvedAt);
    if (resolvedAlerts.length === 0) return 0;

    const totalTime = resolvedAlerts.reduce((sum, alert) => {
      const triggerTime = new Date(alert.triggeredAt).getTime();
      const resolveTime = new Date(alert.resolvedAt!).getTime();
      return sum + (resolveTime - triggerTime);
    }, 0);

    return totalTime / resolvedAlerts.length; // Average in milliseconds
  }

  private getAlertsResolvedToday(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    return this.alertHistory.filter(alert => 
      alert.resolvedAt && new Date(alert.resolvedAt).getTime() > todayTime
    ).length;
  }

  private calculateAlertingSystemHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const activeAlerts = this.getActiveAlerts();
    const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
    const totalActive = activeAlerts.length;

    if (criticalCount > 5 || totalActive > 20) return 'unhealthy';
    if (criticalCount > 2 || totalActive > 10) return 'degraded';
    return 'healthy';
  }

  /**
   * Configures alerting service settings
   */
  public configure(updates: Partial<AlertingConfiguration>): void {
    this.configuration = { ...this.configuration, ...updates };
    
    trackBusinessMetric('alerting_configuration_updated', 1, {
      updates: Object.keys(updates)
    });
  }

  /**
   * Cleanup alerting resources
   */
  public cleanup(): void {
    try {
      this.activeAlerts.clear();
      this.suppressedAlerts.clear();
      this.isInitialized = false;
      
      logDebug('✅ Production Alerting Service cleaned up', "Debug");
    } catch (error) {
      logError('Alerting service cleanup failed:', "Error", error);
    }
  }
}

// ===============================================================================
// EXPORTS
// ===============================================================================

export default ProductionAlertingService;
export {
  BusinessImpactAnalyzer,
  NotificationManager,
  EscalationManager,
  type AlertDefinition,
  type ActiveAlert,
  type BusinessImpact,
  type AlertingConfiguration,
  type NotificationChannel,
  type EscalationPolicy
};

// Export singleton instance for app-wide use
export const productionAlerting = ProductionAlertingService.getInstance();

// Convenience functions for common alerting operations
export const triggerProductionAlert = (
  alertDefinitionId: string,
  metricData: Record<string, any>,
  metadata?: Record<string, any>
) => {
  return productionAlerting.triggerAlert(alertDefinitionId, metricData, metadata);
};

export const acknowledgeProductionAlert = (
  alertId: string,
  acknowledgedBy: string,
  notes?: string
) => {
  return productionAlerting.acknowledgeAlert(alertId, acknowledgedBy, notes);
};

export const resolveProductionAlert = (
  alertId: string,
  resolvedBy: string,
  resolution?: string
) => {
  return productionAlerting.resolveAlert(alertId, resolvedBy, resolution);
};
