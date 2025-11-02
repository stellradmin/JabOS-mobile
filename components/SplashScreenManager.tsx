import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import FallbackSplashScreen from './FallbackSplashScreen';
import { hideSplashScreen } from '../src/utils/splashScreen';

interface SplashScreenManagerProps {
  onFinish: () => void;
  isAuthLoading?: boolean;
  isAppReady?: boolean;
}

const SplashScreenManager: React.FC<SplashScreenManagerProps> = ({
  onFinish,
  isAuthLoading = false,
  isAppReady = false,
}) => {
  const [showSplash, setShowSplash] = useState(true);
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);
  const watchdogRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Ensure splash shows briefly for UX, but not too long in dev
    const minTimer = setTimeout(() => setMinimumTimeElapsed(true), 1200);
    // Hard watchdog: always finish within 10s regardless of flags
    watchdogRef.current = setTimeout(() => {
      if (showSplash) {
        handleSplashFinish();
        setShowSplash(false);
      }
    }, 10000);

    return () => {
      clearTimeout(minTimer);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, [showSplash]);

  useEffect(() => {
    // Only hide splash screen when:
    // 1. Minimum time has elapsed
    // 2. App is ready (auth loaded, resources loaded, etc.)
    // 3. Auth is not loading
    if (minimumTimeElapsed && isAppReady && !isAuthLoading) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        handleSplashFinish();
      }, 400); // Small delay for smooth transition

      return () => clearTimeout(timer);
    }
  }, [minimumTimeElapsed, isAppReady, isAuthLoading]);

  const handleSplashFinish = async () => {
    await hideSplashScreen();
    onFinish();
  };

  if (!showSplash) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FallbackSplashScreen onFinish={handleSplashFinish} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});

export default SplashScreenManager;
