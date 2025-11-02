import React, { useRef, useCallback, useEffect } from 'react';
import { useWindowDimensions, TouchableOpacity } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useDatingAppTracking } from '../../src/hooks/usePerformanceMonitoring';
import { useCardFlipAnimation } from '../../src/hooks/useCardFlipAnimation';
import { useCardGesturesRefactored } from '../../src/hooks/useCardGesturesRefactored';
import { announceToScreenReader } from '../../src/utils/accessibility';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";


// Core interfaces following Single Responsibility Principle
export interface MatchProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  age?: number;
  interests?: string[];
  traits?: string[];
}

export interface MatchCardActions {
  onAccept: () => void;
  onPass: () => void;
  onViewCompatibility: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export interface MatchCardNavigationProps {
  hasNext?: boolean;
  hasPrevious?: boolean;
  currentMatchIndex?: number;
  totalMatches?: number;
}

export interface MatchCardDataProps {
  profile: MatchProfile;
  compatibilityScore?: number;
  astrologicalGrade?: string;
  questionnaireGrade?: string;
  dateActivity?: string;
  zodiacSign?: string;
}

export interface MatchCardProps extends MatchCardActions, MatchCardNavigationProps, MatchCardDataProps {
  style?: any;
}

interface MatchCardContainerProps extends MatchCardProps {
  children?: React.ReactNode;
}

/**
 * MatchCardContainer - Core container component following Single Responsibility Principle
 * 
 * Responsibilities:
 * 1. Gesture handling and animations
 * 2. Dynamic sizing based on screen dimensions
 * 3. Performance tracking
 * 4. Accessibility announcements
 * 
 * Does NOT handle:
 * - UI rendering (delegated to children)
 * - Business logic (handled by parent)
 * - Data fetching (handled by hooks)
 */
export const MatchCardContainer: React.FC<MatchCardContainerProps> = ({
  profile,
  compatibilityScore,
  astrologicalGrade,
  questionnaireGrade,
  onAccept,
  onPass,
  onViewCompatibility,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  style,
  dateActivity,
  zodiacSign,
  currentMatchIndex = 0,
  totalMatches = 1,
  children,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { trackMatchingAction } = useDatingAppTracking();

  // Dynamic sizing calculations following Defensive Programming
  const cardDimensions = React.useMemo(() => {
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

  // Card flip animation with extracted logic
  const {
    isShowingBack,
    isAnimating,
    flip,
    frontAnimatedStyle,
    backAnimatedStyle,
  } = useCardFlipAnimation({
    duration: 800,
    onFlipStart: (isFlippingToBack) => {
      safeTrackMatchingAction(
        isFlippingToBack ? 'flip_to_back' : 'flip_to_front', 
        profile.id, 
        {
          source: 'match_card',
          current_side: isFlippingToBack ? 'front' : 'back'
        }
      );
    },
    onFlipComplete: (isFlippedToBack) => {
      announceToScreenReader(
        `Card ${isFlippedToBack ? 'flipped to back' : 'flipped to front'} showing ${isFlippedToBack ? 'compatibility' : 'profile'} details`,
        'assertive'
      );
    },
  });

  // Enhanced gesture system following Single Responsibility
  const {
    panGesture,
    cardAnimatedStyle,
  } = useCardGesturesRefactored({
    onSwipeLeft: () => {
      if (hasNext) {
        announceToScreenReader('Swiped to next match', 'polite');
        onNext?.();
      }
    },
    onSwipeRight: () => {
      if (hasPrevious) {
        announceToScreenReader('Swiped to previous match', 'polite');
        onPrevious?.();
      }
    },
    onFlip: flip,
    isAnimating,
    enableSwipeNavigation: true,
  });

  // Action handlers following Command Query Separation
  const enhancedActions = React.useMemo(() => ({
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
        `Accepted match with ${profile.display_name || 'this person'}`,
        'assertive'
      );
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
        `Declined match with ${profile.display_name || 'this person'}`,
        'assertive'
      );
      onPass();
    },
    handleFlip: flip,
    handleNext: onNext,
    handlePrevious: onPrevious,
    handleViewCompatibility: onViewCompatibility,
  }), [
    profile, isShowingBack, dateActivity, zodiacSign, astrologicalGrade,
    questionnaireGrade, compatibilityScore, currentMatchIndex, totalMatches,
    onAccept, onPass, onNext, onPrevious, onViewCompatibility, flip,
    safeTrackMatchingAction
  ]);

  // Animation state for children
  const animationState = React.useMemo(() => ({
    isFlipped: isShowingBack,
    isAnimating,
    frontAnimatedStyle,
    backAnimatedStyle,
  }), [isShowingBack, isAnimating, frontAnimatedStyle, backAnimatedStyle]);

  // Navigation state for children
  const navigationState = React.useMemo(() => ({
    hasNext,
    hasPrevious,
    currentMatchIndex,
    totalMatches,
  }), [hasNext, hasPrevious, currentMatchIndex, totalMatches]);

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
              // Pass down all necessary props to children
              profile,
              compatibilityScore,
              astrologicalGrade,
              questionnaireGrade,
              dateActivity,
              zodiacSign,
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
