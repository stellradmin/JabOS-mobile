import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import PopUpTray from './PopUpTray';

interface LookingForSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (selectedOptions: string[]) => void;
  initialSelections: string[];
}

const LookingForSelectionTray: React.FC<LookingForSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirm,
  initialSelections
}) => {
  // Helper function to convert backend values to display values
  const mapInitialSelectionToDisplay = (selection: string): string => {
    switch (selection) {
      case 'Males': return 'Men';
      case 'Females': return 'Women';
      case 'Both': return 'Both Men & Women';
      case 'Non-Binary': return 'Non-Binary People';
      case 'Transgender': return 'Transgender People';
      default: return 'Both Men & Women';
    }
  };

  const [selectedOption, setSelectedOption] = useState<string>(
    initialSelections.length > 0
      ? mapInitialSelectionToDisplay(initialSelections[0])
      : 'Both Men & Women'
  );

  const lookingForOptions = [
    'Men',
    'Women',
    'Both Men & Women',
    'Non-Binary People',
    'Transgender People'
  ];

  // Update state when initial selections change
  useEffect(() => {
    if (initialSelections.length > 0) {
      setSelectedOption(mapInitialSelectionToDisplay(initialSelections[0]));
    }
  }, [initialSelections]);

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Convert single selection back to array format for backward compatibility
    const selectionValue = selectedOption === 'Men' ? 'Males'
      : selectedOption === 'Women' ? 'Females'
      : selectedOption === 'Both Men & Women' ? 'Both'
      : selectedOption === 'Non-Binary People' ? 'Non-Binary'
      : selectedOption === 'Transgender People' ? 'Transgender'
      : 'Both';

    onConfirm([selectionValue]);
  };

  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Who are you looking to meet?"
      confirmButtonText="Confirm"
      headerTabColor="#B8D4F1"
    >
      <View style={styles.container}>
        {lookingForOptions.map((option) => {
          const isSelected = selectedOption === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
              onPress={() => handleOptionSelect(option)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}>
                {option}
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

export default LookingForSelectionTray;
