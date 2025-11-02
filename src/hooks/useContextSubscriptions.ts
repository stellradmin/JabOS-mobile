// Context subscription management with automatic cleanup
// Prevents memory leaks from context subscriptions and providers
// Manages subscription lifecycle and dependency tracking

import { useRef, useCallback, useEffect, useContext, Context } from 'react';
import { useTimers } from './useTimers';
import { useRefs } from './useRefs';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface ContextSubscription<T = any> {
  id: string;
  context: Context<T>;
  callback: (value: T) => void;
  description?: string;
  isActive: boolean;
  subscriptionCount: number;
  lastTriggered?: number;
  cleanup?: () => void;
}

interface ContextEntry<T = any> {
  id: string;
  context: Context<T>;
  currentValue: T;
  subscriptions: Set<string>;
  lastAccessed: number;
  changeHistory: Array<{
    timestamp: number;
    oldValue: T;
    newValue: T;
  }>;
}

interface SubscriptionGroup {
  id: string;
  name: string;
  subscriptionIds: string[];
  enabled: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  cleanup?: () => void;
}

export const useContextSubscriptions = () => {
  const { createTimeout, clearTimer } = useTimers();
  const { createComponentRef, nullRef } = useRefs();
  
  const subscriptionsRef = useRef<Map<string, ContextSubscription>>(new Map());
  const contextsRef = useRef<Map<string, ContextEntry>>(new Map());
  const subscriptionGroupsRef = useRef<Map<string, SubscriptionGroup>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique subscription ID
  const generateSubscriptionId = useCallback((contextName: string) => {
    return `context_sub_${contextName}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Create managed context subscription
  const subscribeToContext = useCallback(<T>(
    context: Context<T>,
    callback: (value: T) => void,
    options: {
      description?: string;
      debounceMs?: number;
      immediate?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    } = {}
  ): string => {
    const {
      description,
      debounceMs = 0,
      immediate = true,
      priority = 'normal'
    } = options;

    const subscriptionId = generateSubscriptionId(description || 'unnamed');
    const contextId = `context_${context.displayName || 'unnamed'}_${Date.now()}`;
    
    let debounceTimerId: string | null = null;
    let isFirstCall = true;

    const debouncedCallback = (value: T) => {
      if (debounceTimerId) {
        clearTimer(debounceTimerId);
      }

      if (debounceMs > 0) {
        debounceTimerId = createTimeout(() => {
          callback(value);
          const subscription = subscriptionsRef.current.get(subscriptionId);
          if (subscription) {
            subscription.lastTriggered = Date.now();
            subscription.subscriptionCount++;
          }
        }, debounceMs, `context_debounce_${subscriptionId}`);
      } else {
        callback(value);
        const subscription = subscriptionsRef.current.get(subscriptionId);
        if (subscription) {
          subscription.lastTriggered = Date.now();
          subscription.subscriptionCount++;
        }
      }
    };

    const subscription: ContextSubscription<T> = {
      id: subscriptionId,
      context,
      callback: debouncedCallback,
      description: `context-subscription-${description || 'unnamed'}`,
      isActive: true,
      subscriptionCount: 0,
      cleanup: () => {
        // Clear any pending debounce
        if (debounceTimerId) {
          clearTimer(debounceTimerId);
          debounceTimerId = null;
        }
        
        // Remove from context tracking
        const contextEntry = contextsRef.current.get(contextId);
        if (contextEntry) {
          contextEntry.subscriptions.delete(subscriptionId);
          if (contextEntry.subscriptions.size === 0) {
            contextsRef.current.delete(contextId);
          }
        }
      }
    };

    subscriptionsRef.current.set(subscriptionId, subscription);

    // Track context if not already tracked
    if (!contextsRef.current.has(contextId)) {
      const contextEntry: ContextEntry<T> = {
        id: contextId,
        context,
        currentValue: undefined as T, // Will be set on first access
        subscriptions: new Set(),
        lastAccessed: Date.now(),
        changeHistory: [],
      };
      contextsRef.current.set(contextId, contextEntry);
    }

    const contextEntry = contextsRef.current.get(contextId)!;
    contextEntry.subscriptions.add(subscriptionId);

    // Call immediately if requested
    if (immediate && isFirstCall) {
      try {
        // This would use the actual context value in a real implementation
        // For now, we simulate getting the context value
        const currentValue = contextEntry.currentValue;
        if (currentValue !== undefined) {
          debouncedCallback(currentValue);
        }
        isFirstCall = false;
      } catch (error) {
        logError(`Error getting initial context value for ${subscriptionId}:`, "Error", error);
      }
    }

    return subscriptionId;
  }, [generateSubscriptionId, createTimeout, clearTimer]);

  // Create subscription group for batch operations
  const createSubscriptionGroup = useCallback((
    name: string,
    subscriptionIds: string[],
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      enabled?: boolean;
    } = {}
  ): string => {
    const groupId = `sub_group_${name}_${Date.now()}`;
    const { priority = 'normal', enabled = true } = options;

    const group: SubscriptionGroup = {
      id: groupId,
      name,
      subscriptionIds: [...subscriptionIds],
      enabled,
      priority,
      cleanup: () => {
        // Cleanup all subscriptions in the group
        subscriptionIds.forEach(subId => {
          const subscription = subscriptionsRef.current.get(subId);
          if (subscription && subscription.cleanup) {
            subscription.cleanup();
          }
        });
      },
    };

    subscriptionGroupsRef.current.set(groupId, group);
    return groupId;
  }, []);

  // Enable/disable subscription
  const setSubscriptionEnabled = useCallback((subscriptionId: string, enabled: boolean): boolean => {
    const subscription = subscriptionsRef.current.get(subscriptionId);
    if (!subscription) return false;

    subscription.isActive = enabled;
    return true;
  }, []);

  // Enable/disable subscription group
  const setSubscriptionGroupEnabled = useCallback((groupId: string, enabled: boolean): boolean => {
    const group = subscriptionGroupsRef.current.get(groupId);
    if (!group) return false;

    group.enabled = enabled;
    
    // Update all subscriptions in the group
    group.subscriptionIds.forEach(subId => {
      setSubscriptionEnabled(subId, enabled);
    });

    return true;
  }, [setSubscriptionEnabled]);

  // Simulate context value update (in real usage, this would be handled by React Context)
  const updateContextValue = useCallback(<T>(
    contextId: string,
    newValue: T,
    notifySubscriptions: boolean = true
  ): boolean => {
    const contextEntry = contextsRef.current.get(contextId);
    if (!contextEntry) return false;

    const oldValue = contextEntry.currentValue;
    contextEntry.currentValue = newValue;
    contextEntry.lastAccessed = Date.now();

    // Track change history
    contextEntry.changeHistory.push({
      timestamp: Date.now(),
      oldValue,
      newValue,
    });

    // Keep only last 50 changes
    if (contextEntry.changeHistory.length > 50) {
      contextEntry.changeHistory = contextEntry.changeHistory.slice(-50);
    }

    // Notify active subscriptions
    if (notifySubscriptions) {
      contextEntry.subscriptions.forEach(subId => {
        const subscription = subscriptionsRef.current.get(subId);
        if (subscription && subscription.isActive) {
          subscription.callback(newValue);
        }
      });
    }

    return true;
  }, []);

  // Get subscription status
  const getSubscriptionStatus = useCallback(() => {
    const subscriptions = Array.from(subscriptionsRef.current.values());
    const contexts = Array.from(contextsRef.current.values());
    const groups = Array.from(subscriptionGroupsRef.current.values());
    const now = Date.now();

    return {
      subscriptions: {
        total: subscriptions.length,
        active: subscriptions.filter(s => s.isActive).length,
        inactive: subscriptions.filter(s => !s.isActive).length,
        byPriority: subscriptions.reduce((acc, sub) => {
          const priority = 'normal'; // Would extract from subscription options
          acc[priority] = (acc[priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentlyTriggered: subscriptions.filter(s => 
          s.lastTriggered && (now - s.lastTriggered) < 60000 // Last minute
        ).length,
        neverTriggered: subscriptions.filter(s => !s.lastTriggered).length,
      },
      contexts: {
        total: contexts.length,
        active: contexts.filter(c => c.subscriptions.size > 0).length,
        recentlyAccessed: contexts.filter(c => (now - c.lastAccessed) < 300000).length, // 5 minutes
        withHistory: contexts.filter(c => c.changeHistory.length > 0).length,
      },
      groups: {
        total: groups.length,
        enabled: groups.filter(g => g.enabled).length,
        byPriority: groups.reduce((acc, group) => {
          acc[group.priority] = (acc[group.priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };
  }, []);

  // Find potential subscription leaks
  const findSubscriptionLeaks = useCallback(() => {
    const subscriptions = Array.from(subscriptionsRef.current.values());
    const contexts = Array.from(contextsRef.current.values());
    const now = Date.now();
    
    const leaks: Array<{
      id: string;
      type: 'subscription' | 'context';
      issue: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    // Check for subscriptions that are never triggered
    subscriptions.forEach(subscription => {
      if (!subscription.lastTriggered && subscription.isActive) {
        leaks.push({
          id: subscription.id,
          type: 'subscription',
          issue: 'Subscription never triggered but still active',
          severity: 'medium',
          recommendation: 'Check if subscription is needed or if context is providing values',
        });
      }

      // Check for subscriptions with very high trigger count
      if (subscription.subscriptionCount > 1000) {
        leaks.push({
          id: subscription.id,
          type: 'subscription',
          issue: `Very high trigger count: ${subscription.subscriptionCount}`,
          severity: 'high',
          recommendation: 'Check for excessive context updates or consider debouncing',
        });
      }

      // Check for inactive subscriptions not cleaned up
      if (!subscription.isActive && subscription.lastTriggered && 
          (now - subscription.lastTriggered) > 300000) { // 5 minutes
        leaks.push({
          id: subscription.id,
          type: 'subscription',
          issue: 'Inactive subscription not cleaned up',
          severity: 'low',
          recommendation: 'Clean up inactive subscriptions to free memory',
        });
      }
    });

    // Check for contexts with many subscriptions
    contexts.forEach(context => {
      if (context.subscriptions.size > 20) {
        leaks.push({
          id: context.id,
          type: 'context',
          issue: `High subscription count: ${context.subscriptions.size} subscriptions`,
          severity: 'medium',
          recommendation: 'Consider context splitting or subscription optimization',
        });
      }

      // Check for contexts with excessive change history
      if (context.changeHistory.length > 30) {
        leaks.push({
          id: context.id,
          type: 'context',
          issue: `Frequent context changes: ${context.changeHistory.length} recent changes`,
          severity: 'medium',
          recommendation: 'Consider reducing context update frequency or state normalization',
        });
      }

      // Check for stale contexts
      if (context.subscriptions.size === 0 && (now - context.lastAccessed) > 600000) { // 10 minutes
        leaks.push({
          id: context.id,
          type: 'context',
          issue: 'Stale context with no subscriptions',
          severity: 'low',
          recommendation: 'Remove unused context tracking',
        });
      }
    });

    return leaks;
  }, []);

  // Cleanup specific subscription
  const unsubscribe = useCallback((subscriptionId: string): boolean => {
    const subscription = subscriptionsRef.current.get(subscriptionId);
    if (!subscription) return false;

    try {
      // Run custom cleanup
      if (subscription.cleanup) {
        subscription.cleanup();
      }

      // Remove from tracking
      subscriptionsRef.current.delete(subscriptionId);
      
      return true;
    } catch (error) {
      logError(`Error unsubscribing ${subscriptionId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cleanup subscription group
  const cleanupSubscriptionGroup = useCallback((groupId: string): boolean => {
    const group = subscriptionGroupsRef.current.get(groupId);
    if (!group) return false;

    try {
      if (group.cleanup) {
        group.cleanup();
      }
      
      subscriptionGroupsRef.current.delete(groupId);
      return true;
    } catch (error) {
      logError(`Error cleaning up subscription group ${groupId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cleanup all subscriptions
  const cleanupAllSubscriptions = useCallback((): {
    cleaned: { subscriptions: number; contexts: number; groups: number };
    errors: string[];
  } => {
    const result = {
      cleaned: { subscriptions: 0, contexts: 0, groups: 0 },
      errors: [] as string[],
    };

    // Cleanup all groups first
    for (const [groupId] of subscriptionGroupsRef.current.entries()) {
      try {
        if (cleanupSubscriptionGroup(groupId)) {
          result.cleaned.groups++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup subscription group ${groupId}: ${error}`);
      }
    }

    // Cleanup all subscriptions
    for (const [subscriptionId] of subscriptionsRef.current.entries()) {
      try {
        if (unsubscribe(subscriptionId)) {
          result.cleaned.subscriptions++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup subscription ${subscriptionId}: ${error}`);
      }
    }

    // Clear context tracking
    const contextCount = contextsRef.current.size;
    contextsRef.current.clear();
    result.cleaned.contexts = contextCount;

    return result;
  }, [unsubscribe, cleanupSubscriptionGroup]);

  // Batch subscription operations
  const batchSubscriptionOperations = useCallback((
    operations: Array<{
      type: 'subscribe' | 'unsubscribe' | 'enable' | 'disable';
      context?: Context<any>;
      callback?: (value: any) => void;
      subscriptionId?: string;
      options?: any;
    }>
  ): Array<{ success: boolean; result?: string; error?: string }> => {
    return operations.map(op => {
      try {
        switch (op.type) {
          case 'subscribe':
            if (!op.context || !op.callback) {
              return { success: false, error: 'Missing context or callback' };
            }
            const subId = subscribeToContext(op.context, op.callback, op.options);
            return { success: true, result: subId };

          case 'unsubscribe':
            if (!op.subscriptionId) {
              return { success: false, error: 'Missing subscription ID' };
            }
            const unsubSuccess = unsubscribe(op.subscriptionId);
            return { success: unsubSuccess };

          case 'enable':
          case 'disable':
            if (!op.subscriptionId) {
              return { success: false, error: 'Missing subscription ID' };
            }
            const enableSuccess = setSubscriptionEnabled(op.subscriptionId, op.type === 'enable');
            return { success: enableSuccess };

          default:
            return { success: false, error: 'Unknown operation type' };
        }
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });
  }, [subscribeToContext, unsubscribe, setSubscriptionEnabled]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanupResult = cleanupAllSubscriptions();
      if (__DEV__ && (cleanupResult.cleaned.subscriptions > 0 || cleanupResult.cleaned.groups > 0)) {
        logDebug(`🧹 Context subscription cleanup on unmount:`, "Debug", cleanupResult.cleaned);
        if (cleanupResult.errors.length > 0) {
          logWarn('🚨 Context subscription cleanup errors:', "Warning", cleanupResult.errors);
        }
      }
    };
  }, [cleanupAllSubscriptions]);

  return {
    // Subscription management
    subscribeToContext,
    unsubscribe,
    
    // Group management
    createSubscriptionGroup,
    cleanupSubscriptionGroup,
    
    // Control operations
    setSubscriptionEnabled,
    setSubscriptionGroupEnabled,
    updateContextValue,
    
    // Batch operations
    batchSubscriptionOperations,
    
    // Status and debugging
    getSubscriptionStatus,
    findSubscriptionLeaks,
    
    // Cleanup operations
    cleanupAllSubscriptions,
  };
};

// Specialized hook for React Context integration
export const useReactContextManager = () => {
  const contextManager = useContextSubscriptions();

  // Enhanced context subscription with React-specific features
  const useContextWithCleanup = useCallback(<T>(
    context: Context<T>,
    selector?: (value: T) => any,
    options: {
      description?: string;
      debounceMs?: number;
      equalityFn?: (a: any, b: any) => boolean;
    } = {}
  ) => {
    const { description, debounceMs, equalityFn = Object.is } = options;
    const currentValueRef = useRef<any>();
    const [, forceUpdate] = useState({});

    const contextValue = useContext(context);
    const selectedValue = selector ? selector(contextValue) : contextValue;

    // Subscribe to context changes
    useEffect(() => {
      if (!equalityFn(currentValueRef.current, selectedValue)) {
        currentValueRef.current = selectedValue;
        forceUpdate({});
      }

      const subscriptionId = contextManager.subscribeToContext(
        context,
        (newValue: T) => {
          const newSelectedValue = selector ? selector(newValue) : newValue;
          if (!equalityFn(currentValueRef.current, newSelectedValue)) {
            currentValueRef.current = newSelectedValue;
            forceUpdate({});
          }
        },
        { description, debounceMs, immediate: false }
      );

      return () => {
        contextManager.unsubscribe(subscriptionId);
      };
    }, [context, selector, description, debounceMs, equalityFn]);

    return selectedValue;
  }, [contextManager]);

  return {
    ...contextManager,
    useContextWithCleanup,
  };
};
