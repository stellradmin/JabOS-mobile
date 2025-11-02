/**
 * Enhanced Accessibility Hook
 * Provides comprehensive accessibility state management and real-time optimization
 * Integrates with system accessibility settings and provides advanced features
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Dimensions } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  enhancedAccessibilityManager,
  ScreenReaderOptimization,
  EnhancedFocusManager,
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  SCREEN_READER_OPTIMIZATION,
} from '../utils/enhancedAccessibility';

interface AccessibilityState {
  screenReaderEnabled: boolean;
  reduceMotionEnabled: boolean;
  highContrastEnabled: boolean;
  preferredTextSize: number;
  keyboardNavigationMode: boolean;
  gestureAlternativesEnabled: boolean;
  verboseDescriptions: boolean;
  autoAnnouncements: boolean;
  currentOptimizationLevel: string;
}

interface AccessibilityOptions {
  enableAutoAnnouncements?: boolean;
  optimizationLevel?: keyof typeof SCREEN_READER_OPTIMIZATION;
  gestureAlternatives?: boolean;
  verboseMode?: boolean;
  reducedMotion?: boolean;
}

interface LiveRegionManager {
  announceChange: (message: string, priority?: 'polite' | 'assertive') => void;
  announceNavigation: (from: string, to: string, context?: string) => void;
  announceError: (error: string, context?: string) => void;
  announceSuccess: (success: string, context?: string) => void;
  announceLoading: (isLoading: boolean, context?: string) => void;
}

interface FocusNavigationManager {
  createFocusZone: (elements: HTMLElement[] | React.RefObject<any>[]) => string;
  destroyFocusZone: (zoneId: string) => void;
  focusFirst: (zoneId: string) => boolean;
  focusLast: (zoneId: string) => boolean;
  focusNext: (zoneId: string) => boolean;
  focusPrevious: (zoneId: string) => boolean;
  trapFocus: (containerId: string) => () => void;
}

interface GestureAlternativeManager {
  registerSwipeAlternative: (
    direction: 'left' | 'right' | 'up' | 'down',
    callback: () => void,
    description: string
  ) => () => void;
  registerLongPressAlternative: (
    callback: () => void,
    description: string
  ) => () => void;
  registerDoubleTapAlternative: (
    callback: () => void,
    description: string
  ) => () => void;
  clearAlternatives: () => void;
}

interface PerformanceOptimizer {
  optimizeForScreenReader: (enabled: boolean) => void;
  optimizeAnimations: (reduceMotion: boolean) => void;
  optimizeRendering: (level: 'minimal' | 'standard' | 'enhanced') => void;
  getRecommendedSettings: () => {
    removeClippedSubviews: boolean;
    maxToRenderPerBatch: number;
    windowSize: number;
    updateCellsBatchingPeriod: number;
    initialNumToRender: number;
  };
}

export const useEnhancedAccessibility = (options: AccessibilityOptions = {}) => {
  const [accessibilityState, setAccessibilityState] = useState<AccessibilityState>({
    screenReaderEnabled: false,
    reduceMotionEnabled: false,
    highContrastEnabled: false,
    preferredTextSize: 1.0,
    keyboardNavigationMode: false,
    gestureAlternativesEnabled: options.gestureAlternatives ?? true,
    verboseDescriptions: options.verboseMode ?? false,
    autoAnnouncements: options.enableAutoAnnouncements ?? true,
    currentOptimizationLevel: options.optimizationLevel ?? SCREEN_READER_OPTIMIZATION.STANDARD,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const announcementQueue = useRef<Array<{ message: string; priority: 'polite' | 'assertive'; timestamp: number }>>([]);
  const lastAnnouncement = useRef<string>('');
  const announcementTimer = useRef<NodeJS.Timeout>();
  const gestureAlternatives = useRef<Map<string, () => void>>(new Map());
  const focusZones = useRef<Map<string, { elements: any[]; currentIndex: number }>>(new Map());

  // Initialize accessibility state
  useEffect(() => {
    let mounted = true;

    const initializeAccessibility = async () => {
      try {
        await enhancedAccessibilityManager.initialize();
        
        if (mounted) {
          const state = enhancedAccessibilityManager.getState();
          setAccessibilityState(prevState => ({
            ...prevState,
            ...state,
          }));
          setIsInitialized(true);
        }
      } catch (error) {
        logError('Failed to initialize enhanced accessibility:', "Error", error);
      }
    };

    initializeAccessibility();

    return () => {
      mounted = false;
    };
  }, []);

  // Set up accessibility state listener
  useEffect(() => {
    const removeListener = enhancedAccessibilityManager.addListener((state) => {
      setAccessibilityState(prevState => ({
        ...prevState,
        ...state,
      }));
    });

    return removeListener;
  }, []);

  // Live region manager for screen reader announcements
  const liveRegionManager: LiveRegionManager = {
    announceChange: useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (!accessibilityState.autoAnnouncements || !accessibilityState.screenReaderEnabled) {
        return;
      }

      // Avoid duplicate announcements
      if (lastAnnouncement.current === message) {
        return;
      }

      // Queue announcement
      announcementQueue.current.push({
        message,
        priority,
        timestamp: Date.now(),
      });

      // Process queue
      if (!announcementTimer.current) {
        announcementTimer.current = setTimeout(() => {
          const announcement = announcementQueue.current.shift();
          if (announcement) {
            ScreenReaderOptimization.announceStateChange('Content', 'updated', announcement.message);
            lastAnnouncement.current = announcement.message;
          }
          
          // Clear timer and process next if queue not empty
          announcementTimer.current = undefined;
          if (announcementQueue.current.length > 0) {
            liveRegionManager.announceChange(announcementQueue.current[0].message, announcementQueue.current[0].priority);
          }
        }, ENHANCED_ACCESSIBILITY_CONSTANTS.ANNOUNCEMENT_DELAY);
      }
    }, [accessibilityState.autoAnnouncements, accessibilityState.screenReaderEnabled]),

    announceNavigation: useCallback((from: string, to: string, context?: string) => {
      if (accessibilityState.screenReaderEnabled) {
        ScreenReaderOptimization.announceNavigation(from, to, context);
      }
    }, [accessibilityState.screenReaderEnabled]),

    announceError: useCallback((error: string, context?: string) => {
      const message = context ? `Error in ${context}: ${error}` : `Error: ${error}`;
      if (accessibilityState.screenReaderEnabled) {
        ScreenReaderOptimization.announceStateChange('System', 'normal', message);
      }
    }, [accessibilityState.screenReaderEnabled]),

    announceSuccess: useCallback((success: string, context?: string) => {
      const message = context ? `Success in ${context}: ${success}` : `Success: ${success}`;
      liveRegionManager.announceChange(message, 'polite');
    }, []),

    announceLoading: useCallback((isLoading: boolean, context?: string) => {
      const message = isLoading 
        ? `Loading ${context || 'content'}...`
        : `Finished loading ${context || 'content'}`;
      liveRegionManager.announceChange(message, 'polite');
    }, []),
  };

  // Focus navigation manager
  const focusNavigationManager: FocusNavigationManager = {
    createFocusZone: useCallback((elements: any[]) => {
      const zoneId = `focus-zone-${Date.now()}`;
      focusZones.current.set(zoneId, {
        elements: elements.filter(el => el && (el.current || el.focus)),
        currentIndex: 0,
      });
      return zoneId;
    }, []),

    destroyFocusZone: useCallback((zoneId: string) => {
      focusZones.current.delete(zoneId);
    }, []),

    focusFirst: useCallback((zoneId: string) => {
      const zone = focusZones.current.get(zoneId);
      if (zone && zone.elements.length > 0) {
        zone.currentIndex = 0;
        const element = zone.elements[0].current || zone.elements[0];
        if (element.focus) {
          element.focus();
          return true;
        }
      }
      return false;
    }, []),

    focusLast: useCallback((zoneId: string) => {
      const zone = focusZones.current.get(zoneId);
      if (zone && zone.elements.length > 0) {
        zone.currentIndex = zone.elements.length - 1;
        const element = zone.elements[zone.currentIndex].current || zone.elements[zone.currentIndex];
        if (element.focus) {
          element.focus();
          return true;
        }
      }
      return false;
    }, []),

    focusNext: useCallback((zoneId: string) => {
      const zone = focusZones.current.get(zoneId);
      if (zone && zone.elements.length > 0) {
        zone.currentIndex = (zone.currentIndex + 1) % zone.elements.length;
        const element = zone.elements[zone.currentIndex].current || zone.elements[zone.currentIndex];
        if (element.focus) {
          element.focus();
          return true;
        }
      }
      return false;
    }, []),

    focusPrevious: useCallback((zoneId: string) => {
      const zone = focusZones.current.get(zoneId);
      if (zone && zone.elements.length > 0) {
        zone.currentIndex = zone.currentIndex === 0 ? zone.elements.length - 1 : zone.currentIndex - 1;
        const element = zone.elements[zone.currentIndex].current || zone.elements[zone.currentIndex];
        if (element.focus) {
          element.focus();
          return true;
        }
      }
      return false;
    }, []),

    trapFocus: useCallback((containerId: string) => {
      if (Platform.OS !== 'web') return () => {};

      const container = document.getElementById(containerId);
      if (!container) return () => {};

      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return () => {};

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      container.addEventListener('keydown', handleKeyDown);
      firstElement.focus();

      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }, []),
  };

  // Gesture alternative manager
  const gestureAlternativeManager: GestureAlternativeManager = {
    registerSwipeAlternative: useCallback((
      direction: 'left' | 'right' | 'up' | 'down',
      callback: () => void,
      description: string
    ) => {
      const key = `swipe-${direction}`;
      gestureAlternatives.current.set(key, callback);

      if (accessibilityState.screenReaderEnabled) {
        liveRegionManager.announceChange(`Swipe ${direction} alternative available: ${description}`, 'polite');
      }

      return () => {
        gestureAlternatives.current.delete(key);
      };
    }, [accessibilityState.screenReaderEnabled, liveRegionManager]),

    registerLongPressAlternative: useCallback((callback: () => void, description: string) => {
      const key = 'long-press';
      gestureAlternatives.current.set(key, callback);

      if (accessibilityState.screenReaderEnabled) {
        liveRegionManager.announceChange(`Long press alternative available: ${description}`, 'polite');
      }

      return () => {
        gestureAlternatives.current.delete(key);
      };
    }, [accessibilityState.screenReaderEnabled, liveRegionManager]),

    registerDoubleTapAlternative: useCallback((callback: () => void, description: string) => {
      const key = 'double-tap';
      gestureAlternatives.current.set(key, callback);

      return () => {
        gestureAlternatives.current.delete(key);
      };
    }, []),

    clearAlternatives: useCallback(() => {
      gestureAlternatives.current.clear();
    }, []),
  };

  // Performance optimizer
  const performanceOptimizer: PerformanceOptimizer = {
    optimizeForScreenReader: useCallback((enabled: boolean) => {
      enhancedAccessibilityManager.updateSettings({
        screenReaderEnabled: enabled,
      });
    }, []),

    optimizeAnimations: useCallback((reduceMotion: boolean) => {
      enhancedAccessibilityManager.updateSettings({
        reduceMotionEnabled: reduceMotion,
      });
    }, []),

    optimizeRendering: useCallback((level: 'minimal' | 'standard' | 'enhanced') => {
      const optimizationLevel = level === 'minimal' 
        ? SCREEN_READER_OPTIMIZATION.MINIMAL
        : level === 'enhanced'
          ? SCREEN_READER_OPTIMIZATION.ENHANCED
          : SCREEN_READER_OPTIMIZATION.STANDARD;

      enhancedAccessibilityManager.updateSettings({
        currentOptimizationLevel: optimizationLevel,
      });
    }, []),

    getRecommendedSettings: useCallback(() => {
      const isScreenReaderEnabled = accessibilityState.screenReaderEnabled;
      const isReducedMotion = accessibilityState.reduceMotionEnabled;

      return {
        removeClippedSubviews: Platform.OS === 'android' && !isScreenReaderEnabled,
        maxToRenderPerBatch: isScreenReaderEnabled ? 5 : 10,
        windowSize: isScreenReaderEnabled ? 5 : 10,
        updateCellsBatchingPeriod: isScreenReaderEnabled ? 100 : 50,
        initialNumToRender: isScreenReaderEnabled ? 10 : 20,
      };
    }, [accessibilityState.screenReaderEnabled, accessibilityState.reduceMotionEnabled]),
  };

  // Utility functions
  const getAccessibilityProps = useCallback((
    role: string,
    label: string,
    hint?: string,
    state?: any
  ) => {
    return {
      accessible: true,
      accessibilityRole: role as any,
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityState: state,
    };
  }, []);

  const shouldReduceMotion = useCallback(() => {
    return accessibilityState.reduceMotionEnabled || accessibilityState.screenReaderEnabled;
  }, [accessibilityState.reduceMotionEnabled, accessibilityState.screenReaderEnabled]);

  const getAnimationDuration = useCallback((defaultDuration: number) => {
    return shouldReduceMotion() 
      ? ENHANCED_ACCESSIBILITY_CONSTANTS.REDUCED_MOTION_DURATION
      : defaultDuration;
  }, [shouldReduceMotion]);

  const getTouchTargetSize = useCallback((size: number) => {
    return Math.max(size, ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET);
  }, []);

  const updateAccessibilitySettings = useCallback((updates: Partial<AccessibilityState>) => {
    enhancedAccessibilityManager.updateSettings(updates);
    setAccessibilityState(prev => ({ ...prev, ...updates }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (announcementTimer.current) {
        clearTimeout(announcementTimer.current);
      }
      gestureAlternatives.current.clear();
      focusZones.current.clear();
    };
  }, []);

  return {
    // State
    accessibilityState,
    isInitialized,

    // Managers
    liveRegionManager,
    focusNavigationManager,
    gestureAlternativeManager,
    performanceOptimizer,

    // Utilities
    getAccessibilityProps,
    shouldReduceMotion,
    getAnimationDuration,
    getTouchTargetSize,
    updateAccessibilitySettings,

    // Quick access to common states
    isScreenReaderEnabled: accessibilityState.screenReaderEnabled,
    isReduceMotionEnabled: accessibilityState.reduceMotionEnabled,
    isHighContrastEnabled: accessibilityState.highContrastEnabled,
    gestureAlternativesEnabled: accessibilityState.gestureAlternativesEnabled,
    verboseDescriptionsEnabled: accessibilityState.verboseDescriptions,
  };
};

// Specialized hooks for specific use cases

// Hook for form accessibility
export const useFormAccessibility = () => {
  const { 
    accessibilityState, 
    liveRegionManager, 
    focusNavigationManager,
    getAccessibilityProps 
  } = useEnhancedAccessibility();

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [fieldRefs, setFieldRefs] = useState<Record<string, React.RefObject<any>>>({});

  const registerField = useCallback((
    fieldName: string,
    ref: React.RefObject<any>,
    validation?: (value: any) => string | null
  ) => {
    setFieldRefs(prev => ({ ...prev, [fieldName]: ref }));
    
    return (value: any) => {
      if (validation) {
        const error = validation(value);
        setFormErrors(prev => ({ ...prev, [fieldName]: error || '' }));
        
        if (error) {
          liveRegionManager.announceError(error, fieldName);
        }
      }
    };
  }, [liveRegionManager]);

  const focusFirstError = useCallback(() => {
    const firstErrorField = Object.keys(formErrors).find(field => formErrors[field]);
    if (firstErrorField && fieldRefs[firstErrorField]) {
      const ref = fieldRefs[firstErrorField];
      if (ref.current?.focus) {
        ref.current.focus();
        liveRegionManager.announceError(formErrors[firstErrorField], firstErrorField);
      }
    }
  }, [formErrors, fieldRefs, liveRegionManager]);

  const getFieldProps = useCallback((
    fieldName: string,
    label: string,
    required: boolean = false
  ) => {
    const error = formErrors[fieldName];
    const props = getAccessibilityProps(
      'textbox',
      label,
      error ? `${label}, ${error}` : required ? `${label}, required` : undefined,
      { 
        invalid: !!error,
        required,
      }
    );

    return {
      ...props,
      accessibilityValue: { text: error || (required ? 'required' : 'optional') },
    };
  }, [formErrors, getAccessibilityProps]);

  return {
    registerField,
    focusFirstError,
    getFieldProps,
    formErrors,
    hasErrors: Object.values(formErrors).some(error => !!error),
  };
};

// Hook for modal accessibility
export const useModalAccessibility = (modalName: string) => {
  const { 
    accessibilityState, 
    liveRegionManager, 
    focusNavigationManager 
  } = useEnhancedAccessibility();

  const [isOpen, setIsOpen] = useState(false);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);

  const openModal = useCallback((elements: React.RefObject<any>[]) => {
    setIsOpen(true);
    liveRegionManager.announceNavigation('page', modalName, `${modalName} modal opened`);
    
    const zoneId = focusNavigationManager.createFocusZone(elements);
    setFocusZoneId(zoneId);
    
    // Focus first element after a brief delay
    setTimeout(() => {
      focusNavigationManager.focusFirst(zoneId);
    }, 100);
  }, [modalName, liveRegionManager, focusNavigationManager]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    liveRegionManager.announceNavigation(modalName, 'page', `${modalName} modal closed`);
    
    if (focusZoneId) {
      focusNavigationManager.destroyFocusZone(focusZoneId);
      setFocusZoneId(null);
    }
  }, [modalName, liveRegionManager, focusNavigationManager, focusZoneId]);

  const getModalProps = useCallback(() => ({
    accessibilityViewIsModal: true,
    accessibilityLabel: modalName,
    accessibilityHint: `${modalName} modal dialog`,
    importantForAccessibility: 'yes' as const,
  }), [modalName]);

  return {
    isOpen,
    openModal,
    closeModal,
    getModalProps,
    focusNext: focusZoneId ? () => focusNavigationManager.focusNext(focusZoneId) : undefined,
    focusPrevious: focusZoneId ? () => focusNavigationManager.focusPrevious(focusZoneId) : undefined,
  };
};

export default useEnhancedAccessibility;