// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const stellrDesignSystemPlugin = require('./eslint-plugin-stellr-design-system');

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*", "node_modules/*", "*.config.js"],
  },
  {
    // Stellr Design System Rules
    plugins: {
      'stellr-design-system': stellrDesignSystemPlugin,
    },
    rules: {
      // Typography Rules
      'stellr-design-system/no-hardcoded-font-family': 'error',
      'stellr-design-system/consistent-spacing': 'warn',
      
      // Color Rules (stricter enforcement)
      'stellr-design-system/no-hardcoded-colors': 'error',
      
      // Accessibility Rules (critical for Stellr)
      'stellr-design-system/min-touch-target-size': 'error',
      'stellr-design-system/required-accessibility-props': 'warn', // Warn since existing components might not have all props
      
      // Component Rules
      'stellr-design-system/use-theme-provider': 'warn',
      'stellr-design-system/consistent-border-radius': 'warn',
    },
    settings: {
      'stellr-design-system': {
        // Approved color palette (extracted from existing Stellr implementation)
        approvedColors: [
          '#B8D4F1', '#C8A8E9', '#9FC4E7', '#B19CD9', '#A88BC9', // Brand colors
          '#000000', '#FFFFFF', '#1f2937', '#666666', '#555555', '#999999', '#9ca3af', // Text colors
          '#f5f5f5', '#f3f4f6', '#0F172A', '#0a0a0a', // Backgrounds
          '#ef4444', '#22c55e', '#f59e0b', '#007AFF', // Status colors
          '#16a34a', '#dc2626', // Action colors
          '#e5e7eb', '#d1d5db', // Border colors
          // Allow common transparent and percentage values
          'transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.3)', 
          'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.9)',
        ],
        
        // Approved font families (Geist system)
        approvedFontFamilies: [
          'Geist-Thin', 'Geist-ExtraLight', 'Geist-Light', 'Geist-Regular',
          'Geist-Medium', 'Geist-SemiBold', 'Geist-Bold', 'Geist-Black', 
          'Geist-ExtraBold', 'SpaceMono',
        ],
        
        // 4px grid spacing system
        approvedSpacing: [0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 44, 48, 60, 64, 80, 90, 100],
        
        // Consistent border radius values
        approvedBorderRadius: [0, 8, 12, 16, 20, 30, 9999], // Added 30 for circular buttons
        
        // Accessibility minimum
        minTouchTargetSize: 44,
        
        // Theme import paths
        themeImportPaths: ['src/theme', '../theme', './theme', '@/theme'],
      },
    },
  }
];
