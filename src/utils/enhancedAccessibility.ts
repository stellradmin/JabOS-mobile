/**
 * Enhanced Accessibility Utilities for Stellr Dating App
 * Builds upon existing accessibility.ts with advanced WCAG 2.1 AA features
 * Provides comprehensive accessibility support for dating app interactions
 */

import { AccessibilityInfo, Platform, Dimensions, AccessibilityRole } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { 
  ACCESSIBILITY_CONSTANTS, 
  ACCESSIBILITY_ROLES, 
  announceToScreenReader,
  createStateDescription,
  FocusManager,
} from './accessibility';

// Enhanced accessibility constants for dating app
export const ENHANCED_ACCESSIBILITY_CONSTANTS = {
  ...ACCESSIBILITY_CONSTANTS,
  
  // Gesture alternatives
  SWIPE_BUTTON_SIZE: 56,
  ACTION_BUTTON_SPACING: 16,
  GESTURE_TIMEOUT: 3000,
  
  // Animation and timing
  REDUCED_MOTION_DURATION: 150,
  STANDARD_MOTION_DURATION: 300,
  ANNOUNCEMENT_DELAY: 500,
  FOCUS_TRANSITION_DELAY: 100,
  
  // Sizing and spacing
  LARGE_TOUCH_TARGET: 56,
  SMALL_TOUCH_TARGET: 32,
  COMFORTABLE_READING_LINE_HEIGHT: 1.5,
  
  // Color and contrast
  HIGH_CONTRAST_RATIO: 4.5,
  AA_CONTRAST_RATIO: 4.5,
  AAA_CONTRAST_RATIO: 7,
  FOCUS_RING_WIDTH: 3,
} as const;

// Enhanced accessibility roles specific to dating app
export const ENHANCED_ACCESSIBILITY_ROLES = {
  ...ACCESSIBILITY_ROLES,
  
  // Dating-specific interactions
  MATCH_SWIPE_AREA: 'adjustable' as AccessibilityRole,
  COMPATIBILITY_METER: 'progressbar' as AccessibilityRole,
  DATE_PROPOSAL: 'button' as AccessibilityRole,
  CONVERSATION_THREAD: 'list' as AccessibilityRole,
  MESSAGE_BUBBLE: 'text' as AccessibilityRole,
  PHOTO_GALLERY: 'image' as AccessibilityRole,
  FILTER_CONTROL: 'switch' as AccessibilityRole,
  RATING_CONTROL: 'adjustable' as AccessibilityRole,
  
  // Navigation and structure
  TAB_NAVIGATION: 'tablist' as AccessibilityRole,
  TAB_PANEL: 'tabpanel' as AccessibilityRole,
  MODAL_OVERLAY: 'dialog' as AccessibilityRole,
  CONFIRMATION_DIALOG: 'alertdialog' as AccessibilityRole,
  
  // Form elements
  SEARCH_INPUT: 'search' as AccessibilityRole,
  DATE_PICKER: 'button' as AccessibilityRole,
  TOGGLE_BUTTON: 'switch' as AccessibilityRole,
} as const;

// Screen reader optimization levels
export const SCREEN_READER_OPTIMIZATION = {
  MINIMAL: 'minimal',
  STANDARD: 'standard',
  ENHANCED: 'enhanced',
  VERBOSE: 'verbose',
} as const;

// Gesture alternative types
export const GESTURE_ALTERNATIVES = {
  SWIPE_LEFT: 'decline_button',
  SWIPE_RIGHT: 'accept_button',
  SWIPE_UP: 'super_like_button',
  LONG_PRESS: 'context_menu',
  DOUBLE_TAP: 'quick_action',
  PINCH_ZOOM: 'zoom_controls',
} as const;

/**
 * Enhanced accessibility state manager
 */
class EnhancedAccessibilityManager {
  private static instance: EnhancedAccessibilityManager;
  private state = {
    screenReaderEnabled: false,
    reduceMotionEnabled: false,
    highContrastEnabled: false,
    preferredTextSize: 1.0,
    keyboardNavigationMode: false,
    gestureAlternativesEnabled: true,
    verboseDescriptions: false,
    autoAnnouncements: true,
    currentOptimizationLevel: SCREEN_READER_OPTIMIZATION.STANDARD,
  };
  
  private listeners: ((state: typeof this.state) => void)[] = [];
  private initialized = false;

  static getInstance(): EnhancedAccessibilityManager {
    if (!EnhancedAccessibilityManager.instance) {
      EnhancedAccessibilityManager.instance = new EnhancedAccessibilityManager();
    }
    return EnhancedAccessibilityManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check accessibility settings
      this.state.screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      if (Platform.OS === 'ios') {
        this.state.reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      }

      // Set up listeners
      const screenReaderListener = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        (enabled) => {
          this.state.screenReaderEnabled = enabled;
          this.updateOptimizationLevel();
          this.notifyListeners();
        }
      );

      if (Platform.OS === 'ios') {
        const reduceMotionListener = AccessibilityInfo.addEventListener(
          'reduceMotionChanged',
          (enabled) => {
            this.state.reduceMotionEnabled = enabled;
            this.notifyListeners();
          }
        );
      }

      // Update optimization level based on settings
      this.updateOptimizationLevel();
      this.initialized = true;

      if (__DEV__) {
        logDebug('Enhanced accessibility manager initialized:', "Debug", this.state);
      }
    } catch (error) {
      logError('Failed to initialize enhanced accessibility:', "Error", error);
    }
  }

  private updateOptimizationLevel(): void {
    if (this.state.screenReaderEnabled && this.state.verboseDescriptions) {
      this.state.currentOptimizationLevel = SCREEN_READER_OPTIMIZATION.VERBOSE;
    } else if (this.state.screenReaderEnabled) {
      this.state.currentOptimizationLevel = SCREEN_READER_OPTIMIZATION.ENHANCED;
    } else {
      this.state.currentOptimizationLevel = SCREEN_READER_OPTIMIZATION.STANDARD;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        logError('Error in accessibility state listener:', "Error", error);
      }
    });
  }

  getState() {
    return { ...this.state };
  }

  updateSettings(updates: Partial<typeof this.state>): void {
    this.state = { ...this.state, ...updates };
    this.updateOptimizationLevel();
    this.notifyListeners();
  }

  addListener(callback: (state: typeof this.state) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

export const enhancedAccessibilityManager = EnhancedAccessibilityManager.getInstance();

/**
 * Creates enhanced accessibility labels for dating app interactions
 */
export const createDatingAccessibilityLabel = (
  interaction: 'swipe' | 'match' | 'message' | 'unmatch' | 'like' | 'pass' | 'super_like',
  context: {
    userName?: string;
    age?: number;
    compatibility?: number;
    messageCount?: number;
    lastSeen?: string;
    isOnline?: boolean;
    additionalInfo?: string;
  } = {}
): string => {
  const { 
    userName = 'this person', 
    age, 
    compatibility, 
    messageCount, 
    lastSeen, 
    isOnline,
    additionalInfo 
  } = context;

  const state = enhancedAccessibilityManager.getState();
  const isVerbose = state.currentOptimizationLevel === SCREEN_READER_OPTIMIZATION.VERBOSE;

  let baseLabel = '';
  let details: string[] = [];

  switch (interaction) {
    case 'swipe':
      baseLabel = `Profile of ${userName}`;
      if (age) details.push(`age ${age}`);
      if (compatibility) details.push(`${compatibility}% compatibility`);
      if (isVerbose && isOnline !== undefined) {
        details.push(isOnline ? 'currently online' : 'offline');
      }
      break;

    case 'match':
      baseLabel = `New match with ${userName}`;
      if (compatibility) details.push(`${compatibility}% compatibility`);
      if (isVerbose && lastSeen) details.push(`last seen ${lastSeen}`);
      break;

    case 'message':
      baseLabel = `Conversation with ${userName}`;
      if (messageCount) details.push(`${messageCount} messages`);
      if (isOnline) details.push('online now');
      break;

    case 'unmatch':
      baseLabel = `Unmatch with ${userName}`;
      if (isVerbose) details.push('This will remove the match and conversation');
      break;

    case 'like':
      baseLabel = `Like ${userName}'s profile`;
      if (compatibility && isVerbose) details.push(`${compatibility}% compatibility match`);
      break;

    case 'pass':
      baseLabel = `Pass on ${userName}'s profile`;
      if (isVerbose) details.push('Move to next profile');
      break;

    case 'super_like':
      baseLabel = `Super like ${userName}'s profile`;
      if (isVerbose) details.push('Shows extra interest');
      break;

    default:
      baseLabel = `Interact with ${userName}`;
  }

  if (additionalInfo) {
    details.push(additionalInfo);
  }

  const detailsText = details.length > 0 ? `. ${details.join(', ')}` : '';
  return `${baseLabel}${detailsText}`;
};

/**
 * Creates enhanced accessibility hints with gesture alternatives
 */
export const createEnhancedAccessibilityHint = (
  action: 'swipe' | 'navigate' | 'select' | 'dismiss' | 'expand' | 'edit',
  gestureAlternative?: string,
  context?: string
): string => {
  const state = enhancedAccessibilityManager.getState();
  const hasGestureAlternatives = state.gestureAlternativesEnabled;

  let hint = '';

  switch (action) {
    case 'swipe':
      if (hasGestureAlternatives) {
        hint = 'Swipe left to pass, right to like, or use action buttons below';
      } else {
        hint = 'Double tap to view profile, swipe to like or pass';
      }
      break;

    case 'navigate':
      hint = context || 'Use navigation buttons or swipe to browse';
      break;

    case 'select':
      hint = 'Double tap to select';
      if (gestureAlternative) hint += `, or ${gestureAlternative}`;
      break;

    case 'dismiss':
      hint = 'Double tap to close, or swipe down to dismiss';
      break;

    case 'expand':
      hint = 'Double tap to expand details';
      break;

    case 'edit':
      hint = 'Double tap to edit, long press for options';
      break;

    default:
      hint = context || 'Double tap to activate';
  }

  return hint;
};

/**
 * Creates comprehensive match card accessibility props
 */
export const createMatchCardAccessibilityProps = (
  profile: {
    name: string;
    age: number;
    bio?: string;
    photos?: string[];
    compatibility?: number;
    interests?: string[];
    isOnline?: boolean;
    lastSeen?: string;
  },
  index: number,
  totalProfiles: number
) => {
  const state = enhancedAccessibilityManager.getState();
  const { name, age, bio, photos, compatibility, interests, isOnline, lastSeen } = profile;

  const label = createDatingAccessibilityLabel('swipe', {
    userName: name,
    age,
    compatibility,
    isOnline,
    lastSeen,
  });

  const hint = createEnhancedAccessibilityHint('swipe');
  
  const position = `Profile ${index + 1} of ${totalProfiles}`;
  const photoCount = photos ? `. ${photos.length} photos` : '';
  const interestInfo = interests && interests.length > 0 && state.currentOptimizationLevel === SCREEN_READER_OPTIMIZATION.VERBOSE
    ? `. Interests: ${interests.slice(0, 3).join(', ')}`
    : '';

  const fullLabel = `${position}. ${label}${photoCount}${interestInfo}`;

  return {
    accessible: true,
    accessibilityRole: ENHANCED_ACCESSIBILITY_ROLES.MATCH_CARD,
    accessibilityLabel: fullLabel,
    accessibilityHint: hint,
    ...createStateDescription(false, false, false, false),
  };
};

/**
 * Creates accessibility props for conversation items
 */
export const createConversationAccessibilityProps = (
  conversation: {
    userName: string;
    lastMessage: string;
    timestamp: string;
    unreadCount: number;
    isOnline: boolean;
    hasMedia: boolean;
  },
  index: number
) => {
  const { userName, lastMessage, timestamp, unreadCount, isOnline, hasMedia } = conversation;
  
  const label = createDatingAccessibilityLabel('message', {
    userName,
    messageCount: unreadCount,
    isOnline,
  });

  const state = enhancedAccessibilityManager.getState();
  
  let details: string[] = [];
  details.push(`Last message: ${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}`);
  details.push(timestamp);
  
  if (unreadCount > 0) {
    details.push(`${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`);
  }
  
  if (hasMedia && state.currentOptimizationLevel === SCREEN_READER_OPTIMIZATION.VERBOSE) {
    details.push('contains media');
  }

  const fullLabel = `${label}. ${details.join('. ')}`;
  const hint = 'Double tap to open conversation';

  return {
    accessible: true,
    accessibilityRole: 'button' as AccessibilityRole,
    accessibilityLabel: fullLabel,
    accessibilityHint: hint,
    ...createStateDescription(false, false, false, false, unreadCount > 0 ? 'has unread messages' : undefined),
  };
};

/**
 * Creates gesture alternative button props
 */
export const createGestureAlternativeProps = (
  gestureType: keyof typeof GESTURE_ALTERNATIVES,
  context: {
    userName?: string;
    action?: string;
    description?: string;
  } = {}
) => {
  const { userName = 'this person', action, description } = context;
  
  const alternativeActions = {
    [GESTURE_ALTERNATIVES.SWIPE_LEFT]: {
      label: 'Pass',
      hint: `Pass on ${userName}'s profile`,
      icon: 'x-circle',
    },
    [GESTURE_ALTERNATIVES.SWIPE_RIGHT]: {
      label: 'Like',
      hint: `Like ${userName}'s profile`,
      icon: 'heart',
    },
    [GESTURE_ALTERNATIVES.SWIPE_UP]: {
      label: 'Super Like',
      hint: `Super like ${userName}'s profile`,
      icon: 'star',
    },
    [GESTURE_ALTERNATIVES.LONG_PRESS]: {
      label: 'More Options',
      hint: description || 'Show additional options',
      icon: 'more-vertical',
    },
    [GESTURE_ALTERNATIVES.DOUBLE_TAP]: {
      label: action || 'Quick Action',
      hint: description || 'Perform quick action',
      icon: 'zap',
    },
    [GESTURE_ALTERNATIVES.PINCH_ZOOM]: {
      label: 'Zoom Controls',
      hint: 'Use zoom in and zoom out buttons',
      icon: 'maximize-2',
    },
  };

  const alternative = alternativeActions[GESTURE_ALTERNATIVES[gestureType]];

  return {
    accessible: true,
    accessibilityRole: 'button' as AccessibilityRole,
    accessibilityLabel: alternative.label,
    accessibilityHint: alternative.hint,
    icon: alternative.icon,
    style: {
      minWidth: ENHANCED_ACCESSIBILITY_CONSTANTS.LARGE_TOUCH_TARGET,
      minHeight: ENHANCED_ACCESSIBILITY_CONSTANTS.LARGE_TOUCH_TARGET,
    },
  };
};

/**
 * Enhanced modal accessibility props
 */
export const createEnhancedModalProps = (
  title: string,
  type: 'dialog' | 'alertdialog' | 'sheet' | 'popup' = 'dialog',
  description?: string
) => {
  const role = type === 'alertdialog' 
    ? ENHANCED_ACCESSIBILITY_ROLES.CONFIRMATION_DIALOG 
    : ENHANCED_ACCESSIBILITY_ROLES.MODAL_OVERLAY;

  return {
    accessibilityViewIsModal: true,
    accessibilityRole: role,
    accessibilityLabel: title,
    accessibilityHint: description || 'Modal dialog. Use back button or swipe down to close',
    // Trap focus within modal
    importantForAccessibility: 'yes' as const,
  };
};

/**
 * Enhanced form field accessibility props
 */
export const createEnhancedFormFieldProps = (
  fieldType: 'text' | 'email' | 'password' | 'search' | 'number' | 'date',
  label: string,
  options: {
    required?: boolean;
    error?: string;
    placeholder?: string;
    value?: string;
    maxLength?: number;
    isValid?: boolean;
  } = {}
) => {
  const { required, error, placeholder, value, maxLength, isValid } = options;

  const role = fieldType === 'search' 
    ? ENHANCED_ACCESSIBILITY_ROLES.SEARCH_INPUT 
    : 'textbox' as AccessibilityRole;

  let hint = placeholder || `Enter ${label.toLowerCase()}`;
  
  if (required) hint += ' (required)';
  if (maxLength) hint += `. Maximum ${maxLength} characters`;
  if (error) hint += `. Error: ${error}`;

  const characterCount = value ? value.length : 0;
  const valueText = maxLength 
    ? `${characterCount} of ${maxLength} characters`
    : value ? `${characterCount} characters` : 'Empty';

  return {
    accessible: true,
    accessibilityRole: role,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityValue: { text: valueText },
    ...createStateDescription(false, false, false, false, error ? 'invalid' : isValid ? 'valid' : undefined),
  };
};

/**
 * Enhanced navigation accessibility props
 */
export const createEnhancedNavigationProps = (
  currentScreen: string,
  totalScreens: number,
  screenIndex: number,
  canGoBack: boolean = true,
  canGoForward: boolean = true
) => {
  const position = `Screen ${screenIndex + 1} of ${totalScreens}`;
  const navigation = [];
  
  if (canGoBack) navigation.push('swipe or tap back to go to previous screen');
  if (canGoForward) navigation.push('swipe or tap forward to go to next screen');

  const hint = navigation.length > 0 
    ? navigation.join(', ') 
    : 'End of navigation flow';

  return {
    accessibilityLabel: `${currentScreen}. ${position}`,
    accessibilityHint: hint,
    accessibilityTraits: ['header'] as any,
  };
};

/**
 * Enhanced list accessibility props
 */
export const createEnhancedListProps = (
  listType: 'matches' | 'conversations' | 'photos' | 'settings',
  itemCount: number,
  isLoading: boolean = false,
  hasMore: boolean = false
) => {
  const listNames = {
    matches: 'potential matches',
    conversations: 'conversations',
    photos: 'photos',
    settings: 'settings',
  };

  const listName = listNames[listType];
  const label = `${listName} list`;
  const hint = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}. Swipe up or down to browse${hasMore ? ', pull to refresh for more' : ''}`;

  return {
    accessible: true,
    accessibilityRole: 'list' as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityHint: hint,
    ...createStateDescription(isLoading, false, false, false),
  };
};

/**
 * Screen reader optimization utilities
 */
export const ScreenReaderOptimization = {
  /**
   * Announces critical dating app events
   */
  announceMatchEvent: (type: 'new_match' | 'new_message' | 'match_expires', details: string) => {
    const announcements = {
      new_match: `New match! ${details}`,
      new_message: `New message from ${details}`,
      match_expires: `Match expiring soon with ${details}`,
    };

    announceToScreenReader(announcements[type], 'assertive');
  },

  /**
   * Announces navigation changes
   */
  announceNavigation: (from: string, to: string, context?: string) => {
    const message = context 
      ? `Navigated from ${from} to ${to}. ${context}`
      : `Navigated from ${from} to ${to}`;
    
    announceToScreenReader(message, 'polite');
  },

  /**
   * Announces filter or search results
   */
  announceSearchResults: (query: string, resultCount: number) => {
    const message = resultCount === 0
      ? `No results found for "${query}"`
      : `Found ${resultCount} result${resultCount !== 1 ? 's' : ''} for "${query}"`;
    
    announceToScreenReader(message, 'polite');
  },

  /**
   * Announces state changes with context
   */
  announceStateChange: (component: string, oldState: string, newState: string) => {
    announceToScreenReader(`${component} changed from ${oldState} to ${newState}`, 'polite');
  },
};

/**
 * Enhanced focus management for dating app flows
 */
export const EnhancedFocusManager = {
  ...FocusManager,

  /**
   * Focus management for card stack navigation
   */
  focusCardStack: (cardIndex: number, totalCards: number) => {
    const message = `Viewing profile ${cardIndex + 1} of ${totalCards}`;
    FocusManager.announceFocusChange(message);
  },

  /**
   * Focus management for conversation list
   */
  focusConversation: (conversationName: string, hasUnread: boolean) => {
    const message = hasUnread 
      ? `Focused on conversation with ${conversationName}, has unread messages`
      : `Focused on conversation with ${conversationName}`;
    FocusManager.announceFocusChange(message);
  },

  /**
   * Focus management for modal forms
   */
  focusModalForm: (formName: string, firstFieldName: string) => {
    setTimeout(() => {
      FocusManager.announceFocusChange(`${formName} opened, focus on ${firstFieldName} field`);
    }, ENHANCED_ACCESSIBILITY_CONSTANTS.FOCUS_TRANSITION_DELAY);
  },
};

/**
 * Accessibility testing utilities
 */
export const AccessibilityTesting = {
  /**
   * Validates minimum touch target size
   */
  validateTouchTarget: (width: number, height: number): boolean => {
    return width >= ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET && 
           height >= ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET;
  },

  /**
   * Validates accessibility label presence and quality
   */
  validateAccessibilityLabel: (label?: string): { isValid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    if (!label) {
      issues.push('Missing accessibility label');
      return { isValid: false, issues };
    }

    if (label.length < 2) {
      issues.push('Accessibility label too short');
    }

    if (label.length > 200) {
      issues.push('Accessibility label too long (over 200 characters)');
    }

    if (/^(button|image|text)$/i.test(label)) {
      issues.push('Generic accessibility label detected');
    }

    return { isValid: issues.length === 0, issues };
  },

  /**
   * Generates accessibility audit report
   */
  generateAuditReport: (componentName: string, props: any): {
    score: number;
    issues: string[];
    recommendations: string[];
  } => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for required accessibility props
    if (!props.accessible && !props.accessibilityRole && !props.accessibilityLabel) {
      issues.push('No accessibility props found');
      score -= 30;
      recommendations.push('Add accessibility props to make component accessible');
    }

    // Check touch target size
    if (props.style && (props.style.width || props.style.height)) {
      const isValidSize = AccessibilityTesting.validateTouchTarget(
        props.style.width || ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
        props.style.height || ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET
      );
      
      if (!isValidSize) {
        issues.push('Touch target too small');
        score -= 20;
        recommendations.push('Increase minimum touch target size to 44x44 points');
      }
    }

    // Check label quality
    if (props.accessibilityLabel) {
      const labelValidation = AccessibilityTesting.validateAccessibilityLabel(props.accessibilityLabel);
      if (!labelValidation.isValid) {
        issues.push(...labelValidation.issues);
        score -= 15;
        recommendations.push('Improve accessibility label quality');
      }
    }

    return { score: Math.max(0, score), issues, recommendations };
  },
};

// Initialize the enhanced accessibility manager
enhancedAccessibilityManager.initialize();

export default {
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  ENHANCED_ACCESSIBILITY_ROLES,
  SCREEN_READER_OPTIMIZATION,
  GESTURE_ALTERNATIVES,
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
};
// @ts-nocheck
