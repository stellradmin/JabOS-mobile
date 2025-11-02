/**
 * useSubscriptionSync Hook
 *
 * Syncs RevenueCat subscription status to Supabase on app launch
 * Ensures invite limits are accurate based on current subscription tier
 *
 * Call this hook in AuthNavigator or anywhere after user authentication
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { initializeRevenueCat } from '../services/revenuecat-service';
import { syncSubscriptionStatus } from '../services/invite-manager';
import { logInfo, logError, logDebug } from '../utils/logger';

export const useSubscriptionSync = () => {
  const { user } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    // Only sync once per app session when user is authenticated
    if (user?.id && !syncedRef.current) {
      syncSubscription(user.id);
      syncedRef.current = true;
    }

    // Reset sync flag when user logs out
    if (!user) {
      syncedRef.current = false;
    }
  }, [user?.id]);

  const syncSubscription = async (userId: string) => {
    try {
      logDebug('Starting subscription sync on app launch', "Debug", { userId });

      // Initialize RevenueCat (gets user ID internally from Supabase auth)
      const revenueCatInitialized = await initializeRevenueCat();

      if (!revenueCatInitialized) {
        logError('RevenueCat not initialized, skipping subscription sync', "Error");
        return;
      }

      // Sync subscription status from RevenueCat to Supabase
      const isPremium = await syncSubscriptionStatus(userId);

      logInfo('Subscription sync completed on app launch', "Info", {
        userId,
        isPremium,
      });
    } catch (error) {
      logError('Error syncing subscription on app launch:', "Error", error);
      // Non-critical error - app continues to function
    }
  };
};
