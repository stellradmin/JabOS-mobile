import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import { COLORS } from "../constants/theme";
import {
  validateEmailRFC5322,
  validatePasswordStrength,
  sanitizeInput,
  rateLimiter,
  addSecurityDelay,
  getAuthErrorMessage,
  csrfTokenManager,
  sessionMonitor,
} from "../src/utils/security-utils";
import { signInWithApple } from "../src/services/apple-auth-service";
import { signInWithGoogle } from "../src/services/google-auth-service";

interface LoginFormProps {
  onSubmit?: (email: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onNavigateToSignup?: () => void;
  hideSignupHint?: boolean;
}

export default function LoginForm({
  onSubmit = async () => {},
  isLoading = false,
  error = null,
  onNavigateToSignup,
  hideSignupHint = false,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [attemptCount, setAttemptCount] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Initialize CSRF token and session monitoring
  useEffect(() => {
    const initSecurity = async () => {
      try {
        // Generate CSRF token
        const token = await csrfTokenManager.generateToken(sessionId);
        setCsrfToken(token);
        
        // Register session with security monitor
        const fingerprint = sessionMonitor.createFingerprint();
        sessionMonitor.registerSession(sessionId, fingerprint);
      } catch (error) {
        logError('Security initialization failed', 'Security', error);
      }
    };
    
    initSecurity();
    
    // Cleanup on unmount
    return () => {
      sessionMonitor.invalidateSession(sessionId);
    };
  }, [sessionId]);

  // Handle rate limiting countdown
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => {
        setRetryAfter(prev => Math.max(0, prev - 1000));
      }, 1000);
      
      if (retryAfter <= 0) {
        setIsRateLimited(false);
      }
      
      return () => clearTimeout(timer);
    }
  }, [retryAfter]);

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};

    // Sanitize email input
    const sanitizedEmail = sanitizeInput(email.trim(), 'email');
    
    if (!sanitizedEmail) {
      errors.email = "Email is required";
    } else {
      // RFC 5322 compliant email validation
      const emailValidation = validateEmailRFC5322(sanitizedEmail);
      if (!emailValidation.isValid) {
        errors.email = emailValidation.reason || "Invalid email format";
      }
    }

    if (!password) {
      errors.password = "Password is required";
    } else {
      // Enhanced password validation with strength checking
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid && passwordValidation.issues.length > 0) {
        // For login, we're more lenient - just check basic requirements
        // Full validation is for registration
        if (password.length < 8) {
          errors.password = "Password must be at least 8 characters";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    try {
      // Check rate limiting first
      const rateLimitCheck = rateLimiter.isRateLimited(`login_${email.toLowerCase()}`);

      if (rateLimitCheck.limited) {
        setIsRateLimited(true);
        setRetryAfter(rateLimitCheck.retryAfter || 0);

        const retrySeconds = Math.ceil((rateLimitCheck.retryAfter || 0) / 1000);
        Alert.alert(
          'Too Many Attempts',
          `Please wait ${retrySeconds} seconds before trying again.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (!validateForm()) {
        return;
      }

      // Validate CSRF token
      if (csrfToken && !csrfTokenManager.validateToken(sessionId, csrfToken)) {
        logWarn('CSRF token validation failed', 'Security');
        // Generate new token for next attempt
        const newToken = await csrfTokenManager.generateToken(sessionId);
        setCsrfToken(newToken);
      }

      // Validate session security
      const fingerprint = sessionMonitor.createFingerprint();
      const sessionValidation = sessionMonitor.validateSession(sessionId, fingerprint);

      if (!sessionValidation.valid) {
        logWarn(`Session validation failed: ${sessionValidation.reason}`, 'Security');
        if (sessionValidation.suspicious) {
          Alert.alert(
            'Security Alert',
            'Suspicious activity detected. Please try again.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Add security delay to prevent timing attacks
      await addSecurityDelay();

      // Sanitize inputs before submission
      const sanitizedEmail = sanitizeInput(email.trim(), 'email').toLowerCase();

      // Call the onSubmit prop with sanitized email
      await onSubmit(sanitizedEmail, password);

      // Record successful attempt
      rateLimiter.recordAttempt(`login_${sanitizedEmail}`, true);
      setAttemptCount(0);

    } catch (error: any) {
      // Record failed attempt
      const sanitizedEmail = sanitizeInput(email.trim(), 'email').toLowerCase();
      rateLimiter.recordAttempt(`login_${sanitizedEmail}`, false);
      setAttemptCount(prev => prev + 1);

      // Use generic error message to prevent account enumeration
      const genericError = getAuthErrorMessage(error?.message || 'Authentication failed');
      setValidationErrors({ email: genericError });

      logError('Login attempt failed', 'Security', {
        attempt: attemptCount + 1,
        email: sanitizedEmail
      });
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (result.success) {
        logInfo('Apple sign-in successful', 'Auth');
        router.replace('/(tabs)/dashboard');
      } else if (!result.cancelled) {
        Alert.alert('Error', result.error || 'Apple sign-in failed');
      }
    } catch (error: any) {
      logError('Apple sign-in error:', 'Auth', error);
      Alert.alert('Error', 'Failed to sign in with Apple');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        logInfo('Google sign-in successful', 'Auth');
        router.replace('/(tabs)/dashboard');
      } else if (!result.cancelled) {
        Alert.alert('Error', result.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      logError('Google sign-in error:', 'Auth', error);
      Alert.alert('Error', 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.formContainer}>
        <Text style={styles.welcomeText}>Welcome Back</Text>

        {!hideSignupHint && (
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>
              Don't have an account?{' '}
              <Text
                style={styles.signupLink}
                onPress={() => {
                  logDebug('Sign up button pressed', "Debug");
                  try {
                    if (onNavigateToSignup) {
                      onNavigateToSignup();
                    } else {
                      router.push('/signup');
                    }
                  } catch (error) {
                    logError('Navigation error:', "Error", error);
                  }
                }}
              >
                Sign up
              </Text>
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputContainer}>
            <Mail size={24} color="#9ca3af" />
            <TextInput
              style={styles.textInput}
              placeholder="your@email.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {validationErrors.email && (
            <Text style={styles.validationError}>{validationErrors.email}</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.passwordHeader}>
            <Text style={styles.inputLabel}>Password</Text>
            <TouchableOpacity onPress={() => router.push('/password-reset')}>
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputContainer}>
            <Lock size={24} color="#9ca3af" />
            <TextInput
              style={styles.textInput}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={24} color="#9ca3af" />
              ) : (
                <Eye size={24} color="#9ca3af" />
              )}
            </TouchableOpacity>
          </View>
          {validationErrors.password && (
            <Text style={styles.validationError}>
              {validationErrors.password}
            </Text>
          )}
        </View>

        <View style={styles.rememberMeContainer}>
          <Pressable
            style={styles.checkbox}
            onPress={() => setRememberMe(!rememberMe)}
          >
            {rememberMe && <View style={styles.checkboxSelected} />}
          </Pressable>
          <Text style={styles.rememberMeText}>Remember me</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.signInButton,
            (isLoading || isRateLimited) ? styles.signInButtonLoading : null,
          ]}
          onPress={handleSubmit}
          disabled={isLoading || isRateLimited}
        >
          <View style={styles.signInButtonContent}>
            {isLoading ? (
              <ActivityIndicator color={COLORS.CARD_WHITE_TEXT} size="small" />
            ) : isRateLimited ? (
              <Text style={styles.signInButtonText}>
                Retry in {Math.ceil(retryAfter / 1000)}s
              </Text>
            ) : (
              <Text style={styles.signInButtonText}>Sign in</Text>
            )}
          </View>
        </TouchableOpacity>

        {attemptCount > 2 && (
          <Text style={styles.securityWarning}>
            {`${5 - attemptCount} attempts remaining before temporary lockout`}
          </Text>
        )}

        {/* Social Auth Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Apple Sign In Button */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            disabled={isAppleLoading}
          >
            {isAppleLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.appleButtonIcon}></Text>
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Google Sign In Button */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Text style={styles.googleButtonIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { // Styles for the KeyboardAvoidingView
    width: "100%",
    // backgroundColor: "white", // Parent 'loginCard' provides background
    // paddingVertical: 16,    // Parent 'loginCard' provides outer padding
    // paddingHorizontal: 16,  // Parent 'loginCard' provides outer padding
  },
  formContainer: { // Styles for the View directly containing form elements
    width: "100%",
    padding: 24, // Internal padding for form elements
    // backgroundColor: "white", // Inherit from parent 'loginCard'
    // borderRadius: 12,      // Parent 'loginCard' handles border radius
    // borderWidth: 4,        // Parent 'loginCard' handles border
    // borderColor: "black",    // Parent 'loginCard' handles border
    // borderBottomWidth: 8,  // Parent 'loginCard' handles border
    // shadowColor: "#000",      // Parent 'loginCard' handles shadow
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.3,
    // shadowRadius: 4,
    // elevation: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: "center",
    color: "black",
  },
  signupContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  signupText: {
    fontSize: 18,
    color: "#1f2937", // text-gray-800
    textAlign: "center",
  },
  signupLink: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: "black",
    textDecorationLine: 'underline',
  },
  errorContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fee2e2", // bg-red-100
    borderRadius: 6,
  },
  errorText: {
    color: "#dc2626", // text-red-600
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 20,
    color: "#1f2937", // text-gray-800
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#d1d5db", // border-gray-300
    borderRadius: 12, // rounded-xl
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    color: "#1f2937", // text-gray-800
  },
  validationError: {
    color: "#ef4444", // text-red-500
    marginTop: 4,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  forgotPassword: {
    fontSize: 16,
    color: "#1f2937", // text-gray-800
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#d1d5db", // border-gray-300
    borderRadius: 4,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    width: 12,
    height: 12,
    backgroundColor: "black",
    borderRadius: 2,
  },
  rememberMeText: {
    fontSize: 16,
    color: "#1f2937", // text-gray-800
  },
  signInButton: {
    paddingVertical: 16,
    borderRadius: 12, // rounded-xl
    backgroundColor: COLORS.BLACK_CARD,
    borderWidth: 2,
    borderColor: "black",
  },
  signInButtonLoading: {
    opacity: 0.7,
  },
  signInButtonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signInButtonText: {
    color: COLORS.CARD_WHITE_TEXT,
    fontFamily: 'Geist-Regular',
    textAlign: "center",
    fontSize: 18,
  },
  securityWarning: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  // Social Auth Styles
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d1d5db",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#6b7280",
    fontFamily: 'Geist-Regular',
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#000",
    marginBottom: 12,
  },
  appleButtonIcon: {
    fontSize: 20,
    color: "#fff",
    marginRight: 8,
  },
  appleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
  },
  googleButtonIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#4285F4",
    marginRight: 8,
  },
  googleButtonText: {
    color: "#000",
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
});
