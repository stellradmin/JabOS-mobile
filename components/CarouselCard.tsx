import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

interface CarouselItem {
  id: string;
  label: string;
}

interface CarouselCardProps {
  item: CarouselItem;
  isSelected: boolean;
  onPress: () => void;
  width: number;
  height: number;
  marginRight: number;
}

const CarouselCard: React.FC<CarouselCardProps> = ({
  item,
  isSelected,
  onPress,
  width,
  height,
  marginRight,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          width,
          height,
          marginRight,
          backgroundColor: isSelected ? '#C8A8E9' : '#f5f5f5',
          borderWidth: isSelected ? 3 : 2,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${item.label}, ${isSelected ? 'selected' : 'not selected'}`}
    >
      <Text style={[
        styles.cardText,
        isSelected && styles.cardTextSelected
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    minHeight: 44,
    minWidth: 44,
  },
  cardText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: 'black',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  cardTextSelected: {
    fontFamily: 'Geist-Regular',
  },
});

export default CarouselCard;