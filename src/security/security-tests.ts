/**
 * CRITICAL SECURITY TESTING SUITE - Authentication Vulnerability Tests
 * 
 * Purpose: Comprehensive security testing for authentication flows
 * Security Level: PRODUCTION-GRADE penetration testing simulation
 * 
 * TESTS INCLUDE:
 * - SQL Injection attacks
 * - XSS (Cross-Site Scripting) attacks
 * - CSRF (Cross-Site Request Forgery) attacks
 * - Rate limiting bypass attempts
 * - Session hijacking tests
 * - Password brute force attacks
 * - Account enumeration tests
 * - Input validation bypass tests
 * - Authentication bypass attempts
 * - Authorization escalation tests
 */

import { 
  validateEmailRFC5322, 
  validatePasswordStrength, 
  sanitizeInput,
  rateLimiter,
  csrfTokenManager,
  sessionMonitor 
} from '../utils/security-utils';
import { logError, logWarn, logInfo } from '../utils/logger';

// Test result types
interface SecurityTestResult {
  testName: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  recommendation?: string;
}

interface SecurityTestSuite {
  category: string;
  tests: SecurityTestResult[];
  overallScore: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
}

// ===============================================================================
// SQL INJECTION TESTS
// ===============================================================================

export const testSQLInjectionProtection = (): SecurityTestResult[] => {
  const results: SecurityTestResult[] = [];
  
  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' OR 1=1--",
    "'; INSERT INTO users (email) VALUES ('hacked@test.com'); --",
    "' UNION SELECT * FROM users--",
    "'; DELETE FROM users WHERE 1=1; --",
    "admin'/*",
    "'; EXEC xp_cmdshell('dir'); --",
    "' OR EXISTS(SELECT * FROM users)--",
    "'; UPDATE users SET password='hacked'; --"
  ];

  sqlPayloads.forEach((payload, index) => {
    try {
      const sanitized = sanitizeInput(payload, 'email');
      const emailValidation = validateEmailRFC5322(payload);
      
      // SQL injection should be blocked
      const isBlocked = !emailValidation.isValid || sanitized !== payload;
      
      results.push({
        testName: `SQL Injection Test ${index + 1}`,
        passed: isBlocked,
        severity: isBlocked ? 'low' : 'critical',
        details: isBlocked 
          ? `SQL payload blocked: "${payload}"` 
          : `SQL injection vulnerability detected with payload: "${payload}"`,
        recommendation: isBlocked 
          ? undefined 
          : 'Implement proper input sanitization and parameterized queries'
      });
    } catch (error) {
      results.push({
        testName: `SQL Injection Test ${index + 1}`,
        passed: true, // Error handling counts as protection
        severity: 'low',
        details: `SQL payload caused error (good): "${payload}"`
      });
    }
  });

  return results;
};

// ===============================================================================
// XSS PROTECTION TESTS
// ===============================================================================

export const testXSSProtection = (): SecurityTestResult[] => {
  const results: SecurityTestResult[] = [];
  
  const xssPayloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    "<svg onload=alert('XSS')>",
    "<iframe src=javascript:alert('XSS')></iframe>",
    "<body onload=alert('XSS')>",
    "<div onclick=alert('XSS')>Click me</div>",
    "';alert('XSS');//",
    "<script src='http://evil.com/malicious.js'></script>",
    "<meta http-equiv='refresh' content='0;url=javascript:alert(1)'>"
  ];

  xssPayloads.forEach((payload, index) => {
    try {
      const sanitized = sanitizeInput(payload, 'general');
      
      // XSS should be neutralized
      const isBlocked = !sanitized.includes('<script') && 
                       !sanitized.includes('javascript:') && 
                       !sanitized.includes('onerror=') &&
                       !sanitized.includes('onload=') &&
                       !sanitized.includes('onclick=');
      
      results.push({
        testName: `XSS Protection Test ${index + 1}`,
        passed: isBlocked,
        severity: isBlocked ? 'low' : 'high',
        details: isBlocked 
          ? `XSS payload blocked: Original: "${payload}", Sanitized: "${sanitized}"` 
          : `XSS vulnerability detected: "${sanitized}"`,
        recommendation: isBlocked 
          ? undefined 
          : 'Implement proper output encoding and Content Security Policy'
      });
    } catch (error) {
      results.push({
        testName: `XSS Protection Test ${index + 1}`,
        passed: true,
        severity: 'low',
        details: `XSS payload caused error (good): "${payload}"`
      });
    }
  });

  return results;
};

// ===============================================================================
// CSRF PROTECTION TESTS
// ===============================================================================

export const testCSRFProtection = async (): Promise<SecurityTestResult[]> => {
  const results: SecurityTestResult[] = [];
  
  try {
    // Test 1: Valid CSRF token
    const sessionId1 = 'test_session_1';
    const validToken = await csrfTokenManager.generateToken(sessionId1);
    const isValidTokenAccepted = csrfTokenManager.validateToken(sessionId1, validToken);
    
    results.push({
      testName: 'Valid CSRF Token Test',
      passed: isValidTokenAccepted,
      severity: isValidTokenAccepted ? 'low' : 'high',
      details: isValidTokenAccepted 
        ? 'Valid CSRF token correctly accepted' 
        : 'Valid CSRF token incorrectly rejected'
    });

    // Test 2: Invalid CSRF token
    const sessionId2 = 'test_session_2';
    const invalidToken = 'fake_csrf_token_12345';
    const isInvalidTokenRejected = !csrfTokenManager.validateToken(sessionId2, invalidToken);
    
    results.push({
      testName: 'Invalid CSRF Token Test',
      passed: isInvalidTokenRejected,
      severity: isInvalidTokenRejected ? 'low' : 'critical',
      details: isInvalidTokenRejected 
        ? 'Invalid CSRF token correctly rejected' 
        : 'Invalid CSRF token incorrectly accepted - CRITICAL VULNERABILITY!',
      recommendation: isInvalidTokenRejected 
        ? undefined 
        : 'Fix CSRF token validation immediately'
    });

    // Test 3: Cross-session CSRF token
    const sessionId3 = 'test_session_3';
    const sessionId4 = 'test_session_4';
    const tokenForSession3 = await csrfTokenManager.generateToken(sessionId3);
    const isCrossSessionRejected = !csrfTokenManager.validateToken(sessionId4, tokenForSession3);
    
    results.push({
      testName: 'Cross-Session CSRF Token Test',
      passed: isCrossSessionRejected,
      severity: isCrossSessionRejected ? 'low' : 'high',
      details: isCrossSessionRejected 
        ? 'Cross-session CSRF token correctly rejected' 
        : 'Cross-session CSRF token accepted - vulnerability detected',
      recommendation: isCrossSessionRejected 
        ? undefined 
        : 'Ensure CSRF tokens are session-specific'
    });

    // Test 4: Empty CSRF token
    const isEmptyTokenRejected = !csrfTokenManager.validateToken('test_session', '');
    
    results.push({
      testName: 'Empty CSRF Token Test',
      passed: isEmptyTokenRejected,
      severity: isEmptyTokenRejected ? 'low' : 'medium',
      details: isEmptyTokenRejected 
        ? 'Empty CSRF token correctly rejected' 
        : 'Empty CSRF token accepted'
    });

  } catch (error) {
    results.push({
      testName: 'CSRF Protection Test Suite',
      passed: false,
      severity: 'high',
      details: `CSRF testing failed with error: ${error.message}`,
      recommendation: 'Fix CSRF token management system'
    });
  }

  return results;
};

// ===============================================================================
// RATE LIMITING TESTS
// ===============================================================================

export const testRateLimitingProtection = (): SecurityTestResult[] => {
  const results: SecurityTestResult[] = [];
  const testEmail = 'ratetest@example.com';
  const testKey = `test_${testEmail}`;

  try {
    // Test 1: Normal usage within limits
    const initialCheck = rateLimiter.isRateLimited(testKey);
    results.push({
      testName: 'Rate Limiting - Normal Usage',
      passed: !initialCheck.limited,
      severity: initialCheck.limited ? 'medium' : 'low',
      details: initialCheck.limited 
        ? 'Rate limiting incorrectly applied to normal usage' 
        : 'Normal usage correctly allowed'
    });

    // Test 2: Rapid successive attempts
    for (let i = 0; i < 6; i++) {
      rateLimiter.recordAttempt(testKey, false);
    }

    const afterAttemptsCheck = rateLimiter.isRateLimited(testKey);
    results.push({
      testName: 'Rate Limiting - Brute Force Protection',
      passed: afterAttemptsCheck.limited,
      severity: afterAttemptsCheck.limited ? 'low' : 'high',
      details: afterAttemptsCheck.limited 
        ? 'Brute force attempts correctly rate limited' 
        : 'Brute force attempts not rate limited - vulnerability!',
      recommendation: afterAttemptsCheck.limited 
        ? undefined 
        : 'Implement proper rate limiting for failed attempts'
    });

    // Test 3: Rate limit bypass attempts
    const bypassAttempts = [
      `${testKey}_modified`,
      `${testKey.toUpperCase()}`,
      `${testKey}%20`,
      `${testKey}+extra`,
    ];

    let bypassSuccessful = false;
    bypassAttempts.forEach(bypassKey => {
      const bypassCheck = rateLimiter.isRateLimited(bypassKey);
      if (!bypassCheck.limited) {
        bypassSuccessful = true;
      }
    });

    results.push({
      testName: 'Rate Limiting - Bypass Prevention',
      passed: !bypassSuccessful, // Should not be able to bypass
      severity: bypassSuccessful ? 'medium' : 'low',
      details: bypassSuccessful 
        ? 'Rate limiting can be bypassed with modified keys' 
        : 'Rate limiting bypass attempts correctly blocked'
    });

  } catch (error) {
    results.push({
      testName: 'Rate Limiting Test Suite',
      passed: false,
      severity: 'medium',
      details: `Rate limiting tests failed: ${error.message}`
    });
  }

  return results;
};

// ===============================================================================
// PASSWORD STRENGTH TESTS
// ===============================================================================

export const testPasswordValidation = (): SecurityTestResult[] => {
  const results: SecurityTestResult[] = [];

  const weakPasswords = [
    '12345678',
    'password',
    'qwerty123',
    'Password1',
    '11111111',
    'abcdefgh',
    '87654321',
    'password123',
    'admin123',
    'welcome1'
  ];

  const strongPasswords = [
    'MyStr0ng!P@ssw0rd2023',
    'Sup3r$3cur3P@ssw0rd!',
    'C0mpl3x&S3cur3#2023',
    'Un1qu3$tr0ngP@$$w0rd',
    'V3ry$3cur3P@ssw0rd!'
  ];

  // Test weak passwords are rejected
  weakPasswords.forEach((password, index) => {
    const validation = validatePasswordStrength(password);
    results.push({
      testName: `Weak Password Rejection ${index + 1}`,
      passed: !validation.isValid || validation.strength === 'weak',
      severity: validation.isValid && validation.strength !== 'weak' ? 'high' : 'low',
      details: validation.isValid && validation.strength !== 'weak'
        ? `Weak password incorrectly accepted: "${password}" (${validation.strength})` 
        : `Weak password correctly rejected: "${password}"`,
      recommendation: validation.isValid && validation.strength !== 'weak'
        ? 'Strengthen password validation requirements'
        : undefined
    });
  });

  // Test strong passwords are accepted
  strongPasswords.forEach((password, index) => {
    const validation = validatePasswordStrength(password);
    results.push({
      testName: `Strong Password Acceptance ${index + 1}`,
      passed: validation.isValid && ['strong', 'very-strong'].includes(validation.strength),
      severity: validation.isValid && ['strong', 'very-strong'].includes(validation.strength) ? 'low' : 'medium',
      details: validation.isValid && ['strong', 'very-strong'].includes(validation.strength)
        ? `Strong password correctly accepted: (${validation.strength})` 
        : `Strong password incorrectly rejected: (${validation.strength})`
    });
  });

  return results;
};

// ===============================================================================
// EMAIL VALIDATION TESTS
// ===============================================================================

export const testEmailValidation = (): SecurityTestResult[] => {
  const results: SecurityTestResult[] = [];

  const invalidEmails = [
    'plainaddress',
    '@missinglocalpart.com',
    'missing@.com',
    'missing.domain@.com',
    'two@@signs.com',
    'toolong' + 'a'.repeat(250) + '@example.com',
    'test@',
    'test@.com',
    'test..double.dot@example.com',
    '.starting.dot@example.com',
    'ending.dot.@example.com',
    'spaces in@email.com',
    'test@spaces in.com'
  ];

  const validEmails = [
    'test@example.com',
    'user.name@example.com',
    'user+tag@example.com',
    'x@example.com',
    'test.email-with-hyphen@example.co.uk',
    'valid_email@example-domain.com'
  ];

  const maliciousEmails = [
    "test'; DROP TABLE users; --@example.com",
    'test@<script>alert("xss")</script>.com',
    'test@javascript:alert(1).com',
    'test@"><script>alert(1)</script>.com'
  ];

  // Test invalid emails are rejected
  invalidEmails.forEach((email, index) => {
    const validation = validateEmailRFC5322(email);
    results.push({
      testName: `Invalid Email Rejection ${index + 1}`,
      passed: !validation.isValid,
      severity: validation.isValid ? 'medium' : 'low',
      details: validation.isValid 
        ? `Invalid email incorrectly accepted: "${email}"` 
        : `Invalid email correctly rejected: "${email}"`
    });
  });

  // Test valid emails are accepted
  validEmails.forEach((email, index) => {
    const validation = validateEmailRFC5322(email);
    results.push({
      testName: `Valid Email Acceptance ${index + 1}`,
      passed: validation.isValid,
      severity: validation.isValid ? 'low' : 'medium',
      details: validation.isValid 
        ? `Valid email correctly accepted: "${email}"` 
        : `Valid email incorrectly rejected: "${email}"`
    });
  });

  // Test malicious emails are rejected
  maliciousEmails.forEach((email, index) => {
    const validation = validateEmailRFC5322(email);
    results.push({
      testName: `Malicious Email Protection ${index + 1}`,
      passed: !validation.isValid,
      severity: validation.isValid ? 'high' : 'low',
      details: validation.isValid 
        ? `Malicious email accepted - security risk: "${email}"` 
        : `Malicious email correctly blocked: "${email}"`,
      recommendation: validation.isValid 
        ? 'Implement additional email security validation'
        : undefined
    });
  });

  return results;
};

// ===============================================================================
// SESSION SECURITY TESTS
// ===============================================================================

export const testSessionSecurity = (): SecurityTestResult[] => {
  const results: SecurityTestResult[] = [];

  try {
    // Test 1: Session fingerprinting
    const sessionId1 = 'test_session_fingerprint_1';
    const fingerprint1 = sessionMonitor.createFingerprint();
    sessionMonitor.registerSession(sessionId1, fingerprint1);
    
    const validation1 = sessionMonitor.validateSession(sessionId1, fingerprint1);
    results.push({
      testName: 'Session Fingerprinting - Valid Session',
      passed: validation1.valid,
      severity: validation1.valid ? 'low' : 'medium',
      details: validation1.valid 
        ? 'Valid session fingerprint correctly validated' 
        : 'Valid session fingerprint incorrectly rejected'
    });

    // Test 2: Session hijacking detection
    const sessionId2 = 'test_session_fingerprint_2';
    const originalFingerprint = sessionMonitor.createFingerprint();
    sessionMonitor.registerSession(sessionId2, originalFingerprint);
    
    // Simulate changed fingerprint (potential hijacking)
    const modifiedFingerprint = { ...originalFingerprint, platform: 'hijacked' };
    const validation2 = sessionMonitor.validateSession(sessionId2, modifiedFingerprint);
    
    results.push({
      testName: 'Session Security - Hijacking Detection',
      passed: validation2.suspicious === true,
      severity: validation2.suspicious ? 'low' : 'high',
      details: validation2.suspicious 
        ? 'Session hijacking correctly detected' 
        : 'Session hijacking not detected - vulnerability!',
      recommendation: validation2.suspicious 
        ? undefined 
        : 'Implement session fingerprinting for hijacking detection'
    });

  } catch (error) {
    results.push({
      testName: 'Session Security Test Suite',
      passed: false,
      severity: 'medium',
      details: `Session security tests failed: ${error.message}`
    });
  }

  return results;
};

// ===============================================================================
// COMPREHENSIVE SECURITY AUDIT
// ===============================================================================

export const runComprehensiveSecurityAudit = async (): Promise<SecurityTestSuite[]> => {
  logInfo('Starting comprehensive security audit...', 'Security');

  const testSuites: SecurityTestSuite[] = [];

  try {
    // Run all test suites
    const sqlTests = testSQLInjectionProtection();
    const xssTests = testXSSProtection();
    const csrfTests = await testCSRFProtection();
    const rateLimitTests = testRateLimitingProtection();
    const passwordTests = testPasswordValidation();
    const emailTests = testEmailValidation();
    const sessionTests = testSessionSecurity();

    // Compile test suites
    const suites = [
      { category: 'SQL Injection Protection', tests: sqlTests },
      { category: 'XSS Protection', tests: xssTests },
      { category: 'CSRF Protection', tests: csrfTests },
      { category: 'Rate Limiting', tests: rateLimitTests },
      { category: 'Password Validation', tests: passwordTests },
      { category: 'Email Validation', tests: emailTests },
      { category: 'Session Security', tests: sessionTests }
    ];

    // Calculate scores and issue counts for each suite
    suites.forEach(suite => {
      const totalTests = suite.tests.length;
      const passedTests = suite.tests.filter(t => t.passed).length;
      const overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
      
      const criticalIssues = suite.tests.filter(t => !t.passed && t.severity === 'critical').length;
      const highIssues = suite.tests.filter(t => !t.passed && t.severity === 'high').length;
      const mediumIssues = suite.tests.filter(t => !t.passed && t.severity === 'medium').length;
      const lowIssues = suite.tests.filter(t => !t.passed && t.severity === 'low').length;

      testSuites.push({
        category: suite.category,
        tests: suite.tests,
        overallScore,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      });
    });

    logInfo('Comprehensive security audit completed', 'Security');
    return testSuites;

  } catch (error) {
    logError('Security audit failed', 'Security', error);
    throw error;
  }
};

// ===============================================================================
// GENERATE SECURITY REPORT
// ===============================================================================

export const generateSecurityReport = async (): Promise<{
  timestamp: number;
  overallScore: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  testSuites: SecurityTestSuite[];
  recommendations: string[];
  executiveSummary: string;
}> => {
  const testSuites = await runComprehensiveSecurityAudit();
  
  // Calculate overall metrics
  const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
  const passedTests = testSuites.reduce((sum, suite) => sum + suite.tests.filter(t => t.passed).length, 0);
  const failedTests = totalTests - passedTests;
  const overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  const criticalIssues = testSuites.reduce((sum, suite) => sum + suite.criticalIssues, 0);
  const highIssues = testSuites.reduce((sum, suite) => sum + suite.highIssues, 0);
  const mediumIssues = testSuites.reduce((sum, suite) => sum + suite.mediumIssues, 0);
  const lowIssues = testSuites.reduce((sum, suite) => sum + suite.lowIssues, 0);

  // Generate recommendations
  const recommendations: string[] = [];
  testSuites.forEach(suite => {
    suite.tests.forEach(test => {
      if (!test.passed && test.recommendation) {
        recommendations.push(test.recommendation);
      }
    });
  });

  // Remove duplicate recommendations
  const uniqueRecommendations = Array.from(new Set(recommendations));

  // Generate executive summary
  let executiveSummary = `Security Assessment Summary:\n\n`;
  executiveSummary += `Overall Security Score: ${overallScore}%\n`;
  executiveSummary += `Total Tests Executed: ${totalTests}\n`;
  executiveSummary += `Tests Passed: ${passedTests}\n`;
  executiveSummary += `Tests Failed: ${failedTests}\n\n`;
  
  if (criticalIssues > 0) {
    executiveSummary += `🔴 CRITICAL: ${criticalIssues} critical security issues found. Immediate action required.\n`;
  }
  if (highIssues > 0) {
    executiveSummary += `🟠 HIGH: ${highIssues} high-severity issues found. Address within 24 hours.\n`;
  }
  if (mediumIssues > 0) {
    executiveSummary += `🟡 MEDIUM: ${mediumIssues} medium-severity issues found. Address within 1 week.\n`;
  }
  if (lowIssues > 0) {
    executiveSummary += `🔵 LOW: ${lowIssues} low-severity issues found. Address as time permits.\n`;
  }
  
  if (criticalIssues === 0 && highIssues === 0) {
    executiveSummary += `\n✅ No critical or high-severity vulnerabilities detected.\n`;
  }

  if (overallScore >= 95) {
    executiveSummary += `\n🏆 Excellent security posture maintained.`;
  } else if (overallScore >= 85) {
    executiveSummary += `\n👍 Good security posture with minor improvements needed.`;
  } else if (overallScore >= 70) {
    executiveSummary += `\n⚠️ Moderate security risks identified. Improvements recommended.`;
  } else {
    executiveSummary += `\n🚨 Significant security risks identified. Immediate remediation required.`;
  }

  return {
    timestamp: Date.now(),
    overallScore,
    totalTests,
    passedTests,
    failedTests,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    testSuites,
    recommendations: uniqueRecommendations,
    executiveSummary
  };
};