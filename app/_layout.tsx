import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';
import { MessagingProvider } from '../src/contexts/MessagingContext';
import { UnifiedAppProvider } from '../src/contexts/UnifiedAppContext';
import { LegalComplianceProvider } from '../src/contexts/LegalComplianceContext';
import { Stack } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { initializeRevenueCat } from '../src/services/revenuecat-service';
import { initPostHog } from '../src/lib/posthog-enhanced';
import { initSentry } from '../src/lib/sentry-enhanced';
import { isAppleSignInAvailable } from '../src/services/apple-auth-service';
import { configureGoogleSignIn } from '../src/services/google-auth-service';
import { MonitoringService } from '../src/services/telemetry/monitoring';
import { certificatePinning } from '../src/utils/certificate-pinning';
import { usePerformanceMonitoring } from '../src/hooks/usePerformanceMonitoring';
import { useAuthNavigation } from '../src/hooks/useAuthNavigation';
import { useSubscriptionSync } from '../src/hooks/useSubscriptionSync';
import ErrorBoundary from '../src/components/ErrorBoundary';
import ThemeProvider from '../src/theme/ThemeProvider';
import SplashScreenManager from '../components/SplashScreenManager';
import Constants from 'expo-constants';
import { hideSplashScreen } from '../src/utils/splashScreen';
import MatchInvitationManager from '../src/components/MatchInvitationManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { logger } from '../src/utils/logger';
import '../src/utils/splashScreen';
import '../src/utils/suppress-warnings';
import { initRuntimeSecurity } from '../src/lib/runtime-security';
import { useFonts } from 'expo-font';

function AuthNavigator() {
  const { user, profile, loading } = useAuth();
  const { trackScreenLoadStart, trackUserInteraction } = usePerformanceMonitoring();

  // Sync subscription status from RevenueCat to Supabase on app launch
  useSubscriptionSync();

  // Use extracted navigation logic
  useAuthNavigation({ user, profile, loading });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown:
          !route.name.startsWith("tempobook") &&
          route.name !== "conversation",
        // Enable consistent horizontal slide transitions and swipe-back gestures
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      })}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="phone-auth" options={{ headerShown: false }} />
      <Stack.Screen name="phone-otp" options={{ headerShown: false }} />
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="date-night"
        options={{
          title: "Date Night",
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 300,
        }}
      />
      <Stack.Screen name="report-issue" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="questionnaire" options={{ headerShown: false }} />
      <Stack.Screen name="date-night-preferences" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding-complete" options={{ headerShown: false }} />
      {/* Ensure conversation overlays tabs (no tab bar bleed-through) */}
      <Stack.Screen
        name="conversation"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_right',
          animationDuration: 280,
        }}
      />
      {/* Read-only view of another user's profile */}
      <Stack.Screen name="view-profile/[id]" options={{ headerShown: false }} />
      
      {/* Legal Compliance Pages */}
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
      <Stack.Screen name="cookie-policy" options={{ headerShown: false }} />
      <Stack.Screen name="gdpr-consent" options={{ headerShown: false }} />
      <Stack.Screen name="gdpr-requests" options={{ headerShown: false }} />
      <Stack.Screen name="age-verification" options={{ headerShown: false }} />
      <Stack.Screen name="data-retention" options={{ headerShown: false }} />
      <Stack.Screen name="compliance-audit" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    'Geist-Thin': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-Thin.ttf'),
    'Geist-ExtraLight': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-ExtraLight.ttf'),
    'Geist-Light': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-Light.ttf'),
    'Geist-Regular': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-Regular.ttf'),
    'Geist-Medium': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-Bold.ttf'),
    'Geist-Black': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-Black.ttf'),
    'Geist-ExtraBold': require('../assets/fonts/geist-font-1.4.2/fonts/Geist/ttf/Geist-ExtraBold.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontError) {
      logger.error('Font loading error', 'APP_INIT', undefined, fontError instanceof Error ? fontError : undefined);
    }
  }, [fontError]);

  // Initialize app on start (gracefully handle failures)
  useEffect(() => {
    // Initialize runtime security policy as early as possible
    try { initRuntimeSecurity(); } catch (e) { throw e; }

    const initializeApp = async () => {
      try {
        // Delay to ensure all native modules are loaded
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        
        // Initialize REAL certificate pinning with native module
        try {
          await certificatePinning.initialize();
          logger.info('Certificate pinning initialized', 'APP_INIT');
        } catch (error) {
          logger.error('Certificate pinning initialization failed', 'APP_INIT', undefined, error instanceof Error ? error : undefined);
        }

        // Initialize Apple Sign-In (iOS only)
        try {
          if (Platform.OS === 'ios') {
            const appleAvailable = await isAppleSignInAvailable();
            if (appleAvailable) {
              logger.info('✅ Apple Sign-In available and ready', 'APP_INIT');
            } else {
              logger.info('Apple Sign-In not available (requires iOS 13+)', 'APP_INIT');
            }
          }
        } catch (error) {
          logger.warn('Apple Sign-In initialization check failed', 'APP_INIT', error);
        }

        // Initialize Google Sign-In
        try {
          const googleConfigured = configureGoogleSignIn();
          if (googleConfigured) {
            logger.info('✅ Google Sign-In configured successfully', 'APP_INIT');
          } else {
            logger.warn('Google Sign-In configuration failed - check environment variables', 'APP_INIT');
          }
        } catch (error) {
          logger.warn('Google Sign-In initialization failed', 'APP_INIT', error);
        }

        // Initialize enhanced Sentry (for error tracking)
        try {
          initSentry();
          logger.info('Enhanced Sentry initialized successfully', 'APP_INIT');
        } catch (error) {
          logger.warn('Sentry initialization failed', 'APP_INIT', error);
        }

        // Initialize enhanced PostHog
        try {
          await initPostHog();
          logger.info('Enhanced PostHog initialized successfully', 'APP_INIT');
        } catch (error) {
          logger.warn('PostHog initialization failed', 'APP_INIT', error);
        }

        MonitoringService.initialize();

        // Initialize RevenueCat with proper error handling
        try {
          const revenueCatInitialized = await initializeRevenueCat();
          if (revenueCatInitialized) {
            logger.info('RevenueCat initialized successfully', 'APP_INIT');
          } else {
            logger.warn('RevenueCat initialization failed - payment functionality may be limited', 'APP_INIT');
          }
        } catch (error) {
          logger.error('RevenueCat initialization error', 'APP_INIT', undefined, error instanceof Error ? error : undefined);
          // App continues to function without payment functionality
        }
        
        // Mark app as ready regardless of RevenueCat status
        setIsAppReady(true);
      } catch (error) {
        logger.warn('App initialization error (continuing normally)', 'APP_INIT', error);
        setIsAppReady(true); // Still mark as ready even if initialization fails
      }
    };
    
    initializeApp();
  }, []);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') {
      if (fontsLoaded && isAppReady) {
        hideSplashScreen();
        setShowSplash(false);
      } else {
        setShowSplash(true);
      }
    }
  }, [fontsLoaded, isAppReady]);

  const appReady = useMemo(() => fontsLoaded && isAppReady, [fontsLoaded, isAppReady]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (!fontsLoaded && !fontError) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <SubscriptionProvider>
              <MessagingProvider>
                <UnifiedAppProvider>
                  <LegalComplianceProvider>
                    <AuthNavigatorWithSplash 
                      showSplash={showSplash}
                      isAppReady={appReady}
                      onSplashFinish={handleSplashFinish}
                    />
                  </LegalComplianceProvider>
                </UnifiedAppProvider>
              </MessagingProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AuthNavigatorWithSplash({ 
  showSplash, 
  isAppReady, 
  onSplashFinish 
}: { 
  showSplash: boolean; 
  isAppReady: boolean; 
  onSplashFinish: () => void;
}) {
  const { loading } = useAuth();

  return (
    <MatchInvitationManager>
      <AuthNavigator />
      {showSplash && (
        <SplashScreenManager
          onFinish={onSplashFinish}
          isAuthLoading={loading}
          isAppReady={isAppReady}
        />
      )}
    </MatchInvitationManager>
  );
}
