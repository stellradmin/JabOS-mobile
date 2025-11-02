import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { YELLOW_CARD_STYLES, COLORS } from '../../constants/theme';
import { ACTIVITY_CARDS } from '../constants/dateNightCardData';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';

interface ActivityOption {
  id: string;
  name: string;
  emoji: string;
}

interface DateActivityCardProps {
  selectedActivity?: ActivityOption;
  onActivityChange: (activity: ActivityOption) => void;
}

// Single source of truth: map from ACTIVITY_CARDS
const activityOptions: ActivityOption[] = ACTIVITY_CARDS.map(a => ({ id: a.id, name: a.name, emoji: a.emoji }));

const DateActivityCard: React.FC<DateActivityCardProps> = ({
  selectedActivity,
  onActivityChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(
    selectedActivity ? activityOptions.findIndex(a => a.id === selectedActivity.id) : 0
  );

  const animateRotation = (direction: 'left' | 'right') => {
    // Animation removed to eliminate shake effect
  };

  const handleRotate = (direction: 'left' | 'right') => {
    animateRotation(direction);
    
    let newIndex;
    if (direction === 'right') {
      newIndex = (currentIndex + 1) % activityOptions.length;
    } else {
      newIndex = currentIndex === 0 ? activityOptions.length - 1 : currentIndex - 1;
    }
    
    setCurrentIndex(newIndex);
    onActivityChange(activityOptions[newIndex]);
  };

  const currentActivity = activityOptions[currentIndex];

  return (
    <View 
      style={[
        styles.container,
        YELLOW_CARD_STYLES,
        styles.middleCardRounding, // Override for no corner rounding
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Date Activity</Text>
      </View>

      {/* Centered activity display */}
      <View style={styles.activityDisplay}>
        <View style={styles.activityContent}>
          <Text style={styles.activityName}>{currentActivity.name}</Text>
        </View>
      </View>

      {/* Navigation chevrons at absolute corners */}
      <TouchableOpacity 
        style={[styles.chevronButton, styles.chevronLeft]}
        onPress={() => handleRotate('left')}
        activeOpacity={0.7}
      >
        <ChevronLeft size={20} color={COLORS.DARK_TEXT} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.chevronButton, styles.chevronRight]}
        onPress={() => handleRotate('right')}
        activeOpacity={0.7}
      >
        <ChevronRight size={20} color={COLORS.DARK_TEXT} />
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 0, // Remove side margins for full width
    marginBottom: 0, // Remove bottom margin for seamless stacking
    minHeight: 100,
  },
  middleCardRounding: {
    borderRadius: 20, // Full corner rounding for middle cards
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
    textAlign: 'center',
  },
  activityDisplay: {
    position: 'absolute',
    bottom: 15, // Same level as chevrons
    left: 60, // Space for left chevron
    right: 60, // Space for right chevron
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronButton: {
    position: 'absolute',
    width: 40, // Keep size for touch target
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronLeft: {
    bottom: 15,
    left: 15,
  },
  chevronRight: {
    bottom: 15,
    right: 15,
  },
  activityContent: {
    alignItems: 'center',
  },
  activityName: {
    // Match typography with "Search Matches" while keeping readable size
    fontSize: 22,
    fontFamily: 'Geist-Regular',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 26,
  },
});

export default DateActivityCard;
