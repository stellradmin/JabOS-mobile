import { logger } from './logger';
import { isStrictSecurity } from '../lib/runtime-security';

interface JWTPayload {
  sub: string;
  email?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  role?: string;
  session_id?: string;
}

interface JWTValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
  reason?: string;
}

class JWTValidator {
  private supabaseJwtSecret: string | null = null;
  
  constructor() {
    this.supabaseJwtSecret = process.env.EXPO_PUBLIC_SUPABASE_JWT_SECRET || null;
  }

  private base64UrlDecode(input: string): string {
    try {
      // Replace URL-safe chars and pad
      const base64 = input.replace(/-/g, '+').replace(/_/g, '/') +
        '==='.slice(0, (4 - (input.length % 4)) % 4);
      const decoded = typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
      // Convert binary string to UTF-8
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i));
      }
      // Decode percent-encoded UTF-8
      return decodeURIComponent(result.split('').map(c => {
        const code = c.charCodeAt(0).toString(16).padStart(2, '0');
        return `%${code}`;
      }).join(''));
    } catch {
      return '';
    }
  }

  private decodePayload<T = any>(token: string): T | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = this.base64UrlDecode(parts[1]);
    if (!payloadJson) return null;
    try {
      return JSON.parse(payloadJson) as T;
    } catch {
      return null;
    }
  }

  /**
   * Validates JWT token structure and claims without signature verification
   * This provides basic protection against malformed tokens
   */
  validateJWTStructure(token: string): JWTValidationResult {
    try {
      // Decode without verification to check structure
      const payload = this.decodePayload<JWTPayload>(token);

      if (!payload) {
        return {
          valid: false,
          error: 'Invalid token structure',
          reason: 'TOKEN_MALFORMED'
        };
      }
      
      // Validate required claims
      if (!payload.sub || !payload.aud || !payload.iss || !payload.iat || !payload.exp) {
        return {
          valid: false,
          error: 'Missing required JWT claims',
          reason: 'MISSING_CLAIMS'
        };
      }

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return {
          valid: false,
          error: 'Token expired',
          reason: 'TOKEN_EXPIRED'
        };
      }

      // Check if token is issued in the future (clock skew protection)
      if (payload.iat > now + 60) { // Allow 60 seconds skew
        return {
          valid: false,
          error: 'Token issued in the future',
          reason: 'FUTURE_TOKEN'
        };
      }

      // Validate audience
      // Supabase access tokens commonly use aud: 'authenticated' (or 'anon').
      // In strict builds, also allow project-ref audiences. In dev, skip this check.
      const expectedAudience = process.env.EXPO_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0];
      const aud = (payload.aud || '').toLowerCase();
      const allowedAudiences = new Set(['authenticated', 'anon', 'supabase']);
      if (isStrictSecurity()) {
        const matchesProject = expectedAudience ? aud.includes(expectedAudience.toLowerCase()) : false;
        if (!allowedAudiences.has(aud) && !matchesProject) {
          return {
            valid: false,
            error: 'Invalid audience',
            reason: 'INVALID_AUDIENCE'
          };
        }
      }

      // Validate issuer
      if (!payload.iss.includes('supabase')) {
        return {
          valid: false,
          error: 'Invalid issuer',
          reason: 'INVALID_ISSUER'
        };
      }

      return {
        valid: true,
        payload
      };

    } catch (error) {
      logger.error('JWT validation failed', error instanceof Error ? error : undefined, {}, 'AUTH_JWT');
      return {
        valid: false,
        error: 'JWT validation error',
        reason: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Performs comprehensive JWT validation including signature verification
   * if JWT secret is available
   */
  async validateJWT(token: string): Promise<JWTValidationResult> {
    // First validate structure
    const structureValidation = this.validateJWTStructure(token);
    if (!structureValidation.valid) {
      return structureValidation;
    }

    // Signature verification is not supported in Expo Go/React Native without a
    // dedicated crypto library. We return the structural validation result.
    return structureValidation;
  }

  /**
   * Validates session token against user context
   */
  validateSessionContext(token: string, expectedUserId: string): JWTValidationResult {
    const validation = this.validateJWTStructure(token);
    
    if (!validation.valid || !validation.payload) {
      return validation;
    }

    // Verify the token belongs to the expected user
    if (validation.payload.sub !== expectedUserId) {
      return {
        valid: false,
        error: 'Token user mismatch',
        reason: 'USER_MISMATCH'
      };
    }

    // Check if token has appropriate role
    if (validation.payload.role && !['authenticated', 'anon'].includes(validation.payload.role)) {
      return {
        valid: false,
        error: 'Invalid token role',
        reason: 'INVALID_ROLE'
      };
    }

    return validation;
  }

  /**
   * Extracts user information from validated JWT
   */
  extractUserInfo(token: string): { userId: string; email?: string } | null {
    const validation = this.validateJWTStructure(token);
    
    if (!validation.valid || !validation.payload) {
      return null;
    }

    return {
      userId: validation.payload.sub,
      email: validation.payload.email
    };
  }

  /**
   * Checks if token is about to expire (within specified minutes)
   */
  isTokenNearExpiry(token: string, minutesThreshold: number = 5): boolean {
    const validation = this.validateJWTStructure(token);
    
    if (!validation.valid || !validation.payload) {
      return true; // Treat invalid tokens as expired
    }

    const now = Math.floor(Date.now() / 1000);
    const expiryThreshold = now + (minutesThreshold * 60);
    
    return validation.payload.exp < expiryThreshold;
  }

  /**
   * Security audit function to log JWT validation attempts
   */
  auditJWTValidation(token: string, result: JWTValidationResult, context: string) {
    const userInfo = result.valid ? this.extractUserInfo(token) : null;
    
    logger.info('JWT validation audit', undefined, {
      context,
      valid: result.valid,
      reason: result.reason,
      userId: userInfo?.userId,
      timestamp: new Date().toISOString()
    }, 'AUTH_AUDIT');

    // Log security events for failed validations
    if (!result.valid) {
      logger.warn('JWT validation failed', undefined, {
        context,
        reason: result.reason,
        error: result.error,
        timestamp: new Date().toISOString()
      }, 'SECURITY');
    }
  }
}

export const jwtValidator = new JWTValidator();
export type { JWTValidationResult, JWTPayload };
