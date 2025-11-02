/**
 * Stellr Design System - Theme Utility Hooks
 * 
 * Collection of specialized hooks for working with the Stellr theme system.
 * These hooks provide convenient access to theme tokens and utilities for
 * common styling patterns used throughout the application.
 */

import { useMemo } from 'react';
import { StyleSheet, TextStyle, ViewStyle, ImageStyle } from 'react-native';
import { useStellarTheme, useTheme } from './ThemeProvider';
import { 
  StellarTheme, 
  ButtonVariant, 
  TextVariant, 
  CardVariant,
  ResponsiveValue 
} from './types';

/**
 * useThemedStyles Hook
 * 
 * Creates memoized styles using the current theme. Pass a function that
 * receives the theme and returns a StyleSheet object.
 * 
 * @param styleFactory - Function that creates styles from theme
 * @returns Memoized StyleSheet styles
 */
export const useThemedStyles = <T extends StyleSheet.NamedStyles<T>>(
  styleFactory: (theme: StellarTheme) => T
): T => {
  const { theme } = useTheme();
  
  return useMemo(() => {
    return StyleSheet.create(styleFactory(theme));
  }, [theme, styleFactory]);
};

/**
 * useThemeStyle Hook
 * 
 * Creates individual styles using theme tokens. Useful for dynamic styling
 * where you need to compute styles based on props or state.
 * 
 * @param styleFactory - Function that creates a single style object
 * @returns Memoized style object
 */
export const useThemeStyle = <T extends ViewStyle | TextStyle | ImageStyle>(
  styleFactory: (theme: StellarTheme) => T
): T => {
  const { theme } = useTheme();
  
  return useMemo(() => styleFactory(theme), [theme, styleFactory]);
};

/**
 * useButtonStyles Hook
 * 
 * Pre-configured button styles based on Stellr's button variants.
 * Maintains consistency with existing button patterns while enabling
 * easy customization.
 * 
 * @param variant - Button style variant
 * @param size - Button size ('small' | 'medium' | 'large')
 * @returns Button styles object with container and text styles
 */
export const useButtonStyles = (
  variant: ButtonVariant = 'primary',
  size: 'small' | 'medium' | 'large' = 'medium'
) => {
  const { colors, typography, dimensions, spacing, shadows } = useStellarTheme();
  
  return useMemo(() => {
    // Size configurations
    const sizeConfig = {
      small: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
        fontSize: typography.fontSize.sm,
        height: 36,
      },
      medium: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        fontSize: typography.fontSize.base,
        height: dimensions.height.button,
      },
      large: {
        paddingVertical: spacing.base,
        paddingHorizontal: spacing['2xl'],
        fontSize: typography.fontSize.lg,
        height: 52,
      },
    };
    
    // Variant configurations based on existing Stellr patterns
    const variantConfig = {
      primary: {
        backgroundColor: colors.primary.black,
        color: colors.primary.white,
        borderColor: colors.primary.black,
        borderWidth: 2,
      },
      secondary: {
        backgroundColor: colors.primary.babyBlue,
        color: colors.primary.black,
        borderColor: colors.primary.black,
        borderWidth: 2,
      },
      tertiary: {
        backgroundColor: colors.primary.white,
        color: colors.primary.black,
        borderColor: colors.borders.primary,
        borderWidth: 2,
      },
      danger: {
        backgroundColor: colors.actions.decline,
        color: colors.primary.white,
        borderColor: colors.actions.decline,
        borderWidth: 2,
      },
      success: {
        backgroundColor: colors.actions.accept,
        color: colors.primary.white,
        borderColor: colors.actions.accept,
        borderWidth: 2,
      },
    };
    
    const sizeStyles = sizeConfig[size];
    const variantStyles = variantConfig[variant];
    
    const containerStyle: ViewStyle = {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: dimensions.borderRadius.base,
      minWidth: dimensions.touchTarget.minimum,
      minHeight: dimensions.touchTarget.minimum,
      ...sizeStyles,
      backgroundColor: variantStyles.backgroundColor,
      borderColor: variantStyles.borderColor,
      borderWidth: variantStyles.borderWidth,
      ...shadows.base,
    };
    
    const textStyle: TextStyle = {
      fontFamily: typography.fontWeight.semiBold,
      fontSize: sizeStyles.fontSize,
      color: variantStyles.color,
      textAlign: 'center',
    };
    
    return {
      container: containerStyle,
      text: textStyle,
    };
  }, [variant, size, colors, typography, dimensions, spacing, shadows]);
};

/**
 * useTextStyles Hook
 * 
 * Pre-configured text styles based on Stellr's typography hierarchy.
 * Matches existing text patterns found in components.
 * 
 * @param variant - Text style variant
 * @returns Text style object
 */
export const useTextStyles = (variant: TextVariant = 'body') => {
  const { colors, typography } = useStellarTheme();
  
  return useMemo(() => {
    const variantStyles: Record<TextVariant, TextStyle> = {
      heading1: {
        fontFamily: typography.fontWeight.bold,
        fontSize: typography.fontSize['3xl'], // 28px like zodiacSubheaderText
        color: colors.text.primary,
        lineHeight: typography.lineHeight.tight * typography.fontSize['3xl'],
      },
      heading2: {
        fontFamily: typography.fontWeight.bold,
        fontSize: typography.fontSize.xl, // 20px like meetUserText
        color: colors.text.primary,
        lineHeight: typography.lineHeight.tight * typography.fontSize.xl,
      },
      heading3: {
        fontFamily: typography.fontWeight.bold,
        fontSize: typography.fontSize.lg, // 18px like compatibilityTitle
        color: colors.text.primary,
        lineHeight: typography.lineHeight.tight * typography.fontSize.lg,
      },
      body: {
        fontFamily: typography.fontWeight.regular,
        fontSize: typography.fontSize.base, // 16px standard body text
        color: colors.text.secondary,
        lineHeight: typography.lineHeight.normal * typography.fontSize.base,
      },
      caption: {
        fontFamily: typography.fontWeight.medium,
        fontSize: typography.fontSize.xs, // 12px like compatibility labels
        color: colors.text.tertiary,
        lineHeight: typography.lineHeight.normal * typography.fontSize.xs,
      },
      label: {
        fontFamily: typography.fontWeight.semiBold,
        fontSize: typography.fontSize.sm, // 14px supporting text
        color: colors.text.secondary,
        lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
      },
    };
    
    return variantStyles[variant];
  }, [variant, colors, typography]);
};

/**
 * useCardStyles Hook
 * 
 * Pre-configured card styles based on existing Stellr card patterns.
 * Matches the styling found in MatchCard and other components.
 * 
 * @param variant - Card style variant
 * @returns Card styles object with container and content styles
 */
export const useCardStyles = (variant: CardVariant = 'elevated') => {
  const { colors, dimensions, spacing, shadows } = useStellarTheme();
  
  return useMemo(() => {
    const baseStyle: ViewStyle = {
      backgroundColor: colors.background.primary,
      borderRadius: dimensions.borderRadius.lg, // 16px like MatchCard
      overflow: 'hidden',
    };
    
    const variantStyles: Record<CardVariant, ViewStyle> = {
      elevated: {
        ...baseStyle,
        ...shadows.base, // Matches MatchCard shadow
        borderWidth: 0,
      },
      outlined: {
        ...baseStyle,
        borderWidth: 2,
        borderColor: colors.borders.primary,
        ...shadows.none,
      },
      filled: {
        ...baseStyle,
        backgroundColor: colors.background.secondary,
        borderWidth: 0,
        ...shadows.sm,
      },
    };
    
    const containerStyle = variantStyles[variant];
    
    const contentStyle: ViewStyle = {
      padding: spacing.xl, // 24px like MatchCard content
    };
    
    return {
      container: containerStyle,
      content: contentStyle,
    };
  }, [variant, colors, dimensions, spacing, shadows]);
};

/**
 * useResponsiveSpacing Hook
 * 
 * Provides responsive spacing based on screen size or props.
 * Useful for components that need different spacing on different devices.
 * 
 * @param spacingValue - Responsive spacing configuration
 * @returns Computed spacing value
 */
export const useResponsiveSpacing = (
  spacingValue: ResponsiveValue<keyof typeof import('./index').spacing>
) => {
  const { spacing } = useStellarTheme();
  
  return useMemo(() => {
    // If it's a simple value, return the spacing
    if (typeof spacingValue === 'string') {
      return spacing[spacingValue];
    }
    
    // For now, return the base value (future enhancement: add breakpoint logic)
    return spacing[spacingValue.base || 'base'];
  }, [spacingValue, spacing]);
};

/**
 * useAccessibleTouchTarget Hook
 * 
 * Ensures touch targets meet accessibility requirements.
 * Based on existing ACCESSIBILITY_CONSTANTS implementation.
 * 
 * @param width - Desired width
 * @param height - Desired height  
 * @returns Accessibility-compliant dimensions
 */
export const useAccessibleTouchTarget = (
  width?: number,
  height?: number
) => {
  const { dimensions } = useStellarTheme();
  
  return useMemo(() => {
    const minSize = dimensions.touchTarget.minimum; // 44px
    
    return {
      width: Math.max(width || minSize, minSize),
      height: Math.max(height || minSize, minSize),
      minWidth: minSize,
      minHeight: minSize,
    };
  }, [width, height, dimensions]);
};

/**
 * usePlatformShadow Hook
 * 
 * Provides platform-appropriate shadow styles.
 * Uses elevation for Android and shadow properties for iOS.
 * 
 * @param shadowKey - Shadow preset key
 * @returns Platform-appropriate shadow style
 */
export const usePlatformShadow = (
  shadowKey: keyof typeof import('./index').shadows = 'base'
) => {
  const { shadows } = useStellarTheme();
  
  return useMemo(() => {
    const shadowStyle = shadows[shadowKey];
    
    // Return the complete shadow object (works for both platforms)
    return {
      shadowColor: shadowStyle.shadowColor,
      shadowOffset: shadowStyle.shadowOffset,
      shadowOpacity: shadowStyle.shadowOpacity,
      shadowRadius: shadowStyle.shadowRadius,
      elevation: shadowStyle.elevation,
    };
  }, [shadowKey, shadows]);
};

/**
 * useThemedInteractionStyles Hook
 * 
 * Provides consistent interaction styles (pressed, disabled states).
 * Based on existing interaction patterns in the app.
 * 
 * @param baseColor - Base color for the interaction
 * @returns Interaction state styles
 */
export const useThemedInteractionStyles = (baseColor: string) => {
  const { colors } = useStellarTheme();
  
  return useMemo(() => {
    // Map base colors to their pressed states (from extracted patterns)
    const pressedColorMap: Record<string, string> = {
      [colors.primary.babyBlue]: colors.interactive.babyBluePressed,
      [colors.primary.lavender]: colors.interactive.lavenderPressed,
      [colors.primary.black]: colors.text.secondary, // Slightly lighter black
    };
    
    return {
      default: {
        backgroundColor: baseColor,
      },
      pressed: {
        backgroundColor: pressedColorMap[baseColor] || baseColor,
        opacity: pressedColorMap[baseColor] ? 1 : 0.8,
      },
      disabled: {
        backgroundColor: colors.background.secondary,
        opacity: 0.6,
      },
    };
  }, [baseColor, colors]);
};

// Export all hooks
export default {
  useThemedStyles,
  useThemeStyle,
  useButtonStyles,
  useTextStyles,
  useCardStyles,
  useResponsiveSpacing,
  useAccessibleTouchTarget,
  usePlatformShadow,
  useThemedInteractionStyles,
};