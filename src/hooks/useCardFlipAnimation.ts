import { useCallback, useEffect, useState } from 'react';
// @ts-nocheck
import { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  runOnJS, 
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';
import { useAnimatedValues } from './useAnimatedValues';

interface UseCardFlipAnimationProps {
  duration?: number;
  initialState?: 'front' | 'back';
  onFlipStart?: (isFlippingToBack: boolean) => void;
  onFlipComplete?: (isShowingBack: boolean) => void;
  springConfig?: {
    damping?: number;
    stiffness?: number;
  };
}

interface UseCardFlipAnimationReturn {
  flip: () => void;
  flipToFront: () => void;
  flipToBack: () => void;
  frontAnimatedStyle: any;
  backAnimatedStyle: any;
  isAnimating: boolean;
  isShowingBack: boolean;
}

/**
 * Custom hook for card flip animations with 3D perspective
 * 
 * Features:
 * - Smooth 3D flip animation along Y-axis
 * - Configurable timing and spring physics
 * - Support for both front-to-back and back-to-front animations
 * - Memory-safe animated value management
 * - Callback support for animation lifecycle events
 * - Accessibility support with proper visibility handling
 */
export const useCardFlipAnimation = ({
  duration = 800,
  initialState = 'front',
  onFlipStart,
  onFlipComplete,
  springConfig = { damping: 15, stiffness: 200 }
}: UseCardFlipAnimationProps = {}): UseCardFlipAnimationReturn => {
  const { registerAnimatedValue, cleanupAnimatedValue } = useAnimatedValues();

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [isShowingBack, setIsShowingBack] = useState(initialState === 'back');

  // Animated value for rotation (0 = front, 180 = back)
  const rotationY = useSharedValue(initialState === 'back' ? 180 : 0);

  // Register animated value for memory management
  useEffect(() => {
    const rotationId = registerAnimatedValue('card-flip-rotation', rotationY);

    return () => {
      cleanupAnimatedValue(rotationId);
    };
  }, [registerAnimatedValue, cleanupAnimatedValue, rotationY]);

  // Helper functions to run on JS thread
  const startAnimation = useCallback((isFlippingToBack: boolean) => {
    setIsAnimating(true);
    if (onFlipStart) onFlipStart(isFlippingToBack);
  }, [onFlipStart]);

  const completeAnimation = useCallback((isShowingBack: boolean) => {
    setIsAnimating(false);
    setIsShowingBack(isShowingBack);
    if (onFlipComplete) onFlipComplete(isShowingBack);
  }, [onFlipComplete]);

  // Main flip function
  const flip = useCallback(() => {
    if (isAnimating) return;

    const targetRotation = isShowingBack ? 0 : 180;
    const isFlippingToBack = !isShowingBack;

    // Start animation
    runOnJS(startAnimation)(isFlippingToBack);

    // Animate rotation
    rotationY.value = withSpring(
      targetRotation,
      {
        damping: springConfig.damping,
        stiffness: springConfig.stiffness,
      },
      (finished) => {
        if (finished) {
          runOnJS(completeAnimation)(isFlippingToBack);
        }
      }
    );
  }, [
    isAnimating, 
    isShowingBack, 
    startAnimation, 
    completeAnimation, 
    rotationY, 
    springConfig
  ]);

  // Flip to front specifically
  const flipToFront = useCallback(() => {
    if (isAnimating || !isShowingBack) return;

    runOnJS(startAnimation)(false);

    rotationY.value = withSpring(
      0,
      springConfig,
      (finished) => {
        if (finished) {
          runOnJS(completeAnimation)(false);
        }
      }
    );
  }, [isAnimating, isShowingBack, startAnimation, completeAnimation, rotationY, springConfig]);

  // Flip to back specifically
  const flipToBack = useCallback(() => {
    if (isAnimating || isShowingBack) return;

    runOnJS(startAnimation)(true);

    rotationY.value = withSpring(
      180,
      springConfig,
      (finished) => {
        if (finished) {
          runOnJS(completeAnimation)(true);
        }
      }
    );
  }, [isAnimating, isShowingBack, startAnimation, completeAnimation, rotationY, springConfig]);

  // Front side animated style
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotationY.value,
      [0, 90, 180],
      [0, 90, 180],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      rotationY.value,
      [0, 90, 180],
      [1, 0, 0],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      rotationY.value,
      [0, 45, 90],
      [1, 0.9, 0.8],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
      backfaceVisibility: 'hidden' as const,
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
    };
  });

  // Back side animated style
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotationY.value,
      [0, 90, 180],
      [180, 90, 0],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      rotationY.value,
      [0, 90, 180],
      [0, 0, 1],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      rotationY.value,
      [90, 135, 180],
      [0.8, 0.9, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
      backfaceVisibility: 'hidden' as const,
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
    };
  });

  return {
    flip,
    flipToFront,
    flipToBack,
    frontAnimatedStyle,
    backAnimatedStyle,
    isAnimating,
    isShowingBack,
  };
};

// Utility hook for card flip with gesture support
export const useCardFlipWithGestures = (props: UseCardFlipAnimationProps = {}) => {
  const flipAnimation = useCardFlipAnimation(props);

  // Double tap gesture for flip (can be extended)
  const handleDoubleTap = useCallback(() => {
    if (!flipAnimation.isAnimating) {
      flipAnimation.flip();
    }
  }, [flipAnimation]);

  return {
    ...flipAnimation,
    handleDoubleTap,
  };
};

// Pre-configured flip animation variants
export const useQuickCardFlip = (props?: Omit<UseCardFlipAnimationProps, 'duration' | 'springConfig'>) => {
  return useCardFlipAnimation({
    duration: 400,
    springConfig: { damping: 20, stiffness: 300 },
    ...props,
  });
};

export const useSmoothCardFlip = (props?: Omit<UseCardFlipAnimationProps, 'duration' | 'springConfig'>) => {
  return useCardFlipAnimation({
    duration: 800,
    springConfig: { damping: 15, stiffness: 150 },
    ...props,
  });
};

export const useBouncyCardFlip = (props?: Omit<UseCardFlipAnimationProps, 'duration' | 'springConfig'>) => {
  return useCardFlipAnimation({
    duration: 1000,
    springConfig: { damping: 10, stiffness: 100 },
    ...props,
  });
};
// @ts-nocheck
