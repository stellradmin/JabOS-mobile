/**
 * Accessibility utility functions and constants for Stellr app
 * Provides consistent accessibility implementation across all components
 */

import { AccessibilityInfo, AccessibilityRole } from 'react-native';

// WCAG 2.1 AA compliant minimum touch target size
export const ACCESSIBILITY_CONSTANTS = {
  MIN_TOUCH_TARGET: 44,
  FOCUS_RING_COLOR: '#007AFF',
  HIGH_CONTRAST_BORDER: 3,
  ANIMATION_DURATION_MS: 250,
} as const;

// Common accessibility roles for dating app components
export const ACCESSIBILITY_ROLES = {
  MATCH_CARD: 'button' as AccessibilityRole,
  NAVIGATION_BUTTON: 'button' as AccessibilityRole,
  ACTION_BUTTON: 'button' as AccessibilityRole,
  COMPATIBILITY_SECTION: 'text' as AccessibilityRole,
  PROFILE_IMAGE: 'image' as AccessibilityRole,
  MODAL: 'alert' as AccessibilityRole,
  PROGRESS_INDICATOR: 'progressbar' as AccessibilityRole,
} as const;

// Screen reader announcement priorities
export const ANNOUNCEMENT_PRIORITY = {
  LOW: 'polite' as const,
  HIGH: 'assertive' as const,
} as const;

/**
 * Creates comprehensive accessibility labels for match interactions
 */
export const createMatchAccessibilityLabel = (
  action: 'accept' | 'decline' | 'view_compatibility' | 'navigate',
  userName?: string,
  compatibilityScore?: number,
  additionalContext?: string
): string => {
  const userReference = userName || 'this person';
  
  switch (action) {
    case 'accept':
      return `Accept match with ${userReference}${compatibilityScore ? `, compatibility score ${compatibilityScore}%` : ''}${additionalContext ? `, ${additionalContext}` : ''}`;
    
    case 'decline':
      return `Decline match with ${userReference}${additionalContext ? `, ${additionalContext}` : ''}`;
    
    case 'view_compatibility':
      return `View detailed compatibility information with ${userReference}${compatibilityScore ? `, current score ${compatibilityScore}%` : ''}`;
    
    case 'navigate':
      return `Navigate to ${additionalContext || 'next option'}${userName ? ` for ${userReference}` : ''}`;
    
    default:
      return `Interact with ${userReference}`;
  }
};

/**
 * Creates accessibility hints for complex interactions
 */
export const createAccessibilityHint = (
  action: 'swipe' | 'double_tap' | 'long_press' | 'navigation' | 'modal',
  context?: string
): string => {
  switch (action) {
    case 'swipe':
      return 'Swipe left to decline, right to accept, or use action buttons below';
    
    case 'double_tap':
      return 'Double tap to activate';
    
    case 'long_press':
      return 'Long press for additional options';
    
    case 'navigation':
      return context || 'Use navigation buttons to move between items';
    
    case 'modal':
      return 'Modal dialog. Use back button or swipe down to close';
    
    default:
      return context || 'Interactive element';
  }
};

/**
 * Creates compatibility score announcements for screen readers
 */
export const createCompatibilityAnnouncement = (
  grade?: string,
  score?: number,
  description?: string,
  section?: string
): string => {
  const sectionRef = section ? `${section} compatibility: ` : '';
  const gradeText = grade ? `Grade ${grade}` : '';
  const scoreText = score ? `Score ${score}%` : '';
  const descText = description ? `, ${description}` : '';
  
  return `${sectionRef}${gradeText}${gradeText && scoreText ? ', ' : ''}${scoreText}${descText}`;
};

/**
 * Creates navigation status announcements
 */
export const createNavigationAnnouncement = (
  currentIndex: number,
  totalItems: number,
  itemType: string = 'item'
): string => {
  return `${itemType} ${currentIndex + 1} of ${totalItems}`;
};

/**
 * Ensures touch targets meet minimum accessibility requirements
 */
export const ensureAccessibleTouchTarget = (size: number): number => {
  return Math.max(size, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET);
};

/**
 * Calculates appropriate font size based on system accessibility settings
 */
export const getAccessibleFontSize = (baseSize: number, scaleFactor: number = 1): number => {
  // React Native automatically scales fonts based on accessibility settings
  // This function can be used for additional custom scaling if needed
  return baseSize * scaleFactor;
};

/**
 * Creates accessible color contrast checking (simplified)
 * In a real implementation, you'd use a proper contrast ratio calculation
 */
export const hasGoodContrast = (foreground: string, background: string): boolean => {
  // This is a simplified check - in production, use a proper contrast ratio library
  // For now, we'll assume light text on dark backgrounds and vice versa have good contrast
  const isLightBg = background.includes('white') || background.includes('#f') || background.includes('light');
  const isDarkText = foreground.includes('black') || foreground.includes('#0') || foreground.includes('#1') || foreground.includes('#2');
  
  return (isLightBg && isDarkText) || (!isLightBg && !isDarkText);
};

/**
 * Announces content changes to screen readers
 */
export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void => {
  if (AccessibilityInfo) {
    AccessibilityInfo.announceForAccessibility(message);
  }
};

/**
 * Creates state descriptions for dynamic elements
 */
export const createStateDescription = (
  isLoading?: boolean,
  isDisabled?: boolean,
  isSelected?: boolean,
  isExpanded?: boolean,
  customState?: string
): { accessibilityState: any; accessibilityValue?: any } => {
  const state: any = {};
  
  if (isLoading !== undefined) state.busy = isLoading;
  if (isDisabled !== undefined) state.disabled = isDisabled;
  if (isSelected !== undefined) state.selected = isSelected;
  if (isExpanded !== undefined) state.expanded = isExpanded;
  
  return {
    accessibilityState: state,
    ...(customState && { accessibilityValue: { text: customState } })
  };
};

/**
 * Creates accessible button props for common actions
 */
export const createAccessibleButtonProps = (
  label: string,
  hint?: string,
  role: AccessibilityRole = 'button',
  state?: ReturnType<typeof createStateDescription>
) => ({
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityRole: role,
  accessible: true,
  ...state,
});

/**
 * Creates proper heading hierarchy props
 */
export const createHeadingProps = (level: 1 | 2 | 3 | 4 | 5 | 6, text: string) => ({
  accessibilityRole: 'header' as AccessibilityRole,
  accessibilityLabel: text,
  accessibilityLevel: level,
  accessible: true,
});

/**
 * Focus management utilities
 */
export const FocusManager = {
  /**
   * Sets focus to an element (for keyboard navigation)
   */
  setFocus: (ref: React.RefObject<any>) => {
    if (ref.current?.focus) {
      ref.current.focus();
    }
  },
  
  /**
   * Announces focus changes
   */
  announceFocusChange: (elementDescription: string) => {
    announceToScreenReader(`Focused on ${elementDescription}`, 'polite');
  },
};

/**
 * Modal accessibility utilities
 */
export const ModalAccessibility = {
  /**
   * Props for accessible modals
   */
  getModalProps: (title: string, description?: string) => ({
    accessibilityViewIsModal: true,
    accessibilityLabel: title,
    accessibilityHint: description || createAccessibilityHint('modal'),
  }),
  
  /**
   * Announces modal opening
   */
  announceModalOpen: (title: string) => {
    announceToScreenReader(`${title} dialog opened`, 'assertive');
  },
  
  /**
   * Announces modal closing
   */
  announceModalClose: () => {
    announceToScreenReader('Dialog closed', 'polite');
  },
};

/**
 * Image accessibility utilities
 */
export const ImageAccessibility = {
  /**
   * Creates alt text for profile images
   */
  createProfileImageAlt: (userName?: string, hasImage: boolean = true): string => {
    if (hasImage) {
      return userName ? `Profile photo of ${userName}` : 'Profile photo';
    }
    return userName ? `Default profile placeholder for ${userName}` : 'Default profile placeholder';
  },
  
  /**
   * Creates alt text for decorative images
   */
  createDecorativeImageAlt: (): string => {
    return ''; // Empty alt text for decorative images
  },
};

/**
 * Progress and loading accessibility
 */
export const ProgressAccessibility = {
  /**
   * Creates progress announcements
   */
  createProgressAnnouncement: (current: number, total: number, context: string = 'items'): string => {
    const percentage = Math.round((current / total) * 100);
    return `Progress: ${current} of ${total} ${context}, ${percentage} percent complete`;
  },
  
  /**
   * Creates loading state description
   */
  createLoadingState: (description: string = 'content'): string => {
    return `Loading ${description}, please wait`;
  },
};

export default {
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  ANNOUNCEMENT_PRIORITY,
  createMatchAccessibilityLabel,
  createAccessibilityHint,
  createCompatibilityAnnouncement,
  createNavigationAnnouncement,
  ensureAccessibleTouchTarget,
  getAccessibleFontSize,
  hasGoodContrast,
  announceToScreenReader,
  createStateDescription,
  createAccessibleButtonProps,
  createHeadingProps,
  FocusManager,
  ModalAccessibility,
  ImageAccessibility,
  ProgressAccessibility,
};