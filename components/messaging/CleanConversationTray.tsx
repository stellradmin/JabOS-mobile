import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Send, MoreVertical, UserX, Trash2 } from 'lucide-react-native';
import PopUpTray from '../PopUpTray';
import CalendarModal from './CalendarModal';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useUnmatch } from '../../src/hooks/useUnmatch';
import { getRealtimeMessagingService } from '../../src/services/realtimeMessagingService';
import { secureStorage } from '../../src/utils/secure-storage';

type SimpleMessage = {
  id: string;
  from: 'me' | 'other';
  text: string;
  stamp: string;
  readAt?: string; // Timestamp when message was read by recipient
};

interface Props {
  visible: boolean;
  onClose: () => void;
  conversationId?: string;
}

const UI_PINK = '#F2BAC9';
const UI_DARK = '#0F172A';

const CleanConversationTray: React.FC<Props> = ({ visible, onClose, conversationId }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const messagesEndRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const [kbVisible, setKbVisible] = useState(false);
  const [bottomAreaHeight, setBottomAreaHeight] = useState(0);
  const [zodiacSign, setZodiacSign] = useState<string | undefined>(undefined);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(undefined);
  const [otherUserName, setOtherUserName] = useState<string | undefined>(undefined);
  const { unmatch, deleteConversation } = useUnmatch(user?.id || '', { showAlerts: true });
  const [showReadReceipts, setShowReadReceipts] = useState<boolean>(true);
  const [messageReadReceipts, setMessageReadReceipts] = useState<Record<string, string>>({});

  const initialMessages: SimpleMessage[] = useMemo(() => [
    { id: '1', from: 'other', text: 'Hi there! I noticed you like reading too', stamp: 'Mon' },
    { id: '2', from: 'me', text: "Yes! I'm a huge book lover", stamp: 'Mon' },
    { id: '3', from: 'other', text: "What's your favorite genre?", stamp: 'Mon' },
    { id: '4', from: 'me', text: 'I love fantasy and sci-fi. How about you?', stamp: 'Mon' },
    { id: '5', from: 'other', text: "I'm more into mystery and thriller. I'll send you the book recommendation I mentioned", stamp: 'Mon' },
    { id: '6', from: 'me', text: 'How about meeting on July 13, 2025 at 1:00 PM?', stamp: 'Now' },
  ], []);
  const [messages, setMessages] = useState<SimpleMessage[]>(initialMessages);

  useEffect(() => {
    if (visible) setTimeout(() => messagesEndRef.current?.scrollToEnd({ animated: false }), 100);
  }, [visible]);

  // Track keyboard height precisely so footer can sit on top of it
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      setKbVisible(true);
      setKbHeight(e?.endCoordinates?.height || 0);
      // Ensure latest messages are visible above the composer when keyboard appears
      setTimeout(() => messagesEndRef.current?.scrollToEnd({ animated: true }), 50);
    };
    const onHide = () => {
      setKbVisible(false);
      setKbHeight(0);
    };

    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, []);

  // Map a zodiac_sign value to an emoji for the header badge
  const getZodiacEmoji = (sign?: string): string => {
    const map: Record<string, string> = {
      aries: '♈',
      taurus: '♉',
      gemini: '♊',
      cancer: '♋',
      leo: '♌',
      virgo: '♍',
      libra: '♎',
      scorpio: '♏',
      sagittarius: '♐',
      capricorn: '♑',
      aquarius: '♒',
      pisces: '♓',
    };
    if (!sign) return '✨';
    return map[sign.toLowerCase()] || '✨';
  };


  // Fetch other user's profile basics for the conversation header (name + zodiac)
  useEffect(() => {
    const fetchOtherUserBasics = async () => {
      try {
        if (!conversationId || !user?.id) return;
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('user1_id, user2_id')
          .eq('id', conversationId)
          .single();
        if (convErr || !conv) return;
        const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
        setOtherUserId(otherId);
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, zodiac_sign, avatar_url')
          .eq('id', otherId)
          .single();
        if (profErr) return;
        setZodiacSign(profile?.zodiac_sign || undefined);
        setOtherUserName(profile?.display_name || undefined);
      } catch {}
    };
    fetchOtherUserBasics();
  }, [conversationId, user?.id]);

  // Load read receipts privacy setting
  useEffect(() => {
    const loadPrivacySettings = async () => {
      try {
        if (!user?.id) return;
        const settings = await secureStorage.getSecureItem(`privacy_settings_${user.id}`);
        if (settings) {
          const parsed = JSON.parse(settings);
          setShowReadReceipts(parsed.readReceipts ?? true);
        }
      } catch {
        setShowReadReceipts(true); // Default to showing read receipts
      }
    };
    loadPrivacySettings();
  }, [user?.id]);

  // Fetch existing read receipts for messages in this conversation
  useEffect(() => {
    const fetchReadReceipts = async () => {
      try {
        if (!conversationId || !user?.id || !showReadReceipts) return;

        const { data: receipts, error } = await supabase
          .from('message_read_receipts')
          .select('message_id, read_at')
          .in('message_id', messages.map(m => m.id));

        if (error || !receipts) return;

        const receiptMap: Record<string, string> = {};
        receipts.forEach(r => {
          receiptMap[r.message_id] = r.read_at;
        });
        setMessageReadReceipts(receiptMap);
      } catch {}
    };
    fetchReadReceipts();
  }, [conversationId, user?.id, showReadReceipts, messages]);

  // Subscribe to real-time read receipt events
  useEffect(() => {
    if (!conversationId || !user?.id || !showReadReceipts) return;

    const messagingService = getRealtimeMessagingService(user.id);

    const unsubscribe = messagingService.onReadReceipt((data) => {
      // Update read receipts state when a message is read
      if (data.messageId) {
        setMessageReadReceipts(prev => ({
          ...prev,
          [data.messageId]: data.readAt,
        }));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [conversationId, user?.id, showReadReceipts]);

  const handleViewOtherProfile = () => {
    if (!otherUserId) return;
    try { onClose?.(); } catch {}
    setTimeout(() => {
      const qp = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
      router.push(`/view-profile/${otherUserId}${qp}` as any);
    }, 40);
  };

  const confirmUnmatch = () => {
    if (!otherUserId) return;
    Alert.alert(
      'Unmatch',
      `Are you sure you want to unmatch with ${otherUserName || 'this user'}? This will end the conversation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unmatch', 
          style: 'destructive', 
          onPress: async () => {
            const ok = await unmatch(otherUserId);
            if (ok) {
              try { onClose?.(); } catch {}
            }
          }
        }
      ]
    );
  };

  const confirmDeleteConversation = () => {
    if (!conversationId) return;
    Alert.alert(
      'Delete conversation',
      'Delete this conversation from your inbox? You can still rematch later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteConversation(conversationId);
            if (ok) {
              try { onClose?.(); } catch {}
            }
          }
        }
      ]
    );
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { id: String(Date.now()), from: 'me', text, stamp: 'Now' }]);
    setInput('');
    setTimeout(() => messagesEndRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleProposeDate = (date: Date) => {
    const pretty = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const t = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const msg = `How about meeting on ${pretty} at ${t}?`;
    setMessages(prev => [...prev, { id: String(Date.now()), from: 'me', text: msg, stamp: 'Now' }]);
    setTimeout(() => messagesEndRef.current?.scrollToEnd({ animated: true }), 80);
  };

  return (
    <PopUpTray
      isVisible={visible}
      onClose={onClose}
      title=""
      headerTabColor={UI_PINK}
      customHeight={0.95}
      contentBackgroundColor={UI_DARK}
      contentPaddingHorizontal={0}
      contentPaddingVertical={0}
      contentContainerPaddingBottom={0}
      safeAreaEdges={['top']}
    >
        <View style={[styles.headerRow, { paddingTop: 4 }]}> 
          <TouchableOpacity style={styles.circleBtn} onPress={onClose} accessibilityLabel="Back">
            <ArrowLeft size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleViewOtherProfile} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} accessibilityLabel="View profile">
            <View style={styles.initialCircle}><Text style={styles.initialText}>{(otherUserName?.charAt(0) || 'O')}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{otherUserName || 'Profile'}</Text>
              <Text style={styles.online}>Online</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.rightIcons}>
            <View style={styles.iconBadge} accessibilityLabel={`Zodiac ${zodiacSign || 'unknown'}`}>
              <Text style={styles.zodiacEmoji}>{getZodiacEmoji(zodiacSign)}</Text>
            </View>
            <TouchableOpacity style={styles.menuBtn} onPress={() => {
              // Simple inline action sheet via Alert with options
              Alert.alert(
                'Conversation options',
                undefined,
                [
                  { text: 'Unmatch', onPress: confirmUnmatch },
                  { text: 'Delete Conversation', onPress: confirmDeleteConversation },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }} accessibilityLabel="Conversation options">
              <MoreVertical size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={messagesEndRef}
          style={styles.messages}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: Math.max(bottomAreaHeight + 16, 24),
          }}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(m => {
            const readAt = messageReadReceipts[m.id];
            const isRead = showReadReceipts && m.from === 'me' && readAt;

            return (
              <View key={m.id} style={[styles.bubble, m.from === 'me' ? styles.bubbleMe : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, m.from === 'me' ? styles.bubbleTextMe : styles.bubbleTextOther]}>{m.text}</Text>
                <View style={styles.messageFooter}>
                  <Text style={[styles.stamp, m.from === 'me' ? styles.stampMe : styles.stampOther]}>{m.stamp}</Text>
                  {showReadReceipts && m.from === 'me' && (
                    <Text style={isRead ? styles.readText : styles.deliveredText}>
                      {isRead ? 'Read' : 'Delivered'}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View
          onLayout={(e) => setBottomAreaHeight(e.nativeEvent.layout.height)}
          style={[
            styles.bottomArea,
            {
              // Sit exactly above the keyboard when visible, otherwise extend footer when closed
              paddingBottom: kbVisible 
                ? kbHeight + 8 
                : Math.max(insets.bottom + 24, 24),
            },
          ]}
        >
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder="Type a message to send..."
              placeholderTextColor="#999"
              value={input}
              onChangeText={setInput}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} accessibilityLabel="Send">
              <Send size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.proposeBtn} onPress={() => setCalendarVisible(true)}>
            <Text style={styles.proposeText}>Propose a Date</Text>
          </TouchableOpacity>
        </View>

      <CalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onSelect={(d) => { setCalendarVisible(false); if (d) handleProposeDate(d as Date); }}
        proposedDates={[]}
        acceptedDates={[]}
      />
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    backgroundColor: UI_PINK,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  circleBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  initialCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  initialText: { fontSize: 18, fontFamily: 'Geist-Regular', color: '#000' },
  userName: { fontSize: 18, fontFamily: 'Geist-Regular', color: '#000' },
  online: { fontSize: 14, color: '#10B981', marginTop: 2 },
  iconBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },
  rightIcons: { flexDirection: 'row', alignItems: 'center' },
  menuBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  zodiacEmoji: { fontSize: 24, lineHeight: 28 },
  messages: { flex: 1, paddingHorizontal: 16, backgroundColor: UI_DARK },
  bubble: {
    maxWidth: '82%', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20, marginBottom: 12,
  },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: UI_PINK, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderBottomLeftRadius: 20, borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMe: { color: '#000' },
  bubbleTextOther: { color: '#000' },
  stamp: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  stampMe: { color: '#666' },
  stampOther: {},
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  readText: {
    fontSize: 11,
    color: '#10B981',
    fontFamily: 'Geist-Regular',
  },
  deliveredText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Geist-Regular',
  },
  bottomArea: { backgroundColor: UI_PINK, paddingTop: 8, paddingHorizontal: 16 },
  composerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: {
    flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, marginRight: 12,
    fontSize: 16, minHeight: 48, maxHeight: 120,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  proposeBtn: {
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  proposeText: { fontSize: 18, fontFamily: 'Geist-Regular', color: '#000' },
});

export default CleanConversationTray;
