import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import PopUpTray from './PopUpTray';

interface PoliticsSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmPolitics: (politics: string) => void;
  initialPolitics: string;
  politicsOptions: string[];
}

const PoliticsSelectionTray: React.FC<PoliticsSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirmPolitics,
  initialPolitics,
  politicsOptions,
}) => {
  const [selectedPolitics, setSelectedPolitics] = useState(initialPolitics);

  const handlePoliticsSelect = (politics: string) => {
    setSelectedPolitics(politics);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirmPolitics(selectedPolitics);
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Select Political View"
      confirmButtonText="Confirm"
      headerTabColor="#B8D4F1"
    >
      <View style={styles.container}>
        {politicsOptions.map((politics) => {
          const isSelected = selectedPolitics === politics;
          return (
            <TouchableOpacity
              key={politics}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
              onPress={() => handlePoliticsSelect(politics)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}>
                {politics}
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

export default PoliticsSelectionTray;
