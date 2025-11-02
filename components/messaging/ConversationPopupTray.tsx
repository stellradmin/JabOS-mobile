import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import CalendarModal from './CalendarModal';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { ArrowLeft, Send } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessaging } from '../../src/contexts/MessagingContext';
import { supabase } from '../../src/lib/supabase';
import { announceToScreenReader } from '../../src/utils/accessibility';
import PopupTrayErrorBoundary from '../common/PopupTrayErrorBoundary';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const UI_PINK = '#F1A7B9';
const UI_NAVY = '#0B1220';
const UI_BORDER = '#000000';
const UI_GRAY = '#8A8A8A';
const INPUT_HEIGHT = 50;

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface ConversationData {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  last_message_preview?: string;
  last_message_at?: string;
  updated_at: string;
  user1?: { id: string; display_name: string; avatar_url?: string };
  user2?: { id: string; display_name: string; avatar_url?: string };
}

interface ConversationPopupTrayProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
}

/**
 * ConversationPopupTray - Full-featured chat interface in popup tray
 * 
 * Features:
 * - Real-time messaging with Supabase realtime
 * - Smooth slide-up animation with backdrop blur
 * - Message bubbles with sender distinction
 * - Auto-scroll to new messages
 * - Message input with send functionality
 * - Typing indicators and message status
 * - Swipe down to dismiss functionality
 * - Accessibility support
 * 
 * Following Golden Code Principles:
 * 1. Single Responsibility: Manages conversation UI and messaging
 * 2. Performance First: Optimized message rendering and animations
 * 3. Defensive Programming: Error handling and safe state management
 * 4. Separation of Concerns: UI separated from data logic
 */
const ConversationPopupTray: React.FC<ConversationPopupTrayProps> = ({
  visible,
  onClose,
  conversationId,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const trayHeight = height; // Full-screen sheet; header overlays at top
  const baseW = 393; // iPhone 15 reference width (points)
  const scale = Math.max(0.9, Math.min(1.1, width / baseW));
  const HEADER_BASE = 112; // desired pink header height excluding status bar (room for name + zodiac)
  const headerHeight = Math.max(HEADER_BASE, 72) + insets.top; // ensure roomy status area
  const { user } = useAuth();
  const { refreshConversations } = useMessaging();

  // Animation values
  const translateY = useSharedValue(trayHeight);
  const backdropOpacity = useSharedValue(0);

  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, string>>({});
  const [proposedDates, setProposedDates] = useState<string[]>([]);
  const [acceptedDates, setAcceptedDates] = useState<string[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const realtimeChannelRef = useRef<any>(null);
  const keyboardOffset = useSharedValue(0);
  const composerWrapperAnimatedStyle = useAnimatedStyle(() => ({
    // Keep composer above tab bar/home indicator; add keyboard lift on top
    bottom: Math.max(insets.bottom, 16) + keyboardOffset.value,
  }));

  // Fetch proposals for calendar highlighting
  const fetchDateProposals = useCallback(async (convId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      if (!base || !token) return;
      const url = `${base}/functions/v1/get-date-proposals?type=conversation&id=${encodeURIComponent(convId)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const list = await res.json();
      const proposed: string[] = [];
      const accepted: string[] = [];
      (list || []).forEach((p: any) => {
        const iso = new Date(p.proposed_datetime).toISOString().slice(0, 10);
        if (p.status === 'accepted') accepted.push(iso); else proposed.push(iso);
      });
      setProposedDates(proposed);
      setAcceptedDates(accepted);
    } catch {}
  }, []);

  /**
   * Load conversation details and messages
   */
  const loadConversation = useCallback(async () => {
    if (!conversationId || !user?.id) return;

    setIsLoading(true);
    try {
      // Get conversation details
      const { data: conversationData, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          user1:profiles!conversations_user1_id_fkey(id, display_name, avatar_url),
          user2:profiles!conversations_user2_id_fkey(id, display_name, avatar_url)
        `)
        .eq('id', conversationId)
        .single();

      if (convError) {
        logError('Error loading conversation:', "Error", convError);
        Alert.alert('Error', 'Failed to load conversation');
        return;
      }

      setConversation(conversationData);
      
      // Determine other user
      const otherUserData = conversationData.user1_id === user.id 
        ? conversationData.user2 
        : conversationData.user1;
      setOtherUser(otherUserData);
      // Persist match id if present
      if ((conversationData as any).match_id) setMatchId((conversationData as any).match_id as string);

      // Load messages
      const { data: messagesData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) {
        logError('Error loading messages:', "Error", msgError);
      } else {
        setMessages(messagesData || []);
        
        // Scroll to bottom after loading
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }

      // Mark messages as read
      await markMessagesAsRead();
      // Highlight dates on calendar
      fetchDateProposals(conversationId);
      
    } catch (error) {
      logError('Error in loadConversation:', "Error", error);
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user?.id]);

  /**
   * Mark messages as read
   */
  const markMessagesAsRead = useCallback(async () => {
    if (!conversationId || !user?.id) return;

    try {
      await supabase.functions.invoke('mark-messages-read', {
        body: { conversation_id: conversationId }
      });
      
      // Update local messaging context
      await refreshConversations();
    } catch (error) {
      logError('Error marking messages as read:', "Error", error);
    }
  }, [conversationId, user?.id, refreshConversations]);

  /**
   * Send a new message
   */
  const sendMessage = useCallback(async () => {
    if (!messageText.trim() || !conversationId || !user?.id || isSending) return;

    const trimmedText = messageText.trim();
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          conversation_id: conversationId,
          content: trimmedText,
        }
      });

      if (error) {
        logError('Error sending message:', "Error", error);
        Alert.alert('Error', 'Failed to send message');
        return;
      }

      // Clear input on success
      setMessageText('');
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      announceToScreenReader('Message sent', 'polite');
      
    } catch (error) {
      logError('Error in sendMessage:', "Error", error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [messageText, conversationId, user?.id, isSending]);

  /**
   * Setup realtime subscription for new messages
   */
  const setupRealtime = useCallback(() => {
    if (!conversationId) return;

    // Cleanup existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create new subscription
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          // Proposal events
          if (newMessage.content?.startsWith?.('__DATE_PROPOSAL_STATUS__::')) {
            try {
              const parsed = JSON.parse(newMessage.content.split('__DATE_PROPOSAL_STATUS__::')[1]);
              if (parsed?.proposal_id && parsed?.status) {
                setProposalStatuses(prev => ({ ...prev, [parsed.proposal_id]: parsed.status }));
                if (conversationId) fetchDateProposals(conversationId);
              }
            } catch {}
          }
          if (newMessage.content?.startsWith?.('__DATE_PROPOSAL__::')) {
            try {
              const parsed = JSON.parse(newMessage.content.split('__DATE_PROPOSAL__::')[1]);
              if (parsed?.proposal_id) {
                setProposalStatuses(prev => ({ ...prev, [parsed.proposal_id]: 'pending' }));
                if (conversationId) fetchDateProposals(conversationId);
              }
            } catch {}
          }
          
          // Auto-scroll to new message
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
          
          // Announce new message for accessibility
          if (newMessage.sender_id !== user?.id) {
            announceToScreenReader(`New message from ${otherUser?.display_name}`, 'polite');
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, [conversationId, user?.id, otherUser?.display_name]);

  // Gesture handler for tray dismissal
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow downward swipes to dismiss
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const shouldDismiss = 
        translateY.value > trayHeight * 0.3 ||
        event.velocityY > 500;

      if (shouldDismiss) {
        translateY.value = withTiming(trayHeight, { duration: 280, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      }
    });

  // Animation styles
  const trayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Handle visibility changes
  useEffect(() => {
    // keep hidden position in sync with computed height
    if (!visible) {
      translateY.value = trayHeight;
    }
    if (visible) {
      // Show tray
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
      
      // Load conversation
      loadConversation();
      setupRealtime();
      
      announceToScreenReader('Conversation opened', 'polite');
      
      // Focus input after animation
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 500);
    } else {
      // Hide tray
      translateY.value = withTiming(trayHeight, { duration: 260, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
      
      // Clear state
      setMessages([]);
      setConversation(null);
      setOtherUser(null);
      setMessageText('');
      
      // Cleanup realtime
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    }
  }, [visible, trayHeight, loadConversation, setupRealtime, translateY, backdropOpacity]);

  // Keyboard handling: animate composer above keyboard and keep list scrolled
  useEffect(() => {
    const onShow = (e: any) => {
      const end = e?.endCoordinates;
      const screenH = Dimensions.get('window').height;
      const kbd = end ? Math.max(0, screenH - end.screenY) : (e?.endCoordinates?.height || 0);
      // We add insets.bottom in the animated style to account for home indicator.
      keyboardOffset.value = withTiming(kbd, { duration: 220, easing: Easing.out(Easing.cubic) });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
    };
  const onHide = () => {
      keyboardOffset.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
    };

    const showEvt = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, keyboardOffset]);

  // Create a date proposal via Edge Function then emit system message
  const handleCreateDateProposal = async (chosenDate: Date) => {
    try {
      if (!conversationId || !user?.id || !otherUser?.id) return;
      if (!matchId) {
        // try to fetch a match id via secure function if missing (best-effort)
      }
      const payload = {
        action: 'create',
        payload: {
          match_id: matchId,
          proposer_id: user.id,
          recipient_id: otherUser.id,
          conversation_id: conversationId,
          proposed_datetime: chosenDate.toISOString(),
          location: null,
          notes: null,
          activity_details: { type: 'date' },
        }
      };
      const { data: proposal, error } = await supabase.functions.invoke('manage-date-proposal', { body: payload });
      if (error) throw error;
      if (!proposal?.id) return;

      // Emit structured message so UI on both sides renders rich card
      const content = `__DATE_PROPOSAL__::${JSON.stringify({ proposal_id: proposal.id, date: chosenDate.toISOString() })}`;
      await supabase.functions.invoke('send-message', { body: { conversation_id: conversationId, content, message_type: 'system' } });
      setCalendarVisible(false);
    } catch (err) {
      logError('Failed to create date proposal', 'Error', err as any);
      alert('Could not create date proposal. Please try again.');
    }
  };

  const handleUpdateProposalStatus = async (proposalId: string, status: 'accepted'|'rejected') => {
    try {
      setProposalStatuses(prev => ({ ...prev, [proposalId]: status }));
      await supabase.functions.invoke('manage-date-proposal', { body: { action: 'updateStatus', payload: { proposal_id: proposalId, status } } });
      const statusMsg = `__DATE_PROPOSAL_STATUS__::${JSON.stringify({ proposal_id: proposalId, status })}`;
      await supabase.functions.invoke('send-message', { body: { conversation_id: conversationId, content: statusMsg, message_type: 'system' } });
    } catch (err) {
      logError('Failed to update proposal status', 'Error', err as any);
    }
  };

  // Render individual message
  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const messageTime = new Date(item.created_at).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          { maxWidth: Math.min(width * 0.82, 520) },
          isMe ? styles.myMessage : styles.otherMessage
        ]}>
          <Text style={[
            styles.messageText,
            isMe ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isMe ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <PopupTrayErrorBoundary
      fallbackTitle="Conversation Error"
      fallbackMessage="We encountered an error while loading the conversation. Please try again."
      onRetry={loadConversation}
      onClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <TouchableOpacity 
          style={styles.backdropTouchable}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Tray Container */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.trayContainer, { height: trayHeight }, trayAnimatedStyle]}>
          {/* Fixed Top Header - Pink */}
          <View style={[styles.topHeaderFixed, { height: headerHeight, paddingTop: insets.top }]}> 
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Back" style={[styles.backCircle, { width: 44*scale, height: 44*scale, borderRadius: 22*scale }]}>
                <ArrowLeft size={20} color={UI_BORDER} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.userInfo} onPress={() => { if (otherUser?.id) { try { onClose?.(); } catch {} const qp = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''; router.push(`/view-profile/${otherUser.id}${qp}` as any); } }} accessibilityLabel="View profile">
                <View style={[styles.initialCircle, { width: 44*scale, height: 44*scale, borderRadius: 22*scale }]}><Text style={styles.initialText}>{otherUser?.display_name?.charAt(0) || 'O'}</Text></View>
                <View>
                  <Text style={styles.userNamePink}>{otherUser?.display_name || 'Olivia Brown'}</Text>
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.zodiacBadge, { width: 44*scale, height: 44*scale, borderRadius: 22*scale }]}>
                <Image 
                  source={require('../../assets/images/stellr.png')}
                  style={styles.zodiacIcon}
                  contentFit="cover"
                />
              </View>
            </View>
          </View>

            {/* Messages */}
            {/* Content sits below fixed header */}
            <View style={[styles.content, { paddingTop: headerHeight }]}> 
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.BLUE_CARD} />
                  <Text style={styles.loadingText}>Loading conversation...</Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={renderMessage}
                  keyExtractor={(item) => item.id}
                  style={[styles.messagesList]}
                  contentContainerStyle={[
                    styles.messagesContent,
                    { paddingBottom: composerHeight + Math.max(insets.bottom, 16) + 16 }
                  ]}
                  showsVerticalScrollIndicator={false}
                  maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 10,
                  }}
                />
              )}
            </View>

            {/* Composer (absolute, moves above keyboard) */}
            <Animated.View style={[styles.bottomComposerWrapper, composerWrapperAnimatedStyle]}>
              <View
                style={[styles.bottomComposer, { paddingBottom: Math.max(insets.bottom, 16) }]}
                onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    ref={textInputRef}
                    style={styles.textInput}
                    placeholder="Type a message to send..."
                    placeholderTextColor={UI_GRAY}
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                    accessibilityLabel="Message input"
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!messageText.trim() || isSending) && styles.sendButtonDisabled
                    ]}
                    onPress={sendMessage}
                    disabled={!messageText.trim() || isSending}
                    accessibilityLabel="Send message"
                    accessibilityRole="button"
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color={COLORS.CARD_WHITE_TEXT} />
                    ) : (
                      <Send size={20} color={COLORS.CARD_WHITE_TEXT} />
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.proposeButton} onPress={() => setCalendarVisible(true)}>
                  <Text style={styles.proposeButtonText}>Propose a Date</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
        </Animated.View>
      </GestureDetector>
      <CalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onSelect={(date) => handleCreateDateProposal(date)}
        proposedDates={proposedDates}
        acceptedDates={acceptedDates}
      />
    </PopupTrayErrorBoundary>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 999,
  },
  backdropTouchable: {
    flex: 1,
  },
  trayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: UI_NAVY,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    // Subtle outline to match other pop up handles
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  topHeader: {
    backgroundColor: UI_PINK,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topHeaderFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: UI_PINK,
    paddingHorizontal: 16,
    zIndex: 1002,
    elevation: 1002,
    justifyContent: 'flex-end',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: UI_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  initialCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: UI_BORDER,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  initialText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: UI_BORDER,
  },
  userNamePink: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: UI_BORDER,
    marginBottom: 2,
  },
  onlineText: {
    fontSize: 14,
    color: '#1FC77E',
    fontFamily: 'Geist-Regular',
  },
  zodiacBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: UI_BORDER,
  },
  zodiacIcon: { width: 36, height: 36, borderRadius: 18 },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    backgroundColor: UI_NAVY,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.SECONDARY_TEXT,
    marginTop: 12,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: UI_NAVY,
    zIndex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  myMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomRightRadius: 6,
    borderWidth: 2,
    borderColor: UI_BORDER,
  },
  otherMessage: {
    backgroundColor: UI_PINK,
    borderBottomLeftRadius: 6,
    borderWidth: 0,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    lineHeight: 22,
  },
  myMessageText: {
    color: UI_BORDER,
  },
  otherMessageText: {
    color: UI_BORDER,
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    marginTop: 4,
  },
  myMessageTime: {
    color: UI_GRAY,
    textAlign: 'right',
  },
  otherMessageTime: {
    color: UI_GRAY,
    textAlign: 'right',
  },
  bottomComposerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomComposer: {
    backgroundColor: UI_PINK,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: UI_BORDER,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: UI_BORDER,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: UI_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: UI_GRAY,
    opacity: 0.5,
  },
  proposeButton: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: UI_BORDER,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposeButtonText: {
    fontSize: 18,
    color: UI_BORDER,
    fontFamily: 'Geist-Regular',
  },
});

export default ConversationPopupTray;
