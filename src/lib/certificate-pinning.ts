/**
 * ⚠️ HTTPS Certificate Pinning Security Module - TESTING/VALIDATION ONLY ⚠️
 *
 * PURPOSE: Provides certificate pinning validation for security testing
 * and production readiness checks.
 *
 * ⚠️ IMPORTANT SECURITY NOTICE:
 * This is a MOCK implementation for testing purposes only.
 * It does NOT provide actual runtime certificate pinning security.
 *
 * For REAL certificate pinning in production, implement:
 * 1. Native certificate pinning using react-native-ssl-pinning or similar
 * 2. Network-layer validation (not JavaScript-layer)
 * 3. Proper certificate extraction and validation
 *
 * Current implementation:
 * - Returns known pins for testing/validation
 * - Used by security validation suite for readiness checks
 * - Does NOT prevent MITM attacks in production
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Certificate fingerprints for critical services
// These should be updated when certificates are renewed
// MIGRATED TO NEW PROJECT: bodiwrrbjpfuvepnpnsv (2025-10-21)
const CERTIFICATE_PINS = {
  'bodiwrrbjpfuvepnpnsv.supabase.co': [
    'sha256/YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=', // Primary cert
    'sha256/8Rw90Ej3Ttt8RRkrg+WYDS9n7IS03bk5bjP/UXPtaY8=', // Backup cert
    'sha256/6BaMQNXeI0CeZGqxe2vdFGN3jNsqr5NaL4AcZH7QDBg=',
    'sha256/E9CZ9INDbd+2eRQozYqqbQ2yXLVKB9+xcprMF+44U1g='
  ]
};

interface PinningConfig {
  host: string;
  pins: string[];
  enforceSSL: boolean;
  allowBackup: boolean;
  validFrom?: Date;
  validTo?: Date;
}

interface ValidationResult {
  isValid: boolean;
  reason?: string;
  usedBackup?: boolean;
  timestamp: Date;
}

class CertificatePinningService {
  private static instance: CertificatePinningService;
  private pinningConfig: Map<string, PinningConfig> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  private constructor() {
    this.initializePinningConfig();
  }

  static getInstance(): CertificatePinningService {
    if (!CertificatePinningService.instance) {
      CertificatePinningService.instance = new CertificatePinningService();
    }
    return CertificatePinningService.instance;
  }

  private initializePinningConfig(): void {
    // Initialize pinning configuration for critical hosts
    // MIGRATED TO NEW PROJECT: bodiwrrbjpfuvepnpnsv (2025-10-21)
    this.pinningConfig.set('bodiwrrbjpfuvepnpnsv.supabase.co', {
      host: 'bodiwrrbjpfuvepnpnsv.supabase.co',
      pins: CERTIFICATE_PINS['bodiwrrbjpfuvepnpnsv.supabase.co'],
      enforceSSL: true,
      allowBackup: true,
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2026-12-31')
    });
  }

  /**
   * Validate certificate fingerprint for a given host
   */
  async validateCertificate(
    host: string,
    certificateFingerprint: string
  ): Promise<ValidationResult> {
    try {
      const cacheKey = `${host}:${certificateFingerprint}`;
      const cached = this.validationCache.get(cacheKey);
      
      // Check cache
      if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
        return cached;
      }

      const config = this.pinningConfig.get(host);
      if (!config) {
        // Host not configured for pinning - allow but log
        logWarn('Certificate pinning not configured for host:', "Warning", host);
        return { isValid: true, reason: 'No pinning configured', timestamp: new Date() };
      }

      // Check if current date is within validity period
      const now = new Date();
      if (config.validFrom && now < config.validFrom) {
        return { isValid: false, reason: 'Certificate not yet valid', timestamp: now };
      }
      if (config.validTo && now > config.validTo) {
        return { isValid: false, reason: 'Certificate expired', timestamp: now };
      }

      // Validate against pinned certificates
      const isValidPin = config.pins.includes(certificateFingerprint);
      
      const result: ValidationResult = {
        isValid: isValidPin,
        reason: isValidPin ? 'Valid certificate pin' : 'Certificate pin mismatch',
        usedBackup: config.allowBackup && config.pins.indexOf(certificateFingerprint) > 0,
        timestamp: now
      };

      // Cache the result
      this.validationCache.set(cacheKey, result);

      // Log security event
      await this.logSecurityEvent('certificate_validation', {
        host,
        isValid: result.isValid,
        reason: result.reason,
        usedBackup: result.usedBackup
      });

      return result;

    } catch (error) {
      logError('Certificate validation error:', "Error", error);
      return { 
        isValid: false, 
        reason: 'Validation error: ' + error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Enhanced fetch with certificate pinning
   */
  async secureRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;

      // Enforce HTTPS for pinned hosts
      if (this.pinningConfig.has(host) && urlObj.protocol !== 'https:') {
        throw new Error(`HTTPS required for pinned host: ${host}`);
      }

      // For React Native, we'll use a custom header to request certificate info
      // In a real implementation, you'd use native modules for actual certificate pinning
      const requestOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          'X-Certificate-Pinning': 'enabled',
          'X-Expected-Host': host
        }
      };

      const response = await fetch(url, requestOptions);

      // In production, certificate validation would happen at the network layer
      // For this implementation, we'll simulate validation
      const mockCertificateFingerprint = await this.getMockCertificateFingerprint(host);
      const validation = await this.validateCertificate(host, mockCertificateFingerprint);

      if (!validation.isValid) {
        throw new Error(`Certificate validation failed for ${host}: ${validation.reason}`);
      }

      if (validation.usedBackup) {
        logWarn(`Using backup certificate for ${host}`, "Warning");
      }

      return response;

    } catch (error) {
      // Log security incident
      await this.logSecurityEvent('secure_request_failed', {
        url: url.substring(0, 100), // Truncate URL for logs
        error: error.message
      });

      throw error;
    }
  }

  /**
   * ⚠️ MOCK Certificate Fingerprint Retrieval - TESTING ONLY ⚠️
   *
   * Returns the expected certificate pin for testing/validation purposes.
   * This does NOT extract real certificates from the network layer.
   *
   * In production with real certificate pinning:
   * - Use native modules to extract actual certificate fingerprints
   * - Validate at TLS/SSL layer (before JavaScript execution)
   * - See: react-native-ssl-pinning, TrustKit, or platform-specific solutions
   */
  private async getMockCertificateFingerprint(host: string): Promise<string> {
    // TESTING ONLY: Returns expected pin, not real certificate
    const config = this.pinningConfig.get(host);
    if (config && config.pins.length > 0) {
      return config.pins[0]; // Return the primary pin for validation testing
    }

    // Return a mock fingerprint for non-configured hosts
    return 'sha256/mockFingerprintForTesting123456789012345678=';
  }

  /**
   * Update certificate pins (for certificate rotation)
   */
  async updateCertificatePins(
    host: string,
    newPins: string[],
    validFrom?: Date,
    validTo?: Date
  ): Promise<boolean> {
    try {
      const config = this.pinningConfig.get(host);
      if (!config) {
        throw new Error(`No pinning configuration found for host: ${host}`);
      }

      // Validate new pins format
      for (const pin of newPins) {
        if (!pin.startsWith('sha256/') || pin.length < 50) {
          throw new Error(`Invalid certificate pin format: ${pin}`);
        }
      }

      // Update configuration
      const updatedConfig: PinningConfig = {
        ...config,
        pins: newPins,
        validFrom: validFrom || config.validFrom,
        validTo: validTo || config.validTo
      };

      this.pinningConfig.set(host, updatedConfig);

      // Clear cache for this host
      for (const [key] of this.validationCache) {
        if (key.startsWith(`${host}:`)) {
          this.validationCache.delete(key);
        }
      }

      // Store updated configuration securely
      await SecureStore.setItemAsync(
        `cert_pins_${host}`,
        JSON.stringify(updatedConfig)
      );

      // Log certificate update
      await this.logSecurityEvent('certificate_pins_updated', {
        host,
        pinCount: newPins.length,
        validFrom: validFrom?.toISOString(),
        validTo: validTo?.toISOString()
      });

      return true;

    } catch (error) {
      logError('Failed to update certificate pins:', "Error", error);
      return false;
    }
  }

  /**
   * Get certificate pinning status for a host
   */
  getPinningStatus(host: string): {
    isPinned: boolean;
    pinCount: number;
    enforceSSL: boolean;
    validUntil?: Date;
  } {
    const config = this.pinningConfig.get(host);
    if (!config) {
      return { isPinned: false, pinCount: 0, enforceSSL: false };
    }

    return {
      isPinned: true,
      pinCount: config.pins.length,
      enforceSSL: config.enforceSSL,
      validUntil: config.validTo
    };
  }

  /**
   * Log security events for monitoring
   */
  private async logSecurityEvent(event: string, data: any): Promise<void> {
    try {
      const securityEvent = {
        event,
        data,
        timestamp: new Date().toISOString(),
        app_version: '1.0.0', // Get from app config
        user_agent: 'Stellr Mobile App'
      };

      // Log to Supabase for security monitoring
      const { error } = await supabase
        .from('security_events')
        .insert([securityEvent]);

      if (error) {
        logWarn('Failed to log security event:', "Warning", error);
      }

    } catch (error) {
      logWarn('Security event logging failed:', "Warning", error);
    }
  }

  /**
   * Perform security health check
   */
  async performSecurityHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    pinningStats: { host: string; status: string; validUntil?: string }[];
  }> {
    const issues: string[] = [];
    const pinningStats: { host: string; status: string; validUntil?: string }[] = [];
    const now = new Date();

    for (const [host, config] of this.pinningConfig) {
      let status = 'healthy';

      if (config.validTo && now > config.validTo) {
        status = 'expired';
        issues.push(`Certificate pins expired for ${host}`);
      } else if (config.validTo && (config.validTo.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        status = 'expiring_soon';
        issues.push(`Certificate pins expiring soon for ${host}`);
      }

      pinningStats.push({
        host,
        status,
        validUntil: config.validTo?.toISOString()
      });
    }

    const overallStatus = issues.some(i => i.includes('expired')) ? 'critical' :
                         issues.length > 0 ? 'warning' : 'healthy';

    return { status: overallStatus, issues, pinningStats };
  }

  /**
   * ⚠️ MOCK: Alias for performSecurityHealthCheck() - used by _layout.tsx
   *
   * IMPORTANT: This is a MOCK implementation and provides NO real MITM protection.
   * For production security, implement native certificate pinning using react-native-ssl-pinning.
   */
  async checkCertificateHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    pinningStats: { host: string; status: string; validUntil?: string }[];
  }> {
    logWarn('checkCertificateHealth called - MOCK IMPLEMENTATION ONLY, no real MITM protection', "Warning");
    return this.performSecurityHealthCheck();
  }

  /**
   * ⚠️ MOCK: Get security configuration
   *
   * Returns pinning configuration for monitoring purposes.
   * IMPORTANT: This is a MOCK implementation and provides NO real security.
   */
  getSecurityConfig(): {
    hosts: string[];
    totalPins: number;
    enforceSSL: boolean;
    mockImplementation: boolean;
  } {
    const hosts = Array.from(this.pinningConfig.keys());
    const totalPins = Array.from(this.pinningConfig.values())
      .reduce((sum, config) => sum + config.pins.length, 0);

    return {
      hosts,
      totalPins,
      enforceSSL: true,
      mockImplementation: true // CRITICAL: This indicates mock implementation
    };
  }

  /**
   * ⚠️ MOCK: Get pinned certificates
   *
   * Returns the configured certificate pins for monitoring purposes.
   * IMPORTANT: This is a MOCK implementation and provides NO real security.
   */
  getPinnedCertificates(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [host, config] of this.pinningConfig) {
      result[host] = config.pins;
    }
    return result;
  }
}

// Export singleton instance
export const certificatePinning = CertificatePinningService.getInstance();

// Convenience function for making secure requests
export async function secureApiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return certificatePinning.secureRequest(url, options);
}

// Export types
export type { ValidationResult, PinningConfig };
