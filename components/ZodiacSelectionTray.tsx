import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PopUpTray from './PopUpTray';
import AdaptedWheel from './AdaptedWheel';

interface ZodiacSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (sign: string) => void;
  initialSign?: string;
  headerTabColor?: string; // allow theming per flow (e.g., baby blue vs purple)
}

const ZODIAC_SIGNS = [
  'Any',
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const ZodiacSelectionTray: React.FC<ZodiacSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirm,
  initialSign = 'Any',
  headerTabColor = '#B8D4F1',
}) => {
  const [selectedSign, setSelectedSign] = useState<string>(initialSign);

  useEffect(() => {
    setSelectedSign(initialSign);
  }, [initialSign, isVisible]);

  const handleConfirm = () => {
    onConfirm(selectedSign);
    onClose();
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Select Preferred Sign"
      confirmButtonText="Confirm Selection"
      headerTabColor={headerTabColor}
    >
      <View style={styles.wheelContainer}>
        <AdaptedWheel
          data={ZODIAC_SIGNS}
          selectedValue={selectedSign}
          onValueChange={setSelectedSign}
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

export default ZodiacSelectionTray;

