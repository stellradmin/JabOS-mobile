import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { hasActivePremium, getSubscriptionDetails as getRevenueCatSubscriptionDetails, setupCustomerInfoListener } from '../services/revenuecat-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface SubscriptionState {
  isActive: boolean;
  hasTicket: boolean;
  planId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  error: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  refresh: () => Promise<void>;
  checkAccess: () => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    isActive: false,
    hasTicket: false,
    planId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    loading: true,
    error: null,
  });

  const refresh = async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Get RevenueCat subscription details from database
      logDebug('Checking RevenueCat subscription status for user:', "Debug", user.id);
      const details = await getRevenueCatSubscriptionDetails(user.id);

      if (details.isActive) {
        logDebug('RevenueCat subscription active:', "Debug", details);
        setState({
          isActive: details.isActive,
          hasTicket: false, // RevenueCat uses entitlement-based access, no separate tickets
          planId: null, // Product ID not used with entitlement-based access
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          loading: false,
          error: null,
        });
      } else {
        // No active subscription found
        logDebug('No active RevenueCat subscription found', "Debug");
        setState({
          isActive: false,
          hasTicket: false,
          planId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          loading: false,
          error: null,
        });
      }
    } catch (error: any) {
      logError('Error fetching RevenueCat subscription status:', "Error", error);
      // SECURITY: Never grant premium access on error - this would be a payment bypass
      setState({
        isActive: false,
        hasTicket: false,
        planId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        loading: false,
        error: error.message || 'Failed to fetch subscription status',
      });
    }
  };

  const checkAccess = (): boolean => {
    // RevenueCat uses entitlement-based access - check isActive status
    const hasRealAccess = state.isActive;
    logDebug('RevenueCat access check - isActive:', "Debug", state.isActive, 'result:', hasRealAccess);

    if (!hasRealAccess) {
      logDebug('❌ Access denied - no active premium entitlement', "Debug");
    } else {
      logDebug('✅ Access granted - active premium entitlement found', "Debug");
    }

    // SECURITY: Always enforce real payment verification
    return hasRealAccess;
  };

  useEffect(() => {
    refresh();

    // Set up RevenueCat customer info listener for real-time updates
    // This automatically updates subscription state when purchases/cancellations occur
    setupCustomerInfoListener((customerInfo) => {
      const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
      logDebug('RevenueCat customer info updated:', "Debug", { hasPremium });

      setState(prev => ({
        ...prev,
        isActive: hasPremium,
        hasTicket: false,
        loading: false,
      }));
    });
  }, [user]);

  const value: SubscriptionContextType = {
    ...state,
    refresh,
    checkAccess,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
