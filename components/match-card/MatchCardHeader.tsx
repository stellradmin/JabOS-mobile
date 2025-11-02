import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMatchCardContext } from '../../src/contexts/MatchCardContext';

interface MatchCardHeaderProps {
  // No props needed - data comes from context
}

/**
 * MatchCardHeader - Header section component following Single Responsibility Principle
 * 
 * Responsibilities:
 * 1. Display zodiac sign and date activity
 * 2. Provide accessible labels for screen readers
 * 3. Consistent header styling
 * 
 * Does NOT handle:
 * - User interactions
 * - Animation state
 * - Data fetching or business logic
 */
export const MatchCardHeader: React.FC<MatchCardHeaderProps> = () => {
  // Get context data - eliminates prop drilling
  const { dateActivity, zodiacSign } = useMatchCardContext();
  
  // Query: Format display values following Defensive Programming
  const displayZodiacSign = zodiacSign || 'Unknown Sign';
  const displayDateActivity = dateActivity || 'Dinner';

  return (
    <View 
      style={styles.topStrip}
      accessibilityRole="text"
      accessibilityLabel={`Date context: ${displayZodiacSign} compatibility for ${displayDateActivity} date`}
    >
      <Text 
        style={styles.dateHeaderText}
        accessibilityRole="text"
        accessibilityLabel={`Zodiac sign: ${displayZodiacSign}`}
      >
        {displayZodiacSign}
      </Text>
      <Text 
        style={styles.zodiacSubheaderText}
        accessibilityRole="text"
        accessibilityLabel={`Date type: ${displayDateActivity} date`}
      >
        {`${displayDateActivity} Date`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  topStrip: {
    backgroundColor: '#B8D4F1', // Baby blue matching onboarding cards
    borderTopWidth: 2,
    borderTopColor: 'black',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  dateHeaderText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#666',
    textAlign: 'left',
  },
  zodiacSubheaderText: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: '#000',
    textAlign: 'left',
    marginTop: 4,
  },
});