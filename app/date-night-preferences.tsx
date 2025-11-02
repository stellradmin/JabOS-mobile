import React from "react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import DateNightPreferencesStepperFlow, { DateNightPreferences } from "../components/DateNightPreferencesStepperFlow";
import { useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";
import { Alert } from "react-native";
import { useDatingAppTracking } from "../src/hooks/usePerformanceMonitoring";
import { trackUserJourney } from "../src/lib/posthog-enhanced";
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

export default function DateNightPreferencesRoute() {
  const router = useRouter();
  const { user, refetchProfile } = useAuth();
  const { trackOnboardingAction } = useDatingAppTracking();
  const params = useLocalSearchParams<{ 
    name?: string;
    birthDate?: string;
    birthCity?: string;
    birthTime?: string;
    natalChart?: string;
    questionnaire?: string;
  }>();

  const handleComplete = async (preferences: DateNightPreferences) => {
    logDebug('Date night preferences complete called with', 'DATE_NIGHT_PREFS', preferences);

    if (!user) {
      Alert.alert("Error", "You must be logged in to continue.");
      return;
    }
    const userId = user.id;

    if (!preferences) {
      Alert.alert("Error", "No preferences received.");
      return;
    }

    try {
      // Verify user has completed previous steps
      // Check user data (birth_date) and profile data (display_name) 
      const [{ data: userData, error: userError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase.from('users').select('birth_date, questionnaire_responses').eq('id', userId).single(),
        supabase.from('profiles').select('display_name').eq('id', userId).single()
      ]);

      if (userError || profileError) {
        logError('Error fetching user/profile data:', "Error", userError || profileError);
        logWarn('Could not verify user data, "Warning", proceeding with date night preferences save');
      } else if (!profileData?.display_name || !userData?.birth_date) {
        Alert.alert("Error", "Please complete all previous onboarding steps first.");
        router.replace("/onboarding");
        return;
      }

      // Save date night preferences
      const { error: preferencesError } = await supabase
        .from('users')
        .update({
          date_night_preferences: preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (preferencesError) {
        logError('Error saving date night preferences:', "Error", preferencesError);
        throw preferencesError;
      }
      logDebug('Date night preferences saved successfully', 'DATE_NIGHT_PREFS');

      // Get current profile and user data to preserve actual onboarding info
      const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const { data: currentUser } = await supabase.from('users').select('*').eq('id', userId).single();
      
      let calculatedAge = currentProfile?.age || 25; // Use existing age or default
      if (params.birthDate || currentUser?.birth_date) {
        try {
          const birthDate = new Date(params.birthDate || currentUser.birth_date);
          const today = new Date();
          calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
        } catch(e) {
          logWarn('Could not calculate age', "Warning", e);
        }
      }

      // Preserve existing profile data while updating only necessary fields
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          display_name: currentProfile?.display_name || params.name || 'User',
          age: calculatedAge,
          gender: currentProfile?.gender || currentUser?.gender || 'Male',
          education_level: currentProfile?.education_level || 'Bachelor\'s Degree',
          politics: currentProfile?.politics || 'Moderate',
          is_single: currentProfile?.is_single ?? true,
          has_kids: currentProfile?.has_kids ?? false,
          wants_kids: currentProfile?.wants_kids || 'Maybe',
          traits: currentProfile?.traits?.length > 0 ? currentProfile.traits : null,
          interests: currentProfile?.interests?.length > 0 ? currentProfile.interests : null,
          avatar_url: currentProfile?.avatar_url, // Preserve existing avatar
          activity_preferences: preferences, // Save the date night preferences here
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileUpdateError) {
        logError('Error updating profile:', "Error", profileUpdateError);
        throw profileUpdateError;
      }
      logDebug('Profile completed successfully', "Debug");
      
      // Track final onboarding completion
      trackOnboardingAction('date_night_preferences_completed', 6, {
        zodiacPreferences: preferences.preferred_signs.length,
        activityPreferences: preferences.preferred_activities.length,
        maxDistance: preferences.distance_preference,
        totalSteps: 6,
        timestamp: new Date().toISOString()
      });
      
      // Track full onboarding completion with PostHog
      trackUserJourney.onboardingCompleted(
        Date.now(), // This should be the actual total time, but we'll use current timestamp
        6 // Total onboarding steps
      );

      await refetchProfile();
      router.replace("/onboarding-complete");

    } catch (error: any) {
      logError('Date night preferences error:', "Error", error);
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
      <DateNightPreferencesStepperFlow 
        onComplete={handleComplete} 
      />
    </>
  );
}
