import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Stepper, { Step, StepperHandle } from './Stepper';
import NameInfoScreen from './NameInfoScreen';
import BirthInfoScreen from './BirthInfoScreen';
import ProfileSetupStep1Screen from './ProfileSetupStep1Screen';
import ProfilePhotoScreen from './ProfilePhotoScreen';
import ProfileSetupStep2Screen from './ProfileSetupStep2Screen';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

interface OnboardingData {
  name: string;
  birthCity: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  photoUri: string | null;
  lookingFor: string[];
  currentCity: string;
  currentCityCoords: { lat: number; lng: number } | null;
  hasKids: boolean;
  wantsKids: string;
}

interface OnboardingStepperFlowProps {
  onComplete: (data: OnboardingData) => void;
}

const OnboardingStepperFlow: React.FC<OnboardingStepperFlowProps> = ({ onComplete }) => {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepperRef = useRef<StepperHandle>(null);
  
  // Responsive padding based on screen size
  const getResponsivePadding = () => {
    if (screenWidth < 375) {
      // Small screens (iPhone SE)
      return {
        horizontal: 12,
        top: 40,
        bottom: 80,
      };
    } else if (screenWidth > 414) {
      // Large screens 
      return {
        horizontal: 24,
        top: 60,
        bottom: 100,
      };
    } else {
      // Standard screens
      return {
        horizontal: 16,
        top: 48,
        bottom: 90,
      };
    }
  };
  
  const padding = getResponsivePadding();

  // State for collected data
  const [nameData, setNameData] = useState({ name: '', birthCity: '' });
  const [birthData, setBirthData] = useState({
    birthDate: '',
    birthTime: ''
  });
  const [profileStep1Data, setProfileStep1Data] = useState({
    gender: 'Male',
    lookingFor: ['Both'] as string[]
  });
  const [photoData, setPhotoData] = useState({
    photoUri: null as string | null
  });
  const [profileStep2Data, setProfileStep2Data] = useState({
    currentCity: "",
    currentCityCoords: null as { lat: number; lng: number } | null,
    hasKids: false,
    wantsKids: "Maybe"
  });

  const handleNameComplete = (data: { name: string; birthCity: string }) => {
    setNameData(data);
    stepperRef.current?.next();
  };

  const handleBirthComplete = (data: { birthDate: string; birthTime: string }) => {
    setBirthData(data);
    stepperRef.current?.next();
  };

  const handleProfileStep1Complete = (data: { gender: string; lookingFor: string[] }) => {
    setProfileStep1Data(data);
    stepperRef.current?.next();
  };

  const handlePhotoComplete = (data: { photoUri: string | null }) => {
    setPhotoData(data);
    stepperRef.current?.next();
  };

  const handleProfileStep2Complete = async (data: {
    currentCity: string;
    currentCityCoords: { lat: number; lng: number } | null;
    hasKids: boolean;
    wantsKids: string;
  }) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setProfileStep2Data(data);

      // This completes the onboarding flow - compile all data
      const allData: OnboardingData = {
        ...nameData,
        ...birthData,
        ...profileStep1Data,
        ...photoData,
        ...data
      };

      await onComplete(allData);
    } catch (error) {
      logError('Error completing onboarding:', "Error", error);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const getStepBackgroundColor = (step: number) => {
    switch (step) {
      case 1:
        return '#B8D4F1'; // Name info - baby blue color
      case 2:
        return '#B8D4F1'; // Birth info - baby blue color
      case 3:
        return '#B8D4F1'; // Profile step 1 - baby blue color
      case 4:
        return '#B8D4F1'; // Photo + Verification - baby blue color
      case 5:
        return '#B8D4F1'; // Profile step 2 - baby blue color
      default:
        return '#ffffff';
    }
  };

  return (
    <View style={[
      styles.container,
      {
        paddingHorizontal: padding.horizontal,
        paddingTop: padding.top,
        paddingBottom: padding.bottom,
      }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            logDebug('OnboardingStepperFlow - Back button pressed, "Debug", currentStep:', currentStep);
            if (currentStep > 1) {
              logDebug('OnboardingStepperFlow - Going back to previous step in stepper', "Debug");
              stepperRef.current?.back();
            } else {
              logDebug('OnboardingStepperFlow - Going back to previous screen with router.back(, "Debug")');
              router.back();
            }
          }}
        >
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Onboarding</Text>
        <Text style={styles.subtitle}>Complete your profile to get started</Text>
      </View>

      {/* Main Card */}
      <Stepper
        ref={stepperRef}
        initialStep={currentStep}
        onStepChange={handleStepChange}
        backButtonText="Back"
        nextButtonText="Continue"
      >
        <Step>
          <NameInfoScreen
            onContinue={handleNameComplete}
            initialData={nameData}
            hideProgressBar={true}
            hideBackButton={true}
            backgroundColor={getStepBackgroundColor(1)}
          />
        </Step>
        
        <Step>
          <BirthInfoScreen
            onContinue={handleBirthComplete}
            initialData={birthData}
            hideProgressBar={true}
            hideBackButton={true}
            backgroundColor={getStepBackgroundColor(2)}
          />
        </Step>
        
        <Step>
          <ProfileSetupStep1Screen
            initialData={profileStep1Data}
            onContinue={handleProfileStep1Complete}
            onBack={() => stepperRef.current?.back()}
            currentSubStepInFlow={1}
            overallStepsCompletedBeforeThisFlow={2}
            totalSubStepsInFlow={1}
            totalOverallOnboardingSteps={5}
            hideProgressBar={true}
            hideBackButton={true}
            backgroundColor={getStepBackgroundColor(3)}
          />
        </Step>
        
        <Step>
          <ProfilePhotoScreen
            initialData={photoData}
            onContinue={handlePhotoComplete}
            onBack={() => stepperRef.current?.back()}
            currentSubStepInFlow={1}
            overallStepsCompletedBeforeThisFlow={3}
            totalSubStepsInFlow={1}
            totalOverallOnboardingSteps={5}
            hideProgressBar={true}
            hideBackButton={true}
            backgroundColor={getStepBackgroundColor(4)}
          />
        </Step>

        <Step>
          <ProfileSetupStep2Screen
            initialData={profileStep2Data}
            onContinue={handleProfileStep2Complete}
            onBack={() => stepperRef.current?.back()}
            currentSubStepInFlow={1}
            overallStepsCompletedBeforeThisFlow={4}
            totalSubStepsInFlow={1}
            totalOverallOnboardingSteps={5}
            hideProgressBar={true}
            hideBackButton={true}
            backgroundColor={getStepBackgroundColor(5)}
          />
        </Step>
      </Stepper>

      {/* Loading Overlay */}
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#B8D4F1" />
            <Text style={styles.loadingText}>Setting up your profile...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Navy background like date night
    // Padding now applied dynamically via responsive logic
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: 'black',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default OnboardingStepperFlow;
