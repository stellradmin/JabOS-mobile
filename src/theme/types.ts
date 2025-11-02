/**
 * Stellr Design System - TypeScript Type Definitions
 * 
 * These types define the structure of Stellr's design system,
 * extracted from the existing codebase to maintain consistency
 * while enabling type-safe usage throughout the application.
 */

// Color System Types
export interface StellarColors {
  // Primary Brand Colors (extracted from existing usage)
  primary: {
    babyBlue: string;      // #B8D4F1 - Main brand color (onboarding, cards)
    lavender: string;      // #C8A8E9 - Secondary brand color (questionnaire, accents)
    black: string;         // #000000 - Primary actions, stepper states
    white: string;         // #FFFFFF - Backgrounds, contrast text
  };
  
  // Interactive State Colors (extracted from component usage)
  interactive: {
    babyBluePressed: string;   // #9FC4E7 - Pressed state for baby blue
    lavenderPressed: string;   // #B19CD9 - Pressed state for lavender
    lavenderDark: string;      // #A88BC9 - Darker lavender variant
  };
  
  // Text Hierarchy (from component analysis)
  text: {
    primary: string;       // #000000 - Primary headings, important text
    secondary: string;     // #1f2937 - Secondary text, body content
    tertiary: string;      // #666666 - Supporting text, labels
    quaternary: string;    // #555555 - Subtle text, placeholders
    disabled: string;      // #999999 - Disabled state text
    muted: string;         // #9ca3af - Very subtle text
  };
  
  // Background Colors
  background: {
    primary: string;       // #FFFFFF - Main backgrounds
    secondary: string;     // #f5f5f5 - Card backgrounds, secondary surfaces
    tertiary: string;      // #f3f4f6 - Image placeholders, subtle backgrounds
    dark: string;          // #0F172A - Dark theme backgrounds
    darkSecondary: string; // #0a0a0a - Darker backgrounds
  };
  
  // Status & Feedback Colors
  status: {
    error: string;         // #ef4444 - Error states, danger actions
    success: string;       // #22c55e - Success states, positive actions
    warning: string;       // #f59e0b - Warning states, caution
    info: string;          // #007AFF - Information, links
  };
  
  // Action Colors (from MatchCard analysis)
  actions: {
    accept: string;        // #16a34a - Accept/like actions (enhanced green)
    decline: string;       // #dc2626 - Decline/pass actions (enhanced red)
    compatibility: string; // #1f2937 - Compatibility/view actions
  };
  
  // Border & Outline Colors
  borders: {
    primary: string;       // #000000 - Strong borders, card outlines
    secondary: string;     // #e5e7eb - Subtle borders, dividers
    tertiary: string;      // #d1d5db - Very subtle borders
  };
  
  // Shadow Colors
  shadows: {
    default: string;       // #000000 - Default shadow color
  };
}

// Typography System Types
export interface StellarTypography {
  // Font Families (based on Tailwind config analysis)
  fontFamily: {
    geistThin: string;
    geistExtraLight: string;
    geistLight: string;
    geistRegular: string;
    geistMedium: string;
    geistSemiBold: string;
    geistBold: string;
    geistBlack: string;
    geistExtraBold: string;
    mono: string;
  };
  
  // Font Sizes (extracted from component usage)
  fontSize: {
    xs: number;    // 12px - Small labels, captions
    sm: number;    // 14px - Supporting text
    base: number;  // 16px - Body text, standard size
    lg: number;    // 18px - Secondary headings, emphasized text
    xl: number;    // 20px - Primary headings
    '2xl': number; // 24px - Large headings
    '3xl': number; // 28px - Main headers (zodiac subheader)
  };
  
  // Font Weights (mapped to Geist family)
  fontWeight: {
    thin: string;
    extraLight: string;
    light: string;
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
    black: string;
    extraBold: string;
  };
  
  // Line Heights (responsive typography)
  lineHeight: {
    tight: number;    // 1.2 - Headings, compact text
    normal: number;   // 1.5 - Body text
    relaxed: number;  // 1.6 - Readable paragraphs
  };
}

// Spacing System Types (based on 4px grid analysis)
export interface StellarSpacing {
  // Base spacing scale (4px grid system)
  xs: number;      // 4px
  sm: number;      // 8px
  md: number;      // 12px
  base: number;    // 16px
  lg: number;      // 20px
  xl: number;      // 24px
  '2xl': number;   // 32px
  '3xl': number;   // 44px (accessibility minimum)
  '4xl': number;   // 48px
  '5xl': number;   // 64px
}

// Component Dimensions (accessibility and consistency)
export interface StellarDimensions {
  // Touch Targets (accessibility compliance)
  touchTarget: {
    minimum: number;    // 44px - WCAG AA minimum
    comfortable: number; // 60px - Optimal for primary actions
  };
  
  // Border Radius (extracted patterns)
  borderRadius: {
    sm: number;    // 8px - Small elements
    base: number;  // 12px - Standard radius
    lg: number;    // 16px - Cards, containers
    xl: number;    // 20px - Large containers
    full: number;  // 9999px - Circular elements
  };
  
  // Component Heights (common patterns)
  height: {
    button: number;      // Standard button height
    input: number;       // Form input height
    header: number;      // Header/navbar height
    tabBar: number;      // Bottom tab bar height
  };
}

// Shadow & Elevation System
export interface StellarShadows {
  // Shadow presets (iOS and Android compatible)
  none: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  
  sm: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  
  base: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  
  lg: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  
  xl: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

// Main Theme Interface
export interface StellarTheme {
  colors: StellarColors;
  typography: StellarTypography;
  spacing: StellarSpacing;
  dimensions: StellarDimensions;
  shadows: StellarShadows;
}

// Utility Types for Component Development
export type ColorKey = keyof StellarColors | 
  keyof StellarColors['primary'] |
  keyof StellarColors['interactive'] |
  keyof StellarColors['text'] |
  keyof StellarColors['background'] |
  keyof StellarColors['status'] |
  keyof StellarColors['actions'] |
  keyof StellarColors['borders'];

export type TypographyKey = keyof StellarTypography['fontSize'] |
  keyof StellarTypography['fontWeight'] |
  keyof StellarTypography['fontFamily'];

export type SpacingKey = keyof StellarSpacing;

export type DimensionKey = keyof StellarDimensions['borderRadius'] |
  keyof StellarDimensions['touchTarget'] |
  keyof StellarDimensions['height'];

// Theme Context Types
export interface ThemeContextType {
  theme: StellarTheme;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

// Hook Return Types
export interface UseThemeReturn {
  theme: StellarTheme;
  colors: StellarColors;
  typography: StellarTypography;
  spacing: StellarSpacing;
  dimensions: StellarDimensions;
  shadows: StellarShadows;
}

// Style Helper Types
export type ThemeStyleProps = {
  theme?: StellarTheme;
};

export type ResponsiveValue<T> = T | {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
};

// Component Variant Types (for consistent styling)
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success';
export type TextVariant = 'heading1' | 'heading2' | 'heading3' | 'body' | 'caption' | 'label';
export type CardVariant = 'elevated' | 'outlined' | 'filled';

export default StellarTheme;