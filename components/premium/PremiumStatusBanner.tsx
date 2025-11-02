/**
 * PremiumStatusBanner Component - Premium subscription active indicator
 *
 * Displays when premium users have 0 matches.
 * Same height as original match count for seamless layout.
 *
 * Usage:
 * ```tsx
 * <PremiumStatusBanner />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Crown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface PremiumStatusBannerProps {
  /** Custom style overrides */
  style?: ViewStyle;
}

/**
 * Compact premium status indicator - same height as match count text
 */
export const PremiumStatusBanner: React.FC<PremiumStatusBannerProps> = ({
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={['#8B5CF6', '#A78BFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Crown Icon */}
          <Crown size={14} color="black" strokeWidth={2} />

          {/* Status Text */}
          <Text style={styles.text}>
            Premium Active
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 24, // Match original match count height
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Geist-Medium',
    color: 'black',
    lineHeight: 16,
  },
});

export default PremiumStatusBanner;
