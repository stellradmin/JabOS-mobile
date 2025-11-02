/**
 * UpgradePrompt Component - CTA for Premium Features
 *
 * Shows upgrade message when users try to access premium features.
 * Can be displayed inline or as a blocking overlay.
 *
 * Usage:
 * ```tsx
 * <UpgradePrompt
 *   feature="Unlimited Likes"
 *   description="Match with as many people as you want"
 *   onUpgrade={() => router.push('/paywall')}
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import PremiumBadge from './PremiumBadge';

interface UpgradePromptProps {
  /** Feature name being gated */
  feature: string;

  /** Optional description of the feature */
  description?: string;

  /** Callback when upgrade button is pressed */
  onUpgrade: () => void;

  /** Display variant */
  variant?: 'inline' | 'card' | 'overlay';

  /** Custom button text */
  buttonText?: string;

  /** Custom style overrides */
  style?: ViewStyle;

  /** Show sparkle icon */
  showIcon?: boolean;
}

/**
 * Upgrade prompt component for premium feature gates
 */
export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  description,
  onUpgrade,
  variant = 'card',
  buttonText = 'Upgrade to Premium',
  style,
  showIcon = true,
}) => {
  const containerStyles = VARIANT_STYLES[variant];

  return (
    <View
      style={[styles.container, containerStyles.container, style]}
      accessibilityLabel={`Premium feature locked: ${feature}`}
      accessibilityHint="Tap to upgrade and unlock this feature"
    >
      {/* Premium Badge */}
      <PremiumBadge size="small" />

      {/* Feature Information */}
      <View style={styles.content}>
        <View style={styles.header}>
          {showIcon && (
            <Sparkles size={20} color="#C8A8E9" style={styles.sparkles} />
          )}
          <Text style={styles.featureName}>{feature}</Text>
        </View>

        {description && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>

      {/* Upgrade Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={onUpgrade}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={buttonText}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Variant-specific container styles
 */
const VARIANT_STYLES = {
  inline: {
    container: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: '#F3F4F6',
    },
  },
  card: {
    container: {
      padding: 20,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'black',
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  overlay: {
    container: {
      padding: 24,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'black',
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
      maxWidth: 320,
      alignSelf: 'center',
    },
  },
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sparkles: {
    marginRight: 4,
  },
  featureName: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: 'black',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    width: '100%',
    backgroundColor: '#C8A8E9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'black',
    borderBottomWidth: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: 'black',
    letterSpacing: 0.5,
  },
});

export default UpgradePrompt;
