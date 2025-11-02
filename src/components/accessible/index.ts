// @ts-nocheck
/**
 * Accessible Component Library Index
 * Exports all accessible components and utilities for easy import
 */

// Core accessible components
export { AccessibleMatchCard } from './AccessibleMatchCard';
export { AccessibleConversationList } from './AccessibleConversationList';
export { AccessibleNavigationBar, DefaultTabs } from './AccessibleNavigationBar';

// Enhanced accessibility utilities
export {
  enhancedAccessibilityManager,
  createDatingAccessibilityLabel,
  createEnhancedAccessibilityHint,
  createMatchCardAccessibilityProps,
  createConversationAccessibilityProps,
  createGestureAlternativeProps,
  createEnhancedModalProps,
  createEnhancedFormFieldProps,
  createEnhancedNavigationProps,
  createEnhancedListProps,
  ScreenReaderOptimization,
  EnhancedFocusManager,
  AccessibilityTesting,
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  ENHANCED_ACCESSIBILITY_ROLES,
  SCREEN_READER_OPTIMIZATION,
  GESTURE_ALTERNATIVES,
} from '../utils/enhancedAccessibility';

// Enhanced accessibility hooks
export { 
  useEnhancedAccessibility,
  useFormAccessibility,
  useModalAccessibility,
} from '../hooks/useEnhancedAccessibility';

// Testing infrastructure
export {
  AccessibilityTester,
  createAccessibilityTestSuite,
  runQuickAccessibilityCheck,
  validateAccessibilityProps,
  accessibilityMatchers,
  DATING_APP_ACCESSIBILITY_RULES,
} from '../utils/accessibilityTesting';

// Re-export enhanced focus management hooks
export {
  useFocusManagement,
  useModalFocus,
  useFormFocus,
  useNavigationFocus,
} from '../hooks/useFocusManagement';
// @ts-nocheck
