import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { secureStorage } from '../utils/secure-storage';
import { logger, logInfo } from '../utils/logger';
import { MonitoringService } from '../services/telemetry/monitoring';
import { sessionMonitor, rateLimiter, addSecurityDelay } from '../utils/security-utils';
import { jwtValidator } from '../utils/jwt-validation';
import {
  ActivityPreference,
  QuestionnaireData,
  NatalChartData,
  ZodiacSign,
  AuthError,
  DeleteAccountResponse,
} from '../types/auth.types';

// Define the Profile type based on your Supabase table
interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  age: number | null;
  gender: string | null;
  education_level: string | null;
  politics: string | null;
  is_single: boolean | null;
  has_kids: boolean | null;
  wants_kids: string | null;
  traits: string[] | null;
  interests: string[] | null;
  activity_preferences: ActivityPreference[] | null;
  zodiac_sign: ZodiacSign | null;
  push_token: string | null;
  website: string | null;
  updated_at: string | null;
  // Persona verification fields
  persona_inquiry_id: string | null;
  persona_verification_status: string | null;
  persona_verified_at: string | null;
  persona_liveness_score: number | null;
}

// Define UserData interface for birth info and questionnaire data  
interface UserData {
  id: string;
  birth_date: string | null;
  birth_location: string | null;
  birth_time: string | null;
  questionnaire_responses: QuestionnaireData | null;
  natal_chart_data: NatalChartData | null;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userData: UserData | null;
  loading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  verificationStatus: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ user: User; session: Session }>;
  phoneAuthPending: string | null;
  signOut: () => Promise<void>;
  deleteAccount: (confirmation: string) => Promise<DeleteAccountResponse>;
  refetchProfile: () => Promise<void>;
  fetchUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  userData: null,
  loading: true,
  isAuthenticated: false,
  isVerified: false,
  verificationStatus: null,
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithPhone: async () => {},
  verifyPhoneOtp: async () => ({ user: {} as User, session: {} as Session }),
  phoneAuthPending: null,
  signOut: async () => {},
  deleteAccount: async () => ({ success: false }),
  refetchProfile: async () => {},
  fetchUserData: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspiciousActivityCount, setSuspiciousActivityCount] = useState(0);
  const [phoneAuthPending, setPhoneAuthPending] = useState<string | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionFingerprintRef = useRef<any>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, onboarding_completed, age, gender, education_level, politics, is_single, has_kids, wants_kids, traits, interests, activity_preferences, zodiac_sign, push_token, website, updated_at, persona_inquiry_id, persona_verification_status, persona_verified_at, persona_liveness_score')
        .eq('id', userId)
        .single();

      if (error && status === 406) {
        // No profile found, create one with proper error handling
        try {
          const { error: rpcError } = await supabase.rpc('ensure_profile_exists', { user_id: userId });
          if (rpcError) {
            logger.error('Profile creation RPC failed', rpcError, { userId }, 'AUTH');
            throw new Error(`Profile creation failed: ${rpcError.message}`);
          }
          
          // Try fetching again after creation
          const { data: newData, error: newError } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, onboarding_completed, age, gender, education_level, politics, is_single, has_kids, wants_kids, traits, interests, activity_preferences, zodiac_sign, push_token, website, updated_at, persona_inquiry_id, persona_verification_status, persona_verified_at, persona_liveness_score')
            .eq('id', userId)
            .single();
            
          if (newData && !newError) {
            setProfile(newData as Profile);
          } else {
            throw new Error(`Profile fetch after creation failed: ${newError?.message}`);
          }
        } catch (rpcError) {
          logger.error('Profile creation RPC failed, attempting manual fallback', rpcError instanceof Error ? rpcError : undefined, { userId }, 'AUTH');
          
          // Fallback: try to create profile manually if RPC fails
          try {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                onboarding_completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
            if (insertError && !insertError.message.includes('duplicate key')) {
              throw insertError;
            }
            
            // Try fetching again after manual creation
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url, onboarding_completed, age, gender, education_level, politics, is_single, has_kids, wants_kids, traits, interests, activity_preferences, zodiac_sign, push_token, website, updated_at')
              .eq('id', userId)
              .single();
              
            if (fallbackData) {
              setProfile(fallbackData as Profile);
              return;
            } else if (fallbackError) {
              throw new Error(`Profile fetch after fallback creation failed: ${fallbackError.message}`);
            }
          } catch (fallbackError) {
            logger.error('Profile creation fallback failed completely', fallbackError instanceof Error ? fallbackError : undefined, { userId }, 'AUTH');
            throw new Error(`Profile creation completely failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
          }
        }
      } else if (error) {
        throw new Error(`Profile fetch error: ${error.message}`);
      } else if (data) {
        setProfile(data as Profile);
      } else {
        throw new Error('No profile data found and no error returned');
      }
    } catch (error) {
      logger.error('Profile fetch failed', error instanceof Error ? error : undefined, { userId }, 'AUTH');
      throw error; // Re-throw to allow caller to handle
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      const { data, error, status } = await supabase
        .from('users')
        .select('id, birth_date, birth_location, birth_time, questionnaire_responses, natal_chart_data, email')
        .eq('id', userId)
        .single();

      if (error && status === 406) {
        // No user record found, create one with proper error handling
        try {
          const { error: rpcError } = await supabase.rpc('ensure_user_exists', { user_id: userId });
          if (rpcError) {
            logger.error('User creation RPC failed', rpcError, { userId }, 'AUTH');
            throw new Error(`User creation failed: ${rpcError.message}`);
          }
          
          // Try fetching again without .single() to avoid PGRST116 error
          const { data: newData, error: newError } = await supabase
            .from('users')
            .select('id, birth_date, birth_location, birth_time, questionnaire_responses, natal_chart_data, email')
            .eq('id', userId);
            
          if (newData && newData.length > 0) {
            setUserData(newData[0] as UserData);
          } else if (newError) {
            throw new Error(`User fetch after creation failed: ${newError.message}`);
          } else {
            // Create a minimal user data object for basic functionality
            setUserData({
              id: userId,
              birth_date: null,
              birth_location: null,
              birth_time: null,
              questionnaire_responses: null,
              natal_chart_data: null,
              email: null
            });
          }
        } catch (rpcError) {
          logger.error('User creation RPC failed, attempting manual fallback', rpcError instanceof Error ? rpcError : undefined, { userId }, 'AUTH');
          
          // Fallback: try to create user manually if RPC fails
          try {
            const { data: authUser } = await supabase.auth.getUser();
            if (!authUser.user) {
              throw new Error('No authenticated user found');
            }
            
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: userId,
                auth_user_id: userId,
                email: authUser.user.email || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
            if (insertError && !insertError.message.includes('duplicate key')) {
              throw insertError;
            }
            
            // Try fetching again after manual creation
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('users')
              .select('id, birth_date, birth_location, birth_time, questionnaire_responses, natal_chart_data, email')
              .eq('id', userId);
              
            if (fallbackData && fallbackData.length > 0) {
              setUserData(fallbackData[0] as UserData);
              return;
            } else if (fallbackError) {
              throw new Error(`User fetch after fallback creation failed: ${fallbackError.message}`);
            }
          } catch (fallbackError) {
            logger.error('User creation fallback failed completely', fallbackError instanceof Error ? fallbackError : undefined, { userId }, 'AUTH');
            // Create a minimal user data object for basic functionality
            setUserData({
              id: userId,
              birth_date: null,
              birth_location: null,
              birth_time: null,
              questionnaire_responses: null,
              natal_chart_data: null,
              email: null
            });
          }
        }
      } else if (error) {
        throw new Error(`User data fetch error: ${error.message}`);
      } else if (data) {
        try {
          const raw = (data as any)?.natal_chart_data;
          const chartKeys = raw ? Object.keys(raw as any) : [];
          const planetsCount = Array.isArray(raw?.chartData?.planets) ? raw.chartData.planets.length : 0;
          const hasCore = !!(raw?.CorePlacements || raw?.corePlacements);
          const hasChart = hasCore || planetsCount > 0;
          logInfo('[AUTH] UserData fetched: natal_chart_data', 'AUTH', { hasChart, chartKeys, planetsCount });
        } catch {}
        setUserData(data as UserData);
      }
    } catch (error) {
      logger.error('User data fetch failed', error instanceof Error ? error : undefined, { userId }, 'AUTH');
    }
  };

  const refetchProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        // First check for stored secure session
        const storedSession = await secureStorage.getSession();
        
        if (storedSession && storedSession.expires_at && storedSession.expires_at > Date.now() / 1000) {
          // Use stored session if valid
          setSession(storedSession);
          setUser(storedSession.user ?? null);
          if (storedSession.user) {
            await fetchProfile(storedSession.user.id);
            await fetchUserData(storedSession.user.id);
          }
        } else {
          // Fetch fresh session from Supabase
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            // Store session securely
            await secureStorage.storeSession(session);
            
            // Store tokens securely
            if (session.access_token) {
              await secureStorage.storeAuthToken(
                session.access_token,
                session.refresh_token || undefined
              );
            }
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
            await fetchUserData(session.user.id);
          }
        }
      } catch (error) {
        logger.error('Initial session retrieval failed', error instanceof Error ? error : undefined, {}, 'AUTH');
        // Clear any corrupted data
        await secureStorage.clearAllSecureData();
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        try {
          // Store or clear session based on auth state
          if (session) {
            // Store session and tokens securely
            await secureStorage.storeSession(session);
            
            if (session.access_token) {
              await secureStorage.storeAuthToken(
                session.access_token,
                session.refresh_token || undefined
              );
            }
          } else if (event === 'SIGNED_OUT') {
            // Clear all secure data on sign out
            await secureStorage.clearAllSecureData();
          }
          
          setSession(session);
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
            await fetchUserData(currentUser.id);
          } else {
            setProfile(null);
            setUserData(null);
          }
        } catch (error) {
          logger.error('Auth state change handler failed', error instanceof Error ? error : undefined, { event }, 'AUTH');
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const sessionUserId = session?.user?.id ?? null;

  const signOut = useCallback(async () => {
    try {
      setLoading(true);

      // Invalidate session in monitor
      if (sessionUserId) {
        sessionMonitor.invalidateSession(sessionUserId);
      }

      // Clear all secure data first
      await secureStorage.clearAllSecureData();

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
      setUserData(null);
      setSuspiciousActivityCount(0);
      sessionFingerprintRef.current = null;
      MonitoringService.resetIdentity();

      // Clear any running intervals
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    } catch (error) {
      // Even if sign out fails, clear local secure data
      await secureStorage.clearAllSecureData();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [sessionUserId]);

  // Handle session timeout
  const handleSessionTimeout = useCallback(async () => {
    logInfo('Handling session timeout', 'AUTH');
    await signOut();
    // Could show a modal or notification about session timeout
  }, [signOut]);

  // Handle suspicious activity detection
  const handleSuspiciousActivity = useCallback(async () => {
    logInfo('Handling suspicious activity - forcing re-authentication', 'AUTH');
    await secureStorage.clearAllSecureData();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setUserData(null);
    setSuspiciousActivityCount(0);
  }, []);

  // Enhanced session validation with security monitoring
  const validateAndRefreshSession = useCallback(async (): Promise<boolean> => {
    try {
      // Check for inactivity timeout (15 minutes)
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      
      if (inactiveTime > 900000) { // 15 minutes
        logInfo('Session expired due to inactivity', 'AUTH');
        await handleSessionTimeout();
        return false;
      }
      
      // First check secure storage for tokens
      const { accessToken } = await secureStorage.getAuthToken();
      
      // Get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.error('Session validation failed', error instanceof Error ? error : undefined, {}, 'AUTH');
        await secureStorage.clearAuthTokens();
        return false;
      }

      if (!session) {
        await secureStorage.clearAuthTokens();
        return false;
      }

      // CRITICAL SECURITY: Validate JWT token cryptographically
      if (session.access_token) {
        const jwtValidation = await jwtValidator.validateJWT(session.access_token);
        jwtValidator.auditJWTValidation(session.access_token, jwtValidation, 'session_validation');
        
        if (!jwtValidation.valid) {
          logger.error('JWT validation failed during session check', undefined, {
            reason: jwtValidation.reason,
            error: jwtValidation.error
          }, 'AUTH_JWT');
          await secureStorage.clearAuthTokens();
          return false;
        }

        // Validate JWT context matches current user
        if (session.user) {
          const contextValidation = jwtValidator.validateSessionContext(
            session.access_token, 
            session.user.id
          );
          
          if (!contextValidation.valid) {
            logger.error('JWT context validation failed', undefined, {
              reason: contextValidation.reason,
              userId: session.user.id
            }, 'AUTH_JWT');
            await secureStorage.clearAuthTokens();
            return false;
          }
        }

        // Check if token is near expiry for proactive refresh
        if (jwtValidator.isTokenNearExpiry(session.access_token, 5)) {
          logInfo('JWT token near expiry, triggering refresh...', 'AUTH');
          // This will be handled by the existing expiry check below
        }
      } else {
        logger.error('Session missing access token', undefined, {}, 'AUTH');
        await secureStorage.clearAuthTokens();
        return false;
      }
      
      // Validate session fingerprint for suspicious activity
      if (session.user && sessionFingerprintRef.current) {
        const currentFingerprint = sessionMonitor.createFingerprint();
        const validation = sessionMonitor.validateSession(
          session.user.id,
          currentFingerprint
        );
        
        if (!validation.valid) {
          logger.error('Session fingerprint validation failed', undefined, 
            { reason: validation.reason }, 'AUTH');
          
          if (validation.suspicious) {
            setSuspiciousActivityCount(prev => prev + 1);
            
            // Force re-authentication after 3 suspicious activities
            if (suspiciousActivityCount >= 2) {
              logInfo('Multiple suspicious activities detected - forcing re-authentication', 'AUTH');
              await handleSuspiciousActivity();
              return false;
            }
          }
        }
      }

      // Check if session is expired or about to expire (within 2 minutes for better security)
      const expiresAt = session.expires_at;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const twoMinutesFromNow = nowSeconds + (2 * 60);

      if (expiresAt && expiresAt < twoMinutesFromNow) {
        // Session is expired or about to expire, try to refresh
        logInfo('Session near expiry, refreshing...', 'AUTH');
        
        // Add small delay to prevent rapid refresh attempts
        await addSecurityDelay();
        
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshedSession) {
          logger.error('Session refresh failed', refreshError instanceof Error ? refreshError : undefined, {}, 'AUTH');
          await secureStorage.clearAllSecureData();
          return false;
        }

        // Store refreshed session and tokens securely
        await secureStorage.storeSession(refreshedSession);
        if (refreshedSession.access_token) {
          await secureStorage.storeAuthToken(
            refreshedSession.access_token,
            refreshedSession.refresh_token || undefined
          );
        }

        // Update session state with refreshed session
        setSession(refreshedSession);
        setUser(refreshedSession.user);
        
        // Reset suspicious activity count on successful refresh
        setSuspiciousActivityCount(0);
        
        // Update session in monitor
        if (refreshedSession.user) {
          const fingerprint = sessionMonitor.createFingerprint();
          sessionMonitor.registerSession(refreshedSession.user.id, fingerprint);
        }
        
        return true;
      }

      // Session is valid and not expiring soon
      // Ensure tokens are stored securely
      if (session.access_token && !accessToken) {
        await secureStorage.storeAuthToken(
          session.access_token,
          session.refresh_token || undefined
        );
      }
      
      // Update last activity
      lastActivityRef.current = now;

      return true;
    } catch (error) {
      logger.error('Session validation process failed', error instanceof Error ? error : undefined, {}, 'AUTH');
      await secureStorage.clearAllSecureData();
      return false;
    }
  }, [
    suspiciousActivityCount,
    handleSessionTimeout,
    handleSuspiciousActivity,
  ]);

  // Enhanced session monitoring with real-time validation
  useEffect(() => {
    if (!session) {
      // Clear any existing interval when there's no session
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      return;
    }

    const validateSession = async () => {
      const isValid = await validateAndRefreshSession();
      if (!isValid) {
        // Session is invalid, sign out user
        await supabase.auth.signOut();
      }
    };

    // Validate session immediately
    validateSession();
    
    // Register session with monitor
    if (session.user) {
      const fingerprint = sessionMonitor.createFingerprint();
      sessionMonitor.registerSession(session.user.id, fingerprint);
      sessionFingerprintRef.current = fingerprint;
    }

    // Set up more frequent validation (every 1 minute for better security)
    sessionCheckIntervalRef.current = setInterval(validateSession, 60 * 1000);
    
    // Track user activity
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    
    // Add activity listeners (web only)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).addEventListener === 'function') {
      window.addEventListener('mousedown', updateActivity);
      window.addEventListener('keydown', updateActivity);
      window.addEventListener('touchstart', updateActivity);
    }

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      
      // Remove activity listeners (web only)
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).removeEventListener === 'function') {
        window.removeEventListener('mousedown', updateActivity);
        window.removeEventListener('keydown', updateActivity);
        window.removeEventListener('touchstart', updateActivity);
      }
    };
  }, [session, validateAndRefreshSession]);

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);

    try {
      // Check rate limiting for this email
      const rateLimitCheck = rateLimiter.isRateLimited(`auth_${email.toLowerCase()}`);
      if (rateLimitCheck.limited) {
        throw new Error(`Too many attempts. Please wait ${Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)} seconds.`);
      }

      // Add security delay to prevent timing attacks
      await addSecurityDelay();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Record failed attempt
        rateLimiter.recordAttempt(`auth_${email.toLowerCase()}`, false);
        setLoading(false);
        throw error;
      }

      // Record successful attempt
      rateLimiter.recordAttempt(`auth_${email.toLowerCase()}`, true);

      // Store session and tokens securely on successful sign in
      if (data?.session) {
        await secureStorage.storeSession(data.session);
        if (data.session.access_token) {
          await secureStorage.storeAuthToken(
            data.session.access_token,
            data.session.refresh_token || undefined
          );
        }

        // Register session with security monitor
        if (data.session.user) {
          const fingerprint = sessionMonitor.createFingerprint();
          sessionMonitor.registerSession(data.session.user.id, fingerprint);
          sessionFingerprintRef.current = fingerprint;
        }

        // Reset suspicious activity count on successful login
        setSuspiciousActivityCount(0);
        lastActivityRef.current = Date.now();
      } else {
        // Ensure UI unlocks if no session returned (e.g. email confirmation required)
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
      });
      if (error) throw error;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithPhone = async (phone: string) => {
    try {
      setLoading(true);

      // Check rate limiting
      const rateLimitCheck = rateLimiter.isRateLimited(`phone_auth_${phone}`);
      if (rateLimitCheck.limited) {
        throw new Error(`Too many attempts. Please wait ${Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)} seconds.`);
      }

      await addSecurityDelay();

      const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          shouldCreateUser: true, // Auto-create user on first OTP
        }
      });

      if (error) {
        rateLimiter.recordAttempt(`phone_auth_${phone}`, false);
        throw error;
      }

      // Record successful OTP send
      rateLimiter.recordAttempt(`phone_auth_${phone}`, true);

      // Store phone number for verification step
      setPhoneAuthPending(phone);

      logInfo('Phone OTP sent successfully', 'AUTH', { phone: phone.slice(-4) });
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    try {
      setLoading(true);

      await addSecurityDelay();

      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: token,
        type: 'sms',
      });

      if (error) throw error;

      if (!data.session || !data.user) {
        throw new Error('Invalid OTP or verification failed');
      }

      // Store session and tokens securely
      await secureStorage.storeSession(data.session);
      if (data.session.access_token) {
        await secureStorage.storeAuthToken(
          data.session.access_token,
          data.session.refresh_token || undefined
        );
      }

      // Register session with security monitor
      const fingerprint = sessionMonitor.createFingerprint();
      sessionMonitor.registerSession(data.user.id, fingerprint);
      sessionFingerprintRef.current = fingerprint;

      // Clear pending phone state
      setPhoneAuthPending(null);

      logInfo('Phone OTP verified successfully', 'AUTH');

      return { user: data.user, session: data.session };
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (confirmation: string) => {
    try {
      setLoading(true);
      
      if (confirmation !== 'DELETE') {
        throw new Error('Invalid confirmation. Please type "DELETE" to confirm.');
      }

      logInfo('Starting account deletion request', 'AUTH');

      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: { confirmation }
      });

      logInfo('Account deletion response received', 'AUTH', { hasData: !!data, hasError: !!error });

      if (error) {
        logger.error('Account deletion function invocation failed', error instanceof Error ? error : undefined, {}, 'AUTH');
        
        // Enhanced error handling for different types of errors
        if (error.message && error.message.includes('Edge Function returned a non-2xx status code')) {
          // This indicates the function ran but returned an error status
          // Try to extract more details from the error context
          let detailedMessage = 'Account deletion failed on the server.';
          
          // Try different ways to extract error details from the response
          try {
            const authError = error as AuthError;
            if (authError.context?.res?.text) {
              const errorBody = JSON.parse(authError.context.res.text) as Record<string, unknown>;
              if (errorBody.error) {
                detailedMessage = String((errorBody as any).error);
                if ((errorBody as any).details) {
                  detailedMessage += ` ${String((errorBody as any).details)}`;
                }
              }
              if ((errorBody as any).step) {
                detailedMessage += ` (Failed at step ${String((errorBody as any).step)})`;
              }
            } else if (authError.context?.body) {
              // Sometimes the error is in the body field
              const errorBody = typeof authError.context.body === 'string' 
                ? JSON.parse(authError.context.body) as Record<string, unknown>
                : authError.context.body as Record<string, unknown>;
              if ((errorBody as any).error) {
                detailedMessage = String((errorBody as any).error);
                if ((errorBody as any).details) {
                  detailedMessage += ` ${String((errorBody as any).details)}`;
                }
              }
            } else if (authError.context?.details) {
              detailedMessage = authError.context.details;
            }
          } catch (parseError) {
            logger.warn('Failed to parse account deletion error payload', parseError instanceof Error ? parseError : undefined, {}, 'AUTH');
            // If parsing fails, use the raw text
            const authError = error as AuthError;
            detailedMessage = authError.context?.res?.text || 
              (typeof authError.context?.body === 'string' ? authError.context.body : 'Server returned an error');
          }
          
          throw new Error(detailedMessage);
        }
        
        // Handle other types of errors
        throw new Error(`Failed to delete account: ${error.message}`);
      }

      // Verify we got a success response
      const response = data as DeleteAccountResponse;
      if (!response || !response.success) {
        throw new Error(`Account deletion failed: ${response?.error || 'Unknown error occurred'}`);
      }

      // Log successful deletion
      if (response.deletionLog) {
        logInfo('Account deletion completed successfully', 'AUTH', { deletionLog: response.deletionLog });
      }

      // Clear all secure data after successful account deletion
      await secureStorage.clearAllSecureData();
      
      // Clear local state only after confirmed successful deletion
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserData(null);
      MonitoringService.resetIdentity();

      return response; // Return the response for additional handling if needed
      
    } catch (error) {
      logger.error('Account deletion process failed', error instanceof Error ? error : undefined, {}, 'AUTH');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      MonitoringService.identify(user.id, {
        email: user.email,
        onboarding_completed: profile?.onboarding_completed ?? false,
      });
    } else {
      MonitoringService.resetIdentity();
    }
  }, [user?.id, profile?.onboarding_completed]);

  const fetchUserDataStandalone = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    userData,
    loading,
    isAuthenticated: !!user,
    isVerified: profile?.persona_verification_status === 'approved',
    verificationStatus: profile?.persona_verification_status || null,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signInWithPhone,
    verifyPhoneOtp,
    phoneAuthPending,
    signOut,
    deleteAccount,
    refetchProfile,
    fetchUserData: fetchUserDataStandalone,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
