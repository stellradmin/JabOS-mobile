/**
 * usePremium Hook - Clean API for Premium Feature Gating
 *
 * Provides a simple, consistent interface for checking premium status
 * and gating features throughout the app.
 *
 * @example
 * ```tsx
 * const { isPremium, loading, checkFeature } = usePremium();
 *
 * if (!isPremium) {
 *   return <UpgradePrompt feature="Unlimited Likes" />;
 * }
 * ```
 */

import { useSubscription } from '../contexts/SubscriptionContext';
import { logDebug } from '../utils/logger';

/**
 * Premium features available in the app
 * Maps to features listed in PREMIUM_FEATURES.md
 */
export type PremiumFeature =
  | 'unlimited_likes'
  | 'see_who_liked_you'
  | 'advanced_astrology'
  | 'activity_filtering'
  | 'monthly_boost'
  | 'unlimited_rewinds'
  | 'read_receipts'
  | 'ad_free'
  | 'detailed_compatibility';

interface UsePremiumReturn {
  /** Whether user has active premium subscription */
  isPremium: boolean;

  /** Loading state for subscription check */
  loading: boolean;

  /** Error message if subscription check failed */
  error: string | null;

  /**
   * Check if user has access to a specific premium feature
   * @param feature - Feature identifier from PremiumFeature type
   * @returns true if user has premium access
   */
  checkFeature: (feature: PremiumFeature) => boolean;

  /**
   * Refresh subscription status from server
   * Useful after purchase or when user returns to app
   */
  refresh: () => Promise<void>;

  /**
   * Check if user has any form of premium access
   * Same as isPremium but more explicit for conditional logic
   */
  checkAccess: () => boolean;
}

/**
 * Hook for checking premium subscription status and feature access
 *
 * Wraps SubscriptionContext with a cleaner API focused on feature gating.
 * All premium features require an active subscription - no per-feature checks.
 *
 * @returns Premium subscription status and utilities
 */
export function usePremium(): UsePremiumReturn {
  const {
    isActive: isPremium,
    loading,
    error,
    refresh,
    checkAccess,
  } = useSubscription();

  /**
   * Check if user has access to a specific premium feature
   *
   * Currently all premium features are bundled - having premium gives
   * access to all features. Future versions might have tiered access.
   *
   * @param feature - Feature to check (for future tiering)
   * @returns true if user has premium access
   */
  const checkFeature = (feature: PremiumFeature): boolean => {
    logDebug(`Checking premium feature access: ${feature}`, 'usePremium', {
      isPremium,
      feature
    });

    // For now, all features require premium subscription
    // In future, could check feature-specific entitlements
    return isPremium;
  };

  return {
    isPremium,
    loading,
    error,
    checkFeature,
    refresh,
    checkAccess,
  };
}

/**
 * Helper function to get user-friendly feature names
 * Used in upgrade prompts and feature lists
 */
export function getFeatureName(feature: PremiumFeature): string {
  const featureNames: Record<PremiumFeature, string> = {
    unlimited_likes: 'Unlimited Likes',
    see_who_liked_you: 'See Who Liked You',
    advanced_astrology: 'Advanced Astrology Matching',
    activity_filtering: 'Activity Filtering',
    monthly_boost: 'Monthly Profile Boost',
    unlimited_rewinds: 'Unlimited Rewinds',
    read_receipts: 'Read Receipts',
    ad_free: 'Ad-Free Experience',
    detailed_compatibility: 'Detailed Compatibility Insights',
  };

  return featureNames[feature];
}

/**
 * Helper function to get feature descriptions
 * Used in feature lists and upgrade prompts
 */
export function getFeatureDescription(feature: PremiumFeature): string {
  const descriptions: Record<PremiumFeature, string> = {
    unlimited_likes: 'Match with as many people as you want. No daily limits.',
    see_who_liked_you: 'View everyone who has liked your profile before you swipe.',
    advanced_astrology: 'Unlock detailed astrological compatibility insights including Sun, Moon, Rising, Venus, and Mars.',
    activity_filtering: 'Filter potential matches by last active time, online status, and distance.',
    monthly_boost: 'Get your profile shown to more people once per month.',
    unlimited_rewinds: 'Made a mistake? Undo your last swipe as many times as you need.',
    read_receipts: 'See when your matches have read your messages.',
    ad_free: 'Enjoy Stellr without any advertisements or interruptions.',
    detailed_compatibility: 'Access in-depth compatibility reports including personality alignment and relationship potential.',
  };

  return descriptions[feature];
}

export default usePremium;
