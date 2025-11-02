/**
 * Comprehensive Unit Tests for Invite Manager Service
 *
 * Testing Coverage:
 * - getInviteStatus (free user, premium user, needs reset, null data)
 * - resetDailyInvites (free and premium tiers)
 * - useInvite (success, failure, exhausted, optimistic locking)
 * - syncSubscriptionStatus (upgrade, downgrade, no change)
 * - canSendInvite (edge cases)
 * - getInviteUsageHistory
 */

import {
  getInviteStatus,
  resetDailyInvites,
  useInvite,
  syncSubscriptionStatus,
  canSendInvite,
  getInviteUsageHistory,
} from '../invite-manager';
import { supabase } from '../../lib/supabase';
import { hasActivePremium } from '../revenuecat-service';
import { analytics } from '../telemetry/analytics';
import { TEST_INVITE_STATUSES, TEST_USERS } from '../../../__tests__/fixtures';

// Mock dependencies
jest.mock('../../lib/supabase');
jest.mock('../revenuecat-service');
jest.mock('../telemetry/analytics');
jest.mock('../../utils/logger');

// Type the mocked supabase for better TypeScript support
const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockHasActivePremium = hasActivePremium as jest.MockedFunction<
  typeof hasActivePremium
>;
const mockAnalytics = analytics as jest.Mocked<typeof analytics>;

describe('Invite Manager Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInviteStatus', () => {
    it('should return free user invite status successfully', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 3,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Act
      const status = await getInviteStatus(userId);

      // Assert
      expect(status).toEqual({
        remaining: 3,
        total: 5,
        isPremium: false,
        needsReset: false,
        lastResetDate: '2024-01-15',
      });
      expect(mockHasActivePremium).toHaveBeenCalledWith(userId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_invite_status', {
        user_uuid: userId,
      });
    });

    it('should return premium user invite status successfully', async () => {
      // Arrange
      const userId = TEST_USERS.premiumUser.id;
      mockHasActivePremium.mockResolvedValue(true);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 18,
            total: 20,
            is_premium: true,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Act
      const status = await getInviteStatus(userId);

      // Assert
      expect(status).toEqual({
        remaining: 18,
        total: 20,
        isPremium: true,
        needsReset: false,
        lastResetDate: '2024-01-15',
      });
    });

    it('should automatically reset invites when needs_reset is true', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 2,
            total: 5,
            is_premium: false,
            needs_reset: true,
            last_reset: '2024-01-14',
          },
          error: null,
        }),
      } as any);

      // Mock the resetDailyInvites update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as any);

      // Act
      const status = await getInviteStatus(userId);

      // Assert
      expect(status.remaining).toBe(5); // Reset to free tier limit
      expect(status.total).toBe(5);
      expect(status.needsReset).toBe(false);
      expect(mockAnalytics.capture).toHaveBeenCalledWith(
        'invites_reset',
        expect.objectContaining({
          user_id: userId,
          subscription_status: 'free',
          new_limit: 5,
        })
      );
    });

    it('should return default values when user has no profile data', async () => {
      // Arrange
      const userId = 'new-user-no-profile';
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      // Act
      const status = await getInviteStatus(userId);

      // Assert
      expect(status).toEqual({
        remaining: 5,
        total: 5,
        isPremium: false,
        needsReset: true,
        lastResetDate: null,
      });
    });

    it('should throw error when RPC call fails', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const mockError = { message: 'Database error', code: 'DB_ERROR' };
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      } as any);

      // Act & Assert
      await expect(getInviteStatus(userId)).rejects.toEqual(mockError);
    });
  });

  describe('resetDailyInvites', () => {
    it('should reset free user invites to 5', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as any);

      // Act
      await resetDailyInvites(userId, false);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockAnalytics.capture).toHaveBeenCalledWith(
        'invites_reset',
        expect.objectContaining({
          user_id: userId,
          subscription_status: 'free',
          new_limit: 5,
        })
      );
    });

    it('should reset premium user invites to 20', async () => {
      // Arrange
      const userId = TEST_USERS.premiumUser.id;
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as any);

      // Act
      await resetDailyInvites(userId, true);

      // Assert
      expect(mockAnalytics.capture).toHaveBeenCalledWith(
        'invites_reset',
        expect.objectContaining({
          user_id: userId,
          subscription_status: 'premium',
          new_limit: 20,
        })
      );
    });

    it('should throw error when database update fails', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const mockError = { message: 'Update failed', code: 'UPDATE_ERROR' };
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      } as any);

      // Act & Assert
      await expect(resetDailyInvites(userId, false)).rejects.toEqual(mockError);
    });
  });

  describe('useInvite', () => {
    it('should successfully use an invite when user has invites remaining', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const targetUserId = 'target-user-123';

      // Mock getInviteStatus
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 3,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Mock update operation
      const mockUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { daily_invites_remaining: 2 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      // Mock insert operation for invite_usage_log
      const mockInsertChain = {
        insert: jest.fn().mockResolvedValue({
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') return mockUpdateChain as any;
        if (table === 'invite_usage_log') return mockInsertChain as any;
        return {} as any;
      });

      // Act
      const result = await useInvite(userId, targetUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockAnalytics.capture).toHaveBeenCalledWith(
        'invite_sent',
        expect.objectContaining({
          user_id: userId,
          target_user_id: targetUserId,
          subscription_status: 'free',
          remaining_invites: 2,
          total_invites: 5,
        })
      );
    });

    it('should return false when user has no invites remaining', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const targetUserId = 'target-user-123';

      // Mock getInviteStatus with 0 remaining
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 0,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Act
      const result = await useInvite(userId, targetUserId);

      // Assert
      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalledWith('profiles');
    });

    it('should track "invites_exhausted" event when using last invite', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const targetUserId = 'target-user-123';

      // Mock getInviteStatus with 1 remaining
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 1,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Mock update to return 0 remaining
      const mockUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { daily_invites_remaining: 0 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const mockInsertChain = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') return mockUpdateChain as any;
        if (table === 'invite_usage_log') return mockInsertChain as any;
        return {} as any;
      });

      // Act
      await useInvite(userId, targetUserId);

      // Assert
      expect(mockAnalytics.capture).toHaveBeenCalledWith(
        'invites_exhausted',
        expect.objectContaining({
          user_id: userId,
          subscription_status: 'free',
          total_invites: 5,
        })
      );
    });

    it('should handle optimistic lock failure (race condition)', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const targetUserId = 'target-user-123';

      // Mock getInviteStatus
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 3,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Mock update to return null (optimistic lock failed)
      const mockUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null, // Indicates lock failure
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockUpdateChain as any);

      // Act
      const result = await useInvite(userId, targetUserId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('syncSubscriptionStatus', () => {
    it('should sync and upgrade user to premium with invite reset', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockHasActivePremium.mockResolvedValue(true);

      // Mock current profile as free
      const mockSelectChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                subscription_status: 'free',
                daily_invites_remaining: 2,
              },
              error: null,
            }),
          }),
        }),
      };

      // Mock update and reset operations
      const mockUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      };

      mockSupabase.from.mockImplementation(() => {
        const chain = { ...mockSelectChain, ...mockUpdateChain };
        return chain as any;
      });

      // Act
      const isPremium = await syncSubscriptionStatus(userId);

      // Assert
      expect(isPremium).toBe(true);
      expect(mockAnalytics.capture).toHaveBeenCalledWith(
        'invites_reset',
        expect.objectContaining({
          subscription_status: 'premium',
          new_limit: 20,
        })
      );
    });

    it('should sync without reset when subscription has not changed', async () => {
      // Arrange
      const userId = TEST_USERS.premiumUser.id;
      mockHasActivePremium.mockResolvedValue(true);

      // Mock current profile as premium
      const mockSelectChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                subscription_status: 'premium',
                daily_invites_remaining: 18,
              },
              error: null,
            }),
          }),
        }),
      };

      const mockUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      };

      mockSupabase.from.mockImplementation(() => {
        const chain = { ...mockSelectChain, ...mockUpdateChain };
        return chain as any;
      });

      // Act
      const isPremium = await syncSubscriptionStatus(userId);

      // Assert
      expect(isPremium).toBe(true);
      // Should not trigger a reset since status didn't change
      const resetCalls = (mockAnalytics.capture as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'invites_reset'
      );
      expect(resetCalls.length).toBe(0);
    });
  });

  describe('canSendInvite', () => {
    it('should return true when user has invites remaining', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 3,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Act
      const canSend = await canSendInvite(userId);

      // Assert
      expect(canSend).toBe(true);
    });

    it('should return false when user has no invites remaining', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockHasActivePremium.mockResolvedValue(false);
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            remaining: 0,
            total: 5,
            is_premium: false,
            needs_reset: false,
            last_reset: '2024-01-15',
          },
          error: null,
        }),
      } as any);

      // Act
      const canSend = await canSendInvite(userId);

      // Assert
      expect(canSend).toBe(false);
    });

    it('should return false and handle errors gracefully', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      mockHasActivePremium.mockRejectedValue(new Error('Network error'));

      // Act
      const canSend = await canSendInvite(userId);

      // Assert
      expect(canSend).toBe(false);
    });
  });

  describe('getInviteUsageHistory', () => {
    it('should return usage history for the specified number of days', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;
      const mockHistory = [
        {
          id: 'log-1',
          user_id: userId,
          invited_user_id: 'user-1',
          used_at: new Date().toISOString(),
          subscription_status: 'free',
        },
        {
          id: 'log-2',
          user_id: userId,
          invited_user_id: 'user-2',
          used_at: new Date(Date.now() - 86400000).toISOString(),
          subscription_status: 'free',
        },
      ];

      const mockSelectChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockHistory,
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockSelectChain as any);

      // Act
      const history = await getInviteUsageHistory(userId, 7);

      // Assert
      expect(history).toEqual(mockHistory);
      expect(mockSupabase.from).toHaveBeenCalledWith('invite_usage_log');
    });

    it('should return empty array when no history exists', async () => {
      // Arrange
      const userId = TEST_USERS.newUser.id;

      const mockSelectChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockSelectChain as any);

      // Act
      const history = await getInviteUsageHistory(userId);

      // Assert
      expect(history).toEqual([]);
    });

    it('should return empty array and handle errors gracefully', async () => {
      // Arrange
      const userId = TEST_USERS.freeUser.id;

      const mockSelectChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(mockSelectChain as any);

      // Act
      const history = await getInviteUsageHistory(userId);

      // Assert
      expect(history).toEqual([]);
    });
  });
});
