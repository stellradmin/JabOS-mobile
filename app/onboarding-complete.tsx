import React from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";
import { Alert } from "react-native";
import { logDebug, logError, logUserAction } from "../src/utils/logger";

export default function OnboardingCompleteRoute() {
  const router = useRouter();
  const { refetchProfile, profile, user } = useAuth();

  const handleStartExploring = async () => {
    try {
      logUserAction('Start exploring button pressed', 'Onboarding', {
        userId: user?.id,
        currentOnboardingStatus: profile?.onboarding_completed
      });
      
      if (!user) {
        logError('No user found during onboarding completion', 'Onboarding');
        Alert.alert("Error", "No user session found. Please sign in again.");
        router.replace("/welcome");
        return;
      }
      
      // First, let's ensure the profile exists and is marked as completed
      logDebug('Checking profile completion status', 'Onboarding', { userId: user.id });
      const { data: profileCheck, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (checkError || !profileCheck) {
        logError('Profile check failed during onboarding completion', 'Onboarding', { userId: user.id }, checkError);
        
        // If profile doesn't exist, we need to go back to onboarding
        if (checkError?.code === 'PGRST116') {
          logDebug('No profile found, redirecting to onboarding', 'Onboarding', { userId: user.id });
          Alert.alert("Profile Setup Required", "Please complete your onboarding first.");
          router.replace("/onboarding");
          return;
        }
      }
      
      // If profile exists but onboarding is not completed, update it
      if (profileCheck && !profileCheck.onboarding_completed) {
        logDebug('Updating profile onboarding status', 'Onboarding', { userId: user.id });
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          logError('Failed to update profile onboarding status', 'Onboarding', { userId: user.id }, updateError);
          throw updateError;
        }
      }
      
      // Refresh user data to ensure onboarding_completed is reflected
      logDebug('Refetching profile after onboarding completion', 'Onboarding', { userId: user.id });
      await refetchProfile();
      
      logUserAction('Navigate to dashboard after onboarding completion', 'Navigation', { userId: user.id });
      router.replace("/(tabs)/dashboard");
      
    } catch (error: any) {
      logError('Onboarding completion failed', 'Onboarding', { userId: user?.id }, error);
      Alert.alert("Error", "Failed to complete setup. Please try again.");
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
      <View style={styles.container}>
        {/* Header - outside the card like other onboarding screens */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Congrats</Text>
          <Text style={styles.subtitle}>You're now ready to start matching</Text>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          {/* Header section with colored background */}
          <View style={[styles.header, { backgroundColor: '#C8A8E9' }]}>
            <Text style={styles.mainTitle}>Welcome to Stellr!</Text>
          </View>

          <View style={styles.content}>
            {/* Success Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.checkCircle}>
                <Check size={48} color="white" strokeWidth={3} />
              </View>
            </View>
            <Text style={styles.congratsSubtitle}>
              Your profile is complete and you're ready to discover meaningful connections.
            </Text>

            {/* What's Next Section */}
            <View style={styles.nextStepsContainer}>
              <Text style={styles.nextStepsTitle}>What happens next:</Text>
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Browse potential matches based on your preferences</Text>
              </View>
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Send and receive date proposals</Text>
              </View>
              <View style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Connect with compatible partners</Text>
              </View>
            </View>

            {/* Complete Button */}
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleStartExploring}
            >
              <Text style={styles.completeButtonText}>
                Start Exploring
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Navy background
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 90,
  },
  titleContainer: {
    marginBottom: 26,
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
  card: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 2,
    borderTopColor: 'black',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  content: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  congratsSubtitle: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 32,
    lineHeight: 22,
  },
  nextStepsContainer: {
    backgroundColor: '#e5e5e5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'black',
  },
  nextStepsTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: 'black',
    marginBottom: 16,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bullet: {
    fontSize: 16,
    color: 'black',
    marginRight: 8,
    fontWeight: 'bold',
  },
  bulletText: {
    fontSize: 16,
    color: 'black',
    flex: 1,
    lineHeight: 22,
  },
  completeButton: {
    backgroundColor: "#C8A8E9",
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
  },
  completeButtonText: {
    fontFamily: 'Geist-Regular',
    fontSize: 18,
    color: "black",
  },
});