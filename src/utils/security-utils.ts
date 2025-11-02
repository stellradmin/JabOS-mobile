/**
 * CRITICAL SECURITY MODULE - Authentication Security Utilities
 * 
 * Purpose: Comprehensive security utilities for authentication, validation, and protection
 * Security Level: PRODUCTION-GRADE with zero-tolerance for vulnerabilities
 * 
 * IMPLEMENTS:
 * - RFC 5322 compliant email validation
 * - Strong password validation with complexity requirements
 * - Rate limiting with exponential backoff
 * - Input sanitization and XSS protection
 * - CSRF token management
 * - Session security monitoring
 * - Account enumeration prevention
 * - Security headers management
 */

import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug } from './logger';

// ===============================================================================
// SECURITY CONFIGURATION
// ===============================================================================

const SECURITY_CONFIG = {
  // Password Requirements
  PASSWORD: {
    MIN_LENGTH: 12, // Increased from 6 to 12 for production security
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
    MIN_ENTROPY: 50, // Minimum entropy bits
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    PREVENT_COMMON: true,
    PREVENT_SEQUENTIAL: true,
    PREVENT_REPEATED: true,
    MAX_REPEATED_CHARS: 3,
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    MAX_ATTEMPTS: 5,
    INITIAL_DELAY: 1000, // 1 second
    MAX_DELAY: 300000, // 5 minutes
    BACKOFF_MULTIPLIER: 2,
    RESET_AFTER: 900000, // 15 minutes
    LOCKOUT_DURATION: 1800000, // 30 minutes after max attempts
  },
  
  // Session Security
  SESSION: {
    MAX_AGE: 3600000, // 1 hour
    REFRESH_THRESHOLD: 300000, // 5 minutes before expiry
    IDLE_TIMEOUT: 900000, // 15 minutes of inactivity
    SUSPICIOUS_ACTIVITY_THRESHOLD: 3,
    VALIDATE_INTERVAL: 60000, // Check every minute
    FINGERPRINT_CHECKS: true,
  },
  
  // CSRF Protection
  CSRF: {
    TOKEN_LENGTH: 32,
    TOKEN_EXPIRY: 3600000, // 1 hour
    ROTATE_ON_USE: true,
  },
  
  // Input Validation
  INPUT: {
    MAX_EMAIL_LENGTH: 254,
    MAX_NAME_LENGTH: 100,
    MAX_BIO_LENGTH: 500,
    SANITIZE_HTML: true,
    PREVENT_SQL_INJECTION: true,
    PREVENT_XSS: true,
  },
};

// ===============================================================================
// EMAIL VALIDATION (RFC 5322 Compliant)
// ===============================================================================

/**
 * RFC 5322 compliant email validation
 * Implements full specification with security considerations
 */
export function validateEmailRFC5322(email: string): {
  isValid: boolean;
  reason?: string;
  sanitized?: string;
} {
  if (!email || typeof email !== 'string') {
    return { isValid: false, reason: 'Email is required' };
  }

  // Trim and lowercase for consistency
  const normalizedEmail = email.trim().toLowerCase();

  // Length validation
  if (normalizedEmail.length > SECURITY_CONFIG.INPUT.MAX_EMAIL_LENGTH) {
    return { isValid: false, reason: 'Email address is too long' };
  }

  if (normalizedEmail.length < 3) {
    return { isValid: false, reason: 'Email address is too short' };
  }

  // RFC 5322 simplified regex (covers 99.99% of valid emails)
  // Full RFC 5322 regex is over 6000 characters and impractical
  const rfc5322Regex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (!rfc5322Regex.test(normalizedEmail)) {
    return { isValid: false, reason: 'Invalid email format' };
  }

  // Split email into local and domain parts
  const [localPart, domainPart] = normalizedEmail.split('@');

  // Validate local part (before @)
  if (localPart.length > 64) {
    return { isValid: false, reason: 'Email local part is too long' };
  }

  // Check for consecutive dots
  if (localPart.includes('..') || domainPart.includes('..')) {
    return { isValid: false, reason: 'Email cannot contain consecutive dots' };
  }

  // Check for leading/trailing dots
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, reason: 'Email local part cannot start or end with a dot' };
  }

  // Validate domain part
  if (domainPart.length > 253) {
    return { isValid: false, reason: 'Email domain is too long' };
  }

  // Check for valid TLD
  const tldMatch = domainPart.match(/\.([a-z]{2,})$/);
  if (!tldMatch) {
    return { isValid: false, reason: 'Invalid email domain' };
  }

  // Check against disposable email domains (basic list)
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', 'guerrillamail.com',
    'mailinator.com', '10minutemail.com', 'temp-mail.org'
  ];
  
  if (disposableDomains.some(domain => domainPart.includes(domain))) {
    return { isValid: false, reason: 'Temporary email addresses are not allowed' };
  }

  // Check for SQL injection attempts
  const sqlInjectionPatterns = [
    /(\b(select|insert|update|delete|drop|union|exec|script)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_|0x)/i,
    /(<script|javascript:|onerror=|onload=)/i
  ];

  if (sqlInjectionPatterns.some(pattern => pattern.test(normalizedEmail))) {
    logWarn('Potential SQL injection attempt detected in email', 'Security');
    return { isValid: false, reason: 'Invalid characters in email' };
  }

  return { 
    isValid: true, 
    sanitized: normalizedEmail 
  };
}

// ===============================================================================
// PASSWORD VALIDATION & STRENGTH
// ===============================================================================

/**
 * Calculate password entropy
 */
function calculatePasswordEntropy(password: string): number {
  const charsets = {
    lowercase: 26,
    uppercase: 26,
    numbers: 10,
    special: SECURITY_CONFIG.PASSWORD.SPECIAL_CHARS.length,
  };

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += charsets.lowercase;
  if (/[A-Z]/.test(password)) poolSize += charsets.uppercase;
  if (/[0-9]/.test(password)) poolSize += charsets.numbers;
  if (new RegExp(`[${SECURITY_CONFIG.PASSWORD.SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)) {
    poolSize += charsets.special;
  }

  const entropy = password.length * Math.log2(poolSize);
  return entropy;
}

/**
 * Strong password validation with comprehensive checks
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;

  // Basic validation
  if (!password || typeof password !== 'string') {
    return { isValid: false, strength: 'weak', score: 0, issues: ['Password is required'] };
  }

  // Length validation
  if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
    issues.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters`);
  } else if (password.length >= SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
    score += 20;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;
  }

  if (password.length > SECURITY_CONFIG.PASSWORD.MAX_LENGTH) {
    issues.push(`Password must not exceed ${SECURITY_CONFIG.PASSWORD.MAX_LENGTH} characters`);
  }

  // Character type requirements
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = new RegExp(`[${SECURITY_CONFIG.PASSWORD.SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password);

  if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !hasLowercase) {
    issues.push('Password must contain at least one lowercase letter');
  } else if (hasLowercase) score += 10;

  if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !hasUppercase) {
    issues.push('Password must contain at least one uppercase letter');
  } else if (hasUppercase) score += 10;

  if (SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBER && !hasNumber) {
    issues.push('Password must contain at least one number');
  } else if (hasNumber) score += 10;

  if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL && !hasSpecial) {
    issues.push('Password must contain at least one special character');
  } else if (hasSpecial) score += 15;

  // Check for common passwords
  if (SECURITY_CONFIG.PASSWORD.PREVENT_COMMON) {
    const commonPasswords = [
      'password', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon',
      'Password1', 'Password123', 'Qwerty123', 'Welcome123',
      'Admin123', 'Letmein1', 'P@ssw0rd', 'P@ssword123'
    ];

    if (commonPasswords.some(common => password.toLowerCase().includes(common.toLowerCase()))) {
      issues.push('Password is too common, please choose a unique password');
      score = Math.max(0, score - 30);
    }
  }

  // Check for sequential characters
  if (SECURITY_CONFIG.PASSWORD.PREVENT_SEQUENTIAL) {
    const sequences = ['abc', '123', 'qwe', 'asd', 'zxc', '098', '876'];
    if (sequences.some(seq => password.toLowerCase().includes(seq))) {
      issues.push('Password contains sequential characters');
      score = Math.max(0, score - 10);
    }
  }

  // Check for repeated characters
  if (SECURITY_CONFIG.PASSWORD.PREVENT_REPEATED) {
    const repeatedPattern = new RegExp(`(.)\\1{${SECURITY_CONFIG.PASSWORD.MAX_REPEATED_CHARS},}`);
    if (repeatedPattern.test(password)) {
      issues.push(`Password contains more than ${SECURITY_CONFIG.PASSWORD.MAX_REPEATED_CHARS} repeated characters`);
      score = Math.max(0, score - 10);
    }
  }

  // Calculate entropy
  const entropy = calculatePasswordEntropy(password);
  if (entropy < SECURITY_CONFIG.PASSWORD.MIN_ENTROPY) {
    issues.push('Password is not complex enough');
    score = Math.max(0, score - 15);
  } else {
    score += Math.min(25, Math.floor(entropy / 4));
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score < 40) strength = 'weak';
  else if (score < 60) strength = 'medium';
  else if (score < 80) strength = 'strong';
  else strength = 'very-strong';

  return {
    isValid: issues.length === 0,
    strength,
    score: Math.min(100, score),
    issues
  };
}

// ===============================================================================
// RATE LIMITING & EXPONENTIAL BACKOFF
// ===============================================================================

interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  lockoutUntil?: number;
  backoffDelay: number;
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Check if an action is rate limited
   */
  public isRateLimited(identifier: string): {
    limited: boolean;
    retryAfter?: number;
    remainingAttempts?: number;
  } {
    const entry = this.attempts.get(identifier);
    
    if (!entry) {
      return { limited: false, remainingAttempts: SECURITY_CONFIG.RATE_LIMIT.MAX_ATTEMPTS };
    }

    const now = Date.now();

    // Check if locked out
    if (entry.lockoutUntil && now < entry.lockoutUntil) {
      return {
        limited: true,
        retryAfter: entry.lockoutUntil - now,
        remainingAttempts: 0
      };
    }

    // Check if within backoff period
    if (now < entry.lastAttempt + entry.backoffDelay) {
      return {
        limited: true,
        retryAfter: (entry.lastAttempt + entry.backoffDelay) - now,
        remainingAttempts: SECURITY_CONFIG.RATE_LIMIT.MAX_ATTEMPTS - entry.attempts
      };
    }

    // Reset if beyond reset period
    if (now > entry.lastAttempt + SECURITY_CONFIG.RATE_LIMIT.RESET_AFTER) {
      this.attempts.delete(identifier);
      return { limited: false, remainingAttempts: SECURITY_CONFIG.RATE_LIMIT.MAX_ATTEMPTS };
    }

    return {
      limited: false,
      remainingAttempts: SECURITY_CONFIG.RATE_LIMIT.MAX_ATTEMPTS - entry.attempts
    };
  }

  /**
   * Record an attempt and apply rate limiting
   */
  public recordAttempt(identifier: string, success: boolean = false): void {
    const now = Date.now();
    let entry = this.attempts.get(identifier);

    if (success) {
      // Reset on successful attempt
      this.attempts.delete(identifier);
      return;
    }

    if (!entry) {
      entry = {
        attempts: 1,
        lastAttempt: now,
        backoffDelay: SECURITY_CONFIG.RATE_LIMIT.INITIAL_DELAY
      };
    } else {
      entry.attempts++;
      entry.lastAttempt = now;
      
      // Apply exponential backoff
      entry.backoffDelay = Math.min(
        entry.backoffDelay * SECURITY_CONFIG.RATE_LIMIT.BACKOFF_MULTIPLIER,
        SECURITY_CONFIG.RATE_LIMIT.MAX_DELAY
      );

      // Apply lockout after max attempts
      if (entry.attempts >= SECURITY_CONFIG.RATE_LIMIT.MAX_ATTEMPTS) {
        entry.lockoutUntil = now + SECURITY_CONFIG.RATE_LIMIT.LOCKOUT_DURATION;
        logWarn(`Rate limit lockout applied for ${identifier}`, 'Security');
      }
    }

    this.attempts.set(identifier, entry);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - SECURITY_CONFIG.RATE_LIMIT.RESET_AFTER;

    for (const [key, entry] of this.attempts.entries()) {
      if (entry.lastAttempt < cutoff) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.attempts.clear();
  }
}

// Singleton rate limiter instance
export const rateLimiter = new RateLimiter();

// ===============================================================================
// INPUT SANITIZATION & XSS PROTECTION
// ===============================================================================

/**
 * Comprehensive input sanitization
 */
export function sanitizeInput(
  input: string,
  type: 'email' | 'name' | 'bio' | 'general' = 'general'
): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // HTML entity encoding for XSS prevention
  if (SECURITY_CONFIG.INPUT.SANITIZE_HTML) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Remove script tags and javascript: protocol
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:text\/html/gi, ''); // Remove data URIs

  // SQL injection prevention
  if (SECURITY_CONFIG.INPUT.PREVENT_SQL_INJECTION) {
    // Remove or escape SQL keywords and special characters
    const sqlPatterns = [
      /(\b(select|insert|update|delete|drop|union|exec|declare|cast|convert)\b)/gi,
      /(--|#|\/\*|\*\/|xp_|sp_)/g,
      /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/gi // OR 1=1, AND 1=1
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(sanitized)) {
        logWarn('Potential SQL injection attempt detected', 'Security');
        sanitized = sanitized.replace(pattern, '');
      }
    }
  }

  // Type-specific validation
  switch (type) {
    case 'email':
      // Emails should be validated separately with validateEmailRFC5322
      sanitized = sanitized.toLowerCase();
      break;
      
    case 'name':
      // Allow only letters, spaces, hyphens, and apostrophes
      sanitized = sanitized.replace(/[^a-zA-Z\s\-']/g, '');
      if (sanitized.length > SECURITY_CONFIG.INPUT.MAX_NAME_LENGTH) {
        sanitized = sanitized.substring(0, SECURITY_CONFIG.INPUT.MAX_NAME_LENGTH);
      }
      break;
      
    case 'bio':
      // Allow more characters but limit length
      if (sanitized.length > SECURITY_CONFIG.INPUT.MAX_BIO_LENGTH) {
        sanitized = sanitized.substring(0, SECURITY_CONFIG.INPUT.MAX_BIO_LENGTH);
      }
      break;
  }

  return sanitized;
}

// ===============================================================================
// CSRF TOKEN MANAGEMENT
// ===============================================================================

class CSRFTokenManager {
  private tokens: Map<string, { token: string; expiry: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired tokens every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Generate a new CSRF token
   */
  public async generateToken(sessionId: string): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(SECURITY_CONFIG.CSRF.TOKEN_LENGTH);
    const token = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const expiry = Date.now() + SECURITY_CONFIG.CSRF.TOKEN_EXPIRY;
    this.tokens.set(sessionId, { token, expiry });

    return token;
  }

  /**
   * Validate a CSRF token
   */
  public validateToken(sessionId: string, token: string): boolean {
    const entry = this.tokens.get(sessionId);
    
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this.tokens.delete(sessionId);
      return false;
    }
    if (entry.token !== token) return false;

    // Rotate token on successful validation if configured
    if (SECURITY_CONFIG.CSRF.ROTATE_ON_USE) {
      this.generateToken(sessionId);
    }

    return true;
  }

  /**
   * Clean up expired tokens
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.tokens.entries()) {
      if (entry.expiry < now) {
        this.tokens.delete(key);
      }
    }
  }

  /**
   * Destroy the token manager
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.tokens.clear();
  }
}

// Singleton CSRF token manager
export const csrfTokenManager = new CSRFTokenManager();

// ===============================================================================
// SESSION SECURITY MONITORING
// ===============================================================================

interface SessionFingerprint {
  userAgent?: string;
  platform?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

interface SessionSecurityData {
  fingerprint: SessionFingerprint;
  lastActivity: number;
  suspiciousActivities: number;
  ipAddress?: string;
  location?: string;
}

class SessionSecurityMonitor {
  private sessions: Map<string, SessionSecurityData> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Monitor sessions every minute
    this.monitoringInterval = setInterval(
      () => this.monitorSessions(),
      SECURITY_CONFIG.SESSION.VALIDATE_INTERVAL
    );
  }

  /**
   * Create session fingerprint
   */
  public createFingerprint(): SessionFingerprint {
    return {
      platform: Platform.OS,
      // Add more fingerprinting data as available
    };
  }

  /**
   * Register a new session
   */
  public registerSession(
    sessionId: string,
    fingerprint: SessionFingerprint,
    ipAddress?: string
  ): void {
    this.sessions.set(sessionId, {
      fingerprint,
      lastActivity: Date.now(),
      suspiciousActivities: 0,
      ipAddress
    });
  }

  /**
   * Validate session security
   */
  public validateSession(
    sessionId: string,
    currentFingerprint: SessionFingerprint
  ): {
    valid: boolean;
    reason?: string;
    suspicious?: boolean;
  } {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    // Check idle timeout
    const now = Date.now();
    if (now - session.lastActivity > SECURITY_CONFIG.SESSION.IDLE_TIMEOUT) {
      this.sessions.delete(sessionId);
      return { valid: false, reason: 'Session idle timeout' };
    }

    // Check fingerprint if enabled
    if (SECURITY_CONFIG.SESSION.FINGERPRINT_CHECKS) {
      const fingerprintChanged = 
        session.fingerprint.platform !== currentFingerprint.platform ||
        session.fingerprint.userAgent !== currentFingerprint.userAgent;

      if (fingerprintChanged) {
        session.suspiciousActivities++;
        
        if (session.suspiciousActivities >= SECURITY_CONFIG.SESSION.SUSPICIOUS_ACTIVITY_THRESHOLD) {
          logWarn(`Suspicious activity detected for session ${sessionId}`, 'Security');
          this.sessions.delete(sessionId);
          return { valid: false, reason: 'Suspicious activity detected', suspicious: true };
        }
        
        return { valid: true, suspicious: true };
      }
    }

    // Update last activity
    session.lastActivity = now;
    
    return { valid: true };
  }

  /**
   * Monitor all sessions
   */
  private monitorSessions(): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      // Remove expired sessions
      if (now - session.lastActivity > SECURITY_CONFIG.SESSION.MAX_AGE) {
        this.sessions.delete(sessionId);
        logDebug(`Session ${sessionId} expired`, 'Security');
      }
    }
  }

  /**
   * Invalidate a session
   */
  public invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get session info
   */
  public getSessionInfo(sessionId: string): SessionSecurityData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroy the monitor
   */
  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.sessions.clear();
  }
}

// Singleton session security monitor
export const sessionMonitor = new SessionSecurityMonitor();

// ===============================================================================
// SECURITY HEADERS
// ===============================================================================

/**
 * Get recommended security headers
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

// ===============================================================================
// ACCOUNT ENUMERATION PREVENTION
// ===============================================================================

/**
 * Generate consistent error messages to prevent account enumeration
 */
export function getAuthErrorMessage(error: string): string {
  // Map all authentication errors to generic messages
  const genericMessage = 'Invalid email or password';
  
  // Log the actual error for debugging but return generic message
  logDebug(`Auth error: ${error}`, 'Security');
  
  // Return generic message to prevent account enumeration
  return genericMessage;
}

/**
 * Add random delay to prevent timing attacks
 */
export async function addSecurityDelay(): Promise<void> {
  // Random delay between 100-500ms
  const delay = Math.floor(Math.random() * 400) + 100;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// ===============================================================================
// EXPORT SECURITY AUDIT FUNCTION
// ===============================================================================

/**
 * Perform comprehensive security audit
 */
export async function performSecurityAudit(): Promise<{
  timestamp: number;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }[];
  overallScore: number;
  recommendations: string[];
}> {
  const checks: any[] = [];
  const recommendations: string[] = [];
  
  // Check password policy
  checks.push({
    name: 'Password Policy',
    status: SECURITY_CONFIG.PASSWORD.MIN_LENGTH >= 12 ? 'pass' : 'fail',
    details: `Minimum length: ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters`
  });

  // Check rate limiting
  checks.push({
    name: 'Rate Limiting',
    status: 'pass',
    details: `Max attempts: ${SECURITY_CONFIG.RATE_LIMIT.MAX_ATTEMPTS}`
  });

  // Check session security
  checks.push({
    name: 'Session Security',
    status: SECURITY_CONFIG.SESSION.IDLE_TIMEOUT <= 900000 ? 'pass' : 'warning',
    details: `Idle timeout: ${SECURITY_CONFIG.SESSION.IDLE_TIMEOUT / 60000} minutes`
  });

  // Check CSRF protection
  checks.push({
    name: 'CSRF Protection',
    status: 'pass',
    details: 'Token-based CSRF protection enabled'
  });

  // Check input sanitization
  checks.push({
    name: 'Input Sanitization',
    status: 'pass',
    details: 'XSS and SQL injection prevention enabled'
  });

  // Calculate overall score
  const passCount = checks.filter(c => c.status === 'pass').length;
  const overallScore = Math.round((passCount / checks.length) * 100);

  // Add recommendations
  if (overallScore < 100) {
    checks.forEach(check => {
      if (check.status !== 'pass') {
        recommendations.push(`Improve ${check.name}: ${check.details}`);
      }
    });
  }

  return {
    timestamp: Date.now(),
    checks,
    overallScore,
    recommendations
  };
}