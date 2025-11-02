import React from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import CarouselCard from './CarouselCard';

interface CarouselItem {
  id: string;
  label: string;
}

interface HorizontalCardCarouselProps {
  items: CarouselItem[];
  selectedItem: string;
  onItemSelect: (itemId: string) => void;
  cardWidth?: number;
  cardHeight?: number;
  spacing?: number;
}

const { width: screenWidth } = Dimensions.get('window');

const HorizontalCardCarousel: React.FC<HorizontalCardCarouselProps> = ({
  items,
  selectedItem,
  onItemSelect,
  cardWidth = 120,
  cardHeight = 80,
  spacing = 12,
}) => {
  const getItemLayout = (data: any, index: number) => ({
    length: cardWidth + spacing,
    offset: (cardWidth + spacing) * index,
    index,
  });

  const renderCard = ({ item }: { item: CarouselItem }) => (
    <CarouselCard
      item={item}
      isSelected={selectedItem === item.id}
      onPress={() => onItemSelect(item.id)}
      width={cardWidth}
      height={cardHeight}
      marginRight={spacing}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + spacing}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: spacing }
        ]}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  contentContainer: {
    alignItems: 'center',
  },
});

export default HorizontalCardCarousel;