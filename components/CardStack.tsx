import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.8;
const CARD_HEIGHT = 400;
const STACK_SIZE = 3;
const SWIPE_THRESHOLD = 50;

interface CardStackProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onSwipeLeft?: (item: T, index: number) => void;
  onSwipeRight?: (item: T, index: number) => void;
  onCurrentItemChange?: (item: T, index: number) => void;
}

function CardStack<T>({ 
  data, 
  renderItem, 
  onSwipeLeft, 
  onSwipeRight, 
  onCurrentItemChange 
}: CardStackProps<T>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    const currentItem = data[currentIndex];
    
    if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft(currentItem, currentIndex);
    } else if (direction === 'right' && onSwipeRight) {
      onSwipeRight(currentItem, currentIndex);
    }

    // Move to next card
    const nextIndex = (currentIndex + 1) % data.length;
    setCurrentIndex(nextIndex);
    
    if (onCurrentItemChange) {
      onCurrentItemChange(data[nextIndex], nextIndex);
    }
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      // Card starts moving
    },
    onActive: (event: any) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.1; // Subtle vertical movement
      rotate.value = event.translationX * 0.1; // Rotation based on horizontal movement
    },
    onEnd: (event: any) => {
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD && event.velocityX < -500;
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD && event.velocityX > 500;

      if (shouldSwipeLeft) {
        // Animate out to the left
        translateX.value = withSpring(-screenWidth);
        rotate.value = withSpring(-30);
        runOnJS(handleSwipeComplete)('left');
        
        // Reset after animation
        setTimeout(() => {
          translateX.value = 0;
          translateY.value = 0;
          rotate.value = 0;
        }, 300);
      } else if (shouldSwipeRight) {
        // Animate out to the right  
        translateX.value = withSpring(screenWidth);
        rotate.value = withSpring(30);
        runOnJS(handleSwipeComplete)('right');
        
        // Reset after animation
        setTimeout(() => {
          translateX.value = 0;
          translateY.value = 0;
          rotate.value = 0;
        }, 300);
      } else {
        // Spring back to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    },
  });

  const renderCard = (item: T, index: number, cardIndex: number) => {
    const isTop = cardIndex === 0;
    
    const animatedStyle = useAnimatedStyle(() => {
      if (!isTop) {
        // Static positioning for background cards
        const scale = interpolate(cardIndex, [0, 1, 2], [1, 0.95, 0.9]);
        const translateYValue = cardIndex * 8;
        
        return {
          transform: [
            { scale },
            { translateY: translateYValue },
          ],
          zIndex: STACK_SIZE - cardIndex,
          opacity: 1 - (cardIndex * 0.2),
        } as any;
      }

      // Animated positioning for top card
      const scale = interpolate(
        Math.abs(translateX.value),
        [0, screenWidth],
        [1, 0.9]
      );

      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${rotate.value}deg` },
          { scale },
        ],
        zIndex: STACK_SIZE,
        opacity: interpolate(
          Math.abs(translateX.value),
          [0, screenWidth],
          [1, 0.5]
        ),
      } as any;
    });

    return (
      <Animated.View
        key={`${index}-${cardIndex}`}
        style={[styles.card, animatedStyle]}
      >
        {renderItem(item, index)}
      </Animated.View>
    );
  };

  const getVisibleCards = () => {
    const cards = [];
    for (let i = 0; i < Math.min(STACK_SIZE, data.length); i++) {
      const dataIndex = (currentIndex + i) % data.length;
      const item = data[dataIndex];
      cards.push(renderCard(item, dataIndex, i));
    }
    return cards.reverse(); // Render bottom cards first
  };

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No cards available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stackContainer}>
        {getVisibleCards().map((card, index) => {
          // Only add gesture handler to the top card
          if (index === getVisibleCards().length - 1) {
            return (
              <PanGestureHandler key={index} onGestureEvent={gestureHandler}>
                {card}
              </PanGestureHandler>
            );
          }
          return card;
        })}
      </View>
      
      {/* Current card indicator */}
      <View style={styles.indicatorContainer}>
        <Text style={styles.indicatorText}>
          {currentIndex + 1} of {data.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  indicatorContainer: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 20,
  },
  indicatorText: {
    fontSize: 14,
    color: 'black',
    fontFamily: 'Geist-Medium',
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 18,
    color: 'black',
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
  },
});

export default CardStack;
// @ts-nocheck
