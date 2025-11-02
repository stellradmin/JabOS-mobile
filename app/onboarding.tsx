import React from "react";
import { Stack, useRouter } from "expo-router";
import { Alert } from "react-native";
import OnboardingStepperFlow from "../components/OnboardingStepperFlow";
import { useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";
import { uploadImageToSupabase, UploadResult } from "../src/services/photo-upload-service";
import { useDatingAppTracking } from "../src/hooks/usePerformanceMonitoring";
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import { validateBirthDate, calculateAgeFromBirthDate } from "../src/utils/birthDateValidation";

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refetchProfile } = useAuth();
  const { trackOnboardingAction } = useDatingAppTracking();

  const handleOnboardingComplete = async (data: any) => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to complete onboarding.");
      return;
    }

    try {
      logDebug('Starting onboarding completion process...', "Debug");
      
      // Step 1: Ensure user record exists first (with fallback)
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('ensure_user_exists', { user_id: user.id });
        if (rpcError) {
          logWarn('ensure_user_exists RPC failed, "Warning", will handle with upsert logic:', rpcError);
        } else if (rpcResult) {
          logDebug('ensure_user_exists completed successfully:', "Debug", rpcResult);
        }
      } catch (rpcErr) {
        logWarn('ensure_user_exists RPC call failed, "Warning", will handle with upsert logic:', rpcErr);
        // This is non-critical since we use upsert below anyway
      }

      // Step 2: Handle photo upload if present (with timeout)
      let photoUrl = null;
      if (data.photoUri) {
        try {
          logDebug('Uploading photo to Supabase:', "Debug", data.photoUri);
          
          // Add timeout to photo upload
          const uploadWithTimeout = Promise.race([
            uploadImageToSupabase(data.photoUri, user.id),
            new Promise<UploadResult>((_, reject) => 
              setTimeout(() => reject(new Error('Photo upload timeout')), 30000)
            )
          ]);
          
          const uploadResult = await uploadWithTimeout;
          
          if (uploadResult.success && uploadResult.url) {
            photoUrl = uploadResult.url;
            logDebug('Photo uploaded successfully:', "Debug", photoUrl);
          } else {
            logError('Photo upload failed:', "Error", uploadResult.error);
            // Continue without photo rather than failing
          }
        } catch (photoError) {
          logError('Error uploading photo:', "Error", photoError);
          // Continue without photo rather than failing
        }
      }

      // Step 3: Update user data (user record already created by ensure_user_exists)
      // Normalize birth date to a consistent display format before saving
      const normalizedBirth = data.birthDate
        ? validateBirthDate(data.birthDate)
        : { isValid: false } as any;

      const fallbackTime = data.birthTime && data.birthTime.trim() ? data.birthTime : '12:00 PM';
      const baseUserData = {
        birth_location: data.birthCity,
        birth_date: normalizedBirth.isValid ? normalizedBirth.normalizedDate : data.birthDate,
        birth_time: fallbackTime,
        looking_for: data.lookingFor || ['Both'],
        has_kids: data.hasKids,
        wants_kids: data.wantsKids,
        updated_at: new Date().toISOString()
      };

      const { data: updatedUser, error: userError } = await supabase
        .from('users')
        .update(baseUserData)
        .eq('id', user.id)
        .select();

      if (userError) {
        throw new Error(`Failed to update user data: ${userError.message}`);
      }
      if (!updatedUser || updatedUser.length === 0) {
        throw new Error('User record could not be updated. Please check permissions.');
      }
      logDebug('User data updated successfully', "Debug");

      // Step 4: Save extended profile data
      // Do not compute or set age here; DB trigger syncs profiles.age from users.birth_date

      const profileData = {
        id: user.id,
        display_name: data.name,
        gender: data.gender,
        avatar_url: photoUrl,
        current_city: data.currentCity,
        current_city_lat: data.currentCityCoords?.lat,
        current_city_lng: data.currentCityCoords?.lng,
        // age is computed server-side via trigger from users.birth_date
        updated_at: new Date().toISOString(),
        onboarding_completed: true
      };

      const { data: upsertedProfile, error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select();

      if (profileError) {
        throw new Error(`Failed to save profile data: ${profileError.message}`);
      }
      if (!upsertedProfile || upsertedProfile.length === 0) {
        throw new Error('Profile record could not be created or updated. Please check permissions.');
      }
      logDebug('Profile data saved successfully', "Debug");

      // Step 5: Generate natal chart. Prefer secure Edge Function. Fallback to client-side generator if it fails.
      if (data.birthDate && data.birthCity) {
        let edgeFnOk = false;
        const payload = {
            fullName: data.name,
            publicImageUrl: photoUrl,
            birthInfo: {
              date: normalizedBirth.isValid ? normalizedBirth.normalizedDate : data.birthDate,
              city: data.birthCity,
              time: fallbackTime
            },
            deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            questionnaireResults: [],
            profileSetupData: {
              gender: data.gender,
              age: 25, // fallback only for analytics; profiles.age comes from DB trigger
              educationLevel: data.educationLevel,
              politics: data.politics,
              isSingle: true,
              hasKids: false,
              wantsKids: 'Maybe',
              traits: [],
              interests: []
            }
          };

          try {
          const { error: fnError } = await supabase.functions.invoke('complete-onboarding-profile', {
            body: payload
          });
          if (!fnError) edgeFnOk = true;
          if (fnError) {
            logWarn('complete-onboarding-profile invoke warning (non-blocking)', "Warning", fnError);
          }
        } catch (fnErr) {
          logWarn('complete-onboarding-profile call failed (non-blocking)', "Warning", fnErr);
        }

        // Accuracy-first: if edge function failed, schedule a single retry and do not save approximate charts
        if (!edgeFnOk) {
          setTimeout(async () => {
            try {
              const retry = await supabase.functions.invoke('complete-onboarding-profile', { body: payload });
              if (retry.error) {
                logWarn('complete-onboarding-profile retry still failing (accuracy-first, no fallback chart)', "Warning", retry.error);
              } else {
                logDebug('complete-onboarding-profile retry succeeded', "Debug");
              }
            } catch (retryErr) {
              logWarn('complete-onboarding-profile retry call error', "Warning", retryErr);
            }
          }, 1500);
        }
      }

      // Step 6: Track completion
      try {
        trackOnboardingAction('profile_creation_completed', 4, {
          hasPhoto: !!photoUrl,
          hasAstrologyData: false, // Will be updated async
          hasEducation: !!data.educationLevel,
          hasPolitics: !!data.politics,
          totalSteps: 4,
          timestamp: new Date().toISOString()
        });
      } catch (trackingError) {
        logWarn('Tracking error (non-blocking, "Warning"):', trackingError);
      }
      
      // Step 7: Refresh profile and navigate
      try {
        await refetchProfile();
      } catch (refetchError) {
        logWarn('Profile refetch error (non-blocking, "Warning"):', refetchError);
      }
      
      logDebug('Onboarding completion successful, "Debug", navigating...');
      
      // Navigate to questionnaire stepper
      router.replace({
        pathname: "/questionnaire",
        params: { 
          name: data.name,
          birthDate: data.birthDate,
          birthCity: data.birthCity,
          birthTime: data.birthTime,
        },
      });
    } catch (error: any) {
      logError('Error completing onboarding:', "Error", error);
      Alert.alert(
        "Onboarding Error", 
        error.message || "Failed to complete onboarding. Please try again.",
        [
          { text: "OK", style: "default" }
        ]
      );
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
      <OnboardingStepperFlow onComplete={handleOnboardingComplete} />
    </>
  );
}
