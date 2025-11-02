// =====================================================================
// CUSTOM STELLR SECURITY ESLINT RULES
// =====================================================================
// Implementation of custom security rules for investor audit compliance

const { ESLintUtils } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/stellr/security-rules/blob/main/docs/${name}.md`
);

// =====================================================================
// AUTHENTICATION & TOKEN SECURITY RULES
// =====================================================================

const noAsyncStorageSensitiveData = createRule({
  name: 'no-asyncstorage-sensitive-data',
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent storing sensitive data in AsyncStorage',
      recommended: 'error',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noAsyncStorageSensitive: 'Sensitive data must not be stored in AsyncStorage. Use SecureStore instead.',
      suggestSecureStore: 'Consider using expo-secure-store for sensitive data',
    },
  },
  defaultOptions: [],
  create(context) {
    const sensitiveKeywords = [
      'token', 'password', 'secret', 'key', 'auth', 'credential',
      'jwt', 'session', 'refresh', 'access', 'bearer', 'api_key',
      'private_key', 'biometric', 'pin', 'fingerprint', 'face_id'
    ];

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'AsyncStorage' &&
          (node.callee.property.name === 'setItem' || node.callee.property.name === 'multiSet')
        ) {
          const keyArg = node.arguments[0];
          if (keyArg && keyArg.type === 'Literal') {
            const key = keyArg.value.toLowerCase();
            if (sensitiveKeywords.some(keyword => key.includes(keyword))) {
              context.report({
                node,
                messageId: 'noAsyncStorageSensitive',
                suggest: [
                  {
                    messageId: 'suggestSecureStore',
                    fix(fixer) {
                      return fixer.replaceText(node.callee.object, 'SecureStore');
                    },
                  },
                ],
              });
            }
          }
        }
      },
    };
  },
});

// =====================================================================
// JWT AND HARDCODED SECRETS RULES
// =====================================================================

const noHardcodedJwt = createRule({
  name: 'no-hardcoded-jwt',
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent hardcoded JWT tokens in code',
      recommended: 'error',
    },
    schema: [],
    messages: {
      hardcodedJwt: 'JWT token appears to be hardcoded. Use environment variables instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    const jwtPattern = /^eyJ[A-Za-z0-9_\/\+\-]*\.[A-Za-z0-9_\/\+\-]*\.[A-Za-z0-9_\/\+\-]*$/;
    
    return {
      Literal(node) {
        if (typeof node.value === 'string' && jwtPattern.test(node.value)) {
          context.report({
            node,
            messageId: 'hardcodedJwt',
          });
        }
      },
      TemplateElement(node) {
        if (jwtPattern.test(node.value.raw)) {
          context.report({
            node,
            messageId: 'hardcodedJwt',
          });
        }
      },
    };
  },
});

// =====================================================================
// API AND NETWORK SECURITY RULES
// =====================================================================

const requireHttpsOnly = createRule({
  name: 'require-https-only',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require HTTPS for all network requests',
      recommended: 'error',
    },
    schema: [],
    messages: {
      httpUrl: 'HTTP URLs are not allowed. Use HTTPS instead for security.',
      suggestHttps: 'Replace http:// with https://',
    },
  },
  defaultOptions: [],
  create(context) {
    const httpPattern = /^http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i;
    
    return {
      Literal(node) {
        if (typeof node.value === 'string' && httpPattern.test(node.value)) {
          context.report({
            node,
            messageId: 'httpUrl',
            suggest: [
              {
                messageId: 'suggestHttps',
                fix(fixer) {
                  return fixer.replaceText(node, `"${node.value.replace(/^http:/, 'https:')}"`);
                },
              },
            ],
          });
        }
      },
    };
  },
});

// =====================================================================
// MOBILE SECURITY RULES
// =====================================================================

const secureWebViewConfig = createRule({
  name: 'secure-webview-config',
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure WebView components use secure configuration',
      recommended: 'error',
    },
    schema: [],
    messages: {
      insecureWebView: 'WebView must disable JavaScript and DOM storage for security',
      missingSecurityProps: 'WebView missing required security properties: {{props}}',
    },
  },
  defaultOptions: [],
  create(context) {
    const requiredSecurityProps = [
      'javaScriptEnabled',
      'domStorageEnabled',
      'mixedContentMode',
      'allowsBackForwardNavigationGestures'
    ];

    return {
      JSXOpeningElement(node) {
        if (node.name.name === 'WebView') {
          const props = node.attributes.map(attr => attr.name?.name).filter(Boolean);
          const missingProps = requiredSecurityProps.filter(prop => !props.includes(prop));
          
          if (missingProps.length > 0) {
            context.report({
              node,
              messageId: 'missingSecurityProps',
              data: {
                props: missingProps.join(', ')
              }
            });
          }

          // Check for insecure configurations
          const jsEnabledAttr = node.attributes.find(attr => attr.name?.name === 'javaScriptEnabled');
          if (jsEnabledAttr && jsEnabledAttr.value?.expression?.value === true) {
            context.report({
              node: jsEnabledAttr,
              messageId: 'insecureWebView',
            });
          }
        }
      },
    };
  },
});

// =====================================================================
// SUPABASE SECURITY RULES
// =====================================================================

const noServiceRoleClientSide = createRule({
  name: 'no-service-role-client-side',
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent service role keys from being used in client-side code',
      recommended: 'error',
    },
    schema: [],
    messages: {
      serviceRoleClientSide: 'Service role keys must never be used in client-side code',
    },
  },
  defaultOptions: [],
  create(context) {
    const serviceRolePatterns = [
      /service[_-]?role/i,
      /SUPABASE_SERVICE_ROLE/i,
      /\.service\./i
    ];

    return {
      MemberExpression(node) {
        if (node.property.name) {
          const propName = node.property.name;
          if (serviceRolePatterns.some(pattern => pattern.test(propName))) {
            context.report({
              node,
              messageId: 'serviceRoleClientSide',
            });
          }
        }
      },
      Literal(node) {
        if (typeof node.value === 'string') {
          if (serviceRolePatterns.some(pattern => pattern.test(node.value))) {
            context.report({
              node,
              messageId: 'serviceRoleClientSide',
            });
          }
        }
      },
    };
  },
});

// =====================================================================
// =====================================================================

  meta: {
    type: 'problem',
    docs: {
      recommended: 'error',
    },
    schema: [],
    messages: {
    },
  },
  defaultOptions: [],
  create(context) {

    return {
      Literal(node) {
          context.report({
            node,
          });
        }
      },
    };
  },
});

// =====================================================================
// DATING APP SPECIFIC SECURITY RULES
// =====================================================================

const preventCrossUserAccess = createRule({
  name: 'prevent-cross-user-access',
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent potential cross-user data access vulnerabilities',
      recommended: 'error',
    },
    schema: [],
    messages: {
      potentialCrossUserAccess: 'Potential cross-user data access. Ensure proper user ID validation.',
      missingUserValidation: 'Missing user ID validation in data access pattern',
    },
  },
  defaultOptions: [],
  create(context) {
    const dangerousPatterns = [
      /\.filter\(\s*\(\s*\w+\s*\)\s*=>\s*\w+\.user_?id\s*===?\s*\w+/,
      /WHERE\s+user_?id\s*=\s*[^$]/i,
      /user_?id\s*:\s*params\./i
    ];

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          if (dangerousPatterns.some(pattern => pattern.test(node.value))) {
            context.report({
              node,
              messageId: 'potentialCrossUserAccess',
            });
          }
        }
      },
    };
  },
});

// =====================================================================
// ERROR HANDLING SECURITY RULES
// =====================================================================

const secureErrorHandling = createRule({
  name: 'secure-error-handling',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure error handling does not leak sensitive information',
      recommended: 'error',
    },
    schema: [],
    messages: {
      sensitiveErrorInfo: 'Error message may contain sensitive information',
      improperErrorLogging: 'Avoid logging sensitive data in error messages',
    },
  },
  defaultOptions: [],
  create(context) {
    const sensitiveErrorPatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credential/i,
      /database.*error/i,
      /sql.*error/i
    ];

    return {
      ThrowStatement(node) {
        if (node.argument.type === 'NewExpression' && 
            node.argument.arguments.length > 0) {
          const message = node.argument.arguments[0];
          if (message.type === 'Literal' && typeof message.value === 'string') {
            if (sensitiveErrorPatterns.some(pattern => pattern.test(message.value))) {
              context.report({
                node: message,
                messageId: 'sensitiveErrorInfo',
              });
            }
          }
        }
      },
    };
  },
});

// =====================================================================
// EXPORT ALL RULES
// =====================================================================

module.exports = {
  rules: {
    'no-asyncstorage-sensitive-data': noAsyncStorageSensitiveData,
    'require-secure-store': noAsyncStorageSensitiveData, // Alias
    'no-hardcoded-jwt': noHardcodedJwt,
    'require-https-only': requireHttpsOnly,
    'no-http-urls': requireHttpsOnly, // Alias
    'secure-webview-config': secureWebViewConfig,
    'no-service-role-client-side': noServiceRoleClientSide,
    'prevent-cross-user-access': preventCrossUserAccess,
    'secure-error-handling': secureErrorHandling,
    'no-sensitive-error-disclosure': secureErrorHandling, // Alias
  },
};

// =====================================================================
// RULE METADATA FOR DOCUMENTATION
// =====================================================================

module.exports.meta = {
  name: 'eslint-plugin-stellr-security',
  version: '1.0.0',
  description: 'Custom ESLint security rules for Stellr dating app',
  author: 'Stellr Security Team',
  repository: 'https://github.com/stellr/security-rules',
  license: 'MIT',
};