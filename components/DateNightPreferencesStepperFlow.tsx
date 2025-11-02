import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Stepper, { Step, StepperHandle } from './Stepper';
import ZodiacPreferencesStep from './ZodiacPreferencesStep';
import ActivityPreferencesStep from './ActivityPreferencesStep';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface DateNightPreferences {
  preferred_signs: string[];           // e.g., ["Leo", "Taurus"]
  preferred_activities: string[];      // e.g., ["Coffee", "Dinner"]
  availability: {
    weekdays: boolean;
    weekends: boolean;
    preferred_times: ("morning"|"afternoon"|"evening")[];
  };
  distance_preference: number;         // miles
}

interface DateNightPreferencesStepperFlowProps {
  onComplete: (preferences: DateNightPreferences) => void;
}

const DateNightPreferencesStepperFlow: React.FC<DateNightPreferencesStepperFlowProps> = ({ onComplete }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const stepperRef = useRef<StepperHandle>(null);

  // State for collected preferences
  const [preferences, setPreferences] = useState<DateNightPreferences>({
    preferred_signs: [],
    preferred_activities: [],
    availability: { weekdays: true, weekends: true, preferred_times: ['evening'] },
    distance_preference: 25,
  });

  const handleZodiacPreferencesComplete = (preferredSign: string) => {
    const updatedPreferences: DateNightPreferences = {
      ...preferences,
      preferred_signs: preferredSign && preferredSign !== 'Any' ? [preferredSign] : [],
    };
    setPreferences(updatedPreferences);
    
    // Move to next step (activity preferences)
    stepperRef.current?.next();
  };

  const handleActivityPreferencesComplete = (preferredActivity: string) => {
    const finalPreferences: DateNightPreferences = {
      ...preferences,
      preferred_activities: preferredActivity && preferredActivity !== 'Any' ? [preferredActivity] : [],
    };
    setPreferences(finalPreferences);
    
    // Complete the flow
    onComplete(finalPreferences);
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const getStepBackgroundColor = (step: number) => {
    // Use purple theme for date night preferences
    return '#C8A8E9'; // Purple for all date night preference steps
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentStep > 1) {
              stepperRef.current?.back();
            } else {
              router.back();
            }
          }}
        >
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Date Night Preferences</Text>
        <Text style={styles.subtitle}>Tell us what you're looking for</Text>
        <Text style={styles.stepIndicator}>
          Step {currentStep} of 2
        </Text>
      </View>

      {/* Main Card */}
      <Stepper
        key="date-night-preferences"
        ref={stepperRef}
        initialStep={currentStep}
        onStepChange={handleStepChange}
        onFinalStepCompleted={() => onComplete(preferences)}
        backButtonText="Back"
        nextButtonText="Continue"
      >
        <Step>
          <ZodiacPreferencesStep
            preferredSign={preferences.preferred_signs[0] || 'Any'}
            onComplete={handleZodiacPreferencesComplete}
            backgroundColor={getStepBackgroundColor(1)}
          />
        </Step>
        <Step>
          <ActivityPreferencesStep
            preferredActivity={preferences.preferred_activities[0] || 'Any'}
            onComplete={handleActivityPreferencesComplete}
            backgroundColor={getStepBackgroundColor(2)}
          />
        </Step>
      </Stepper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Navy background
    paddingHorizontal: 16,
    paddingTop: 48,
    // Bottom padding set dynamically via insets
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  titleContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
  },
  stepIndicator: {
    fontSize: 14,
    color: 'white',
    opacity: 0.8,
    marginTop: 4,
  },
});

export default DateNightPreferencesStepperFlow;
