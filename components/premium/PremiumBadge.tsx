/**
 * PremiumBadge Component - Visual indicator for premium features
 *
 * Displays a "Premium" badge with lock icon to indicate locked features.
 * Consistent with Stellr's brutalist design system.
 *
 * Usage:
 * ```tsx
 * <PremiumBadge size="small" />
 * <PremiumBadge size="medium" position="top-right" />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Lock } from 'lucide-react-native';

interface PremiumBadgeProps {
  /** Size variant of the badge */
  size?: 'small' | 'medium' | 'large';

  /** Position when used as overlay */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /** Custom style overrides */
  style?: ViewStyle;

  /** Show lock icon */
  showIcon?: boolean;

  /** Custom background color (default: gradient purple) */
  backgroundColor?: string;
}

/**
 * Premium badge component for feature gating UI
 */
export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  size = 'medium',
  position,
  style,
  showIcon = true,
  backgroundColor = '#C8A8E9', // Purple gradient
}) => {
  const sizeStyles = SIZE_STYLES[size];
  const positionStyles = position ? POSITION_STYLES[position] : {};

  return (
    <View
      style={[
        styles.badge,
        sizeStyles.container,
        { backgroundColor },
        positionStyles,
        style,
      ]}
      accessibilityLabel="Premium feature"
      accessibilityHint="This feature requires a premium subscription"
    >
      {showIcon && (
        <Lock
          size={sizeStyles.iconSize}
          color="black"
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, sizeStyles.text]}>Premium</Text>
    </View>
  );
};

/**
 * Size-specific styles
 */
const SIZE_STYLES = {
  small: {
    container: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      gap: 3,
    },
    iconSize: 10,
    text: {
      fontSize: 10,
      lineHeight: 12,
    },
  },
  medium: {
    container: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 4,
    },
    iconSize: 12,
    text: {
      fontSize: 12,
      lineHeight: 14,
    },
  },
  large: {
    container: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
    },
    iconSize: 14,
    text: {
      fontSize: 14,
      lineHeight: 16,
    },
  },
};

/**
 * Position styles for overlay badges
 */
const POSITION_STYLES = {
  'top-left': {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    zIndex: 10,
  },
  'top-right': {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    zIndex: 10,
  },
  'bottom-left': {
    position: 'absolute' as const,
    bottom: 8,
    left: 8,
    zIndex: 10,
  },
  'bottom-right': {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  icon: {
    marginRight: 2,
  },
  text: {
    fontFamily: 'Geist-Medium',
    color: 'black',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default PremiumBadge;
