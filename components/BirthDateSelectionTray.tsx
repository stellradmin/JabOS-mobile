import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import PopUpTray from './PopUpTray';

interface BirthDateSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmDate: (month: string, day: string, year: string) => void;
  initialMonth: string;
  initialDay: string;
  initialYear: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

const BirthDateSelectionTray: React.FC<BirthDateSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirmDate,
  initialMonth,
  initialDay,
  initialYear,
}) => {
  // Convert initial values to Date object
  const getInitialDate = () => {
    const monthIndex = MONTHS.indexOf(initialMonth);
    const month = monthIndex >= 0 ? monthIndex : 0;
    const day = parseInt(initialDay, 10) || 1;
    const year = parseInt(initialYear, 10) || new Date().getFullYear() - 25;
    return new Date(year, month, day);
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate());

  useEffect(() => {
    if (isVisible) {
      setSelectedDate(getInitialDate());
    }
  }, [initialMonth, initialDay, initialYear, isVisible]);

  const handleDateChange = (_event: any, date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleConfirm = () => {
    const month = MONTHS[selectedDate.getMonth()];
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const year = selectedDate.getFullYear().toString();
    onConfirmDate(month, day, year);
    onClose();
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Select Birth Date"
      headerTabColor="#B8D4F1"
    >
      <View style={styles.pickerContainer}>
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          textColor="#000"
          themeVariant="light"
        />
      </View>
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  pickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
});

export default BirthDateSelectionTray;
