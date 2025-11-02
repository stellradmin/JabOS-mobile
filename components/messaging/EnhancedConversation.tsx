import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  Pressable,
  AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  ArrowLeft, 
  Send, 
  Camera, 
  Image as ImageIcon, 
  Smile,
  MoreVertical,
  Phone,
  Video,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessaging } from '../../src/contexts/MessagingContext';
import { getRealtimeMessagingService } from '../../src/services/realtimeMessagingService';
import { useDatingAppTracking } from '../../src/hooks/usePerformanceMonitoring';
import { logger } from '../../src/utils/logger';
import { COLORS } from '../../constants/theme';

// Components
import TypingIndicator from './TypingIndicator';
import ReadReceipts from './ReadReceipts';
import OnlinePresence, { PresenceAvatarOverlay } from './OnlinePresence';
import MessageReactions, { QuickReactions } from './MessageReactions';
import PhotoMessage, { PhotoPicker, PhotoViewer } from './PhotoMessage';

const { width: screenWidth } = Dimensions.get('window');

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  message_type: 'text' | 'photo' | 'system';
  media_url?: string;
  media_type?: string;
  is_read?: boolean;
  read_at?: string;
  reactions?: {
    emoji: string;
    count: number;
    userIds: string[];
    hasCurrentUser: boolean;
  }[];
  delivery_status?: 'sent' | 'delivered' | 'read';
  photo_metadata?: {
    width: number;
    height: number;
    size: number;
  };
  photo_caption?: string;
}

interface ConversationUser {
  id: string;
  display_name: string;
  avatar_url?: string;
  zodiac_sign?: string;
  is_online?: boolean;
  last_seen?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export default function EnhancedConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { markConversationAsRead, updateConversationPreview } = useMessaging();
  const { trackMessagingAction } = useDatingAppTracking();
  
  // State
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<ConversationUser | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const [quickReactionPosition, setQuickReactionPosition] = useState({ x: 0, y: 0 });
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  // Real-time features
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeService = useRef(getRealtimeMessagingService());

  // Initialize conversation
  useEffect(() => {
    const convId = params.conversationId as string;
    if (convId && user) {
      setConversationId(convId);
      initializeConversation(convId);
    }
  }, [params.conversationId, user]);

  // Initialize real-time messaging
  useEffect(() => {
    if (user && conversationId) {
      setupRealtimeMessaging();
    }

    return () => {
      cleanupRealtimeMessaging();
    };
  }, [user, conversationId]);

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // App state handling for online presence
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        realtimeService.current?.updateOnlineStatus('online');
      } else if (nextAppState === 'background') {
        realtimeService.current?.updateOnlineStatus('away');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const initializeConversation = async (convId: string) => {
    try {
      await Promise.all([
        fetchMessages(convId),
        fetchOtherUser(convId),
      ]);
      markConversationAsRead(convId);
    } catch (error) {
      logger.error('Failed to initialize conversation', error instanceof Error ? error : undefined, { convId }, 'MESSAGING');
    }
  };

  const setupRealtimeMessaging = async () => {
    if (!user || !conversationId) return;

    try {
      await realtimeService.current.initialize(user.id);

      // Set up event listeners
      const unsubscribeTyping = realtimeService.current.onTyping((data) => {
        if (data.conversationId === conversationId && data.userId !== user.id) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (data.isTyping) {
              newSet.add(data.userId);
            } else {
              newSet.delete(data.userId);
            }
            return newSet;
          });
        }
      });

      const unsubscribeReadReceipt = realtimeService.current.onReadReceipt((data) => {
        if (data.userId !== user.id) {
          updateMessageReadStatus(data.messageId, data.userId, data.readAt);
        }
      });

      const unsubscribeDelivery = realtimeService.current.onMessageDelivery((data) => {
        updateMessageDeliveryStatus(data.messageId, data.status);
      });

      const unsubscribeReaction = realtimeService.current.onMessageReaction((data) => {
        updateMessageReaction(data.messageId, data.userId, data.reaction);
      });

      // Store unsubscribe functions for cleanup
      return () => {
        unsubscribeTyping();
        unsubscribeReadReceipt();
        unsubscribeDelivery();
        unsubscribeReaction();
      };
    } catch (error) {
      logger.error('Failed to setup real-time messaging', error instanceof Error ? error : undefined, { conversationId }, 'MESSAGING');
    }
  };

  const cleanupRealtimeMessaging = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    realtimeService.current?.cleanup();
  };

  const fetchOtherUser = async (convId: string) => {
    if (!user) return;
    
    try {
      const { data: conversationData, error: convError } = await supabase
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', convId)
        .single();
        
      if (convError) throw convError;

      const otherUserId = conversationData.user1_id === user.id 
        ? conversationData.user2_id 
        : conversationData.user1_id;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, zodiac_sign')
        .eq('id', otherUserId)
        .single();

      if (profileError) throw profileError;

      setOtherUser({
        id: profileData.id,
        display_name: profileData.display_name || 'Unknown User',
        avatar_url: profileData.avatar_url,
        zodiac_sign: profileData.zodiac_sign,
      });
      
    } catch (error) {
      logger.error('Failed to fetch other user', error instanceof Error ? error : undefined, { convId }, 'MESSAGING');
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(50); // Load last 50 messages initially

      if (error) throw error;

      setMessages(data || []);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
      
    } catch (error) {
      logger.error('Failed to fetch messages', error instanceof Error ? error : undefined, { convId }, 'MESSAGING');
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    
    // Handle typing indicators
    if (text.trim() && !isTyping) {
      setIsTyping(true);
      realtimeService.current?.startTyping(conversationId!);
    }
    
    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      realtimeService.current?.stopTyping(conversationId!);
    }, 1000);
  };

  const sendTextMessage = async () => {
    if (inputText.trim() === '' || !conversationId || !user || loading) return;
    
    const messageContent = inputText.trim();
    setLoading(true);
    setInputText('');
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      realtimeService.current?.stopTyping(conversationId);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          conversation_id: conversationId,
          content: messageContent,
          message_type: 'text',
        }
      });

      if (error) throw error;

      // Track message sent
      trackMessagingAction('send_message', conversationId, {
        messageType: 'text',
        messageLength: messageContent.length,
        hasMedia: false,
        timestamp: new Date().toISOString()
      });
      
      updateConversationPreview(conversationId, messageContent, new Date().toISOString());
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error) {
      logger.error('Failed to send message', error instanceof Error ? error : undefined, { conversationId }, 'MESSAGING');
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setInputText(messageContent); // Restore text on error
    } finally {
      setLoading(false);
    }
  };


  const sendPhotoMessage = async (photoUri: string, caption?: string) => {
    if (!conversationId || !user) return;

    try {
      setLoading(true);
      
      // Upload photo and send message
      const { data, error } = await supabase.functions.invoke('send-photo-message', {
        body: {
          conversation_id: conversationId,
          photo_uri: photoUri,
          caption,
        }
      });

      if (error) throw error;

      trackMessagingAction('send_message', conversationId, {
        messageType: 'photo',
        hasCaption: !!caption,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Failed to send photo message', error instanceof Error ? error : undefined, { conversationId }, 'MESSAGING');
      Alert.alert('Error', 'Failed to send photo');
    } finally {
      setLoading(false);
      setShowPhotoPicker(false);
    }
  };

  const handleMessageLongPress = (messageId: string, position: { x: number; y: number }) => {
    setSelectedMessageId(messageId);
    setQuickReactionPosition(position);
    setShowQuickReactions(true);
  };

  const handleQuickReaction = (emoji: string) => {
    if (selectedMessageId && conversationId) {
      realtimeService.current?.addMessageReaction(selectedMessageId, emoji, conversationId);
    }
    setShowQuickReactions(false);
    setSelectedMessageId(null);
  };

  const updateMessageReadStatus = (messageId: string, userId: string, readAt: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, is_read: true, read_at: readAt }
        : msg
    ));
  };

  const updateMessageDeliveryStatus = (messageId: string, status: 'sent' | 'delivered' | 'read') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, delivery_status: status }
        : msg
    ));
  };

  const updateMessageReaction = (messageId: string, userId: string, reaction: string | null) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const reactions = msg.reactions || [];
      if (reaction) {
        // Add or update reaction
        const existingReactionIndex = reactions.findIndex(r => r.emoji === reaction);
        if (existingReactionIndex >= 0) {
          const existingReaction = reactions[existingReactionIndex];
          if (!existingReaction.userIds.includes(userId)) {
            existingReaction.userIds.push(userId);
            existingReaction.count++;
            existingReaction.hasCurrentUser = existingReaction.userIds.includes(user?.id || '');
          }
        } else {
          reactions.push({
            emoji: reaction,
            count: 1,
            userIds: [userId],
            hasCurrentUser: userId === user?.id,
          });
        }
      } else {
        // Remove reaction
        msg.reactions = reactions.filter(r => !r.userIds.includes(userId));
      }
      
      return { ...msg, reactions };
    }));
  };

  const renderMessage = (message: Message) => {
    const isFromCurrentUser = message.sender_id === user?.id;
    const messageTime = new Date(message.created_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const handleMessagePress = () => {
      if (message.message_type === 'photo' && message.media_url) {
        setSelectedPhotoUri(message.media_url);
        setShowPhotoViewer(true);
      }
    };

    const handleMessageLongPressHandler = (event: any) => {
      const { pageX, pageY } = event.nativeEvent;
      handleMessageLongPress(message.id, { x: pageX, y: pageY });
    };

    return (
      <Pressable
        key={message.id}
        onPress={handleMessagePress}
        onLongPress={handleMessageLongPressHandler}
        style={[
          styles.messageWrapper,
          isFromCurrentUser ? styles.ownMessageWrapper : styles.otherMessageWrapper
        ]}
      >
        <View style={[
          styles.messageContainer,
          isFromCurrentUser ? styles.sentMessage : styles.receivedMessage
        ]}>
          {message.message_type === 'text' && (
            <>
              <Text style={isFromCurrentUser ? styles.sentText : styles.receivedText}>
                {message.content}
              </Text>
              <Text style={[styles.timeText, isFromCurrentUser && styles.sentTimeText]}>
                {messageTime}
              </Text>
            </>
          )}
          
          
          
          {message.message_type === 'photo' && (
            <PhotoMessage
              messageId={message.id}
              imageUri={message.media_url!}
              caption={message.photo_caption}
              metadata={message.photo_metadata}
              isFromCurrentUser={isFromCurrentUser}
              timestamp={message.created_at}
              onImagePress={handleMessagePress}
            />
          )}
          
          {/* Read receipts for sent messages */}
          {isFromCurrentUser && showReadReceipts && (
            <ReadReceipts
              messageId={message.id}
              senderId={message.sender_id}
              currentUserId={user?.id || ''}
              deliveryStatus={message.delivery_status || 'sent'}
              readAt={message.read_at}
              showReadReceipts={showReadReceipts}
            />
          )}
        </View>

        {/* Message reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <MessageReactions
            messageId={message.id}
            reactions={message.reactions}
            onReactionPress={(emoji) => 
              realtimeService.current?.addMessageReaction(message.id, emoji, conversationId!)
            }
            onReactionRemove={(emoji) => 
              realtimeService.current?.removeMessageReaction(message.id, conversationId!)
            }
            currentUserId={user?.id || ''}
            isOwnMessage={isFromCurrentUser}
          />
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="black" />
          </TouchableOpacity>

          <View style={styles.avatarContainer}>
            {otherUser?.avatar_url ? (
              <Image 
                source={{ uri: otherUser.avatar_url }} 
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {otherUser?.display_name ? otherUser.display_name.charAt(0).toUpperCase() : "U"}
              </Text>
            )}
            {showOnlineStatus && otherUser && (
              <PresenceAvatarOverlay
                isOnline={otherUser.is_online || false}
                lastSeen={otherUser.last_seen}
                status={otherUser.status}
              />
            )}
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{otherUser?.display_name || "Loading..."}</Text>
            {showOnlineStatus && otherUser && (
              <OnlinePresence
                userId={otherUser.id}
                showLastSeen
                showOnlineStatus
                size="small"
              />
            )}
          </View>

          <TouchableOpacity style={styles.actionButton}>
            <Phone size={20} color="black" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Video size={20} color="black" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MoreVertical size={20} color="black" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageContainer}
          contentContainerStyle={{ 
            paddingBottom: keyboardHeight > 0 ? (keyboardHeight / 4) + 20 : 100,
            flexGrow: 1 
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {messages.map(renderMessage)}
          
          {/* Typing indicator */}
          <TypingIndicator
            userName={otherUser?.display_name}
            isVisible={typingUsers.size > 0}
          />
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          {/* Media buttons */}
          <View style={styles.mediaButtons}>
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={() => setShowPhotoPicker(true)}
            >
              <Camera size={20} color={COLORS.SECONDARY_TEXT} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.mediaButton}
              onPress={() => setShowPhotoPicker(true)}
            >
              <ImageIcon size={20} color={COLORS.SECONDARY_TEXT} />
            </TouchableOpacity>
          </View>

          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            returnKeyType="send"
            onSubmitEditing={sendTextMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={sendTextMessage}
            disabled={loading || !inputText.trim()}
          >
            <Send size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <PhotoPicker
          visible={showPhotoPicker}
          onClose={() => setShowPhotoPicker(false)}
          onPhotoSelected={sendPhotoMessage}
        />

        <PhotoViewer
          visible={showPhotoViewer}
          imageUri={selectedPhotoUri || ''}
          onClose={() => {
            setShowPhotoViewer(false);
            setSelectedPhotoUri(null);
          }}
        />

        

        <QuickReactions
          messageId={selectedMessageId || ''}
          onReactionSelect={handleQuickReaction}
          visible={showQuickReactions}
          onClose={() => setShowQuickReactions(false)}
          position={quickReactionPosition}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    backgroundColor: "#F2BAC9",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 64 : 50,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    marginRight: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2BAC9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    marginBottom: 2,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    marginLeft: 8,
  },
  messageContainer: {
    flex: 1,
    padding: 16,
  },
  messageWrapper: {
    marginBottom: 12,
  },
  ownMessageWrapper: {
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
  },
  receivedMessage: {
    backgroundColor: "#F2BAC9",
    borderRadius: 16,
    padding: 16,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sentMessage: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    maxWidth: "80%",
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  receivedText: {
    color: "black",
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
  sentText: {
    color: "black",
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
  timeText: {
    fontSize: 12,
    color: "#6b7280",
    alignSelf: "flex-end",
    marginTop: 4,
    fontFamily: 'Geist-Medium',
  },
  sentTimeText: {
    color: "#666",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: "#F2BAC9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 4,
  },
  mediaButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.SECONDARY_TEXT,
  },
  textInput: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: "black",
    minHeight: 44,
    maxHeight: 120,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  
});
