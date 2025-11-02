/**
 * Stellr Design System - Theme Provider Component
 * 
 * React Context provider for the Stellr theme system, enabling consistent
 * access to design tokens throughout the application. Built specifically
 * for React Native with Expo compatibility.
 */

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { stellarTheme } from './index';
import { StellarTheme, ThemeContextType } from './types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Create the theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme Provider Props
interface ThemeProviderProps {
  children: ReactNode;
  forceDarkMode?: boolean;
  forceLightMode?: boolean;
}

/**
 * ThemeProvider Component
 * 
 * Provides theme context to all child components. Supports system color scheme
 * detection and manual dark/light mode overrides for testing and user preference.
 * 
 * @param children - React child components
 * @param forceDarkMode - Force dark mode (overrides system setting)
 * @param forceLightMode - Force light mode (overrides system setting)
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  forceDarkMode = false,
  forceLightMode = false,
}) => {
  // Get system color scheme preference
  const systemColorScheme = useColorScheme();
  
  // Determine current theme mode
  const isDarkMode = useMemo(() => {
    if (forceDarkMode) return true;
    if (forceLightMode) return false;
    return systemColorScheme === 'dark';
  }, [systemColorScheme, forceDarkMode, forceLightMode]);
  
  // Create theme with dark mode variations
  const theme: StellarTheme = useMemo(() => {
    if (!isDarkMode) {
      // Return standard light theme (current implementation)
      return stellarTheme;
    }
    
    // Dark mode theme (future enhancement - currently returns light theme)
    // This preserves existing visual design while preparing for dark mode
    return {
      ...stellarTheme,
      colors: {
        ...stellarTheme.colors,
        // Future: Dark mode color overrides would go here
        // For now, we maintain existing light theme colors
      },
    };
  }, [isDarkMode]);
  
  // Theme context value
  const contextValue: ThemeContextType = useMemo(() => ({
    theme,
    isDarkMode,
    toggleDarkMode: () => {
      // Future enhancement: Add dark mode toggle functionality
      logDebug('Dark mode toggle - future enhancement', "Debug");
    },
  }), [theme, isDarkMode]);
  
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Fallback context used when a component calls `useTheme` outside of the
 * configured provider. This should never happen in production but gives us a
 * safe escape hatch so critical screens (like signup) still render instead of
 * crashing with a blank view.
 */
const fallbackToggleDarkMode = () => {
  logWarn('Dark mode toggle requested without ThemeProvider context', 'Theme');
};

const fallbackContext: ThemeContextType = {
  theme: stellarTheme,
  isDarkMode: false,
  toggleDarkMode: fallbackToggleDarkMode,
};

let hasLoggedMissingProvider = false;

/**
 * useTheme Hook
 * 
 * Custom hook to access the Stellr theme context. Provides type-safe access
 * to all theme tokens and utility functions. If a component renders outside of
 * the provider, we log the mistake and return a safe default so the UI keeps
 * working while developers investigate.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    if (!hasLoggedMissingProvider) {
      logWarn('ThemeProvider context missing. Falling back to default theme.', 'Theme');
      hasLoggedMissingProvider = true;
    }
    return fallbackContext;
  }
  
  return context;
};

/**
 * useStellarTheme Hook
 * 
 * Convenience hook that returns just the theme object with destructured
 * sections for easy access to colors, typography, spacing, etc.
 * 
 * @returns Destructured theme sections for convenient access
 */
export const useStellarTheme = () => {
  const { theme } = useTheme();
  
  return {
    theme,
    colors: theme.colors,
    typography: theme.typography,
    spacing: theme.spacing,
    dimensions: theme.dimensions,
    shadows: theme.shadows,
  };
};

/**
 * withTheme HOC (Higher-Order Component)
 * 
 * Higher-order component that injects theme props into a component.
 * Useful for class components or when you need to pass theme to
 * multiple child components.
 * 
 * @param Component - React component to enhance with theme
 * @returns Component with theme props injected
 */
export const withTheme = <P extends object>(
  Component: React.ComponentType<P & { theme: StellarTheme }>
) => {
  const ThemedComponent = (props: P) => {
    const { theme } = useTheme();
    return <Component {...props} theme={theme} />;
  };
  
  ThemedComponent.displayName = `withTheme(${Component.displayName || Component.name})`;
  
  return ThemedComponent;
};

/**
 * Theme Utility Hooks for Specific Use Cases
 */

/**
 * useThemeColors Hook
 * 
 * Returns just the colors section of the theme for components
 * that primarily work with colors.
 */
export const useThemeColors = () => {
  const { colors } = useStellarTheme();
  return colors;
};

/**
 * useThemeTypography Hook
 * 
 * Returns just the typography section of the theme for text
 * components and typography-focused usage.
 */
export const useThemeTypography = () => {
  const { typography } = useStellarTheme();
  return typography;
};

/**
 * useThemeSpacing Hook
 * 
 * Returns just the spacing section of the theme for layout
 * components and spacing-focused usage.
 */
export const useThemeSpacing = () => {
  const { spacing } = useStellarTheme();
  return spacing;
};

/**
 * useThemeDimensions Hook
 * 
 * Returns just the dimensions section of the theme for
 * component sizing and dimension-focused usage.
 */
export const useThemeDimensions = () => {
  const { dimensions } = useStellarTheme();
  return dimensions;
};

/**
 * useThemeShadows Hook
 * 
 * Returns just the shadows section of the theme for
 * elevation and shadow-focused usage.
 */
export const useThemeShadows = () => {
  const { shadows } = useStellarTheme();
  return shadows;
};

/**
 * useResponsiveTheme Hook
 * 
 * Enhanced theme hook that includes responsive utilities.
 * Useful for components that need to adapt to different screen sizes.
 */
export const useResponsiveTheme = () => {
  const themeData = useStellarTheme();
  
  // Future enhancement: Add responsive breakpoints and utilities
  return {
    ...themeData,
    // Responsive utilities would go here
    isSmallScreen: false, // Future: Add screen size detection
    isMediumScreen: false,
    isLargeScreen: false,
  };
};

// Export theme context for advanced usage
export { ThemeContext };

// Default export
export default ThemeProvider;
