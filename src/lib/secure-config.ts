/**
 * Secure Configuration Manager
 * 
 * This module manages secure access to API keys and configuration
 * without exposing sensitive data on the client side.
 * 
 * ALL API keys are stored server-side in encrypted Supabase secrets.
 * NO API keys should ever be stored in client-side code or .env files.
 */

import { supabase } from './supabase';
import { apiSecurityMonitor } from './api-security-monitor';
import * as SecureStore from 'expo-secure-store';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface ConfigValue {
  key: string;
  value: any;
  encrypted: boolean;
  environment: 'development' | 'staging' | 'production';
  lastUpdated: string;
  expiresAt?: string;
}

interface SecureApiConfig {
  baseUrl: string;
  requiresAuth: boolean;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  timeout: number;
  retries: number;
}

class SecureConfigManager {
  private static instance: SecureConfigManager;
  private configCache: Map<string, ConfigValue> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  // Predefined secure configurations for known services
  private readonly serviceConfigs: Record<string, SecureApiConfig> = {
    'natal-chart-api': {
      baseUrl: '/functions/v1/natal-chart-api',
      requiresAuth: true,
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000
      },
      timeout: 30000,
      retries: 2
    },
    'calculate-natal-chart': {
      baseUrl: '/functions/v1/calculate-natal-chart',
      requiresAuth: true,
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000
      },
      timeout: 30000,
      retries: 2
    },
    'geocode-city': {
      baseUrl: '/functions/v1/geocode-city',
      requiresAuth: true,
      rateLimit: {
        maxRequests: 60,
        windowMs: 60000
      },
      timeout: 10000,
      retries: 1
    },
    'external-api-proxy': {
      baseUrl: '/functions/v1/external-api-proxy',
      requiresAuth: true,
      rateLimit: {
        maxRequests: 20,
        windowMs: 60000
      },
      timeout: 30000,
      retries: 1
    },
    'posthog': {
      baseUrl: '/functions/v1/external-api-proxy',
      requiresAuth: true,
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000
      },
      timeout: 10000,
      retries: 0
    }
  };

  private constructor() {
    this.startCacheCleanup();
  }

  static getInstance(): SecureConfigManager {
    if (!SecureConfigManager.instance) {
      SecureConfigManager.instance = new SecureConfigManager();
    }
    return SecureConfigManager.instance;
  }

  /**
   * Get service configuration (client-side safe)
   */
  getServiceConfig(serviceName: string): SecureApiConfig {
    const config = this.serviceConfigs[serviceName];
    if (!config) {
      throw new Error(`Unknown service configuration: ${serviceName}`);
    }
    return { ...config }; // Return a copy
  }

  /**
   * Get public configuration value
   */
  async getPublicConfig(key: string): Promise<any> {
    try {
      const cacheKey = `public_${key}`;
      const cached = this.configCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        return cached.value;
      }

      // Get public configuration from Supabase
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .eq('is_public', true)
        .single();

      if (error) {
        logWarn('Failed to get public config:', "Warning", error);
        return null;
      }

      const configValue: ConfigValue = {
        key,
        value: data.value,
        encrypted: false,
        environment: this.getCurrentEnvironment(),
        lastUpdated: new Date().toISOString()
      };

      this.setCacheValue(cacheKey, configValue);
      return data.value;

    } catch (error) {
      logError('Error getting public config:', "Error", error);
      return null;
    }
  }

  /**
   * Make secure API request using server-side proxy
   */
  async makeSecureApiRequest(
    serviceName: string,
    endpoint: string,
    options: {
      method?: string;
      data?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<Response> {
    const config = this.getServiceConfig(serviceName);
    
    // Check rate limiting and security
    const securityCheck = await apiSecurityMonitor.checkRequestSecurity(
      config.baseUrl + endpoint,
      options.method || 'GET'
    );

    if (!securityCheck.allowed) {
      throw new Error(`Request blocked: ${securityCheck.reason}`);
    }

    try {
      const requestBody = {
        service: serviceName,
        endpoint,
        method: options.method || 'GET',
        headers: options.headers || {},
        data: options.data
      };

      const response = await supabase.functions.invoke('external-api-proxy', {
        body: requestBody
      });

      if (response.error) {
        throw new Error(`API request failed: ${response.error.message}`);
      }

      // Return a Response-like object
      return new Response(JSON.stringify(response.data), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      logError('Secure API request failed:', "Error", error);
      throw error;
    }
  }

  /**
   * Get application environment
   */
  getCurrentEnvironment(): 'development' | 'staging' | 'production' {
    const env = process.env.EXPO_PUBLIC_APP_ENV || 'development';
    return env as 'development' | 'staging' | 'production';
  }

  /**
   * Check if app is in development mode
   */
  isDevelopment(): boolean {
    return this.getCurrentEnvironment() === 'development' || __DEV__;
  }

  /**
   * Get Supabase configuration (already public keys)
   */
  getSupabaseConfig(): {
    url: string;
    anonKey: string;
    environment: string;
  } {
    return {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      environment: this.getCurrentEnvironment()
    };
  }

  /**
   * Validate configuration security
   */
  async validateSecurityConfig(): Promise<{
    isSecure: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if we're in production
      const isProduction = this.getCurrentEnvironment() === 'production';
      
      // Check environment variables
      if (process.env.EXPO_PUBLIC_SUPABASE_URL?.includes('localhost')) {
        issues.push('Supabase URL points to localhost in production');
      }

      // Check for any remaining hardcoded secrets in environment
      const suspiciousEnvVars = [
        'OPENCAGE_API_KEY',
        'RAPIDAPI_KEY',
        'POSTHOG_PRIVATE_KEY'
      ];

      for (const envVar of suspiciousEnvVars) {
        if (process.env[envVar]) {
          issues.push(`Found potentially hardcoded secret: ${envVar}`);
          recommendations.push(`Move ${envVar} to Supabase encrypted secrets`);
        }
      }

      // Check secure store for any cached secrets
      try {
        const secureStoreKeys = await SecureStore.getItemAsync('cached_secrets');
        if (secureStoreKeys) {
          const keys = JSON.parse(secureStoreKeys);
          if (keys.length > 0) {
            issues.push('Found cached secrets in secure storage');
            recommendations.push('Clear cached secrets and use server-side proxy');
          }
        }
      } catch (error) {
        // Secure store error is not critical
      }

      // ⚠️ MOCK: Check certificate pinning status
      // IMPORTANT: Current certificate pinning is MOCK ONLY and provides NO real MITM protection
      const { certificatePinning } = await import('./certificate-pinning');
      // MIGRATED TO NEW PROJECT: bodiwrrbjpfuvepnpnsv (2025-10-21)
      const pinningStatus = certificatePinning.getPinningStatus('bodiwrrbjpfuvepnpnsv.supabase.co');

      // Always warn about mock implementation
      issues.push('⚠️ MOCK certificate pinning detected - NO real MITM protection');
      recommendations.push('Implement native certificate pinning using react-native-ssl-pinning for production');

      if (!pinningStatus.isPinned && isProduction) {
        issues.push('Certificate pinning not configured for production');
        recommendations.push('Configure certificate pins for critical endpoints');
      }

      const isSecure = issues.length === 0;

      return { isSecure, issues, recommendations };

    } catch (error) {
      return {
        isSecure: false,
        issues: ['Security validation failed: ' + error.message],
        recommendations: ['Review security configuration manually']
      };
    }
  }

  /**
   * Get runtime security metrics
   */
  async getSecurityMetrics(): Promise<{
    configuredServices: number;
    secureConnections: number;
    blockedRequests: number;
    lastSecurityCheck: string;
  }> {
    try {
      const stats = await apiSecurityMonitor.getSecurityStats(1); // Last hour
      
      return {
        configuredServices: Object.keys(this.serviceConfigs).length,
        secureConnections: 100, // Placeholder - would come from actual metrics
        blockedRequests: stats.blockedRequests,
        lastSecurityCheck: new Date().toISOString()
      };
    } catch (error) {
      logError('Failed to get security metrics:', "Error", error);
      return {
        configuredServices: 0,
        secureConnections: 0,
        blockedRequests: 0,
        lastSecurityCheck: new Date().toISOString()
      };
    }
  }

  private isCacheValid(configValue: ConfigValue): boolean {
    const age = Date.now() - new Date(configValue.lastUpdated).getTime();
    return age < this.CACHE_DURATION;
  }

  private setCacheValue(key: string, value: ConfigValue): void {
    // Implement cache size limit
    if (this.configCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.configCache.keys().next().value as string;
      this.configCache.delete(firstKey);
    }
    
    this.configCache.set(key, value);
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.configCache) {
        if (!this.isCacheValid(value)) {
          this.configCache.delete(key);
        }
      }
    }, 300000); // Clean every 5 minutes
  }

  /**
   * Clear all cached configuration (for security)
   */
  clearCache(): void {
    this.configCache.clear();
  }
}

// Export singleton instance
export const secureConfig = SecureConfigManager.getInstance();

// Convenience functions
export async function getServiceConfig(serviceName: string): Promise<SecureApiConfig> {
  return secureConfig.getServiceConfig(serviceName);
}

export async function makeSecureRequest(
  serviceName: string,
  endpoint: string,
  options?: any
): Promise<Response> {
  return secureConfig.makeSecureApiRequest(serviceName, endpoint, options);
}

// Export types
export type { SecureApiConfig, ConfigValue };
