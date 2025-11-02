// Event listener management with automatic cleanup
// Prevents memory leaks from DOM event listeners and React Native event subscriptions
// Manages event listener lifecycle and provides cleanup utilities

import { useRef, useCallback, useEffect } from 'react';
import { Platform, Dimensions, AppState, Keyboard, DeviceEventEmitter, NativeEventEmitter } from 'react-native';
import { useTimers } from './useTimers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface EventListenerEntry {
  id: string;
  target: EventTarget | any; // React Native event emitters
  event: string;
  handler: EventListener | Function;
  options?: AddEventListenerOptions | boolean;
  description?: string;
  isActive: boolean;
  addedAt: number;
  triggerCount: number;
  lastTriggered?: number;
  cleanup?: () => void;
}

interface EventGroup {
  id: string;
  name: string;
  listenerIds: string[];
  enabled: boolean;
  description?: string;
  cleanup?: () => void;
}

interface ThrottleConfig {
  delay: number;
  leading?: boolean;
  trailing?: boolean;
}

interface DebounceConfig {
  delay: number;
  immediate?: boolean;
}

export const useEventListeners = () => {
  const { createTimeout, clearTimer } = useTimers();
  
  const listenersRef = useRef<Map<string, EventListenerEntry>>(new Map());
  const groupsRef = useRef<Map<string, EventGroup>>(new Map());
  const throttleTimersRef = useRef<Map<string, string>>(new Map());
  const debounceTimersRef = useRef<Map<string, string>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique listener ID
  const generateListenerId = useCallback((event: string, target?: string) => {
    return `listener_${event}_${target || 'unknown'}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Create throttled event handler
  const createThrottledHandler = useCallback((
    handler: Function,
    config: ThrottleConfig,
    listenerId: string
  ): Function => {
    const { delay, leading = true, trailing = true } = config;
    let lastCallTime = 0;
    let timeoutId: string | null = null;

    return (...args: any[]) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;

      const callFunction = () => {
        lastCallTime = now;
        handler(...args);
        
        // Update trigger count
        const listener = listenersRef.current.get(listenerId);
        if (listener) {
          listener.triggerCount++;
          listener.lastTriggered = Date.now();
        }
      };

      // If this is the first call or enough time has passed
      if (lastCallTime === 0 || timeSinceLastCall >= delay) {
        if (leading) {
          callFunction();
        }
        
        if (trailing && timeoutId) {
          clearTimer(timeoutId);
          timeoutId = null;
        }
      } else if (trailing && !timeoutId) {
        // Schedule trailing call
        timeoutId = createTimeout(() => {
          callFunction();
          timeoutId = null;
        }, delay - timeSinceLastCall, `throttle_${listenerId}`);
        
        throttleTimersRef.current.set(listenerId, timeoutId);
      }
    };
  }, [createTimeout, clearTimer]);

  // Create debounced event handler
  const createDebouncedHandler = useCallback((
    handler: Function,
    config: DebounceConfig,
    listenerId: string
  ): Function => {
    const { delay, immediate = false } = config;

    return (...args: any[]) => {
      const existingTimer = debounceTimersRef.current.get(listenerId);
      
      // Clear existing timer
      if (existingTimer) {
        clearTimer(existingTimer);
      }

      // Call immediately if configured and no existing timer
      if (immediate && !existingTimer) {
        handler(...args);
        
        // Update trigger count
        const listener = listenersRef.current.get(listenerId);
        if (listener) {
          listener.triggerCount++;
          listener.lastTriggered = Date.now();
        }
      }

      // Set new timer
      const timerId = createTimeout(() => {
        if (!immediate) {
          handler(...args);
          
          // Update trigger count
          const listener = listenersRef.current.get(listenerId);
          if (listener) {
            listener.triggerCount++;
            listener.lastTriggered = Date.now();
          }
        }
        
        debounceTimersRef.current.delete(listenerId);
      }, delay, `debounce_${listenerId}`);

      debounceTimersRef.current.set(listenerId, timerId);
    };
  }, [createTimeout, clearTimer]);

  // Add DOM event listener with automatic cleanup
  const addDOMEventListener = useCallback((
    target: EventTarget,
    event: string,
    handler: EventListener,
    options: {
      listenerOptions?: AddEventListenerOptions | boolean;
      description?: string;
      throttle?: ThrottleConfig;
      debounce?: DebounceConfig;
    } = {}
  ): string => {
    const { listenerOptions, description, throttle, debounce } = options;
    const listenerId = generateListenerId(event, description);

    let finalHandler = handler;

    // Apply throttling if configured
    if (throttle) {
      finalHandler = createThrottledHandler(handler, throttle, listenerId) as EventListener;
    }

    // Apply debouncing if configured (takes precedence over throttling)
    if (debounce) {
      finalHandler = createDebouncedHandler(handler, debounce, listenerId) as EventListener;
    }

    // Enhanced handler with tracking
    const trackedHandler: EventListener = (event) => {
      const listener = listenersRef.current.get(listenerId);
      if (listener && listener.isActive) {
        if (!throttle && !debounce) {
          listener.triggerCount++;
          listener.lastTriggered = Date.now();
        }
        finalHandler(event);
      }
    };

    const entry: EventListenerEntry = {
      id: listenerId,
      target,
      event,
      handler: trackedHandler,
      options: listenerOptions,
      description: `dom-${event}-${description || 'unnamed'}`,
      isActive: true,
      addedAt: Date.now(),
      triggerCount: 0,
      cleanup: () => {
        try {
          target.removeEventListener(event, trackedHandler, listenerOptions);
        } catch (error) {
          logError(`Error removing DOM event listener ${listenerId}:`, "Error", error);
        }
        
        // Clear any throttle/debounce timers
        const throttleTimer = throttleTimersRef.current.get(listenerId);
        const debounceTimer = debounceTimersRef.current.get(listenerId);
        
        if (throttleTimer) {
          clearTimer(throttleTimer);
          throttleTimersRef.current.delete(listenerId);
        }
        
        if (debounceTimer) {
          clearTimer(debounceTimer);
          debounceTimersRef.current.delete(listenerId);
        }
      },
    };

    listenersRef.current.set(listenerId, entry);

    try {
      target.addEventListener(event, trackedHandler, listenerOptions);
    } catch (error) {
      listenersRef.current.delete(listenerId);
      throw new Error(`Failed to add DOM event listener: ${error}`);
    }

    return listenerId;
  }, [generateListenerId, createThrottledHandler, createDebouncedHandler, clearTimer]);

  // Add React Native event listener with automatic cleanup
  const addReactNativeEventListener = useCallback((
    emitter: any, // DeviceEventEmitter, NativeEventEmitter, etc.
    event: string,
    handler: Function,
    options: {
      description?: string;
      throttle?: ThrottleConfig;
      debounce?: DebounceConfig;
    } = {}
  ): string => {
    const { description, throttle, debounce } = options;
    const listenerId = generateListenerId(event, description);

    let finalHandler = handler;

    // Apply throttling if configured
    if (throttle) {
      finalHandler = createThrottledHandler(handler, throttle, listenerId);
    }

    // Apply debouncing if configured (takes precedence over throttling)
    if (debounce) {
      finalHandler = createDebouncedHandler(handler, debounce, listenerId);
    }

    // Enhanced handler with tracking
    const trackedHandler = (...args: any[]) => {
      const listener = listenersRef.current.get(listenerId);
      if (listener && listener.isActive) {
        if (!throttle && !debounce) {
          listener.triggerCount++;
          listener.lastTriggered = Date.now();
        }
        finalHandler(...args);
      }
    };

    let subscription: any;

    const entry: EventListenerEntry = {
      id: listenerId,
      target: emitter,
      event,
      handler: trackedHandler,
      description: `rn-${event}-${description || 'unnamed'}`,
      isActive: true,
      addedAt: Date.now(),
      triggerCount: 0,
      cleanup: () => {
        try {
          if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
          } else if (subscription && typeof subscription === 'object' && 'remove' in subscription) {
            // Handle subscription objects that might have remove as a property
            (subscription as any).remove();
          } else if (emitter && typeof emitter.removeListener === 'function') {
            emitter.removeListener(event, trackedHandler);
          } else if (emitter && typeof emitter.off === 'function') {
            emitter.off(event, trackedHandler);
          } else if (emitter && event && typeof emitter[`remove${event.charAt(0).toUpperCase() + event.slice(1)}Listener`] === 'function') {
            // Handle Expo-style removal (e.g., removeNotificationReceivedListener)
            const methodName = `remove${event.charAt(0).toUpperCase() + event.slice(1)}Listener`;
            emitter[methodName](trackedHandler);
          } else if (emitter && typeof emitter.removeAllListeners === 'function') {
            emitter.removeAllListeners(event);
          } else if (emitter && typeof emitter.removeNotificationSubscription === 'function' && subscription) {
            // Special case for Expo Notifications
            emitter.removeNotificationSubscription(subscription);
          }
        } catch (error) {
          logError(`Error removing React Native event listener ${listenerId}:`, "Error", error);
        }
        
        // Clear any throttle/debounce timers
        const throttleTimer = throttleTimersRef.current.get(listenerId);
        const debounceTimer = debounceTimersRef.current.get(listenerId);
        
        if (throttleTimer) {
          clearTimer(throttleTimer);
          throttleTimersRef.current.delete(listenerId);
        }
        
        if (debounceTimer) {
          clearTimer(debounceTimer);
          debounceTimersRef.current.delete(listenerId);
        }
      },
    };

    listenersRef.current.set(listenerId, entry);

    try {
      // Try different subscription methods based on the emitter type
      if (emitter && typeof emitter.addListener === 'function') {
        subscription = emitter.addListener(event, trackedHandler);
      } else if (emitter && typeof emitter.on === 'function') {
        emitter.on(event, trackedHandler);
      } else if (emitter && event && typeof emitter[`add${event.charAt(0).toUpperCase() + event.slice(1)}Listener`] === 'function') {
        // Handle Expo-style listeners (e.g., addNotificationReceivedListener)
        const methodName = `add${event.charAt(0).toUpperCase() + event.slice(1)}Listener`;
        subscription = emitter[methodName](trackedHandler);
      } else if (emitter && event && typeof emitter[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] === 'function') {
        // Handle onEvent style listeners
        const methodName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
        subscription = emitter[methodName](trackedHandler);
      } else {
        logWarn(`Emitter does not support standard event listening methods for event "${event}". Available methods:`, "Warning", Object.getOwnPropertyNames(emitter).filter(prop => typeof emitter[prop] === 'function')
        );
        throw new Error('Emitter does not support event listening');
      }
    } catch (error) {
      listenersRef.current.delete(listenerId);
      throw new Error(`Failed to add React Native event listener: ${error}`);
    }

    return listenerId;
  }, [generateListenerId, createThrottledHandler, createDebouncedHandler, clearTimer]);

  // Add common React Native event listeners
  const addDimensionsListener = useCallback((
    handler: ({ window, screen }: { window: any; screen: any }) => void,
    options?: { description?: string; throttle?: ThrottleConfig; debounce?: DebounceConfig }
  ): string => {
    return addReactNativeEventListener(
      Dimensions,
      'change',
      handler,
      { ...options, description: `dimensions-${options?.description || 'change'}` }
    );
  }, [addReactNativeEventListener]);

  const addAppStateListener = useCallback((
    handler: (nextAppState: string) => void,
    options?: { description?: string; throttle?: ThrottleConfig; debounce?: DebounceConfig }
  ): string => {
    return addReactNativeEventListener(
      AppState,
      'change',
      handler,
      { ...options, description: `appstate-${options?.description || 'change'}` }
    );
  }, [addReactNativeEventListener]);

  const addKeyboardListener = useCallback((
    event: 'keyboardDidShow' | 'keyboardDidHide' | 'keyboardWillShow' | 'keyboardWillHide',
    handler: (event: any) => void,
    options?: { description?: string; throttle?: ThrottleConfig; debounce?: DebounceConfig }
  ): string => {
    return addReactNativeEventListener(
      Keyboard,
      event,
      handler,
      { ...options, description: `keyboard-${event}-${options?.description || 'listener'}` }
    );
  }, [addReactNativeEventListener]);

  const addDeviceEventListener = useCallback((
    event: string,
    handler: (...args: any[]) => void,
    options?: { description?: string; throttle?: ThrottleConfig; debounce?: DebounceConfig }
  ): string => {
    return addReactNativeEventListener(
      DeviceEventEmitter,
      event,
      handler,
      { ...options, description: `device-${event}-${options?.description || 'listener'}` }
    );
  }, [addReactNativeEventListener]);

  // Create event listener group for batch operations
  const createEventGroup = useCallback((
    name: string,
    listenerConfigs: Array<{
      type: 'dom' | 'rn' | 'dimensions' | 'appstate' | 'keyboard' | 'device';
      target?: EventTarget | any;
      event: string;
      handler: any;
      options?: any;
    }>,
    options: {
      enabled?: boolean;
      description?: string;
    } = {}
  ): string => {
    const { enabled = true, description } = options;
    const groupId = `event_group_${name}_${Date.now()}`;
    const listenerIds: string[] = [];

    // Create all listeners
    listenerConfigs.forEach((config) => {
      try {
        let listenerId: string;

        switch (config.type) {
          case 'dom':
            if (!config.target) throw new Error('DOM event requires target');
            listenerId = addDOMEventListener(config.target, config.event, config.handler, config.options);
            break;
          case 'rn':
            if (!config.target) throw new Error('React Native event requires target/emitter');
            listenerId = addReactNativeEventListener(config.target, config.event, config.handler, config.options);
            break;
          case 'dimensions':
            listenerId = addDimensionsListener(config.handler, config.options);
            break;
          case 'appstate':
            listenerId = addAppStateListener(config.handler, config.options);
            break;
          case 'keyboard':
            listenerId = addKeyboardListener(config.event as any, config.handler, config.options);
            break;
          case 'device':
            listenerId = addDeviceEventListener(config.event, config.handler, config.options);
            break;
          default:
            throw new Error(`Unknown event listener type: ${config.type}`);
        }

        listenerIds.push(listenerId);
      } catch (error) {
        logError(`Failed to create event listener in group ${name}:`, "Error", error);
      }
    });

    const group: EventGroup = {
      id: groupId,
      name,
      listenerIds,
      enabled,
      description: `event-group-${description || name}`,
      cleanup: () => {
        // Cleanup all listeners in the group
        listenerIds.forEach(listenerId => {
          removeEventListener(listenerId);
        });
      },
    };

    groupsRef.current.set(groupId, group);
    return groupId;
  }, [addDOMEventListener, addReactNativeEventListener, addDimensionsListener, addAppStateListener, addKeyboardListener, addDeviceEventListener]);

  // Enable/disable event listener
  const setEventListenerEnabled = useCallback((listenerId: string, enabled: boolean): boolean => {
    const listener = listenersRef.current.get(listenerId);
    if (!listener) return false;

    listener.isActive = enabled;
    return true;
  }, []);

  // Enable/disable event group
  const setEventGroupEnabled = useCallback((groupId: string, enabled: boolean): boolean => {
    const group = groupsRef.current.get(groupId);
    if (!group) return false;

    group.enabled = enabled;
    
    // Update all listeners in the group
    group.listenerIds.forEach(listenerId => {
      setEventListenerEnabled(listenerId, enabled);
    });

    return true;
  }, [setEventListenerEnabled]);

  // Get event listener status
  const getEventListenerStatus = useCallback(() => {
    const listeners = Array.from(listenersRef.current.values());
    const groups = Array.from(groupsRef.current.values());
    const now = Date.now();

    return {
      listeners: {
        total: listeners.length,
        active: listeners.filter(l => l.isActive).length,
        byEvent: listeners.reduce((acc, listener) => {
          acc[listener.event] = (acc[listener.event] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        domListeners: listeners.filter(l => l.description?.startsWith('dom-')).length,
        reactNativeListeners: listeners.filter(l => l.description?.startsWith('rn-')).length,
        recentlyTriggered: listeners.filter(l => 
          l.lastTriggered && (now - l.lastTriggered) < 60000 // Last minute
        ).length,
        neverTriggered: listeners.filter(l => !l.lastTriggered).length,
        withThrottling: throttleTimersRef.current.size,
        withDebouncing: debounceTimersRef.current.size,
      },
      groups: {
        total: groups.length,
        enabled: groups.filter(g => g.enabled).length,
        totalListenersInGroups: groups.reduce((sum, g) => sum + g.listenerIds.length, 0),
      },
    };
  }, []);

  // Find potential event listener leaks
  const findEventListenerLeaks = useCallback(() => {
    const listeners = Array.from(listenersRef.current.values());
    const now = Date.now();
    
    const leaks: Array<{
      id: string;
      type: 'listener' | 'group';
      issue: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    // Check for listeners that are never triggered
    listeners.forEach(listener => {
      const timeSinceAdded = now - listener.addedAt;
      
      if (!listener.lastTriggered && listener.isActive && timeSinceAdded > 300000) { // 5 minutes
        leaks.push({
          id: listener.id,
          type: 'listener',
          issue: `Listener never triggered after ${Math.round(timeSinceAdded / 60000)} minutes`,
          severity: 'medium',
          recommendation: 'Check if event is being fired or if handler is correctly attached',
        });
      }

      // Check for listeners with very high trigger count
      if (listener.triggerCount > 10000) {
        leaks.push({
          id: listener.id,
          type: 'listener',
          issue: `Very high trigger count: ${listener.triggerCount}`,
          severity: 'high',
          recommendation: 'Consider throttling or debouncing this event listener',
        });
      }

      // Check for inactive listeners not cleaned up
      if (!listener.isActive && listener.lastTriggered && 
          (now - listener.lastTriggered) > 600000) { // 10 minutes
        leaks.push({
          id: listener.id,
          type: 'listener',
          issue: 'Inactive listener not cleaned up',
          severity: 'low',
          recommendation: 'Remove inactive event listeners to free memory',
        });
      }
    });

    // Check for DOM-specific issues (Web only)
    if (Platform.OS === 'web') {
      const domListeners = listeners.filter(l => l.description?.startsWith('dom-'));
      
      if (domListeners.length > 50) {
        leaks.push({
          id: 'dom-listeners-high-count',
          type: 'listener',
          issue: `High DOM listener count: ${domListeners.length}`,
          severity: 'medium',
          recommendation: 'Consider event delegation or listener consolidation',
        });
      }
    }

    return leaks;
  }, []);

  // Remove specific event listener
  const removeEventListener = useCallback((listenerId: string): boolean => {
    const listener = listenersRef.current.get(listenerId);
    if (!listener) return false;

    try {
      // Run custom cleanup
      if (listener.cleanup) {
        listener.cleanup();
      }

      // Remove from tracking
      listenersRef.current.delete(listenerId);
      
      return true;
    } catch (error) {
      logError(`Error removing event listener ${listenerId}:`, "Error", error);
      return false;
    }
  }, []);

  // Remove event group
  const removeEventGroup = useCallback((groupId: string): boolean => {
    const group = groupsRef.current.get(groupId);
    if (!group) return false;

    try {
      if (group.cleanup) {
        group.cleanup();
      }
      
      groupsRef.current.delete(groupId);
      return true;
    } catch (error) {
      logError(`Error removing event group ${groupId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cleanup all event listeners
  const cleanupAllEventListeners = useCallback((): {
    cleaned: { listeners: number; groups: number };
    errors: string[];
  } => {
    const result = {
      cleaned: { listeners: 0, groups: 0 },
      errors: [] as string[],
    };

    // Cleanup all groups first
    for (const [groupId] of groupsRef.current.entries()) {
      try {
        if (removeEventGroup(groupId)) {
          result.cleaned.groups++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup event group ${groupId}: ${error}`);
      }
    }

    // Cleanup all listeners
    for (const [listenerId] of listenersRef.current.entries()) {
      try {
        if (removeEventListener(listenerId)) {
          result.cleaned.listeners++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup event listener ${listenerId}: ${error}`);
      }
    }

    // Clear timer maps
    throttleTimersRef.current.clear();
    debounceTimersRef.current.clear();

    return result;
  }, [removeEventListener, removeEventGroup]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanupResult = cleanupAllEventListeners();
      if (__DEV__ && (cleanupResult.cleaned.listeners > 0 || cleanupResult.cleaned.groups > 0)) {
        logDebug(`🧹 Event listener cleanup on unmount:`, "Debug", cleanupResult.cleaned);
        if (cleanupResult.errors.length > 0) {
          logWarn('🚨 Event listener cleanup errors:', "Warning", cleanupResult.errors);
        }
      }
    };
  }, [cleanupAllEventListeners]);

  return {
    // DOM event listeners (Web only)
    addDOMEventListener,
    
    // React Native event listeners
    addReactNativeEventListener,
    addDimensionsListener,
    addAppStateListener,
    addKeyboardListener,
    addDeviceEventListener,
    
    // Group management
    createEventGroup,
    removeEventGroup,
    
    // Control operations
    setEventListenerEnabled,
    setEventGroupEnabled,
    
    // Cleanup operations
    removeEventListener,
    cleanupAllEventListeners,
    
    // Status and debugging
    getEventListenerStatus,
    findEventListenerLeaks,
  };
};
