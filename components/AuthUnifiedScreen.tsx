import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useAuth } from '../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

type Mode = 'login' | 'signup';

export default function AuthUnifiedScreen({ initialMode = 'login' as Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { isAuthenticated, loading, signInWithEmail } = useAuth();
  const router = useRouter();

  // If user authenticates, go to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleLoginSubmit = async (email: string, password: string) => {
    await signInWithEmail(email, password);
  };

  return (
    <LinearGradient
      colors={["#1B365D", "#6B46C1"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Logo directly on the gradient background */}
      <View style={styles.logoOverlay} pointerEvents="none">
        <Image
          source={require('../assets/images/stellr.png')}
          style={styles.overlayLogo}
          resizeMode="contain"
        />
      </View>

      {/* Spacer so the sheet starts below the logo */}
      <View style={styles.headerSpacer} />

      {/* Full-width bottom sheet card with animated content swapping */}
      <View style={styles.sheetCard}>
        <Animated.View
          style={styles.formContainer}
          key={`auth-${mode}`}
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(160)}
          layout={Layout.springify().duration(280)}
        >
          {mode === 'login' ? (
            <LoginForm hideSignupHint onSubmit={handleLoginSubmit} isLoading={loading} />
          ) : (
            <SignupForm hideSignInHint />
          )}
        </Animated.View>

        {/* Bottom legal + alternate navigation region */}
        <View style={styles.bottomRegion}>
          {mode === 'login' ? (
            <Text style={styles.legalText}>
              By signing in you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text>
              {' '}and{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/terms-of-service')}>Terms of Service</Text>.
            </Text>
          ) : (
            <Text style={styles.legalText}>
              By creating an account you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text>
              {' '}and{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/terms-of-service')}>Terms of Service</Text>.
            </Text>
          )}

          {mode === 'login' ? (
            <TouchableOpacity onPress={() => setMode('signup')} activeOpacity={0.7}>
              <Text style={styles.altNavText}>
                Don’t have an account? <Text style={styles.altNavLink}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setMode('login')} activeOpacity={0.7}>
              <Text style={styles.altNavText}>
                Have an account? <Text style={styles.altNavLink}>Log in here</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSpacer: { height: 240 },
  sheetCard: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  formContainer: {
    flex: 1,
  },
  bottomRegion: { marginTop: 24, paddingHorizontal: 8 },
  legalText: { textAlign: 'center', color: '#4b5563', marginBottom: 20 },
  legalLink: { textDecorationLine: 'underline', color: '#111827', fontWeight: '600' },
  altNavText: { textAlign: 'center', color: '#000000', fontSize: 16, marginTop: 6, marginBottom: 2 },
  altNavLink: { textDecorationLine: 'underline', fontWeight: '700', color: '#000000' },
  logoOverlay: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  overlayLogo: { width: 140, height: 140, tintColor: '#FFFFFF' },
});
