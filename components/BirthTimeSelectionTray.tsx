import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import PopUpTray from './PopUpTray';

interface BirthTimeSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmTime: (hour: string, minute: string, amPm: string) => void;
  initialHour: string;
  initialMinute: string;
  initialAmPm: string;
}

// Helper function to convert 12-hour format to Date object (moved outside component)
const convertToDate = (hour12Str: string, minuteStr: string, period: string): Date => {
  const hour = parseInt(hour12Str, 10);
  const minute = parseInt(minuteStr, 10);

  // Validate inputs
  if (isNaN(hour) || isNaN(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    // Default to 12:00 PM if invalid
    const defaultDate = new Date();
    defaultDate.setHours(12, 0, 0, 0);
    return defaultDate;
  }

  // Convert to 24-hour format
  let is24Hour: number;
  if (period === 'PM' && hour !== 12) {
    is24Hour = hour + 12;
  } else if (period === 'AM' && hour === 12) {
    is24Hour = 0;
  } else {
    is24Hour = hour;
  }

  const date = new Date();
  date.setHours(is24Hour, minute, 0, 0);
  return date;
};

const BirthTimeSelectionTray: React.FC<BirthTimeSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirmTime,
  initialHour,
  initialMinute,
  initialAmPm,
}) => {
  console.log('🔵 [BirthTimeTray] RENDER - Props:', { initialHour, initialMinute, initialAmPm, isVisible });

  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`🔵 [BirthTimeTray] Render #${renderCount.current}`);

  const [timeKnown, setTimeKnown] = useState(true);

  // Use lazy initializer to prevent re-computation on every render
  const [selectedTime, setSelectedTime] = useState(() => {
    const initialTime = convertToDate(initialHour, initialMinute, initialAmPm);
    console.log('🟢 [BirthTimeTray] useState INIT - Setting initial time to:', initialTime.toLocaleTimeString());
    return initialTime;
  });

  console.log('🟡 [BirthTimeTray] Current selectedTime state:', selectedTime.toLocaleTimeString());

  // Track previous isVisible to only reset when opening
  const prevIsVisibleRef = useRef(isVisible);

  useEffect(() => {
    const wasVisible = prevIsVisibleRef.current;
    const isNowVisible = isVisible;

    console.log('🟣 [BirthTimeTray] useEffect - wasVisible:', wasVisible, 'isNowVisible:', isNowVisible);

    if (!wasVisible && isNowVisible) {
      // Only reset when transitioning from hidden to visible
      console.log('🔴 [BirthTimeTray] RESETTING TIME (modal opened)');
      const newTime = convertToDate(initialHour, initialMinute, initialAmPm);
      console.log('🔴 [BirthTimeTray] New time:', newTime.toLocaleTimeString());
      setSelectedTime(newTime);
    }

    prevIsVisibleRef.current = isVisible;
  }, [isVisible, initialHour, initialMinute, initialAmPm]);

  const handleTimeChange = (_event: any, time?: Date) => {
    console.log('🟠 [BirthTimeTray] handleTimeChange called with:', time?.toLocaleTimeString());
    if (time) {
      console.log('🟠 [BirthTimeTray] Setting selectedTime to:', time.toLocaleTimeString());
      setSelectedTime(time);
    }
  };

  const handleUnknownTime = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeKnown(false);
    // Set to noon (12:00 PM)
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    setSelectedTime(noon);
  };

  const handleKnowTime = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeKnown(true);
  };

  const handleConfirm = () => {
    const hours = selectedTime.getHours();
    const minutes = selectedTime.getMinutes();

    // Convert to 12-hour format
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const amPm = hours >= 12 ? 'PM' : 'AM';

    const hourStr = hour12.toString().padStart(2, '0');
    const minuteStr = minutes.toString().padStart(2, '0');

    onConfirmTime(hourStr, minuteStr, amPm);
    onClose();
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Birth Time"
      headerTabColor="#B8D4F1"
      confirmButtonText="Confirm"
    >
      <View style={styles.container}>
        {timeKnown ? (
          <>
            <Text style={styles.subtitle}>
              Exact time provides the most accurate chart
            </Text>
            <View style={styles.pickerContainer}>
              <DateTimePicker
                key={`${initialHour}-${initialMinute}-${initialAmPm}`}
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                textColor="#000"
                themeVariant="light"
              />
            </View>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleUnknownTime}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>
                I don't know my exact birth time
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>No problem!</Text>
                <Text style={styles.infoText}>
                  We'll calculate your chart using 12:00 PM. Your Sun, Moon, and planet signs will still be accurate.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleKnowTime}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>
                Actually, I do know it
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 15,
    color: '#4A90E2',
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#D0E7FF',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default BirthTimeSelectionTray;
