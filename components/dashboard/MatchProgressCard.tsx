import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { BLUE_CARD_STYLES, COLORS } from '../../constants/theme';
import { Search, Star } from 'lucide-react-native';
import PotentialMatchPopupTray from '../matching/PotentialMatchPopupTray';
import { logError, logDebug } from "../../src/utils/logger";
import { supabase } from '../../src/lib/supabase';

interface PotentialMatch {
  id: string;
  name: string;
  age?: number;
  avatar?: string | null;
  zodiacSign?: string;
  compatibility?: number;
  distance: string;
  lastActive: string;
  commonInterests: string[];
}

interface MatchProgressCardProps {
  selectedZodiac?: string;
  selectedActivity?: string;
  onSearchMatches: () => void;
  onViewMatch: (matchId: string) => void;
}

const MatchProgressCard: React.FC<MatchProgressCardProps> = ({
  selectedZodiac,
  selectedActivity,
  onSearchMatches,
  onViewMatch,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<PotentialMatch[]>([]);
  const [showMatchTray, setShowMatchTray] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;

  const normalizeInterests = (interests: unknown): string[] => {
    if (Array.isArray(interests)) {
      return interests
        .map((interest) => (typeof interest === 'string' ? interest.trim() : ''))
        .filter(Boolean);
    }

    if (typeof interests === 'string') {
      return interests
        .split(',')
        .map((interest) => interest.trim())
        .filter(Boolean);
    }

    return [];
  };

  const toPreviewMatch = useCallback((match: any): PotentialMatch => {
    const id = match?.id ? String(match.id) : `preview_${Math.random().toString(36).slice(2, 10)}`;
    const name = typeof match?.display_name === 'string' && match.display_name.trim().length > 0
      ? match.display_name.trim()
      : 'Potential match';

    const age = typeof match?.age === 'number' ? match.age : undefined;
    const compatibility = typeof match?.compatibility_score === 'number'
      ? Math.round(match.compatibility_score)
      : undefined;

    const rawDistance = typeof match?.distance_km === 'number'
      ? match.distance_km
      : typeof match?.distance === 'number'
        ? match.distance
        : undefined;
    const distanceValue = typeof rawDistance === 'number' && Number.isFinite(rawDistance)
      ? Math.max(rawDistance, 0)
      : 25;

    const distanceLabel = `${distanceValue.toFixed(1)} km`;

    const interestList = normalizeInterests(match?.interests);
    const fallbackInterests = interestList.length > 0
      ? interestList
      : ['Meaningful chats', 'Shared values'];

    return {
      id,
      name,
      age,
      avatar: match?.avatar_url ?? null,
      zodiacSign: typeof match?.zodiac_sign === 'string' ? match.zodiac_sign : undefined,
      compatibility,
      distance: distanceLabel,
      lastActive: '15 min ago',
      commonInterests: fallbackInterests.slice(0, 2),
    };
  }, []);

  const fetchLiveMatches = useCallback(async (shouldAlertOnError: boolean = false): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-potential-matches-optimized', {
        body: {
          pageSize: 5,
          zodiac_sign: selectedZodiac,
          activity_type: selectedActivity,
          refresh: true,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) {
        throw error;
      }

      // Log API response structure for debugging
      logDebug('MatchProgressCard API Response:', "Debug", {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        dataLength: Array.isArray(data?.data) ? data.data.length : 0
      });

      const liveMatches = Array.isArray(data?.data)
        ? (data.data as any[]).map(toPreviewMatch)
        : [];

      setMatches(liveMatches);
      return true;
    } catch (error) {
      logError('Failed to load potential matches:', "Error", error);
      if (shouldAlertOnError) {
        Alert.alert(
          'Match Search Unavailable',
          "We couldn't load new matches right now. Please try again in a moment."
        );
      }
      return false;
    }
  }, [selectedZodiac, selectedActivity, toPreviewMatch]);

  useEffect(() => {
    fetchLiveMatches();
  }, [fetchLiveMatches]);

  const handleSearch = useCallback(async () => {
    if (isSearching) {
      return;
    }

    setIsSearching(true);

    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setShowMatchTray(true);
    onSearchMatches();

    await fetchLiveMatches(true);

    setIsSearching(false);
    searchAnim.setValue(0);
  }, [isSearching, searchAnim, onSearchMatches, fetchLiveMatches]);

  const handleMatchTrayClose = () => {
    setShowMatchTray(false);
  };

  const handleMatchCreated = (matchId: string) => {
    logDebug('Match created:', "Debug", matchId);
    // Match will appear in messenger automatically through MessagingContext
  };

  const searchButtonScale = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94],
  });

  return (
    <>
      <View style={[styles.container, BLUE_CARD_STYLES, styles.bottomCardRounding]}>
        {/* Search section */}
      <View style={styles.searchSection}>
        <Text style={styles.searchTitle}>Find Your Perfect Match</Text>
        <Text style={styles.searchSubtitle}>
          Based on {selectedZodiac || 'your zodiac'} and {selectedActivity || 'activity preferences'}
        </Text>

        <Animated.View
          style={[
            styles.searchButton,
            {
              transform: [{ scale: searchButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.searchButtonInner, isSearching && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
            activeOpacity={0.85}
          >
            <Search size={20} color={COLORS.CARD_WHITE_TEXT} />
            <Text style={styles.searchButtonText}>
              {isSearching ? 'Searching…' : 'Search Matches'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      </View>

      {/* Match Discovery Popup Tray */}
      <PotentialMatchPopupTray
        visible={showMatchTray}
        onClose={handleMatchTrayClose}
        selectedZodiac={selectedZodiac}
        selectedActivity={selectedActivity}
        onMatch={handleMatchCreated}
        demoMode={false}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 0, // Remove side margins for full width
    marginBottom: -20, // Negative margin to overlap with navigation bar
    paddingBottom: 16, // Consistent bottom spacing for CTA only layout
    zIndex: 10, // Higher z-index to appear above navigation bar
    elevation: 10, // For Android shadow and layering
    position: 'relative', // Ensure z-index works properly
  },
  bottomCardRounding: {
    borderTopLeftRadius: 20, // Round top corners for curvature
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20, // Keep bottom corners rounded
    borderBottomRightRadius: 20,
  },
  searchSection: {
    alignItems: 'center',
    marginBottom: 0,
  },
  searchTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
    textAlign: 'center',
  },
  searchSubtitle: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 18,
  },
  searchButton: {
    width: '100%',
  },
  searchButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BLACK_CARD,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
  },
  searchButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: COLORS.CARD_WHITE_TEXT,
    letterSpacing: 0.2,
  },
  searchButtonDisabled: {
    opacity: 0.8,
  },
});

export default MatchProgressCard;
