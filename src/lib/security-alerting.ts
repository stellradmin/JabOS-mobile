// ===============================================================================
// STELLR AUTOMATED SECURITY ALERTING SYSTEM
// ===============================================================================
// Purpose: Automated detection, escalation, and notification for critical security events
// Features: Multi-channel alerting, escalation policies, incident management
// ===============================================================================

import { supabase } from './supabase';
import { trackCriticalError, trackError } from './sentry-enhanced';
import { securityIntegration } from './security-integration';
import { secureStorage } from '../utils/secure-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  channels: AlertChannel[];
  escalation_policy: EscalationPolicy;
  throttling: ThrottlingConfig;
  metadata: Record<string, any>;
}

export interface AlertCondition {
  type: 'threshold' | 'pattern' | 'anomaly' | 'frequency';
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'contains' | 'matches';
  value: any;
  time_window?: number; // Minutes
  aggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
}

export interface AlertChannel {
  type: 'push_notification' | 'sentry' | 'database' | 'webhook' | 'email' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
  priority: number; // 1 = highest priority
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
  max_escalations: number;
  escalation_delay: number; // Minutes between escalations
}

export interface EscalationLevel {
  level: number;
  channels: AlertChannel[];
  acknowledgment_timeout: number; // Minutes
  auto_resolve: boolean;
}

export interface ThrottlingConfig {
  enabled: boolean;
  max_alerts_per_hour: number;
  max_alerts_per_day: number;
  cooldown_period: number; // Minutes
}

export interface SecurityAlert {
  id: string;
  rule_id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  event_data: Record<string, any>;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  escalation_level: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  suppression_reason?: string;
  metadata: Record<string, any>;
}

export interface AlertingMetrics {
  total_alerts: number;
  critical_alerts: number;
  acknowledged_alerts: number;
  mean_time_to_acknowledge: number;
  mean_time_to_resolve: number;
  false_positive_rate: number;
  escalation_rate: number;
}

// ===============================================================================
// PREDEFINED SECURITY ALERT RULES
// ===============================================================================

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'critical_threat_detected',
    name: 'Critical Threat Detected',
    description: 'Immediate alert for critical security threats',
    enabled: true,
    conditions: [
      {
        type: 'threshold',
        field: 'severity',
        operator: 'eq',
        value: 'CRITICAL'
      },
      {
        type: 'threshold',
        field: 'confidence',
        operator: 'gte',
        value: 0.8
      }
    ],
    severity: 'CRITICAL',
    channels: [
      {
        type: 'push_notification',
        config: { immediate: true, sound: 'critical' },
        enabled: true,
        priority: 1
      },
      {
        type: 'sentry',
        config: { level: 'fatal', requires_immediate_attention: true },
        enabled: true,
        priority: 2
      },
      {
        type: 'database',
        config: { table: 'security_alerts', urgent: true },
        enabled: true,
        priority: 3
      }
    ],
    escalation_policy: {
      levels: [
        {
          level: 1,
          channels: [{ type: 'push_notification', config: {}, enabled: true, priority: 1 }],
          acknowledgment_timeout: 5,
          auto_resolve: false
        },
        {
          level: 2,
          channels: [{ type: 'sentry', config: { escalated: true }, enabled: true, priority: 1 }],
          acknowledgment_timeout: 15,
          auto_resolve: false
        }
      ],
      max_escalations: 2,
      escalation_delay: 5
    },
    throttling: {
      enabled: false, // No throttling for critical threats
      max_alerts_per_hour: 100,
      max_alerts_per_day: 500,
      cooldown_period: 0
    },
    metadata: { priority: 'P0', team: 'security', on_call: true }
  },
  {
    id: 'brute_force_attack',
    name: 'Brute Force Attack Detected',
    description: 'Multiple failed authentication attempts from single source',
    enabled: true,
    conditions: [
      {
        type: 'frequency',
        field: 'failed_auth_attempts',
        operator: 'gte',
        value: 5,
        time_window: 15,
        aggregation: 'count'
      }
    ],
    severity: 'HIGH',
    channels: [
      {
        type: 'push_notification',
        config: { sound: 'high_priority' },
        enabled: true,
        priority: 1
      },
      {
        type: 'sentry',
        config: { level: 'error', tag: 'brute_force' },
        enabled: true,
        priority: 2
      }
    ],
    escalation_policy: {
      levels: [
        {
          level: 1,
          channels: [{ type: 'push_notification', config: {}, enabled: true, priority: 1 }],
          acknowledgment_timeout: 15,
          auto_resolve: false
        }
      ],
      max_escalations: 1,
      escalation_delay: 10
    },
    throttling: {
      enabled: true,
      max_alerts_per_hour: 10,
      max_alerts_per_day: 50,
      cooldown_period: 30
    },
    metadata: { priority: 'P1', team: 'security' }
  },
  {
    id: 'data_breach_suspected',
    name: 'Suspected Data Breach',
    description: 'Unusual data access patterns indicating potential breach',
    enabled: true,
    conditions: [
      {
        type: 'pattern',
        field: 'event_type',
        operator: 'contains',
        value: 'data_breach'
      },
      {
        type: 'threshold',
        field: 'risk_score',
        operator: 'gte',
        value: 80
      }
    ],
    severity: 'CRITICAL',
    channels: [
      {
        type: 'push_notification',
        config: { immediate: true, sound: 'critical', persistent: true },
        enabled: true,
        priority: 1
      },
      {
        type: 'sentry',
        config: { 
          level: 'fatal', 
          requires_immediate_attention: true,
          potential_data_breach: true,
          notification_required: true
        },
        enabled: true,
        priority: 2
      }
    ],
    escalation_policy: {
      levels: [
        {
          level: 1,
          channels: [
            { type: 'push_notification', config: {}, enabled: true, priority: 1 },
            { type: 'sentry', config: {}, enabled: true, priority: 1 }
          ],
          acknowledgment_timeout: 2, // 2 minutes for critical
          auto_resolve: false
        },
        {
          level: 2,
          channels: [{ type: 'sentry', config: { escalated: true, legal_team_notify: true }, enabled: true, priority: 1 }],
          acknowledgment_timeout: 5,
          auto_resolve: false
        }
      ],
      max_escalations: 2,
      escalation_delay: 2
    },
    throttling: {
      enabled: false,
      max_alerts_per_hour: 100,
      max_alerts_per_day: 1000,
      cooldown_period: 0
    },
    metadata: { priority: 'P0', team: 'security', legal_notification: true }
  },
  {
    id: 'account_takeover_attempt',
    name: 'Account Takeover Attempt',
    description: 'Suspicious account changes indicating takeover attempt',
    enabled: true,
    conditions: [
      {
        type: 'pattern',
        field: 'threat_type',
        operator: 'eq',
        value: 'account_takeover'
      },
      {
        type: 'threshold',
        field: 'confidence',
        operator: 'gte',
        value: 0.75
      }
    ],
    severity: 'HIGH',
    channels: [
      {
        type: 'push_notification',
        config: { sound: 'high_priority', action_required: true },
        enabled: true,
        priority: 1
      },
      {
        type: 'sentry',
        config: { level: 'error', tag: 'account_security' },
        enabled: true,
        priority: 2
      }
    ],
    escalation_policy: {
      levels: [
        {
          level: 1,
          channels: [{ type: 'push_notification', config: {}, enabled: true, priority: 1 }],
          acknowledgment_timeout: 10,
          auto_resolve: false
        }
      ],
      max_escalations: 1,
      escalation_delay: 15
    },
    throttling: {
      enabled: true,
      max_alerts_per_hour: 5,
      max_alerts_per_day: 20,
      cooldown_period: 60
    },
    metadata: { priority: 'P1', team: 'security', user_notification: true }
  },
  {
    id: 'compliance_violation',
    name: 'Compliance Violation',
    description: 'GDPR or other compliance policy violation detected',
    enabled: true,
    conditions: [
      {
        type: 'pattern',
        field: 'event_type',
        operator: 'contains',
        value: 'compliance'
      },
      {
        type: 'pattern',
        field: 'severity',
        operator: 'eq',
        value: 'HIGH'
      }
    ],
    severity: 'MEDIUM',
    channels: [
      {
        type: 'push_notification',
        config: { sound: 'default' },
        enabled: true,
        priority: 1
      },
      {
        type: 'database',
        config: { table: 'compliance_alerts' },
        enabled: true,
        priority: 2
      }
    ],
    escalation_policy: {
      levels: [
        {
          level: 1,
          channels: [{ type: 'database', config: {}, enabled: true, priority: 1 }],
          acknowledgment_timeout: 60,
          auto_resolve: true
        }
      ],
      max_escalations: 1,
      escalation_delay: 30
    },
    throttling: {
      enabled: true,
      max_alerts_per_hour: 20,
      max_alerts_per_day: 100,
      cooldown_period: 15
    },
    metadata: { priority: 'P2', team: 'compliance' }
  }
];

// ===============================================================================
// MAIN ALERTING ENGINE
// ===============================================================================

class SecurityAlertingEngine {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, SecurityAlert> = new Map();
  private alertHistory: SecurityAlert[] = [];
  private throttleCounters: Map<string, { count: number; resetTime: number }> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  constructor() {
    this.loadDefaultRules();
  }

  // ===============================================================================
  // INITIALIZATION
  // ===============================================================================

  async initialize(): Promise<void> {
    try {
      logDebug('🚨 Initializing Security Alerting Engine...', "Debug");

      // Load custom rules from database
      await this.loadCustomRules();

      // Set up notification configuration
      await this.setupNotifications();

      // Start alert processing
      this.startAlertProcessing();

      this.isInitialized = true;
      logDebug('✅ Security Alerting Engine initialized successfully', "Debug");

    } catch (error) {
      logError('❌ Failed to initialize Security Alerting Engine:', "Error", error);
      trackError(error as Error, {
        component: 'SecurityAlertingEngine',
        method: 'initialize'
      });
      throw error;
    }
  }

  private loadDefaultRules(): void {
    DEFAULT_ALERT_RULES.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private async loadCustomRules(): Promise<void> {
    try {
      // Load custom alert rules from database
      const { data: customRules } = await supabase
        .from('security_alert_rules')
        .select('*')
        .eq('enabled', true);

      customRules?.forEach(rule => {
        this.alertRules.set(rule.id, rule);
      });

      logDebug(`📋 Loaded ${customRules?.length || 0} custom alert rules`, "Debug");
    } catch (error) {
      logWarn('Failed to load custom alert rules:', "Warning", error);
    }
  }

  private async setupNotifications(): Promise<void> {
    try {
      // Configure notification categories
      await Notifications.setNotificationCategoryAsync('security_critical', [
        {
          identifier: 'acknowledge',
          buttonTitle: 'Acknowledge',
          options: { opensAppToForeground: true }
        },
        {
          identifier: 'view_details',
          buttonTitle: 'View Details',
          options: { opensAppToForeground: true }
        }
      ]);

      await Notifications.setNotificationCategoryAsync('security_high', [
        {
          identifier: 'acknowledge',
          buttonTitle: 'Acknowledge',
          options: { opensAppToForeground: false }
        }
      ]);

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const category = notification.request.content.categoryIdentifier;
          return {
            shouldShowAlert: true,
            shouldPlaySound: category === 'security_critical',
            shouldSetBadge: true,
            // add fields for platforms that require them; cast as any for type compatibility
            shouldShowBanner: true as any,
            shouldShowList: true as any,
            priority: category === 'security_critical'
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.HIGH,
          } as any;
        },
      });

      logDebug('🔔 Notification configuration set up', "Debug");
    } catch (error) {
      logWarn('Failed to set up notifications:', "Warning", error);
    }
  }

  private startAlertProcessing(): void {
    // Set up real-time alert processing from database changes
    this.subscribeToSecurityEvents();
    
    // Set up periodic cleanup and maintenance
    setInterval(() => {
      this.performMaintenance();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private subscribeToSecurityEvents(): void {
    // Subscribe to high-priority security events
    supabase
      .channel('security-alerting')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_audit_comprehensive',
        filter: 'severity=in.(HIGH,CRITICAL)'
      }, (payload) => {
        this.processSecurityEvent(payload.new as any);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'threat_detection_log'
      }, (payload) => {
        this.processThreatEvent(payload.new as any);
      })
      .subscribe();

    logDebug('👂 Subscribed to real-time security events', "Debug");
  }

  // ===============================================================================
  // EVENT PROCESSING
  // ===============================================================================

  async processSecurityEvent(event: any): Promise<void> {
    try {
      if (!this.isInitialized) {
        logWarn('Alerting engine not initialized, "Warning", ignoring event');
        return;
      }

      logDebug(`🔍 Processing security event: ${event.event_type}`, "Debug");

      // Evaluate all alert rules against this event
      for (const [ruleId, rule] of this.alertRules) {
        if (rule.enabled && await this.evaluateRule(rule, event)) {
          await this.triggerAlert(rule, event);
        }
      }

    } catch (error) {
      logError('Failed to process security event:', "Error", error);
      trackError(error as Error, {
        component: 'SecurityAlertingEngine',
        method: 'processSecurityEvent',
        event
      });
    }
  }

  async processThreatEvent(threat: any): Promise<void> {
    try {
      logDebug(`🚨 Processing threat event: ${threat.threat_type}`, "Debug");

      // Convert threat to security event format for rule evaluation
      const securityEvent = {
        event_type: threat.threat_type,
        severity: threat.severity,
        confidence: threat.confidence_score / 100, // Convert percentage to decimal
        risk_score: threat.confidence_score,
        threat_type: threat.threat_type,
        user_id: threat.user_id,
        created_at: threat.created_at,
        indicators: threat.indicators
      };

      await this.processSecurityEvent(securityEvent);

    } catch (error) {
      logError('Failed to process threat event:', "Error", error);
    }
  }

  private async evaluateRule(rule: AlertRule, event: any): Promise<boolean> {
    try {
      // Check if rule is throttled
      if (await this.isRuleThrottled(rule.id)) {
        return false;
      }

      // Evaluate all conditions (AND logic)
      for (const condition of rule.conditions) {
        if (!await this.evaluateCondition(condition, event)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      logError('Rule evaluation failed:', "Error", error);
      return false;
    }
  }

  private async evaluateCondition(condition: AlertCondition, event: any): Promise<boolean> {
    const fieldValue = this.getFieldValue(event, condition.field);
    
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    switch (condition.type) {
      case 'threshold':
        return this.evaluateThresholdCondition(fieldValue, condition);
        
      case 'pattern':
        return this.evaluatePatternCondition(fieldValue, condition);
        
      case 'frequency':
        return await this.evaluateFrequencyCondition(condition, event);
        
      case 'anomaly':
        return await this.evaluateAnomalyCondition(fieldValue, condition);
        
      default:
        return false;
    }
  }

  private evaluateThresholdCondition(value: any, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'eq': return value === condition.value;
      default: return false;
    }
  }

  private evaluatePatternCondition(value: any, condition: AlertCondition): boolean {
    const strValue = String(value).toLowerCase();
    const pattern = String(condition.value).toLowerCase();

    switch (condition.operator) {
      case 'contains': return strValue.includes(pattern);
      case 'matches': return new RegExp(pattern).test(strValue);
      case 'eq': return strValue === pattern;
      default: return false;
    }
  }

  private async evaluateFrequencyCondition(condition: AlertCondition, event: any): Promise<boolean> {
    try {
      const timeWindow = condition.time_window || 60; // Default 1 hour
      const since = new Date(Date.now() - (timeWindow * 60 * 1000)).toISOString();

      const { data: events } = await supabase
        .from('security_audit_comprehensive')
        .select('*')
        .gte('created_at', since)
        .eq(condition.field, this.getFieldValue(event, condition.field));

      const count = events?.length || 0;
      return this.evaluateThresholdCondition(count, { ...condition, type: 'threshold' });

    } catch (error) {
      logError('Frequency condition evaluation failed:', "Error", error);
      return false;
    }
  }

  private async evaluateAnomalyCondition(value: any, condition: AlertCondition): Promise<boolean> {
    // Simplified anomaly detection - in production, this would use ML models
    try {
      const baseline = await this.getBaselineValue(condition.field);
      const deviation = Math.abs(value - baseline) / baseline;
      return deviation > (condition.value || 0.5); // 50% deviation threshold
    } catch (error) {
      return false;
    }
  }

  private getFieldValue(event: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = event;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    
    return value;
  }

  private async getBaselineValue(field: string): Promise<number> {
    // Calculate baseline from historical data
    const { data: events } = await supabase
      .from('security_audit_comprehensive')
      .select(field)
      .gte('created_at', new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString())
      .limit(1000);

    if (!events || events.length === 0) return 0;

    const values = events.map(e => this.getFieldValue(e, field)).filter(v => typeof v === 'number');
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // ===============================================================================
  // ALERT TRIGGERING AND MANAGEMENT
  // ===============================================================================

  private async triggerAlert(rule: AlertRule, event: any): Promise<void> {
    try {
      logDebug(`🚨 Triggering alert: ${rule.name}`, "Debug");

      // Create alert record
      const alert: SecurityAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        rule_id: rule.id,
        severity: rule.severity,
        title: rule.name,
        description: this.generateAlertDescription(rule, event),
        event_data: event,
        triggered_at: new Date().toISOString(),
        escalation_level: 0,
        status: 'active',
        metadata: {
          ...rule.metadata,
          original_event_id: event.id,
          trigger_conditions: rule.conditions
        }
      };

      // Store alert
      this.activeAlerts.set(alert.id, alert);
      this.alertHistory.push(alert);

      // Update throttle counters
      this.updateThrottleCounter(rule.id);

      // Send initial notifications
      await this.sendAlertNotifications(alert, rule, 0);

      // Set up escalation if needed
      if (rule.escalation_policy.levels.length > 1) {
        this.scheduleEscalation(alert, rule);
      }

      // Store in database
      await this.persistAlert(alert);

      logDebug(`✅ Alert triggered successfully: ${alert.id}`, "Debug");

    } catch (error) {
      logError('Failed to trigger alert:', "Error", error);
      trackError(error as Error, {
        component: 'SecurityAlertingEngine',
        method: 'triggerAlert',
        rule: rule.name
      });
    }
  }

  private generateAlertDescription(rule: AlertRule, event: any): string {
    const base = rule.description;
    const eventDetails = [];

    if (event.event_type) eventDetails.push(`Event: ${event.event_type}`);
    if (event.user_id) eventDetails.push(`User: ${event.user_id}`);
    if (event.risk_score) eventDetails.push(`Risk: ${event.risk_score}/100`);
    if (event.ip_address) eventDetails.push(`IP: ${event.ip_address}`);

    return eventDetails.length > 0 
      ? `${base}\n\nDetails: ${eventDetails.join(', ')}`
      : base;
  }

  private async sendAlertNotifications(
    alert: SecurityAlert, 
    rule: AlertRule, 
    escalationLevel: number
  ): Promise<void> {
    const channels = escalationLevel < rule.escalation_policy.levels.length
      ? rule.escalation_policy.levels[escalationLevel].channels
      : rule.channels;

    const sortedChannels = channels
      .filter(channel => channel.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const channel of sortedChannels) {
      try {
        await this.sendNotificationToChannel(alert, channel, escalationLevel);
      } catch (error) {
        logError(`Failed to send notification to ${channel.type}:`, "Error", error);
      }
    }
  }

  private async sendNotificationToChannel(
    alert: SecurityAlert, 
    channel: AlertChannel, 
    escalationLevel: number
  ): Promise<void> {
    switch (channel.type) {
      case 'push_notification':
        await this.sendPushNotification(alert, channel, escalationLevel);
        break;
        
      case 'sentry':
        await this.sendSentryAlert(alert, channel);
        break;
        
      case 'database':
        await this.sendDatabaseAlert(alert, channel);
        break;
        
      case 'webhook':
        await this.sendWebhookAlert(alert, channel);
        break;
        
      default:
        logWarn(`Unknown alert channel type: ${channel.type}`, "Warning");
    }
  }

  private async sendPushNotification(
    alert: SecurityAlert, 
    channel: AlertChannel, 
    escalationLevel: number
  ): Promise<void> {
    try {
      const isEscalated = escalationLevel > 0;
      const title = isEscalated 
        ? `🔴 ESCALATED: ${alert.title}`
        : `🚨 ${alert.title}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: alert.description,
          categoryIdentifier: alert.severity === 'CRITICAL' ? 'security_critical' : 'security_high',
          sound: channel.config.sound || (alert.severity === 'CRITICAL' ? 'critical' : 'default'),
          priority: alert.severity === 'CRITICAL' 
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
          data: {
            alert_id: alert.id,
            rule_id: alert.rule_id,
            severity: alert.severity,
            escalation_level: escalationLevel
          }
        },
        trigger: channel.config.immediate ? null : ({ type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false } as any)
      });

      logDebug(`📱 Push notification sent for alert: ${alert.id}`, "Debug");

    } catch (error) {
      logError('Failed to send push notification:', "Error", error);
    }
  }

  private async sendSentryAlert(alert: SecurityAlert, channel: AlertChannel): Promise<void> {
    try {
      const sentryLevel = channel.config.level || 'error';
      const context = {
        alert_data: alert,
        channel_config: channel.config,
        requires_immediate_attention: alert.severity === 'CRITICAL',
        ...channel.config
      };

      if (sentryLevel === 'fatal' || alert.severity === 'CRITICAL') {
        trackCriticalError(
          new Error(`SECURITY ALERT: ${alert.title}`),
          context
        );
      } else {
        trackError(
          new Error(`Security Alert: ${alert.title}`),
          context
        );
      }

      logDebug(`📊 Sentry alert sent for: ${alert.id}`, "Debug");

    } catch (error) {
      logError('Failed to send Sentry alert:', "Error", error);
    }
  }

  private async sendDatabaseAlert(alert: SecurityAlert, channel: AlertChannel): Promise<void> {
    try {
      const tableName = channel.config.table || 'security_alerts';
      
      const { error } = await supabase
        .from(tableName)
        .insert({
          alert_id: alert.id,
          rule_id: alert.rule_id,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          event_data: alert.event_data,
          status: alert.status,
          triggered_at: alert.triggered_at,
          metadata: alert.metadata,
          urgent: channel.config.urgent || false
        });

      if (error) {
        throw error;
      }

      logDebug(`💾 Database alert stored for: ${alert.id}`, "Debug");

    } catch (error) {
      logError('Failed to send database alert:', "Error", error);
    }
  }

  private async sendWebhookAlert(alert: SecurityAlert, channel: AlertChannel): Promise<void> {
    try {
      const webhookUrl = channel.config.url;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }

      const payload = {
        alert: alert,
        timestamp: new Date().toISOString(),
        source: 'stellr_security_system',
        ...channel.config.payload
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...channel.config.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      logDebug(`🔗 Webhook alert sent for: ${alert.id}`, "Debug");

    } catch (error) {
      logError('Failed to send webhook alert:', "Error", error);
    }
  }

  // ===============================================================================
  // ESCALATION MANAGEMENT
  // ===============================================================================

  private scheduleEscalation(alert: SecurityAlert, rule: AlertRule): void {
    const escalationDelay = rule.escalation_policy.escalation_delay * 60 * 1000; // Convert to ms
    
    const timer = setTimeout(async () => {
      await this.escalateAlert(alert.id, rule);
    }, escalationDelay);

    this.escalationTimers.set(alert.id, timer);
  }

  private async escalateAlert(alertId: string, rule: AlertRule): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert || alert.status !== 'active') {
        return;
      }

      const nextLevel = alert.escalation_level + 1;
      if (nextLevel >= rule.escalation_policy.max_escalations) {
        logDebug(`⚠️ Maximum escalation level reached for alert: ${alertId}`, "Debug");
        return;
      }

      logDebug(`📈 Escalating alert to level ${nextLevel}: ${alertId}`, "Debug");

      alert.escalation_level = nextLevel;
      
      // Send escalated notifications
      await this.sendAlertNotifications(alert, rule, nextLevel);

      // Schedule next escalation if needed
      if (nextLevel < rule.escalation_policy.max_escalations - 1) {
        this.scheduleEscalation(alert, rule);
      }

      // Update in database
      await this.updateAlertInDatabase(alert);

    } catch (error) {
      logError('Failed to escalate alert:', "Error", error);
    }
  }

  public async acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<boolean> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        return false;
      }

      alert.status = 'acknowledged';
      alert.acknowledged_at = new Date().toISOString();
      alert.metadata.acknowledged_by = acknowledgedBy;

      // Cancel escalation timer
      const timer = this.escalationTimers.get(alertId);
      if (timer) {
        clearTimeout(timer);
        this.escalationTimers.delete(alertId);
      }

      // Update in database
      await this.updateAlertInDatabase(alert);

      logDebug(`✅ Alert acknowledged: ${alertId}`, "Debug");
      return true;

    } catch (error) {
      logError('Failed to acknowledge alert:', "Error", error);
      return false;
    }
  }

  public async resolveAlert(alertId: string, resolvedBy?: string, resolution?: string): Promise<boolean> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        return false;
      }

      alert.status = 'resolved';
      alert.resolved_at = new Date().toISOString();
      alert.metadata.resolved_by = resolvedBy;
      alert.metadata.resolution = resolution;

      // Remove from active alerts
      this.activeAlerts.delete(alertId);

      // Cancel escalation timer
      const timer = this.escalationTimers.get(alertId);
      if (timer) {
        clearTimeout(timer);
        this.escalationTimers.delete(alertId);
      }

      // Update in database
      await this.updateAlertInDatabase(alert);

      logDebug(`✅ Alert resolved: ${alertId}`, "Debug");
      return true;

    } catch (error) {
      logError('Failed to resolve alert:', "Error", error);
      return false;
    }
  }

  // ===============================================================================
  // THROTTLING AND MAINTENANCE
  // ===============================================================================

  private async isRuleThrottled(ruleId: string): Promise<boolean> {
    const rule = this.alertRules.get(ruleId);
    if (!rule?.throttling.enabled) {
      return false;
    }

    const counter = this.throttleCounters.get(ruleId);
    if (!counter) {
      return false;
    }

    const now = Date.now();
    if (now > counter.resetTime) {
      // Reset counter
      this.throttleCounters.delete(ruleId);
      return false;
    }

    // Check hourly and daily limits
    const hourlyExceeded = counter.count >= rule.throttling.max_alerts_per_hour;
    const dailyExceeded = counter.count >= rule.throttling.max_alerts_per_day;

    return hourlyExceeded || dailyExceeded;
  }

  private updateThrottleCounter(ruleId: string): void {
    const rule = this.alertRules.get(ruleId);
    if (!rule?.throttling.enabled) {
      return;
    }

    const now = Date.now();
    const resetTime = now + (rule.throttling.cooldown_period * 60 * 1000);
    
    const counter = this.throttleCounters.get(ruleId);
    if (counter && now <= counter.resetTime) {
      counter.count++;
    } else {
      this.throttleCounters.set(ruleId, { count: 1, resetTime });
    }
  }

  private performMaintenance(): void {
    try {
      // Clean up old throttle counters
      const now = Date.now();
      for (const [ruleId, counter] of this.throttleCounters.entries()) {
        if (now > counter.resetTime) {
          this.throttleCounters.delete(ruleId);
        }
      }

      // Clean up old alert history (keep last 1000 alerts)
      if (this.alertHistory.length > 1000) {
        this.alertHistory = this.alertHistory.slice(-1000);
      }

      // Check for stale active alerts
      const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
      for (const [alertId, alert] of this.activeAlerts.entries()) {
        if (Date.now() - new Date(alert.triggered_at).getTime() > staleThreshold) {
          logWarn(`Marking stale alert as resolved: ${alertId}`, "Warning");
          this.resolveAlert(alertId, 'system', 'auto_resolved_stale');
        }
      }

      logDebug('🧹 Performed alerting system maintenance', "Debug");

    } catch (error) {
      logError('Maintenance failed:', "Error", error);
    }
  }

  // ===============================================================================
  // DATABASE OPERATIONS
  // ===============================================================================

  private async persistAlert(alert: SecurityAlert): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .insert({
          id: alert.id,
          rule_id: alert.rule_id,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          event_data: alert.event_data,
          triggered_at: alert.triggered_at,
          escalation_level: alert.escalation_level,
          status: alert.status,
          metadata: alert.metadata
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logError('Failed to persist alert:', "Error", error);
    }
  }

  private async updateAlertInDatabase(alert: SecurityAlert): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          status: alert.status,
          acknowledged_at: alert.acknowledged_at,
          resolved_at: alert.resolved_at,
          escalation_level: alert.escalation_level,
          metadata: alert.metadata
        })
        .eq('id', alert.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      logError('Failed to update alert in database:', "Error", error);
    }
  }

  // ===============================================================================
  // PUBLIC API
  // ===============================================================================

  public getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(): SecurityAlert[] {
    return this.alertHistory.slice();
  }

  public async getAlertingMetrics(): Promise<AlertingMetrics> {
    const totalAlerts = this.alertHistory.length;
    const criticalAlerts = this.alertHistory.filter(a => a.severity === 'CRITICAL').length;
    const acknowledgedAlerts = this.alertHistory.filter(a => a.acknowledged_at).length;
    
    // Calculate mean times (simplified calculation)
    const acknowledgedAlertsWithTimes = this.alertHistory.filter(a => a.acknowledged_at && a.triggered_at);
    const meanTimeToAcknowledge = acknowledgedAlertsWithTimes.length > 0
      ? acknowledgedAlertsWithTimes.reduce((sum, alert) => {
          return sum + (new Date(alert.acknowledged_at!).getTime() - new Date(alert.triggered_at).getTime());
        }, 0) / acknowledgedAlertsWithTimes.length / 1000 / 60 // Convert to minutes
      : 0;

    const resolvedAlertsWithTimes = this.alertHistory.filter(a => a.resolved_at && a.triggered_at);
    const meanTimeToResolve = resolvedAlertsWithTimes.length > 0
      ? resolvedAlertsWithTimes.reduce((sum, alert) => {
          return sum + (new Date(alert.resolved_at!).getTime() - new Date(alert.triggered_at).getTime());
        }, 0) / resolvedAlertsWithTimes.length / 1000 / 60 // Convert to minutes
      : 0;

    const escalatedAlerts = this.alertHistory.filter(a => a.escalation_level > 0).length;
    const escalationRate = totalAlerts > 0 ? escalatedAlerts / totalAlerts : 0;

    return {
      total_alerts: totalAlerts,
      critical_alerts: criticalAlerts,
      acknowledged_alerts: acknowledgedAlerts,
      mean_time_to_acknowledge: Math.round(meanTimeToAcknowledge),
      mean_time_to_resolve: Math.round(meanTimeToResolve),
      false_positive_rate: 0, // Would need feedback system to calculate
      escalation_rate: Math.round(escalationRate * 100) / 100
    };
  }

  public addCustomRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;
    
    this.alertRules.set(ruleId, { ...rule, ...updates });
    return true;
  }

  public async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    // Clear counters
    this.throttleCounters.clear();

    this.isInitialized = false;
    logDebug('🧹 Security Alerting Engine cleaned up', "Debug");
  }
}

// Export singleton instance
export const securityAlertingEngine = new SecurityAlertingEngine();

// Export convenience functions
export const acknowledgeSecurityAlert = async (alertId: string, acknowledgedBy?: string) => {
  return await securityAlertingEngine.acknowledgeAlert(alertId, acknowledgedBy);
};

export const resolveSecurityAlert = async (alertId: string, resolvedBy?: string, resolution?: string) => {
  return await securityAlertingEngine.resolveAlert(alertId, resolvedBy, resolution);
};

export const getActiveSecurityAlerts = () => {
  return securityAlertingEngine.getActiveAlerts();
};

export const getSecurityAlertingMetrics = async () => {
  return await securityAlertingEngine.getAlertingMetrics();
};

export default securityAlertingEngine;
