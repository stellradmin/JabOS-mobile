// Memory-safe event listener management hook
// Automatically removes all event listeners on component unmount

import { useEffect, useRef, useCallback } from 'react';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface EventListenerRef {
  target: EventTarget;
  event: string;
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
}

export const useEventListener = () => {
  const listenersRef = useRef<Map<string, EventListenerRef>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique listener ID
  const generateListenerId = useCallback(() => {
    return `listener_${nextIdRef.current++}`;
  }, []);

  // Add event listener with automatic cleanup tracking
  const addEventListener = useCallback((
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
    listenerId?: string
  ): string => {
    const id = listenerId || generateListenerId();

    // Remove existing listener with same ID
    if (listenersRef.current.has(id)) {
      removeEventListener(id);
    }

    // Add the event listener
    target.addEventListener(event, listener, options);

    // Store reference for cleanup
    listenersRef.current.set(id, {
      target,
      event,
      listener,
      options,
    });

    return id;
  }, [generateListenerId]);

  // Remove specific event listener
  const removeEventListener = useCallback((listenerId: string) => {
    const listenerRef = listenersRef.current.get(listenerId);
    if (!listenerRef) return;

    try {
      listenerRef.target.removeEventListener(
        listenerRef.event,
        listenerRef.listener,
        listenerRef.options
      );
    } catch (error) {
      logError(`Error removing event listener ${listenerId}:`, "Error", error);
    }

    listenersRef.current.delete(listenerId);
  }, []);

  // Remove all event listeners
  const removeAllEventListeners = useCallback(() => {
    for (const [id] of listenersRef.current.entries()) {
      removeEventListener(id);
    }
  }, [removeEventListener]);

  // Get active listener count (debugging)
  const getActiveListenerCount = useCallback(() => {
    return listenersRef.current.size;
  }, []);

  // Get listener details (debugging)
  const getListenerDetails = useCallback(() => {
    const details: Array<{ id: string; event: string; target: string }> = [];
    for (const [id, ref] of listenersRef.current.entries()) {
      details.push({
        id,
        event: ref.event,
        target: ref.target.constructor.name,
      });
    }
    return details;
  }, []);

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      removeAllEventListeners();
    };
  }, [removeAllEventListeners]);

  return {
    addEventListener,
    removeEventListener,
    removeAllEventListeners,
    getActiveListenerCount,
    getListenerDetails,
  };
};

// Specialized hook for keyboard event management
export const useKeyboardListener = () => {
  const { addEventListener, removeEventListener, removeAllEventListeners } = useEventListener();

  const addKeyListener = useCallback((
    key: string,
    callback: (event: KeyboardEvent) => void,
    options?: { 
      type?: 'keydown' | 'keyup' | 'keypress';
      target?: EventTarget;
      preventDefault?: boolean;
      stopPropagation?: boolean;
    }
  ) => {
    const {
      type = 'keydown',
      target = document,
      preventDefault = false,
      stopPropagation = false,
    } = options || {};

    const listener = (event: KeyboardEvent) => {
      if (event.key === key || event.code === key) {
        if (preventDefault) event.preventDefault();
        if (stopPropagation) event.stopPropagation();
        callback(event);
      }
    };

    return addEventListener(target, type, listener as EventListener, false, `keyboard_${key}_${type}`);
  }, [addEventListener]);

  return {
    addKeyListener,
    removeEventListener,
    removeAllEventListeners,
  };
};

// Specialized hook for accessibility event management
export const useAccessibilityListener = () => {
  const { addEventListener, removeEventListener, removeAllEventListeners } = useEventListener();

  const addScreenReaderListener = useCallback((
    callback: (isEnabled: boolean) => void
  ) => {
    // This would need platform-specific implementation
    // For now, providing the interface
    const listener = () => {
      // Platform-specific screen reader detection
      callback(true); // Placeholder
    };

    return addEventListener(document, 'visibilitychange', listener, false, 'screen_reader');
  }, [addEventListener]);

  const addFocusListener = useCallback((
    element: HTMLElement,
    onFocus: (event: FocusEvent) => void,
    onBlur?: (event: FocusEvent) => void
  ) => {
    const focusId = addEventListener(element, 'focus', onFocus as EventListener, false, 'focus_listener');
    
    let blurId: string | undefined;
    if (onBlur) {
      blurId = addEventListener(element, 'blur', onBlur as EventListener, false, 'blur_listener');
    }

    return {
      focusId,
      blurId,
      cleanup: () => {
        removeEventListener(focusId);
        if (blurId) removeEventListener(blurId);
      }
    };
  }, [addEventListener, removeEventListener]);

  return {
    addScreenReaderListener,
    addFocusListener,
    removeEventListener,
    removeAllEventListeners,
  };
};

// Specialized hook for window event management
export const useWindowListener = () => {
  const { addEventListener, removeEventListener, removeAllEventListeners } = useEventListener();

  const addResizeListener = useCallback((
    callback: (event: Event) => void,
    debounceMs: number = 100
  ) => {
    let timeoutId: NodeJS.Timeout;
    
    const debouncedCallback = (event: Event) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(event), debounceMs);
    };

    const id = addEventListener(window, 'resize', debouncedCallback as EventListener, false, 'window_resize');
    
    return {
      id,
      cleanup: () => {
        clearTimeout(timeoutId);
        removeEventListener(id);
      }
    };
  }, [addEventListener, removeEventListener]);

  const addScrollListener = useCallback((
    callback: (event: Event) => void,
    throttleMs: number = 16 // ~60fps
  ) => {
    let lastCall = 0;
    
    const throttledCallback = (event: Event) => {
      const now = Date.now();
      if (now - lastCall >= throttleMs) {
        lastCall = now;
        callback(event);
      }
    };

    return addEventListener(window, 'scroll', throttledCallback as EventListener, false, 'window_scroll');
  }, [addEventListener]);

  const addVisibilityListener = useCallback((
    callback: (isVisible: boolean) => void
  ) => {
    const listener = () => {
      callback(!document.hidden);
    };

    return addEventListener(document, 'visibilitychange', listener, false, 'visibility_change');
  }, [addEventListener]);

  return {
    addResizeListener,
    addScrollListener,
    addVisibilityListener,
    removeEventListener,
    removeAllEventListeners,
  };
};

// Development-only hook for event listener leak detection
export const useEventListenerLeakDetection = () => {
  const { getActiveListenerCount, getListenerDetails } = useEventListener();

  useEffect(() => {
    if (__DEV__) {
      const checkInterval = setInterval(() => {
        const count = getActiveListenerCount();
        if (count > 20) { // Threshold for concern
          logWarn(`🚨 High event listener count detected: ${count} active listeners`, "Warning");
          logDebug('Listener details:', "Debug", getListenerDetails());
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkInterval);
    }
  }, [getActiveListenerCount, getListenerDetails]);
};

// Hook for managing React Native specific listeners
export const useReactNativeListener = () => {
  const { addEventListener, removeEventListener, removeAllEventListeners } = useEventListener();

  const addAppStateListener = useCallback((
    callback: (state: string) => void
  ) => {
    // React Native AppState listener simulation
    // In actual RN app, this would use AppState.addEventListener
    const listener = (event: any) => {
      callback(event.detail?.state || 'unknown');
    };

    return addEventListener(document, 'appstatechange', listener, false, 'app_state');
  }, [addEventListener]);

  const addNetworkListener = useCallback((
    callback: (isConnected: boolean) => void
  ) => {
    // React Native NetInfo listener simulation
    const listener = (event: any) => {
      callback(event.detail?.isConnected ?? true);
    };

    return addEventListener(document, 'networkchange', listener, false, 'network_state');
  }, [addEventListener]);

  return {
    addAppStateListener,
    addNetworkListener,
    removeEventListener,
    removeAllEventListeners,
  };
};
