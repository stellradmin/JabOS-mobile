/**
 * Production-Ready Notification Context for Stellr Dating App
 * Integrates all notification services with UnifiedAppContext
 * Following all 10 Golden Code Principles
 * 
 * Single Responsibility: Manages notification lifecycle and state
 * Dependency Injection: Abstracts notification services
 * Security by Design: Validates all notification data
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useNotificationState } from './UnifiedAppContext';
import { createNotificationService, PushNotificationService } from '../services/PushNotificationService';
import { notificationPreferencesService } from '../services/NotificationPreferencesService';
import { notificationHandlerRegistry, NotificationHandlingResult } from '../services/NotificationHandlers';
import { notificationDeepLinkService, NavigationResult } from '../services/NotificationDeepLinkService';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  StellarNotification,
  NotificationServiceError,
  DeepLinkConfig,
  NotificationType,
  NotificationPreferences,
} from '../types/notification-types';
import { DisplayNotification } from '../services/NotificationHandlers';

// Notification Context Interface following Command Query Separation
interface NotificationContextValue {
  // Service State
  readonly isInitialized: boolean;
  readonly pushToken: string | null;
  readonly hasPermissions: boolean;
  readonly unreadCount: number;
  readonly recentNotifications: DisplayNotification[];
  readonly preferences: NotificationPreferences | null;
  
  // Commands
  readonly initialize: () => Promise<void>;
  readonly requestPermissions: () => Promise<boolean>;
  readonly sendNotification: (notification: StellarNotification) => Promise<boolean>;
  readonly updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  readonly markAsRead: (notificationId: string) => Promise<void>;
  readonly clearAllNotifications: () => Promise<void>;
  readonly handleDeepLink: (deepLink: DeepLinkConfig) => Promise<NavigationResult>;
  
  // Queries
  readonly canSendNotification: (type: NotificationType) => boolean;
  readonly getNotificationById: (id: string) => DisplayNotification | null;
  readonly shouldShowNotification: (type: NotificationType) => boolean;
  
  // Event Handlers (for navigation)
  readonly onNavigationRequested?: (result: NavigationResult) => void;
  readonly onNotificationReceived?: (notification: DisplayNotification) => void;
  readonly onError?: (error: NotificationServiceError) => void;
}

// Event Handler Interface for external components
export interface NotificationEventHandlers {
  onNavigationRequested?: (result: NavigationResult) => void;
  onNotificationReceived?: (notification: DisplayNotification) => void;
  onError?: (error: NotificationServiceError) => void;
}

// Create Context with error handling
const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// Custom Hook with error boundary following Fail Fast principle
export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Provider Props Interface
interface NotificationProviderProps {
  children: React.ReactNode;
  eventHandlers?: NotificationEventHandlers;
}

/**
 * Notification Provider Component
 * Manages the complete notification lifecycle with error handling and recovery
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  eventHandlers
}) => {
  const { user } = useAuth();
  const {
    notifications,
    setNotificationInitialized,
    setPushToken,
    setNotificationPermissions,
    setNotificationUnreadCount,
    addRecentNotification,
    clearRecentNotifications,
    setNotificationPreferences,
  } = useNotificationState();

  // Service references
  const notificationServiceRef = useRef<PushNotificationService | null>(null);
  const appStateRef = useRef<import('react-native').AppStateStatus>(AppState.currentState as import('react-native').AppStateStatus);
  const initializationRef = useRef<Promise<void> | null>(null);

  // Error handling state
  const lastErrorRef = useRef<NotificationServiceError | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  /**
   * Initialize notification services with comprehensive error handling
   * Following Fail Fast and Defensive Programming principles
   */
  const initialize = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      throw new NotificationServiceError(
        'Cannot initialize notifications without authenticated user',
        'NO_USER',
        false
      );
    }

    if (notifications.isInitialized) {
      return;
    }

    // Prevent multiple simultaneous initializations
    if (initializationRef.current) {
      return initializationRef.current;
    }

    initializationRef.current = (async () => {
      try {
        retryCountRef.current = 0;
        
        // Create and initialize push notification service
        notificationServiceRef.current = await createNotificationService();
        await notificationServiceRef.current.initialize(user.id);

        // Setup event handlers
        setupNotificationEventHandlers();

        // Initialize deep link service
        await notificationDeepLinkService.initialize(user.id, user.role);

        // Load user preferences
        const userPreferences = await notificationPreferencesService.getPreferences(user.id);
        setNotificationPreferences(userPreferences);

        // Get push token
        const pushToken = notificationServiceRef.current.getPushToken();
        setPushToken(pushToken);

        // Update permission status
        const hasPermissions = notificationServiceRef.current.isServiceInitialized();
        setNotificationPermissions(hasPermissions ? 'granted' : 'denied');

        // Mark as initialized
        setNotificationInitialized(true);

        logDebug('Notification service initialized successfully', "Debug");
        
      } catch (error) {
        logError('Failed to initialize notification service:', "Error", error);
        
        // Handle initialization error
        const serviceError = error instanceof NotificationServiceError 
          ? error 
          : new NotificationServiceError(
              `Initialization failed: ${error.message}`,
              'INITIALIZATION_FAILED',
              true,
              error
            );

        lastErrorRef.current = serviceError;
        
        // Notify error handler
        if (eventHandlers?.onError) {
          eventHandlers.onError(serviceError);
        }

        // Don't throw - allow graceful degradation
        logWarn('Notification service running in degraded mode', "Warning");
      } finally {
        initializationRef.current = null;
      }
    })();

    return initializationRef.current;
  }, [user, notifications.isInitialized, eventHandlers, setNotificationInitialized, setPushToken, setNotificationPermissions, setNotificationPreferences]);

  /**
   * Request notification permissions with user-friendly handling
   * Following Command Pattern and User Experience best practices
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!notificationServiceRef.current) {
      await initialize();
    }

    if (!notificationServiceRef.current) {
      return false;
    }

    try {
      // Request permissions through service
      await notificationServiceRef.current.requestPermissions?.();
      
      const hasPermissions = notificationServiceRef.current.isServiceInitialized();
      setNotificationPermissions(hasPermissions ? 'granted' : 'denied');
      
      return hasPermissions;
      
    } catch (error) {
      logError('Failed to request notification permissions:', "Error", error);
      setNotificationPermissions('denied');
      return false;
    }
  }, [initialize, setNotificationPermissions]);

  /**
   * Send notification with validation and error handling
   * Following Command Pattern and Security by Design
   */
  const sendNotification = useCallback(async (
    notification: StellarNotification
  ): Promise<boolean> => {
    if (!notificationServiceRef.current || !notifications.isInitialized) {
      logWarn('Notification service not initialized, "Warning", cannot send notification');
      return false;
    }

    try {
      // Validate notification
      if (!notification.userId || notification.userId !== user?.id) {
        throw new NotificationServiceError(
          'Invalid notification: user ID mismatch',
          'INVALID_USER',
          false
        );
      }

      // Check if user can receive this notification type
      if (!canSendNotification(notification.type)) {
        logDebug(`Notification blocked by preferences: ${notification.type}`, "Debug");
        return false;
      }

      // Send through service
      const success = await notificationServiceRef.current.sendNotification(notification);
      
      if (success) {
        // Add to recent notifications for UI
        const displayNotification = notificationHandlerRegistry.formatForDisplay(notification);
        if (displayNotification) {
          addRecentNotification(displayNotification);
        }
      }

      return success;
      
    } catch (error) {
      logError('Failed to send notification:', "Error", error);
      
      if (eventHandlers?.onError) {
        const serviceError = error instanceof NotificationServiceError 
          ? error 
          : new NotificationServiceError(
              `Send failed: ${error.message}`,
              'SEND_FAILED',
              true,
              error
            );
        eventHandlers.onError(serviceError);
      }
      
      return false;
    }
  }, [notifications.isInitialized, user?.id, addRecentNotification, eventHandlers]);

  /**
   * Update user notification preferences
   * Following Command Pattern with validation
   */
  const updatePreferences = useCallback(async (
    updates: Partial<NotificationPreferences>
  ): Promise<void> => {
    if (!user?.id) {
      throw new NotificationServiceError(
        'Cannot update preferences without authenticated user',
        'NO_USER',
        false
      );
    }

    try {
      const updatedPreferences = await notificationPreferencesService.updatePreferences(
        user.id,
        updates
      );
      
      setNotificationPreferences(updatedPreferences);
      
    } catch (error) {
      const serviceError = error instanceof NotificationServiceError 
        ? error 
        : new NotificationServiceError(
            `Failed to update preferences: ${error.message}`,
            'PREFERENCES_UPDATE_FAILED',
            true,
            error
          );
      
      if (eventHandlers?.onError) {
        eventHandlers.onError(serviceError);
      }
      
      throw serviceError;
    }
  }, [user?.id, setNotificationPreferences, eventHandlers]);

  /**
   * Mark notification as read
   * Following Command Pattern
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      // Update local state
      const updatedNotifications = notifications.recentNotifications.filter(
        n => n.id !== notificationId
      );
      
      // Recalculate unread count
      const newUnreadCount = Math.max(0, notifications.unreadCount - 1);
      setNotificationUnreadCount(newUnreadCount);
      
    } catch (error) {
      logError('Failed to mark notification as read:', "Error", error);
    }
  }, [notifications.recentNotifications, notifications.unreadCount, setNotificationUnreadCount]);

  /**
   * Clear all notifications
   * Following Command Pattern
   */
  const clearAllNotifications = useCallback(async (): Promise<void> => {
    try {
      clearRecentNotifications();
      setNotificationUnreadCount(0);
      
    } catch (error) {
      logError('Failed to clear notifications:', "Error", error);
    }
  }, [clearRecentNotifications, setNotificationUnreadCount]);

  /**
   * Handle deep link navigation
   * Following Command Pattern with comprehensive error handling
   */
  const handleDeepLink = useCallback(async (
    deepLink: DeepLinkConfig
  ): Promise<NavigationResult> => {
    try {
      const result = await notificationDeepLinkService.handleDeepLink(deepLink);
      
      // Notify navigation handler
      if (eventHandlers?.onNavigationRequested) {
        eventHandlers.onNavigationRequested(result);
      }
      
      return result;
      
    } catch (error) {
      const navigationResult: NavigationResult = {
        success: false,
        action: 'blocked',
        error: error.message,
      };
      
      if (eventHandlers?.onNavigationRequested) {
        eventHandlers.onNavigationRequested(navigationResult);
      }
      
      return navigationResult;
    }
  }, [eventHandlers]);

  // Query Methods following Query Pattern

  const canSendNotification = useCallback((type: NotificationType): boolean => {
    if (!notifications.preferences) {
      return true; // Default to allowing if no preferences loaded
    }

    const typePreferences = notifications.preferences.preferences[type];
    return typePreferences?.enabled ?? true;
  }, [notifications.preferences]);

  const getNotificationById = useCallback((id: string): DisplayNotification | null => {
    return notifications.recentNotifications.find(n => n.id === id) || null;
  }, [notifications.recentNotifications]);

  const shouldShowNotification = useCallback((type: NotificationType): boolean => {
    if (!notifications.preferences) {
      return true;
    }

    return canSendNotification(type);
  }, [notifications.preferences, canSendNotification]);

  /**
   * Setup notification event handlers with proper error handling
   * Following Observer Pattern and Separation of Concerns
   */
  const setupNotificationEventHandlers = useCallback(() => {
    if (!notificationServiceRef.current) {
      return;
    }

    // Handle received notifications
    notificationServiceRef.current.on('onNotificationReceived', async (notification: StellarNotification) => {
      try {
        const handlingResult = await notificationHandlerRegistry.handleNotification(notification);
        
        if (handlingResult.success) {
          // Convert to display format
        const displayNotification = notificationHandlerRegistry.formatForDisplay(notification);
        if (displayNotification) {
          addRecentNotification(displayNotification);
          
          // Update unread count
          setNotificationUnreadCount(notifications.unreadCount + 1);
            
            // Notify event handler
            if (eventHandlers?.onNotificationReceived) {
              eventHandlers.onNotificationReceived(displayNotification);
            }
          }
        }
        
      } catch (error) {
        logError('Failed to handle received notification:', "Error", error);
      }
    });

    // Handle notification opened (user tapped)
    notificationServiceRef.current.on('onNotificationOpened', async (
      notification: StellarNotification,
      deepLink?: DeepLinkConfig
    ) => {
      try {
        if (deepLink) {
          await handleDeepLink(deepLink);
        }
        
        // Mark as read
        await markAsRead(notification.id);
        
      } catch (error) {
        logError('Failed to handle notification opened:', "Error", error);
      }
    });

    // Handle service errors
    notificationServiceRef.current.on('onError', (error: NotificationServiceError) => {
      lastErrorRef.current = error;
      
      if (eventHandlers?.onError) {
        eventHandlers.onError(error);
      }
    });

    // Handle token updates
    notificationServiceRef.current.on('onTokenReceived', (token: string) => {
      setPushToken(token);
    });

  }, [addRecentNotification, setNotificationUnreadCount, notifications.unreadCount, eventHandlers, handleDeepLink, markAsRead, setPushToken]);

  /**
   * Handle app state changes for background/foreground transitions
   * Following Reactive Programming principles
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: import('react-native').AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - process any pending navigations
        notificationDeepLinkService.processPendingNavigations().catch(error => 
          logWarn('Failed to process pending navigations:', "Warning", error)
        );
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  /**
   * Initialize service when user changes
   * Following Reactive Programming and Security by Design
   */
  useEffect(() => {
    if (user?.id && !notifications.isInitialized) {
      initialize().catch(error => {
        logError('Failed to initialize notifications on user change:', "Error", error);
      });
    } else if (!user?.id) {
      // Clear state when user logs out
      setNotificationInitialized(false);
      setPushToken(null);
      setNotificationPermissions('undetermined');
      clearRecentNotifications();
      setNotificationUnreadCount(0);
      
      // Update deep link service
      notificationDeepLinkService.updateUserContext(null);
    }
  }, [user?.id, notifications.isInitialized, initialize, setNotificationInitialized, setPushToken, setNotificationPermissions, clearRecentNotifications, setNotificationUnreadCount]);

  /**
   * Cleanup on unmount
   * Following Defensive Programming
   */
  useEffect(() => {
    return () => {
      if (notificationServiceRef.current) {
        notificationServiceRef.current.destroy().catch(error => 
          logWarn('Failed to cleanup notification service:', "Warning", error)
        );
        notificationServiceRef.current = null;
      }
    };
  }, []);

  // Memoized context value for performance
  const contextValue = useMemo<NotificationContextValue>(() => ({
    // State
    isInitialized: notifications.isInitialized,
    pushToken: notifications.pushToken,
    hasPermissions: notifications.permissions === 'granted',
    unreadCount: notifications.unreadCount,
    recentNotifications: notifications.recentNotifications.map(n => 
      notificationHandlerRegistry.formatForDisplay(n as any) || n
    ).filter(Boolean) as DisplayNotification[],
    preferences: notifications.preferences,
    
    // Commands
    initialize,
    requestPermissions,
    sendNotification,
    updatePreferences,
    markAsRead,
    clearAllNotifications,
    handleDeepLink,
    
    // Queries
    canSendNotification,
    getNotificationById,
    shouldShowNotification,
    
    // Event handlers (passed through)
    onNavigationRequested: eventHandlers?.onNavigationRequested,
    onNotificationReceived: eventHandlers?.onNotificationReceived,
    onError: eventHandlers?.onError,
  }), [
    notifications,
    initialize,
    requestPermissions,
    sendNotification,
    updatePreferences,
    markAsRead,
    clearAllNotifications,
    handleDeepLink,
    canSendNotification,
    getNotificationById,
    shouldShowNotification,
    eventHandlers
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

// Export types for external use
export type { NotificationContextValue, DisplayNotification, NavigationResult, DeepLinkConfig, StellarNotification, NotificationServiceError, NotificationPreferences };
