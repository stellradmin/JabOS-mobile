/**
 * SubscriptionBanner Component - Compact premium upgrade banner
 *
 * Replaces match count text to promote premium subscription.
 * Same height as original match count for seamless layout.
 *
 * Usage:
 * ```tsx
 * <SubscriptionBanner
 *   onPress={() => router.push('/paywall')}
 *   onDismiss={() => handleDismiss()}
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SubscriptionBannerProps {
  /** Callback when banner is tapped */
  onPress: () => void;

  /** Callback when dismiss button is tapped */
  onDismiss: () => void;

  /** Custom style overrides */
  style?: ViewStyle;
}

/**
 * Compact subscription banner - same height as match count text
 */
export const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({
  onPress,
  onDismiss,
  style,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.container, style]}
      accessibilityLabel="Upgrade to Premium"
      accessibilityHint="Tap to view premium features"
    >
      <LinearGradient
        colors={['#C8A8E9', '#E9C8E0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Sparkles Icon */}
          <Text style={styles.icon}>✨</Text>

          {/* Banner Text */}
          <Text
            style={styles.text}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Upgrade to Premium - Get unlimited matches & more!
          </Text>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Dismiss banner"
          >
            <X size={14} color="black" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 24, // Match original match count height
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
    flex: 1,
  },
  icon: {
    fontSize: 14,
    lineHeight: 16,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: 'black',
    lineHeight: 16,
    flexShrink: 1,
  },
  dismissButton: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SubscriptionBanner;
