// =====================================================================
// COMPREHENSIVE SECURITY-FOCUSED ESLINT CONFIGURATION
// =====================================================================
// Advanced security linting rules for investor audit compliance
// Zero tolerance for security vulnerabilities in code

module.exports = {
  extends: [
    '@expo/eslint-config',
    'plugin:security/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  plugins: [
    'security',
    'no-secrets',
    '@typescript-eslint',
    'react-hooks',
    'react-native-a11y'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    'react-native/react-native': true,
    es2022: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
    'react-native/style-sheet-object': true,
  },
  rules: {
    // =====================================================================
    // CRITICAL SECURITY RULES - ZERO TOLERANCE
    // =====================================================================
    
    // Secret Detection Rules
    'no-secrets/no-secrets': ['error', {
      'tolerance': 4.2, // Lower tolerance for better detection
      'additionalDelimiters': ['_', '-', '.'],
      'ignoreContent': [
        'your-.*-key',
        'your-.*-secret',
        'your-.*-token',
        'example-.*',
        'test-.*',
        'mock-.*',
        'dummy-.*',
        'placeholder-.*'
      ]
    }],
    
    // Hardcoded Secrets Prevention
    'security/detect-hardcoded-secrets': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    
    // =====================================================================
    // AUTHENTICATION & AUTHORIZATION SECURITY
    // =====================================================================
    
    // JWT and Token Security
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Custom rules for token handling
    'stellr-security/no-asyncstorage-sensitive-data': 'error',
    'stellr-security/require-secure-store': 'error',
    'stellr-security/no-hardcoded-jwt': 'error',
    
    // =====================================================================
    // INPUT VALIDATION & XSS PREVENTION
    // =====================================================================
    
    // Prevent dangerous HTML/JSX patterns
    'react/no-danger': 'error',
    'react/no-danger-with-children': 'error',
    'react/jsx-no-script-url': 'error',
    'react/jsx-no-target-blank': ['error', { 
      allowReferrer: false,
      enforceDynamicLinks: 'always',
      warnOnSpreadAttributes: true,
      links: true,
      forms: true
    }],
    
    // Input sanitization
    'stellr-security/sanitize-user-input': 'error',
    'stellr-security/validate-api-inputs': 'error',
    
    // =====================================================================
    // MOBILE SECURITY SPECIFIC RULES
    // =====================================================================
    
    // WebView security
    'stellr-security/secure-webview-config': 'error',
    'stellr-security/no-javascript-enabled-webview': 'warn',
    
    // Deep linking security
    'stellr-security/validate-deep-links': 'error',
    'stellr-security/sanitize-url-schemes': 'error',
    
    // File access security
    'stellr-security/secure-file-access': 'error',
    
    // =====================================================================
    // API AND NETWORK SECURITY
    // =====================================================================
    
    // HTTP security
    'stellr-security/require-https-only': 'error',
    'stellr-security/validate-api-endpoints': 'error',
    'stellr-security/no-http-urls': 'error',
    
    // Certificate pinning requirements
    'stellr-security/require-cert-pinning': 'error',
    
    // =====================================================================
    // DATA PROTECTION & PRIVACY
    // =====================================================================
    
    // PII handling
    'stellr-security/no-pii-in-logs': 'error',
    'stellr-security/encrypt-sensitive-data': 'error',
    'stellr-security/validate-data-retention': 'error',
    
    // GDPR compliance
    'stellr-security/require-consent-tracking': 'error',
    'stellr-security/implement-data-deletion': 'error',
    
    // =====================================================================
    // TYPESCRIPT SECURITY RULES
    // =====================================================================
    
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    
    // =====================================================================
    // REACT NATIVE SECURITY RULES
    // =====================================================================
    
    // Performance security (DoS prevention)
    'react-hooks/exhaustive-deps': 'error',
    'react-hooks/rules-of-hooks': 'error',
    
    // Accessibility security (UI redressing prevention)
    'react-native-a11y/has-accessibility-hint': 'warn',
    'react-native-a11y/has-valid-accessibility-descriptors': 'error',
    
    // =====================================================================
    // CUSTOM STELLR SECURITY RULES
    // =====================================================================
    
    // Supabase security
    'stellr-security/validate-rls-policies': 'error',
    'stellr-security/no-service-role-client-side': 'error',
    'stellr-security/secure-supabase-config': 'error',
    
    'stellr-security/validate-webhook-signatures': 'error',
    
    // Dating app specific security
    'stellr-security/validate-user-age': 'error',
    'stellr-security/secure-photo-uploads': 'error',
    'stellr-security/prevent-cross-user-access': 'error',
    'stellr-security/validate-matching-algorithms': 'error',
    
    // =====================================================================
    // GENERAL CODE QUALITY (Security Impact)
    // =====================================================================
    
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', 4],
    'max-nested-callbacks': ['error', 3],
    'max-params': ['error', 4],
    'no-console': 'warn', // Allow in development, remove in production
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-new-wrappers': 'error',
    'no-script-url': 'error',
    'no-sequences': 'error',
    'no-void': 'error',
    'radix': 'error',
    'wrap-iife': 'error',
    
    // =====================================================================
    // ERROR HANDLING SECURITY
    // =====================================================================
    
    'stellr-security/secure-error-handling': 'error',
    'stellr-security/no-sensitive-error-disclosure': 'error',
    'stellr-security/validate-error-boundaries': 'error',
  },
  
  // =====================================================================
  // CUSTOM SECURITY RULE DEFINITIONS
  // =====================================================================
  
  overrides: [
    {
      files: ['**/*.test.*', '**/__tests__/**/*'],
      rules: {
        // Relax some rules for test files
        'no-console': 'off',
        'stellr-security/no-asyncstorage-sensitive-data': 'warn',
      }
    },
    {
      files: ['**/edge-functions/**/*'],
      rules: {
        // Stricter rules for edge functions
        'stellr-security/validate-jwt-thoroughly': 'error',
        'stellr-security/rate-limit-enforcement': 'error',
        'stellr-security/sql-injection-prevention': 'error',
      }
    }
  ],
  
  // =====================================================================
  // SECURITY RULE ENVIRONMENTS
  // =====================================================================
  
  env: {
    'stellr-security/production': {
      rules: {
        'no-console': 'error',
        'no-debugger': 'error',
        'stellr-security/no-debug-code': 'error',
      }
    }
  }
};