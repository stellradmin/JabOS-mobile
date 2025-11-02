import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Animated } from 'react-native';

interface SharedAnimationContextType {
  backgroundColor: Animated.AnimatedInterpolation<string | number>;
  // We can expose animatedValue directly if other components need more complex sync
  // animatedValue: Animated.Value; 
}

const SharedAnimationContext = createContext<SharedAnimationContextType | undefined>(undefined);

export const useSharedAnimation = () => {
  const context = useContext(SharedAnimationContext);
  if (context === undefined) {
    throw new Error('useSharedAnimation must be used within a SharedAnimationProvider');
  }
  return context;
};

interface SharedAnimationProviderProps {
  children: ReactNode;
}

export const SharedAnimationProvider: React.FC<SharedAnimationProviderProps> = ({ children }) => {
  const colors = [
    '#BAF2BB', // Light green
    '#FFEC9E', // Light yellow
    '#F2BAC9', // Light pink
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  // Initialize nextIndex to be different from currentIndex to avoid issues if colors.length is 1 or 2
  const [nextIndex, setNextIndex] = useState(colors.length > 1 ? 1 : 0);
  const animatedValue = useRef(new Animated.Value(0)).current; // Keep for structure, but won't be driven

  // Comment out or remove useEffect to disable animation
  /*
  useEffect(() => {
    if (colors.length < 2) return; 

    const startTransition = () => {
      animatedValue.setValue(0);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 3000, 
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setCurrentIndex(nextIndex);
          setNextIndex((prevNextIndex) => (prevNextIndex + 1) % colors.length);
          startTransition(); 
        }
      });
    };

    const timerId = setTimeout(startTransition, 100); 

    return () => {
      clearTimeout(timerId);
      animatedValue.stopAnimation(); 
    };
  }, [nextIndex, colors.length, animatedValue]);
  */

  // Provide a static background color
  const staticBackgroundColor = '#BAF2BB';

  // The context expects an AnimatedInterpolation. For a static color,
  // we can create a "dummy" animated value that's already resolved,
  // or simply cast the static string if consumers can handle it.
  // For simplicity and to maintain the type, let's use a non-interpolated Animated.Value.
  // However, consumers expect AnimatedInterpolation.
  // A simpler way is to provide the static string directly and ensure consumers can handle it,
  // or adjust the context type.
  // For now, let's provide the static string and assume consumers will adapt or it will work.
  // If Animated.View requires an AnimatedValue, this might need adjustment.
  // Let's try providing the static string directly. The Animated.View should accept a plain color string.
  
  const value = {
    backgroundColor: staticBackgroundColor as any, // Cast to satisfy type, Animated.View can take string
    // animatedValue 
  };

  return (
    <SharedAnimationContext.Provider value={value}>
      {children}
    </SharedAnimationContext.Provider>
  );
};
