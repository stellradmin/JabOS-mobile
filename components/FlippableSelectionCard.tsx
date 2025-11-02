import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Eye } from 'lucide-react-native';
import { useCardFlipAnimation } from '../src/hooks/useCardFlipAnimation';

interface FlippableSelectionCardProps {
  id: string;
  title: string;
  emoji: string;
  frontDescription: string;
  backDescription: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  width: number;
  height: number;
  marginRight?: number;
}

const FlippableSelectionCard: React.FC<FlippableSelectionCardProps> = ({
  id,
  title,
  emoji,
  frontDescription,
  backDescription,
  isSelected,
  onSelect,
  width,
  height,
  marginRight = 0,
}) => {
  const { flip, frontAnimatedStyle, backAnimatedStyle, isAnimating } = useCardFlipAnimation({
    duration: 600,
  });

  const handleCardPress = () => {
    if (!isAnimating) {
      onSelect(id);
    }
  };

  const handleFlipPress = (e: any) => {
    e.stopPropagation();
    flip();
  };

  const cardStyles = [
    styles.card,
    {
      width,
      height,
      marginRight,
      backgroundColor: isSelected ? '#C8A8E9' : '#f5f5f5',
      borderWidth: isSelected ? 3 : 2,
    }
  ];

  return (
    <TouchableOpacity
      style={[styles.cardContainer, { width, height, marginRight }]}
      onPress={handleCardPress}
      activeOpacity={0.9}
      disabled={isAnimating}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${title}, ${isSelected ? 'selected' : 'not selected'}`}
    >
      {/* Front Side */}
      <Animated.View style={[cardStyles, frontAnimatedStyle]}>
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={handleFlipPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="View details"
        >
          <Eye size={16} color="black" />
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[
            styles.title,
            isSelected && styles.titleSelected
          ]}>
            {title}
          </Text>
          <Text style={[
            styles.frontDescription,
            isSelected && styles.frontDescriptionSelected
          ]}>
            {frontDescription}
          </Text>
        </View>
      </Animated.View>

      {/* Back Side */}
      <Animated.View style={[cardStyles, backAnimatedStyle]}>
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={handleFlipPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Hide details"
        >
          <Eye size={16} color="black" />
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[
            styles.title,
            isSelected && styles.titleSelected
          ]}>
            {title}
          </Text>
          <Text style={[
            styles.backDescription,
            isSelected && styles.backDescriptionSelected
          ]}>
            {backDescription}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
  },
  card: {
    borderRadius: 12,
    borderColor: 'black',
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 12,
  },
  eyeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: 'black',
    textAlign: 'center',
    marginBottom: 6,
  },
  titleSelected: {
    fontFamily: 'Geist-Regular',
  },
  frontDescription: {
    fontSize: 11,
    color: 'black',
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 14,
  },
  frontDescriptionSelected: {
    fontFamily: 'Geist-Medium',
    opacity: 0.9,
  },
  backDescription: {
    fontSize: 10,
    color: 'black',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 12,
    paddingHorizontal: 4,
  },
  backDescriptionSelected: {
    fontFamily: 'Geist-Medium',
    opacity: 1,
  },
});

export default FlippableSelectionCard;