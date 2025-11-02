import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { resolveFirstName } from '../../src/utils/displayName';
import { useMessaging } from '../../src/contexts/MessagingContext';
import { COLORS } from '../../constants/theme';
import MessagesCard from '../../components/messaging/MessagesCard';
import SchedulerCard from '../../components/messaging/SchedulerCard';
import CalendarModal from '../../components/messaging/CalendarModal';
import CleanConversationTray from '../../components/messaging/CleanConversationTray';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AnimatedTabScreenContainer from '../../components/navigation/AnimatedTabScreenContainer';


export default function MessengerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openConversationId?: string }>();
  const { profile, user } = useAuth();
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [showConversationTray, setShowConversationTray] = useState(false);

  const handleSchedulerPress = () => {
    setCalendarVisible(true);
  };

  const handleCloseCalendar = () => {
    setCalendarVisible(false);
  };

  const handleOpenConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowConversationTray(true);
  };

  // Open a specific conversation via route param (used when a match creates a conversation)
  useEffect(() => {
    if (params?.openConversationId && typeof params.openConversationId === 'string') {
      setSelectedConversationId(params.openConversationId);
      setShowConversationTray(true);
      // Clear the param after opening to avoid reopening on re-renders
      // Note: ignore errors in non-stacked contexts
      try { router.setParams({ openConversationId: undefined } as any); } catch {}
    }
  }, [params?.openConversationId]);

  return (
    <AnimatedTabScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Make status bar transparent so the pink header underneath shows with no white strip */}
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <View style={styles.container}>
          <View style={styles.blackBackground}>
            <View style={styles.scrollContainer}>
              {/* Top Section - Messages Block */}
              <MessagesCard
                userName={resolveFirstName(profile, user)}
                onConversationPress={handleOpenConversation}
              />

              {/* Bottom Section - Scheduler Block */}
              <SchedulerCard
                onSchedulerPress={handleSchedulerPress}
              />
            </View>
          </View>

          {/* Calendar Modal */}
          <CalendarModal
            visible={calendarVisible}
            onClose={handleCloseCalendar}
            onSelect={() => setCalendarVisible(false)}
          />

          {/* Conversation tray using shared PopUpTray affordance */}
          <CleanConversationTray
            visible={showConversationTray}
            onClose={() => { setShowConversationTray(false); setSelectedConversationId(''); }}
            conversationId={selectedConversationId}
          />
        </View>
      </SafeAreaView>
    </AnimatedTabScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.WHITE_CARD, // Keep status bar white
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD, // Ensure area beneath content is black
  },
  blackBackground: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD,
  },
  scrollContainer: {
    flex: 1,
    paddingTop: 0, // Remove top padding so card reaches top
    paddingBottom: 60, // Space for navigation bar (scheduler card will overlap)
    gap: 6, // Minimal spacing between cards
    zIndex: 5, // Ensure content layer is above navigation
    position: 'relative',
  },
  
});
