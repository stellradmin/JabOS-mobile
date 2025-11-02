import { useCallback, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  runOnJS, 
  interpolate, 
  Extrapolate 
} from 'react-native-reanimated';
import { useGestureHandlers } from './useGestureHandlers';
import { useAnimatedValues } from './useAnimatedValues';

const { height: screenHeight } = Dimensions.get('window');
const DISMISS_THRESHOLD = screenHeight * 0.3;
const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;

interface UseMatchPopupGesturesProps {
  onDismiss: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onLike: () => void;
  onPass: () => void;
  enabled: boolean;
}

interface UseMatchPopupGesturesReturn {
  panGesture: any;
  cardGesture: any;
}

/**
 * Custom hook for handling gestures in the match popup tray
 * 
 * Features:
 * - Pan gesture for tray dismissal (vertical swipe down)
 * - Card gesture for match navigation and actions (horizontal swipe)
 * - Smooth animations with spring physics
 * - Velocity-based gesture recognition
 * - Memory-safe gesture management
 */
export const useMatchPopupGestures = ({
  onDismiss,
  onSwipeLeft,
  onSwipeRight,
  onLike,
  onPass,
  enabled
}: UseMatchPopupGesturesProps): UseMatchPopupGesturesReturn => {
  const { cleanupAllGestures } = useGestureHandlers();
  const { registerAnimatedValue, cleanupAnimatedValue } = useAnimatedValues();

  // Animation values for tray position
  const translateY = useSharedValue(0);
  const cardTranslateX = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const cardScale = useSharedValue(1);

  // Register animated values for memory management
  useEffect(() => {
    const trayTranslateId = registerAnimatedValue('tray-translate-y', translateY);
    const cardTranslateId = registerAnimatedValue('card-translate-x', cardTranslateX);
    const cardRotationId = registerAnimatedValue('card-rotation', cardRotation);
    const cardScaleId = registerAnimatedValue('card-scale', cardScale);

    return () => {
      cleanupAnimatedValue(trayTranslateId);
      cleanupAnimatedValue(cardTranslateId);
      cleanupAnimatedValue(cardRotationId);
      cleanupAnimatedValue(cardScaleId);
    };
  }, [registerAnimatedValue, cleanupAnimatedValue, translateY, cardTranslateX, cardRotation, cardScale]);

  // Helper functions to run on JS thread
  const runDismiss = useCallback(() => {
    if (enabled) onDismiss();
  }, [enabled, onDismiss]);

  const runSwipeLeft = useCallback(() => {
    if (enabled) onSwipeLeft();
  }, [enabled, onSwipeLeft]);

  const runSwipeRight = useCallback(() => {
    if (enabled) onSwipeRight();
  }, [enabled, onSwipeRight]);

  const runLike = useCallback(() => {
    if (enabled) onLike();
  }, [enabled, onLike]);

  const runPass = useCallback(() => {
    if (enabled) onPass();
  }, [enabled, onPass]);

  // Pan gesture for tray dismissal (vertical swipes)
  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onStart(() => {
      'worklet';
      // Reset any previous transformations
      translateY.value = 0;
    })
    .onUpdate((event) => {
      'worklet';
      // Only allow downward swipes for dismissal
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      'worklet';
      const shouldDismiss = 
        event.translationY > DISMISS_THRESHOLD || 
        (event.translationY > 50 && event.velocityY > VELOCITY_THRESHOLD);

      if (shouldDismiss) {
        // Animate out and dismiss
        translateY.value = withSpring(screenHeight, {
          damping: 20,
          stiffness: 300,
        }, () => {
          runOnJS(runDismiss)();
        });
      } else {
        // Spring back to original position
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 200,
        });
      }
    });

  // Card gesture for swiping matches (horizontal swipes)
  const cardGesture = Gesture.Pan()
    .enabled(enabled)
    .onStart(() => {
      'worklet';
      cardScale.value = withSpring(0.95, { damping: 15 });
    })
    .onUpdate((event) => {
      'worklet';
      cardTranslateX.value = event.translationX;
      
      // Add rotation based on horizontal movement
      cardRotation.value = interpolate(
        event.translationX,
        [-200, 0, 200],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
    })
    .onEnd((event) => {
      'worklet';
      const absTranslationX = Math.abs(event.translationX);
      const absVelocityX = Math.abs(event.velocityX);
      
      // Reset scale
      cardScale.value = withSpring(1, { damping: 15 });

      // Determine if it's a significant swipe
      const isSignificantSwipe = 
        absTranslationX > SWIPE_THRESHOLD || 
        absVelocityX > VELOCITY_THRESHOLD;

      if (isSignificantSwipe) {
        const swipeDirection = event.translationX > 0 ? 'right' : 'left';
        
        // Animate card off screen
        const targetX = swipeDirection === 'right' ? 400 : -400;
        cardTranslateX.value = withSpring(targetX, {
          damping: 20,
          stiffness: 300,
        });
        
        cardRotation.value = withSpring(
          swipeDirection === 'right' ? 30 : -30,
          { damping: 15 }
        );

        // Trigger appropriate action based on swipe direction and velocity
        if (swipeDirection === 'right') {
          // Right swipe could be like or navigation
          if (absVelocityX > 1000) {
            runOnJS(runLike)();
          } else {
            runOnJS(runSwipeRight)();
          }
        } else {
          // Left swipe could be pass or navigation
          if (absVelocityX > 1000) {
            runOnJS(runPass)();
          } else {
            runOnJS(runSwipeLeft)();
          }
        }

        // Reset position after action
        setTimeout(() => {
          cardTranslateX.value = withSpring(0);
          cardRotation.value = withSpring(0);
        }, 300);
      } else {
        // Spring back to center
        cardTranslateX.value = withSpring(0, {
          damping: 15,
          stiffness: 200,
        });
        cardRotation.value = withSpring(0, {
          damping: 15,
          stiffness: 200,
        });
      }
    });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllGestures();
    };
  }, [cleanupAllGestures]);

  return {
    panGesture,
    cardGesture,
  };
};

// Animated style hook for the tray container
export const useMatchPopupTrayStyle = () => {
  const translateY = useSharedValue(0);

  const trayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return {
    trayAnimatedStyle,
    translateY,
  };
};

// Animated style hook for the match card
export const useMatchCardGestureStyle = () => {
  const cardTranslateX = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardTranslateX.value },
      { rotate: `${cardRotation.value}deg` },
      { scale: cardScale.value },
    ],
  }));

  return {
    cardAnimatedStyle,
    cardTranslateX,
    cardRotation,
    cardScale,
  };
};