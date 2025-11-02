/**
 * Stellr Design System ESLint Configuration
 * 
 * Custom ESLint rules to enforce Stellr's design system consistency
 * and prevent common styling inconsistencies.
 */

module.exports = {
  plugins: ['stellr-design-system'],
  rules: {
    // Typography Rules
    'stellr-design-system/no-hardcoded-font-family': 'error',
    'stellr-design-system/enforce-geist-font-usage': 'error',
    'stellr-design-system/consistent-font-sizes': 'warn',
    
    // Color Rules  
    'stellr-design-system/no-hardcoded-colors': 'error',
    'stellr-design-system/use-theme-colors': 'error',
    'stellr-design-system/approved-color-palette': 'error',
    
    // Spacing Rules
    'stellr-design-system/consistent-spacing': 'warn',
    'stellr-design-system/4px-grid-spacing': 'warn',
    'stellr-design-system/no-arbitrary-margins': 'error',
    
    // Accessibility Rules
    'stellr-design-system/min-touch-target-size': 'error',
    'stellr-design-system/required-accessibility-props': 'error',
    'stellr-design-system/proper-contrast-ratios': 'warn',
    
    // Component Rules
    'stellr-design-system/use-theme-provider': 'error',
    'stellr-design-system/consistent-border-radius': 'warn',
    'stellr-design-system/prefer-theme-shadows': 'warn',
  },
  settings: {
    'stellr-design-system': {
      // Approved color palette (extracted from audit)
      approvedColors: [
        '#B8D4F1', // Baby blue
        '#C8A8E9', // Lavender
        '#9FC4E7', // Baby blue pressed
        '#B19CD9', // Lavender pressed
        '#A88BC9', // Lavender dark
        '#000000', // Black
        '#FFFFFF', // White
        '#1f2937', // Enhanced black
        '#666666', // Tertiary text
        '#555555', // Quaternary text
        '#999999', // Disabled text
        '#9ca3af', // Muted text
        '#f5f5f5', // Secondary background
        '#f3f4f6', // Tertiary background
        '#0F172A', // Dark background
        '#0a0a0a', // Dark secondary
        '#ef4444', // Error
        '#22c55e', // Success
        '#f59e0b', // Warning
        '#007AFF', // Info
        '#16a34a', // Accept action
        '#dc2626', // Decline action
        '#e5e7eb', // Secondary border
        '#d1d5db', // Tertiary border
      ],
      
      // Approved font families
      approvedFontFamilies: [
        'Geist-Thin',
        'Geist-ExtraLight', 
        'Geist-Light',
        'Geist-Regular',
        'Geist-Medium',
        'Geist-SemiBold',
        'Geist-Bold',
        'Geist-Black',
        'Geist-ExtraBold',
        'SpaceMono',
      ],
      
      // Approved font sizes (in pixels)
      approvedFontSizes: [12, 14, 16, 18, 20, 24, 28],
      
      // Approved spacing values (4px grid)
      approvedSpacing: [4, 8, 12, 16, 20, 24, 32, 44, 48, 64],
      
      // Approved border radius values
      approvedBorderRadius: [8, 12, 16, 20, 9999],
      
      // Minimum touch target size (accessibility)
      minTouchTargetSize: 44,
      
      // Theme import paths
      themeImportPaths: [
        'src/theme',
        '../theme',
        './theme',
        '@/theme',
      ],
    },
  },
};