import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CompatibilityScreenContent from './CompatibilityScreenContent';
import MatchCard from './MatchCard';
import { Alert } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

// Define PotentialMatchProfile type
export interface PotentialMatchProfile {
  id: string; // target_user_id
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  zodiac_sign?: string | null;
  compatibility_score?: number;
  astrological_grade?: string;
  questionnaire_grade?: string;
  overall_score?: number;
  is_match_recommended?: boolean;
  // Add other fields from get-potential-matches EF as needed for display
}

interface MatchReceptionContentProps {
  mode: 'potential' | 'confirmed' | 'compatibility';
  potentialMatchProfile?: PotentialMatchProfile | null;
  sourceMatchRequestId?: string;
  
  userName?: string; // For confirmed match
  userImage?: string | null; // For confirmed match

  // Compatibility mode props
  compatibilityMatch?: {
    id: string;
    compatibility_score: number;
    other_user: {
      id: string;
      name: string;
      avatar_url?: string;
      age: number;
      interests: string[];
      traits: string[];
    };
  };

  onConnectInChat?: () => void; // For confirmed match
  onViewCompatibility?: () => void; // For both, but context might differ
  onDecline: () => void; // For both
  onCoffeeDate?: () => void; // For confirmed match

  onAcceptPotentialMatch?: (targetUserId: string, sourceRequestId: string) => Promise<void>; // For potential mode
  onAcceptCompatibilityMatch?: (matchId: string) => Promise<void>; // For compatibility mode
  
  dateActivity?: string; // For enhanced card display
  currentMatchIndex?: number;
  totalMatches?: number;
  
  // Navigation props
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

const MatchReceptionContent: React.FC<MatchReceptionContentProps> = ({
  mode,
  potentialMatchProfile,
  sourceMatchRequestId,
  userName = "Sarah", // Default for confirmed, will be overridden in potential mode
  userImage,
  compatibilityMatch,
  onConnectInChat,
  onViewCompatibility,
  onDecline,
  onCoffeeDate,
  onAcceptPotentialMatch,
  onAcceptCompatibilityMatch,
  dateActivity = "Coffee",
  currentMatchIndex = 0,
  totalMatches = 1,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}) => {
  const [showCompatibility, setShowCompatibility] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const displayUserName = mode === 'potential' 
    ? potentialMatchProfile?.display_name 
    : mode === 'compatibility' 
      ? compatibilityMatch?.other_user.name 
      : userName;
  const displayUserImage = mode === 'potential' 
    ? potentialMatchProfile?.avatar_url 
    : mode === 'compatibility' 
      ? compatibilityMatch?.other_user.avatar_url 
      : userImage;
  // currentUserIdForCompatibility is used to pass to CompatibilityScreenContent if it's shown
  const userIdForCompatibilityCheck = mode === 'potential' 
    ? potentialMatchProfile?.id 
    : mode === 'compatibility' 
      ? compatibilityMatch?.other_user.id 
      : userName;


  // This function is called when the "View Compatibility" button within this component is pressed.
  // It sets the local state to show the CompatibilityScreenContent.
  const internalHandleShowCompatibility = () => { 
    if (userIdForCompatibilityCheck) {
        setShowCompatibility(true);
    } else {
        logWarn("User ID for compatibility view is missing.", "Warning");
    }
  };

  // The onViewCompatibility prop is passed from the parent.
  // If the parent wants to trigger compatibility view (e.g. from an external button), it calls this.
  // However, the current design has the button inside this component.
  // For now, let's assume the onViewCompatibility prop is meant to be the action for the button inside this component.
  // So, the button's onPress should call internalHandleShowCompatibility.
  // The prop onViewCompatibility itself is not directly used to set state here, but rather passed to the button.
  // Let's simplify: the button directly calls internalHandleShowCompatibility.
  // The prop `onViewCompatibility` from parent is effectively unused if the button is internal.
  // If the parent needs to control this, it would manage `showCompatibility` state itself and pass it as a prop.
  // For now, keeping it simple: button press toggles internal state.

  const handleAccept = async () => {
    if (mode === 'potential' && potentialMatchProfile && sourceMatchRequestId && onAcceptPotentialMatch) {
      setIsAccepting(true);
      try {
        await onAcceptPotentialMatch(potentialMatchProfile.id, sourceMatchRequestId);
      } catch (e: any) {
        Alert.alert("Error", e.message || "Could not accept match.");
      } finally {
        setIsAccepting(false);
      }
    } else if (mode === 'compatibility' && compatibilityMatch && onAcceptCompatibilityMatch) {
      setIsAccepting(true);
      try {
        await onAcceptCompatibilityMatch(compatibilityMatch.id);
      } catch (e: any) {
        Alert.alert("Error", e.message || "Could not accept compatibility match.");
      } finally {
        setIsAccepting(false);
      }
    }
  };

  if (showCompatibility) {
    if (!userIdForCompatibilityCheck) { // Corrected variable name
        // This case should ideally be prevented by internalHandleShowCompatibility logic
        logWarn("User ID for compatibility view is missing when trying to render CompatibilityScreenContent.", "Warning");
        return <View><Text>Error: Compatibility details unavailable.</Text></View>;
    }
    return (
      <CompatibilityScreenContent
        matchUserId={userIdForCompatibilityCheck} // Pass the actual user ID
        userName={displayUserName || "User"} 
        onBack={() => setShowCompatibility(false)}
        onConnectInChat={onConnectInChat || (() => {})}
        onDecline={onDecline} 
      />
    );
  }



  logDebug('🏛️ Rendering Match Card View for mode:', "Debug", mode, 'profile:', potentialMatchProfile?.display_name);

  // Convert data to MatchCard format
  const matchProfile = {
    id: mode === 'potential' 
      ? potentialMatchProfile?.id || '' 
      : mode === 'compatibility' 
        ? compatibilityMatch?.other_user.id || ''
        : userName || '',
    display_name: displayUserName,
    avatar_url: displayUserImage,
    bio: mode === 'potential' 
      ? potentialMatchProfile?.bio 
      : null,
    age: mode === 'compatibility' 
      ? compatibilityMatch?.other_user.age 
      : undefined,
    interests: mode === 'compatibility' 
      ? compatibilityMatch?.other_user.interests 
      : undefined,
    traits: mode === 'compatibility' 
      ? compatibilityMatch?.other_user.traits 
      : undefined,
  };

  const compatibilityScore = mode === 'compatibility' 
    ? compatibilityMatch?.compatibility_score 
    : undefined;

  return (
    <View style={styles.matchCardContainer}>
      <MatchCard
        profile={matchProfile}
        compatibilityScore={compatibilityScore}
        astrologicalGrade={potentialMatchProfile?.astrological_grade}
        questionnaireGrade={potentialMatchProfile?.questionnaire_grade}
        onAccept={handleAccept}
        onPass={onDecline}
        onViewCompatibility={internalHandleShowCompatibility}
        onNext={onNext}
        onPrevious={onPrevious}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        dateActivity={dateActivity}
        zodiacSign={potentialMatchProfile?.zodiac_sign ?? undefined}
        currentMatchIndex={currentMatchIndex}
        totalMatches={totalMatches}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  matchCardContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});

export default MatchReceptionContent;
