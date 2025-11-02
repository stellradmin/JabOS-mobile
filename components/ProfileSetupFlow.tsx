import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import ProfileSetupStep1Screen from './ProfileSetupStep1Screen';
import ProfileSetupStep2Screen from './ProfileSetupStep2Screen';
import ProfileSetupStep3Screen from './ProfileSetupStep3Screen';

// Define the comprehensive ProfileData interface here
export interface ProfileSetupData {
  age: string;
  gender: string;
  educationLevel: string;
  politics: string;
  isSingle: boolean;
  hasKids: boolean;
  wantsKids: string;
  traits: string[];
  interests: string[];
  photoUri: string | null;
}

interface ProfileSetupFlowProps {
  onComplete: (profileData: ProfileSetupData) => void;
  initialData: Partial<ProfileSetupData>; // Accept initial data
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const TOTAL_ONBOARDING_STEPS = 4; // Name info, birth info, questionnaire, profile setup
const OVERALL_STEPS_COMPLETED_BEFORE_THIS_FLOW = 3; // Name info, birth info, and questionnaire completed
const TOTAL_SUB_STEPS_IN_THIS_FLOW = 3; // Three steps: age/gender/photo, education/politics, relationship/traits

const ProfileSetupFlow: React.FC<ProfileSetupFlowProps> = ({ 
  onComplete, 
  initialData, 
  hideProgressBar = false, 
  hideBackButton = false,
  backgroundColor = '#F2BAC9'
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1); // Start at step 1: age/gender/photo
  const [profileData, setProfileData] = useState<ProfileSetupData>({
    age: initialData.age || "25",
    gender: initialData.gender || "Male",
    photoUri: initialData.photoUri || null,
    educationLevel: "Bachelor's Degree",
    politics: "Not Political",
    isSingle: true,
    hasKids: false,
    wantsKids: "Maybe",
    traits: [],
    interests: [],
  });

  const handleNextStep1 = (data: Partial<ProfileSetupData>) => {
    setProfileData(prev => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleNextStep2 = (data: Partial<ProfileSetupData>) => {
    setProfileData(prev => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  const handleCompleteStep3 = (data: Partial<ProfileSetupData>) => {
    const finalData = { ...profileData, ...data };
    setProfileData(finalData);
    onComplete(finalData);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/questionnaire'); // Go back to questionnaire
      }
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const commonStepProps = {
    overallStepsCompletedBeforeThisFlow: OVERALL_STEPS_COMPLETED_BEFORE_THIS_FLOW,
    totalSubStepsInFlow: TOTAL_SUB_STEPS_IN_THIS_FLOW,
    totalOverallOnboardingSteps: TOTAL_ONBOARDING_STEPS,
    onBack: handleBack,
    hideProgressBar,
    hideBackButton,
    backgroundColor,
  };

  if (currentStep === 1) {
    return (
      <ProfileSetupStep1Screen
        initialData={{
          gender: (profileData as any).gender || '',
          lookingFor: (profileData as any).lookingFor || ['Both'],
        }}
        onContinue={handleNextStep1}
        currentSubStepInFlow={1}
        {...commonStepProps}
      />
    );
  }

  if (currentStep === 2) {
    return (
      <ProfileSetupStep2Screen
        initialData={{
          currentCity: (profileData as any).currentCity || '',
          currentCityCoords: (profileData as any).currentCityCoords || null,
          hasKids: (profileData as any).hasKids || false,
          wantsKids: (profileData as any).wantsKids || 'Maybe',
        }}
        onContinue={handleNextStep2}
        currentSubStepInFlow={2}
        {...commonStepProps}
      />
    );
  }

  if (currentStep === 3) {
    return (
      <ProfileSetupStep3Screen
        initialData={{
          traits: (profileData as any).traits || [],
          interests: (profileData as any).interests || [],
        }}
        onContinue={handleCompleteStep3}
        currentSubStepInFlow={3}
        {...commonStepProps}
      />
    );
  }

  return null; // Should not happen
};

export default ProfileSetupFlow;
