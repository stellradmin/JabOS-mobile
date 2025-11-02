/**
 * Subscription Management Screen - Manage premium subscription
 *
 * Allows premium users to:
 * - View subscription details
 * - Cancel subscription
 * - Restore purchases
 * - View transaction history
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Crown, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { PaymentService } from '../src/services/payments-service';
import { usePremium } from '../src/hooks/usePremium';
import PremiumBadge from '../components/premium/PremiumBadge';
import { logError, logInfo, logUserAction } from '../src/utils/logger';
import { useAuth } from '../src/contexts/AuthContext';
import { getTransactionHistory } from '../src/services/secure-payment-service';

export default function SubscriptionManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, loading: premiumLoading, refresh } = usePremium();
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);

      // Load customer info from RevenueCat
      const customerResult = await PaymentService.getCustomerInfo();
      if (customerResult.success && customerResult.customerInfo) {
        setCustomerInfo(customerResult.customerInfo);
      }

      // Load transaction history
      if (user?.id) {
        try {
          const history = await getTransactionHistory(user.id);
          setTransactions(history || []);
        } catch (error) {
          logError('Failed to load transaction history', 'Error', error);
        }
      }
    } catch (error) {
      logError('Error loading subscription data', 'Error', error);
      Alert.alert('Error', 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'This will open your subscription settings where you can manage or cancel your subscription.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Manage Subscription',
          onPress: async () => {
            try {
              logUserAction('cancel_subscription_initiated', 'SubscriptionManagement');

              const result = await PaymentService.cancelSubscription();

              if (result.success && result.managementURL) {
                await Linking.openURL(result.managementURL);
              } else {
                Alert.alert(
                  'Manual Cancellation Required',
                  'Please cancel your subscription through your device settings:\n\n' +
                  'iOS: Settings → Apple ID → Subscriptions → Stellr\n' +
                  'Android: Play Store → Subscriptions → Stellr'
                );
              }
            } catch (error: any) {
              logError('Cancel subscription error', 'Error', error);
              Alert.alert('Error', 'Unable to open subscription management');
            }
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    try {
      logUserAction('restore_purchases_initiated', 'SubscriptionManagement');

      const result = await PaymentService.restorePurchases();

      if (result.success) {
        await refresh();
        await loadSubscriptionData();
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any purchases to restore.');
      }
    } catch (error: any) {
      logError('Restore error', 'Error', error);
      Alert.alert('Error', 'Failed to restore purchases');
    }
  };

  // Redirect if not premium
  useEffect(() => {
    if (!isPremium && !premiumLoading && !loading) {
      Alert.alert(
        'No Active Subscription',
        'You don\'t have an active premium subscription.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [isPremium, premiumLoading, loading]);

  if (premiumLoading || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#C8A8E9" />
        <Text style={styles.loadingText}>Loading subscription details...</Text>
      </SafeAreaView>
    );
  }

  const hasActivePremium = customerInfo?.entitlements?.active?.premium;
  const productIdentifier = hasActivePremium?.productIdentifier || 'N/A';
  const expirationDate = hasActivePremium?.expirationDate;

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
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Crown size={32} color="#C8A8E9" />
            <PremiumBadge size="medium" />
          </View>
          <Text style={styles.statusTitle}>Premium Active</Text>
          <Text style={styles.statusSubtitle}>
            You have full access to all premium features
          </Text>
        </View>

        {/* Plan Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Details</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plan Type</Text>
              <Text style={styles.detailValue}>
                Monthly Premium
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>
                $9.99/month
              </Text>
            </View>
            {expirationDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Renews</Text>
                <Text style={styles.detailValue}>
                  {new Date(expirationDate).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <View style={styles.transactionsList}>
              {transactions.slice(0, 5).map((transaction, index) => (
                <View key={transaction.id || index} style={styles.transactionRow}>
                  <View style={styles.transactionIcon}>
                    {transaction.status === 'succeeded' ? (
                      <CheckCircle size={20} color="#10B981" />
                    ) : (
                      <AlertCircle size={20} color="#EF4444" />
                    )}
                  </View>
                  <View style={styles.transactionContent}>
                    <Text style={styles.transactionText}>
                      {transaction.type === 'subscription_payment' ? 'Subscription Payment' : transaction.type}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>
                    ${transaction.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRestorePurchases}
          >
            <Text style={styles.actionButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleCancelSubscription}
          >
            <ExternalLink size={18} color={COLORS.DARK_TEXT} />
            <Text style={styles.actionButtonTextSecondary}>Manage Subscription</Text>
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            Your subscription is managed through {PaymentService.isMockMode() ? 'the App Store or Google Play' : 'RevenueCat'}.
            To cancel, use your device's subscription settings or the button above.
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
  statusCard: {
    backgroundColor: '#F9F5FF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#C8A8E9',
    padding: 24,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Medium',
    color: 'black',
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Medium',
    color: 'black',
    marginBottom: 12,
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 15,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
  transactionsList: {
    gap: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionContent: {
    flex: 1,
  },
  transactionText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: 'black',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#9CA3AF',
  },
  transactionAmount: {
    fontSize: 15,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8A8E9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'black',
    borderBottomWidth: 4,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: 'white',
    borderBottomWidth: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  helpSection: {
    paddingHorizontal: 32,
    marginTop: 8,
  },
  helpText: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
