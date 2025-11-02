import React, { useEffect } from 'react';
import { withMatchCardErrorBoundary } from '../../src/components/MatchingErrorBoundaries';
import { useAccessibilityTimers } from '../../src/hooks/useTimers';
import { 
  createNavigationAnnouncement,
  announceToScreenReader,
} from '../../src/utils/accessibility';

import { 
  MatchCardContainer, 
  MatchCardProps, 
  MatchProfile 
} from './MatchCardContainer';
import { MatchCardNavigation } from './MatchCardNavigation';
import { MatchCardHeader } from './MatchCardHeader';
import { MatchCardContent } from './MatchCardContent';

/**
 * RefactoredMatchCard - Main component following the 10 Golden Code Principles
 * 
 * 1. Single Responsibility: Orchestrates card components, handles accessibility
 * 2. Meaningful Names: Clear, descriptive component and prop names
 * 3. Small, Focused Functions: Decomposed into specialized child components
 * 4. Separation of Concerns: UI/Business Logic/Data Access clearly separated
 * 5. Dependency Injection: Components injected as children, hooks injected
 * 6. Fail Fast & Defensive: Early validation, error boundaries
 * 7. DRY Principle: Reusable components, shared accessibility logic
 * 8. Command Query Separation: Clear action handlers vs state queries
 * 9. Least Surprise: Predictable component behavior and props
 * 10. Security by Design: Safe prop handling, accessibility compliance
 */
const RefactoredMatchCardBase: React.FC<MatchCardProps> = (props) => {
  const {
    profile,
    currentMatchIndex = 0,
    totalMatches = 1,
    zodiacSign,
    dateActivity,
  } = props;

  const { announceAfterDelay } = useAccessibilityTimers();

  // Announce navigation changes for screen readers following accessibility guidelines
  useEffect(() => {
    const navigationAnnouncement = createNavigationAnnouncement(
      currentMatchIndex,
      totalMatches,
      'potential match'
    );
    
    announceAfterDelay(() => {
      announceToScreenReader(
        `${navigationAnnouncement}. ${profile.display_name || 'Anonymous user'} profile loaded.`,
        'polite'
      );
    }, 500);
  }, [currentMatchIndex, totalMatches, profile.display_name, announceAfterDelay]);

  // Handle navigation announcements
  const handleNavigationAnnouncement = React.useCallback((message: string) => {
    announceToScreenReader(message, 'polite');
  }, []);

  return (
    <MatchCardContainer {...props}>
      {/* Navigation Component - Single Responsibility: Handle card navigation */}
      <MatchCardNavigation onAnnounceNavigation={handleNavigationAnnouncement} />

      {/* Header Component - Single Responsibility: Display match context */}
      <MatchCardHeader />

      {/* Content Component - Single Responsibility: Display profile content */}
      <MatchCardContent
        profile={profile}
        compatibilityScore={props.compatibilityScore}
        astrologicalGrade={props.astrologicalGrade}
        questionnaireGrade={props.questionnaireGrade}
        dateActivity={dateActivity}
        announceToScreenReader={announceToScreenReader}
      />
    </MatchCardContainer>
  );
};

// Export with error boundary following Defensive Programming
export const RefactoredMatchCard = withMatchCardErrorBoundary(RefactoredMatchCardBase);

// Export types for other components
export type { MatchProfile, MatchCardProps } from './MatchCardContainer';
