import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithApple } from '../src/services/apple-auth-service';
import { signInWithGoogle } from '../src/services/google-auth-service';
import { useAuth } from '../src/contexts/AuthContext';
import { logInfo, logError, logDebug } from '../src/utils/logger';

const { width, height } = Dimensions.get('window');

const WelcomeScreen: React.FC = () => {
  const router = useRouter();
  const { refetchProfile, profile } = useAuth();
  const isExpoGo = Constants.appOwnership === 'expo';
  const fadeAnim = useRef(new Animated.Value(isExpoGo ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(isExpoGo ? 0 : 30)).current;

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (isExpoGo) return; // Render instantly in Expo Go for reliability
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpoGo]);

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (result.success) {
        logInfo('Apple sign-in successful from splash screen', 'Auth');

        // Refetch profile to get latest onboarding status
        logDebug('Refetching profile to check onboarding status', 'Auth');
        await refetchProfile();

        // Check if user needs onboarding (profile is updated in context)
        if (profile && !profile.onboarding_completed) {
          logDebug('First-time user detected, redirecting to onboarding', 'Auth');
          router.replace('/onboarding');
        } else {
          logDebug('Returning user, redirecting to dashboard', 'Auth');
          router.replace('/(tabs)/dashboard');
        }
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
        logInfo('Google sign-in successful from splash screen', 'Auth');

        // Refetch profile to get latest onboarding status
        logDebug('Refetching profile to check onboarding status', 'Auth');
        await refetchProfile();

        // Check if user needs onboarding (profile is updated in context)
        if (profile && !profile.onboarding_completed) {
          logDebug('First-time user detected, redirecting to onboarding', 'Auth');
          router.replace('/onboarding');
        } else {
          logDebug('Returning user, redirecting to dashboard', 'Auth');
          router.replace('/(tabs)/dashboard');
        }
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
    <LinearGradient
      colors={['#1B365D', '#6B46C1']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo centered where the tagline used to be */}
        <View style={styles.logoSection}
        >
          <Image
            source={require('../assets/images/stellr.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.buttonSection}>
          {/* Apple Sign In Button - iOS only */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleAppleSignIn}
              activeOpacity={0.8}
              disabled={isAppleLoading || isGoogleLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.socialButtonText}>Sign in with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={isAppleLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.socialButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.privacySection}>
          <Text style={styles.privacyText}>
            By tapping 'Sign in with Apple' or 'Sign in with Google' you agree to our{' '}
            <Text style={styles.privacyLink}>Terms</Text>. Learn how we process your data in our{' '}
            <Text style={styles.privacyLink}>Privacy Policy</Text> and{' '}
            <Text style={styles.privacyLink}>Cookies Policy</Text>.
          </Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: height * 0.08,
    paddingBottom: 50,
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    // Position the logo roughly in the mid area previously used by tagline
    marginTop: height * 0.12,
    marginBottom: height * 0.12,
  },
  logo: {
    width: 200,
    height: 200,
    tintColor: 'white',
  },
  buttonSection: {
    gap: 12,
    marginBottom: height * 0.08,
  },
  socialButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  socialButtonText: {
    fontSize: 17,
    fontFamily: 'Geist-Regular',
    color: '#000',
    letterSpacing: 0.2,
  },
  appleIcon: {
    fontSize: 20,
    color: '#000',
    marginRight: 10,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 10,
  },
  privacySection: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  privacyText: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 19,
    letterSpacing: 0.2,
  },
  privacyLink: {
    fontFamily: 'Geist-Medium',
    textDecorationLine: 'underline',
    color: 'white',
  },
});

export default WelcomeScreen;
