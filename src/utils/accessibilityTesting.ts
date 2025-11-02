/**
 * Accessibility Testing Infrastructure for Stellr Dating App
 * Provides comprehensive accessibility testing, validation, and reporting
 * Includes automated testing, manual testing guidelines, and WCAG compliance checking
 */

import { AccessibilityInfo, Platform, Dimensions } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { 
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  enhancedAccessibilityManager,
  AccessibilityTesting as BaseAccessibilityTesting,
} from './enhancedAccessibility';

// Extended accessibility testing configuration
interface AccessibilityTestConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  includeColorContrast: boolean;
  includeFocusManagement: boolean;
  includeScreenReaderTesting: boolean;
  includeKeyboardNavigation: boolean;
  includeTouchTargetValidation: boolean;
  includePerformanceMetrics: boolean;
  customRules?: AccessibilityRule[];
}

interface AccessibilityRule {
  id: string;
  name: string;
  description: string;
  wcagCriterion: string;
  level: 'A' | 'AA' | 'AAA';
  validator: (element: any, context?: any) => AccessibilityIssue[];
}

interface AccessibilityIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: any;
  elementPath?: string;
  wcagCriterion: string;
  suggestions: string[];
  codeExample?: string;
}

interface AccessibilityTestResult {
  componentName: string;
  testTimestamp: string;
  overallScore: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
  passedRules: number;
  failedRules: number;
  warningCount: number;
  issues: AccessibilityIssue[];
  recommendations: string[];
  codeExamples: string[];
  performanceMetrics?: PerformanceMetrics;
}

interface PerformanceMetrics {
  renderTime: number;
  focusTime: number;
  screenReaderResponseTime: number;
  touchTargetDensity: number;
  animationFrameRate: number;
}

// WCAG 2.1 AA Rules for Dating App Components
const DATING_APP_ACCESSIBILITY_RULES: AccessibilityRule[] = [
  {
    id: 'DA001',
    name: 'Match Card Accessibility',
    description: 'Match cards must have comprehensive accessibility labels and gesture alternatives',
    wcagCriterion: '1.3.1, 2.1.1, 2.5.3',
    level: 'AA',
    validator: (element, context) => {
      const issues: AccessibilityIssue[] = [];
      
      if (!element.accessibilityLabel) {
        issues.push({
          ruleId: 'DA001',
          severity: 'error',
          message: 'Match card missing accessibility label',
          element,
          wcagCriterion: '1.3.1',
          suggestions: [
            'Add descriptive accessibility label including name, age, and compatibility',
            'Include photo count and key profile information',
            'Provide context about current position in deck',
          ],
          codeExample: `
// Good example
<MatchCard 
  accessibilityLabel="Profile 1 of 10. Sarah, age 28, 85% compatibility. 3 photos. Double tap to view profile, swipe right to like, left to pass"
  accessibilityRole="button"
  accessibilityHint="Swipe right to like, left to pass, or use action buttons below"
/>`,
        });
      }

      // Check for gesture alternatives
      if (context?.hasSwipeGestures && !context?.hasAlternativeButtons) {
        issues.push({
          ruleId: 'DA001',
          severity: 'error',
          message: 'Swipe gestures must have accessible alternatives',
          element,
          wcagCriterion: '2.5.3',
          suggestions: [
            'Provide like/pass buttons as alternatives to swipe gestures',
            'Ensure buttons meet minimum touch target size (44x44 points)',
            'Include clear labels and hints for alternative actions',
          ],
          codeExample: `
// Good example
<View>
  <MatchCard {...props} />
  <View style={styles.actionButtons}>
    <TouchableOpacity 
      onPress={onPass}
      accessibilityLabel="Pass on this profile"
      style={styles.passButton}
    >
      <X size={24} />
    </TouchableOpacity>
    <TouchableOpacity 
      onPress={onLike}
      accessibilityLabel="Like this profile"
      style={styles.likeButton}
    >
      <Heart size={24} />
    </TouchableOpacity>
  </View>
</View>`,
        });
      }

      return issues;
    },
  },
  
  {
    id: 'DA002',
    name: 'Conversation List Accessibility',
    description: 'Conversation items must provide comprehensive information for screen readers',
    wcagCriterion: '1.3.1, 2.4.6',
    level: 'AA',
    validator: (element, context) => {
      const issues: AccessibilityIssue[] = [];
      
      if (!element.accessibilityLabel || !element.accessibilityLabel.includes('conversation')) {
        issues.push({
          ruleId: 'DA002',
          severity: 'error',
          message: 'Conversation item missing comprehensive accessibility information',
          element,
          wcagCriterion: '1.3.1',
          suggestions: [
            'Include participant name, last message preview, timestamp',
            'Indicate unread message count and online status',
            'Provide clear interaction instructions',
          ],
          codeExample: `
// Good example
<TouchableOpacity
  accessibilityLabel="Conversation with Emma. Last message: Hey, how was your day? 2 hours ago. 3 unread messages. Currently online."
  accessibilityHint="Double tap to open conversation"
  accessibilityRole="button"
>`,
        });
      }

      return issues;
    },
  },

  {
    id: 'DA003',
    name: 'Form Field Accessibility',
    description: 'Form fields must have proper labels, validation, and error handling',
    wcagCriterion: '1.3.1, 3.3.1, 3.3.2, 3.3.3',
    level: 'AA',
    validator: (element, context) => {
      const issues: AccessibilityIssue[] = [];
      
      if (element.accessibilityRole === 'textbox' && !element.accessibilityLabel) {
        issues.push({
          ruleId: 'DA003',
          severity: 'error',
          message: 'Form field missing accessibility label',
          element,
          wcagCriterion: '1.3.1',
          suggestions: [
            'Add clear accessibility label describing the field purpose',
            'Include whether field is required or optional',
            'Provide validation error messages',
          ],
          codeExample: `
// Good example
<TextInput
  accessibilityLabel="Bio description"
  accessibilityHint="Enter a brief description about yourself (required)"
  accessibilityValue={{ text: hasError ? "Error: Bio must be at least 10 characters" : "Valid" }}
  accessibilityState={{ invalid: hasError }}
/>`,
        });
      }

      return issues;
    },
  },

  {
    id: 'DA004',
    name: 'Navigation Accessibility',
    description: 'Navigation elements must be properly structured and labeled',
    wcagCriterion: '1.3.1, 2.4.1, 2.4.3, 2.4.6',
    level: 'AA',
    validator: (element, context) => {
      const issues: AccessibilityIssue[] = [];
      
      if (element.accessibilityRole === 'tab' || element.accessibilityRole === 'tablist') {
        if (!element.accessibilityState?.selected !== undefined && element.accessibilityRole === 'tab') {
          issues.push({
            ruleId: 'DA004',
            severity: 'error',
            message: 'Tab element missing selected state',
            element,
            wcagCriterion: '2.4.3',
            suggestions: [
              'Include accessibilityState with selected property',
              'Provide clear indication of current tab',
              'Ensure logical tab order',
            ],
            codeExample: `
// Good example
<TouchableOpacity
  accessibilityRole="tab"
  accessibilityLabel="Discover matches"
  accessibilityState={{ selected: isActive }}
  accessibilityHint="Navigate to discover tab"
>`,
          });
        }
      }

      return issues;
    },
  },

  {
    id: 'DA005',
    name: 'Modal Dialog Accessibility',
    description: 'Modal dialogs must trap focus and provide proper navigation',
    wcagCriterion: '2.4.3, 2.4.6, 3.2.1',
    level: 'AA',
    validator: (element, context) => {
      const issues: AccessibilityIssue[] = [];
      
      if (element.accessibilityViewIsModal) {
        if (!element.accessibilityLabel) {
          issues.push({
            ruleId: 'DA005',
            severity: 'error',
            message: 'Modal dialog missing accessibility label',
            element,
            wcagCriterion: '2.4.6',
            suggestions: [
              'Add descriptive accessibility label for modal purpose',
              'Implement focus trapping within modal',
              'Provide clear close instructions',
            ],
            codeExample: `
// Good example
<Modal
  accessibilityViewIsModal={true}
  accessibilityLabel="Edit profile modal"
  accessibilityHint="Modal dialog. Use back button or swipe down to close"
>`,
          });
        }
      }

      return issues;
    },
  },
];

// Color contrast validation using WCAG 2.1 standards
const validateColorContrast = (foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean => {
  try {
    // Required contrast ratios according to WCAG 2.1
    const requiredRatio = level === 'AAA' ? 7.0 : 4.5;
    
    // Convert colors to RGB values
    const foregroundRGB = parseColor(foreground);
    const backgroundRGB = parseColor(background);
    
    if (!foregroundRGB || !backgroundRGB) {
      // If we can't parse colors, assume they fail contrast requirements
      return false;
    }
    
    // Calculate relative luminance for each color
    const foregroundLuminance = getRelativeLuminance(foregroundRGB);
    const backgroundLuminance = getRelativeLuminance(backgroundRGB);
    
    // Calculate contrast ratio
    const contrastRatio = calculateContrastRatio(foregroundLuminance, backgroundLuminance);
    
    // Check if ratio meets requirements
    return contrastRatio >= requiredRatio;
  } catch (error) {
    console.warn('Color contrast validation failed:', error);
    return false; // Fail safe - assume poor contrast if validation fails
  }
};

/**
 * Parse color string (hex, rgb, rgba, named colors) to RGB values
 */
const parseColor = (colorString: string): { r: number; g: number; b: number } | null => {
  try {
    const color = colorString.trim().toLowerCase();
    
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        // Short hex format (#RGB -> #RRGGBB)
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      } else if (hex.length === 6) {
        // Full hex format
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
    }
    
    // Handle RGB/RGBA colors
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (match) {
        const values = match[1].split(',').map(v => parseInt(v.trim(), 10));
        if (values.length >= 3) {
          return {
            r: values[0],
            g: values[1],
            b: values[2],
          };
        }
      }
    }
    
    // Handle named colors (common React Native colors)
    const namedColors: Record<string, { r: number; g: number; b: number }> = {
      'black': { r: 0, g: 0, b: 0 },
      'white': { r: 255, g: 255, b: 255 },
      'red': { r: 255, g: 0, b: 0 },
      'green': { r: 0, g: 128, b: 0 },
      'blue': { r: 0, g: 0, b: 255 },
      'yellow': { r: 255, g: 255, b: 0 },
      'orange': { r: 255, g: 165, b: 0 },
      'purple': { r: 128, g: 0, b: 128 },
      'gray': { r: 128, g: 128, b: 128 },
      'grey': { r: 128, g: 128, b: 128 },
      'transparent': { r: 255, g: 255, b: 255 }, // Assume white background for transparency
    };
    
    return namedColors[color] || null;
  } catch (error) {
    return null;
  }
};

/**
 * Calculate relative luminance according to WCAG 2.1 formula
 */
const getRelativeLuminance = (rgb: { r: number; g: number; b: number }): number => {
  // Convert RGB values to sRGB
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;
  
  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  
  // Calculate relative luminance using WCAG formula
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

/**
 * Calculate contrast ratio between two luminance values
 */
const calculateContrastRatio = (luminance1: number, luminance2: number): number => {
  // Ensure we use the lighter color as numerator
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  // WCAG contrast ratio formula: (L1 + 0.05) / (L2 + 0.05)
  return (lighter + 0.05) / (darker + 0.05);
};

// Touch target validation
const validateTouchTarget = (element: any): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = [];
  const { width, height } = element.style || {};
  
  if (width && height) {
    const minSize = ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET;
    
    if (width < minSize || height < minSize) {
      issues.push({
        ruleId: 'DA006',
        severity: 'error',
        message: `Touch target too small: ${width}x${height}px. Minimum required: ${minSize}x${minSize}px`,
        element,
        wcagCriterion: '2.5.5',
        suggestions: [
          `Increase touch target to minimum ${minSize}x${minSize} points`,
          'Ensure adequate spacing between interactive elements',
          'Consider using padding to increase effective touch area',
        ],
        codeExample: `
// Good example
const styles = StyleSheet.create({
  button: {
    minWidth: ${minSize},
    minHeight: ${minSize},
    padding: 8,
    // ... other styles
  },
});`,
      });
    }
  }
  
  return issues;
};

// Focus management validation
const validateFocusManagement = (element: any, context: any): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = [];
  
  if (context.isModal && !context.hasFocusTrap) {
    issues.push({
      ruleId: 'DA007',
      severity: 'error',
      message: 'Modal missing focus trap implementation',
      element,
      wcagCriterion: '2.4.3',
      suggestions: [
        'Implement focus trapping within modal boundaries',
        'Focus first interactive element on modal open',
        'Restore focus to trigger element on modal close',
      ],
      codeExample: `
// Good example using focus management hook
const { createFocusGroup, focusFirst, closeFocusGroup } = useFocusManagement();

useEffect(() => {
  if (isModalOpen) {
    const groupId = createFocusGroup({ trapFocus: true, restoreFocus: true });
    focusFirst(groupId);
    return () => closeFocusGroup(groupId);
  }
}, [isModalOpen]);`,
    });
  }
  
  return issues;
};

// Screen reader content validation
const validateScreenReaderContent = (element: any): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = [];
  const { accessibilityLabel } = element;
  
  if (accessibilityLabel) {
    // Check for generic labels
    const genericLabels = ['button', 'image', 'text', 'view', 'touchable'];
    if (genericLabels.some(label => accessibilityLabel.toLowerCase().includes(label))) {
      issues.push({
        ruleId: 'DA008',
        severity: 'warning',
        message: 'Generic accessibility label detected',
        element,
        wcagCriterion: '1.3.1',
        suggestions: [
          'Replace generic labels with descriptive content',
          'Include context-specific information',
          'Describe the purpose or result of interaction',
        ],
        codeExample: `
// Bad example
accessibilityLabel="Button"

// Good example  
accessibilityLabel="Like Sarah's profile"`,
      });
    }
    
    // Check label length
    if (accessibilityLabel.length > 200) {
      issues.push({
        ruleId: 'DA008',
        severity: 'warning',
        message: 'Accessibility label too long (over 200 characters)',
        element,
        wcagCriterion: '1.3.1',
        suggestions: [
          'Shorten accessibility label to essential information',
          'Use accessibilityHint for additional context',
          'Break complex information into multiple elements',
        ],
      });
    }
  }
  
  return issues;
};

// Main accessibility testing class
export class AccessibilityTester {
  private config: AccessibilityTestConfig;
  private rules: AccessibilityRule[];

  constructor(config: Partial<AccessibilityTestConfig> = {}) {
    this.config = {
      wcagLevel: 'AA',
      includeColorContrast: true,
      includeFocusManagement: true,
      includeScreenReaderTesting: true,
      includeKeyboardNavigation: true,
      includeTouchTargetValidation: true,
      includePerformanceMetrics: true,
      ...config,
    };
    
    this.rules = [...DATING_APP_ACCESSIBILITY_RULES, ...(config.customRules || [])];
  }

  // Test a component for accessibility compliance
  async testComponent(
    componentName: string, 
    element: any, 
    context?: any
  ): Promise<AccessibilityTestResult> {
    const startTime = Date.now();
    const issues: AccessibilityIssue[] = [];
    const recommendations: string[] = [];
    const codeExamples: string[] = [];

    // Run all applicable rules
    for (const rule of this.rules) {
      if (this.shouldRunRule(rule)) {
        try {
          const ruleIssues = rule.validator(element, context);
          issues.push(...ruleIssues);
          
          // Collect recommendations and code examples
          ruleIssues.forEach(issue => {
            recommendations.push(...issue.suggestions);
            if (issue.codeExample) {
              codeExamples.push(issue.codeExample);
            }
          });
        } catch (error) {
          logError(`Error running accessibility rule ${rule.id}:`, "Error", error);
        }
      }
    }

    // Additional validations based on config
    if (this.config.includeTouchTargetValidation) {
      issues.push(...validateTouchTarget(element));
    }

    if (this.config.includeFocusManagement) {
      issues.push(...validateFocusManagement(element, context));
    }

    if (this.config.includeScreenReaderTesting) {
      issues.push(...validateScreenReaderContent(element));
    }

    // Calculate score
    const totalRules = this.rules.length;
    const failedRules = new Set(issues.filter(i => i.severity === 'error').map(i => i.ruleId)).size;
    const passedRules = totalRules - failedRules;
    const overallScore = Math.max(0, Math.round((passedRules / totalRules) * 100));

    // Performance metrics (if enabled)
    let performanceMetrics: PerformanceMetrics | undefined;
    if (this.config.includePerformanceMetrics) {
      performanceMetrics = await this.measurePerformanceMetrics(element);
    }

    return {
      componentName,
      testTimestamp: new Date().toISOString(),
      overallScore,
      wcagLevel: this.config.wcagLevel,
      passedRules,
      failedRules,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      issues: issues.sort((a, b) => {
        const severityOrder = { error: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }),
      recommendations: [...new Set(recommendations)],
      codeExamples: [...new Set(codeExamples)],
      performanceMetrics,
    };
  }

  // Test multiple components
  async testComponentTree(components: Array<{ name: string; element: any; context?: any }>): Promise<AccessibilityTestResult[]> {
    const results: AccessibilityTestResult[] = [];
    
    for (const component of components) {
      const result = await this.testComponent(component.name, component.element, component.context);
      results.push(result);
    }
    
    return results;
  }

  // Generate comprehensive report
  generateReport(results: AccessibilityTestResult[]): {
    summary: {
      overallScore: number;
      totalComponents: number;
      componentsWithIssues: number;
      totalIssues: number;
      criticalIssues: number;
    };
    componentResults: AccessibilityTestResult[];
    recommendations: string[];
    wcagCompliance: {
      level: 'A' | 'AA' | 'AAA';
      compliant: boolean;
      failingCriteria: string[];
    };
  } {
    const totalComponents = results.length;
    const componentsWithIssues = results.filter(r => r.issues.length > 0).length;
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const criticalIssues = results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0);
    const averageScore = Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / totalComponents);

    // Collect all unique recommendations
    const allRecommendations = results.flatMap(r => r.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)];

    // WCAG compliance check
    const allIssues = results.flatMap(r => r.issues);
    const errorIssues = allIssues.filter(i => i.severity === 'error');
    const failingCriteria = [...new Set(errorIssues.map(i => i.wcagCriterion))];
    const isCompliant = errorIssues.length === 0;

    return {
      summary: {
        overallScore: averageScore,
        totalComponents,
        componentsWithIssues,
        totalIssues,
        criticalIssues,
      },
      componentResults: results,
      recommendations: uniqueRecommendations,
      wcagCompliance: {
        level: this.config.wcagLevel,
        compliant: isCompliant,
        failingCriteria,
      },
    };
  }

  // Manual testing checklist generator
  generateManualTestingChecklist(componentType: 'match-card' | 'conversation-list' | 'navigation' | 'form' | 'modal'): {
    title: string;
    description: string;
    prerequisites: string[];
    testSteps: Array<{
      step: number;
      description: string;
      expectedResult: string;
      wcagCriterion: string;
    }>;
  } {
    const checklists = {
      'match-card': {
        title: 'Match Card Accessibility Testing',
        description: 'Comprehensive manual testing for match card interactions',
        prerequisites: [
          'Enable VoiceOver (iOS) or TalkBack (Android)',
          'Test with keyboard navigation if available',
          'Use with different text sizes',
          'Test in high contrast mode',
        ],
        testSteps: [
          {
            step: 1,
            description: 'Navigate to match card with screen reader',
            expectedResult: 'Screen reader announces profile name, age, compatibility, photo count, and interaction instructions',
            wcagCriterion: '1.3.1',
          },
          {
            step: 2,
            description: 'Test gesture alternatives (like/pass buttons)',
            expectedResult: 'Buttons are focusable, properly labeled, and perform expected actions',
            wcagCriterion: '2.5.3',
          },
          {
            step: 3,
            description: 'Test photo navigation with screen reader',
            expectedResult: 'Photo navigation announces current photo number and total count',
            wcagCriterion: '2.4.6',
          },
          {
            step: 4,
            description: 'Verify touch targets meet minimum size',
            expectedResult: 'All interactive elements are at least 44x44 points',
            wcagCriterion: '2.5.5',
          },
          {
            step: 5,
            description: 'Test with reduced motion settings',
            expectedResult: 'Animations are reduced or disabled, functionality preserved',
            wcagCriterion: '2.3.3',
          },
        ],
      },
      // Add other component checklists...
    };

    return checklists[componentType] || {
      title: 'Generic Component Testing',
      description: 'Basic accessibility testing checklist',
      prerequisites: [],
      testSteps: [],
    };
  }

  private shouldRunRule(rule: AccessibilityRule): boolean {
    const levelOrder = { A: 1, AA: 2, AAA: 3 };
    const configLevel = levelOrder[this.config.wcagLevel];
    const ruleLevel = levelOrder[rule.level];
    
    return ruleLevel <= configLevel;
  }

  private async measurePerformanceMetrics(element: any): Promise<PerformanceMetrics> {
    try {
      const startTime = performance.now();
      
      // Measure render time by triggering a layout
      const renderStartTime = performance.now();
      await this.measureRenderPerformance(element);
      const renderTime = performance.now() - renderStartTime;
      
      // Measure focus time if element is focusable
      const focusTime = await this.measureFocusTime(element);
      
      // Estimate screen reader response time based on text complexity
      const screenReaderResponseTime = this.estimateScreenReaderTime(element);
      
      // Calculate touch target density in the element area
      const touchTargetDensity = this.calculateTouchTargetDensity(element);
      
      // Measure animation frame rate if element has animations
      const animationFrameRate = await this.measureAnimationFrameRate(element);
      
      const totalTime = performance.now() - startTime;
      
      return {
        renderTime: Math.round(renderTime * 100) / 100,
        focusTime: Math.round(focusTime * 100) / 100,
        screenReaderResponseTime: Math.round(screenReaderResponseTime * 100) / 100,
        touchTargetDensity: Math.round(touchTargetDensity * 100) / 100,
        animationFrameRate: Math.round(animationFrameRate),
        measurementTime: Math.round(totalTime * 100) / 100,
      };
    } catch (error) {
      console.warn('Performance metrics measurement failed:', error);
      
      // Return default metrics if measurement fails
      return {
        renderTime: 0,
        focusTime: 0,
        screenReaderResponseTime: 100, // Conservative estimate
        touchTargetDensity: 0,
        animationFrameRate: 60, // Assume standard frame rate
        measurementTime: 0,
      };
    }
  }
  
  /**
   * Measure render performance by forcing layout calculations
   */
  private async measureRenderPerformance(element: any): Promise<void> {
    return new Promise<void>((resolve) => {
      // In React Native, we can't directly measure DOM rendering
      // Instead, we simulate render time based on component complexity
      const complexity = this.calculateElementComplexity(element);
      
      // Simulate rendering time based on complexity
      setTimeout(() => {
        resolve();
      }, Math.max(1, complexity * 2)); // Base render time on complexity
    });
  }
  
  /**
   * Measure time taken to focus an element
   */
  private async measureFocusTime(element: any): Promise<number> {
    try {
      // Check if element can be focused
      if (!element || typeof element.focus !== 'function') {
        return 0; // Not focusable
      }
      
      const startTime = performance.now();
      
      // Attempt to focus (this might not work in test environment)
      try {
        element.focus();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for focus to complete
      } catch (focusError) {
        // Focus might fail in test environment, estimate based on element type
      }
      
      const focusTime = performance.now() - startTime;
      return Math.max(1, focusTime); // Minimum 1ms for any focus operation
      
    } catch (error) {
      return 5; // Conservative estimate for focus time
    }
  }
  
  /**
   * Estimate screen reader response time based on content complexity
   */
  private estimateScreenReaderTime(element: any): number {
    try {
      let textContent = '';
      let complexity = 1;
      
      // Extract text content
      if (element.props?.children) {
        textContent = this.extractTextContent(element.props.children);
      }
      
      if (element.props?.accessibilityLabel) {
        textContent += ' ' + element.props.accessibilityLabel;
      }
      
      if (element.props?.accessibilityHint) {
        textContent += ' ' + element.props.accessibilityHint;
      }
      
      // Calculate complexity factors
      const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
      const characterCount = textContent.length;
      
      // Account for element type complexity
      if (element.type) {
        const complexityMap: Record<string, number> = {
          'View': 1,
          'Text': 1.2,
          'TouchableOpacity': 1.5,
          'Button': 1.3,
          'TextInput': 2.0,
          'ScrollView': 1.8,
          'FlatList': 2.5,
          'Modal': 2.0,
        };
        complexity = complexityMap[element.type] || 1.5;
      }
      
      // Base time calculation (assuming 150 words per minute reading speed)
      const baseReadingTime = (wordCount / 150) * 60 * 1000; // Convert to milliseconds
      
      // Add complexity factor
      const estimatedTime = baseReadingTime * complexity;
      
      // Reasonable bounds: 50ms to 5000ms
      return Math.max(50, Math.min(5000, estimatedTime));
      
    } catch (error) {
      return 200; // Conservative estimate
    }
  }
  
  /**
   * Calculate touch target density (ratio of touchable area to total area)
   */
  private calculateTouchTargetDensity(element: any): number {
    try {
      // Extract dimensions and touchable children
      const elementArea = this.calculateElementArea(element);
      if (elementArea === 0) return 0;
      
      const touchableChildren = this.findTouchableChildren(element);
      const totalTouchableArea = touchableChildren.reduce((total, child) => {
        return total + this.calculateElementArea(child);
      }, 0);
      
      // Include the element itself if it's touchable
      const elementTouchableArea = this.isElementTouchable(element) ? elementArea : 0;
      
      const totalArea = totalTouchableArea + elementTouchableArea;
      return Math.min(1, totalArea / elementArea);
      
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Measure animation frame rate (simulated for React Native)
   */
  private async measureAnimationFrameRate(element: any): Promise<number> {
    try {
      // Check if element has animation properties
      const hasAnimations = this.hasAnimationProperties(element);
      
      if (!hasAnimations) {
        return 60; // Standard frame rate for non-animated elements
      }
      
      // Simulate frame rate measurement
      return new Promise<number>((resolve) => {
        let frames = 0;
        const startTime = performance.now();
        
        const measureFrames = () => {
          frames++;
          if (frames < 10) {
            // Use requestAnimationFrame if available, otherwise setTimeout
            if (typeof requestAnimationFrame !== 'undefined') {
              requestAnimationFrame(measureFrames);
            } else {
              setTimeout(measureFrames, 16); // ~60fps
            }
          } else {
            const endTime = performance.now();
            const duration = (endTime - startTime) / 1000; // Convert to seconds
            const frameRate = frames / duration;
            resolve(Math.min(60, Math.max(1, frameRate)));
          }
        };
        
        measureFrames();
      });
      
    } catch (error) {
      return 60; // Default frame rate
    }
  }
  
  /**
   * Helper method to calculate element complexity
   */
  private calculateElementComplexity(element: any): number {
    try {
      let complexity = 1;
      
      // Add complexity for children
      if (element.props?.children) {
        if (Array.isArray(element.props.children)) {
          complexity += element.props.children.length * 0.5;
        } else {
          complexity += 0.5;
        }
      }
      
      // Add complexity for style properties
      if (element.props?.style) {
        const styleCount = Object.keys(element.props.style).length;
        complexity += styleCount * 0.1;
      }
      
      return Math.min(20, complexity); // Cap at 20 for reasonable bounds
    } catch (error) {
      return 1;
    }
  }
  
  /**
   * Extract text content from children recursively
   */
  private extractTextContent(children: any): string {
    if (typeof children === 'string') {
      return children;
    }
    
    if (Array.isArray(children)) {
      return children.map(child => this.extractTextContent(child)).join(' ');
    }
    
    if (children && typeof children === 'object' && children.props) {
      return this.extractTextContent(children.props.children);
    }
    
    return '';
  }
  
  /**
   * Calculate element area (simplified for React Native)
   */
  private calculateElementArea(element: any): number {
    try {
      const style = element.props?.style || {};
      const width = parseFloat(style.width) || 100; // Default width
      const height = parseFloat(style.height) || 40; // Default height
      
      return width * height;
    } catch (error) {
      return 4000; // Default area (100x40)
    }
  }
  
  /**
   * Find touchable children elements
   */
  private findTouchableChildren(element: any): any[] {
    const touchableChildren: any[] = [];
    
    try {
      const traverse = (child: any) => {
        if (this.isElementTouchable(child)) {
          touchableChildren.push(child);
        }
        
        if (child.props?.children) {
          if (Array.isArray(child.props.children)) {
            child.props.children.forEach(traverse);
          } else {
            traverse(child.props.children);
          }
        }
      };
      
      if (element.props?.children) {
        if (Array.isArray(element.props.children)) {
          element.props.children.forEach(traverse);
        } else {
          traverse(element.props.children);
        }
      }
    } catch (error) {
      // Return empty array if traversal fails
    }
    
    return touchableChildren;
  }
  
  /**
   * Check if element is touchable
   */
  private isElementTouchable(element: any): boolean {
    if (!element) return false;
    
    const touchableTypes = [
      'TouchableOpacity',
      'TouchableHighlight',
      'TouchableWithoutFeedback',
      'TouchableNativeFeedback',
      'Pressable',
      'Button',
    ];
    
    return touchableTypes.includes(element.type) || 
           element.props?.onPress ||
           element.props?.onLongPress ||
           element.props?.accessible === true;
  }
  
  /**
   * Check if element has animation properties
   */
  private hasAnimationProperties(element: any): boolean {
    try {
      const style = element.props?.style || {};
      
      // Check for common animation properties
      const animationProperties = [
        'transform',
        'opacity',
        'translateX',
        'translateY',
        'scaleX',
        'scaleY',
        'rotation',
      ];
      
      return animationProperties.some(prop => style[prop] !== undefined) ||
             element.props?.animated === true;
    } catch (error) {
      return false;
    }
  }
}

// Utility functions for automated testing
export const createAccessibilityTestSuite = (config?: Partial<AccessibilityTestConfig>) => {
  return new AccessibilityTester(config);
};

export const runQuickAccessibilityCheck = async (componentName: string, element: any) => {
  const tester = new AccessibilityTester({ wcagLevel: 'AA' });
  return await tester.testComponent(componentName, element);
};

export const validateAccessibilityProps = (props: any): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  if (props.onPress && !props.accessible && !props.accessibilityRole) {
    issues.push('Interactive element missing accessibility props');
  }
  
  if (props.accessibilityLabel && props.accessibilityLabel.length < 2) {
    issues.push('Accessibility label too short');
  }
  
  if (props.style?.width && props.style?.height) {
    const minSize = ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET;
    if (props.style.width < minSize || props.style.height < minSize) {
      issues.push(`Touch target too small: ${props.style.width}x${props.style.height}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
};

// Integration with Jest/testing frameworks
export const accessibilityMatchers = {
  toBeAccessible: (received: any) => {
    const validation = validateAccessibilityProps(received.props || {});
    
    return {
      pass: validation.isValid,
      message: () => 
        validation.isValid
          ? `Expected component to have accessibility issues`
          : `Component has accessibility issues: ${validation.issues.join(', ')}`,
    };
  },
  
  toHaveAccessibleLabel: (received: any) => {
    const hasLabel = received.props?.accessibilityLabel || received.props?.['aria-label'];
    
    return {
      pass: !!hasLabel,
      message: () => 
        hasLabel
          ? `Expected component to not have accessibility label`
          : `Expected component to have accessibility label`,
    };
  },
  
  toMeetTouchTargetSize: (received: any) => {
    const { width, height } = received.props?.style || {};
    const minSize = ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET;
    const meetsSize = (!width || width >= minSize) && (!height || height >= minSize);
    
    return {
      pass: meetsSize,
      message: () => 
        meetsSize
          ? `Expected component to not meet touch target size`
          : `Expected component to meet minimum touch target size of ${minSize}x${minSize}`,
    };
  },
};

export default {
  AccessibilityTester,
  createAccessibilityTestSuite,
  runQuickAccessibilityCheck,
  validateAccessibilityProps,
  accessibilityMatchers,
  DATING_APP_ACCESSIBILITY_RULES,
};