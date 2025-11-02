// Specialized event listener hooks for common interactive component patterns
// Provides pre-configured event management for buttons, forms, gestures, and navigation
// Built on top of useEventListeners for automatic cleanup

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useEventListeners } from './useEventListeners';
import { useTimers } from './useTimers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export interface ButtonInteractionConfig {
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onDoublePress?: () => void;
  doublePressDelay?: number;
  throttlePress?: number;
  debouncePress?: number;
  hapticFeedback?: boolean;
  analyticsEvent?: string;
  disabled?: boolean;
}

export interface FormInteractionConfig {
  onFocus?: (field: string) => void;
  onBlur?: (field: string) => void;
  onChange?: (field: string, value: any) => void;
  onSubmit?: (data: any) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceValidation?: number;
  throttleChange?: number;
}

export interface ScrollInteractionConfig {
  onScroll?: (event: any) => void;
  onScrollBeginDrag?: () => void;
  onScrollEndDrag?: () => void;
  onMomentumScrollBegin?: () => void;
  onMomentumScrollEnd?: () => void;
  onScrollToTop?: () => void;
  throttleScroll?: number;
  scrollThreshold?: number;
}

export interface KeyboardInteractionConfig {
  onKeyboardShow?: (height: number) => void;
  onKeyboardHide?: () => void;
  onKeyboardWillShow?: (height: number) => void;
  onKeyboardWillHide?: () => void;
  adjustForKeyboard?: boolean;
  keyboardAvoidingBehavior?: 'height' | 'position' | 'padding';
}

export const useInteractiveComponents = () => {
  const { 
    addDOMEventListener, 
    addReactNativeEventListener, 
    addKeyboardListener,
    createEventGroup,
    removeEventGroup,
  } = useEventListeners();
  const { createTimeout, clearTimer } = useTimers();

  // Enhanced button interaction management
  // RN note: Touchable/Pressable do not expose an event emitter. We return props to spread.
  const useButtonInteractions = useCallback((
    buttonRef: React.RefObject<any>,
    config: ButtonInteractionConfig
  ): { groupId: string; pressCount: number; pressProps: {
    onPress?: () => void;
    onLongPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    disabled?: boolean;
  } } => {
    const {
      onPress,
      onLongPress,
      onPressIn,
      onPressOut,
      onDoublePress,
      doublePressDelay = 300,
      throttlePress,
      debouncePress,
      hapticFeedback = false,
      analyticsEvent,
      disabled = false,
    } = config;

    let pressCount = 0;
    let lastPressTime = 0;
    let doublePressTimer: string | null = null;

    const handlePress = () => {
      if (disabled) return;

      const now = Date.now();
      pressCount++;

      // Throttle press if configured
      if (typeof throttlePress === 'number') {
        if (now - lastPressTime < throttlePress) {
          return;
        }
      }

      // Debounce press if configured
      if (typeof debouncePress === 'number') {
        if (doublePressTimer) {
          clearTimer(doublePressTimer);
        }
        doublePressTimer = createTimeout(() => {
          // Within debounce window, only last press counts
          // Handle double-press within debounced call if desired
          if (onDoublePress) {
            // We can't infer two presses reliably in a pure debounce, so treat as single
            onPress && onPress();
          } else {
            onPress && onPress();
          }
          doublePressTimer = null;
        }, debouncePress, 'button-debounce-press');
        lastPressTime = now;
        return;
      }

      // Handle double press detection
      if (onDoublePress && (now - lastPressTime) < doublePressDelay) {
        // Clear single press timer if double press detected
        if (doublePressTimer) {
          clearTimer(doublePressTimer);
          doublePressTimer = null;
        }
        onDoublePress();
        pressCount = 0; // Reset count after double press
      } else if (onPress) {
        // Delay single press to allow for double press detection
        if (onDoublePress) {
          doublePressTimer = createTimeout(() => {
            onPress();
            doublePressTimer = null;
          }, doublePressDelay, 'button-single-press');
        } else {
          onPress();
        }
      }

      lastPressTime = now;

      // Haptic feedback (React Native only)
      if (hapticFeedback && typeof (global as any).HapticFeedback !== 'undefined') {
        (global as any).HapticFeedback.impactAsync((global as any).HapticFeedback.ImpactFeedbackStyle.Light);
      }

      // Analytics tracking
      if (analyticsEvent) {
        // Would integrate with analytics service
        logDebug(`[Analytics] Button interaction: ${analyticsEvent}`, "Debug");
      }
    };

    const handleLongPress = () => {
      if (disabled || !onLongPress) return;
      onLongPress();
    };

    const handlePressIn = () => {
      if (disabled || !onPressIn) return;
      onPressIn();
    };

    const handlePressOut = () => {
      if (disabled || !onPressOut) return;
      onPressOut();
    };

    // For React Native and Web, return props to spread on the pressable element
    const pressProps: any = {
      onPress: handlePress,
      disabled,
    };

    if (onLongPress) pressProps.onLongPress = handleLongPress;
    if (onPressIn) pressProps.onPressIn = handlePressIn;
    if (onPressOut) pressProps.onPressOut = handlePressOut;

    // Keep a groupId for API compatibility even though we don't create listeners here
    const groupId = `button-interactions-${Date.now()}`;

    return { groupId, pressCount, pressProps };
  }, [createEventGroup, createTimeout, clearTimer]);

  // Enhanced form interaction management
  const useFormInteractions = useCallback((
    formRef: React.RefObject<any>,
    config: FormInteractionConfig
  ): { groupId: string; validationErrors: Record<string, string[]> } => {
    const {
      onFocus,
      onBlur,
      onChange,
      onSubmit,
      validateOnChange = false,
      validateOnBlur = true,
      debounceValidation = 300,
      throttleChange = 100,
    } = config;

    const validationErrors: Record<string, string[]> = {};

    const handleFocus = (event: any) => {
      const fieldName = event.target?.name || event.target?.id || 'unknown';
      if (onFocus) onFocus(fieldName);
    };

    const handleBlur = (event: any) => {
      const fieldName = event.target?.name || event.target?.id || 'unknown';
      if (onBlur) onBlur(fieldName);
      
      // Validate on blur if enabled
      if (validateOnBlur) {
        // Validation logic would go here
        logDebug(`[Form] Validating field: ${fieldName}`, "Debug");
      }
    };

    const handleChange = (event: any) => {
      const fieldName = event.target?.name || event.target?.id || 'unknown';
      const value = event.target?.value;
      
      if (onChange) onChange(fieldName, value);
      
      // Validate on change if enabled
      if (validateOnChange) {
        // Validation logic would go here
        logDebug(`[Form] Validating field on change: ${fieldName}`, "Debug");
      }
    };

    const handleSubmit = (event: any) => {
      event.preventDefault();
      
      if (onSubmit) {
        if (Platform.OS === 'web') {
          // Extract form data (web only)
          const formData = new FormData(event.target);
          const entries = (formData as any).entries ? (formData as any).entries() : [];
          const data = Object.fromEntries(entries);
          onSubmit(data);
        } else {
          // React Native: delegate to caller to gather values
          onSubmit({});
        }
      }
    };

    const groupId = createEventGroup(
      `form-interactions-${Date.now()}`,
      [
        {
          type: 'dom',
          target: formRef.current,
          event: 'focus',
          handler: handleFocus,
          options: {
            description: 'form-focus',
            listenerOptions: { capture: true },
          },
        },
        {
          type: 'dom',
          target: formRef.current,
          event: 'blur',
          handler: handleBlur,
          options: {
            description: 'form-blur',
            listenerOptions: { capture: true },
            debounce: { delay: debounceValidation },
          },
        },
        {
          type: 'dom',
          target: formRef.current,
          event: 'input',
          handler: handleChange,
          options: {
            description: 'form-change',
            listenerOptions: { capture: true },
            throttle: { delay: throttleChange },
          },
        },
        {
          type: 'dom',
          target: formRef.current,
          event: 'submit',
          handler: handleSubmit,
          options: { description: 'form-submit' },
        },
      ],
      { description: 'form-interaction-group' }
    );

    return { groupId, validationErrors };
  }, [createEventGroup]);

  // Enhanced scroll interaction management
  const useScrollInteractions = useCallback((
    scrollViewRef: React.RefObject<any>,
    config: ScrollInteractionConfig
  ): { groupId: string; scrollMetrics: { y: number; velocity: number } } => {
    const {
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      onScrollToTop,
      throttleScroll = 16, // ~60fps
      scrollThreshold = 0,
    } = config;

    const scrollMetrics = { y: 0, velocity: 0 };

    const handleScroll = (event: any) => {
      const { contentOffset, velocity } = event.nativeEvent || event;
      
      scrollMetrics.y = contentOffset?.y || 0;
      scrollMetrics.velocity = velocity?.y || 0;
      
      // Check for scroll to top
      if (onScrollToTop && scrollMetrics.y <= scrollThreshold) {
        onScrollToTop();
      }
      
      if (onScroll) onScroll(event);
    };

    const groupId = createEventGroup(
      `scroll-interactions-${Date.now()}`,
      [
        {
          type: 'rn',
          target: scrollViewRef.current,
          event: 'scroll',
          handler: handleScroll,
          options: {
            description: 'scroll-event',
            throttle: { delay: throttleScroll },
          },
        },
        ...(onScrollBeginDrag ? [{
          type: 'rn' as const,
          target: scrollViewRef.current,
          event: 'scrollBeginDrag',
          handler: onScrollBeginDrag,
          options: { description: 'scroll-begin-drag' },
        }] : []),
        ...(onScrollEndDrag ? [{
          type: 'rn' as const,
          target: scrollViewRef.current,
          event: 'scrollEndDrag',
          handler: onScrollEndDrag,
          options: { description: 'scroll-end-drag' },
        }] : []),
        ...(onMomentumScrollBegin ? [{
          type: 'rn' as const,
          target: scrollViewRef.current,
          event: 'momentumScrollBegin',
          handler: onMomentumScrollBegin,
          options: { description: 'momentum-scroll-begin' },
        }] : []),
        ...(onMomentumScrollEnd ? [{
          type: 'rn' as const,
          target: scrollViewRef.current,
          event: 'momentumScrollEnd',
          handler: onMomentumScrollEnd,
          options: { description: 'momentum-scroll-end' },
        }] : []),
      ],
      { description: 'scroll-interaction-group' }
    );

    return { groupId, scrollMetrics };
  }, [createEventGroup]);

  // Enhanced keyboard interaction management
  const useKeyboardInteractions = useCallback((
    config: KeyboardInteractionConfig
  ): { groupId: string; keyboardVisible: boolean; keyboardHeight: number } => {
    const {
      onKeyboardShow,
      onKeyboardHide,
      onKeyboardWillShow,
      onKeyboardWillHide,
      adjustForKeyboard = true,
    } = config;

    let keyboardVisible = false;
    let keyboardHeight = 0;

    const handleKeyboardShow = (event: any) => {
      keyboardVisible = true;
      keyboardHeight = event.endCoordinates?.height || 0;
      
      if (onKeyboardShow) onKeyboardShow(keyboardHeight);
    };

    const handleKeyboardHide = () => {
      keyboardVisible = false;
      keyboardHeight = 0;
      
      if (onKeyboardHide) onKeyboardHide();
    };

    const handleKeyboardWillShow = (event: any) => {
      const height = event.endCoordinates?.height || 0;
      
      if (onKeyboardWillShow) onKeyboardWillShow(height);
    };

    const handleKeyboardWillHide = () => {
      if (onKeyboardWillHide) onKeyboardWillHide();
    };

    const groupId = createEventGroup(
      `keyboard-interactions-${Date.now()}`,
      [
        {
          type: 'keyboard',
          target: null,
          event: 'keyboardDidShow',
          handler: handleKeyboardShow,
          options: { description: 'keyboard-did-show' },
        },
        {
          type: 'keyboard',
          target: null,
          event: 'keyboardDidHide',
          handler: handleKeyboardHide,
          options: { description: 'keyboard-did-hide' },
        },
        {
          type: 'keyboard',
          target: null,
          event: 'keyboardWillShow',
          handler: handleKeyboardWillShow,
          options: { description: 'keyboard-will-show' },
        },
        {
          type: 'keyboard',
          target: null,
          event: 'keyboardWillHide',
          handler: handleKeyboardWillHide,
          options: { description: 'keyboard-will-hide' },
        },
      ],
      { description: 'keyboard-interaction-group' }
    );

    return { groupId, keyboardVisible, keyboardHeight };
  }, [createEventGroup]);

  // Navigation interaction management
  const useNavigationInteractions = useCallback((
    navigationRef: React.RefObject<any>,
    config: {
      onNavigate?: (route: string) => void;
      onBackPress?: () => boolean; // Return true to prevent default
      onTabPress?: (tabName: string) => void;
      onDrawerOpen?: () => void;
      onDrawerClose?: () => void;
      trackNavigation?: boolean;
    }
  ): { groupId: string } => {
    const {
      onNavigate,
      onBackPress,
      onTabPress,
      onDrawerOpen,
      onDrawerClose,
      trackNavigation = true,
    } = config;

    const handleNavigate = (event: any) => {
      const routeName = event.data?.state?.routeNames?.[event.data.state.index] || 'unknown';
      
      if (trackNavigation) {
        logDebug(`[Navigation] Navigated to: ${routeName}`, "Debug");
      }
      
      if (onNavigate) onNavigate(routeName);
    };

    const handleBackPress = () => {
      if (onBackPress) {
        return onBackPress();
      }
      return false; // Allow default behavior
    };

    const handleTabPress = (event: any) => {
      const tabName = event.target || 'unknown';
      
      if (onTabPress) onTabPress(tabName);
    };

    const groupId = createEventGroup(
      `navigation-interactions-${Date.now()}`,
      [
        ...(onNavigate ? [{
          type: 'rn' as const,
          target: navigationRef.current,
          event: 'state',
          handler: handleNavigate,
          options: { description: 'navigation-state-change' },
        }] : []),
        ...(onBackPress ? [{
          type: 'device' as const,
          target: null,
          event: 'hardwareBackPress',
          handler: handleBackPress,
          options: { description: 'hardware-back-press' },
        }] : []),
        ...(onTabPress ? [{
          type: 'rn' as const,
          target: navigationRef.current,
          event: 'tabPress',
          handler: handleTabPress,
          options: { description: 'tab-press' },
        }] : []),
      ],
      { description: 'navigation-interaction-group' }
    );

    return { groupId };
  }, [createEventGroup]);

  return {
    useButtonInteractions,
    useFormInteractions,
    useScrollInteractions,
    useKeyboardInteractions,
    useNavigationInteractions,
    
    // Direct access to event listener management
    createEventGroup,
    removeEventGroup,
  };
};
