import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

const ITEM_HEIGHT_CONST = 60; // Renamed for clarity, same value

interface AdaptedWheelProps {
  data: string[]; // Changed from items/zodiacSigns
  selectedValue: string; // Changed from initialSign
  onValueChange: (value: string) => void; // Changed from onSignChange
  style?: StyleProp<ViewStyle>; 
  columnWidth?: number; 
  variant?: 'default' | 'contained'; // New prop for styling variant
}

const AdaptedWheel: React.FC<AdaptedWheelProps> = ({
  data,
  selectedValue,
  onValueChange,
  style, // This style is for the outermost View wrapping the wheelContainer
  columnWidth,
  variant = 'default', // Default to original styling
}) => {
  // Find the initial index based on selectedValue
  const getInitialIndex = useCallback(() => {
    if (!data || data.length === 0) return 0;
    const index = data.findIndex((item) => item === selectedValue);
    return Math.max(0, index); // Ensure index is not -1
  }, [data, selectedValue]);

  const [selectedIndex, setSelectedIndex] = useState(getInitialIndex());
  const scrollViewRef = useRef<ScrollView>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmittedValue = useRef<string>(selectedValue);

  // Update the selected value when the index changes
  useEffect(() => {
    if (data && data.length > 0 && data[selectedIndex] !== undefined) {
      const newValue = data[selectedIndex];
      // Only call onValueChange if the value has actually changed and hasn't been emitted yet
      if (newValue !== lastEmittedValue.current) {
        lastEmittedValue.current = newValue;
        onValueChange(newValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, data]);

  // Initialize or update the wheel position when selectedValue prop changes
  useEffect(() => {
    const newIndex = getInitialIndex();
    // Only update if the value actually changed from outside
    if (newIndex !== selectedIndex && data[newIndex] !== lastEmittedValue.current) {
      setSelectedIndex(newIndex);
      lastEmittedValue.current = data[newIndex];

      // Scroll to the new position
      if (scrollViewRef.current && data && data.length > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: newIndex * ITEM_HEIGHT_CONST,
            animated: false,
          });
        }, 100);
      }
    }
  }, [selectedValue, getInitialIndex, data, selectedIndex]);

  // Handle scroll events to update selected index
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!data || data.length === 0) return;

    isScrollingRef.current = true;

    const yOffset = event.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT_CONST);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));

    if (clampedIndex !== selectedIndex) {
      setSelectedIndex(clampedIndex);
    }

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set timeout to snap to position after scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  // Snap to the nearest item when scrolling ends
  const handleScrollEnd = () => {
    if (!scrollViewRef.current || !data || data.length === 0) return;

    scrollViewRef.current.scrollTo({
      y: selectedIndex * ITEM_HEIGHT_CONST,
      animated: true,
    });
  };

  // Handle direct item selection
  const handleItemPress = (index: number) => {
    if (index !== selectedIndex) {
      setSelectedIndex(index);
      scrollViewRef.current?.scrollTo({
        y: index * ITEM_HEIGHT_CONST,
        animated: true,
      });
    }
  };

  if (!data || data.length === 0) {
    return (
      <View style={[styles.wheelContainer, { width: columnWidth || "100%" }, style]}>
        <Text>No data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.outerContainerStyle, style]}>
      <View
        style={[
          styles.wheelContainer,
          variant === 'contained' && styles.wheelContainerContained,
          { width: columnWidth || "100%" }
        ]}
      >
        {/* Selection highlight */}
        <View style={styles.selectionHighlight} />

        {/* ScrollView for smooth scrolling */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT_CONST}
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
        >
          {/* Top padding to center first item */}
          <View style={{ height: ITEM_HEIGHT_CONST }} />

          {/* Wheel items */}
          {data.map((item, index) => {
            const distance = Math.abs(index - selectedIndex);
            const opacity = 1 - Math.min(distance * 0.25, 0.6);

            return (
              <TouchableOpacity
                key={`${item}-${index}`}
                style={[
                  styles.scrollItem,
                  {
                    opacity,
                  },
                ]}
                onPress={() => handleItemPress(index)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.itemText,
                    selectedIndex === index
                      ? styles.selectedItemText
                      : styles.unselectedItemText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Bottom padding to center last item */}
          <View style={{ height: ITEM_HEIGHT_CONST }} />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainerStyle: { // New style for the outermost container passed from parent
    // This will typically handle margins or positioning if needed by the parent.
    // For example, BirthInfoScreen might pass { marginHorizontal: pickerColumnGap }
    // Defaults to taking full width available to it if columnWidth is not set.
  },
  wheelContainer: { 
    height: ITEM_HEIGHT_CONST * 3, // 180
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F7F8FB",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#D6DDE8",
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  wheelContainerContained: { // Variant style for when inside a bento box
    backgroundColor: '#F7F8FB',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D6DDE8',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 12,
  },
  scrollItem: {
    height: ITEM_HEIGHT_CONST,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 20,
    fontFamily: 'Geist-Medium',
    color: '#5B6270',
    textAlign: 'center',
  },
  selectedItemText: {
    fontFamily: 'Geist-Regular',
    color: "#111827",
  },
  unselectedItemText: {
    color: "#9AA1B2",
  },
  selectionHighlight: {
    position: "absolute",
    height: ITEM_HEIGHT_CONST, // 60
    width: "100%",
    top: ITEM_HEIGHT_CONST, // 60 (center item)
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    zIndex: -1,
  },
});

export default AdaptedWheel;
