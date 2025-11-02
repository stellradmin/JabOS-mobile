/**
 * Paywall Screen - Standalone premium subscription screen
 *
 * Displays premium features, pricing tiers, and handles subscription purchases.
 * Accessible from dashboard, profile, and gated features.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Crown, Check, Sparkles } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { PaymentService } from '../src/services/payments-service';
import { usePremium } from '../src/hooks/usePremium';
import { logError, logInfo, logUserAction } from '../src/utils/logger';

export const options = {
  headerShown: false,
};

export default function PaywallScreen() {
  const router = useRouter();
  const { isPremium, loading: premiumLoading, refresh } = usePremium();
  const [purchasing, setPurchasing] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  // Load available offerings on mount
  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      setLoadingOfferings(true);
      const result = await PaymentService.getOfferings();

      if (result.success && result.offerings) {
        setOfferings(result);
        logInfo('Offerings loaded successfully', 'Paywall', { offerings: result.offerings });
      } else {
        logError('Failed to load offerings', 'Error', result.error || 'Unknown error');
        Alert.alert('Error', 'Failed to load subscription options. Please try again.');
      }
    } catch (error) {
      logError('Error loading offerings', 'Error', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoadingOfferings(false);
    }
  };

  const handlePurchase = async () => {
    if (!offerings || purchasing) return;

    try {
      setPurchasing(true);
      logUserAction('purchase_initiated', 'Paywall', { plan: 'monthly' });

      // Get the monthly package
      const packages = offerings.packages || [];
      const selectedPackage = packages.find((pkg: any) =>
        pkg.identifier === '$rc_monthly' || pkg.identifier === 'monthly'
      );

      if (!selectedPackage) {
        throw new Error('Monthly subscription package not found');
      }

      const result = await PaymentService.purchasePackage(selectedPackage);

      if (result.success) {
        logUserAction('purchase_completed', 'Paywall', {
          plan: 'monthly',
          productIdentifier: result.productIdentifier
        });

        // Refresh premium status
        await refresh();

        Alert.alert(
          'Welcome to Premium!',
          'Your subscription is now active. Enjoy all premium features!',
          [
            {
              text: 'Continue',
              onPress: () => router.back(),
            },
          ]
        );
      } else if (result.error?.includes('cancelled')) {
        logInfo('Purchase cancelled by user', 'Paywall');
      } else {
        throw new Error(result.error || 'Purchase failed');
      }
    } catch (error: any) {
      logError('Purchase error', 'Error', error);
      Alert.alert(
        'Purchase Failed',
        error.message || 'Unable to complete purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };


  // Redirect if already premium
  useEffect(() => {
    if (isPremium && !premiumLoading) {
      Alert.alert(
        'Already Premium',
        'You already have an active premium subscription!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [isPremium, premiumLoading]);

  if (premiumLoading || loadingOfferings) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#C8A8E9" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Crown size={24} color="#C8A8E9" />
          <Text style={styles.headerTitle}>Stellr Premium</Text>
          <Sparkles size={20} color="#C8A8E9" />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Get More Swipes</Text>
          <Text style={styles.heroSubtitle}>
            Upgrade to get 20 swipes daily instead of 5
          </Text>
        </View>

        {/* Premium Feature */}
        <View style={styles.featuresSection}>
          <View style={styles.simpleFeatureBox}>
            <View style={styles.featureRow}>
              <Check size={20} color={COLORS.DARK_TEXT} />
              <Text style={styles.simpleFeatureText}>20 swipes daily</Text>
            </View>
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <View style={styles.simplePricingCard}>
            <Text style={styles.priceAmount}>$9.99/month</Text>
            <Text style={styles.priceSubtext}>Cancel anytime</Text>
          </View>
        </View>

        {/* Purchase Button */}
        <TouchableOpacity
          style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={purchasing}
          activeOpacity={0.8}
        >
          {purchasing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              Subscribe Now
            </Text>
          )}
        </TouchableOpacity>

        {/* Terms */}
        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            By subscribing you agree to our Terms and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: 'Geist-Medium',
    color: 'black',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Medium',
    color: 'black',
    marginBottom: 20,
  },
  pricingSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  pricingCard: {
    marginBottom: 16,
  },
  purchaseButton: {
    backgroundColor: COLORS.BLACK_CARD,
    borderRadius: 16,
    paddingVertical: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontSize: 17,
    fontFamily: 'Geist-Medium',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  legalSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  legalText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 18,
  },
  simpleFeatureBox: {
    backgroundColor: '#D4E4FF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY_BLACK,
    padding: 20,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simpleFeatureText: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginLeft: 12,
  },
  simplePricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY_BLACK,
    padding: 20,
    marginBottom: 16,
  },
  priceAmount: {
    fontSize: 20,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 4,
  },
  priceSubtext: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
});
