import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

interface FallbackSplashScreenProps {
  onFinish: () => void;
}

const FallbackSplashScreen: React.FC<FallbackSplashScreenProps> = ({ onFinish }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    const startAnimations = async () => {
      try {
        // Hide the native splash screen
        await SplashScreen.hideAsync();

        if (!mounted) return;

        // Logo fade in
        const logoFadeIn = Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        });

        // Pulse animation with smoother timing
        const pulseAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.08,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
          ])
        );

        // Start animations
        logoFadeIn.start();
        pulseAnimation.start();

        // Auto-hide after 8.5 seconds
        const timer = setTimeout(() => {
          if (!mounted) return;
          
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }).start(() => {
            if (mounted) {
              onFinish();
            }
          });
        }, 8500);

        return () => {
          clearTimeout(timer);
        };
      } catch (error) {
        logWarn('Fallback splash screen animation error:', "Warning", error);
        if (mounted) {
          onFinish();
        }
      }
    };

    startAnimations();

    return () => {
      mounted = false;
    };
  }, [onFinish, logoOpacity, pulseAnim, splashOpacity]);

  return (
    <Animated.View style={[styles.container, { opacity: splashOpacity }]}>
      <View style={styles.background}>
        <View style={styles.contentContainer}>
          <Animated.View 
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: pulseAnim }],
              }
            ]}
          >
            <Image
              source={require('../assets/images/stellr.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  background: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logo: {
    width: 224, // 30% smaller: 320 * 0.7 = 224
    height: 224,
    tintColor: 'white',
  },
});

export default FallbackSplashScreen;