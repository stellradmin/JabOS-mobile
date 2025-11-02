import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PopUpTray from './PopUpTray';
import AdaptedWheel from './AdaptedWheel';
import { ACTIVITY_NAMES } from './constants/dateNightCardData';

interface ActivitySelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (activity: string) => void;
  initialActivity?: string;
  headerTabColor?: string; // allow theming per flow (e.g., baby blue vs purple)
}

const ACTIVITIES = ['Any', ...ACTIVITY_NAMES];

const ActivitySelectionTray: React.FC<ActivitySelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirm,
  initialActivity = 'Any',
  headerTabColor = '#C8A8E9',
}) => {
  const [selectedActivity, setSelectedActivity] = useState<string>(initialActivity);

  useEffect(() => {
    setSelectedActivity(initialActivity);
  }, [initialActivity, isVisible]);

  const handleConfirm = () => {
    onConfirm(selectedActivity);
    onClose();
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Select Preferred Activity"
      confirmButtonText="Confirm Selection"
      headerTabColor={headerTabColor}
    >
      <View style={styles.wheelContainer}>
        <AdaptedWheel
          data={ACTIVITIES}
          selectedValue={selectedActivity}
          onValueChange={setSelectedActivity}
          style={styles.wheelStyle}
        />
      </View>
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  wheelContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20, // Match PopUpTray content padding
  },
  wheelStyle: {
    width: '100%',
  },
});

export default ActivitySelectionTray;
