import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Calendar } from "lucide-react-native";
import { YELLOW_CARD_STYLES, COLORS } from '../../constants/theme';

interface SchedulerCardProps {
  onSchedulerPress: () => void;
}

const SchedulerCard: React.FC<SchedulerCardProps> = ({
  onSchedulerPress,
}) => {
  return (
    <View 
      style={[
        styles.container,
        YELLOW_CARD_STYLES,
        styles.bottomCardRounding,
      ]}
    >
      {/* Scheduler Section */}
      <View style={styles.schedulerSection}>
        <Text style={styles.schedulerTitle}>Plan Your Perfect Date</Text>
        <Text style={styles.schedulerSubtitle}>
          Coordinate schedules with your matches
        </Text>
        
        <TouchableOpacity
          style={styles.schedulerButton}
          onPress={onSchedulerPress}
          activeOpacity={0.8}
        >
          <View style={styles.schedulerButtonContent}>
            <Calendar size={20} color={COLORS.CARD_WHITE_TEXT} />
            <Text style={styles.schedulerButtonText}>Date Scheduler</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 0,
    marginBottom: -20, // Negative margin to overlap with navigation bar
    paddingBottom: 8,
    minHeight: 120,
    zIndex: 10,
    elevation: 10,
    position: 'relative',
  },
  bottomCardRounding: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  schedulerSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  schedulerTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
    textAlign: 'center',
  },
  schedulerSubtitle: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 16,
  },
  schedulerButton: {
    backgroundColor: COLORS.BLACK_CARD,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
  },
  schedulerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  schedulerButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: COLORS.CARD_WHITE_TEXT,
  },
});

export default SchedulerCard;
