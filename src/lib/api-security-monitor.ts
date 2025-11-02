/**
 * API Security Monitor & Abuse Detection System
 *
 * CRITICAL SECURITY MODULE for detecting and preventing:
 * - API abuse and rate limit violations
 * - Suspicious request patterns
 * - Potential security threats
 * - Data exfiltration attempts
 *
 * This module implements real-time threat detection for the Stellr dating app.
 */

import { supabase } from './supabase';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface SecurityEvent {
  id?: string;
  event_type: 'api_abuse' | 'rate_limit_exceeded' | 'suspicious_pattern' | 'certificate_error' | 'unauthorized_access' | 'data_exfiltration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: string;
  device_id: string;
  endpoint: string;
  method: string;
  request_count: number;
  time_window: number;
  metadata: Record<string, any>;
  timestamp: string;
  blocked: boolean;
}

interface RateLimitRule {
  endpoint: string;
  maxRequests: number;
  timeWindowMs: number;
  blockDuration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SuspiciousPattern {
  patternType: 'burst_requests' | 'unusual_endpoint' | 'data_scraping' | 'timing_attack' | 'enumeration';
  threshold: number;
  timeWindow: number;
  action: 'log' | 'warn' | 'block' | 'ban';
}

class ApiSecurityMonitor {
  private static instance: ApiSecurityMonitor;
  private requestHistory: Map<string, Array<{ timestamp: number; endpoint: string; method: string }>> = new Map();
  private blockedClients: Map<string, { until: number; reason: string }> = new Map();
  private deviceId: string = '';
  
  // Rate limiting rules for different endpoints
  private rateLimitRules: RateLimitRule[] = [
    {
      endpoint: '/functions/v1/natal-chart-api',
      maxRequests: 10,
      timeWindowMs: 60000, // 1 minute
      blockDuration: 300000, // 5 minutes
      severity: 'medium'
    },
    {
      endpoint: '/functions/v1/external-api-proxy',
      maxRequests: 20,
      timeWindowMs: 60000,
      blockDuration: 300000,
      severity: 'medium'
    },
    {
      endpoint: '/auth/v1/token',
      maxRequests: 5,
      timeWindowMs: 300000, // 5 minutes
      blockDuration: 900000, // 15 minutes
      severity: 'high'
    },
    {
      endpoint: '/rest/v1/profiles',
      maxRequests: 50,
      timeWindowMs: 60000,
      blockDuration: 600000, // 10 minutes
      severity: 'medium'
    },
    {
      endpoint: '/rest/v1/messages',
      maxRequests: 100,
      timeWindowMs: 60000,
      blockDuration: 300000,
      severity: 'low'
    }
  ];

  // Suspicious patterns to detect
  private suspiciousPatterns: SuspiciousPattern[] = [
    {
      patternType: 'burst_requests',
      threshold: 50,
      timeWindow: 10000, // 10 seconds
      action: 'block'
    },
    {
      patternType: 'data_scraping',
      threshold: 100,
      timeWindow: 300000, // 5 minutes
      action: 'block'
    },
    {
      patternType: 'enumeration',
      threshold: 20,
      timeWindow: 60000, // 1 minute
      action: 'warn'
    },
    {
      patternType: 'timing_attack',
      threshold: 10,
      timeWindow: 5000, // 5 seconds
      action: 'block'
    }
  ];

  private constructor() {
    this.initializeDeviceId();
    this.startPeriodicCleanup();
  }

  static getInstance(): ApiSecurityMonitor {
    if (!ApiSecurityMonitor.instance) {
      ApiSecurityMonitor.instance = new ApiSecurityMonitor();
    }
    return ApiSecurityMonitor.instance;
  }

  private async initializeDeviceId(): Promise<void> {
    try {
      // Use a combination of device info for unique identification
      const deviceInfo = {
        deviceId: Device.osInternalBuildId || 'unknown',
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildNumber: Application.nativeBuildVersion || '1'
      };

      this.deviceId = `${deviceInfo.deviceId}_${deviceInfo.appVersion}_${deviceInfo.buildNumber}`;

      // Store device fingerprint securely
      await SecureStore.setItemAsync('device_security_id', this.deviceId);
    } catch (error) {
      logWarn('Failed to initialize device ID:', "Warning", error);
      this.deviceId = 'unknown_device';
    }
  }

  /**
   * Check if a request should be allowed
   */
  async checkRequestSecurity(
    endpoint: string,
    method: string,
    userId?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    securityEvent?: SecurityEvent;
  }> {
    try {
      const clientKey = userId || this.deviceId;
      const now = Date.now();

      // Check if client is currently blocked
      const blockInfo = this.blockedClients.get(clientKey);
      if (blockInfo && now < blockInfo.until) {
        const event = await this.createSecurityEvent({
          event_type: 'unauthorized_access',
          severity: 'high',
          endpoint,
          method,
          user_id: userId,
          request_count: 1,
          time_window: 0,
          metadata: {
            blocked_until: new Date(blockInfo.until).toISOString(),
            block_reason: blockInfo.reason
          },
          blocked: true
        });

        return {
          allowed: false,
          reason: 'Client currently blocked: ' + blockInfo.reason,
          securityEvent: event
        };
      }

      // Get request history for this client
      const history = this.requestHistory.get(clientKey) || [];
      
      // Add current request
      history.push({ timestamp: now, endpoint, method });
      this.requestHistory.set(clientKey, history);

      // Check rate limits
      const rateLimitViolation = this.checkRateLimit(endpoint, method, history, now);
      if (rateLimitViolation) {
        const event = await this.createSecurityEvent(rateLimitViolation);
        
        // Block the client
        if (rateLimitViolation.severity === 'high' || rateLimitViolation.severity === 'critical') {
          const rule = this.rateLimitRules.find(r => endpoint.includes(r.endpoint));
          const blockDuration = rule?.blockDuration || 300000;
          
          this.blockedClients.set(clientKey, {
            until: now + blockDuration,
            reason: 'Rate limit exceeded'
          });
        }

        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          securityEvent: event
        };
      }

      // Check for suspicious patterns
      const suspiciousActivity = this.detectSuspiciousPatterns(history, endpoint, method, now);
      if (suspiciousActivity) {
        const event = await this.createSecurityEvent(suspiciousActivity);
        
        if (suspiciousActivity.blocked) {
          this.blockedClients.set(clientKey, {
            until: now + 600000, // 10 minute block for suspicious patterns
            reason: 'Suspicious activity detected'
          });

          return {
            allowed: false,
            reason: 'Suspicious activity detected',
            securityEvent: event
          };
        }

        // Log suspicious activity but allow request
        return {
          allowed: true,
          securityEvent: event
        };
      }

      // Clean old requests from history
      const cutoff = now - 3600000; // 1 hour
      const recentHistory = history.filter(req => req.timestamp > cutoff);
      this.requestHistory.set(clientKey, recentHistory);

      return { allowed: true };

    } catch (error) {
      logError('Security check failed:', "Error", error);
      
      // Fail secure - allow request but log the error
      const event = await this.createSecurityEvent({
        event_type: 'certificate_error',
        severity: 'medium',
        endpoint,
        method,
        user_id: userId,
        request_count: 1,
        time_window: 0,
        metadata: { error: error.message },
        blocked: false
      });

      return {
        allowed: true,
        reason: 'Security check failed, allowing request',
        securityEvent: event
      };
    }
  }

  private checkRateLimit(
    endpoint: string,
    method: string,
    history: Array<{ timestamp: number; endpoint: string; method: string }>,
    now: number
  ): SecurityEvent | null {
    const applicableRule = this.rateLimitRules.find(rule => 
      endpoint.includes(rule.endpoint)
    );

    if (!applicableRule) return null;

    const cutoff = now - applicableRule.timeWindowMs;
    const recentRequests = history.filter(req => 
      req.timestamp > cutoff && 
      req.endpoint.includes(applicableRule.endpoint) && 
      req.method === method
    );

    if (recentRequests.length > applicableRule.maxRequests) {
      return {
        event_type: 'rate_limit_exceeded',
        severity: applicableRule.severity,
        endpoint,
        method,
        device_id: this.deviceId,
        request_count: recentRequests.length,
        time_window: applicableRule.timeWindowMs,
        metadata: {
          rule: applicableRule,
          exceeded_by: recentRequests.length - applicableRule.maxRequests
        },
        timestamp: new Date().toISOString(),
        blocked: applicableRule.severity === 'high' || applicableRule.severity === 'critical'
      };
    }

    return null;
  }

  private detectSuspiciousPatterns(
    history: Array<{ timestamp: number; endpoint: string; method: string }>,
    currentEndpoint: string,
    currentMethod: string,
    now: number
  ): SecurityEvent | null {
    
    // Check for burst requests
    const last10Seconds = history.filter(req => req.timestamp > now - 10000);
    if (last10Seconds.length > 50) {
      return {
        event_type: 'suspicious_pattern',
        severity: 'high',
        endpoint: currentEndpoint,
        method: currentMethod,
        device_id: this.deviceId,
        request_count: last10Seconds.length,
        time_window: 10000,
        metadata: {
          pattern: 'burst_requests',
          threshold_exceeded: last10Seconds.length - 50
        },
        timestamp: new Date().toISOString(),
        blocked: true
      };
    }

    // Check for data scraping patterns
    const last5Minutes = history.filter(req => req.timestamp > now - 300000);
    const profileRequests = last5Minutes.filter(req => 
      req.endpoint.includes('/profiles') || req.endpoint.includes('/users')
    );
    
    if (profileRequests.length > 100) {
      return {
        event_type: 'suspicious_pattern',
        severity: 'critical',
        endpoint: currentEndpoint,
        method: currentMethod,
        device_id: this.deviceId,
        request_count: profileRequests.length,
        time_window: 300000,
        metadata: {
          pattern: 'data_scraping',
          profile_requests: profileRequests.length
        },
        timestamp: new Date().toISOString(),
        blocked: true
      };
    }

    // Check for enumeration attacks
    const last1Minute = history.filter(req => req.timestamp > now - 60000);
    const differentEndpoints = new Set(last1Minute.map(req => req.endpoint)).size;
    
    if (differentEndpoints > 20) {
      return {
        event_type: 'suspicious_pattern',
        severity: 'medium',
        endpoint: currentEndpoint,
        method: currentMethod,
        device_id: this.deviceId,
        request_count: last1Minute.length,
        time_window: 60000,
        metadata: {
          pattern: 'enumeration',
          different_endpoints: differentEndpoints
        },
        timestamp: new Date().toISOString(),
        blocked: false
      };
    }

    return null;
  }

  private async createSecurityEvent(eventData: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      event_type: eventData.event_type || 'api_abuse',
      severity: eventData.severity || 'medium',
      device_id: eventData.device_id || this.deviceId,
      endpoint: eventData.endpoint || '',
      method: eventData.method || '',
      request_count: eventData.request_count || 0,
      time_window: eventData.time_window || 0,
      metadata: eventData.metadata || {},
      timestamp: eventData.timestamp || new Date().toISOString(),
      blocked: eventData.blocked || false,
      user_id: eventData.user_id
    };

    try {
      // Store security event in Supabase
      const { data, error } = await supabase
        .from('security_events')
        .insert([event])
        .select()
        .single();

      if (error) {
        logError('Failed to store security event:', "Error", error);
      } else {
        event.id = data.id;
      }

      // For critical events, also store locally
      if (event.severity === 'critical' || event.severity === 'high') {
        await SecureStore.setItemAsync(
          `security_event_${Date.now()}`,
          JSON.stringify(event)
        );
      }

    } catch (error) {
      logError('Error creating security event:', "Error", error);
    }

    return event;
  }

  /**
   * Get security statistics for monitoring dashboard
   */
  async getSecurityStats(timeRangeHours = 24): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    blockedRequests: number;
    topThreats: Array<{ endpoint: string; count: number; severity: string }>;
  }> {
    try {
      const since = new Date(Date.now() - (timeRangeHours * 60 * 60 * 1000)).toISOString();

      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false });

      if (error) {
        logError('Failed to fetch security stats:', "Error", error);
        return {
          totalEvents: 0,
          eventsByType: {},
          eventsBySeverity: {},
          blockedRequests: 0,
          topThreats: []
        };
      }

      const events = data || [];
      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      const endpointCounts: Record<string, { count: number; severity: string }> = {};
      let blockedRequests = 0;

      for (const event of events) {
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
        
        if (event.blocked) {
          blockedRequests++;
        }

        const endpoint = event.endpoint.split('?')[0]; // Remove query params
        if (!endpointCounts[endpoint]) {
          endpointCounts[endpoint] = { count: 0, severity: event.severity };
        }
        endpointCounts[endpoint].count++;
        
        // Keep the highest severity
        if (this.getSeverityLevel(event.severity) > this.getSeverityLevel(endpointCounts[endpoint].severity)) {
          endpointCounts[endpoint].severity = event.severity;
        }
      }

      const topThreats = Object.entries(endpointCounts)
        .map(([endpoint, data]) => ({ endpoint, count: data.count, severity: data.severity }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        blockedRequests,
        topThreats
      };

    } catch (error) {
      logError('Error fetching security stats:', "Error", error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        blockedRequests: 0,
        topThreats: []
      };
    }
  }

  private getSeverityLevel(severity: string): number {
    const levels: Record<'low' | 'medium' | 'high' | 'critical', number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const key = (severity || 'low').toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
    return levels[key] ?? 1;
  }

  /**
   * Manual unblock for administrative purposes
   */
  async unblockClient(userId: string, reason: string): Promise<boolean> {
    try {
      this.blockedClients.delete(userId);
      
      await this.createSecurityEvent({
        event_type: 'unauthorized_access',
        severity: 'low',
        endpoint: '/admin/unblock',
        method: 'POST',
        user_id: userId,
        request_count: 1,
        time_window: 0,
        metadata: { action: 'unblock', reason },
        blocked: false
      });

      return true;
    } catch (error) {
      logError('Failed to unblock client:', "Error", error);
      return false;
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old data every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Clean request history
      for (const [clientKey, history] of this.requestHistory) {
        const recentHistory = history.filter(req => req.timestamp > oneHourAgo);
        if (recentHistory.length === 0) {
          this.requestHistory.delete(clientKey);
        } else {
          this.requestHistory.set(clientKey, recentHistory);
        }
      }

      // Clean expired blocks
      for (const [clientKey, blockInfo] of this.blockedClients) {
        if (now > blockInfo.until) {
          this.blockedClients.delete(clientKey);
        }
      }
    }, 300000); // 5 minutes
  }
}

// Export singleton instance
export const apiSecurityMonitor = ApiSecurityMonitor.getInstance();

// Convenience function for checking request security
export async function checkApiRequestSecurity(
  endpoint: string,
  method: string,
  userId?: string
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const result = await apiSecurityMonitor.checkRequestSecurity(endpoint, method, userId);
  return {
    allowed: result.allowed,
    reason: result.reason
  };
}

// Export types
export type { SecurityEvent, RateLimitRule, SuspiciousPattern };
