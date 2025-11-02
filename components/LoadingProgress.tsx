import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

interface LoadingProgressProps {
  message?: string;
  subMessage?: string;
}

export default function LoadingProgress({ 
  message = "Finding Potential Matches", 
  subMessage = "Searching for compatible profiles..." 
}: LoadingProgressProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous rotation animation
    const spin = () => {
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start(() => spin());
    };

    // Pulse animation
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };

    spin();
    pulse();
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.loadingContent}>
        {/* Animated loading circle */}
        <Animated.View 
          style={[
            styles.loadingCircle,
            { 
              transform: [
                { rotate: spin },
                { scale: pulseValue }
              ] 
            }
          ]}
        >
          <View style={styles.innerCircle} />
        </Animated.View>

        {/* Loading text */}
        <Text style={styles.loadingMessage}>{message}</Text>
        <Text style={styles.loadingSubMessage}>{subMessage}</Text>

        {/* Loading dots animation */}
        <View style={styles.dotsContainer}>
          <LoadingDots />
        </View>
      </View>
    </View>
  );
}

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDots = () => {
      const duration = 600;
      const delay = 200;

      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0.3, duration, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration, useNativeDriver: true }),
        ]).start();
      }, delay);

      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration, useNativeDriver: true }),
        ]).start(() => animateDots());
      }, delay * 2);
    };

    animateDots();
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dots}>
      <Animated.View style={[styles.dot, { opacity: dot1 }]} />
      <Animated.View style={[styles.dot, { opacity: dot2 }]} />
      <Animated.View style={[styles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    minHeight: 300,
  },
  loadingContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#C8A8E9",
    borderTopColor: "transparent",
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(200, 168, 233, 0.2)",
  },
  loadingMessage: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: "black",
    textAlign: "center",
    marginBottom: 8,
  },
  loadingSubMessage: {
    fontSize: 16,
    color: "black",
    opacity: 0.7,
    textAlign: "center",
    marginBottom: 24,
  },
  dotsContainer: {
    marginTop: 16,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C8A8E9",
    marginHorizontal: 4,
  },
});