import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import PopUpTray from './PopUpTray';

interface EducationSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmEducation: (education: string) => void;
  initialEducation: string;
  educationOptions: string[];
}

const EducationSelectionTray: React.FC<EducationSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirmEducation,
  initialEducation,
  educationOptions,
}) => {
  const [selectedEducation, setSelectedEducation] = useState(initialEducation);

  const handleEducationSelect = (education: string) => {
    setSelectedEducation(education);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirmEducation(selectedEducation);
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Select Education Level"
      confirmButtonText="Confirm"
      headerTabColor="#B8D4F1"
    >
      <View style={styles.container}>
        {educationOptions.map((education) => {
          const isSelected = selectedEducation === education;
          return (
            <TouchableOpacity
              key={education}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
              onPress={() => handleEducationSelect(education)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}>
                {education}
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
    borderColor: 'black',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#333',
  },
  optionTextSelected: {
    fontSize: 17,
    fontWeight: '600',
    color: 'black',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default EducationSelectionTray;
