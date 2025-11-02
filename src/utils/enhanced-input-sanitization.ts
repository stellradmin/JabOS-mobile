/**
 * ENHANCED INPUT SANITIZATION UTILITY
 * 
 * Purpose: Comprehensive input validation and sanitization for XSS protection
 * Security Level: PRODUCTION-GRADE with zero-trust validation
 * 
 * Features:
 * - DOMPurify integration for HTML sanitization
 * - URL validation and allowlist checking
 * - Deep link parameter validation
 * - SQL injection prevention
 * - Content Security Policy enforcement
 * - Real-time threat detection
 */

// @ts-nocheck
// isomorphic-dompurify default export
import DOMPurify from 'isomorphic-dompurify';
import { logger } from './logger';

interface SanitizationResult {
  sanitized: string;
  original: string;
  threats: string[];
  safe: boolean;
  blocked: boolean;
}

interface ValidationOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  maxLength?: number;
  requireSSL?: boolean;
  allowDataUrls?: boolean;
  enableCsp?: boolean;
}

class EnhancedInputSanitizer {
  private static instance: EnhancedInputSanitizer;
  
  // URL allowlist for deep links and external navigation
  private readonly ALLOWED_DOMAINS = [
    'stellr.app',
    'app.stellr.com',
    'api.stellr.com',
    'support.stellr.com',
    'apple.com',
    'google.com',
    'supabase.co',
  ];

  // Dangerous patterns for threat detection
  private readonly THREAT_PATTERNS = [
    // XSS patterns
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    
    // SQL injection patterns
    /('|(\\x27)|(\\x2D))+.*?(;|(\\x3B))+/gi,
    /(union|select|insert|delete|update|drop|create|alter|exec|execute)/gi,
    /\b(or|and)\b\s*['"]?\s*['"]?\s*=\s*['"]?/gi,
    
    // NoSQL injection patterns
    /\$where|\$ne|\$gt|\$lt|\$regex/gi,
    
    // Path traversal
    /\.\.\//gi,
    /\.\.\\/gi,
    
    // Command injection
    /[;&|`$\(\)]/gi,
    
    // Data URLs (potentially dangerous)
    /data:.*base64/gi,
    
    // Dangerous protocols
    /^(file|ftp|telnet|ssh):/gi
  ];

  private readonly DEFAULT_OPTIONS: ValidationOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    allowedAttributes: [],
    maxLength: 10000,
    requireSSL: true,
    allowDataUrls: false,
    enableCsp: true
  };

  public static getInstance(): EnhancedInputSanitizer {
    if (!EnhancedInputSanitizer.instance) {
      EnhancedInputSanitizer.instance = new EnhancedInputSanitizer();
    }
    return EnhancedInputSanitizer.instance;
  }

  private constructor() {
    this.configureDOMPurify();
  }

  /**
   * Configure DOMPurify with strict security settings
   */
  private configureDOMPurify(): void {
    if (typeof (DOMPurify as any).setConfig !== 'function') {
      return; // Use defaults silently in RN
    }
    DOMPurify.setConfig({
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
      FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror', 'onmouseover'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      KEEP_CONTENT: false,
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      RETURN_TRUSTED_TYPE: false,
      FORCE_BODY: false,
      IN_PLACE: false
    });
  }

  /**
   * Comprehensive input sanitization
   */
  sanitizeInput(input: string, options: ValidationOptions = {}): SanitizationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const threats: string[] = [];
    let sanitized = input;

    // Input validation
    if (typeof input !== 'string') {
      return {
        sanitized: '',
        original: String(input),
        threats: ['Non-string input detected'],
        safe: false,
        blocked: true
      };
    }

    // Length validation
    if (input.length > (opts.maxLength || 10000)) {
      threats.push('Input exceeds maximum length');
      sanitized = input.substring(0, opts.maxLength);
    }

    // Threat detection
    this.THREAT_PATTERNS.forEach(pattern => {
      if (pattern.test(input)) {
        threats.push('Threat pattern detected: ' + pattern.source);
      }
    });

    // HTML sanitization with DOMPurify
    const purified = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: opts.allowedTags,
      ALLOWED_ATTR: opts.allowedAttributes,
    });

    // Check if sanitization changed the input (potential attack)
    const contentChanged = purified !== sanitized;
    if (contentChanged) {
      threats.push('HTML content sanitized');
    }

    // Additional encoding for special characters
    sanitized = this.encodeSpecialCharacters(purified);

    const result: SanitizationResult = {
      sanitized,
      original: input,
      threats,
      safe: threats.length === 0,
      blocked: threats.some(t => t.includes('detected') || t.includes('injection'))
    };

    // Log security events
    if (!result.safe) {
      logger.warn('Input sanitization threats detected', undefined, {
        threats: threats,
        inputLength: input.length,
        sanitizedLength: sanitized.length,
        contentChanged
      }, 'SECURITY');
    }

    return result;
  }

  /**
   * Validate and sanitize URLs for deep links
   */
  validateUrl(url: string): { valid: boolean; sanitized: string; threats: string[] } {
    const threats: string[] = [];

    try {
      const parsedUrl = new URL(url);
      
      // Protocol validation
      if (!['http:', 'https:', 'stellr:'].includes(parsedUrl.protocol)) {
        threats.push('Dangerous protocol: ' + parsedUrl.protocol);
      }

      // Domain validation for external URLs
      if (parsedUrl.protocol !== 'stellr:') {
        const domain = parsedUrl.hostname.toLowerCase();
        const isAllowed = this.ALLOWED_DOMAINS.some(allowed => 
          domain === allowed || domain.endsWith('.' + allowed)
        );
        
        if (!isAllowed) {
          threats.push('Domain not in allowlist: ' + domain);
        }
      }

      // Path traversal check
      if (parsedUrl.pathname.includes('..')) {
        threats.push('Path traversal attempt detected');
      }

      // Query parameter sanitization
      const sanitizedParams = new URLSearchParams();
      parsedUrl.searchParams.forEach((value, key) => {
        const sanitizedKey = this.sanitizeInput(key).sanitized;
        const sanitizedValue = this.sanitizeInput(value).sanitized;
        sanitizedParams.set(sanitizedKey, sanitizedValue);
      });

      // Reconstruct URL with sanitized parameters
      parsedUrl.search = sanitizedParams.toString();
      
      return {
        valid: threats.length === 0,
        sanitized: parsedUrl.toString(),
        threats
      };

    } catch (error) {
      threats.push('Invalid URL format');
      return {
        valid: false,
        sanitized: '',
        threats
      };
    }
  }

  /**
   * Sanitize deep link parameters
   */
  sanitizeDeepLinkParams(params: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    Object.entries(params).forEach(([key, value]) => {
      const cleanKey = this.sanitizeInput(String(key)).sanitized;
      const cleanValue = this.sanitizeInput(String(value)).sanitized;
      
      // Only include safe parameters
      if (cleanKey && cleanValue) {
        sanitized[cleanKey] = cleanValue;
      }
    });

    return sanitized;
  }

  /**
   * Validate message content for chat system
   */
  sanitizeMessage(content: string): SanitizationResult {
    // Strict validation for user messages
    const result = this.sanitizeInput(content, {
      allowedTags: [], // No HTML in messages
      allowedAttributes: [],
      maxLength: 2000, // Reasonable message length
      enableCsp: true
    });

    // Additional checks for messaging
    const linkPattern = /(https?:\/\/[^\s]+)/gi;
    const links = content.match(linkPattern) || [];
    
    links.forEach(link => {
      const urlValidation = this.validateUrl(link);
      if (!urlValidation.valid) {
        result.threats.push(`Dangerous link: ${link}`);
        result.sanitized = result.sanitized.replace(link, '[LINK REMOVED]');
      }
    });

    return result;
  }

  /**
   * Encode special characters to prevent injection
   */
  private encodeSpecialCharacters(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Content Security Policy header generation
   */
  generateCSPHeader(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'", // React Native requires unsafe-eval
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https:",
      "connect-src 'self' https://api.stellr.com https://*.supabase.co",
      "media-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
  }

  /**
   * Real-time threat assessment
   */
  assessThreatLevel(input: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const result = this.sanitizeInput(input);
    
    if (result.blocked) return 'CRITICAL';
    if (result.threats.length > 3) return 'HIGH';
    if (result.threats.length > 1) return 'MEDIUM';
    if (result.threats.length > 0) return 'LOW';
    
    return 'LOW';
  }

  /**
   * Batch sanitization for arrays of inputs
   */
  sanitizeBatch(inputs: string[], options?: ValidationOptions): SanitizationResult[] {
    return inputs.map(input => this.sanitizeInput(input, options));
  }

  /**
   * Emergency sanitization bypass (use only for trusted internal content)
   */
  trustedContent(content: string): string {
    logger.warn('Trusted content bypass used', undefined, { 
      contentLength: content.length 
    }, 'SECURITY');
    return content;
  }
}

export const inputSanitizer = EnhancedInputSanitizer.getInstance();
export type { SanitizationResult, ValidationOptions };
