import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { MatchProfile } from './MatchCardContainer';
import { CardFrontContent } from '../card/CardFrontContent';
import { CardBackContent } from '../card/CardBackContent';

interface MatchCardContentProps {
  profile: MatchProfile;
  compatibilityScore?: number;
  astrologicalGrade?: string;
  questionnaireGrade?: string;
  dateActivity?: string;
  actions?: {
    handleAccept: () => void;
    handleDecline: () => void;
    handleFlip: () => void;
    handleViewCompatibility: () => void;
  };
  animationState?: {
    isFlipped: boolean;
    isAnimating: boolean;
    frontAnimatedStyle: any;
    backAnimatedStyle: any;
  };
  dimensions?: {
    imageHeight: number;
  };
  announceToScreenReader?: (message: string, priority?: 'polite' | 'assertive') => void;
}

/**
 * MatchCardContent - Main content area component following Single Responsibility Principle
 * 
 * Responsibilities:
 * 1. Render flip-animated content sections
 * 2. Conditionally show front/back content for performance
 * 3. Pass appropriate props to content components
 * 4. Handle content accessibility
 * 
 * Does NOT handle:
 * - Animation logic (handled by container)
 * - Gesture handling (handled by container)
 * - Business logic (handled by actions)
 */
export const MatchCardContent: React.FC<MatchCardContentProps> = ({
  profile,
  compatibilityScore,
  astrologicalGrade,
  questionnaireGrade,
  dateActivity,
  actions,
  animationState,
  dimensions,
  announceToScreenReader,
}) => {
  
  // Defensive programming - provide defaults
  const {
    isFlipped = false,
    isAnimating = false,
    frontAnimatedStyle = {},
    backAnimatedStyle = {},
  } = animationState || {};

  const {
    handleAccept = () => {},
    handleDecline = () => {},
    handleFlip = () => {},
    handleViewCompatibility = () => {},
  } = actions || {};

  const { imageHeight = 280 } = dimensions || {};

  // Refs for accessibility focus management
  const acceptButtonRef = React.useRef(null);
  const declineButtonRef = React.useRef(null);
  const compatibilityButtonRef = React.useRef(null);

  return (
    <View 
      style={styles.contentSection}
      accessibilityLabel="Match profile content"
    >
      {/* Front Side - Conditional rendering for performance optimization */}
      {(!isFlipped || isAnimating) && (
        <Animated.View style={[styles.cardSide, frontAnimatedStyle]}>
          <CardFrontContent
            profile={profile}
            imageHeight={imageHeight}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onFlip={handleFlip}
            compatibilityScore={compatibilityScore}
            dateActivity={dateActivity}
            isFlipped={isFlipped}
            declineButtonRef={declineButtonRef}
            acceptButtonRef={acceptButtonRef}
            compatibilityButtonRef={compatibilityButtonRef}
            styles={styles}
            announceToScreenReader={announceToScreenReader || (() => {})}
          />
        </Animated.View>
      )}

      {/* Back Side - Conditional rendering for performance optimization */}
      {(isFlipped || isAnimating) && (
        <Animated.View style={[styles.cardSide, backAnimatedStyle]}>
          <CardBackContent
            profile={profile}
            compatibilityScore={compatibilityScore}
            astrologicalGrade={astrologicalGrade}
            questionnaireGrade={questionnaireGrade}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onFlip={handleFlip}
            dateActivity={dateActivity}
            styles={styles}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contentSection: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },
  cardSide: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  // Family tags container
  familyTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
  familyTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#ffeeb2',
    borderWidth: 1.5,
    borderColor: 'black',
  },
  familyTagText: {
    fontSize: 13,
    fontFamily: 'Geist-Medium',
    color: 'black',
  },
});
