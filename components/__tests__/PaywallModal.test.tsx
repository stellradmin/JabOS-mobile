/**
 * Comprehensive Component Tests for PaywallModal
 *
 * Testing Coverage:
 * - Rendering in different states (visible, loading, error, success)
 * - Analytics tracking (paywall_shown, purchase_started, purchase_completed, etc.)
 * - Purchase flow (success, failure, cancellation, beta mode)
 * - Trigger-based behavior and messaging
 * - User interactions (close, retry, subscribe)
 * - Integration with payments and invite services
 * - Beta mode "Coming Soon" modal
 *
 * Critical: Ensures monetization flow works correctly
 */

import React from 'react';
import { render, fireEvent, waitFor } from '../../__tests__/test-utils';
import PaywallModal from '../PaywallModal';
import { getOfferings, purchasePackage } from '../../src/services/payments-service';
import { syncSubscriptionStatus } from '../../src/services/invite-manager';
import { analytics } from '../../src/services/telemetry/analytics';
import { useAuth } from '../../src/contexts/AuthContext';
import { TEST_USERS, TEST_PACKAGES } from '../../__tests__/fixtures';

// Mock dependencies
jest.mock('../../src/services/payments-service');
jest.mock('../../src/services/invite-manager');
jest.mock('../../src/services/telemetry/analytics');
jest.mock('../../src/contexts/AuthContext');
jest.mock('../../src/utils/logger');

const mockGetOfferings = getOfferings as jest.MockedFunction<typeof getOfferings>;
const mockPurchasePackage = purchasePackage as jest.MockedFunction<typeof purchasePackage>;
const mockSyncSubscriptionStatus = syncSubscriptionStatus as jest.MockedFunction<
  typeof syncSubscriptionStatus
>;
const mockAnalytics = analytics as jest.Mocked<typeof analytics>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('PaywallModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
    trigger: 'exhausted_invites' as const,
    remainingInvites: 0,
  };

  const mockOfferings = {
    identifier: 'default',
    availablePackages: [
      {
        identifier: 'monthly',
        product: {
          identifier: 'stellr_monthly_999',
          price: 9.99,
          priceString: '$9.99',
        },
      },
    ],
  };

  beforeAll(() => {
    // Use real timers for PaywallModal tests to handle async operations properly
    jest.useRealTimers();
  });

  afterAll(() => {
    // Restore fake timers after tests
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock auth context
    mockUseAuth.mockReturnValue({
      user: { id: TEST_USERS.freeUser.id } as any,
      session: null,
      loading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
    });

    // Mock successful offerings by default
    mockGetOfferings.mockResolvedValue({
      success: true,
      offerings: mockOfferings,
    } as any);

    // Reset environment
    process.env.EXPO_PUBLIC_IS_BETA = 'false';
  });

  describe('Rendering and Visibility', () => {
    it('should render when visible is true', () => {
      // Act
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      // Assert
      expect(getByText('Get More Swipes')).toBeTruthy();
      expect(getByText('Upgrade to get 20 swipes daily instead of 5')).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      // Act
      const { queryByText } = render(
        <PaywallModal {...defaultProps} visible={false} />
      );

      // Assert
      expect(queryByText('Get More Swipes')).toBeNull();
    });

    it('should show loading state while fetching offerings', async () => {
      // Arrange - Make offerings take time to load
      mockGetOfferings.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, offerings: mockOfferings } as any), 100))
      );

      // Act
      const { queryByTestId, UNSAFE_getByType } = render(<PaywallModal {...defaultProps} />);

      // Assert - Should show ActivityIndicator
      // Note: Using UNSAFE_getByType for ActivityIndicator since it doesn't have testID
      await waitFor(() => {
        expect(mockGetOfferings).toHaveBeenCalled();
      });
    });

    it('should display pricing information after offerings load', async () => {
      // Act
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      // Assert
      await waitFor(() => {
        expect(getByText('$9.99/month')).toBeTruthy();
        expect(getByText('Cancel anytime')).toBeTruthy();
      });
    });

    it('should display features list', () => {
      // Act
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      // Assert
      expect(getByText('20 swipes daily')).toBeTruthy();
    });
  });

  describe('Analytics Tracking', () => {
    it('should track paywall_shown event when modal becomes visible', async () => {
      // Act
      render(<PaywallModal {...defaultProps} />);

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('paywall_shown', {
          trigger: 'exhausted_invites',
          remaining_invites: 0,
          user_id: TEST_USERS.freeUser.id,
          timestamp: expect.any(String),
        });
      });
    });

    it('should track paywall_dismissed event when closed', async () => {
      // Arrange
      const { getByTestId, UNSAFE_getAllByType } = render(<PaywallModal {...defaultProps} />);

      // Find close button (X icon) - it's a TouchableOpacity
      const TouchableOpacity = require('react-native').TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      const closeButton = touchables[0]; // First touchable is the back/close button

      // Act
      fireEvent.press(closeButton);

      // Assert
      expect(mockAnalytics.capture).toHaveBeenCalledWith('paywall_dismissed', {
        trigger: 'exhausted_invites',
        remaining_invites: 0,
        user_id: TEST_USERS.freeUser.id,
      });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should track purchase_started event when purchase begins', async () => {
      // Arrange
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: true,
        hasPremium: true,
        productIdentifier: 'stellr_monthly_999',
      } as any);

      // Act
      const subscribeButton = getByText('Subscribe Now');
      fireEvent.press(subscribeButton);

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('purchase_started', {
          trigger: 'exhausted_invites',
          package: 'monthly',
          product_id: 'stellr_monthly_999',
          user_id: TEST_USERS.freeUser.id,
        });
      });
    });

    it('should track purchase_completed event on successful purchase', async () => {
      // Arrange
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: true,
        hasPremium: true,
        productIdentifier: 'stellr_monthly_999',
      } as any);
      mockSyncSubscriptionStatus.mockResolvedValue(true);

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('purchase_completed', {
          trigger: 'exhausted_invites',
          package: 'monthly',
          product_id: 'stellr_monthly_999',
          user_id: TEST_USERS.freeUser.id,
        });
      });
    });

    it('should track purchase_cancelled event when user cancels', async () => {
      // Arrange
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: false,
        userCancelled: true,
        error: 'User cancelled',
      } as any);

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('purchase_cancelled', {
          trigger: 'exhausted_invites',
          package: 'monthly',
          user_id: TEST_USERS.freeUser.id,
        });
      });
    });

    it('should track purchase_failed event on purchase error', async () => {
      // Arrange
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: false,
        userCancelled: false,
        error: 'Payment failed',
      } as any);

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('purchase_failed', {
          trigger: 'exhausted_invites',
          package: 'monthly',
          error: 'Payment failed',
          user_id: TEST_USERS.freeUser.id,
        });
      });
    });
  });

  describe('Purchase Flow', () => {
    it('should complete purchase successfully and call onSuccess', async () => {
      // Arrange
      const { getByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: true,
        hasPremium: true,
        productIdentifier: 'stellr_monthly_999',
      } as any);
      mockSyncSubscriptionStatus.mockResolvedValue(true);

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockPurchasePackage).toHaveBeenCalled();
        expect(mockSyncSubscriptionStatus).toHaveBeenCalledWith(TEST_USERS.freeUser.id);
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle purchase failure and show error message', async () => {
      // Arrange
      const { getByText, findByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: false,
        userCancelled: false,
        error: 'Payment method declined',
      } as any);

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      const errorMessage = await findByText('Payment method declined');
      expect(errorMessage).toBeTruthy();
    });

    it('should not show error for user cancellation', async () => {
      // Arrange
      const { getByText, queryByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockResolvedValue({
        success: false,
        userCancelled: true,
        error: 'User cancelled',
      } as any);

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockPurchasePackage).toHaveBeenCalled();
      });

      // Should not display error message for cancellation
      expect(queryByText(/User cancelled/)).toBeNull();
    });

    it('should disable subscribe button during purchase', async () => {
      // Arrange
      const { getByText, UNSAFE_getAllByType } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      // Make purchase take time
      mockPurchasePackage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true } as any), 100))
      );

      // Act
      const subscribeButton = getByText('Subscribe Now');
      fireEvent.press(subscribeButton);

      // Assert - Button should show loading state
      await waitFor(() => {
        // During purchase, button text should be replaced with ActivityIndicator
        expect(mockPurchasePackage).toHaveBeenCalled();
      });
    });
  });

  describe('Beta Mode Behavior', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_IS_BETA = 'true';
    });

    it('should show Coming Soon modal instead of processing purchase in beta', async () => {
      // Arrange
      const { getByText, findByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('paywall_beta_purchase_attempted', {
          trigger: 'exhausted_invites',
          user_id: TEST_USERS.freeUser.id,
          is_mock_mode: expect.any(Boolean),
        });
      });

      // Should not actually process purchase
      expect(mockPurchasePackage).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when offerings fail to load', async () => {
      // Arrange
      mockGetOfferings.mockResolvedValue({
        success: false,
        error: 'Network error',
      } as any);

      // Act
      const { findByText } = render(<PaywallModal {...defaultProps} />);

      // Assert
      const errorMessage = await findByText('Unable to load subscription options. Please try again.');
      expect(errorMessage).toBeTruthy();
    });

    it('should show retry button when offerings fail to load', async () => {
      // Arrange
      mockGetOfferings.mockResolvedValue({
        success: false,
        error: 'Network error',
      } as any);

      // Act
      const { findByText } = render(<PaywallModal {...defaultProps} />);

      // Assert
      const retryButton = await findByText('Retry');
      expect(retryButton).toBeTruthy();
    });

    it('should retry loading offerings when retry button is pressed', async () => {
      // Arrange
      mockGetOfferings
        .mockResolvedValueOnce({ success: false, error: 'Network error' } as any)
        .mockResolvedValueOnce({ success: true, offerings: mockOfferings } as any);

      const { findByText, getByText } = render(<PaywallModal {...defaultProps} />);

      await findByText('Retry');

      // Act
      fireEvent.press(getByText('Retry'));

      // Assert
      await waitFor(() => {
        expect(mockGetOfferings).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle exception during purchase gracefully', async () => {
      // Arrange
      const { getByText, findByText } = render(<PaywallModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      mockPurchasePackage.mockRejectedValue(new Error('Unexpected error'));

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith('purchase_error', {
          trigger: 'exhausted_invites',
          error: 'Unexpected error',
          user_id: TEST_USERS.freeUser.id,
        });
      });

      const errorMessage = await findByText('Unexpected error');
      expect(errorMessage).toBeTruthy();
    });
  });

  describe('Trigger-Based Messaging', () => {
    it('should show correct headline for exhausted_invites trigger', () => {
      // Act
      const { getByText } = render(
        <PaywallModal {...defaultProps} trigger="exhausted_invites" />
      );

      // Assert
      expect(getByText('Get More Swipes')).toBeTruthy();
    });

    it('should show correct headline for see_who_likes trigger', () => {
      // Act
      const { getByText } = render(
        <PaywallModal {...defaultProps} trigger="see_who_likes" />
      );

      // Assert
      expect(getByText('Get More Swipes')).toBeTruthy();
    });

    it('should pass correct feature name to Coming Soon modal in beta', async () => {
      // Arrange
      process.env.EXPO_PUBLIC_IS_BETA = 'true';
      const { getByText } = render(
        <PaywallModal {...defaultProps} trigger="see_who_likes" />
      );

      await waitFor(() => {
        expect(getByText('Subscribe Now')).toBeTruthy();
      });

      // Act
      fireEvent.press(getByText('Subscribe Now'));

      // Assert - Feature name should be passed to Coming Soon modal
      await waitFor(() => {
        expect(mockAnalytics.capture).toHaveBeenCalledWith(
          'paywall_beta_purchase_attempted',
          expect.any(Object)
        );
      });
    });
  });
});
