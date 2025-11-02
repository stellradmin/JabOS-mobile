// ===============================================================================
// STELLR ADVANCED THREAT DETECTION SYSTEM
// ===============================================================================
// Purpose: ML-inspired threat detection with behavioral analysis and automated response
// Features: Pattern recognition, anomaly detection, risk scoring, automated mitigation
// ===============================================================================
import { supabase } from './supabase';
import { securityMonitor } from './security-monitor';
import { trackCriticalError, trackError } from './sentry-enhanced';
import { secureStorage } from '../utils/secure-storage';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence_threshold: number;
  response_actions: string[];
  mitre_attack_id?: string; // MITRE ATT&CK framework integration
}

export interface BehaviorProfile {
  user_id: string;
  normal_patterns: {
    login_frequency: number;
    session_duration: number;
    api_call_patterns: Record<string, number>;
    location_stability: number;
    device_consistency: number;
    interaction_patterns: Record<string, number>;
  };
  risk_factors: Record<string, number>;
  last_updated: string;
  learning_phase: boolean;
}

export interface ThreatDetectionResult {
  threat_id: string;
  threat_type: string;
  confidence: number;
  risk_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  indicators: string[];
  evidence: Record<string, any>;
  recommended_actions: string[];
  auto_mitigate: boolean;
  requires_investigation: boolean;
}

export interface AnomalyScore {
  overall_score: number;
  component_scores: {
    temporal: number;
    behavioral: number;
    geographical: number;
    device: number;
    network: number;
  };
  deviations: string[];
  confidence: number;
}

// ===============================================================================
// THREAT PATTERNS DATABASE
// ===============================================================================

const THREAT_PATTERNS: ThreatPattern[] = [
  {
    id: 'credential_stuffing',
    name: 'Credential Stuffing Attack',
    description: 'Multiple failed login attempts with different credentials',
    indicators: ['rapid_login_attempts', 'multiple_failed_auth', 'rotating_credentials'],
    severity: 'HIGH',
    confidence_threshold: 0.8,
    response_actions: ['rate_limit', 'captcha_challenge', 'ip_investigation'],
    mitre_attack_id: 'T1110.004'
  },
  {
    id: 'account_takeover',
    name: 'Account Takeover',
    description: 'Suspicious changes to account settings or behavior',
    indicators: ['unusual_location', 'rapid_profile_changes', 'new_device', 'email_change'],
    severity: 'CRITICAL',
    confidence_threshold: 0.75,
    response_actions: ['account_lock', 'user_verification', 'security_team_alert'],
    mitre_attack_id: 'T1078'
  },
  {
    id: 'data_scraping',
    name: 'Automated Data Scraping',
    description: 'Systematic access to user profiles and data',
    indicators: ['high_profile_access_rate', 'sequential_access_pattern', 'automated_behavior'],
    severity: 'HIGH',
    confidence_threshold: 0.85,
    response_actions: ['rate_limit', 'behavioral_challenge', 'access_restriction'],
    mitre_attack_id: 'T1213'
  },
  {
    id: 'privilege_escalation',
    name: 'Privilege Escalation Attempt',
    description: 'Attempts to access unauthorized resources or functions',
    indicators: ['admin_access_attempt', 'unauthorized_api_calls', 'permission_bypass'],
    severity: 'CRITICAL',
    confidence_threshold: 0.9,
    response_actions: ['immediate_lockdown', 'security_team_alert', 'forensic_capture'],
    mitre_attack_id: 'T1068'
  },
  {
    id: 'brute_force',
    name: 'Brute Force Attack',
    description: 'Systematic password guessing attempts',
    indicators: ['rapid_auth_failures', 'same_user_multiple_attempts', 'password_patterns'],
    severity: 'HIGH',
    confidence_threshold: 0.8,
    response_actions: ['account_lock', 'exponential_backoff', 'ip_block'],
    mitre_attack_id: 'T1110.001'
  },
  {
    id: 'social_engineering',
    name: 'Social Engineering Attack',
    description: 'Manipulation through human interaction patterns',
    indicators: ['rapid_trust_building', 'information_extraction', 'unusual_requests'],
    severity: 'MEDIUM',
    confidence_threshold: 0.7,
    response_actions: ['user_education', 'enhanced_monitoring', 'interaction_analysis'],
    mitre_attack_id: 'T1566'
  },
  {
    id: 'device_spoofing',
    name: 'Device Spoofing',
    description: 'Emulation or cloning of legitimate devices',
    indicators: ['device_fingerprint_mismatch', 'impossible_location_change', 'hardware_inconsistency'],
    severity: 'HIGH',
    confidence_threshold: 0.8,
    response_actions: ['device_verification', 'location_verification', 'enhanced_auth'],
    mitre_attack_id: 'T1036'
  },
  {
    id: 'api_abuse',
    name: 'API Abuse',
    description: 'Excessive or malicious API usage patterns',
    indicators: ['rate_limit_exceeded', 'unusual_endpoint_access', 'error_rate_spike'],
    severity: 'MEDIUM',
    confidence_threshold: 0.75,
    response_actions: ['api_throttling', 'endpoint_blocking', 'usage_analysis'],
    mitre_attack_id: 'T1190'
  }
];

// ===============================================================================
// BEHAVIORAL ANALYSIS ENGINE
// ===============================================================================

class BehavioralAnalyzer {
  private behaviorProfiles: Map<string, BehaviorProfile> = new Map();
  private learningWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  async initializeProfile(userId: string): Promise<BehaviorProfile> {
    try {
      // Try to load existing profile from database
      const { data: existingProfile } = await supabase
        .from('user_behavior_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingProfile) {
        const profile: BehaviorProfile = {
          user_id: userId,
          normal_patterns: existingProfile.normal_patterns || this.getDefaultPatterns(),
          risk_factors: existingProfile.risk_factors || {},
          last_updated: existingProfile.updated_at,
          learning_phase: this.isInLearningPhase(existingProfile.created_at)
        };
        
        this.behaviorProfiles.set(userId, profile);
        return profile;
      }

      // Create new profile
      const newProfile: BehaviorProfile = {
        user_id: userId,
        normal_patterns: this.getDefaultPatterns(),
        risk_factors: {},
        last_updated: new Date().toISOString(),
        learning_phase: true
      };

      this.behaviorProfiles.set(userId, newProfile);
      
      // Save to database
      await supabase.from('user_behavior_profiles').insert({
        user_id: userId,
        normal_patterns: newProfile.normal_patterns,
        risk_factors: newProfile.risk_factors
      });

      return newProfile;
    } catch (error) {
      logError('Failed to initialize behavior profile:', "Error", error);
      throw error;
    }
  }

  private getDefaultPatterns() {
    return {
      login_frequency: 2, // times per day
      session_duration: 1800, // 30 minutes in seconds
      api_call_patterns: {},
      location_stability: 0.9, // 0-1 score
      device_consistency: 0.95, // 0-1 score
      interaction_patterns: {}
    };
  }

  private isInLearningPhase(createdAt: string): boolean {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return (now - created) < this.learningWindow;
  }

  async analyzeAnomaly(userId: string, currentBehavior: any): Promise<AnomalyScore> {
    const profile = await this.initializeProfile(userId);
    const normal = profile.normal_patterns;
    
    const componentScores = {
      temporal: this.analyzeTemporal(currentBehavior, normal),
      behavioral: this.analyzeBehavioral(currentBehavior, normal),
      geographical: this.analyzeGeographical(currentBehavior, normal),
      device: this.analyzeDevice(currentBehavior, normal),
      network: this.analyzeNetwork(currentBehavior, normal)
    };

    const weights = { temporal: 0.2, behavioral: 0.3, geographical: 0.2, device: 0.2, network: 0.1 };
    const overall_score = Object.entries(componentScores).reduce(
      (sum, [key, score]) => sum + (score * weights[key as keyof typeof weights]), 
      0
    );

    const deviations = this.identifyDeviations(componentScores);
    const confidence = this.calculateConfidence(componentScores, profile.learning_phase);

    return {
      overall_score,
      component_scores: componentScores,
      deviations,
      confidence
    };
  }

  private analyzeTemporal(current: any, normal: any): number {
    // Analyze time-based patterns
    const currentHour = new Date().getHours();
    const expectedActivity = this.getExpectedActivityForHour(currentHour, normal);
    const actualActivity = current.session_duration || 0;
    
    return Math.abs(actualActivity - expectedActivity) / Math.max(expectedActivity, 1);
  }

  private analyzeBehavioral(current: any, normal: any): number {
    // Analyze user interaction patterns
    let totalDeviation = 0;
    let patternCount = 0;

    for (const [pattern, expectedFreq] of Object.entries(normal.interaction_patterns)) {
      const actualFreq = current.interaction_patterns?.[pattern] || 0;
      const deviation = Math.abs(actualFreq - (expectedFreq as number)) / Math.max(expectedFreq as number, 1);
      totalDeviation += deviation;
      patternCount++;
    }

    return patternCount > 0 ? totalDeviation / patternCount : 0;
  }

  private analyzeGeographical(current: any, normal: any): number {
    if (!current.location || !normal.location_stability) return 0;
    
    // Calculate geographical deviation based on location stability
    const locationChange = current.location_change || 0;
    const expectedStability = normal.location_stability;
    
    return Math.max(0, (locationChange - (1 - expectedStability)) / expectedStability);
  }

  private analyzeDevice(current: any, normal: any): number {
    const deviceConsistency = current.device_fingerprint_match || 1;
    const expectedConsistency = normal.device_consistency;
    
    return Math.max(0, (expectedConsistency - deviceConsistency) / expectedConsistency);
  }

  private analyzeNetwork(current: any, normal: any): number {
    const networkChanges = current.network_changes || 0;
    const expectedChanges = 2; // Normal user might change networks 2 times per session
    
    return Math.max(0, (networkChanges - expectedChanges) / Math.max(expectedChanges, 1));
  }

  private getExpectedActivityForHour(hour: number, normal: any): number {
    // Simulate circadian rhythm patterns
    const peakHours = [9, 12, 18, 21]; // Common active hours
    const isPeakHour = peakHours.includes(hour);
    
    return isPeakHour ? normal.session_duration : normal.session_duration * 0.3;
  }

  private identifyDeviations(componentScores: any): string[] {
    const deviations: string[] = [];
    const threshold = 0.5;

    Object.entries(componentScores as Record<string, number>).forEach(([component, score]) => {
      if ((score as number) > threshold) {
        deviations.push(`${component}_anomaly`);
      }
    });

    return deviations;
  }

  private calculateConfidence(componentScores: any, learningPhase: boolean): number {
    const values = Object.values(componentScores as Record<string, number>) as number[];
    const avgScore = values.reduce((sum: number, v: number) => sum + v, 0) / Math.max(values.length, 1);
    const baseConfidence = learningPhase ? 0.6 : 0.8; // Lower confidence during learning
    
    return Math.min(1, baseConfidence * (1 + avgScore));
  }

  async updateProfile(userId: string, currentBehavior: any): Promise<void> {
    try {
      const profile = this.behaviorProfiles.get(userId);
      if (!profile) return;

      // Update patterns using exponential moving average
      const alpha = profile.learning_phase ? 0.3 : 0.1; // Higher learning rate during learning phase
      
      this.updatePatternWithEMA(profile.normal_patterns, 'session_duration', currentBehavior.session_duration, alpha);
      this.updatePatternWithEMA(profile.normal_patterns, 'login_frequency', currentBehavior.login_frequency, alpha);
      
      // Update interaction patterns
      for (const [pattern, frequency] of Object.entries(currentBehavior.interaction_patterns || {})) {
        this.updatePatternWithEMA(profile.normal_patterns.interaction_patterns, pattern, frequency as number, alpha);
      }

      profile.last_updated = new Date().toISOString();

      // Save updated profile
      await supabase
        .from('user_behavior_profiles')
        .upsert({
          user_id: userId,
          normal_patterns: profile.normal_patterns,
          risk_factors: profile.risk_factors,
          updated_at: profile.last_updated
        });

    } catch (error) {
      logError('Failed to update behavior profile:', "Error", error);
    }
  }

  private updatePatternWithEMA(patterns: any, key: string, newValue: number, alpha: number): void {
    if (typeof newValue === 'number' && !isNaN(newValue)) {
      patterns[key] = patterns[key] 
        ? patterns[key] * (1 - alpha) + newValue * alpha 
        : newValue;
    }
  }
}

// ===============================================================================
// MAIN THREAT DETECTION ENGINE
// ===============================================================================

export class ThreatDetectionEngine {
  private behaviorAnalyzer: BehavioralAnalyzer;
  private threatHistory: Map<string, ThreatDetectionResult[]> = new Map();
  private activeThreats: Set<string> = new Set();

  constructor() {
    this.behaviorAnalyzer = new BehavioralAnalyzer();
  }

  async detectThreats(
    userId: string, 
    sessionContext: any, 
    recentEvents: any[]
  ): Promise<ThreatDetectionResult[]> {
    try {
      const results: ThreatDetectionResult[] = [];
      
      // Analyze behavioral anomalies
      const anomalyScore = await this.behaviorAnalyzer.analyzeAnomaly(userId, sessionContext);
      
      // Check each threat pattern
      for (const pattern of THREAT_PATTERNS) {
        const detection = await this.evaluateThreatPattern(
          pattern, 
          userId, 
          sessionContext, 
          recentEvents, 
          anomalyScore
        );
        
        if (detection && detection.confidence >= pattern.confidence_threshold) {
          results.push(detection);
        }
      }

      // Apply ensemble methods for improved accuracy
      const refinedResults = this.applyEnsembleMethods(results);
      
      // Store threat history
      this.threatHistory.set(userId, refinedResults);
      
      // Execute automated responses
      await this.executeAutomatedResponses(refinedResults, userId);
      
      return refinedResults;
      
    } catch (error) {
      logError('Threat detection failed:', "Error", error);
      trackError(error as Error, { 
        component: 'ThreatDetectionEngine', 
        userId, 
        sessionContext 
      });
      return [];
    }
  }

  private async evaluateThreatPattern(
    pattern: ThreatPattern,
    userId: string,
    sessionContext: any,
    recentEvents: any[],
    anomalyScore: AnomalyScore
  ): Promise<ThreatDetectionResult | null> {
    const evidence: Record<string, any> = {};
    let indicatorMatches = 0;
    let totalEvidence = 0;

    // Evaluate each indicator
    for (const indicator of pattern.indicators) {
      const indicatorResult = this.evaluateIndicator(
        indicator, 
        userId, 
        sessionContext, 
        recentEvents, 
        anomalyScore
      );
      
      if (indicatorResult.matches) {
        indicatorMatches++;
        evidence[indicator] = indicatorResult.evidence;
        totalEvidence += indicatorResult.strength;
      }
    }

    // Calculate confidence based on indicator matches and evidence strength
    const indicatorCoverage = indicatorMatches / pattern.indicators.length;
    const averageEvidence = totalEvidence / Math.max(indicatorMatches, 1);
    const confidence = (indicatorCoverage * 0.7) + (averageEvidence * 0.3);

    if (confidence < pattern.confidence_threshold) {
      return null;
    }

    // Calculate risk score
    const baseRiskScore = this.calculateBaseRiskScore(pattern.severity);
    const contextualRisk = this.calculateContextualRisk(sessionContext, anomalyScore);
    const riskScore = Math.min(100, baseRiskScore + contextualRisk);

    return {
      threat_id: `${pattern.id}_${Date.now()}`,
      threat_type: pattern.id,
      confidence,
      risk_score: riskScore,
      severity: pattern.severity,
      indicators: pattern.indicators.filter((_, i) => i < indicatorMatches),
      evidence,
      recommended_actions: pattern.response_actions,
      auto_mitigate: confidence > 0.9 && pattern.severity === 'CRITICAL',
      requires_investigation: pattern.severity === 'CRITICAL' || confidence > 0.85
    };
  }

  private evaluateIndicator(
    indicator: string,
    userId: string,
    sessionContext: any,
    recentEvents: any[],
    anomalyScore: AnomalyScore
  ): { matches: boolean; strength: number; evidence: any } {
    
    switch (indicator) {
      case 'rapid_login_attempts':
        return this.checkRapidLoginAttempts(recentEvents);
        
      case 'multiple_failed_auth':
        return this.checkMultipleFailedAuth(recentEvents);
        
      case 'unusual_location':
        return this.checkUnusualLocation(sessionContext, anomalyScore);
        
      case 'rapid_profile_changes':
        return this.checkRapidProfileChanges(recentEvents);
        
      case 'new_device':
        return this.checkNewDevice(sessionContext);
        
      case 'high_profile_access_rate':
        return this.checkHighProfileAccessRate(recentEvents);
        
      case 'sequential_access_pattern':
        return this.checkSequentialAccessPattern(recentEvents);
        
      case 'automated_behavior':
        return this.checkAutomatedBehavior(sessionContext, anomalyScore);
        
      case 'admin_access_attempt':
        return this.checkAdminAccessAttempt(recentEvents);
        
      case 'rate_limit_exceeded':
        return this.checkRateLimitExceeded(recentEvents);
        
      default:
        return { matches: false, strength: 0, evidence: {} };
    }
  }

  private checkRapidLoginAttempts(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const authEvents = events.filter(e => e.event_type.includes('login') || e.event_type.includes('auth'));
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    const recentAuthEvents = authEvents.filter(e => (now - new Date(e.created_at).getTime()) < timeWindow);
    
    return {
      matches: recentAuthEvents.length > 5,
      strength: Math.min(1, recentAuthEvents.length / 10),
      evidence: {
        event_count: recentAuthEvents.length,
        time_window_minutes: timeWindow / (60 * 1000),
        events: recentAuthEvents.slice(-5) // Last 5 events for evidence
      }
    };
  }

  private checkMultipleFailedAuth(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const failedAuthEvents = events.filter(e => 
      e.event_type.includes('login_failure') || 
      e.event_type.includes('auth_failed')
    );
    
    return {
      matches: failedAuthEvents.length > 3,
      strength: Math.min(1, failedAuthEvents.length / 5),
      evidence: {
        failure_count: failedAuthEvents.length,
        recent_failures: failedAuthEvents.slice(-3)
      }
    };
  }

  private checkUnusualLocation(sessionContext: any, anomalyScore: AnomalyScore): { matches: boolean; strength: number; evidence: any } {
    const geoScore = anomalyScore.component_scores.geographical;
    
    return {
      matches: geoScore > 0.6,
      strength: Math.min(1, geoScore),
      evidence: {
        geographical_anomaly_score: geoScore,
        location_data: sessionContext.location,
        location_changes: sessionContext.location_changes
      }
    };
  }

  private checkRapidProfileChanges(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const profileEvents = events.filter(e => 
      e.event_type.includes('profile_updated') ||
      e.event_type.includes('settings_changed')
    );
    
    const timeWindow = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const recentProfileEvents = profileEvents.filter(e => 
      (now - new Date(e.created_at).getTime()) < timeWindow
    );
    
    return {
      matches: recentProfileEvents.length > 3,
      strength: Math.min(1, recentProfileEvents.length / 5),
      evidence: {
        change_count: recentProfileEvents.length,
        time_window_minutes: timeWindow / (60 * 1000),
        changes: recentProfileEvents
      }
    };
  }

  private checkNewDevice(sessionContext: any): { matches: boolean; strength: number; evidence: any } {
    const deviceScore = sessionContext.device_fingerprint_match || 1;
    
    return {
      matches: deviceScore < 0.8,
      strength: 1 - deviceScore,
      evidence: {
        device_fingerprint_match: deviceScore,
        current_device: sessionContext.device_fingerprint,
        is_new_device: deviceScore < 0.5
      }
    };
  }

  private checkHighProfileAccessRate(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const profileAccessEvents = events.filter(e => 
      e.event_type.includes('profile_view') ||
      e.event_type.includes('user_data_access')
    );
    
    const timeWindow = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    const recentAccess = profileAccessEvents.filter(e => 
      (now - new Date(e.created_at).getTime()) < timeWindow
    );
    
    return {
      matches: recentAccess.length > 50,
      strength: Math.min(1, recentAccess.length / 100),
      evidence: {
        access_count: recentAccess.length,
        unique_profiles: new Set(recentAccess.map(e => e.resource_id)).size,
        rate_per_hour: recentAccess.length
      }
    };
  }

  private checkSequentialAccessPattern(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const accessEvents = events.filter(e => e.resource_id).slice(-20); // Last 20 events with resource IDs
    
    if (accessEvents.length < 5) {
      return { matches: false, strength: 0, evidence: {} };
    }
    
    // Check for sequential patterns in resource IDs
    let sequentialCount = 0;
    for (let i = 1; i < accessEvents.length; i++) {
      const current = accessEvents[i].resource_id;
      const previous = accessEvents[i-1].resource_id;
      
      // Simple check for similar resource IDs (could be improved with better pattern matching)
      if (this.areResourceIdsSequential(previous, current)) {
        sequentialCount++;
      }
    }
    
    const sequentialRatio = sequentialCount / (accessEvents.length - 1);
    
    return {
      matches: sequentialRatio > 0.6,
      strength: sequentialRatio,
      evidence: {
        sequential_ratio: sequentialRatio,
        sequential_count: sequentialCount,
        total_checked: accessEvents.length - 1
      }
    };
  }

  private checkAutomatedBehavior(sessionContext: any, anomalyScore: AnomalyScore): { matches: boolean; strength: number; evidence: any } {
    const behavioralScore = anomalyScore.component_scores.behavioral;
    const actionRate = sessionContext.action_rate || 0;
    const uniformTiming = sessionContext.timing_uniformity || 0;
    
    const automationScore = (behavioralScore + Math.min(1, actionRate / 10) + uniformTiming) / 3;
    
    return {
      matches: automationScore > 0.7,
      strength: automationScore,
      evidence: {
        behavioral_anomaly: behavioralScore,
        action_rate: actionRate,
        timing_uniformity: uniformTiming,
        automation_score: automationScore
      }
    };
  }

  private checkAdminAccessAttempt(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const adminEvents = events.filter(e => 
      e.event_type.includes('admin') ||
      e.resource_type?.includes('admin') ||
      e.event_type.includes('privilege') ||
      e.event_type.includes('unauthorized')
    );
    
    return {
      matches: adminEvents.length > 0,
      strength: Math.min(1, adminEvents.length / 3),
      evidence: {
        admin_access_attempts: adminEvents.length,
        attempts: adminEvents
      }
    };
  }

  private checkRateLimitExceeded(events: any[]): { matches: boolean; strength: number; evidence: any } {
    const rateLimitEvents = events.filter(e => 
      e.event_type.includes('rate_limit') ||
      e.event_type.includes('throttled') ||
      e.event_type.includes('blocked')
    );
    
    return {
      matches: rateLimitEvents.length > 2,
      strength: Math.min(1, rateLimitEvents.length / 5),
      evidence: {
        rate_limit_violations: rateLimitEvents.length,
        violations: rateLimitEvents
      }
    };
  }

  private areResourceIdsSequential(id1: string, id2: string): boolean {
    // Simple heuristic - could be improved with better logic
    if (!id1 || !id2) return false;
    
    // Check if IDs are similar (indicating potential sequential access)
    const similarity = this.calculateStringSimilarity(id1, id2);
    return similarity > 0.8;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateBaseRiskScore(severity: string): number {
    switch (severity) {
      case 'LOW': return 20;
      case 'MEDIUM': return 40;
      case 'HIGH': return 70;
      case 'CRITICAL': return 90;
      default: return 30;
    }
  }

  private calculateContextualRisk(sessionContext: any, anomalyScore: AnomalyScore): number {
    let contextualRisk = 0;
    
    // Add risk based on anomaly score
    contextualRisk += anomalyScore.overall_score * 20;
    
    // Add risk for suspicious timing
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 23) {
      contextualRisk += 10; // Higher risk for unusual hours
    }
    
    // Add risk for multiple simultaneous sessions
    if (sessionContext.concurrent_sessions > 1) {
      contextualRisk += 15;
    }
    
    return Math.min(30, contextualRisk); // Cap contextual risk at 30
  }

  private applyEnsembleMethods(results: ThreatDetectionResult[]): ThreatDetectionResult[] {
    // Apply ensemble methods to improve accuracy
    const refinedResults: ThreatDetectionResult[] = [];
    
    for (const result of results) {
      // Apply confidence calibration
      const calibratedConfidence = this.calibrateConfidence(result.confidence, result.threat_type);
      
      // Apply correlation analysis
      const correlationBoost = this.analyzeCorrelation(result, results);
      
      const refinedResult = {
        ...result,
        confidence: Math.min(1, calibratedConfidence + correlationBoost),
        risk_score: Math.min(100, result.risk_score * (1 + correlationBoost))
      };
      
      refinedResults.push(refinedResult);
    }
    
    return refinedResults;
  }

  private calibrateConfidence(confidence: number, threatType: string): number {
    // Apply threat-type specific calibration
    const calibrationFactors: Record<string, number> = {
      'credential_stuffing': 0.95,
      'account_takeover': 0.9,
      'data_scraping': 0.85,
      'privilege_escalation': 0.98,
      'brute_force': 0.9
    };
    
    const factor = calibrationFactors[threatType] || 0.9;
    return confidence * factor;
  }

  private analyzeCorrelation(result: ThreatDetectionResult, allResults: ThreatDetectionResult[]): number {
    let correlationBoost = 0;
    
    // Check for correlated threats
    const correlatedThreats = allResults.filter(r => 
      r.threat_id !== result.threat_id && 
      this.areThreatsCorrelated(result.threat_type, r.threat_type)
    );
    
    if (correlatedThreats.length > 0) {
      correlationBoost = Math.min(0.2, correlatedThreats.length * 0.05);
    }
    
    return correlationBoost;
  }

  private areThreatsCorrelated(threat1: string, threat2: string): boolean {
    const correlations: Record<string, string[]> = {
      'credential_stuffing': ['brute_force', 'account_takeover'],
      'account_takeover': ['credential_stuffing', 'privilege_escalation'],
      'data_scraping': ['api_abuse', 'automated_behavior'],
      'privilege_escalation': ['account_takeover', 'unauthorized_access']
    };
    
    return correlations[threat1]?.includes(threat2) || correlations[threat2]?.includes(threat1) || false;
  }

  private async executeAutomatedResponses(
    threats: ThreatDetectionResult[], 
    userId: string
  ): Promise<void> {
    for (const threat of threats) {
      if (threat.auto_mitigate) {
        await this.executeThreatMitigation(threat, userId);
      }
      
      if (threat.requires_investigation) {
        await this.alertSecurityTeam(threat, userId);
      }
    }
  }

  private async executeThreatMitigation(
    threat: ThreatDetectionResult, 
    userId: string
  ): Promise<void> {
    try {
      logWarn(`🚨 Executing automated mitigation for threat: ${threat.threat_type}`, "Warning");
      
      for (const action of threat.recommended_actions) {
        await this.executeSecurityAction(action, threat, userId);
      }
      
      // Log mitigation
      await securityMonitor.logSecurityEvent({
        eventCategory: 'security_violation',
        eventType: 'threat_mitigated',
        severity: 'HIGH',
        userId,
        context: {
          threat_id: threat.threat_id,
          threat_type: threat.threat_type,
          mitigation_actions: threat.recommended_actions
        }
      });
      
    } catch (error) {
      logError('Threat mitigation failed:', "Error", error);
      trackCriticalError(error as Error, {
        component: 'ThreatDetectionEngine',
        method: 'executeThreatMitigation',
        threat
      });
    }
  }

  private async executeSecurityAction(
    action: string, 
    threat: ThreatDetectionResult, 
    userId: string
  ): Promise<void> {
    switch (action) {
      case 'account_lock':
        await this.lockUserAccount(userId, threat);
        break;
        
      case 'rate_limit':
        await this.applyRateLimit(userId, threat);
        break;
        
      case 'ip_block':
        await this.blockIPAddress(threat);
        break;
        
      case 'session_terminate':
        await this.terminateUserSessions(userId);
        break;
        
      case 'enhanced_monitoring':
        await this.enableEnhancedMonitoring(userId);
        break;
        
      default:
        logWarn(`Unknown security action: ${action}`, "Warning");
    }
  }

  private async lockUserAccount(userId: string, threat: ThreatDetectionResult): Promise<void> {
    try {
      // Update user account status
      const lockDuration = this.calculateLockDuration(threat.severity);
      const lockUntil = new Date(Date.now() + lockDuration);
      
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          security_locked: true,
          locked_until: lockUntil.toISOString(),
          lock_reason: threat.threat_type,
          threat_id: threat.threat_id
        }
      });
      
      logWarn(`🔒 User account locked: ${userId}, "Warning", until: ${lockUntil}`);
      
    } catch (error) {
      logError('Account lock failed:', "Error", error);
    }
  }

  private async applyRateLimit(userId: string, threat: ThreatDetectionResult): Promise<void> {
    try {
      const limitDuration = this.calculateRateLimitDuration(threat.severity);
      
      await secureStorage.storeSecureItem(
        `rate_limit_${userId}`, 
        JSON.stringify({
          active: true,
          until: Date.now() + limitDuration,
          threat_id: threat.threat_id,
          severity: threat.severity
        })
      );
      
      logWarn(`⏳ Rate limiting applied: ${userId}, "Warning", duration: ${limitDuration}ms`);
      
    } catch (error) {
      logError('Rate limit application failed:', "Error", error);
    }
  }

  private async blockIPAddress(threat: ThreatDetectionResult): Promise<void> {
    // This would integrate with your infrastructure's IP blocking system
    logWarn(`🚫 IP block requested for threat: ${threat.threat_id}`, "Warning");
    
    // Log the IP block request for manual implementation
    await securityMonitor.logSecurityEvent({
      eventCategory: 'security_violation',
      eventType: 'ip_block_requested',
      severity: 'HIGH',
      context: {
        threat_id: threat.threat_id,
        threat_type: threat.threat_type,
        evidence: threat.evidence
      }
    });
  }

  private async terminateUserSessions(userId: string): Promise<void> {
    try {
      // Sign out all sessions for the user
      await supabase.auth.admin.signOut(userId, 'global');
      
      // Clear local session data
      await AsyncStorage.multiRemove([
        'userToken',
        'sessionData',
        `behavior_profile_${userId}`
      ]);
      
      logWarn(`🔐 All sessions terminated for user: ${userId}`, "Warning");
      
    } catch (error) {
      logError('Session termination failed:', "Error", error);
    }
  }

  private async enableEnhancedMonitoring(userId: string): Promise<void> {
    try {
      await secureStorage.storeSecureItem(
        `enhanced_monitoring_${userId}`,
        JSON.stringify({
          active: true,
          started_at: Date.now(),
          duration: 24 * 60 * 60 * 1000 // 24 hours
        })
      );
      
      logWarn(`🔍 Enhanced monitoring enabled for user: ${userId}`, "Warning");
      
    } catch (error) {
      logError('Enhanced monitoring setup failed:', "Error", error);
    }
  }

  private async alertSecurityTeam(
    threat: ThreatDetectionResult, 
    userId: string
  ): Promise<void> {
    trackCriticalError(
      new Error(`SECURITY ALERT: ${threat.threat_type}`),
      {
        severity: 'CRITICAL',
        requires_immediate_attention: true,
        threat_detection: threat,
        user_id: userId,
        detection_timestamp: new Date().toISOString()
      }
    );
  }

  private calculateLockDuration(severity: string): number {
    switch (severity) {
      case 'LOW': return 5 * 60 * 1000; // 5 minutes
      case 'MEDIUM': return 30 * 60 * 1000; // 30 minutes
      case 'HIGH': return 2 * 60 * 60 * 1000; // 2 hours
      case 'CRITICAL': return 24 * 60 * 60 * 1000; // 24 hours
      default: return 30 * 60 * 1000;
    }
  }

  private calculateRateLimitDuration(severity: string): number {
    switch (severity) {
      case 'LOW': return 2 * 60 * 1000; // 2 minutes
      case 'MEDIUM': return 10 * 60 * 1000; // 10 minutes
      case 'HIGH': return 60 * 60 * 1000; // 1 hour
      case 'CRITICAL': return 6 * 60 * 60 * 1000; // 6 hours
      default: return 10 * 60 * 1000;
    }
  }
}

// Export singleton instance
export const threatDetectionEngine = new ThreatDetectionEngine();
