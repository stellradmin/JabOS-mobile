import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logDebug, logUserAction, logInfo } from '../src/utils/logger';
import {
  validateEmailRFC5322,
  validatePasswordStrength,
  sanitizeInput,
  rateLimiter,
  addSecurityDelay,
  csrfTokenManager,
  sessionMonitor,
} from '../src/utils/security-utils';
import { COLORS } from '../constants/theme';
import { signInWithApple } from '../src/services/apple-auth-service';
import { signInWithGoogle } from '../src/services/google-auth-service';

type SignupFormProps = {
  hideSignInHint?: boolean;
};

const PLACEHOLDER_COLOR = COLORS.MUTED_TEXT;

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const validation = validatePasswordStrength(password);

  if (!password) {
    return null;
  }

  const getColor = () => {
    switch (validation.strength) {
      case 'weak':
        return COLORS.ERROR;
      case 'medium':
        return COLORS.WARNING;
      case 'strong':
        return COLORS.SUCCESS;
      case 'very-strong':
        return COLORS.ACCEPT_GREEN;
      default:
        return COLORS.MUTED_TEXT;
    }
  };

  const strengthColor = getColor();

  return (
    <View style={styles.strengthContainer}>
      <View style={styles.strengthBar}>
        <View
          style={[
            styles.strengthFill,
            { width: `${validation.score}%`, backgroundColor: strengthColor },
          ]}
        />
      </View>
      <Text style={[styles.strengthText, { color: strengthColor }]}>
        Password strength: {validation.strength}
      </Text>
      {validation.issues.length > 0 && (
        <View style={styles.strengthIssues}>
          {validation.issues.map((issue, index) => (
            <Text key={index} style={styles.issueText}>
              • {issue}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const SignupForm = ({ hideSignInHint = false }: SignupFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  // Initialize security features
  useEffect(() => {
    const initSecurity = async () => {
      try {
        const token = await csrfTokenManager.generateToken(sessionId);
        setCsrfToken(token);

        const fingerprint = sessionMonitor.createFingerprint();
        sessionMonitor.registerSession(sessionId, fingerprint);
      } catch (securityError) {
        logError('Security initialization failed', 'Security', securityError);
      }
    };

    initSecurity();

    return () => {
      sessionMonitor.invalidateSession(sessionId);
    };
  }, [sessionId]);

  // Handle rate-limiting countdown
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => {
        setRetryAfter(prev => {
          const next = Math.max(0, prev - 1000);
          if (next === 0) {
            setIsRateLimited(false);
          }
          return next;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [retryAfter]);

  const validateInputs = () => {
    const cleanEmail = sanitizeInput(email.trim(), 'email');
    const emailValidation = validateEmailRFC5322(cleanEmail);

    if (!cleanEmail) {
      setError('Email is required.');
      return false;
    }

    if (!emailValidation.isValid) {
      setError(emailValidation.reason || 'Invalid email format');
      return false;
    }

    const passwordValidation = validatePasswordStrength(password);

    if (!password) {
      setError('Password is required.');
      return false;
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.issues[0] || 'Password does not meet security requirements');
      return false;
    }

    if (passwordValidation.strength === 'weak') {
      setError('Password is too weak. Please choose a stronger password.');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    if (emailValidation.sanitized) {
      setEmail(emailValidation.sanitized);
    }

    return true;
  };

  const handleEmailChange = (text: string) => {
    setEmail(text.trim());
    if (error?.toLowerCase().includes('email')) {
      setError(null);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error?.toLowerCase().includes('password')) {
      setError(null);
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (error?.toLowerCase().includes('match')) {
      setError(null);
    }
  };

  const handleSignUp = async () => {
    try {
      const sanitizedEmail = sanitizeInput(email.trim(), 'email').toLowerCase();
      const rateLimitCheck = rateLimiter.isRateLimited(`signup_${sanitizedEmail}`);

      if (rateLimitCheck.limited) {
        setIsRateLimited(true);
        setRetryAfter(rateLimitCheck.retryAfter || 0);

        const retrySeconds = Math.ceil((rateLimitCheck.retryAfter || 0) / 1000);
        Alert.alert('Too Many Attempts', `Please wait ${retrySeconds} seconds before trying again.`, [
          { text: 'OK' },
        ]);
        return;
      }

      if (!validateInputs()) {
        return;
      }

      if (csrfToken && !csrfTokenManager.validateToken(sessionId, csrfToken)) {
        logWarn('CSRF token validation failed during signup', 'Security');
        const newToken = await csrfTokenManager.generateToken(sessionId);
        setCsrfToken(newToken);
      }

      const fingerprint = sessionMonitor.createFingerprint();
      const sessionValidation = sessionMonitor.validateSession(sessionId, fingerprint);

      if (!sessionValidation.valid) {
        logWarn(`Session validation failed during signup: ${sessionValidation.reason}`, 'Security');
      }

      await addSecurityDelay();

      setIsLoading(true);
      setError(null);

      const finalEmail = sanitizeInput(email.trim(), 'email').toLowerCase();

      const { data: signUpAuthData, error: signUpError } = await supabase.auth.signUp({
        email: finalEmail,
        password,
        options: {
          data: {
            signup_timestamp: new Date().toISOString(),
            client_fingerprint: sessionMonitor.createFingerprint(),
          },
        },
      });

      if (signUpError) {
        rateLimiter.recordAttempt(`signup_${finalEmail}`, false);

        logError('Signup error:', 'Error', signUpError);
        let errorMessage = signUpError.message;

        if (errorMessage.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please try logging in instead.';
        } else if (errorMessage.includes('Invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (errorMessage.includes('Password')) {
          errorMessage = 'Password must be at least 8 characters long.';
        } else if (errorMessage.includes('database error') || errorMessage.includes('saving new user')) {
          logError('Database error during signup:', 'Error', signUpError);
          errorMessage = 'Unable to create account. Please try again in a moment.';
        }

        setError(errorMessage);
        Sentry.captureException(signUpError, {
          extra: { email, context: 'SignupForm Supabase Error', originalError: signUpError.message },
        });
      } else if (signUpAuthData.user && !signUpAuthData.session) {
        try {
          const resendResult = await supabase.auth.resend({
            type: 'signup',
            email: finalEmail,
          });

          if (resendResult.error) {
            logWarn('Signup verification resend failed', 'Security');
            logError('Signup verification resend error', 'Error', resendResult.error);
            Sentry.captureException(resendResult.error, {
              extra: {
                email: finalEmail,
                context: 'SignupForm Resend Verification',
                originalMessage: resendResult.error.message,
              },
            });
          }
        } catch (resendError) {
          logError('Signup verification resend threw error', 'Error', resendError);
          Sentry.captureException(resendError, {
            extra: { email: finalEmail, context: 'SignupForm Resend Verification Catch' },
          });
        } finally {
          Alert.alert(
            'Check your email',
            'A confirmation link has been sent to your email address. Please verify your email to complete signup and log in.'
          );
        }
      } else if (signUpAuthData.user && signUpAuthData.session) {
        rateLimiter.recordAttempt(`signup_${finalEmail}`, true);
        logDebug('Signup successful and session established.', 'Debug');
        logUserAction('Successful account creation', 'Auth', { email: finalEmail });
      } else {
        setError('An unexpected issue occurred during sign up. Please try again or contact support.');
        Sentry.captureMessage('Unexpected signup response from Supabase', {
          extra: { email, signUpAuthData },
        });
      }
    } catch (catchError: any) {
      const sanitizedEmail = sanitizeInput(email.trim(), 'email').toLowerCase();
      rateLimiter.recordAttempt(`signup_${sanitizedEmail}`, false);

      setError(catchError.message || 'An unexpected error occurred during sign up.');
      Sentry.captureException(catchError, {
        extra: { email: sanitizedEmail, context: 'SignupForm Catch Error' },
      });
    } finally {
      setIsLoading(false);
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>

          {!hideSignInHint && (
            <View style={styles.signInHint}>
              <Text style={styles.subtitle}>
                Already have an account?{' '}
                <Text
                  style={styles.signInLink}
                  onPress={() => {
                    logDebug('Sign in link pressed from signup', 'Debug');
                    router.push('/login');
                  }}
                >
                  Sign in
                </Text>
              </Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Mail size={24} color={PLACEHOLDER_COLOR} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={24} color={PLACEHOLDER_COLOR} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!isPasswordVisible}
              />
              <TouchableOpacity
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                accessibilityRole="button"
                accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                accessibilityHint="Toggles password visibility"
              >
                {isPasswordVisible ? (
                  <EyeOff size={24} color={PLACEHOLDER_COLOR} />
                ) : (
                  <Eye size={24} color={PLACEHOLDER_COLOR} />
                )}
              </TouchableOpacity>
            </View>
            <PasswordStrengthIndicator password={password} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={24} color={PLACEHOLDER_COLOR} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!isConfirmPasswordVisible}
              />
              <TouchableOpacity
                onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                accessibilityRole="button"
                accessibilityLabel={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                accessibilityHint="Toggles confirm password visibility"
              >
                {isConfirmPasswordVisible ? (
                  <EyeOff size={24} color={PLACEHOLDER_COLOR} />
                ) : (
                  <Eye size={24} color={PLACEHOLDER_COLOR} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (isLoading || isRateLimited) && styles.buttonDisabled]}
            onPress={handleSignUp}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityHint="Submits the signup form"
            disabled={isLoading || isRateLimited}
          >
            <Text style={styles.buttonText}>
              {isLoading
                ? 'Creating Account...'
                : isRateLimited
                ? `Retry in ${Math.ceil(retryAfter / 1000)}s`
                : 'Create Account'}
            </Text>
          </TouchableOpacity>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  formContainer: {
    width: '100%',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: COLORS.PRIMARY_BLACK,
  },
  signInHint: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
  },
  signInLink: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: COLORS.PRIMARY_BLACK,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: COLORS.ERROR,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 20,
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.BORDER_TERTIARY,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    color: COLORS.DARK_TEXT,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.BLACK_CARD,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY_BLACK,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.CARD_WHITE_TEXT,
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
    fontSize: 18,
  },
  strengthContainer: {
    marginTop: 12,
  },
  strengthBar: {
    height: 4,
    backgroundColor: COLORS.BORDER_SECONDARY,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 8,
  },
  strengthText: {
    fontSize: 12,
    marginBottom: 4,
  },
  strengthIssues: {
    marginTop: 4,
  },
  issueText: {
    fontSize: 12,
    color: COLORS.MUTED_TEXT,
    marginTop: 2,
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

export default SignupForm;
