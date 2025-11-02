/**
 * PaywallModal Component for Stellr Premium
 *
 * Clean, simplified design matching app aesthetic
 * Integrates with RevenueCat for in-app purchases
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { getOfferings, purchasePackage, isMockMode } from '../src/services/payments-service';
import { syncSubscriptionStatus } from '../src/services/invite-manager';
import { useAuth } from '../src/contexts/AuthContext';
import { logError, logInfo } from '../src/utils/logger';
import { analytics } from '../src/services/telemetry/analytics';
import { COLORS } from '../constants/theme';
import PremiumComingSoonModal from './premium/PremiumComingSoonModal';

export type PaywallTrigger =
  | 'exhausted_invites'
  | 'see_who_likes'
  | 'advanced_filters'
  | 'profile_view';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => Promise<void>; // Called after successful purchase
  trigger: PaywallTrigger;
  remainingInvites?: number;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  onSuccess,
  trigger,
  remainingInvites = 0,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const isBeta = process.env.EXPO_PUBLIC_IS_BETA === 'true';

  useEffect(() => {
    if (visible) {
      loadOfferings();
      setErrorMessage(null);

      // Track paywall impression
      analytics.capture('paywall_shown', {
        trigger,
        remaining_invites: remainingInvites,
        user_id: user?.id,
        timestamp: new Date().toISOString(),
      });
    }
  }, [visible, trigger, remainingInvites, user?.id]);

  const loadOfferings = async () => {
    setLoading(true);
    try {
      const result = await getOfferings();
      if (result.success && result.offerings) {
        setOfferings(result.offerings);
      } else {
        setErrorMessage('Unable to load subscription options. Please try again.');
      }
    } catch (error) {
      logError('Error loading offerings:', "Error", error);
      setErrorMessage('Failed to load subscription options.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!offerings || !user?.id) {
      setErrorMessage('Cannot complete purchase at this time.');
      return;
    }

    // In beta mode, show "Coming Soon" modal instead of processing purchase
    if (isBeta) {
      analytics.capture('paywall_beta_purchase_attempted', {
        trigger,
        user_id: user.id,
        is_mock_mode: isMockMode(),
      });
      setShowComingSoon(true);
      return;
    }

    setPurchaseInProgress(true);
    setErrorMessage(null);

    try {
      // Find the monthly package
      const monthlyPackage = offerings.availablePackages.find(
        (pkg: any) => pkg.identifier === 'monthly' || pkg.identifier === '$rc_monthly'
      );

      if (!monthlyPackage) {
        throw new Error('Monthly subscription package not found');
      }

      // Track purchase initiation
      analytics.capture('purchase_started', {
        trigger,
        package: monthlyPackage.identifier,
        product_id: monthlyPackage.product.identifier,
        user_id: user.id,
      });

      logInfo('Initiating purchase', "Info", {
        packageId: monthlyPackage.identifier,
        userId: user.id,
      });

      // Make the purchase
      const result = await purchasePackage(monthlyPackage);

      if (result.success) {
        // Sync subscription status to backend
        await syncSubscriptionStatus(user.id);

        logInfo('Purchase successful', "Info", {
          userId: user.id,
          hasPremium: result.hasPremium,
        });

        // Track successful purchase
        analytics.capture('purchase_completed', {
          trigger,
          package: monthlyPackage.identifier,
          product_id: result.productIdentifier,
          user_id: user.id,
        });

        // Call success callback if provided (e.g., refresh invite counts)
        if (onSuccess) {
          await onSuccess();
        }

        // Success - close modal
        onClose();
      } else if (!result.userCancelled) {
        // Track purchase failure
        analytics.capture('purchase_failed', {
          trigger,
          package: monthlyPackage.identifier,
          error: result.error,
          user_id: user.id,
        });
        setErrorMessage(result.error || 'Purchase failed. Please try again.');
      } else {
        // Track user cancellation
        analytics.capture('purchase_cancelled', {
          trigger,
          package: monthlyPackage.identifier,
          user_id: user.id,
        });
      }
    } catch (error: any) {
      logError('Purchase failed:', "Error", error);

      // Track purchase error
      analytics.capture('purchase_error', {
        trigger,
        error: error.message,
        user_id: user.id,
      });

      setErrorMessage(error.message || 'An error occurred during purchase.');
    } finally {
      setPurchaseInProgress(false);
    }
  };

  // Track paywall dismissal
  const handleClose = () => {
    analytics.capture('paywall_dismissed', {
      trigger,
      remaining_invites: remainingInvites,
      user_id: user?.id,
    });
    onClose();
  };

  const getHeadlineText = (): string => {
    return "Get More Swipes";
  };

  const getSubheadlineText = (): string => {
    return "Upgrade to get 20 swipes daily instead of 5";
  };

  // Helper function to get feature name based on trigger
  const getFeatureNameForTrigger = (trigger: PaywallTrigger): string => {
    switch (trigger) {
      case 'exhausted_invites':
        return 'unlimited daily swipes';
      case 'see_who_likes':
        return 'see who likes you';
      case 'advanced_filters':
        return 'advanced filters';
      case 'profile_view':
        return 'unlimited profile views';
      default:
        return 'premium features';
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={handleClose}>
            <X size={24} color={COLORS.DARK_TEXT} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headline}>{getHeadlineText()}</Text>
              <Text style={styles.subheadline}>{getSubheadlineText()}</Text>
            </View>

            {/* Features Box */}
            <View style={styles.featuresBox}>
              <FeatureRow text="20 swipes daily" />
            </View>

            {/* Pricing */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY_BLACK} />
              </View>
            ) : errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadOfferings}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Monthly Subscription */}
                <View style={styles.pricingCard}>
                  <Text style={styles.pricingAmount}>$9.99/month</Text>
                  <Text style={styles.pricingTotal}>Cancel anytime</Text>
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                  style={[
                    styles.ctaButton,
                    purchaseInProgress && styles.ctaButtonDisabled,
                  ]}
                  onPress={handlePurchase}
                  disabled={purchaseInProgress}
                >
                  {purchaseInProgress ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.ctaButtonText}>Subscribe Now</Text>
                  )}
                </TouchableOpacity>

                {/* Terms */}
                <Text style={styles.termsText}>
                  By subscribing you agree to our Terms and Privacy Policy
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Premium Coming Soon Modal (Beta Mode) */}
    <PremiumComingSoonModal
      visible={showComingSoon}
      onClose={() => setShowComingSoon(false)}
      feature={getFeatureNameForTrigger(trigger)}
    />
  </>
  );
};

// Feature Row Component
interface FeatureRowProps {
  text: string;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ text }) => (
  <View style={styles.featureRow}>
    <Check size={20} color={COLORS.DARK_TEXT} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    maxHeight: '90%',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    marginBottom: 24,
  },
  headline: {
    fontSize: 28,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
  },
  featuresBox: {
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
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginLeft: 12,
  },
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY_BLACK,
    padding: 20,
    marginBottom: 16,
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingDuration: {
    fontSize: 18,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  bestValueBadge: {
    backgroundColor: '#FFB3D9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    fontSize: 11,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    letterSpacing: 0.5,
  },
  pricingAmount: {
    fontSize: 20,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 4,
  },
  pricingTotal: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  ctaButton: {
    backgroundColor: COLORS.BLACK_CARD,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    fontSize: 17,
    fontFamily: 'Geist-Medium',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  termsText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.BLACK_CARD,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-Medium',
    color: '#FFFFFF',
  },
});

export default PaywallModal;
