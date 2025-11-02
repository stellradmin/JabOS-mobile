import React from "react";
import { Stack, useRouter } from "expo-router";
import QuestionnaireStepperFlow from "../components/QuestionnaireStepperFlow";
import { useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";
import { Alert } from "react-native";
import { useDatingAppTracking } from "../src/hooks/usePerformanceMonitoring";
import { logDebug, logError, logUserAction } from "../src/utils/logger";

interface QuestionnaireResult {
  question: string;
  answer: string;
}

interface QuestionnaireResponse {
  questionText: string;
  response: 'stronglyDisagree' | 'disagree' | 'neutral' | 'agree' | 'stronglyAgree';
  group: string;
}

export default function QuestionnaireRoute() {
  const router = useRouter();
  const { user, refetchProfile } = useAuth();
  const { trackOnboardingAction } = useDatingAppTracking();

  const handleGoBackToOnboarding = () => {
    router.replace('/onboarding');
  };

  const handleComplete = async (questionnaireResults?: QuestionnaireResult[], structuredResponses?: QuestionnaireResponse[]) => {
    logDebug('Questionnaire completion initiated', 'Questionnaire', {
      hasResults: !!questionnaireResults,
      resultsCount: questionnaireResults?.length,
      hasStructuredResponses: !!structuredResponses,
      structuredResponsesCount: structuredResponses?.length
    });
    
    if (!questionnaireResults || !structuredResponses) {
      Alert.alert("Error", "No questionnaire results received.");
      return;
    }
    
    if (!user) {
      Alert.alert("Error", "You must be logged in to continue.");
      return;
    }

    try {
      // Save questionnaire responses to database
      logDebug('Saving questionnaire responses to database', 'Questionnaire', {
        userId: user.id,
        responseCount: structuredResponses.length
      });
      
      const { error: questionnaireError } = await supabase
        .from('users')
        .update({
          questionnaire_responses: structuredResponses,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (questionnaireError) {
        logError('Failed to save questionnaire responses', 'Questionnaire', { userId: user.id }, questionnaireError);
        throw questionnaireError;
      }

      logDebug('Questionnaire responses saved successfully', 'Questionnaire', { userId: user.id });
      
      // Track questionnaire completion
      trackOnboardingAction('questionnaire_completed', 5, {
        questionsAnswered: structuredResponses.length,
        totalGroups: 5, // Based on your questionnaire structure
        questionnaire_responses: structuredResponses.length,
        timestamp: new Date().toISOString()
      });
      
      // Refresh user data to ensure it's up to date
      await refetchProfile();
      
      // Navigate to date night preferences - final step
      logUserAction('Navigate to date night preferences', 'Navigation', {
        from: 'questionnaire',
        responseCount: structuredResponses.length
      });
      router.replace({ 
        pathname: "/date-night-preferences", 
        params: { questionnaire: JSON.stringify(structuredResponses) },
      });

    } catch (error: any) {
      logError('Questionnaire completion failed', 'Questionnaire', { userId: user?.id }, error);
      Alert.alert("Error", error.message);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "card",
          gestureEnabled: true,
        }}
      />
      <QuestionnaireStepperFlow
        onComplete={handleComplete}
        onGoBackToOnboarding={handleGoBackToOnboarding}
      />
    </>
  );
}