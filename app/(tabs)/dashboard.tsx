import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { resolveFirstName } from "../../src/utils/displayName";
import { useMessaging } from "../../src/contexts/MessagingContext";
import { COLORS } from '../../constants/theme';
import RotatingZodiacCard from '../../components/dashboard/RotatingZodiacCard';
import DateActivityCard from '../../components/dashboard/DateActivityCard';
import MatchProgressCard from '../../components/dashboard/MatchProgressCard';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";
import { useTabTransition } from '../../src/contexts/TabTransitionContext';
import AnimatedTabScreenContainer from '../../components/navigation/AnimatedTabScreenContainer';
import { usePremium } from '../../src/hooks/usePremium';
import AsyncStorage from '@react-native-async-storage/async-storage';


interface ZodiacOption {
  id: string;
  name: string;
  emoji: string;
  element: string;
  description: string;
}

interface ActivityOption {
  id: string;
  name: string;
  emoji: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { conversations, unreadCounts } = useMessaging();
  const { setDirection } = useTabTransition();
  const { isPremium, loading } = usePremium();

  // Calculate total unread messages across all conversations
  const totalUnreadMessages = (Object.values(unreadCounts) as number[]).reduce((total: number, count: number) => total + count, 0);
  const totalMatches = conversations?.length || 0;

  // State for selected options
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacOption | undefined>();
  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | undefined>();

  // State for banner dismiss
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Check banner dismiss state on mount
  useEffect(() => {
    const checkBannerDismiss = async () => {
      if (!user?.id) return;

      const dismissedAt = await AsyncStorage.getItem(`@stellr_banner_dismissed_${user.id}`);
      if (dismissedAt) {
        const timestamp = parseInt(dismissedAt);
        const now = Date.now();
        const hoursPassed = (now - timestamp) / (1000 * 60 * 60);

        // Only keep dismissed if less than 24 hours have passed
        if (hoursPassed < 24) {
          setBannerDismissed(true);
        }
      }
    };

    checkBannerDismiss();
  }, [user?.id]);

  const handleBannerPress = () => {
    logUserAction('Tapped subscription banner on dashboard', 'Engagement', { userId: user?.id });
    router.push('/paywall' as any);
  };

  const handleBannerDismiss = async () => {
    logUserAction('Dismissed subscription banner on dashboard', 'Engagement', { userId: user?.id });
    const timestamp = Date.now();
    await AsyncStorage.setItem(`@stellr_banner_dismissed_${user?.id}`, timestamp.toString());
    setBannerDismissed(true);
  };

  const handleSearchMatches = () => {
    logUserAction('Initiated match search from dashboard', 'Engagement', {
      zodiac: selectedZodiac?.name || 'none',
      activity: selectedActivity?.name || 'none',
      userId: user?.id
    });

    // Navigate to the date-night screen which has the complete matching flow
    // The user's preferences (zodiac/activity) are already selections there
    router.push('/date-night');
  };

  const handleViewMatch = (matchId: string) => {
    logDebug('Viewing match:', "Debug", matchId);
    
    // Navigate to the messenger tab to show matches/conversations
    // This allows users to see their matches and potential conversations
    setDirection('left');
    router.push('/(tabs)/messenger');
  };

  return (
    <AnimatedTabScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.WHITE_CARD} translucent={false} />
        <View style={styles.container}>
          <View
            style={styles.blackBackground}
          >
            <View 
              style={styles.scrollContainer}
            >
            {/* Top Section - Zodiac Selection */}
            <RotatingZodiacCard
              userName={resolveFirstName(profile, user)}
              selectedZodiac={selectedZodiac}
              matchesCount={totalMatches}
              onZodiacChange={setSelectedZodiac}
              isPremium={isPremium}
              showBanner={!bannerDismissed && !isPremium && !loading}
              onBannerPress={handleBannerPress}
              onBannerDismiss={handleBannerDismiss}
            />

            {/* Middle Section - Date Activity Selection */}
            <DateActivityCard
              selectedActivity={selectedActivity}
              onActivityChange={setSelectedActivity}
            />

            {/* Bottom Section - Match Search & Results */}
            <MatchProgressCard
              selectedZodiac={selectedZodiac?.name}
              selectedActivity={selectedActivity?.name}
              onSearchMatches={handleSearchMatches}
              onViewMatch={handleViewMatch}
            />
            </View>

          </View>
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
    paddingBottom: 60, // Space for navigation bar (search card will overlap)
    gap: 6, // Minimal spacing between cards
    zIndex: 5, // Ensure content layer is above navigation
    position: 'relative',
  },
});
