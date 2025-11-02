/**
 * Invite Manager Service for Stellr Beta
 *
 * Manages daily invite limits and subscription tiers:
 * - Free users: 5 invites per day
 * - Premium users: 20 invites per day
 *
 * Integrates with RevenueCat for subscription status
 * Uses Supabase for invite tracking and daily resets
 */

import { supabase } from '../lib/supabase';
import { hasActivePremium } from './revenuecat-service';
import { logError, logWarn, logInfo, logDebug } from '../utils/logger';
import { analytics } from './telemetry/analytics';

// Constants
const FREE_DAILY_INVITES = 5;
const PREMIUM_DAILY_INVITES = 20;

/**
 * Database RPC Response Interface
 * Matches the return type of get_invite_status(user_uuid) Supabase function
 */
interface InviteStatusRPC {
  remaining: number;
  total: number;
  is_premium: boolean;
  needs_reset: boolean;
  last_reset: string | null;
}

/**
 * Invite Status Interface (Frontend format)
 */
export interface InviteStatus {
  remaining: number;
  total: number;
  isPremium: boolean;
  needsReset: boolean;
  lastResetDate: string | null;
}

/**
 * Get user's current invite status
 *
 * Checks subscription tier from RevenueCat and invite count from database
 * Automatically resets if it's a new day
 *
 * @param userId - User's UUID from profiles table
 * @returns InviteStatus object with remaining invites and subscription info
 */
export const getInviteStatus = async (userId: string): Promise<InviteStatus> => {
  try {
    // Check subscription status from RevenueCat
    const isPremium = await hasActivePremium(userId);

    logDebug('Checking invite status', "Debug", { userId, isPremium });

    // Get user's invite data from database using helper function
    const { data: rawData, error } = await supabase
      .rpc('get_invite_status', { user_uuid: userId })
      .single();

    if (error) {
      logError('Error calling get_invite_status function:', "Error", error);
      throw error;
    }

    // Type assert the data after null check
    const data = rawData as InviteStatusRPC | null;

    // If data is null or undefined, user profile doesn't exist
    if (!data) {
      logWarn('No invite status found for user, returning defaults', "Warning", { userId });
      return {
        remaining: isPremium ? PREMIUM_DAILY_INVITES : FREE_DAILY_INVITES,
        total: isPremium ? PREMIUM_DAILY_INVITES : FREE_DAILY_INVITES,
        isPremium,
        needsReset: true,
        lastResetDate: null,
      };
    }

    // Type assertion - data is verified non-null above
    const rpcData = data as InviteStatusRPC;

    const inviteStatus: InviteStatus = {
      remaining: rpcData.remaining || 0,
      total: rpcData.total || (isPremium ? PREMIUM_DAILY_INVITES : FREE_DAILY_INVITES),
      isPremium: rpcData.is_premium || isPremium,
      needsReset: rpcData.needs_reset || false,
      lastResetDate: rpcData.last_reset || null,
    };

    // If reset is needed, perform it
    if (inviteStatus.needsReset) {
      logInfo('Daily reset needed, resetting invites', "Info", { userId });
      await resetDailyInvites(userId, isPremium);

      // Update the status to reflect the reset
      inviteStatus.remaining = isPremium ? PREMIUM_DAILY_INVITES : FREE_DAILY_INVITES;
      inviteStatus.total = isPremium ? PREMIUM_DAILY_INVITES : FREE_DAILY_INVITES;
      inviteStatus.needsReset = false;
      inviteStatus.lastResetDate = new Date().toISOString().split('T')[0];
    }

    logDebug('Invite status retrieved', "Debug", inviteStatus);
    return inviteStatus;
  } catch (error) {
    logError('Error getting invite status:', "Error", error);
    throw error;
  }
};

/**
 * Reset daily invites for a user
 *
 * Called automatically when a new day is detected
 * Can also be called manually by daily cron job
 *
 * @param userId - User's UUID
 * @param isPremium - Whether user has premium subscription
 */
export const resetDailyInvites = async (userId: string, isPremium: boolean): Promise<void> => {
  try {
    const inviteLimit = isPremium ? PREMIUM_DAILY_INVITES : FREE_DAILY_INVITES;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    logDebug('Resetting daily invites', "Debug", { userId, isPremium, inviteLimit });

    const { error } = await supabase
      .from('profiles')
      .update({
        daily_invites_remaining: inviteLimit,
        last_invite_reset_date: today,
        subscription_status: isPremium ? 'premium' : 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logError('Error resetting daily invites:', "Error", error);
      throw error;
    }

    logInfo('Daily invites reset successfully', "Info", { userId, newLimit: inviteLimit });

    // Track daily reset analytics
    analytics.capture('invites_reset', {
      user_id: userId,
      subscription_status: isPremium ? 'premium' : 'free',
      new_limit: inviteLimit,
      reset_date: today,
    });
  } catch (error) {
    logError('Error resetting daily invites:', "Error", error);
    throw error;
  }
};

/**
 * Use an invite (decrement count)
 *
 * Call this when user sends a match request/invite
 * Returns false if no invites remaining
 *
 * @param userId - User sending the invite
 * @param targetUserId - User being invited
 * @returns true if invite was used successfully, false if no invites remaining
 */
export const useInvite = async (userId: string, targetUserId: string): Promise<boolean> => {
  try {
    // Get current invite status (will auto-reset if needed)
    const status = await getInviteStatus(userId);

    if (status.remaining <= 0) {
      logWarn('No invites remaining for user', "Warning", { userId, remaining: status.remaining });
      return false; // No invites left
    }

    logDebug('Using invite', "Debug", { userId, targetUserId, remainingBefore: status.remaining });

    // Start a transaction-like operation
    // First, decrement the invite count
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        daily_invites_remaining: status.remaining - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('daily_invites_remaining', status.remaining) // Optimistic locking
      .select('daily_invites_remaining')
      .single();

    if (updateError) {
      logError('Error updating invite count:', "Error", updateError);
      throw updateError;
    }

    // Check if update was successful (optimistic lock check)
    if (!updatedProfile) {
      logWarn('Optimistic lock failed - invite count changed during update', "Warning", { userId });
      return false; // Race condition detected, retry needed
    }

    // Log the invite usage for analytics
    const { error: insertError } = await supabase
      .from('invite_usage_log')
      .insert({
        user_id: userId,
        invited_user_id: targetUserId,
        subscription_status: status.isPremium ? 'premium' : 'free',
        used_at: new Date().toISOString(),
        metadata: {
          remaining_after: updatedProfile.daily_invites_remaining,
          total_limit: status.total,
        },
      });

    if (insertError) {
      // Log error but don't fail the operation - logging is non-critical
      logWarn('Error logging invite usage:', "Warning", insertError);
    }

    logInfo('Invite used successfully', "Info", {
      userId,
      targetUserId,
      remainingAfter: updatedProfile.daily_invites_remaining,
      isPremium: status.isPremium,
    });

    // Track invite usage analytics
    analytics.capture('invite_sent', {
      user_id: userId,
      target_user_id: targetUserId,
      subscription_status: status.isPremium ? 'premium' : 'free',
      remaining_invites: updatedProfile.daily_invites_remaining,
      total_invites: status.total,
    });

    // Track if user exhausted all invites
    if (updatedProfile.daily_invites_remaining === 0) {
      analytics.capture('invites_exhausted', {
        user_id: userId,
        subscription_status: status.isPremium ? 'premium' : 'free',
        total_invites: status.total,
      });
    }

    return true;
  } catch (error) {
    logError('Error using invite:', "Error", error);
    throw error;
  }
};

/**
 * Sync subscription status from RevenueCat to Supabase
 *
 * Called when:
 * - User purchases/upgrades subscription
 * - App launches (to ensure sync)
 * - Webhook receives subscription event
 *
 * @param userId - User's UUID
 * @returns true if user has premium, false otherwise
 */
export const syncSubscriptionStatus = async (userId: string): Promise<boolean> => {
  try {
    logDebug('Syncing subscription status from RevenueCat', "Debug", { userId });

    // Check premium status from RevenueCat
    const isPremium = await hasActivePremium(userId);

    // Get current profile to check if subscription changed
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_status, daily_invites_remaining')
      .eq('id', userId)
      .single();

    if (fetchError) {
      logError('Error fetching current profile:', "Error", fetchError);
      throw fetchError;
    }

    const currentStatus = currentProfile?.subscription_status || 'free';
    const subscriptionChanged = (isPremium && currentStatus === 'free') ||
                                (!isPremium && currentStatus !== 'free');

    logDebug('Subscription status check', "Debug", {
      userId,
      isPremium,
      currentStatus,
      subscriptionChanged,
    });

    // Update profile with new subscription status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: isPremium ? 'premium' : 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      logError('Error updating subscription status:', "Error", updateError);
      throw updateError;
    }

    // If newly premium, give them full daily allotment immediately
    if (subscriptionChanged && isPremium) {
      logInfo('User upgraded to premium, resetting invites', "Info", { userId });
      await resetDailyInvites(userId, true);
    }

    logInfo('Subscription status synced successfully', "Info", {
      userId,
      isPremium,
      subscriptionChanged,
    });

    return isPremium;
  } catch (error) {
    logError('Error syncing subscription status:', "Error", error);
    throw error;
  }
};

/**
 * Check if user can send invites (has remaining invites available)
 *
 * Simple helper function to check before showing invite UI
 *
 * @param userId - User's UUID
 * @returns true if user has invites available
 */
export const canSendInvite = async (userId: string): Promise<boolean> => {
  try {
    const status = await getInviteStatus(userId);
    return status.remaining > 0;
  } catch (error) {
    logError('Error checking if user can send invite:', "Error", error);
    return false;
  }
};

/**
 * Get invite usage analytics for a user
 *
 * Returns usage history for analytics/debugging
 *
 * @param userId - User's UUID
 * @param days - Number of days to look back (default: 7)
 * @returns Array of invite usage records
 */
export const getInviteUsageHistory = async (
  userId: string,
  days: number = 7
): Promise<any[]> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('invite_usage_log')
      .select('*')
      .eq('user_id', userId)
      .gte('used_at', startDate.toISOString())
      .order('used_at', { ascending: false });

    if (error) {
      logError('Error fetching invite usage history:', "Error", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logError('Error getting invite usage history:', "Error", error);
    return [];
  }
};

/**
 * Export invite manager functions
 */
export const InviteManager = {
  getStatus: getInviteStatus,
  reset: resetDailyInvites,
  use: useInvite,
  syncSubscription: syncSubscriptionStatus,
  canSend: canSendInvite,
  getHistory: getInviteUsageHistory,
};
