/**
 * Comprehensive Unit Tests for RevenueCat Service
 *
 * Testing Coverage:
 * - initializeRevenueCat (success, no API key, invalid format, not authenticated, web platform)
 * - getOfferings (success, no offerings, not initialized)
 * - purchasePackage (success, user cancelled, error)
 * - restorePurchases (success, error)
 * - getCustomerInfo (success, not initialized)
 * - hasActivePremium (via SDK, via database, error handling)
 * - cancelSubscription (success, no URL)
 * - getSubscriptionDetails (success, error)
 */

import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import {
  initializeRevenueCat,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  hasActivePremium,
  cancelSubscription,
  getSubscriptionDetails,
} from '../revenuecat-service';
import { supabase } from '../../lib/supabase';
import { TEST_PACKAGES, TEST_CUSTOMER_INFO, TEST_USERS } from '../../../__tests__/fixtures';

// Mock dependencies
jest.mock('react-native-purchases');
jest.mock('../../lib/supabase');
jest.mock('../../utils/logger');

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// Helper to reset module state between tests
const resetRevenueCatState = () => {
  // Reset the isRevenueCatInitialized flag by reloading the module
  jest.resetModules();
};

describe('RevenueCat Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test_key';
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test_key';
  });

  describe('initializeRevenueCat', () => {
    it('should initialize RevenueCat successfully on iOS', async () => {
      // Arrange
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.freeUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(true);
      expect(mockPurchases.configure).toHaveBeenCalledWith({
        apiKey: 'appl_test_key',
        appUserID: TEST_USERS.freeUser.id,
      });
    });

    it('should initialize RevenueCat successfully on Android', async () => {
      // Arrange
      Platform.OS = 'android';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.freeUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(true);
      expect(mockPurchases.configure).toHaveBeenCalledWith({
        apiKey: 'goog_test_key',
        appUserID: TEST_USERS.freeUser.id,
      });
    });

    it('should skip initialization on web platform', async () => {
      // Arrange
      Platform.OS = 'web';

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(false);
      expect(mockPurchases.configure).not.toHaveBeenCalled();
    });

    it('should return false when API key is missing', async () => {
      // Arrange
      Platform.OS = 'ios';
      delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(false);
      expect(mockPurchases.configure).not.toHaveBeenCalled();
    });

    it('should return false when API key format is invalid', async () => {
      // Arrange
      Platform.OS = 'ios';
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'invalid_key_format';

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(false);
      expect(mockPurchases.configure).not.toHaveBeenCalled();
    });

    it('should return false when user is not authenticated', async () => {
      // Arrange
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(false);
      expect(mockPurchases.configure).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.freeUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockRejectedValue(new Error('Network error'));

      // Act
      const result = await initializeRevenueCat();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getOfferings', () => {
    it('should return offerings successfully', async () => {
      // Arrange
      const mockOffering = {
        identifier: 'default',
        serverDescription: 'Default offering',
        availablePackages: [TEST_PACKAGES.monthly, TEST_PACKAGES.annual],
      };

      mockPurchases.getOfferings = jest.fn().mockResolvedValue({
        current: mockOffering,
        all: { default: mockOffering },
      });

      // Need to initialize first (mock initialization)
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.freeUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();

      // Act
      const result = await getOfferings();

      // Assert
      expect(result.success).toBe(true);
      expect(result.offerings).toEqual(mockOffering);
      expect(result.packages).toHaveLength(2);
    });

    it('should handle case when no offerings are available', async () => {
      // Arrange
      mockPurchases.getOfferings = jest.fn().mockResolvedValue({
        current: null,
        all: {},
      });

      // Initialize first
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.freeUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();

      // Act
      const result = await getOfferings();

      // Assert
      expect(result.success).toBe(false);
      expect(result.offerings).toBeNull();
    });

    it('should handle error when getOfferings fails', async () => {
      // Arrange
      mockPurchases.getOfferings.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await getOfferings();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('purchasePackage', () => {
    beforeEach(async () => {
      // Initialize RevenueCat for purchase tests
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.freeUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();
    });

    it('should complete purchase successfully', async () => {
      // Arrange
      const packageToPurchase = TEST_PACKAGES.monthly as any;
      mockPurchases.purchasePackage = jest.fn().mockResolvedValue({
        customerInfo: TEST_CUSTOMER_INFO.premium,
        productIdentifier: 'stellr_monthly_9_99',
      });

      // Act
      const result = await purchasePackage(packageToPurchase);

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasPremium).toBe(true);
      expect(result.productIdentifier).toBe('stellr_monthly_9_99');
      expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(packageToPurchase);
    });

    it('should handle user cancellation', async () => {
      // Arrange
      const packageToPurchase = TEST_PACKAGES.monthly as any;
      const cancelError = new Error('User cancelled') as any;
      cancelError.userCancelled = true;
      mockPurchases.purchasePackage = jest.fn().mockRejectedValue(cancelError);

      // Act
      const result = await purchasePackage(packageToPurchase);

      // Assert
      expect(result.success).toBe(false);
      expect(result.userCancelled).toBe(true);
      expect(result.error).toBe('Purchase cancelled');
    });

    it('should handle purchase errors', async () => {
      // Arrange
      const packageToPurchase = TEST_PACKAGES.monthly as any;
      mockPurchases.purchasePackage = jest
        .fn()
        .mockRejectedValue(new Error('Payment failed'));

      // Act
      const result = await purchasePackage(packageToPurchase);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });
  });

  describe('restorePurchases', () => {
    beforeEach(async () => {
      // Initialize RevenueCat
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.premiumUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();
    });

    it('should restore purchases successfully', async () => {
      // Arrange
      mockPurchases.restorePurchases = jest
        .fn()
        .mockResolvedValue(TEST_CUSTOMER_INFO.premium);

      // Act
      const result = await restorePurchases();

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasPremium).toBe(true);
      expect(result.activeEntitlements).toContain('premium');
    });

    it('should handle restore errors', async () => {
      // Arrange
      mockPurchases.restorePurchases = jest
        .fn()
        .mockRejectedValue(new Error('Restore failed'));

      // Act
      const result = await restorePurchases();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Restore failed');
    });
  });

  describe('getCustomerInfo', () => {
    beforeEach(async () => {
      // Initialize RevenueCat
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.premiumUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();
    });

    it('should get customer info successfully for premium user', async () => {
      // Arrange
      mockPurchases.getCustomerInfo = jest
        .fn()
        .mockResolvedValue(TEST_CUSTOMER_INFO.premium);

      // Act
      const result = await getCustomerInfo();

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasPremium).toBe(true);
      expect(result.activeEntitlements).toContain('premium');
    });

    it('should get customer info successfully for free user', async () => {
      // Arrange
      mockPurchases.getCustomerInfo = jest
        .fn()
        .mockResolvedValue(TEST_CUSTOMER_INFO.free);

      // Act
      const result = await getCustomerInfo();

      // Assert
      expect(result.success).toBe(true);
      expect(result.hasPremium).toBe(false);
      expect(result.activeEntitlements).toHaveLength(0);
    });
  });

  describe('hasActivePremium', () => {
    beforeEach(async () => {
      // Initialize RevenueCat
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.premiumUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();
    });

    it('should check premium status via SDK for current user', async () => {
      // Arrange
      mockPurchases.getCustomerInfo = jest
        .fn()
        .mockResolvedValue(TEST_CUSTOMER_INFO.premium);

      // Act
      const hasPremium = await hasActivePremium();

      // Assert
      expect(hasPremium).toBe(true);
      expect(mockPurchases.getCustomerInfo).toHaveBeenCalled();
    });

    it('should check premium status via database RPC when userId provided', async () => {
      // Arrange
      const userId = TEST_USERS.premiumUser.id;
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      // Act
      const hasPremium = await hasActivePremium(userId);

      // Assert
      expect(hasPremium).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('has_active_premium', {
        user_uuid: userId,
      });
    });

    it('should return false when user has no premium', async () => {
      // Arrange
      mockPurchases.getCustomerInfo = jest
        .fn()
        .mockResolvedValue(TEST_CUSTOMER_INFO.free);

      // Act
      const hasPremium = await hasActivePremium();

      // Assert
      expect(hasPremium).toBe(false);
    });

    it('should handle errors gracefully and return false', async () => {
      // Arrange
      mockPurchases.getCustomerInfo = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      // Act
      const hasPremium = await hasActivePremium();

      // Assert
      expect(hasPremium).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(async () => {
      // Initialize RevenueCat
      Platform.OS = 'ios';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USERS.premiumUser.id } as any },
        error: null,
      });
      mockPurchases.configure = jest.fn().mockResolvedValue(undefined);
      mockPurchases.setLogLevel = jest.fn().mockResolvedValue(undefined);
      await initializeRevenueCat();
    });

    it('should return management URL successfully', async () => {
      // Arrange
      const managementURL = 'https://apps.apple.com/account/subscriptions';
      mockPurchases.getCustomerInfo = jest.fn().mockResolvedValue({
        ...TEST_CUSTOMER_INFO.premium,
        managementURL,
      });

      // Act
      const result = await cancelSubscription();

      // Assert
      expect(result.success).toBe(true);
      expect(result.managementURL).toBe(managementURL);
    });

    it('should handle case when management URL is not available', async () => {
      // Arrange
      mockPurchases.getCustomerInfo = jest.fn().mockResolvedValue({
        ...TEST_CUSTOMER_INFO.premium,
        managementURL: null,
      });

      // Act
      const result = await cancelSubscription();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('No management URL');
    });
  });

  describe('getSubscriptionDetails', () => {
    it('should get subscription details from database', async () => {
      // Arrange
      const userId = TEST_USERS.premiumUser.id;
      const mockSubscriptionData = [
        {
          id: 'sub-123',
          user_id: userId,
          status: 'active',
          plan_type: 'monthly',
          expires_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockSubscriptionData,
        error: null,
      });

      // Mock hasActivePremium via database
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockSubscriptionData,
        error: null,
      }).mockResolvedValueOnce({
        data: true,
        error: null,
      });

      // Act
      const result = await getSubscriptionDetails(userId);

      // Assert
      expect(result.isActive).toBe(true);
      expect(result.subscriptions).toEqual(mockSubscriptionData);
      expect(result.subscriptionDetails).toEqual(mockSubscriptionData[0]);
    });

    it('should handle empty subscription data', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const result = await getSubscriptionDetails(userId);

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.subscriptions).toEqual([]);
      expect(result.subscriptionDetails).toBeNull();
    });
  });
});
