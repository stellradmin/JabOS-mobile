import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import PopUpTray from './PopUpTray';

interface GenderSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmGender: (gender: string) => void;
  initialGender: string;
  genderOptions: string[];
}

const GenderSelectionTray: React.FC<GenderSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirmGender,
  initialGender,
  genderOptions,
}) => {
  const [selectedGender, setSelectedGender] = useState(initialGender);

  const handleGenderSelect = (gender: string) => {
    setSelectedGender(gender);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirmGender(selectedGender);
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Select Your Gender"
      confirmButtonText="Confirm"
      headerTabColor="#B8D4F1"
    >
      <View style={styles.container}>
        {genderOptions.map((gender) => {
          const isSelected = selectedGender === gender;
          return (
            <TouchableOpacity
              key={gender}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
              onPress={() => handleGenderSelect(gender)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}>
                {gender}
              </Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#E3F2FF',
    borderColor: '#4A90E2',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#333',
  },
  optionTextSelected: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4A90E2',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default GenderSelectionTray;
