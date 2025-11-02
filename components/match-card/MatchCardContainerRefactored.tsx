import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useDatingAppTracking } from '../../src/hooks/usePerformanceMonitoring';
import { useCardFlipAnimation } from '../../src/hooks/useCardFlipAnimation';
import { useCardGesturesRefactored } from '../../src/hooks/useCardGesturesRefactored';
import { announceToScreenReader } from '../../src/utils/accessibility';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";
import { 
  useMatchCardProfile, 
  useMatchCardCompatibility,
  useMatchCardNavigation,
  useMatchCardAnimation,
  useMatchCardActions,
  useMatchCardContext
} from '../../src/contexts/MatchCardContext';

interface MatchCardContainerRefactoredProps {
  children: React.ReactNode;
  style?: any;
}

/**
 * MatchCardContainerRefactored - Context-based container eliminating prop drilling
 * Following the 10 Golden Code Principles:
 * 
 * 1. Single Responsibility: Container logic only, no business logic
 * 2. Meaningful Names: Clear method and variable names
 * 3. Small, Focused Functions: Decomposed into specific operations
 * 4. Separation of Concerns: Context handles state, container handles UI
 * 5. Dependency Injection: All data comes from context, not props
 * 6. Fail Fast & Defensive: Context validation and error handling
 * 7. DRY Principle: Eliminates prop drilling repetition
 * 8. Command Query Separation: Clear actions vs state queries
 * 9. Least Surprise: Predictable context-based data flow
 * 10. Security by Design: Context validation and safe operations
 */
export const MatchCardContainerRefactored: React.FC<MatchCardContainerRefactoredProps> = ({
  children,
  style,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { trackMatchingAction } = useDatingAppTracking();

  // Context-based data access (eliminating prop drilling)
  const { profile, displayName } = useMatchCardProfile();
  const { compatibilityScore, astrologicalGrade, questionnaireGrade } = useMatchCardCompatibility();
  const { 
    currentMatchIndex, 
    totalMatches, 
    hasNext, 
    hasPrevious,
    canNavigateNext,
    canNavigatePrevious,
    onNext,
    onPrevious 
  } = useMatchCardNavigation();
  const { isAnimating, setAnimationState, onFlip } = useMatchCardAnimation();
  const { onAccept, onPass, recordInteraction } = useMatchCardActions();
  const { dateActivity, zodiacSign } = useMatchCardContext();

  // Dynamic sizing calculations following Defensive Programming
  const cardDimensions = useMemo(() => {
    const cardWidth = Math.min(screenWidth * 0.9, 400);
    const maxCardHeight = screenHeight * 0.8;
    const minCardHeight = 500;
    const dynamicCardHeight = Math.max(
      Math.min(maxCardHeight, 650),
      minCardHeight
    );
    const imageHeight = Math.min(280, dynamicCardHeight * 0.4);

    return { cardWidth, dynamicCardHeight, maxCardHeight, imageHeight };
  }, [screenWidth, screenHeight]);

  // Enhanced error tracking following Fail Fast principle
  const handleTrackingError = useCallback((error: Error, action: string) => {
    logWarn(`MatchCardContainer tracking error for ${action}:`, "Warning", error);
  }, []);

  // Safe tracking wrapper following DRY principle
  const safeTrackMatchingAction = useCallback((action: string, profileId: string, metadata: any) => {
    try {
      const isMatchingAction = action === 'approve' || action === 'reject' || action === 'view_profile' || action === 'view_compatibility';
      if (isMatchingAction) {
        trackMatchingAction(action as 'approve' | 'reject' | 'view_profile' | 'view_compatibility', profileId, metadata);
      }
    } catch (error) {
      handleTrackingError(error as Error, action);
    }
  }, [trackMatchingAction, handleTrackingError]);

  // Card flip animation with context integration
  const {
    isShowingBack,
    flip,
    frontAnimatedStyle,
    backAnimatedStyle,
  } = useCardFlipAnimation({
    duration: 800,
    onFlipStart: (isFlippingToBack) => {
      setAnimationState({ isAnimating: true });
      safeTrackMatchingAction(
        isFlippingToBack ? 'flip_to_back' : 'flip_to_front', 
        profile.id, 
        {
          source: 'match_card',
          current_side: isFlippingToBack ? 'front' : 'back'
        }
      );
      recordInteraction('flip');
    },
    onFlipComplete: (isFlippedToBack) => {
      setAnimationState({ 
        isAnimating: false,
        isFlipped: isFlippedToBack 
      });
      announceToScreenReader(
        `Card ${isFlippedToBack ? 'flipped to back' : 'flipped to front'} showing ${isFlippedToBack ? 'compatibility' : 'profile'} details`,
        'assertive'
      );
    },
  });

  // Enhanced gesture system with context integration
  const {
    panGesture,
    cardAnimatedStyle,
    cleanup: gestureCleanup,
  } = useCardGesturesRefactored({
    onSwipeLeft: () => {
      if (canNavigateNext) {
        announceToScreenReader('Swiped to next match', 'polite');
        recordInteraction('swipe');
        onNext?.();
      }
    },
    onSwipeRight: () => {
      if (canNavigatePrevious) {
        announceToScreenReader('Swiped to previous match', 'polite');
        recordInteraction('swipe');
        onPrevious?.();
      }
    },
    onFlip: () => {
      flip();
      onFlip?.();
    },
    isAnimating,
    enableSwipeNavigation: true,
  });

  // Action handlers with context integration
  const enhancedActions = useMemo(() => ({
    handleAccept: () => {
      safeTrackMatchingAction('approve', profile.id, {
        source: isShowingBack ? 'discover_back' : 'discover',
        date_activity: dateActivity,
        zodiac_sign: zodiacSign,
        astrological_grade: astrologicalGrade,
        questionnaire_grade: questionnaireGrade,
        compatibility_score: compatibilityScore,
        match_index: currentMatchIndex,
        total_matches: totalMatches
      });
      announceToScreenReader(
        `Accepted match with ${displayName}`,
        'assertive'
      );
      recordInteraction('tap');
      onAccept();
    },
    handleDecline: () => {
      safeTrackMatchingAction('reject', profile.id, {
        source: isShowingBack ? 'discover_back' : 'discover',
        date_activity: dateActivity,
        zodiac_sign: zodiacSign,
        astrological_grade: astrologicalGrade,
        questionnaire_grade: questionnaireGrade,
        compatibility_score: compatibilityScore,
        match_index: currentMatchIndex,
        total_matches: totalMatches
      });
      announceToScreenReader(
        `Declined match with ${displayName}`,
        'assertive'
      );
      recordInteraction('tap');
      onPass();
    },
    handleFlip: () => {
      flip();
      onFlip?.();
    },
    handleNext: onNext,
    handlePrevious: onPrevious,
  }), [
    profile, isShowingBack, dateActivity, zodiacSign, astrologicalGrade,
    questionnaireGrade, compatibilityScore, currentMatchIndex, totalMatches,
    displayName, onAccept, onPass, onNext, onPrevious, onFlip, flip,
    safeTrackMatchingAction, recordInteraction
  ]);

  // Animation state for children
  const animationState = useMemo(() => ({
    isFlipped: isShowingBack,
    isAnimating,
    frontAnimatedStyle,
    backAnimatedStyle,
  }), [isShowingBack, isAnimating, frontAnimatedStyle, backAnimatedStyle]);

  // Navigation state for children
  const navigationState = useMemo(() => ({
    hasNext,
    hasPrevious,
    currentMatchIndex,
    totalMatches,
  }), [hasNext, hasPrevious, currentMatchIndex, totalMatches]);

  // Cleanup on unmount
  React.useEffect(() => {
    return gestureCleanup;
  }, [gestureCleanup]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[
        { 
          width: cardDimensions.cardWidth, 
          height: cardDimensions.dynamicCardHeight,
          maxHeight: cardDimensions.maxCardHeight,
          borderRadius: 16,
          backgroundColor: '#f5f5f5',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
          overflow: 'hidden',
          alignSelf: 'center',
          display: 'flex',
          flexDirection: 'column',
        }, 
        style,
        cardAnimatedStyle
      ]}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              // Pass enhanced actions instead of raw props
              actions: enhancedActions,
              animationState,
              navigationState,
              dimensions: cardDimensions,
            } as any);
          }
          return child;
        })}
      </Animated.View>
    </GestureDetector>
  );
};
