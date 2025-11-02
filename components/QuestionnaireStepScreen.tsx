import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Check } from "lucide-react-native";
import { TEXT_STYLES, COLORS } from '../constants/theme';

interface QuestionnaireStepScreenProps {
  question: string;
  options: string[];
  questionIndex: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  onComplete: (questionIndex: number, answer: number) => void;
  backgroundColor?: string;
  sectionTitle?: string;
}

const QuestionnaireStepScreen: React.FC<QuestionnaireStepScreenProps> = ({ 
  question,
  options,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  onComplete,
  backgroundColor = '#F2BAC9',
  sectionTitle = 'Personality'
}) => {
  const [localSelectedOption, setLocalSelectedOption] = useState<number | null>(selectedAnswer);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleOptionSelect = (optionIndex: number) => {
    if (isProcessing) return; // Prevent multiple selections
    
    setLocalSelectedOption(optionIndex);
    setIsProcessing(true);
    
    // Longer delay before transitioning to next screen for better UX
    setTimeout(() => {
      onComplete(questionIndex, optionIndex);
      setIsProcessing(false);
    }, 600);
  };


  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Question {questionIndex + 1} of {totalQuestions}</Text>
        <Text style={styles.mainTitle}>{sectionTitle}</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.questionText}>{question}</Text>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            const isSelected = localSelectedOption === index;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  isSelected && styles.selectedOptionButton,
                ]}
                onPress={() => handleOptionSelect(index)}
                activeOpacity={0.6}
              >
                <Text style={[
                  styles.optionText,
                  isSelected && styles.selectedOptionText,
                ]}>
                  {option}
                </Text>
                {isSelected && (
                  <Check size={20} color="black" style={styles.checkIcon} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 2,
    borderTopColor: 'black',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
  },
  stepIndicator: {
    ...TEXT_STYLES.BODY_SMALL,
    color: COLORS.CHARCOAL,
    opacity: 0.6,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: COLORS.CHARCOAL,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  questionText: {
    ...TEXT_STYLES.BODY_MEDIUM,
    fontFamily: 'Geist-Regular',
    textAlign: "center",
    color: COLORS.CHARCOAL,
    marginBottom: 20,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedOptionButton: {
    backgroundColor: "#F2BAC9",
  },
  optionText: {
    ...TEXT_STYLES.BODY_LARGE,
    fontFamily: 'Geist-Regular',
    color: COLORS.CHARCOAL,
  },
  selectedOptionText: {
    color: "black",
  },
  checkIcon: {
    marginLeft: 8,
  },
});

export default QuestionnaireStepScreen;
