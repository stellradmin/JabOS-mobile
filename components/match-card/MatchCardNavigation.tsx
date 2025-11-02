import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { 
  createAccessibleButtonProps,
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  createStateDescription,
} from '../../src/utils/accessibility';

import { useMatchCardNavigation } from '../../src/contexts/MatchCardContext';

interface MatchCardNavigationProps {
  onAnnounceNavigation?: (message: string) => void;
  // Optional props for non-context usage; ignored when context is available
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

/**
 * MatchCardNavigation - Navigation controls component following Single Responsibility Principle
 * 
 * Responsibilities:
 * 1. Rendering navigation buttons
 * 2. Handling navigation interactions
 * 3. Accessibility announcements for navigation
 * 4. Visual state management for disabled buttons
 * 
 * Does NOT handle:
 * - Business logic for navigation
 * - Animation state
 * - Data fetching
 */
export const MatchCardNavigation: React.FC<MatchCardNavigationProps> = ({
  onAnnounceNavigation,
}) => {
  // Get navigation data from context - eliminates prop drilling
  const { 
    hasNext, 
    hasPrevious, 
    canNavigateNext, 
    canNavigatePrevious,
    onNext, 
    onPrevious 
  } = useMatchCardNavigation();

  // Command: Handle previous navigation with accessibility
  const handlePrevious = React.useCallback(() => {
    if (!canNavigatePrevious || !onPrevious) return;
    
    onPrevious();
    onAnnounceNavigation?.('Moved to previous match');
  }, [canNavigatePrevious, onPrevious, onAnnounceNavigation]);

  // Command: Handle next navigation with accessibility
  const handleNext = React.useCallback(() => {
    if (!canNavigateNext || !onNext) return;
    
    onNext();
    onAnnounceNavigation?.('Moved to next match');
  }, [canNavigateNext, onNext, onAnnounceNavigation]);

  return (
    <View 
      style={styles.navigationHeader}
      accessibilityLabel="Match navigation controls"
    >
      <TouchableOpacity
        onPress={handlePrevious}
        disabled={!hasPrevious}
        style={[
          styles.circularNavButton,
          !hasPrevious && styles.circularNavButtonDisabled
        ]}
        {...createAccessibleButtonProps(
          'Previous match',
          hasPrevious ? 'Go to previous potential match' : 'No previous matches available',
          ACCESSIBILITY_ROLES.NAVIGATION_BUTTON,
          createStateDescription(false, !hasPrevious)
        )}
      >
        <ChevronLeft 
          size={20} 
          color={!hasPrevious ? "#999" : "#000"} 
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleNext}
        disabled={!hasNext}
        style={[
          styles.circularNavButton,
          !hasNext && styles.circularNavButtonDisabled
        ]}
        {...createAccessibleButtonProps(
          'Next match',
          hasNext ? 'Go to next potential match' : 'No more matches available',
          ACCESSIBILITY_ROLES.NAVIGATION_BUTTON,
          createStateDescription(false, !hasNext)
        )}
      >
        <ChevronRight 
          size={20} 
          color={!hasNext ? "#999" : "#000"} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  circularNavButton: {
    width: Math.max(32, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    height: Math.max(32, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    borderRadius: Math.max(16, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET / 2),
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  circularNavButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
});
