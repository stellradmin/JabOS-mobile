/**
 * Stellr Design System - Centralized Theme Configuration
 * 
 * This file contains all design tokens extracted from the existing Stellr codebase.
 * All color values, typography settings, and spacing are preserved exactly as they
 * appear in the current implementation to maintain visual consistency.
 * 
 * Source Analysis:
 * - Colors extracted from components/*.tsx files
 * - Typography from tailwind.config.js and component usage
 * - Spacing patterns from StyleSheet analysis
 * - Accessibility constants from existing implementation
 */

import { StellarTheme } from './types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Extracted Colors - Preserved Exactly from Existing Implementation
const colors = {
  // Primary Brand Colors (extracted from onboarding and card components)
  primary: {
    babyBlue: '#B8D4F1',      // Main brand color - onboarding cards, top strips
    lavender: '#C8A8E9',      // Secondary brand - questionnaire, date night
    black: '#000000',         // Primary actions, stepper states, strong borders
    white: '#FFFFFF',         // Backgrounds, contrast text
  },
  
  // Interactive State Colors (extracted from pressed states)
  interactive: {
    babyBluePressed: '#9FC4E7',   // ProfileSetupStep3Screen pressed state
    lavenderPressed: '#B19CD9',   // QuestionnaireScreen pressed state  
    lavenderDark: '#A88BC9',      // Darker lavender variant
  },
  
  // Text Hierarchy (extracted from component analysis)
  text: {
    primary: '#000000',       // Primary headings, important text
    secondary: '#1f2937',     // Enhanced black for better contrast (MatchCard)
    tertiary: '#666666',      // Supporting text, labels (widespread usage)
    quaternary: '#555555',    // Subtle text (ProfileSetupStep3Screen)
    disabled: '#999999',      // Disabled state text, navigation buttons
    muted: '#9ca3af',         // Very subtle text
  },
  
  // Background Colors (extracted from component backgrounds)
  background: {
    primary: '#FFFFFF',       // Main backgrounds, card content sections
    secondary: '#f5f5f5',     // Card backgrounds, navigation headers (MatchCard)
    tertiary: '#f3f4f6',      // Image placeholders, compatibility boxes
    dark: '#0F172A',          // Dark theme backgrounds
    darkSecondary: '#0a0a0a', // Darker backgrounds
  },
  
  // Status & Feedback Colors (from various components)
  status: {
    error: '#ef4444',         // Error states, danger actions
    success: '#22c55e',       // Success states, positive actions  
    warning: '#f59e0b',       // Warning states, caution
    info: '#007AFF',          // Information, links
  },
  
  // Action Colors (extracted from MatchCard button analysis)
  actions: {
    accept: '#16a34a',        // Enhanced green for better contrast (MatchCard)
    decline: '#dc2626',       // Enhanced red for better contrast (MatchCard)
    compatibility: '#1f2937', // Improved black for compatibility button
  },
  
  // Border & Outline Colors (extracted from component borders)
  borders: {
    primary: '#000000',       // Strong borders, card outlines (MatchCard)
    secondary: '#e5e7eb',     // Subtle borders, navigation disabled states
    tertiary: '#d1d5db',      // Very subtle borders (Stepper)
  },
  
  // Shadow Colors (consistent across components)
  shadows: {
    default: '#000000',       // Default shadow color used throughout
  },
};

// Typography System (extracted from Tailwind config and component usage)
const typography = {
  // Font Families (from tailwind.config.js)
  fontFamily: {
    geistThin: 'Geist-Thin',
    geistExtraLight: 'Geist-ExtraLight',
    geistLight: 'Geist-Light', 
    geistRegular: 'Geist-Regular',
    geistMedium: 'Geist-Medium',
    geistSemiBold: 'Geist-SemiBold', 
    geistBold: 'Geist-Bold',
    geistBlack: 'Geist-Black',
    geistExtraBold: 'Geist-ExtraBold',
    mono: 'SpaceMono',
  },
  
  // Font Sizes (extracted from component analysis)
  fontSize: {
    xs: 12,    // Small labels, compatibility labels (MatchCard)
    sm: 14,    // Supporting text, tag text
    base: 16,  // Body text, standard size (dateHeaderText, age)
    lg: 18,    // Secondary headings (compatibilityTitle)
    xl: 20,    // Primary headings (meetUserText)
    '2xl': 24, // Large headings (compatibilityGradeValue)
    '3xl': 28, // Main headers (zodiacSubheaderText)
  },
  
  // Font Weights (mapped to Geist family usage patterns)
  fontWeight: {
    thin: 'Geist-Thin',
    extraLight: 'Geist-ExtraLight', 
    light: 'Geist-Light',
    regular: 'Geist-Regular',      // Most body text
    medium: 'Geist-Medium',        // Compatibility labels
    semiBold: 'Geist-SemiBold',    // Supporting text
    bold: 'Geist-Bold',            // Headers, emphasized text
    black: 'Geist-Black',
    extraBold: 'Geist-ExtraBold',
  },
  
  // Line Heights (optimized for readability)
  lineHeight: {
    tight: 1.2,    // Headings, compact text
    normal: 1.5,   // Body text  
    relaxed: 1.6,  // Readable paragraphs (detailsBio: 24)
  },
};

// Spacing System (extracted 4px grid patterns from components)
const spacing = {
  xs: 4,      // 4px - Fine adjustments
  sm: 8,      // 8px - Small gaps, marginBottom
  md: 12,     // 12px - Medium spacing, paddingVertical
  base: 16,   // 16px - Standard spacing, marginBottom
  lg: 20,     // 20px - Large spacing, paddingVertical (topStrip)
  xl: 24,     // 24px - Extra large spacing, paddingHorizontal (widespread)
  '2xl': 32,  // 32px - Section spacing
  '3xl': 44,  // 44px - Accessibility minimum touch target
  '4xl': 48,  // 48px - Large sections
  '5xl': 64,  // 64px - Major layout spacing
};

// Component Dimensions (extracted from existing components)
const dimensions = {
  // Touch Targets (from accessibility constants analysis)
  touchTarget: {
    minimum: 44,    // WCAG AA minimum (ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET)
    comfortable: 60, // Optimal for primary actions (MatchCard circular buttons)
  },
  
  // Border Radius (extracted from component analysis)
  borderRadius: {
    sm: 8,     // Small elements
    base: 12,  // Standard radius (navButton, compatibilityScoreBox)
    lg: 16,    // Cards, containers (MatchCard container, compatibilityBadge)
    xl: 20,    // Large containers
    full: 9999, // Circular elements (buttons use calculated values)
  },
  
  // Component Heights (common patterns from components)
  height: {
    button: 44,      // Standard button height (minimum touch target)
    input: 44,       // Form input height (accessibility compliant)
    header: 60,      // Header/navbar height
    tabBar: 80,      // Bottom tab bar height
  },
};

// Shadow & Elevation System (extracted from component shadow patterns)
const shadows = {
  // No shadow
  none: {
    shadowColor: colors.shadows.default,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  // Small shadow (circularNavButton)
  sm: {
    shadowColor: colors.shadows.default,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // Base shadow (MatchCard container, compatibilityBadge)
  base: {
    shadowColor: colors.shadows.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8, // MatchCard uses shadowRadius: 8
    elevation: 4,
  },
  
  // Large shadow (circular action buttons)
  lg: {
    shadowColor: colors.shadows.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, // Enhanced for better visibility
    shadowRadius: 4,
    elevation: 5,
  },
  
  // Extra large shadow
  xl: {
    shadowColor: colors.shadows.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Main Theme Object
export const stellarTheme: StellarTheme = {
  colors,
  typography,
  spacing,
  dimensions,
  shadows,
};

// Utility Functions for Theme Usage

/**
 * Get a color value by path
 * Usage: getColor('primary.babyBlue') returns '#B8D4F1'
 */
export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = colors;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      logWarn(`Color path "${path}" not found in theme`, "Warning");
      return '#000000'; // Fallback to black
    }
  }
  
  return typeof value === 'string' ? value : '#000000';
};

/**
 * Get a spacing value by key
 * Usage: getSpacing('xl') returns 24
 */
export const getSpacing = (key: keyof typeof spacing): number => {
  return spacing[key] || 16; // Fallback to base spacing
};

/**
 * Get a shadow preset by key
 * Usage: getShadow('base') returns the base shadow object
 */
export const getShadow = (key: keyof typeof shadows) => {
  return shadows[key] || shadows.none;
};

/**
 * Get font family by weight
 * Usage: getFontFamily('bold') returns 'Geist-Bold'
 */
export const getFontFamily = (weight: keyof typeof typography.fontWeight): string => {
  return typography.fontWeight[weight] || typography.fontWeight.regular;
};

/**
 * Get font size by key
 * Usage: getFontSize('xl') returns 20
 */
export const getFontSize = (size: keyof typeof typography.fontSize): number => {
  return typography.fontSize[size] || typography.fontSize.base;
};

/**
 * Get border radius by key
 * Usage: getBorderRadius('lg') returns 16
 */
export const getBorderRadius = (size: keyof typeof dimensions.borderRadius): number => {
  return dimensions.borderRadius[size] || dimensions.borderRadius.base;
};

// Export individual theme sections for focused imports
export { colors, typography, spacing, dimensions, shadows };

// Export theme as default
export default stellarTheme;
