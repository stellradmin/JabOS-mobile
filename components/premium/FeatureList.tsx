/**
 * FeatureList Component - Display premium features list
 *
 * Shows all premium features with icons and descriptions.
 * Can be displayed as a full list or compact version.
 *
 * Usage:
 * ```tsx
 * <FeatureList variant="full" />
 * <FeatureList variant="compact" maxItems={5} />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import {
  Heart,
  Eye,
  Stars,
  Filter,
  TrendingUp,
  RotateCcw,
  CheckCheck,
  XCircle,
  BarChart,
} from 'lucide-react-native';

interface PremiumFeature {
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  description: string;
}

interface FeatureListProps {
  /** Display variant */
  variant?: 'full' | 'compact';

  /** Maximum items to show (compact mode) */
  maxItems?: number;

  /** Custom style overrides */
  style?: ViewStyle;

  /** Show feature descriptions */
  showDescriptions?: boolean;
}

/**
 * Premium features data from PREMIUM_FEATURES.md
 */
const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: Heart,
    title: 'Unlimited Likes',
    description: 'Match with as many people as you want. No daily limits on likes.',
  },
  {
    icon: Eye,
    title: 'See Who Liked You',
    description: 'View everyone who has liked your profile before you swipe.',
  },
  {
    icon: Stars,
    title: 'Advanced Astrology Matching',
    description: 'Sun, Moon, Rising compatibility, Venus & Mars dynamics, Synastry charts.',
  },
  {
    icon: Filter,
    title: 'Activity Filtering',
    description: 'Filter by last active time, online status, response rate, distance.',
  },
  {
    icon: TrendingUp,
    title: 'Monthly Profile Boost',
    description: 'Get your profile shown to more people. Increase visibility and matches.',
  },
  {
    icon: RotateCcw,
    title: 'Unlimited Rewinds',
    description: "Made a mistake? Undo your last swipe as many times as you need.",
  },
  {
    icon: CheckCheck,
    title: 'Read Receipts',
    description: 'See when your matches have read your messages. Know when to follow up.',
  },
  {
    icon: XCircle,
    title: 'Ad-Free Experience',
    description: 'Enjoy Stellr without any advertisements or interruptions.',
  },
  {
    icon: BarChart,
    title: 'Detailed Compatibility Insights',
    description: 'Personality alignment, communication styles, long-term potential.',
  },
];

/**
 * Feature list component for premium features
 */
export const FeatureList: React.FC<FeatureListProps> = ({
  variant = 'full',
  maxItems,
  style,
  showDescriptions = true,
}) => {
  const features = maxItems ? PREMIUM_FEATURES.slice(0, maxItems) : PREMIUM_FEATURES;
  const isCompact = variant === 'compact';

  return (
    <View style={[styles.container, style]}>
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <View
            key={index}
            style={[
              styles.featureRow,
              isCompact && styles.featureRowCompact,
            ]}
          >
            <View style={styles.iconContainer}>
              <Icon size={isCompact ? 20 : 24} color="#C8A8E9" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, isCompact && styles.featureTitleCompact]}>
                {feature.title}
              </Text>
              {showDescriptions && !isCompact && (
                <Text style={styles.featureDescription}>{feature.description}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureRowCompact: {
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F9F5FF',
    borderWidth: 2,
    borderColor: '#C8A8E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: 'black',
    lineHeight: 22,
  },
  featureTitleCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default FeatureList;
