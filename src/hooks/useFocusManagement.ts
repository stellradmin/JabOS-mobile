// Memory-safe focus management hook for accessibility
// Handles focus restoration, focus trapping, and accessibility-compliant focus behavior
// Automatically cleans up all focus-related resources on unmount

import { useRef, useCallback, useEffect } from 'react';
import { Platform, AccessibilityInfo } from 'react-native';
import { useRefs } from './useRefs';
import { useTimers } from './useTimers';
import { useEventListener } from './useEventListener';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface FocusableElement {
  id: string;
  element: any; // React Native View or DOM Element
  priority: number;
  isVisible: boolean;
  isEnabled: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
}

interface FocusGroup {
  id: string;
  elements: FocusableElement[];
  currentIndex: number;
  trapFocus: boolean;
  restoreFocus: boolean;
  previousFocus?: any;
}

interface FocusOptions {
  trap?: boolean;
  restore?: boolean;
  priority?: number;
  delay?: number;
  smooth?: boolean;
  accessibilityAnnouncement?: string;
}

export const useFocusManagement = () => {
  const { createElementRef, getRef, nullRef, isRefValid } = useRefs();
  const { createTimeout, clearTimer } = useTimers();
  const { addEventListener } = useEventListener();
  
  const focusGroupsRef = useRef<Map<string, FocusGroup>>(new Map());
  const currentFocusRef = useRef<string | null>(null);
  const focusHistoryRef = useRef<string[]>([]);
  const nextGroupIdRef = useRef(0);

  // Generate unique group ID
  const generateGroupId = useCallback(() => {
    return `focus_group_${nextGroupIdRef.current++}`;
  }, []);

  // Create focus group for managing multiple focusable elements
  const createFocusGroup = useCallback((options: {
    trapFocus?: boolean;
    restoreFocus?: boolean;
    elements?: Array<{ id: string; priority?: number }>;
  } = {}): string => {
    const groupId = generateGroupId();
    const { trapFocus = false, restoreFocus = true, elements = [] } = options;

    // Store current focus for restoration
    let previousFocus = null;
    if (restoreFocus) {
      if (Platform.OS === 'web') {
        previousFocus = document.activeElement;
      }
      // For React Native, we'd need to track the currently focused element differently
    }

    const focusGroup: FocusGroup = {
      id: groupId,
      elements: elements.map(el => ({
        id: el.id,
        element: null, // Will be populated when elements are registered
        priority: el.priority || 0,
        isVisible: true,
        isEnabled: true,
      })),
      currentIndex: 0,
      trapFocus,
      restoreFocus,
      previousFocus,
    };

    focusGroupsRef.current.set(groupId, focusGroup);

    // Set up keyboard navigation if focus trapping is enabled
    if (trapFocus && Platform.OS === 'web') {
      const keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          handleTabNavigation(groupId, event);
        } else if (event.key === 'Escape') {
          closeFocusGroup(groupId);
        }
      };

      addEventListener(document, 'keydown', keydownHandler as EventListener, false, `focus_trap_${groupId}`);
    }

    return groupId;
  }, [generateGroupId, addEventListener]);

  // Register an element with a focus group
  const registerFocusableElement = useCallback((
    groupId: string,
    elementId: string,
    element: any,
    options: {
      priority?: number;
      accessibilityLabel?: string;
      accessibilityRole?: string;
    } = {}
  ): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group) return false;

    const existingElementIndex = group.elements.findIndex(el => el.id === elementId);
    const focusableElement: FocusableElement = {
      id: elementId,
      element,
      priority: options.priority || 0,
      isVisible: true,
      isEnabled: true,
      accessibilityLabel: options.accessibilityLabel,
      accessibilityRole: options.accessibilityRole,
    };

    if (existingElementIndex >= 0) {
      // Update existing element
      group.elements[existingElementIndex] = focusableElement;
    } else {
      // Add new element
      group.elements.push(focusableElement);
    }

    // Sort elements by priority
    group.elements.sort((a, b) => b.priority - a.priority);

    return true;
  }, []);

  // Focus an element with accessibility support
  const focusElement = useCallback((
    elementOrRef: any | string,
    options: FocusOptions = {}
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const {
        delay = 0,
        smooth = true,
        accessibilityAnnouncement,
      } = options;

      const executeFocus = () => {
        let element = elementOrRef;
        
        // If it's a ref ID, get the actual element
        if (typeof elementOrRef === 'string') {
          const ref = getRef(elementOrRef);
          element = ref?.current;
        }

        if (!element) {
          resolve(false);
          return;
        }

        try {
          // Platform-specific focus handling
          if (Platform.OS === 'web') {
            // Web DOM element
            if (element.focus) {
              element.focus({ preventScroll: !smooth });
              
              // Scroll into view if needed
              if (smooth && element.scrollIntoView) {
                element.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'nearest',
                });
              }
            }
          } else {
            // React Native
            if (element.focus) {
              element.focus();
            } else if (AccessibilityInfo.setAccessibilityFocus) {
              AccessibilityInfo.setAccessibilityFocus(element);
            }
          }

          // Update focus tracking
          if (typeof elementOrRef === 'string') {
            currentFocusRef.current = elementOrRef;
            focusHistoryRef.current.push(elementOrRef);
            
            // Limit history size
            if (focusHistoryRef.current.length > 50) {
              focusHistoryRef.current = focusHistoryRef.current.slice(-50);
            }
          }

          // Accessibility announcement
          if (accessibilityAnnouncement) {
            announceToScreenReader(accessibilityAnnouncement);
          }

          resolve(true);
        } catch (error) {
          logError('Error focusing element:', "Error", error);
          resolve(false);
        }
      };

      if (delay > 0) {
        createTimeout(executeFocus, delay, `focus_delay_${Date.now()}`);
      } else {
        executeFocus();
      }
    });
  }, [getRef, createTimeout]);

  // Navigate to next focusable element in group
  const focusNext = useCallback((groupId: string): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group || group.elements.length === 0) return false;

    const visibleElements = group.elements.filter(el => el.isVisible && el.isEnabled);
    if (visibleElements.length === 0) return false;

    const nextIndex = (group.currentIndex + 1) % visibleElements.length;
    group.currentIndex = nextIndex;

    // Trigger focus asynchronously; return boolean for synchronous API compatibility
    focusElement(visibleElements[nextIndex].element);
    return true;
  }, [focusElement]);

  // Navigate to previous focusable element in group
  const focusPrevious = useCallback((groupId: string): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group || group.elements.length === 0) return false;

    const visibleElements = group.elements.filter(el => el.isVisible && el.isEnabled);
    if (visibleElements.length === 0) return false;

    const prevIndex = group.currentIndex === 0 
      ? visibleElements.length - 1 
      : group.currentIndex - 1;
    group.currentIndex = prevIndex;

    focusElement(visibleElements[prevIndex].element);
    return true;
  }, [focusElement]);

  // Focus first element in group
  const focusFirst = useCallback((groupId: string): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group || group.elements.length === 0) return false;

    const visibleElements = group.elements.filter(el => el.isVisible && el.isEnabled);
    if (visibleElements.length === 0) return false;

    group.currentIndex = 0;
    focusElement(visibleElements[0].element);
    return true;
  }, [focusElement]);

  // Focus last element in group
  const focusLast = useCallback((groupId: string): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group || group.elements.length === 0) return false;

    const visibleElements = group.elements.filter(el => el.isVisible && el.isEnabled);
    if (visibleElements.length === 0) return false;

    const lastIndex = visibleElements.length - 1;
    group.currentIndex = lastIndex;
    focusElement(visibleElements[lastIndex].element);
    return true;
  }, [focusElement]);

  // Handle Tab navigation for focus trapping
  const handleTabNavigation = useCallback((groupId: string, event: KeyboardEvent) => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group || !group.trapFocus) return;

    event.preventDefault();

    if (event.shiftKey) {
      focusPrevious(groupId);
    } else {
      focusNext(groupId);
    }
  }, [focusNext, focusPrevious]);

  // Restore focus to previously focused element
  const restoreFocus = useCallback((groupId?: string): boolean => {
    if (groupId) {
      const group = focusGroupsRef.current.get(groupId);
      if (group?.restoreFocus && group.previousFocus) {
        focusElement(group.previousFocus, { delay: 100 });
        return true;
      }
    }

    // Restore from history
    if (focusHistoryRef.current.length > 1) {
      // Get the second-to-last focused element
      const previousElement = focusHistoryRef.current[focusHistoryRef.current.length - 2];
      focusElement(previousElement);
      return true;
    }

    return false;
  }, [focusElement]);

  // Close focus group and restore focus
  const closeFocusGroup = useCallback((groupId: string): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group) return false;

    // Restore focus if needed
    if (group.restoreFocus) {
      restoreFocus(groupId);
    }

    // Clean up event listeners (handled by useEventListener automatically)
    
    // Remove group
    focusGroupsRef.current.delete(groupId);

    return true;
  }, [restoreFocus]);

  // Update element visibility/enabled state
  const updateElementState = useCallback((
    groupId: string,
    elementId: string,
    updates: { isVisible?: boolean; isEnabled?: boolean }
  ): boolean => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group) return false;

    const element = group.elements.find(el => el.id === elementId);
    if (!element) return false;

    if (updates.isVisible !== undefined) {
      element.isVisible = updates.isVisible;
    }
    if (updates.isEnabled !== undefined) {
      element.isEnabled = updates.isEnabled;
    }

    return true;
  }, []);

  // Get focus group status
  const getFocusGroupStatus = useCallback((groupId: string) => {
    const group = focusGroupsRef.current.get(groupId);
    if (!group) return null;

    const visibleElements = group.elements.filter(el => el.isVisible && el.isEnabled);

    return {
      id: group.id,
      totalElements: group.elements.length,
      visibleElements: visibleElements.length,
      currentIndex: group.currentIndex,
      trapFocus: group.trapFocus,
      restoreFocus: group.restoreFocus,
      elements: group.elements.map(el => ({
        id: el.id,
        priority: el.priority,
        isVisible: el.isVisible,
        isEnabled: el.isEnabled,
        accessibilityLabel: el.accessibilityLabel,
        accessibilityRole: el.accessibilityRole,
      })),
    };
  }, []);

  // Screen reader announcement
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (Platform.OS === 'web') {
      // Create screen reader announcement element
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', priority);
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only'; // Visually hidden but accessible
      announcement.textContent = message;
      
      document.body.appendChild(announcement);
      
      // Remove after announcement
      createTimeout(() => {
        if (announcement.parentNode) {
          announcement.parentNode.removeChild(announcement);
        }
      }, 1000, `announcement_cleanup_${Date.now()}`);
    } else {
      // React Native
      if (AccessibilityInfo.announceForAccessibility) {
        AccessibilityInfo.announceForAccessibility(message);
      }
    }
  }, [createTimeout]);

  // Get all focus groups status
  const getAllFocusGroupsStatus = useCallback(() => {
    const groups = Array.from(focusGroupsRef.current.keys());
    return {
      totalGroups: groups.length,
      groups: groups.map(groupId => getFocusGroupStatus(groupId)),
      currentFocus: currentFocusRef.current,
      focusHistoryLength: focusHistoryRef.current.length,
    };
  }, [getFocusGroupStatus]);

  // Clean up all focus groups
  const cleanupAllFocusGroups = useCallback((): number => {
    let cleanedCount = 0;
    
    for (const groupId of focusGroupsRef.current.keys()) {
      if (closeFocusGroup(groupId)) {
        cleanedCount++;
      }
    }
    
    // Clear tracking refs
    currentFocusRef.current = null;
    focusHistoryRef.current = [];
    
    return cleanedCount;
  }, [closeFocusGroup]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanedCount = cleanupAllFocusGroups();
      if (__DEV__ && cleanedCount > 0) {
        logDebug(`🧹 Cleaned up ${cleanedCount} focus groups on unmount`, "Debug");
      }
    };
  }, [cleanupAllFocusGroups]);

  return {
    // Focus group management
    createFocusGroup,
    registerFocusableElement,
    closeFocusGroup,
    
    // Focus control
    focusElement,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    restoreFocus,
    
    // Element state management
    updateElementState,
    
    // Accessibility
    announceToScreenReader,
    
    // Status and debugging
    getFocusGroupStatus,
    getAllFocusGroupsStatus,
    cleanupAllFocusGroups,
  };
};

// Specialized hooks for common focus patterns

// Hook for modal focus management
export const useModalFocus = () => {
  const {
    createFocusGroup,
    registerFocusableElement,
    focusFirst,
    closeFocusGroup,
    announceToScreenReader,
  } = useFocusManagement();

  const createModalFocusGroup = useCallback((modalName: string) => {
    const groupId = createFocusGroup({
      trapFocus: true,
      restoreFocus: true,
    });

    // Announce modal opening
    announceToScreenReader(`${modalName} dialog opened`, 'assertive');

    return {
      groupId,
      focusModal: () => focusFirst(groupId),
      closeModal: () => {
        announceToScreenReader(`${modalName} dialog closed`);
        return closeFocusGroup(groupId);
      },
      registerElement: (elementId: string, element: any, options?: any) =>
        registerFocusableElement(groupId, elementId, element, options),
    };
  }, [createFocusGroup, registerFocusableElement, focusFirst, closeFocusGroup, announceToScreenReader]);

  return { createModalFocusGroup };
};

// Hook for form focus management
export const useFormFocus = () => {
  const {
    createFocusGroup,
    registerFocusableElement,
    focusNext,
    focusPrevious,
    focusElement,
  } = useFocusManagement();

  const createFormFocusGroup = useCallback(() => {
    const groupId = createFocusGroup({
      trapFocus: false,
      restoreFocus: false,
    });

    return {
      groupId,
      registerField: (fieldId: string, element: any, options?: any) =>
        registerFocusableElement(groupId, fieldId, element, { priority: 1, ...options }),
      registerSubmitButton: (buttonId: string, element: any) =>
        registerFocusableElement(groupId, buttonId, element, { priority: 0 }),
      focusNextField: () => focusNext(groupId),
      focusPreviousField: () => focusPrevious(groupId),
      focusField: (fieldId: string) => focusElement(fieldId),
    };
  }, [createFocusGroup, registerFocusableElement, focusNext, focusPrevious, focusElement]);

  return { createFormFocusGroup };
};

// Hook for navigation focus management
export const useNavigationFocus = () => {
  const {
    createFocusGroup,
    registerFocusableElement,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
  } = useFocusManagement();

  const createNavigationFocusGroup = useCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => {
    const groupId = createFocusGroup({
      trapFocus: false,
      restoreFocus: false,
    });

    return {
      groupId,
      registerNavItem: (itemId: string, element: any, options?: any) =>
        registerFocusableElement(groupId, itemId, element, options),
      focusNext: () => focusNext(groupId),
      focusPrevious: () => focusPrevious(groupId),
      focusFirst: () => focusFirst(groupId),
      focusLast: () => focusLast(groupId),
      direction,
    };
  }, [createFocusGroup, registerFocusableElement, focusNext, focusPrevious, focusFirst, focusLast]);

  return { createNavigationFocusGroup };
};
