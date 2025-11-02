/**
 * PricingCard Component - Display subscription pricing tiers
 *
 * Shows monthly or annual subscription pricing with features,
 * savings badge, and selection state.
 *
 * Usage:
 * ```tsx
 * <PricingCard
 *   plan="annual"
 *   price="$99.99"
 *   period="year"
 *   features={['Unlimited Likes', 'See Who Liked You']}
 *   savings="Save 33%"
 *   isPopular
 *   isSelected={selectedPlan === 'annual'}
 *   onSelect={() => setSelectedPlan('annual')}
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';

interface PricingCardProps {
  /** Plan type identifier */
  plan: 'monthly' | 'annual';

  /** Price string (e.g., "$14.99") */
  price: string;

  /** Billing period (e.g., "month", "year") */
  period: string;

  /** Optional features list */
  features?: string[];

  /** Optional savings text (e.g., "Save 33%") */
  savings?: string;

  /** Mark as popular/recommended */
  isPopular?: boolean;

  /** Selected state */
  isSelected?: boolean;

  /** Selection callback */
  onSelect: () => void;

  /** Custom style overrides */
  style?: ViewStyle;
}

/**
 * Pricing card component for subscription plans
 */
export const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  price,
  period,
  features = [],
  savings,
  isPopular = false,
  isSelected = false,
  onSelect,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.containerSelected,
        isPopular && styles.containerPopular,
        style,
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${plan} plan: ${price} per ${period}${savings ? `, ${savings}` : ''}`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}

      {/* Selection Indicator */}
      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
        {isSelected && <View style={styles.radioInner} />}
      </View>

      {/* Plan Header */}
      <View style={[styles.header, isPopular && { marginTop: 8 }]}>
        <Text style={styles.planName}>{plan === 'monthly' ? 'Monthly' : 'Annual'}</Text>
        {savings && <View style={styles.savingsBadge}>
          <Text style={styles.savingsText}>{savings}</Text>
        </View>}
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.period}>/{period}</Text>
      </View>

      {/* Features List */}
      {features.length > 0 && (
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={16} color="#10B981" style={styles.checkIcon} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 20,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  containerSelected: {
    borderColor: '#C8A8E9',
    borderWidth: 3,
    backgroundColor: '#F9F5FF',
    elevation: 6,
  },
  containerPopular: {
    borderColor: '#C8A8E9',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: [{ translateX: -60 }],
    backgroundColor: '#C8A8E9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'black',
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 10,
  },
  popularText: {
    fontSize: 10,
    fontFamily: 'Geist-Medium',
    color: 'black',
    letterSpacing: 1,
  },
  radioCircle: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  radioCircleSelected: {
    borderColor: '#C8A8E9',
    borderWidth: 3,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C8A8E9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
  savingsBadge: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savingsText: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: 'white',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  price: {
    fontSize: 36,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
  period: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  featuresContainer: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    marginTop: 2,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#374151',
    flex: 1,
  },
});

export default PricingCard;
