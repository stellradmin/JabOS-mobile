/**
 * REAL CERTIFICATE PINNING SERVICE
 *
 * Uses react-native-ssl-pinning native module for TRUE certificate validation
 * Protects against man-in-the-middle attacks via certificate pinning
 *
 * SECURITY CRITICAL: Ensure certificates are rotated before expiry!
 * Certificate Rotation Schedule: Check quarterly, rotate annually
 *
 * REAL CERTIFICATE PINS (Extracted: 2025-10-28):
 * - Supabase: Expires ~2025-12-31 (Let's Encrypt 90-day cycle)
 * - RevenueCat: Expires ~2026-01-31
 * - PostHog: Expires ~2026-02-28
 *
 * HOW TO UPDATE PINS:
 * 1. Extract new pins 30 days before expiry:
 *    ```bash
 *    echo | openssl s_client -connect <hostname>:443 -servername <hostname> 2>/dev/null | \
 *    openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
 *    openssl dgst -sha256 -binary | base64
 *    ```
 * 2. Update pins below
 * 3. Deploy new app version
 * 4. Wait 30 days for users to update
 * 5. Server can now rotate certificates safely
 */

import { Platform } from 'react-native';
import { fetch as sslFetch } from 'react-native-ssl-pinning';
import { logError, logWarn, logInfo, logDebug } from './logger';

/** Certificate pin configuration */
interface CertificatePin {
  hostname: string;
  /** SHA256 hash of the public key (leaf certificate) */
  leafPin: string;
  /** SHA256 hash of the CA certificate (issuer) for backup */
  caPin: string;
  /** When these pins expire and need rotation */
  validUntil: string;
}

/** SSL pinning configuration */
interface SSLPinningConfig {
  /** Enable certificate pinning (disable for development only) */
  enabled: boolean;
  /** Strict mode: reject connections on pin mismatch */
  strictMode: boolean;
  /** Certificate pins for each host */
  pins: CertificatePin[];
}

/**
 * REAL Certificate Pins (Extracted from production servers on 2025-10-28)
 *
 * ⚠️ CRITICAL: These are REAL pins - changing them will break API calls!
 * Pin both leaf + CA certificates for redundancy during certificate rotation
 */
const CERTIFICATE_PINS: CertificatePin[] = [
  {
    hostname: 'bodiwrrbjpfuvepnpnsv.supabase.co',
    leafPin: 'sha256/o7y2J41zMtHgAsZJDXeU13tHTo2m4Br+9xBR8RdSCvY=',
    caPin: 'sha256/kIdp6NNEd8wsugYyyIYFsi1ylMCED3hZbSR8ZFsa/A4=',
    validUntil: '2025-12-31', // Let's Encrypt rotates every 90 days
  },
  {
    hostname: 'api.revenuecat.com',
    leafPin: 'sha256/VGu0zIfFg4zoRk4uXxKdd2GIJfdT+Xgb1mNQo/12Ijs=',
    caPin: 'sha256/lyXQLG/81tHkNq6AspMb9zMj2vhe29x5k/iuxJHpsms=',
    validUntil: '2026-01-31',
  },
  {
    hostname: 'eu.posthog.com',
    leafPin: 'sha256/qcxyjH3ChjgfK4MDhMi6saL+xWPI+Yv5UTZplJMwQdE=',
    caPin: 'sha256/vxRon/El5KuI4vx5ey1DgmsYmRY0nDd5Cg4GfJ8S+bg=',
    validUntil: '2026-02-28',
  },
];

class CertificatePinningService {
  private static instance: CertificatePinningService;
  private config: SSLPinningConfig;
  private initialized = false;

  private constructor() {
    // Disable pinning in development/Expo Go (requires native build)
    const isDevelopment = process.env.EXPO_PUBLIC_APP_ENV === 'development';
    const isExpoGo = process.env.EXPO_USE_EXPO_GO === 'true';

    this.config = {
      enabled: !isDevelopment && !isExpoGo && Platform.OS !== 'web',
      strictMode: true,
      pins: CERTIFICATE_PINS,
    };
  }

  public static getInstance(): CertificatePinningService {
    if (!CertificatePinningService.instance) {
      CertificatePinningService.instance = new CertificatePinningService();
    }
    return CertificatePinningService.instance;
  }

  /**
   * Initialize certificate pinning
   * Call this once during app startup
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logDebug('Certificate pinning already initialized', 'SECURITY');
      return;
    }

    if (!this.config.enabled) {
      logWarn(
        'Certificate pinning DISABLED (development mode or Expo Go)',
        'SECURITY'
      );
      this.initialized = true;
      return;
    }

    logInfo('Initializing REAL certificate pinning', 'SECURITY', {
      pinnedHosts: this.config.pins.map((p) => p.hostname),
      strictMode: this.config.strictMode,
    });

    // Check for expiring certificates
    this.checkCertificateExpiry();

    this.initialized = true;
    logInfo('Certificate pinning initialized successfully', 'SECURITY');
  }

  /**
   * Make a pinned fetch request
   * Automatically validates certificate against configured pins
   *
   * @param url Full URL to fetch
   * @param options Standard fetch options
   * @returns Response from the server
   */
  public async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.config.enabled) {
      // Fallback to standard fetch when pinning disabled
      return fetch(url, options);
    }

    try {
      const hostname = new URL(url).hostname;
      const pinConfig = this.getPinForHostname(hostname);

      if (!pinConfig) {
        logDebug(`No pin configured for ${hostname}, using standard fetch`, 'SECURITY');
        return fetch(url, options);
      }

      // Use react-native-ssl-pinning with REAL certificate validation
      // Build compatible options for ssl-pinning library
      const sslOptions: any = {
        method: (options.method as string) || 'GET',
        sslPinning: {
          certs: [pinConfig.leafPin, pinConfig.caPin],
        },
        timeoutInterval: 30000,
      };

      // Add body if present (convert to string/object as needed)
      if (options.body) {
        if (typeof options.body === 'string' || typeof options.body === 'object') {
          sslOptions.body = options.body;
        }
      }

      // Add headers if present
      if (options.headers) {
        sslOptions.headers = options.headers;
      }

      const response = await sslFetch(url, sslOptions);

      // Return as standard Response (react-native-ssl-pinning response is compatible)
      return response as unknown as Response;
    } catch (error: any) {
      // Certificate pinning failed - POTENTIAL MITM ATTACK
      logError('Certificate pinning validation FAILED', 'SECURITY', error);

      if (this.config.strictMode) {
        throw new Error(
          `SSL Certificate validation failed for ${new URL(url).hostname}. ` +
          `Potential man-in-the-middle attack detected. Connection refused.`
        );
      }

      // Non-strict mode: log and allow (not recommended for production)
      logWarn('Allowing connection despite pin mismatch (non-strict mode)', 'SECURITY');
      return fetch(url, options);
    }
  }

  /**
   * Get pin configuration for a hostname
   */
  private getPinForHostname(hostname: string): CertificatePin | null {
    // Direct match
    const directMatch = this.config.pins.find((pin) => pin.hostname === hostname);
    if (directMatch) return directMatch;

    // Wildcard match (*.example.com)
    const wildcardMatch = this.config.pins.find((pin) => {
      if (pin.hostname.startsWith('*.')) {
        const domain = pin.hostname.slice(2);
        return hostname.endsWith(domain);
      }
      return false;
    });

    return wildcardMatch || null;
  }

  /**
   * Check if any certificates are expiring soon
   * Warns if pins need rotation
   */
  private checkCertificateExpiry(): void {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const pin of this.config.pins) {
      const expiryDate = new Date(pin.validUntil);

      if (expiryDate < now) {
        logError(
          `Certificate pin for ${pin.hostname} has EXPIRED!`,
          'SECURITY',
          new Error('Certificate pin expired - app may fail to connect')
        );
      } else if (expiryDate < thirtyDaysFromNow) {
        logWarn(
          `Certificate pin for ${pin.hostname} expires soon (${pin.validUntil})`,
          'SECURITY'
        );
      }
    }
  }

  /**
   * Get pinning configuration (for debugging)
   */
  public getConfig(): SSLPinningConfig {
    return { ...this.config };
  }

  /**
   * Check if pinning is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Export singleton instance
export const certificatePinning = CertificatePinningService.getInstance();

// Export for testing/debugging
export { CertificatePin, SSLPinningConfig };
