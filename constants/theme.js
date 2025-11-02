/**
 * Legacy Theme Constants
 * 
 * This file provides backward compatibility with existing theme imports
 * while delegating to the new centralized theme system.
 */

import { colors, typography, spacing, dimensions, shadows } from '../src/theme';

// Color Constants (mapped from new theme system)
export const COLORS = {
  // Primary colors
  PRIMARY_BLUE: colors.primary.babyBlue,
  PRIMARY_LAVENDER: colors.primary.lavender,
  PRIMARY_BLACK: colors.primary.black,
  PRIMARY_WHITE: colors.primary.white,
  
  // Card/background shortcuts used across the app
  // Ensure this matches the dashboard background exactly (#1C1C1E)
  BLACK_CARD: '#1C1C1E', // Solid dark for nav and trays
  WHITE_CARD: colors.background.primary,       // Pure white card/background
  YELLOW_CARD: colors.primary.lavender,        // Use Lavender instead of Yellow for cards
  
  // Interactive states
  PRIMARY_BLUE_PRESSED: colors.interactive.babyBluePressed,
  PRIMARY_LAVENDER_PRESSED: colors.interactive.lavenderPressed,
  BUTTON_PRESS_BG: colors.background.tertiary, // Neutral pressed/hover background
  LIGHT_INTERACTIVE_BG: colors.background.secondary, // Light interactive surfaces
  
  // Text colors
  CARD_WHITE_TEXT: colors.primary.white,      // Text/icon color on dark cards
  CARD_BLACK_TEXT: colors.text.secondary,     // Text on white backgrounds
  DARK_TEXT: colors.text.secondary,           // Primary dark text
  SECONDARY_TEXT: colors.text.muted,          // Subtle/placeholder text
  MUTED_TEXT: colors.text.tertiary,
  DISABLED_TEXT: colors.text.disabled,
  
  // Background colors
  BACKGROUND_PRIMARY: colors.background.primary,
  BACKGROUND_SECONDARY: colors.background.secondary,
  BACKGROUND_TERTIARY: colors.background.tertiary,
  
  // Status colors
  ERROR: colors.status.error,
  SUCCESS: colors.status.success,
  WARNING: colors.status.warning,
  INFO: colors.status.info,
  SUCCESS_COLOR: colors.status.success,        // Alias used by some components
  ERROR_COLOR: colors.status.error,            // Alias used by some components
  
  // Action colors
  ACCEPT_GREEN: colors.actions.accept,
  DECLINE_RED: colors.actions.decline,
  
  // Border colors
  BORDER_PRIMARY: colors.borders.primary,
  BORDER_SECONDARY: colors.borders.secondary,
  BORDER_TERTIARY: colors.borders.tertiary,
  CARD_BORDER: colors.borders.secondary,       // Alias used by messaging components

  // Shadow color shortcut used in several components
  CARD_SHADOW: colors.shadows.default,

  // Legacy aliases used in some components
  CORAL: colors.status.error,

  // Additional card color aliases
  BLUE_CARD: colors.primary.babyBlue,          // Blue card/background alias
  OVERLAY_BG: colors.background.tertiary,      // Light overlay chips / badges
  TAG_BG: colors.background.tertiary,          // Tag background
  CHARCOAL: colors.text.secondary,             // Dark text alias
  SOFT_WHITE: colors.primary.white,            // White alias for buttons/text
  SUCCESS: colors.status.success,              // Success alias
};

// Text Style Presets (using new typography system)
export const TEXT_STYLES = {
  // Display styles
  DISPLAY_LARGE: {
    fontFamily: typography.fontWeight.bold,
    fontSize: typography.fontSize['3xl'],
    lineHeight: typography.lineHeight.tight * typography.fontSize['3xl'],
  },
  DISPLAY_MEDIUM: {
    fontFamily: typography.fontWeight.bold,
    fontSize: typography.fontSize['2xl'],
    lineHeight: typography.lineHeight.tight * typography.fontSize['2xl'],
  },
  DISPLAY_SMALL: {
    fontFamily: typography.fontWeight.semiBold,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.tight * typography.fontSize.xl,
  },
  
  // Heading styles
  HEADING_LARGE: {
    fontFamily: typography.fontWeight.bold,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.tight * typography.fontSize.xl,
  },
  HEADING_MEDIUM: {
    fontFamily: typography.fontWeight.semiBold,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.tight * typography.fontSize.lg,
  },
  HEADING_SMALL: {
    fontFamily: typography.fontWeight.semiBold,
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal * typography.fontSize.base,
  },
  
  // Body styles
  BODY_LARGE: {
    fontFamily: typography.fontWeight.regular,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.normal * typography.fontSize.lg,
  },
  BODY_MEDIUM: {
    fontFamily: typography.fontWeight.regular,
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal * typography.fontSize.base,
  },
  BODY_SMALL: {
    fontFamily: typography.fontWeight.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },
  BODY_SMALL_MEDIUM: {
    fontFamily: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },
  
  // Caption styles
  CAPTION_MEDIUM: {
    fontFamily: typography.fontWeight.medium,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.normal * typography.fontSize.xs,
  },
  CAPTION_SMALL: {
    fontFamily: typography.fontWeight.regular,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.normal * typography.fontSize.xs,
  },
};

// Card Style Presets (using new theme system)
export const WHITE_CARD_STYLES = {
  backgroundColor: colors.background.primary,
  borderRadius: dimensions.borderRadius.lg,
  padding: spacing.xl,
  ...shadows.base,
};

export const BLUE_CARD_STYLES = {
  backgroundColor: colors.primary.babyBlue,
  borderRadius: dimensions.borderRadius.lg,
  padding: spacing.xl,
  ...shadows.base,
};

export const YELLOW_CARD_STYLES = {
  backgroundColor: colors.primary.lavender,
  borderRadius: dimensions.borderRadius.lg,
  padding: spacing.xl,
  ...shadows.base,
};

// Export legacy default for compatibility
export default {
  COLORS,
  TEXT_STYLES,
  WHITE_CARD_STYLES,
  BLUE_CARD_STYLES,
  YELLOW_CARD_STYLES,
};
