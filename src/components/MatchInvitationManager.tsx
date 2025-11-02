import React, { useState, useEffect } from 'react';
import { Modal } from 'react-native';
import * as Notifications from 'expo-notifications';
import MatchReceptionContent, { PotentialMatchProfile } from '../../components/MatchReceptionContent';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
// Removed useEventListeners - using Expo Notifications API directly

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

interface MatchInvitationManagerProps {
  children: React.ReactNode;
}

const MatchInvitationManager: React.FC<MatchInvitationManagerProps> = ({ children }) => {
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [invitationMatch, setInvitationMatch] = useState<PotentialMatchProfile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  
  // Use our enhanced event listener management
  // Remove useEventListeners as Expo Notifications has its own subscription model
  // const { addReactNativeEventListener, createEventGroup } = useEventListeners();

  // Register for push notifications and update profile
  const registerPushToken = async () => {
    if (!user) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        logWarn('Failed to get push token for push notification!', "Warning");
        return;
      }
      
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      logDebug('Push token obtained:', "Debug", token);
      
      // Update user profile with push token
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        logError('Error updating push token:', "Error", {
          ...error,
          userId: user.id,
          context: 'Failed to update push_token in profiles table',
          hint: error.code === '42501' ? 'RLS policy may be blocking this update' : undefined
        });
      } else {
        logDebug('Push token updated in profile', "Debug");
      }
    } catch (error) {
      logError('Error registering push token:', "Error", error);
    }
  };

  // Define handler before subscribing
  const handleMatchInvitation = async (matchId: string) => {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('user1_id, user2_id, conversation_id')
        .eq('id', matchId)
        .single();

      if (matchError || !matchData) {
        logError('Error fetching match:', "Error", matchError);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const otherUserId = matchData.user1_id === user.id ? matchData.user2_id : matchData.user1_id;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, zodiac_sign')
        .eq('id', otherUserId)
        .single();

      if (profileError || !profileData) {
        logError('Error fetching profile:', "Error", profileError);
        return;
      }

      const matchProfile: PotentialMatchProfile = {
        id: profileData.id,
        display_name: profileData.display_name,
        avatar_url: profileData.avatar_url,
        bio: profileData.bio,
        zodiac_sign: profileData.zodiac_sign,
        compatibility_score: 85,
        astrological_grade: 'A',
        questionnaire_grade: 'A',
        overall_score: 85,
        is_match_recommended: true
      };

      setInvitationMatch(matchProfile);
      setConversationId(matchData.conversation_id);
      setShowMatchPopup(true);
    } catch (error) {
      logError('Error handling match invitation:', "Error", error);
    }
  };

  useEffect(() => {
    // Register push token when user is available
    if (user) {
      registerPushToken();
    }
  }, [user]);

  useEffect(() => {
    // Set up Expo Notifications listeners directly
    const notificationListener = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      
      if (data?.type === 'new_match' && data?.matchId) {
        // Fetch the other user's profile to show in popup
        await handleMatchInvitation(String(data.matchId));
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      
      if (data?.type === 'new_match' && data?.matchId) {
        // Fetch the other user's profile to show in popup
        await handleMatchInvitation(String(data.matchId));
      }
    });

    // Cleanup listeners on unmount
    return () => {
      try { (notificationListener as any)?.remove?.(); } catch {}
      try { (responseListener as any)?.remove?.(); } catch {}
    };
  }, [user]);

  const handleAcceptMatch = async (targetUserId: string, sourceRequestId: string) => {
    try {
      logDebug('Accepting match invitation', "Debug", { targetUserId, sourceRequestId });
      logUserAction('Match invitation accepted', 'MatchInvitation', { targetUserId, sourceRequestId });

      // CRITICAL FIX: Call the backend to actually confirm the match
      const { default: CompatibilityMatchingService } = await import('../services/compatibility-matching-service');
      const result = await CompatibilityMatchingService.confirmMatch(
        targetUserId,
        sourceRequestId
      );

      if (result.success && result.conversation_id) {
        logDebug('Match confirmed successfully', "Debug", {
          matchId: result.match_id,
          conversationId: result.conversation_id
        });

        // Close the popup and clear state
        setShowMatchPopup(false);
        setInvitationMatch(null);
        setConversationId(null);

        // Navigate to the newly created conversation
        router.push(`/conversation?conversationId=${result.conversation_id}` as any);
      } else {
        throw new Error(result.error || 'Failed to confirm match');
      }
    } catch (error) {
      logError('Error accepting match invitation:', "Error", error);

      // Show user-friendly error without breaking the flow
      const { Alert } = await import('react-native');
      Alert.alert(
        'Unable to Accept Match',
        'We encountered an error while confirming your match. Please try again.',
        [
          { text: 'OK', style: 'cancel' }
        ]
      );

      // Don't close the popup on error - let user retry
    }
  };

  const handleDeclineMatch = () => {
    // For matches that are already created, we can't really "decline"
    // Just close the popup
    setShowMatchPopup(false);
    setInvitationMatch(null);
    setConversationId(null);
  };

  return (
    <>
      {children}
      
      {/* Match Invitation Popup - Uses exact same UI as date night matches */}
      <Modal
        visible={showMatchPopup}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMatchPopup(false)}
      >
        {invitationMatch && (
          <MatchReceptionContent
            mode="potential"
            potentialMatchProfile={invitationMatch}
            sourceMatchRequestId="match-invitation"
            onAcceptPotentialMatch={handleAcceptMatch}
            onDecline={handleDeclineMatch}
            onViewCompatibility={() => {
              logDebug('View compatibility for match invitation', "Debug");
            }}
            dateActivity="Match"
            currentMatchIndex={0}
            totalMatches={1}
          />
        )}
      </Modal>
    </>
  );
};

export default MatchInvitationManager;
