import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { SharedValue } from 'react-native-reanimated';
import {
  Conversation,
  PotentialMatch,
  MatchingFilters,
  EmailPreferences,
  EmailQueueStatus,
  EmailAnalytics,
} from '../types/unified-app.types';
import type { DisplayNotification } from '../services/NotificationHandlers';
import type { NotificationPreferences } from '../types/notification-types';

// Unified App State Interface following Single Responsibility Principle
interface UnifiedAppState {
  // UI State
  ui: {
    isLoading: boolean;
    errors: Record<string, string>;
    theme: 'light' | 'dark';
    activeModal: string | null;
  };
  // Messaging State
  messaging: {
    conversations: Conversation[];
    unreadCounts: Record<string, number>;
    activeConversation: string | null;
  };
  // Matching State
  matching: {
    potentialMatches: PotentialMatch[];
    currentMatchIndex: number;
    matchingFilters: MatchingFilters | null;
  };
  // Subscription State
  subscription: {
    isActive: boolean;
    plan: string | null;
    features: string[];
  };
  // Animation State
  animation: {
    activeAnimations: Set<string>;
    sharedValues: Map<string, SharedValue<number>>;
  };
  // Notification State
  notifications: {
    isInitialized: boolean;
    pushToken: string | null;
    permissions: 'granted' | 'denied' | 'undetermined';
    unreadCount: number;
    recentNotifications: DisplayNotification[];
    preferences: NotificationPreferences | null;
  };
  // Email State
  email: {
    isInitialized: boolean;
    preferences: EmailPreferences | null;
    queueStatus: EmailQueueStatus;
    analytics: EmailAnalytics;
  };
}

// Action Types following Command Query Separation
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: { key: string; message: string } }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'UPDATE_UNREAD_COUNT'; payload: { conversationId: string; count: number } }
  | { type: 'SET_MATCHES'; payload: PotentialMatch[] }
  | { type: 'UPDATE_MATCH_INDEX'; payload: number }
  | { type: 'SET_SUBSCRIPTION'; payload: { isActive: boolean; plan: string | null; features: string[] } }
  | { type: 'REGISTER_ANIMATION'; payload: string }
  | { type: 'UNREGISTER_ANIMATION'; payload: string }
  | { type: 'SET_NOTIFICATION_INITIALIZED'; payload: boolean }
  | { type: 'SET_PUSH_TOKEN'; payload: string | null }
  | { type: 'SET_NOTIFICATION_PERMISSIONS'; payload: 'granted' | 'denied' | 'undetermined' }
  | { type: 'SET_NOTIFICATION_UNREAD_COUNT'; payload: number }
  | { type: 'ADD_RECENT_NOTIFICATION'; payload: DisplayNotification }
  | { type: 'CLEAR_RECENT_NOTIFICATIONS' }
  | { type: 'SET_NOTIFICATION_PREFERENCES'; payload: NotificationPreferences }
  | { type: 'SET_EMAIL_INITIALIZED'; payload: boolean }
  | { type: 'SET_EMAIL_PREFERENCES'; payload: EmailPreferences }
  | { type: 'UPDATE_EMAIL_QUEUE_STATUS'; payload: EmailQueueStatus }
  | { type: 'UPDATE_EMAIL_ANALYTICS'; payload: EmailAnalytics }
  | { type: 'RESET_STATE' };

// Initial State following Defensive Programming
const initialState: UnifiedAppState = {
  ui: {
    isLoading: false,
    errors: {},
    theme: 'light',
    activeModal: null,
  },
  messaging: {
    conversations: [],
    unreadCounts: {},
    activeConversation: null,
  },
  matching: {
    potentialMatches: [],
    currentMatchIndex: 0,
    matchingFilters: null,
  },
  subscription: {
    isActive: false,
    plan: null,
    features: [],
  },
  animation: {
    activeAnimations: new Set(),
    sharedValues: new Map(),
  },
  notifications: {
    isInitialized: false,
    pushToken: null,
    permissions: 'undetermined',
    unreadCount: 0,
    recentNotifications: [],
    preferences: null,
  },
  email: {
    isInitialized: false,
    preferences: null,
    queueStatus: {
      isProcessing: false,
      queueSize: 0,
      processingCount: 0,
      deadLetterQueueSize: 0,
    },
    analytics: {
      totalSent: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
    },
  },
};

// Reducer following Single Responsibility and Fail Fast principles
const appReducer = (state: UnifiedAppState, action: AppAction): UnifiedAppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload },
      };

    case 'SET_ERROR':
      return {
        ...state,
        ui: {
          ...state.ui,
          errors: { ...state.ui.errors, [action.payload.key]: action.payload.message },
        },
      };

    case 'CLEAR_ERROR':
      const newErrors = { ...state.ui.errors };
      delete newErrors[action.payload];
      return {
        ...state,
        ui: { ...state.ui, errors: newErrors },
      };

    case 'SET_CONVERSATIONS':
      return {
        ...state,
        messaging: { ...state.messaging, conversations: action.payload },
      };

    case 'UPDATE_UNREAD_COUNT':
      return {
        ...state,
        messaging: {
          ...state.messaging,
          unreadCounts: {
            ...state.messaging.unreadCounts,
            [action.payload.conversationId]: action.payload.count,
          },
        },
      };

    case 'SET_MATCHES':
      return {
        ...state,
        matching: { ...state.matching, potentialMatches: action.payload },
      };

    case 'UPDATE_MATCH_INDEX':
      return {
        ...state,
        matching: { ...state.matching, currentMatchIndex: action.payload },
      };

    case 'SET_SUBSCRIPTION':
      return {
        ...state,
        subscription: action.payload,
      };

    case 'REGISTER_ANIMATION':
      const newActiveAnimations = new Set(state.animation.activeAnimations);
      newActiveAnimations.add(action.payload);
      return {
        ...state,
        animation: { ...state.animation, activeAnimations: newActiveAnimations },
      };

    case 'UNREGISTER_ANIMATION':
      const updatedActiveAnimations = new Set(state.animation.activeAnimations);
      updatedActiveAnimations.delete(action.payload);
      return {
        ...state,
        animation: { ...state.animation, activeAnimations: updatedActiveAnimations },
      };

    case 'SET_NOTIFICATION_INITIALIZED':
      return {
        ...state,
        notifications: { ...state.notifications, isInitialized: action.payload },
      };

    case 'SET_PUSH_TOKEN':
      return {
        ...state,
        notifications: { ...state.notifications, pushToken: action.payload },
      };

    case 'SET_NOTIFICATION_PERMISSIONS':
      return {
        ...state,
        notifications: { ...state.notifications, permissions: action.payload },
      };

    case 'SET_NOTIFICATION_UNREAD_COUNT':
      return {
        ...state,
        notifications: { ...state.notifications, unreadCount: action.payload },
      };

    case 'ADD_RECENT_NOTIFICATION':
      const updatedNotifications = [action.payload, ...state.notifications.recentNotifications.slice(0, 9)];
      return {
        ...state,
        notifications: { ...state.notifications, recentNotifications: updatedNotifications },
      };

    case 'CLEAR_RECENT_NOTIFICATIONS':
      return {
        ...state,
        notifications: { ...state.notifications, recentNotifications: [] },
      };

    case 'SET_NOTIFICATION_PREFERENCES':
      return {
        ...state,
        notifications: { ...state.notifications, preferences: action.payload },
      };

    case 'SET_EMAIL_INITIALIZED':
      return {
        ...state,
        email: { ...state.email, isInitialized: action.payload },
      };

    case 'SET_EMAIL_PREFERENCES':
      return {
        ...state,
        email: { ...state.email, preferences: action.payload },
      };

    case 'UPDATE_EMAIL_QUEUE_STATUS':
      return {
        ...state,
        email: { ...state.email, queueStatus: action.payload },
      };

    case 'UPDATE_EMAIL_ANALYTICS':
      return {
        ...state,
        email: { ...state.email, analytics: action.payload },
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
};

// Context Value Interface following Dependency Injection
interface UnifiedAppContextValue {
  state: UnifiedAppState;
  dispatch: React.Dispatch<AppAction>;
  // Specific Action Creators following Command Pattern
  actions: {
    setLoading: (loading: boolean) => void;
    setError: (key: string, message: string) => void;
    clearError: (key: string) => void;
    setConversations: (conversations: Conversation[]) => void;
    updateUnreadCount: (conversationId: string, count: number) => void;
    setMatches: (matches: PotentialMatch[]) => void;
    updateMatchIndex: (index: number) => void;
    setSubscription: (subscription: { isActive: boolean; plan: string | null; features: string[] }) => void;
    registerAnimation: (id: string) => void;
    unregisterAnimation: (id: string) => void;
    setNotificationInitialized: (initialized: boolean) => void;
    setPushToken: (token: string | null) => void;
    setNotificationPermissions: (permissions: 'granted' | 'denied' | 'undetermined') => void;
    setNotificationUnreadCount: (count: number) => void;
    addRecentNotification: (notification: DisplayNotification) => void;
    clearRecentNotifications: () => void;
    setNotificationPreferences: (preferences: NotificationPreferences) => void;
    setEmailInitialized: (initialized: boolean) => void;
    setEmailPreferences: (preferences: EmailPreferences) => void;
    updateEmailQueueStatus: (status: EmailQueueStatus) => void;
    updateEmailAnalytics: (analytics: EmailAnalytics) => void;
    resetState: () => void;
  };
  // Selectors following Query Pattern
  selectors: {
    isLoading: boolean;
    hasErrors: boolean;
    getError: (key: string) => string | undefined;
    getConversationCount: () => number;
    getTotalUnreadCount: () => number;
    getCurrentMatch: () => PotentialMatch | null;
    hasActiveAnimations: boolean;
    isSubscriptionActive: boolean;
    isNotificationInitialized: boolean;
    getNotificationUnreadCount: () => number;
    hasNotificationPermissions: boolean;
    getRecentNotifications: () => DisplayNotification[];
    hasNotificationPreferences: boolean;
    isEmailInitialized: boolean;
    hasEmailPreferences: boolean;
    getEmailQueueStatus: () => EmailQueueStatus;
    getEmailAnalytics: () => EmailAnalytics;
  };
}

// Create Context with proper error handling
const UnifiedAppContext = createContext<UnifiedAppContextValue | undefined>(undefined);

// Custom Hook with error boundary following Fail Fast principle
export const useUnifiedApp = (): UnifiedAppContextValue => {
  const context = useContext(UnifiedAppContext);
  if (!context) {
    throw new Error('useUnifiedApp must be used within a UnifiedAppProvider');
  }
  return context;
};

// Provider Component following Single Responsibility
interface UnifiedAppProviderProps {
  children: React.ReactNode;
}

export const UnifiedAppProvider: React.FC<UnifiedAppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user } = useAuth();

  // Memoized Action Creators following DRY principle
  const actions = useMemo(() => ({
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (key: string, message: string) => 
      dispatch({ type: 'SET_ERROR', payload: { key, message } }),
    clearError: (key: string) => dispatch({ type: 'CLEAR_ERROR', payload: key }),
    setConversations: (conversations: Conversation[]) => 
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations }),
    updateUnreadCount: (conversationId: string, count: number) => 
      dispatch({ type: 'UPDATE_UNREAD_COUNT', payload: { conversationId, count } }),
    setMatches: (matches: PotentialMatch[]) => dispatch({ type: 'SET_MATCHES', payload: matches }),
    updateMatchIndex: (index: number) => dispatch({ type: 'UPDATE_MATCH_INDEX', payload: index }),
    setSubscription: (subscription: { isActive: boolean; plan: string | null; features: string[] }) => 
      dispatch({ type: 'SET_SUBSCRIPTION', payload: subscription }),
    registerAnimation: (id: string) => dispatch({ type: 'REGISTER_ANIMATION', payload: id }),
    unregisterAnimation: (id: string) => dispatch({ type: 'UNREGISTER_ANIMATION', payload: id }),
    setNotificationInitialized: (initialized: boolean) => 
      dispatch({ type: 'SET_NOTIFICATION_INITIALIZED', payload: initialized }),
    setPushToken: (token: string | null) => 
      dispatch({ type: 'SET_PUSH_TOKEN', payload: token }),
    setNotificationPermissions: (permissions: 'granted' | 'denied' | 'undetermined') => 
      dispatch({ type: 'SET_NOTIFICATION_PERMISSIONS', payload: permissions }),
    setNotificationUnreadCount: (count: number) => 
      dispatch({ type: 'SET_NOTIFICATION_UNREAD_COUNT', payload: count }),
    addRecentNotification: (notification: DisplayNotification) => 
      dispatch({ type: 'ADD_RECENT_NOTIFICATION', payload: notification }),
    clearRecentNotifications: () => dispatch({ type: 'CLEAR_RECENT_NOTIFICATIONS' }),
    setNotificationPreferences: (preferences: NotificationPreferences) => 
      dispatch({ type: 'SET_NOTIFICATION_PREFERENCES', payload: preferences }),
    setEmailInitialized: (initialized: boolean) => 
      dispatch({ type: 'SET_EMAIL_INITIALIZED', payload: initialized }),
    setEmailPreferences: (preferences: EmailPreferences) => 
      dispatch({ type: 'SET_EMAIL_PREFERENCES', payload: preferences }),
    updateEmailQueueStatus: (status: EmailQueueStatus) => 
      dispatch({ type: 'UPDATE_EMAIL_QUEUE_STATUS', payload: status }),
    updateEmailAnalytics: (analytics: EmailAnalytics) => 
      dispatch({ type: 'UPDATE_EMAIL_ANALYTICS', payload: analytics }),
    resetState: () => dispatch({ type: 'RESET_STATE' }),
  }), []);

  // Memoized Selectors following Query Pattern
  const selectors = useMemo(() => ({
    isLoading: state.ui.isLoading,
    hasErrors: Object.keys(state.ui.errors).length > 0,
    getError: (key: string) => state.ui.errors[key],
    getConversationCount: () => state.messaging.conversations.length,
    getTotalUnreadCount: () => Object.values(state.messaging.unreadCounts).reduce((sum, count) => sum + count, 0),
    getCurrentMatch: () => state.matching.potentialMatches[state.matching.currentMatchIndex] || null,
    hasActiveAnimations: state.animation.activeAnimations.size > 0,
    isSubscriptionActive: state.subscription.isActive,
    isNotificationInitialized: state.notifications.isInitialized,
    getNotificationUnreadCount: () => state.notifications.unreadCount,
    hasNotificationPermissions: state.notifications.permissions === 'granted',
    getRecentNotifications: () => state.notifications.recentNotifications,
    hasNotificationPreferences: state.notifications.preferences !== null,
    isEmailInitialized: state.email.isInitialized,
    hasEmailPreferences: state.email.preferences !== null,
    getEmailQueueStatus: () => state.email.queueStatus,
    getEmailAnalytics: () => state.email.analytics,
  }), [state]);

  // Reset state when user changes (Security by Design)
  useEffect(() => {
    if (!user) {
      actions.resetState();
    }
  }, [user, actions]);

  // Context Value with memoization for performance
  const contextValue = useMemo<UnifiedAppContextValue>(() => ({
    state,
    dispatch,
    actions,
    selectors,
  }), [state, actions, selectors]);

  return (
    <UnifiedAppContext.Provider value={contextValue}>
      {children}
    </UnifiedAppContext.Provider>
  );
};

// Specialized hooks for specific domains following Separation of Concerns
export const useUIState = () => {
  const { state, actions, selectors } = useUnifiedApp();
  return {
    ui: state.ui,
    setLoading: actions.setLoading,
    setError: actions.setError,
    clearError: actions.clearError,
    isLoading: selectors.isLoading,
    hasErrors: selectors.hasErrors,
    getError: selectors.getError,
  };
};

export const useMessagingState = () => {
  const { state, actions, selectors } = useUnifiedApp();
  return {
    messaging: state.messaging,
    setConversations: actions.setConversations,
    updateUnreadCount: actions.updateUnreadCount,
    getConversationCount: selectors.getConversationCount,
    getTotalUnreadCount: selectors.getTotalUnreadCount,
  };
};

export const useMatchingState = () => {
  const { state, actions, selectors } = useUnifiedApp();
  return {
    matching: state.matching,
    setMatches: actions.setMatches,
    updateMatchIndex: actions.updateMatchIndex,
    getCurrentMatch: selectors.getCurrentMatch,
  };
};

export const useAnimationState = () => {
  const { state, actions, selectors } = useUnifiedApp();
  return {
    animation: state.animation,
    registerAnimation: actions.registerAnimation,
    unregisterAnimation: actions.unregisterAnimation,
    hasActiveAnimations: selectors.hasActiveAnimations,
  };
};

export const useNotificationState = () => {
  const { state, actions, selectors } = useUnifiedApp();
  return {
    notifications: state.notifications,
    setNotificationInitialized: actions.setNotificationInitialized,
    setPushToken: actions.setPushToken,
    setNotificationPermissions: actions.setNotificationPermissions,
    setNotificationUnreadCount: actions.setNotificationUnreadCount,
    addRecentNotification: actions.addRecentNotification,
    clearRecentNotifications: actions.clearRecentNotifications,
    setNotificationPreferences: actions.setNotificationPreferences,
    isNotificationInitialized: selectors.isNotificationInitialized,
    getNotificationUnreadCount: selectors.getNotificationUnreadCount,
    hasNotificationPermissions: selectors.hasNotificationPermissions,
    getRecentNotifications: selectors.getRecentNotifications,
    hasNotificationPreferences: selectors.hasNotificationPreferences,
  };
};

export const useEmailState = () => {
  const { state, actions, selectors } = useUnifiedApp();
  return {
    email: state.email,
    setEmailInitialized: actions.setEmailInitialized,
    setEmailPreferences: actions.setEmailPreferences,
    updateEmailQueueStatus: actions.updateEmailQueueStatus,
    updateEmailAnalytics: actions.updateEmailAnalytics,
    isEmailInitialized: selectors.isEmailInitialized,
    hasEmailPreferences: selectors.hasEmailPreferences,
    getEmailQueueStatus: selectors.getEmailQueueStatus,
    getEmailAnalytics: selectors.getEmailAnalytics,
  };
};
