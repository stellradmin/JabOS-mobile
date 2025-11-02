/**
 * ESLint Plugin for Stellr Design System
 * 
 * Custom ESLint rules to enforce Stellr design system consistency.
 * Prevents hardcoded colors, fonts, spacing, and accessibility violations.
 */

const plugin = {
  meta: {
    name: 'eslint-plugin-stellr-design-system',
    version: '1.0.0',
  },
  rules: {
    // Typography Rules
    'no-hardcoded-font-family': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow hardcoded font families outside of Geist font system',
          category: 'Design System',
        },
        fixable: 'code',
        schema: [],
      },
      create(context) {
        const settings = context.settings['stellr-design-system'] || {};
        const approvedFontFamilies = settings.approvedFontFamilies || [];
        
        return {
          Property(node) {
            if (node.key && node.key.name === 'fontFamily' && node.value && node.value.type === 'Literal') {
              const fontFamily = node.value.value;
              if (typeof fontFamily === 'string' && !approvedFontFamilies.includes(fontFamily)) {
                context.report({
                  node,
                  message: `Font family "${fontFamily}" is not in the approved Stellr design system. Use Geist fonts or SpaceMono.`,
                  fix(fixer) {
                    // Suggest Geist-Regular as default
                    return fixer.replaceText(node.value, "'Geist-Regular'");
                  },
                });
              }
            }
          },
        };
      },
    },

    'no-hardcoded-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow hardcoded color values outside of approved palette',
          category: 'Design System',
        },
        schema: [],
      },
      create(context) {
        const settings = context.settings['stellr-design-system'] || {};
        const approvedColors = settings.approvedColors || [];
        
        // Regex to match hex colors, rgb(), rgba()
        const colorRegex = /#([0-9a-fA-F]{3,8})|rgb\(|rgba\(/;
        
        return {
          Property(node) {
            const colorProperties = [
              'color', 'backgroundColor', 'borderColor', 'shadowColor',
              'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'
            ];
            
            if (node.key && colorProperties.includes(node.key.name) && node.value) {
              let colorValue = null;
              
              if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
                colorValue = node.value.value;
              }
              
              if (colorValue && colorRegex.test(colorValue) && !approvedColors.includes(colorValue)) {
                context.report({
                  node,
                  message: `Color "${colorValue}" is not in the approved Stellr palette. Use theme colors instead.`,
                });
              }
            }
          },
        };
      },
    },

    'consistent-spacing': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce consistent spacing values from 4px grid system',
          category: 'Design System',
        },
        schema: [],
      },
      create(context) {
        const settings = context.settings['stellr-design-system'] || {};
        const approvedSpacing = settings.approvedSpacing || [];
        
        return {
          Property(node) {
            const spacingProperties = [
              'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
              'marginHorizontal', 'marginVertical',
              'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 
              'paddingHorizontal', 'paddingVertical'
            ];
            
            if (node.key && spacingProperties.includes(node.key.name) && 
                node.value && node.value.type === 'Literal' && 
                typeof node.value.value === 'number') {
              
              const spacingValue = node.value.value;
              if (!approvedSpacing.includes(spacingValue)) {
                context.report({
                  node,
                  message: `Spacing value ${spacingValue} doesn't follow 4px grid system. Use: ${approvedSpacing.join(', ')}`,
                });
              }
            }
          },
        };
      },
    },

    'min-touch-target-size': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce minimum touch target size for accessibility',
          category: 'Accessibility',
        },
        schema: [],
      },
      create(context) {
        const settings = context.settings['stellr-design-system'] || {};
        const minSize = settings.minTouchTargetSize || 44;
        
        return {
          JSXElement(node) {
            // Check TouchableOpacity and Button elements
            const touchableElements = ['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Pressable'];
            const elementName = node.openingElement.name.name;
            
            if (touchableElements.includes(elementName)) {
              const styleAttr = node.openingElement.attributes.find(
                attr => attr.name && attr.name.name === 'style'
              );
              
              if (styleAttr && styleAttr.value && styleAttr.value.type === 'JSXExpressionContainer') {
                // Check for width/height in style
                const expression = styleAttr.value.expression;
                if (expression.type === 'ObjectExpression') {
                  const widthProp = expression.properties.find(p => p.key && p.key.name === 'width');
                  const heightProp = expression.properties.find(p => p.key && p.key.name === 'height');
                  
                  if (widthProp && widthProp.value.type === 'Literal' && widthProp.value.value < minSize) {
                    context.report({
                      node: widthProp,
                      message: `Touch target width (${widthProp.value.value}) is below minimum ${minSize}px for accessibility`,
                    });
                  }
                  
                  if (heightProp && heightProp.value.type === 'Literal' && heightProp.value.value < minSize) {
                    context.report({
                      node: heightProp,
                      message: `Touch target height (${heightProp.value.value}) is below minimum ${minSize}px for accessibility`,
                    });
                  }
                }
              }
            }
          },
        };
      },
    },

    'required-accessibility-props': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require accessibility props on interactive elements',
          category: 'Accessibility',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXElement(node) {
            const interactiveElements = ['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Pressable', 'Button'];
            const elementName = node.openingElement.name.name;
            
            if (interactiveElements.includes(elementName)) {
              const hasAccessibilityLabel = node.openingElement.attributes.some(
                attr => attr.name && attr.name.name === 'accessibilityLabel'
              );
              
              const hasAccessibilityRole = node.openingElement.attributes.some(
                attr => attr.name && attr.name.name === 'accessibilityRole'
              );
              
              if (!hasAccessibilityLabel) {
                context.report({
                  node: node.openingElement,
                  message: `Interactive element ${elementName} should have accessibilityLabel prop`,
                });
              }
              
              if (!hasAccessibilityRole) {
                context.report({
                  node: node.openingElement,
                  message: `Interactive element ${elementName} should have accessibilityRole prop`,
                });
              }
            }
          },
        };
      },
    },

    'use-theme-provider': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Encourage usage of theme provider instead of hardcoded values',
          category: 'Design System',
        },
        schema: [],
      },
      create(context) {
        let hasThemeImport = false;
        
        return {
          ImportDeclaration(node) {
            const settings = context.settings['stellr-design-system'] || {};
            const themeImportPaths = settings.themeImportPaths || [];
            
            if (themeImportPaths.some(path => node.source.value.includes(path))) {
              hasThemeImport = true;
            }
          },
          
          CallExpression(node) {
            // Check for StyleSheet.create usage without theme import
            if (node.callee && 
                node.callee.object && node.callee.object.name === 'StyleSheet' &&
                node.callee.property && node.callee.property.name === 'create' &&
                !hasThemeImport) {
              
              context.report({
                node,
                message: 'Consider using theme provider for consistent styling instead of hardcoded StyleSheet values',
              });
            }
          },
        };
      },
    },

    'consistent-border-radius': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce consistent border radius values',
          category: 'Design System',
        },
        schema: [],
      },
      create(context) {
        const settings = context.settings['stellr-design-system'] || {};
        const approvedBorderRadius = settings.approvedBorderRadius || [];
        
        return {
          Property(node) {
            const borderRadiusProperties = [
              'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
              'borderBottomLeftRadius', 'borderBottomRightRadius'
            ];
            
            if (node.key && borderRadiusProperties.includes(node.key.name) && 
                node.value && node.value.type === 'Literal' && 
                typeof node.value.value === 'number') {
              
              const radiusValue = node.value.value;
              if (!approvedBorderRadius.includes(radiusValue)) {
                context.report({
                  node,
                  message: `Border radius ${radiusValue} is not a standard value. Use: ${approvedBorderRadius.join(', ')}`,
                });
              }
            }
          },
        };
      },
    },
  },
};

module.exports = plugin;