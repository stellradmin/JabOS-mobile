import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import MatchFlowManager from '../components/MatchFlowManager';
import CleanConversationTray from '../components/messaging/CleanConversationTray';
import { useMessaging } from '../src/contexts/MessagingContext';
import { useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';
import { PaywallModal, PaywallTrigger } from '../components/PaywallModal';
import { getInviteStatus, useInvite, InviteStatus } from '../src/services/invite-manager';
import { Sparkles } from 'lucide-react-native';

export default function DevMatchingScreen() {
  const { conversations, refreshConversations } = useMessaging();
  const { user } = useAuth();
  const [matchMode, setMatchMode] = useState<'browse' | 'popup' | 'none'>('none');
  const [incomingMatch, setIncomingMatch] = useState<any>(null);
  const [conversationTrayVisible, setConversationTrayVisible] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [potentialMatches, setPotentialMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  // Invite system state
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger>('exhausted_invites');

  // Load invite status on mount
  useEffect(() => {
    if (user?.id) {
      loadInviteStatus();
    }
  }, [user?.id]);

  // Function to load invite status
  const loadInviteStatus = async () => {
    if (!user?.id) return;

    setIsLoadingInvites(true);
    try {
      const status = await getInviteStatus(user.id);
      setInviteStatus(status);
    } catch (error) {
      console.error('Error loading invite status:', error);
      // Don't show error to user - non-critical
    } finally {
      setIsLoadingInvites(false);
    }
  };

  // Fetch real potential matches from the API
  const fetchPotentialMatches = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to view matches');
      return;
    }

    setIsLoadingMatches(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Error', 'Session expired. Please log in again.');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-potential-matches-optimized`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Transform the data to match the expected format
      const matches = (data.matches || []).map((match: any) => ({
        id: match.id || match.user_id,
        target_user_id: match.user_id || match.id,
        display_name: match.display_name || match.name,
        avatar_url: match.avatar_url,
        bio: match.bio,
        age: match.age,
        interests: match.interests || [],
        traits: match.traits || [],
        compatibility_score: match.compatibility_score,
        source_match_request_id: match.match_request_id,
      }));

      setPotentialMatches(matches);

      if (matches.length > 0) {
        setMatchMode('browse');
      } else {
        Alert.alert('No Matches', 'No potential matches found at this time. Try adjusting your preferences!');
      }
    } catch (error: any) {
      console.error('Error fetching potential matches:', error);
      Alert.alert('Error', error.message || 'Failed to load potential matches');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const openMockMatchPopup = () => {
    const mock = {
      id: `mock_comp_match_${Date.now()}`,
      compatibility_score: 91,
      other_user: {
        id: 'mock-user-xyz',
        name: 'Alexis Rivera',
        avatar_url: 'https://api.dicebear.com/8.x/adventurer/svg?seed=Alexis',
        age: 27,
        interests: ['Art', 'Coffee', 'Hiking', 'Movies'],
        traits: ['Creative', 'Curious', 'Empathetic'],
      },
    };
    setIncomingMatch(mock);
    setMatchMode('popup');
  };

  const openConversation = (id: string) => {
    setSelectedConversationId(id);
    setConversationTrayVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Dev Matching & Messaging</Text>

        {/* Invite Counter Card */}
        {inviteStatus && (
          <View style={styles.inviteCard}>
            <View style={styles.inviteHeader}>
              <View style={styles.inviteIconContainer}>
                <Sparkles size={20} color={inviteStatus.isPremium ? '#C8A8E9' : '#666'} />
              </View>
              <View style={styles.inviteInfo}>
                <Text style={styles.inviteCount}>
                  {inviteStatus.remaining} / {inviteStatus.total} invites remaining
                </Text>
                <Text style={styles.inviteSubtext}>
                  {inviteStatus.isPremium ? 'Premium - Resets daily' : 'Free tier - Resets daily'}
                </Text>
              </View>
            </View>
            {!inviteStatus.isPremium && inviteStatus.remaining < 3 && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => {
                  setPaywallTrigger('exhausted_invites');
                  setPaywallVisible(true);
                }}
              >
                <Text style={styles.upgradeButtonText}>
                  Upgrade to Premium for 20 invites/day
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Real Potential Matches Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Find Real Matches</Text>
          <Text style={styles.description}>
            Browse actual users from the database who match your preferences.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, isLoadingMatches && styles.disabledButton]}
            onPress={fetchPotentialMatches}
            disabled={isLoadingMatches}
          >
            {isLoadingMatches ? (
              <ActivityIndicator color={COLORS.CARD_WHITE_TEXT} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Browse Potential Matches ({potentialMatches.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Mock Match Popup Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mock Match Popup (Demo)</Text>
          <Text style={styles.description}>
            Opens the match tray with mock data to validate UI.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={openMockMatchPopup}>
            <Text style={styles.secondaryButtonText}>Open Mock Compatibility Match</Text>
          </TouchableOpacity>
        </View>

        {/* Conversations Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your Conversations</Text>
            <TouchableOpacity onPress={refreshConversations}>
              <Text style={styles.link}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {conversations.length === 0 ? (
            <Text style={styles.description}>
              No conversations found. Match with someone to start chatting!
            </Text>
          ) : (
            conversations.map((c) => {
              const other = c.user1_id === user?.id ? c.user2 : c.user1;
              return (
                <TouchableOpacity key={c.id} style={styles.convRow} onPress={() => openConversation(c.id)}>
                  <Text style={styles.convTitle}>{other?.display_name || 'Conversation'}</Text>
                  <Text style={styles.convSub}>{c.id}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Match Popup Manager */}
      <MatchFlowManager
        mode={matchMode}
        onModeChange={setMatchMode}
        potentialMatches={potentialMatches}
        incomingCompatibilityMatch={incomingMatch}
        onAcceptPotentialMatch={async (targetUserId, sourceRequestId) => {
          // Check invite status before sending match request
          if (!user?.id) {
            Alert.alert('Error', 'You must be logged in to send match requests');
            return;
          }

          // Check if user has invites remaining
          if (inviteStatus && inviteStatus.remaining <= 0) {
            // Show paywall modal
            setPaywallTrigger('exhausted_invites');
            setPaywallVisible(true);
            return;
          }

          // Handle match acceptance
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            // Use an invite (decrement count)
            const inviteUsed = await useInvite(user.id, targetUserId);

            if (!inviteUsed) {
              // Race condition or no invites - show paywall
              setPaywallTrigger('exhausted_invites');
              setPaywallVisible(true);
              return;
            }

            const response = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-match-request`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  matched_user_id: targetUserId,
                  compatibility_score: 85,
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || 'Failed to send match request');
            }

            Alert.alert('Success', 'Match request sent!');

            // Refresh invite status and matches list
            await loadInviteStatus();
            await fetchPotentialMatches();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send match request');
            // Refresh invite status in case it was used
            await loadInviteStatus();
          }
        }}
        onAcceptCompatibilityMatch={async () => { setMatchMode('none'); }}
        onDeclineMatch={() => {
          setMatchMode('none');
          // Optionally refresh matches
        }}
        onViewCompatibility={() => {}}
        onClose={() => setMatchMode('none')}
      />

      {/* Conversation Tray */}
      {selectedConversationId ? (
        <CleanConversationTray
          visible={conversationTrayVisible}
          onClose={() => { setConversationTrayVisible(false); setSelectedConversationId(''); }}
          conversationId={selectedConversationId}
        />
      ) : null}

      {/* Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={async () => {
          // Subscription purchased successfully
          // Refresh invite status to reflect new premium limits
          await loadInviteStatus();
          setPaywallVisible(false);
        }}
        trigger={paywallTrigger}
        remainingInvites={inviteStatus?.remaining || 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.WHITE_CARD,
  },
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    fontSize: 22,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  description: {
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
    fontFamily: 'Geist-Regular',
  },
  primaryButton: {
    backgroundColor: COLORS.BLACK_CARD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.CARD_WHITE_TEXT,
    fontFamily: 'Geist-Regular',
  },
  secondaryButton: {
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  secondaryButtonText: {
    color: COLORS.DARK_TEXT,
    fontFamily: 'Geist-Regular',
  },
  disabledButton: {
    opacity: 0.6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  link: {
    color: COLORS.DARK_TEXT,
    textDecorationLine: 'underline',
    fontFamily: 'Geist-Medium',
  },
  convRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.CARD_BORDER,
  },
  convTitle: {
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  convSub: {
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    fontSize: 12,
  },
  // Invite counter styles
  inviteCard: {
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: 16,
    marginBottom: 8,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteCount: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 2,
  },
  inviteSubtext: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
  },
  upgradeButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F0E6FF',
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#7E3AF2',
  },
});
