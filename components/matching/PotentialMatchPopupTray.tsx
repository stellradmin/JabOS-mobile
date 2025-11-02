import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessaging } from '../../src/contexts/MessagingContext';
import { MatchStackManager } from './MatchStackManager';
import { announceToScreenReader } from '../../src/utils/accessibility';
import PopUpTray from '../PopUpTray';
import PopupTrayErrorBoundary from '../common/PopupTrayErrorBoundary';
import { logError, logDebug } from '../../src/utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = Math.min(screenWidth * 0.8, 360);
const CARD_SPACING = 16;
const SNAP_INTERVAL = ITEM_WIDTH + CARD_SPACING * 2;
const SIDE_PADDING = Math.max((screenWidth - ITEM_WIDTH) / 2 - CARD_SPACING, 0);

export interface PotentialMatch {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  age?: number;
  interests?: string[];
  traits?: string[];
  zodiac_sign?: string;
  compatibility_score?: number;
  distance?: number;
  distance_km?: number;
  date_activity?: string;
  is_match_recommended?: boolean;
}

interface PotentialMatchPopupTrayProps {
  visible: boolean;
  onClose: () => void;
  selectedZodiac?: string;
  selectedActivity?: string;
  onMatch?: (matchId: string) => void;
  demoMode?: boolean;
}

const FALLBACK_MATCHES: PotentialMatch[] = [
  {
    id: 'demo-1',
    display_name: 'Alexis Rivera',
    bio: 'Art, coffee, indie films',
    age: 27,
    interests: ['Art', 'Coffee'],
    zodiac_sign: 'Gemini',
    compatibility_score: 92,
    distance_km: 2,
    date_activity: 'Coffee',
    is_match_recommended: true,
  },
  {
    id: 'demo-2',
    display_name: 'Maya Chen',
    bio: 'Hiking on weekends, foodie',
    age: 29,
    interests: ['Hiking', 'Travel'],
    zodiac_sign: 'Libra',
    compatibility_score: 88,
    distance_km: 5,
    date_activity: 'Hike',
    is_match_recommended: true,
  },
];

const gradeFromScore = (score?: number): string => {
  if (typeof score !== 'number') return 'A';
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'C-';
};

const formatDistance = (distance?: number | null): string => {
  if (typeof distance === 'number' && Number.isFinite(distance)) {
    return `${Math.max(distance, 0).toFixed(1)} km`;
  }
  return 'Nearby';
};

const PotentialMatchPopupTray: React.FC<PotentialMatchPopupTrayProps> = ({
  visible,
  onClose,
  selectedZodiac,
  selectedActivity,
  onMatch,
  demoMode = false,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshConversations } = useMessaging();

  const stackManagerRef = useRef(new MatchStackManager(user?.id || ''));
  const listRef = useRef<FlatList<PotentialMatch>>(null);

  const [matches, setMatches] = useState<PotentialMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);

  // Recreate stack manager when user changes
  useEffect(() => {
    stackManagerRef.current.cleanup();
    stackManagerRef.current = new MatchStackManager(user?.id || '');
    setMatches([]);
    setCurrentIndex(0);
    setHasMoreMatches(true);
  }, [user?.id]);

  const sortedInterests = (rawInterests?: string[]): string[] => {
    if (!rawInterests || rawInterests.length === 0) return ['Shared interests'];
    return rawInterests.filter(Boolean).slice(0, 2);
  };

  const loadMatches = useCallback(async () => {
    if (!user?.id) {
      setMatches([]);
      return;
    }

    setIsLoading(true);
    try {
      const initialMatches = await stackManagerRef.current.loadInitialMatches({
        zodiacSign: selectedZodiac,
        dateActivity: selectedActivity,
        limit: 5,
        refresh: true,
      });

      setMatches(initialMatches);
      setCurrentIndex(0);
      setHasMoreMatches(initialMatches.length >= 5);

      if (initialMatches.length > 0) {
        stackManagerRef.current.preloadNextBatch();
      }
    } catch (error: any) {
      logError('Error loading matches:', "Error", error);
      Alert.alert('Error', 'Failed to load matches. Please try again.');
      setMatches([]);
      setHasMoreMatches(false);
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedActivity, selectedZodiac, user?.id]);

  const topUpMatches = useCallback(async () => {
    if (!hasMoreMatches) return;
    try {
      const nextMatches = await stackManagerRef.current.getNextMatches(5);
      if (nextMatches.length > 0) {
        setMatches(prev => [...prev, ...nextMatches]);
      } else {
        setHasMoreMatches(false);
      }
    } catch (error) {
      logError('Error fetching additional matches:', "Error", error);
    }
  }, [hasMoreMatches]);

  useEffect(() => {
    if (visible && !demoMode) {
      loadMatches();
    }
    if (!visible) {
      setCurrentIndex(0);
    }
  }, [visible, demoMode, loadMatches]);

  const displayMatches = useMemo(() => {
    if (demoMode) return FALLBACK_MATCHES;
    if (!isLoading && matches.length === 0) return FALLBACK_MATCHES;
    return matches;
  }, [demoMode, matches, isLoading]);

  const isUsingFallbackData = useMemo(
    () => demoMode || (!isLoading && matches.length === 0),
    [demoMode, isLoading, matches.length]
  );

  useEffect(() => {
    if (visible) {
      announceToScreenReader('Match discovery tray opened', 'polite');
    }
  }, [visible]);

  const handlePassOrInvite = useCallback(
    async (action: 'like' | 'pass', match: PotentialMatch, index: number) => {
      if (!user?.id || isUsingFallbackData) return;

      try {
        const result = await stackManagerRef.current.recordSwipe(match.id, action);

        if (result.match?.match_created && result.match.match_details) {
          announceToScreenReader("It's a match!", 'assertive');
          await refreshConversations();
          onMatch?.(result.match.match_details.id);

          const convoId = result.match.match_details.conversation_id;
          if (convoId) {
            router.push(`/(tabs)/messenger?openConversationId=${encodeURIComponent(convoId)}` as any);
            onClose();
          }
        }

        const remaining = matches.length - 1;
        setMatches(prev => prev.filter((_, idx) => idx !== index));
        setCurrentIndex(prev => {
          if (index < prev) return Math.max(prev - 1, 0);
          return Math.min(prev, Math.max(remaining - 1, 0));
        });

        if (remaining <= 2) {
          topUpMatches();
        }
      } catch (error) {
        logError('Error recording swipe:', "Error", error);
        Alert.alert('Error', 'Failed to record your choice. Please try again.');
      }
    },
    [isUsingFallbackData, matches.length, onClose, onMatch, refreshConversations, router, topUpMatches, user?.id]
  );

  const renderMatchCard = useCallback(
    ({ item, index }: { item: PotentialMatch; index: number }) => {
      const name = item.display_name?.trim() || 'Potential match';
      const details: string[] = [];
      if (typeof item.age === 'number') details.push(`${item.age}`);
      if (item.zodiac_sign) details.push(item.zodiac_sign);
      details.push(formatDistance(item.distance_km ?? item.distance ?? null));

      const interests = sortedInterests(item.interests);

      return (
        <View style={[styles.cardContainer, { width: ITEM_WIDTH }]}>
          <View style={styles.cardImagePlaceholder} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                {name}
              </Text>
              <View style={styles.inlineInterestsRow}>
                {interests.map((interest) => (
                  <View key={interest} style={styles.interestPill}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.cardMeta}>{details.join(' • ')}</Text>
            <Text style={styles.cardBio} numberOfLines={2}>
              {item.bio || 'Shared interests and values'}
            </Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Overall</Text>
                <Text style={styles.metricValue}>
                  {typeof item.compatibility_score === 'number'
                    ? `${Math.round(item.compatibility_score)}%`
                    : '—'}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Astrology</Text>
                <Text style={styles.metricValue}>{gradeFromScore(item.compatibility_score)}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.passButton]}
                accessibilityRole="button"
                accessibilityLabel={`Pass on ${name}`}
                onPress={() => handlePassOrInvite('pass', item, index)}
                disabled={isUsingFallbackData}
              >
                <Text style={styles.passButtonText}>Pass</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.inviteButton]}
                accessibilityRole="button"
                accessibilityLabel={`Send a match invite to ${name}`}
                onPress={() => handlePassOrInvite('like', item, index)}
                disabled={isUsingFallbackData}
              >
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [handlePassOrInvite, isUsingFallbackData]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Text style={styles.emptyStateTitle}>No matches just yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Adjust your preferences or try again later to see more suggestions.
      </Text>
    </View>
  );

  const selectionLabel = useMemo(() => {
    if (selectedZodiac && selectedActivity) {
      return `${selectedZodiac} • ${selectedActivity}`;
    }
    if (selectedZodiac) return selectedZodiac;
    if (selectedActivity) return selectedActivity;
    return 'Personalized matches';
  }, [selectedActivity, selectedZodiac]);

  const showEmptyState = useMemo(
    () => !isLoading && matches.length === 0 && !demoMode,
    [demoMode, isLoading, matches.length]
  );

  if (!visible) {
    return null;
  }

  return (
    <PopupTrayErrorBoundary
      fallbackTitle="Match Discovery Error"
      fallbackMessage="We encountered an issue while loading matches. Please try again."
      onRetry={loadMatches}
      onClose={onClose}
    >
      <PopUpTray
        isVisible={visible}
        onClose={onClose}
        title="Discover Matches"
        headerTabColor="#F2BAC9"
        customHeight={0.92}
        contentPaddingHorizontal={0}
      >
        <View style={styles.headerSubtitleContainer}>
          <Text style={styles.headerSubtitle}>{selectionLabel}</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.DARK_TEXT} size="large" />
            <Text style={styles.loadingText}>Finding matches…</Text>
          </View>
        ) : showEmptyState ? (
          renderEmptyState()
        ) : (
          <>
            <FlatList
              ref={listRef}
              horizontal
              data={displayMatches}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={SNAP_INTERVAL}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: SIDE_PADDING + CARD_SPACING }}
              ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING * 2 }} />}
              renderItem={renderMatchCard}
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / SNAP_INTERVAL);
                setCurrentIndex(index);
              }}
              getItemLayout={(_, index) => ({
                length: SNAP_INTERVAL,
                offset: SNAP_INTERVAL * index,
                index,
              })}
            />

            <View style={styles.paginationDots}>
              {displayMatches.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          </>
        )}
      </PopUpTray>
    </PopupTrayErrorBoundary>
  );
};

const styles = StyleSheet.create({
  headerSubtitleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  cardContainer: {
    backgroundColor: COLORS.CARD_WHITE_TEXT,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.BORDER_PRIMARY,
    overflow: 'hidden',
  },
  cardImagePlaceholder: {
    height: ITEM_WIDTH,
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.BORDER_PRIMARY,
  },
  cardContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardName: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: COLORS.DARK_TEXT,
    flexShrink: 1,
    marginRight: 4,
  },
  cardMeta: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  cardBio: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderWidth: 2,
    borderColor: COLORS.BORDER_PRIMARY,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'Geist-Medium',
    color: COLORS.SECONDARY_TEXT,
  },
  metricValue: {
    marginTop: 2,
    fontSize: 16,
    fontFamily: 'Geist-Bold',
    color: COLORS.DARK_TEXT,
  },
  inlineInterestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.TAG_BG,
  },
  interestText: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    minHeight: 54,
    alignItems: 'center',
    borderWidth: 1.25,
  },
  passButton: {
    borderColor: COLORS.BORDER_PRIMARY,
    backgroundColor: COLORS.CARD_WHITE_TEXT,
  },
  inviteButton: {
    borderColor: COLORS.BLACK_CARD,
    backgroundColor: COLORS.BLACK_CARD,
  },
  passButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  inviteButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.CARD_WHITE_TEXT,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 18,
    backgroundColor: COLORS.DARK_TEXT,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: COLORS.DARK_TEXT,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
  },
});

export default PotentialMatchPopupTray;
