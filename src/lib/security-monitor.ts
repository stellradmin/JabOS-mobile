// ===============================================================================
// STELLR SECURITY MONITORING SYSTEM
// ===============================================================================
// Purpose: Client-side security event monitoring and threat detection
// Integration: Works with Sentry, Supabase audit system, and backend triggers
// Features: Real-time monitoring, anomaly detection, automated response
// ===============================================================================
import { supabase } from './supabase';
import { trackError, trackCriticalError, trackUserAction } from './sentry-enhanced';
import { secureStorage } from '../utils/secure-storage';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import * as Location from 'expo-location';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for security monitoring
export interface SecurityEvent {
  id?: string;
  eventCategory: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'security_violation' | 'threat_detected';
  eventType: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  context?: Record<string, any>;
  riskScore?: number;
  threatIndicators?: string[];
  metadata?: Record<string, any>;
}

export interface ThreatDetectionResult {
  threatDetected: boolean;
  threatType?: string;
  confidence: number;
  riskScore: number;
  indicators: string[];
  recommendedActions: string[];
}

export interface SecurityMetrics {
  sessionStartTime: number;
  totalActions: number;
  highRiskActions: number;
  suspiciousPatterns: string[];
  deviceFingerprint: string;
  networkChanges: number;
  locationChanges: number;
}

class SecurityMonitor {
  private sessionId: string = '';
  private deviceFingerprint: string = '';
  private sessionStartTime: number = Date.now();
  private securityMetrics: SecurityMetrics;
  private eventQueue: SecurityEvent[] = [];
  private isMonitoring: boolean = false;
  private lastLocation: { latitude: number; longitude: number } | null = null;
  private lastNetworkState: any = null;
  private riskFactors: Map<string, number> = new Map();
  private suspiciousPatterns: string[] = [];

  constructor() {
    this.securityMetrics = {
      sessionStartTime: Date.now(),
      totalActions: 0,
      highRiskActions: 0,
      suspiciousPatterns: [],
      deviceFingerprint: '',
      networkChanges: 0,
      locationChanges: 0,
    };
    
    this.initialize();
  }

  // ===============================================================================
  // INITIALIZATION AND SETUP
  // ===============================================================================

  private async initialize(): Promise<void> {
    try {
      this.sessionId = await this.generateSessionId();
      this.deviceFingerprint = await this.generateDeviceFingerprint();
      this.securityMetrics.deviceFingerprint = this.deviceFingerprint;
      
      await this.setupMonitoring();
      await this.loadSecurityContext();
      
      this.isMonitoring = true;
      logDebug('✅ Security Monitor initialized', "Debug", { sessionId: this.sessionId });
    } catch (error) {
      logError('❌ Failed to initialize Security Monitor:', "Error", error);
      trackError(error as Error, { component: 'SecurityMonitor', method: 'initialize' });
    }
  }

  private async generateSessionId(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const deviceId = await DeviceInfo.getUniqueId();
    return `${deviceId}-${timestamp}-${random}`;
  }

  private async generateDeviceFingerprint(): Promise<string> {
    try {
      const [
        uniqueId,
        brand,
        model,
        systemVersion,
        buildNumber,
        bundleId,
        deviceType,
        hasSystemFeature
      ] = await Promise.all([
        DeviceInfo.getUniqueId(),
        DeviceInfo.getBrand(),
        DeviceInfo.getModel(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getBuildNumber(),
        DeviceInfo.getBundleId(),
        DeviceInfo.getDeviceType(),
        DeviceInfo.getSystemAvailableFeatures(),
      ]);

      const fingerprintData = {
        uniqueId,
        brand,
        model,
        systemVersion,
        buildNumber,
        bundleId,
        deviceType,
        features: hasSystemFeature.slice(0, 10) // Limit to prevent huge fingerprints
      };

      // Generate hash of fingerprint data
      const fingerprint = btoa(JSON.stringify(fingerprintData))
        .replace(/[+/=]/g, '')
        .substring(0, 32);
      
      return fingerprint;
    } catch (error) {
      logWarn('Failed to generate device fingerprint:', "Warning", error);
      return 'unknown-device';
    }
  }

  private async setupMonitoring(): Promise<void> {
    // Monitor network changes
    NetInfo.addEventListener(state => {
      if (this.lastNetworkState && 
          (this.lastNetworkState.type !== state.type || 
           this.lastNetworkState.isConnected !== state.isConnected)) {
        this.securityMetrics.networkChanges++;
        this.logSecurityEvent({
          eventCategory: 'security_violation',
          eventType: 'network_change_detected',
          severity: 'LOW',
          context: {
            previousState: this.lastNetworkState,
            newState: state,
            changeCount: this.securityMetrics.networkChanges
          },
          riskScore: this.securityMetrics.networkChanges > 5 ? 40 : 10
        });
      }
      this.lastNetworkState = state;
    });

    // Monitor location changes (if permission granted)
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Low, timeInterval: 60000 },
          (location) => {
            if (this.lastLocation) {
              const distance = this.calculateDistance(
                this.lastLocation,
                location.coords
              );
              
              // Detect rapid location changes (potential device spoofing)
              if (distance > 50) { // More than 50km
                this.securityMetrics.locationChanges++;
                this.logSecurityEvent({
                  eventCategory: 'security_violation',
                  eventType: 'rapid_location_change',
                  severity: distance > 500 ? 'HIGH' : 'MEDIUM',
                  context: {
                    previousLocation: this.lastLocation,
                    newLocation: { latitude: location.coords.latitude, longitude: location.coords.longitude },
                    distance: distance,
                    timeElapsed: Date.now() - this.sessionStartTime
                  },
                  riskScore: Math.min(90, distance / 10),
                  threatIndicators: ['location_spoofing', 'device_cloning']
                });
              }
            }
            
            this.lastLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            };
          }
        );
      }
    } catch (error) {
      logWarn('Location monitoring not available:', "Warning", error);
    }
  }

  private async loadSecurityContext(): Promise<void> {
    try {
      const storedMetrics = await secureStorage.getSecureItem('security_metrics');
      if (storedMetrics) {
        const metrics = JSON.parse(storedMetrics);
        // Load historical risk factors
        this.riskFactors = new Map(metrics.riskFactors || []);
      }
    } catch (error) {
      logWarn('Failed to load security context:', "Warning", error);
    }
  }

  // ===============================================================================
  // CORE SECURITY EVENT LOGGING
  // ===============================================================================

  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    if (!this.isMonitoring) {
      logWarn('Security Monitor not initialized', "Warning");
      return;
    }

    try {
      // Add session context
      const enrichedEvent: SecurityEvent = {
        ...event,
        context: {
          ...event.context,
          sessionId: this.sessionId,
          deviceFingerprint: this.deviceFingerprint,
          timestamp: Date.now(),
          sessionDuration: Date.now() - this.sessionStartTime
        },
        metadata: {
          ...event.metadata,
          appVersion: process.env.EXPO_PUBLIC_APP_VERSION,
          buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER,
          platform: DeviceInfo.getSystemName(),
          securityMetrics: this.securityMetrics
        }
      };

      // Update metrics
      this.securityMetrics.totalActions++;
      if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
        this.securityMetrics.highRiskActions++;
      }

      // Analyze for threats
      const threatAnalysis = await this.analyzeThreat(enrichedEvent);
      if (threatAnalysis.threatDetected) {
        enrichedEvent.riskScore = Math.max(enrichedEvent.riskScore || 0, threatAnalysis.riskScore);
        enrichedEvent.threatIndicators = [
          ...(enrichedEvent.threatIndicators || []),
          ...threatAnalysis.indicators
        ];
      }

      // Log to database via Supabase
      await this.logToDatabase(enrichedEvent);

      // Log to Sentry for correlation
      await this.logToSentry(enrichedEvent, threatAnalysis);

      // Queue for batch processing if needed
      this.eventQueue.push(enrichedEvent);

      // Execute immediate response for high-risk events
      if (enrichedEvent.severity === 'CRITICAL' || (enrichedEvent.riskScore && enrichedEvent.riskScore > 80)) {
        await this.executeImmediateResponse(enrichedEvent, threatAnalysis);
      }

    } catch (error) {
      logError('Failed to log security event:', "Error", error);
      trackError(error as Error, { 
        component: 'SecurityMonitor', 
        method: 'logSecurityEvent',
        originalEvent: event
      });
    }
  }

  private async logToDatabase(event: SecurityEvent): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_security_event', {
        p_event_category: event.eventCategory,
        p_event_type: event.eventType,
        p_severity: event.severity,
        p_user_id: event.userId || null,
        p_resource_type: event.resourceType || null,
        p_resource_id: event.resourceId || null,
        p_old_data: null,
        p_new_data: null,
        p_context: event.context || {},
        p_ip_address: null, // Will be extracted server-side
        p_user_agent: null, // Will be extracted server-side
        p_threat_indicators: event.threatIndicators || [],
        p_risk_score: event.riskScore || null
      });

      if (error) {
        logError('Database logging error:', "Error", error);
        trackError(new Error(`Database logging failed: ${error.message}`), {
          component: 'SecurityMonitor',
          method: 'logToDatabase',
          event: event
        });
      }
    } catch (error) {
      logError('Failed to log to database:', "Error", error);
    }
  }

  private async logToSentry(event: SecurityEvent, threatAnalysis: ThreatDetectionResult): Promise<void> {
    try {
      const sentryContext = {
        security_event: event,
        threat_analysis: threatAnalysis,
        session_context: {
          sessionId: this.sessionId,
          deviceFingerprint: this.deviceFingerprint,
          metrics: this.securityMetrics
        }
      };

      if (event.severity === 'CRITICAL' || threatAnalysis.threatDetected) {
        trackCriticalError(
          new Error(`Security Event: ${event.eventType}`),
          sentryContext
        );
      } else if (event.severity === 'HIGH') {
        trackError(
          new Error(`High Risk Security Event: ${event.eventType}`),
          sentryContext
        );
      } else {
        trackUserAction(`security:${event.eventType}`, sentryContext);
      }
    } catch (error) {
      logError('Failed to log to Sentry:', "Error", error);
    }
  }

  // ===============================================================================
  // THREAT DETECTION AND ANALYSIS
  // ===============================================================================

  private async analyzeThreat(event: SecurityEvent): Promise<ThreatDetectionResult> {
    const indicators: string[] = [];
    let confidence = 0;
    let riskScore = event.riskScore || 0;
    let threatDetected = false;
    let threatType = '';

    // Analyze authentication patterns
    if (event.eventCategory === 'authentication') {
      const authThreat = this.analyzeAuthenticationThreat(event);
      indicators.push(...authThreat.indicators);
      confidence = Math.max(confidence, authThreat.confidence);
      riskScore = Math.max(riskScore, authThreat.riskScore);
      
      if (authThreat.threatDetected) {
        threatDetected = true;
        threatType = authThreat.threatType || 'authentication_threat';
      }
    }

    // Analyze behavioral patterns
    const behaviorThreat = this.analyzeBehavioralThreat(event);
    indicators.push(...behaviorThreat.indicators);
    confidence = Math.max(confidence, behaviorThreat.confidence);
    riskScore = Math.max(riskScore, behaviorThreat.riskScore);
    
    if (behaviorThreat.threatDetected) {
      threatDetected = true;
      threatType = threatType || behaviorThreat.threatType || 'behavioral_threat';
    }

    // Analyze data access patterns
    if (event.eventCategory === 'data_access' || event.eventCategory === 'data_modification') {
      const dataThreat = this.analyzeDataAccessThreat(event);
      indicators.push(...dataThreat.indicators);
      confidence = Math.max(confidence, dataThreat.confidence);
      riskScore = Math.max(riskScore, dataThreat.riskScore);
      
      if (dataThreat.threatDetected) {
        threatDetected = true;
        threatType = threatType || dataThreat.threatType || 'data_access_threat';
      }
    }

    return {
      threatDetected,
      threatType,
      confidence,
      riskScore,
      indicators: [...new Set(indicators)], // Remove duplicates
      recommendedActions: this.generateRecommendedActions(riskScore, indicators)
    };
  }

  private analyzeAuthenticationThreat(event: SecurityEvent): ThreatDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;
    let riskScore = 0;
    let threatDetected = false;
    let threatType = '';

    // Check for rapid authentication attempts
    const recentAuthEvents = this.eventQueue.filter(e => 
      e.eventCategory === 'authentication' && 
      (Date.now() - (e.context?.timestamp || 0)) < 300000 // 5 minutes
    ).length;

    if (recentAuthEvents > 5) {
      indicators.push('rapid_auth_attempts');
      confidence += 30;
      riskScore += 40;
    }

    // Check for device/location inconsistencies
    if (this.securityMetrics.locationChanges > 3) {
      indicators.push('location_inconsistency');
      confidence += 25;
      riskScore += 35;
    }

    // Check for network switching patterns
    if (this.securityMetrics.networkChanges > 10) {
      indicators.push('network_switching');
      confidence += 20;
      riskScore += 25;
    }

    if (confidence > 50 && riskScore > 60) {
      threatDetected = true;
      threatType = 'authentication_anomaly';
    }

    return {
      threatDetected,
      threatType,
      confidence,
      riskScore,
      indicators,
      recommendedActions: []
    };
  }

  private analyzeBehavioralThreat(event: SecurityEvent): ThreatDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;
    let riskScore = 0;
    let threatDetected = false;
    let threatType = '';

    const sessionDuration = Date.now() - this.sessionStartTime;
    const actionRate = this.securityMetrics.totalActions / (sessionDuration / 60000); // Actions per minute

    // Detect automated behavior (too many actions too quickly)
    if (actionRate > 10) {
      indicators.push('high_action_rate', 'potential_automation');
      confidence += 40;
      riskScore += 50;
      threatType = 'automated_behavior';
      threatDetected = true;
    }

    // Detect suspicious patterns in user journey
    const highRiskRatio = this.securityMetrics.highRiskActions / this.securityMetrics.totalActions;
    if (highRiskRatio > 0.3) {
      indicators.push('high_risk_action_pattern');
      confidence += 30;
      riskScore += 40;
    }

    // Check for data scraping patterns
    if (event.eventType.includes('profile_view') || event.eventType.includes('data_access')) {
      const recentDataAccess = this.eventQueue.filter(e => 
        e.eventType.includes('profile_view') || e.eventType.includes('data_access')
      ).length;

      if (recentDataAccess > 20) {
        indicators.push('data_scraping_pattern');
        confidence += 50;
        riskScore += 70;
        threatType = 'data_scraping';
        threatDetected = true;
      }
    }

    return {
      threatDetected,
      threatType,
      confidence,
      riskScore,
      indicators,
      recommendedActions: []
    };
  }

  private analyzeDataAccessThreat(event: SecurityEvent): ThreatDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;
    let riskScore = 0;
    let threatDetected = false;
    let threatType = '';

    // Check for unusual data access patterns
    if (event.resourceType === 'profiles' || event.resourceType === 'users') {
      const recentProfileAccess = this.eventQueue.filter(e => 
        (e.resourceType === 'profiles' || e.resourceType === 'users') &&
        (Date.now() - (e.context?.timestamp || 0)) < 3600000 // 1 hour
      ).length;

      if (recentProfileAccess > 50) {
        indicators.push('excessive_profile_access');
        confidence += 60;
        riskScore += 80;
        threatType = 'data_exfiltration';
        threatDetected = true;
      }
    }

    // Check for privilege escalation attempts
    if (event.eventType.includes('admin') || event.eventType.includes('elevated')) {
      indicators.push('privilege_escalation_attempt');
      confidence += 80;
      riskScore += 90;
      threatType = 'privilege_escalation';
      threatDetected = true;
    }

    return {
      threatDetected,
      threatType,
      confidence,
      riskScore,
      indicators,
      recommendedActions: []
    };
  }

  private generateRecommendedActions(riskScore: number, indicators: string[]): string[] {
    const actions: string[] = [];

    if (riskScore > 90) {
      actions.push('immediate_account_lockdown', 'security_team_alert', 'session_termination');
    } else if (riskScore > 70) {
      actions.push('enhanced_monitoring', 'multi_factor_auth_required', 'rate_limiting');
    } else if (riskScore > 50) {
      actions.push('increased_logging', 'user_verification', 'throttling');
    }

    // Specific actions based on indicators
    if (indicators.includes('automated_behavior')) {
      actions.push('captcha_challenge', 'behavioral_verification');
    }
    
    if (indicators.includes('location_inconsistency')) {
      actions.push('location_verification', 'device_verification');
    }
    
    if (indicators.includes('data_scraping_pattern')) {
      actions.push('api_rate_limiting', 'access_restriction');
    }

    return [...new Set(actions)];
  }

  // ===============================================================================
  // AUTOMATED RESPONSE SYSTEM
  // ===============================================================================

  private async executeImmediateResponse(
    event: SecurityEvent, 
    threatAnalysis: ThreatDetectionResult
  ): Promise<void> {
    try {
      logWarn('🚨 Executing immediate security response', "Warning", {
        eventType: event.eventType,
        riskScore: event.riskScore,
        threatType: threatAnalysis.threatType,
        recommendedActions: threatAnalysis.recommendedActions
      });

      // Execute recommended actions
      for (const action of threatAnalysis.recommendedActions) {
        await this.executeSecurityAction(action, event, threatAnalysis);
      }

      // Log the response execution
      await this.logSecurityEvent({
        eventCategory: 'security_violation',
        eventType: 'automated_response_executed',
        severity: 'HIGH',
        context: {
          originalEvent: event,
          threatAnalysis: threatAnalysis,
          actionsExecuted: threatAnalysis.recommendedActions
        },
        riskScore: 0 // Response itself is not risky
      });

    } catch (error) {
      logError('Failed to execute immediate response:', "Error", error);
      trackCriticalError(error as Error, {
        component: 'SecurityMonitor',
        method: 'executeImmediateResponse',
        event: event,
        threatAnalysis: threatAnalysis
      });
    }
  }

  private async executeSecurityAction(
    action: string, 
    event: SecurityEvent, 
    threatAnalysis: ThreatDetectionResult
  ): Promise<void> {
    switch (action) {
      case 'session_termination':
        await this.terminateSession();
        break;
        
      case 'enhanced_monitoring':
        this.enableEnhancedMonitoring();
        break;
        
      case 'rate_limiting':
        await this.applyRateLimit();
        break;
        
      case 'security_team_alert':
        await this.alertSecurityTeam(event, threatAnalysis);
        break;
        
      case 'user_verification':
        await this.requestUserVerification();
        break;
        
      default:
        logWarn(`Unknown security action: ${action}`, "Warning");
    }
  }

  private async terminateSession(): Promise<void> {
    try {
      // Clear local session data
      await AsyncStorage.multiRemove(['userToken', 'sessionData', 'userContext']);
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Log termination
      logWarn('🔒 Session terminated due to security threat', "Warning");
      
    } catch (error) {
      logError('Failed to terminate session:', "Error", error);
    }
  }

  private enableEnhancedMonitoring(): void {
    // Increase monitoring frequency and depth
    this.riskFactors.set('enhanced_monitoring', Date.now());
    logWarn('🔍 Enhanced monitoring enabled', "Warning");
  }

  private async applyRateLimit(): Promise<void> {
    // Implement client-side rate limiting
    const rateLimitKey = 'security_rate_limit';
    const currentTime = Date.now();
    const limitUntil = currentTime + (5 * 60 * 1000); // 5 minutes
    
    await secureStorage.storeSecureItem(rateLimitKey, limitUntil.toString());
    logWarn('⏳ Rate limiting applied', "Warning");
  }

  private async alertSecurityTeam(
    event: SecurityEvent, 
    threatAnalysis: ThreatDetectionResult
  ): Promise<void> {
    // Send critical alert to security monitoring
    trackCriticalError(
      new Error(`SECURITY ALERT: ${threatAnalysis.threatType || event.eventType}`),
      {
        severity: 'CRITICAL',
        requires_immediate_attention: true,
        event: event,
        threat_analysis: threatAnalysis,
        session_context: {
          sessionId: this.sessionId,
          deviceFingerprint: this.deviceFingerprint,
          metrics: this.securityMetrics
        }
      }
    );
  }

  private async requestUserVerification(): Promise<void> {
    // This would trigger a user verification flow in the UI
    // For now, just log the request
    logWarn('👤 User verification requested', "Warning");
    
    await this.logSecurityEvent({
      eventCategory: 'security_violation',
      eventType: 'user_verification_requested',
      severity: 'MEDIUM',
      context: {
        reason: 'suspicious_activity_detected',
        sessionId: this.sessionId
      }
    });
  }

  // ===============================================================================
  // UTILITY METHODS
  // ===============================================================================

  private calculateDistance(pos1: { latitude: number; longitude: number }, pos2: { latitude: number; longitude: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // ===============================================================================
  // PUBLIC API METHODS
  // ===============================================================================

  public getSessionId(): string {
    return this.sessionId;
  }

  public getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }

  public async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    try {
      // Process any pending events
      logDebug(`📤 Flushing ${this.eventQueue.length} security events`, "Debug");
      
      // Save metrics to storage
      await secureStorage.storeSecureItem('security_metrics', JSON.stringify({
        ...this.securityMetrics,
        riskFactors: Array.from(this.riskFactors.entries())
      }));
      
      // Clear the queue
      this.eventQueue = [];
      
    } catch (error) {
      logError('Failed to flush event queue:', "Error", error);
    }
  }

  public async generateSecurityReport(): Promise<any> {
    return {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.sessionStartTime,
      metrics: this.securityMetrics,
      threatIndicators: this.suspiciousPatterns,
      riskFactors: Object.fromEntries(this.riskFactors),
      queuedEvents: this.eventQueue.length,
      generatedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();

// Export convenience functions for common security events
export const logAuthEvent = (eventType: string, severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'INFO', context?: any) => {
  securityMonitor.logSecurityEvent({
    eventCategory: 'authentication',
    eventType,
    severity,
    context
  });
};

export const logDataAccess = (resourceType: string, resourceId: string, operation: string, context?: any) => {
  securityMonitor.logSecurityEvent({
    eventCategory: 'data_access',
    eventType: `${resourceType}_${operation}`,
    severity: 'INFO',
    resourceType,
    resourceId,
    context
  });
};

export const logSecurityViolation = (violationType: string, severity: 'MEDIUM' | 'HIGH' | 'CRITICAL', context?: any, riskScore?: number) => {
  securityMonitor.logSecurityEvent({
    eventCategory: 'security_violation',
    eventType: violationType,
    severity,
    context,
    riskScore
  });
};

export const logThreatDetected = (threatType: string, indicators: string[], riskScore: number, context?: any) => {
  securityMonitor.logSecurityEvent({
    eventCategory: 'threat_detected',
    eventType: threatType,
    severity: riskScore > 80 ? 'CRITICAL' : riskScore > 60 ? 'HIGH' : 'MEDIUM',
    threatIndicators: indicators,
    riskScore,
    context
  });
};
