// RevenueCat service implementation for Stellr Dating App
import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug } from "../utils/logger";

let isRevenueCatInitialized = false;

/**
 * Initialize RevenueCat SDK
 *
 * Must be called before any other RevenueCat functions
 * Configure API keys in environment variables
 */
export const initializeRevenueCat = async (): Promise<boolean> => {
  try {
    // Only initialize on native platforms
    if (Platform.OS === 'web') {
      logWarn('RevenueCat initialization skipped on web platform', "Warning");
      return false;
    }

    // Get platform-specific API key
    const apiKey = Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    });

    if (!apiKey) {
      logError('RevenueCat API key not found in environment variables', "Error");
      return false;
    }

    // Validate API key format: iOS keys start with 'appl_', Android with 'goog_'
    const isValidFormat = apiKey.startsWith('appl_') || apiKey.startsWith('goog_');
    if (!isValidFormat) {
      logError('Invalid RevenueCat API key format. Expected iOS (appl_*) or Android (goog_*) key', "Error");
      return false;
    }

    // Get user ID from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logError('Cannot initialize RevenueCat: User not authenticated', "Error");
      return false;
    }

    // Configure RevenueCat with user ID
    await Purchases.configure({
      apiKey,
      appUserID: user.id, // Use Supabase user ID as RevenueCat app user ID
    });

    // Set debug logging in development
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    isRevenueCatInitialized = true;
    logDebug('✅ RevenueCat initialized successfully', "Debug", { userId: user.id, platform: Platform.OS });
    return true;
  } catch (error) {
    logError('Failed to initialize RevenueCat:', "Error", error);
    isRevenueCatInitialized = false;
    return false;
  }
};

/**
 * Get available offerings (subscription packages)
 *
 * Returns packages configured in RevenueCat dashboard
 */
export const getOfferings = async () => {
  try {
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    const offerings = await Purchases.getOfferings();

    if (offerings.current === null || offerings.current.availablePackages.length === 0) {
      logWarn('No offerings available from RevenueCat', "Warning");
      return { success: false, offerings: null };
    }

    logDebug('RevenueCat offerings loaded:', "Debug", {
      currentOffering: offerings.current.identifier,
      packageCount: offerings.current.availablePackages.length
    });

    return {
      success: true,
      offerings: offerings.current,
      packages: offerings.current.availablePackages
    };
  } catch (error) {
    logError('Failed to get RevenueCat offerings:', "Error", error);
    return { success: false, error: error.message || 'Failed to load offerings' };
  }
};

/**
 * Purchase a subscription package
 *
 * @param packageToPurchase - RevenueCat package object from getOfferings()
 */
export const purchasePackage = async (packageToPurchase: PurchasesPackage) => {
  try {
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    logDebug('Initiating RevenueCat purchase:', "Debug", {
      packageId: packageToPurchase.identifier,
      productId: packageToPurchase.product.identifier
    });

    // Make the purchase
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);

    // Check if user now has premium entitlement
    const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;

    logInfo('RevenueCat purchase successful:', "Info", {
      productId: productIdentifier,
      hasPremium,
      activeEntitlements: Object.keys(customerInfo.entitlements.active)
    });

    return {
      success: true,
      customerInfo,
      productIdentifier,
      hasPremium
    };
  } catch (error: any) {
    // Handle user cancellation
    if (error.userCancelled) {
      logDebug('Purchase cancelled by user', "Debug");
      return {
        success: false,
        userCancelled: true,
        error: 'Purchase cancelled'
      };
    }

    logError('RevenueCat purchase failed:', "Error", error);
    return {
      success: false,
      error: error.message || 'Purchase failed'
    };
  }
};

/**
 * Restore previous purchases
 *
 * Essential for users who:
 * - Switch devices
 * - Reinstall the app
 * - Sign in on a new device
 */
export const restorePurchases = async () => {
  try {
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    logDebug('Restoring RevenueCat purchases...', "Debug");

    const customerInfo = await Purchases.restorePurchases();

    const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
    const activeSubscriptions = Object.keys(customerInfo.entitlements.active);

    logInfo('RevenueCat purchases restored:', "Info", {
      hasPremium,
      activeEntitlements: activeSubscriptions
    });

    return {
      success: true,
      customerInfo,
      hasPremium,
      activeEntitlements: activeSubscriptions
    };
  } catch (error) {
    logError('Failed to restore RevenueCat purchases:', "Error", error);
    return {
      success: false,
      error: error.message || 'Restore failed'
    };
  }
};

/**
 * Get current customer info (cached)
 *
 * Returns cached subscription status - fast but may be stale
 */
export const getCustomerInfo = async () => {
  try {
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;

    return {
      success: true,
      customerInfo,
      hasPremium,
      activeEntitlements: Object.keys(customerInfo.entitlements.active)
    };
  } catch (error) {
    logError('Failed to get customer info:', "Error", error);
    return {
      success: false,
      error: error.message || 'Failed to get customer info'
    };
  }
};

/**
 * Check if user has active premium entitlement
 *
 * @param userId - Supabase user ID (optional, uses current user if not provided)
 */
export const hasActivePremium = async (userId?: string): Promise<boolean> => {
  try {
    // If checking from database instead of SDK
    if (userId) {
      const { data } = await supabase
        .rpc('has_active_premium', { user_uuid: userId });

      return data === true;
    }

    // Check via SDK (current user)
    if (!isRevenueCatInitialized) {
      return false;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['premium'] !== undefined;
  } catch (error) {
    logError('Failed to check premium status:', "Error", error);
    return false;
  }
};

/**
 * Cancel subscription
 *
 * NOTE: RevenueCat doesn't directly cancel subscriptions
 * Users must cancel through App Store/Play Store
 * This function provides management URL
 */
export const cancelSubscription = async () => {
  try {
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const managementURL = customerInfo.managementURL;

    if (!managementURL) {
      throw new Error('No management URL available');
    }

    logInfo('Subscription management URL retrieved', "Info", { managementURL });

    return {
      success: true,
      managementURL,
      message: 'Open this URL to manage your subscription'
    };
  } catch (error) {
    logError('Failed to get subscription management URL:', "Error", error);
    return {
      success: false,
      error: error.message || 'Failed to get management URL'
    };
  }
};

/**
 * Get subscription details from database
 *
 * Returns detailed subscription info from our database
 */
export const getSubscriptionDetails = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_active_subscriptions', { user_uuid: userId });

    if (error) throw error;

    const isActive = await hasActivePremium(userId);

    return {
      isActive,
      subscriptions: data || [],
      subscriptionDetails: data?.[0] || null
    };
  } catch (error) {
    logError('Failed to get subscription details:', "Error", error);
    return { isActive: false, subscriptions: [], subscriptionDetails: null };
  }
};

/**
 * Set up customer info update listener
 *
 * Automatically syncs subscription changes
 */
export const setupCustomerInfoListener = (onUpdate: (customerInfo: CustomerInfo) => void) => {
  if (!isRevenueCatInitialized) {
    logWarn('Cannot set up listener: RevenueCat not initialized', "Warning");
    return;
  }

  Purchases.addCustomerInfoUpdateListener((info) => {
    logDebug('Customer info updated', "Debug", {
      hasPremium: info.entitlements.active['premium'] !== undefined,
      activeEntitlements: Object.keys(info.entitlements.active)
    });
    onUpdate(info);
  });
};
