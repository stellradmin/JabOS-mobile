import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Users } from "lucide-react-native";
import GenderSelectionTray from "./GenderSelectionTray";
import LookingForSelectionTray from "./LookingForSelectionTray";
import { useInteractiveComponents } from '../src/hooks/useInteractiveComponents';
// Import ProfileSetupData if it's in a shared file, or define a partial type
// For simplicity, we'll assume ProfileSetupData is accessible or props are typed directly

// const { width } = Dimensions.get("window"); // Not used

interface ProfileSetupStep1ScreenProps {
  initialData: {
    gender: string;
    lookingFor?: string[];
  };
  onContinue: (data: { gender: string; lookingFor: string[] }) => void;
  onBack: () => void;
  currentSubStepInFlow: number;
  overallStepsCompletedBeforeThisFlow: number;
  totalSubStepsInFlow: number;
  totalOverallOnboardingSteps: number;
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const ProfileSetupStep1Screen: React.FC<ProfileSetupStep1ScreenProps> = ({
  initialData,
  onContinue,
  onBack,
  currentSubStepInFlow,
  overallStepsCompletedBeforeThisFlow,
  totalSubStepsInFlow,
  totalOverallOnboardingSteps,
  hideProgressBar = false,
  hideBackButton = false,
  backgroundColor = '#B8D4F1',
}) => {
  const [gender, setGender] = useState(initialData.gender);
  const [lookingFor, setLookingFor] = useState<string[]>(initialData.lookingFor || ['Both']);

  const [isGenderTrayVisible, setGenderTrayVisible] = useState(false);
  const [isLookingForTrayVisible, setLookingForTrayVisible] = useState(false);

  const [genderInteracted, setGenderInteracted] = useState(false);
  const [lookingForInteracted, setLookingForInteracted] = useState(false);
  const [isContinuePressed, setIsContinuePressed] = useState(false);
  
  const { useButtonInteractions } = useInteractiveComponents();
  
  // Button refs for event management
  const genderButtonRef = useRef<any>(null);
  const lookingForButtonRef = useRef<any>(null);
  const continueButtonRef = useRef<any>(null);

  useEffect(() => {
    if (initialData.gender !== "Male") setGenderInteracted(true); // Default is Male
    if (initialData.lookingFor && initialData.lookingFor.length > 0 && !initialData.lookingFor.includes('Both')) {
      setLookingForInteracted(true);
    }
  }, [initialData]);

  // Cleanup effect to close any open popups when component unmounts
  useEffect(() => {
    return () => {
      setGenderTrayVisible(false);
      setLookingForTrayVisible(false);
    };
  }, []);


  const genders = ["Male", "Female", "Non-binary", "Other", "Prefer not to say"];


  const handleConfirmGender = (selectedGender: string) => {
    setGender(selectedGender);
    setGenderInteracted(true);
    setGenderTrayVisible(false);
  };

  const handleConfirmLookingFor = (selectedOptions: string[]) => {
    setLookingFor(selectedOptions);
    setLookingForInteracted(true);
    setLookingForTrayVisible(false);
  };

  const formatLookingForDisplay = (options: string[]): string => {
    if (options.includes('Both')) return 'Both Men & Women';
    if (options.length === 1) {
      const option = options[0];
      switch (option) {
        case 'Males': return 'Men';
        case 'Females': return 'Women';
        case 'Non-Binary': return 'Non-Binary People';
        case 'Transgender': return 'Transgender People';
        default: return option;
      }
    }
    if (options.length === 2) {
      const formatted = options.map(opt => {
        switch (opt) {
          case 'Males': return 'Men';
          case 'Females': return 'Women';
          case 'Non-Binary': return 'Non-Binary';
          case 'Transgender': return 'Transgender';
          default: return opt;
        }
      });
      return formatted.join(' & ');
    }
    return `${options.length} selected`;
  };

  const handleContinuePress = () => {
    // Close any open popup trays before navigating
    setGenderTrayVisible(false);
    setLookingForTrayVisible(false);
    onContinue({ gender, lookingFor });
  };

  // Set up managed button interactions
  const { pressProps: genderPressProps } = useButtonInteractions(genderButtonRef, {
    onPress: () => setGenderTrayVisible(true),
    hapticFeedback: true,
    analyticsEvent: 'profile_setup_gender_button_pressed',
    throttlePress: 300,
  });

  const { pressProps: lookingForPressProps } = useButtonInteractions(lookingForButtonRef, {
    onPress: () => setLookingForTrayVisible(true),
    hapticFeedback: true,
    analyticsEvent: 'profile_setup_looking_for_button_pressed',
    throttlePress: 300,
  });

  const { pressProps: continuePressProps } = useButtonInteractions(continueButtonRef, {
    onPress: handleContinuePress,
    onPressIn: () => setIsContinuePressed(true),
    onPressOut: () => setIsContinuePressed(false),
    hapticFeedback: true,
    analyticsEvent: 'profile_setup_continue_pressed',
    throttlePress: 500,
  });

  const progressPercentage =
    (overallStepsCompletedBeforeThisFlow / totalOverallOnboardingSteps) * 100 +
    (currentSubStepInFlow / totalSubStepsInFlow) * (1 / totalOverallOnboardingSteps) * 100;

  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 3 of 5</Text>
        <Text style={styles.mainTitle}>Profile Setup</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Tell us about yourself</Text>


              {/* Gender Button */}
              <Text style={styles.sectionTitle}>Gender</Text>
              <TouchableOpacity
                ref={genderButtonRef}
                style={[styles.selectionButton, { backgroundColor: genderInteracted ? "#B8D4F1" : "white" }]}
                activeOpacity={0.7}
                {...genderPressProps}
              >
                <View>
                  <Text style={[styles.buttonLabel, { color: genderInteracted ? "black" : "#555555" }]}>Your Gender</Text>
                  <Text style={[styles.buttonValue, { color: genderInteracted ? "black" : "black" }]}>{gender}</Text>
                </View>
                <Users size={24} color={genderInteracted ? "black" : "black"} />
              </TouchableOpacity>

              {/* Looking For Button */}
              <Text style={styles.sectionTitle}>Looking For</Text>
              <TouchableOpacity
                ref={lookingForButtonRef}
                style={[styles.selectionButton, { backgroundColor: lookingForInteracted ? "#B8D4F1" : "white" }]}
                activeOpacity={0.7}
                {...lookingForPressProps}
              >
                <View>
                  <Text style={[styles.buttonLabel, { color: lookingForInteracted ? "black" : "#555555" }]}>Who you want to meet</Text>
                  <Text style={[styles.buttonValue, { color: lookingForInteracted ? "black" : "black" }]}>
                    {formatLookingForDisplay(lookingFor)}
                  </Text>
                </View>
                <Users size={24} color={lookingForInteracted ? "black" : "black"} />
              </TouchableOpacity>

        {/* Continue Button */}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          ref={continueButtonRef}
          style={[
            styles.continueButton,
            {
              backgroundColor: isContinuePressed ? "#9FC4E7" : "#B8D4F1",
            },
          ]}
          {...continuePressProps}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {isGenderTrayVisible && (
        <GenderSelectionTray
          isVisible={isGenderTrayVisible}
          onClose={() => setGenderTrayVisible(false)}
          onConfirmGender={handleConfirmGender}
          initialGender={gender}
          genderOptions={genders}
        />
      )}

      {isLookingForTrayVisible && (
        <LookingForSelectionTray
          isVisible={isLookingForTrayVisible}
          onClose={() => setLookingForTrayVisible(false)}
          onConfirm={handleConfirmLookingFor}
          initialSelections={lookingFor}
        />
      )}
    </View>
  );
};

// IMPORTANT: Copy ALL relevant styles from ProfileSetupScreen.tsx here
// (styles.safeArea, styles.scrollView, styles.contentWrapper, styles.header, etc.)
// For brevity, I'm only showing a placeholder.
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
    fontSize: 14,
    color: 'black',
    opacity: 0.6,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555555",
    marginBottom: 40,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "black",
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectionButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    backgroundColor: "white",
    marginBottom: 20,
    minHeight: 70,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonLabel: {
    fontSize: 14,
    color: "#555555",
    marginBottom: 2,
  },
  buttonValue: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  continueButton: {
    backgroundColor: "#B8D4F1",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 0,
  },
  continueButtonText: {
    fontFamily: 'Geist-Regular',
    fontSize: 18,
    color: "black",
  },
});

export default ProfileSetupStep1Screen;
