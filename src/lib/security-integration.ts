// ===============================================================================
// STELLR SECURITY SYSTEM INTEGRATION
// ===============================================================================
// Purpose: Unified integration layer for security monitoring across all systems
// Components: Sentry integration, Supabase audit integration, threat response coordination
// ===============================================================================
import { supabase } from './supabase';
import { 
  trackError, 
  trackCriticalError, 
  trackUserAction, 
  setUserContext,
  trackAPICall,
  trackMatchingError,
  trackMessagingError,
  trackPaymentError
} from './sentry-enhanced';
import { securityMonitor, logAuthEvent, logDataAccess, logSecurityViolation } from './security-monitor';
import { threatDetectionEngine } from './threat-detection';
import { useSecurity, useSecureData } from '../hooks/useSecurity';
import { secureStorage } from '../utils/secure-storage';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export interface SecurityIntegrationConfig {
  enableSentryIntegration: boolean;
  enableSupabaseAuditIntegration: boolean;
  enableThreatDetection: boolean;
  enableComplianceLogging: boolean;
  enableRealTimeMonitoring: boolean;
  alertThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
}

export interface SecurityContext {
  userId?: string;
  sessionId: string;
  deviceFingerprint: string;
  ipAddress?: string;
  userAgent?: string;
  location?: { latitude: number; longitude: number };
  appVersion: string;
  buildNumber: string;
}

export interface SecurityEventPayload {
  eventType: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'authentication' | 'authorization' | 'data_access' | 'security_violation' | 'threat_detected';
  context: Record<string, any>;
  threatIndicators?: string[];
  riskScore?: number;
  requiresImmedateAction?: boolean;
}

// ===============================================================================
// MAIN SECURITY INTEGRATION CLASS
// ===============================================================================

class SecurityIntegration {
  private config: SecurityIntegrationConfig;
  private securityContext: SecurityContext | null = null;
  private isInitialized = false;
  private eventQueue: SecurityEventPayload[] = [];
  private batchProcessingInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<SecurityIntegrationConfig> = {}) {
    this.config = {
      enableSentryIntegration: true,
      enableSupabaseAuditIntegration: true,
      enableThreatDetection: true,
      enableComplianceLogging: true,
      enableRealTimeMonitoring: true,
      alertThresholds: {
        critical: 90,
        high: 70,
        medium: 50
      },
      ...config
    };
  }

  // ===============================================================================
  // INITIALIZATION
  // ===============================================================================

  async initialize(userId?: string): Promise<void> {
    try {
      logDebug('🔧 Initializing Security Integration System...', "Debug");
      
      // Initialize security context
      this.securityContext = await this.buildSecurityContext(userId);
      
      // Set up Sentry user context if enabled
      if (this.config.enableSentryIntegration && userId) {
        await this.setupSentryIntegration(userId);
      }
      
      // Initialize threat detection if enabled
      if (this.config.enableThreatDetection) {
        await this.initializeThreatDetection(userId);
      }
      
      // Set up batch processing for events
      if (this.config.enableRealTimeMonitoring) {
        this.startBatchProcessing();
      }
      
      // Set up database integration
      if (this.config.enableSupabaseAuditIntegration) {
        await this.setupSupabaseIntegration();
      }
      
      this.isInitialized = true;
      logDebug('✅ Security Integration System initialized successfully', "Debug");
      
      // Log initialization success
      await this.logSecurityEvent({
        eventType: 'security_system_initialized',
        severity: 'INFO',
        category: 'authentication',
        context: {
          userId,
          features_enabled: this.getEnabledFeatures(),
          initialization_timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logError('❌ Security Integration initialization failed:', "Error", error);
      trackCriticalError(error as Error, {
        component: 'SecurityIntegration',
        method: 'initialize',
        userId,
        config: this.config
      });
      throw error;
    }
  }

  private async buildSecurityContext(userId?: string): Promise<SecurityContext> {
    const sessionId = securityMonitor.getSessionId();
    const metrics = securityMonitor.getSecurityMetrics();
    
    return {
      userId,
      sessionId,
      deviceFingerprint: metrics.deviceFingerprint,
      appVersion: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
      buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER || 'unknown'
    };
  }

  private async setupSentryIntegration(userId: string): Promise<void> {
    try {
      // Get user profile for Sentry context
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, onboarding_completed')
        .eq('id', userId)
        .single();

      const { data: user } = await supabase
        .from('users')
        .select('email, subscription_status')
        .eq('auth_user_id', userId)
        .single();

      // Set enhanced user context in Sentry
      setUserContext({
        id: userId,
        email: user?.email,
        onboardingCompleted: profile?.onboarding_completed || false,
        subscriptionStatus: user?.subscription_status || 'unknown',
        profileCompleted: !!profile?.display_name
      });

      logDebug('✅ Sentry integration configured', "Debug");
    } catch (error) {
      logError('⚠️ Sentry integration setup failed:', "Error", error);
    }
  }

  private async initializeThreatDetection(userId?: string): Promise<void> {
    try {
      if (userId) {
        // Initialize behavioral profile for threat detection
        // This would typically load historical behavior patterns
        await this.loadUserBehaviorProfile(userId);
      }
      
      logDebug('✅ Threat detection initialized', "Debug");
    } catch (error) {
      logError('⚠️ Threat detection initialization failed:', "Error", error);
    }
  }

  private async setupSupabaseIntegration(): Promise<void> {
    try {
      // Set up real-time subscriptions for security events
      if (this.config.enableRealTimeMonitoring) {
        this.setupRealtimeSecurityMonitoring();
      }
      
      logDebug('✅ Supabase audit integration configured', "Debug");
    } catch (error) {
      logError('⚠️ Supabase integration setup failed:', "Error", error);
    }
  }

  private setupRealtimeSecurityMonitoring(): void {
    // Subscribe to threat detection events
    supabase
      .channel('security-threats')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'threat_detection_log'
      }, (payload) => {
        this.handleRealtimeThreatAlert(payload.new as any);
      })
      .subscribe();

    // Subscribe to high-risk security events
    supabase
      .channel('security-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_audit_comprehensive',
        filter: 'severity=eq.CRITICAL'
      }, (payload) => {
        this.handleRealtimeSecurityAlert(payload.new as any);
      })
      .subscribe();
  }

  private startBatchProcessing(): void {
    this.batchProcessingInterval = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.processBatchedEvents();
      }
    }, 5000); // Process every 5 seconds
  }

  // ===============================================================================
  // EVENT LOGGING AND PROCESSING
  // ===============================================================================

  async logSecurityEvent(event: SecurityEventPayload): Promise<void> {
    if (!this.isInitialized) {
      logWarn('Security Integration not initialized, "Warning", queueing event');
      this.eventQueue.push(event);
      return;
    }

    try {
      const enrichedEvent = this.enrichEvent(event);
      
      // Immediate processing for critical events
      if (event.severity === 'CRITICAL' || event.requiresImmedateAction) {
        await this.processEventImmediately(enrichedEvent);
      } else {
        // Queue for batch processing
        this.eventQueue.push(enrichedEvent);
      }

      // Always log to local security monitor for real-time analysis
      await securityMonitor.logSecurityEvent({
        eventCategory: event.category,
        eventType: event.eventType,
        severity: event.severity,
        userId: this.securityContext?.userId,
        context: enrichedEvent.context,
        threatIndicators: event.threatIndicators,
        riskScore: event.riskScore
      });

    } catch (error) {
      logError('Failed to log security event:', "Error", error);
      trackError(error as Error, {
        component: 'SecurityIntegration',
        method: 'logSecurityEvent',
        originalEvent: event
      });
    }
  }

  private enrichEvent(event: SecurityEventPayload): SecurityEventPayload {
    return {
      ...event,
      context: {
        ...event.context,
        security_context: this.securityContext,
        timestamp: Date.now(),
        correlation_id: this.generateCorrelationId()
      }
    };
  }

  private async processEventImmediately(event: SecurityEventPayload): Promise<void> {
    await Promise.all([
      this.logToSentry(event),
      this.logToSupabase(event),
      this.triggerThreatDetection(event),
      this.checkComplianceRequirements(event)
    ]);
  }

  private async processBatchedEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Process events in parallel batches
      const batchSize = 10;
      for (let i = 0; i < eventsToProcess.length; i += batchSize) {
        const batch = eventsToProcess.slice(i, i + batchSize);
        await Promise.all(batch.map(event => this.processEvent(event)));
      }
    } catch (error) {
      logError('Batch event processing failed:', "Error", error);
      // Re-queue failed events
      this.eventQueue.unshift(...eventsToProcess);
    }
  }

  private async processEvent(event: SecurityEventPayload): Promise<void> {
    try {
      await Promise.all([
        this.config.enableSentryIntegration ? this.logToSentry(event) : Promise.resolve(),
        this.config.enableSupabaseAuditIntegration ? this.logToSupabase(event) : Promise.resolve(),
        this.config.enableThreatDetection ? this.triggerThreatDetection(event) : Promise.resolve(),
        this.config.enableComplianceLogging ? this.checkComplianceRequirements(event) : Promise.resolve()
      ]);
    } catch (error) {
      logError('Event processing failed:', "Error", error);
      throw error;
    }
  }

  // ===============================================================================
  // INTEGRATION METHODS
  // ===============================================================================

  private async logToSentry(event: SecurityEventPayload): Promise<void> {
    try {
      const sentryContext = {
        security_event: event,
        security_context: this.securityContext,
        integration_timestamp: new Date().toISOString()
      };

      switch (event.severity) {
        case 'CRITICAL':
          trackCriticalError(
            new Error(`CRITICAL SECURITY EVENT: ${event.eventType}`),
            sentryContext
          );
          break;
          
        case 'HIGH':
          trackError(
            new Error(`High Priority Security Event: ${event.eventType}`),
            sentryContext
          );
          break;
          
        case 'MEDIUM':
        case 'LOW':
          trackUserAction(`security:${event.eventType}`, sentryContext);
          break;
          
        default:
          trackUserAction(`security:${event.eventType}`, sentryContext);
      }
    } catch (error) {
      logError('Sentry logging failed:', "Error", error);
    }
  }

  private async logToSupabase(event: SecurityEventPayload): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_security_event', {
        p_event_category: event.category,
        p_event_type: event.eventType,
        p_severity: event.severity,
        p_user_id: this.securityContext?.userId || null,
        p_context: event.context,
        p_threat_indicators: event.threatIndicators || [],
        p_risk_score: event.riskScore || null
      });

      if (error) {
        throw error;
      }

      // Also log compliance event if required
      if (this.config.enableComplianceLogging && this.isComplianceRelevant(event)) {
        await this.logComplianceEvent(event);
      }
    } catch (error) {
      logError('Supabase audit logging failed:', "Error", error);
      throw error;
    }
  }

  private async triggerThreatDetection(event: SecurityEventPayload): Promise<void> {
    try {
      if (!this.securityContext?.userId) return;

      // Collect recent security events for threat analysis
      const recentEvents = await this.getRecentSecurityEvents(this.securityContext.userId);
      
      // Run threat detection
      const threats = await threatDetectionEngine.detectThreats(
        this.securityContext.userId,
        event.context,
        recentEvents
      );

      // Process detected threats
      for (const threat of threats) {
        await this.handleDetectedThreat(threat);
      }
    } catch (error) {
      logError('Threat detection failed:', "Error", error);
    }
  }

  private async checkComplianceRequirements(event: SecurityEventPayload): Promise<void> {
    try {
      // Check if event requires compliance logging
      if (this.isComplianceRelevant(event)) {
        await this.logComplianceEvent(event);
      }

      // Check for data breach notification requirements
      if (this.isDataBreachEvent(event)) {
        await this.handleDataBreachEvent(event);
      }

      // Check for consent-related events
      if (this.isConsentRelevant(event)) {
        await this.handleConsentEvent(event);
      }
    } catch (error) {
      logError('Compliance checking failed:', "Error", error);
    }
  }

  // ===============================================================================
  // SPECIALIZED LOGGING METHODS
  // ===============================================================================

  async logAuthenticationEvent(
    eventType: string, 
    success: boolean, 
    context?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType,
      severity: success ? 'INFO' : 'MEDIUM',
      category: 'authentication',
      context: {
        ...context,
        authentication_success: success,
        timestamp: Date.now()
      }
    });

    // Enhanced Sentry logging for auth events
    if (this.config.enableSentryIntegration) {
      if (success) {
        trackUserAction('auth:success', { eventType, ...context });
      } else {
        trackError(new Error(`Authentication failed: ${eventType}`), {
          auth_context: context,
          security_relevant: true
        });
      }
    }
  }

  async logDataAccessEvent(
    resourceType: string, 
    resourceId: string, 
    operation: string, 
    context?: Record<string, any>
  ): Promise<void> {
    const isSensitiveResource = this.isSensitiveResource(resourceType);
    
    await this.logSecurityEvent({
      eventType: `${resourceType}_${operation}`,
      severity: isSensitiveResource ? 'MEDIUM' : 'INFO',
      category: 'data_access',
      context: {
        ...context,
        resource_type: resourceType,
        resource_id: resourceId,
        operation,
        sensitive_data: isSensitiveResource
      }
    });
  }

  async logAPICall(
    endpoint: string, 
    method: string, 
    statusCode: number, 
    duration: number,
    error?: string
  ): Promise<void> {
    // Log to Sentry API tracking
    if (this.config.enableSentryIntegration) {
      trackAPICall(endpoint, method, duration, statusCode, error);
    }

    // Log security event for failed or slow API calls
    if (statusCode >= 400 || duration > 5000 || error) {
      await this.logSecurityEvent({
        eventType: 'api_call_anomaly',
        severity: statusCode >= 500 ? 'HIGH' : 'MEDIUM',
        category: 'security_violation',
        context: {
          endpoint,
          method,
          status_code: statusCode,
          duration,
          error,
          performance_issue: duration > 5000,
          client_error: statusCode >= 400 && statusCode < 500,
          server_error: statusCode >= 500
        }
      });
    }
  }

  async logBusinessEvent(
    eventType: string, 
    category: 'matching' | 'messaging' | 'payment' | 'subscription',
    context?: Record<string, any>,
    error?: Error
  ): Promise<void> {
    // Log to specialized Sentry trackers
    if (this.config.enableSentryIntegration && error) {
      switch (category) {
        case 'matching':
          trackMatchingError(error, context as any);
          break;
        case 'messaging':
          trackMessagingError(error, context as any);
          break;
        case 'payment':
          trackPaymentError(error, context as any);
          break;
      }
    }

    // Log security event
    await this.logSecurityEvent({
      eventType: `${category}_${eventType}`,
      severity: error ? 'HIGH' : 'INFO',
      category: 'data_access',
      context: {
        ...context,
        business_category: category,
        has_error: !!error,
        error_message: error?.message
      }
    });
  }

  // ===============================================================================
  // HELPER METHODS
  // ===============================================================================

  private async loadUserBehaviorProfile(userId: string): Promise<void> {
    try {
      const { data: profile } = await supabase
        .from('user_behavior_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profile) {
        // Initialize threat detection with user's behavior profile
        await secureStorage.storeSecureItem(
          `behavior_profile_${userId}`,
          JSON.stringify(profile)
        );
      }
    } catch (error) {
      logWarn('Could not load user behavior profile:', "Warning", error);
    }
  }

  private async getRecentSecurityEvents(userId: string): Promise<any[]> {
    try {
      const { data: events } = await supabase
        .from('security_audit_comprehensive')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(100);

      return events || [];
    } catch (error) {
      logError('Failed to get recent security events:', "Error", error);
      return [];
    }
  }

  private async handleDetectedThreat(threat: any): Promise<void> {
    logWarn('🚨 Threat detected:', "Warning", threat);
    
    await this.logSecurityEvent({
      eventType: 'threat_detected',
      severity: threat.severity || 'HIGH',
      category: 'threat_detected',
      context: {
        threat_id: threat.threat_id,
        threat_type: threat.threat_type,
        confidence: threat.confidence,
        risk_score: threat.risk_score,
        evidence: threat.evidence
      },
      threatIndicators: threat.indicators,
      riskScore: threat.risk_score,
      requiresImmedateAction: threat.auto_mitigate
    });
  }

  private async handleRealtimeThreatAlert(threatData: any): Promise<void> {
    if (threatData.user_id === this.securityContext?.userId) {
      logWarn('🚨 Real-time threat alert received:', "Warning", threatData);
      
      // Trigger immediate security response if needed
      if (threatData.severity === 'CRITICAL') {
        await this.triggerEmergencyResponse(threatData);
      }
    }
  }

  private async handleRealtimeSecurityAlert(alertData: any): Promise<void> {
    if (alertData.user_id === this.securityContext?.userId) {
      logWarn('⚠️ Real-time security alert received:', "Warning", alertData);
      
      // Update local security state
      securityMonitor.logSecurityEvent({
        eventCategory: 'security_violation',
        eventType: 'realtime_alert_received',
        severity: 'HIGH',
        context: alertData
      });
    }
  }

  private async triggerEmergencyResponse(threatData: any): Promise<void> {
    logError('🚨 EMERGENCY SECURITY RESPONSE TRIGGERED', "Error");
    
    // Immediately alert security team via Sentry
    trackCriticalError(
      new Error(`EMERGENCY: ${threatData.threat_type}`),
      {
        requires_immediate_attention: true,
        threat_data: threatData,
        user_id: this.securityContext?.userId,
        session_id: this.securityContext?.sessionId
      }
    );

    // Log emergency response
    await this.logSecurityEvent({
      eventType: 'emergency_response_triggered',
      severity: 'CRITICAL',
      category: 'security_violation',
      context: {
        trigger_threat: threatData,
        response_timestamp: Date.now()
      },
      requiresImmedateAction: true
    });
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private getEnabledFeatures(): string[] {
    return Object.entries(this.config)
      .filter(([_, enabled]) => enabled === true)
      .map(([feature, _]) => feature);
  }

  private isSensitiveResource(resourceType: string): boolean {
    const sensitiveResources = [
      'profiles', 'users', 'messages', 'payment_methods', 
      'personal_data', 'location_data', 'conversation_data'
    ];
    return sensitiveResources.includes(resourceType);
  }

  private isComplianceRelevant(event: SecurityEventPayload): boolean {
    const complianceEvents = [
      'data_access', 'data_modification', 'data_deletion',
      'consent_given', 'consent_withdrawn', 'data_breach'
    ];
    return complianceEvents.some(type => event.eventType.includes(type));
  }

  private isDataBreachEvent(event: SecurityEventPayload): boolean {
    return event.eventType.includes('breach') || 
           event.eventType.includes('unauthorized_access') ||
           (event.severity === 'CRITICAL' && event.category === 'security_violation');
  }

  private isConsentRelevant(event: SecurityEventPayload): boolean {
    return event.eventType.includes('consent') || 
           event.eventType.includes('privacy_setting');
  }

  private async logComplianceEvent(event: SecurityEventPayload): Promise<void> {
    try {
      await supabase.rpc('log_compliance_event', {
        p_user_id: this.securityContext?.userId || null,
        p_action_type: this.mapToComplianceAction(event.eventType),
        p_action_description: `Security event: ${event.eventType}`,
        p_legal_basis: 'legitimate_interest',
        p_processing_purpose: 'security_monitoring',
        p_context: event.context
      });
    } catch (error) {
      logError('Compliance logging failed:', "Error", error);
    }
  }

  private async handleDataBreachEvent(event: SecurityEventPayload): Promise<void> {
    logError('🚨 POTENTIAL DATA BREACH EVENT DETECTED', "Error");
    
    // Immediate critical alert
    trackCriticalError(
      new Error(`DATA BREACH: ${event.eventType}`),
      {
        requires_immediate_attention: true,
        potential_data_breach: true,
        event_data: event,
        notification_required: true
      }
    );
  }

  private async handleConsentEvent(event: SecurityEventPayload): Promise<void> {
    // Log consent changes for GDPR compliance
    await this.logComplianceEvent(event);
  }

  private mapToComplianceAction(eventType: string): string {
    if (eventType.includes('access')) return 'data_access';
    if (eventType.includes('modify') || eventType.includes('update')) return 'data_modification';
    if (eventType.includes('delete')) return 'data_deletion';
    if (eventType.includes('consent')) return 'consent_given';
    return 'data_processing';
  }

  // ===============================================================================
  // PUBLIC API
  // ===============================================================================

  getSecurityContext(): SecurityContext | null {
    return this.securityContext;
  }

  async generateSecurityReport(): Promise<any> {
    const metrics = securityMonitor.getSecurityMetrics();
    const recentEvents = this.securityContext?.userId 
      ? await this.getRecentSecurityEvents(this.securityContext.userId)
      : [];

    return {
      security_context: this.securityContext,
      configuration: this.config,
      metrics,
      recent_events_count: recentEvents.length,
      queued_events: this.eventQueue.length,
      integration_status: {
        initialized: this.isInitialized,
        sentry_enabled: this.config.enableSentryIntegration,
        supabase_enabled: this.config.enableSupabaseAuditIntegration,
        threat_detection_enabled: this.config.enableThreatDetection
      },
      generated_at: new Date().toISOString()
    };
  }

  async cleanup(): Promise<void> {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
    }
    
    // Process any remaining events
    if (this.eventQueue.length > 0) {
      await this.processBatchedEvents();
    }
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const securityIntegration = new SecurityIntegration();

// Export convenience functions that integrate everything
export const logSecureAuthEvent = async (eventType: string, success: boolean, context?: any) => {
  await securityIntegration.logAuthenticationEvent(eventType, success, context);
};

export const logSecureDataAccess = async (resourceType: string, resourceId: string, operation: string, context?: any) => {
  await securityIntegration.logDataAccessEvent(resourceType, resourceId, operation, context);
};

export const logSecureAPICall = async (endpoint: string, method: string, statusCode: number, duration: number, error?: string) => {
  await securityIntegration.logAPICall(endpoint, method, statusCode, duration, error);
};

export const logSecureBusinessEvent = async (eventType: string, category: 'matching' | 'messaging' | 'payment' | 'subscription', context?: any, error?: Error) => {
  await securityIntegration.logBusinessEvent(eventType, category, context, error);
};

export default securityIntegration;
