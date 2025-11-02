import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Pressable,
  Animated,
  Modal,
  Dimensions,
  Platform 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Smile, Plus } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
  hasCurrentUser: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  reactions: Reaction[];
  onReactionPress: (emoji: string) => void;
  onReactionRemove: (emoji: string) => void;
  currentUserId: string;
  isOwnMessage: boolean;
}

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  position: { x: number; y: number };
}

const COMMON_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡',
  '🔥', '👏', '🎉', '💯', '✨', '⚡',
  '💕', '😍', '🤩', '😊', '😎', '🤔',
  '👌', '🙌', '💪', '🤝', '👊', '✊',
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onEmojiSelect,
  position,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Calculate picker position to stay within screen bounds
  const getPickerPosition = () => {
    const pickerWidth = 280;
    const pickerHeight = 200;
    
    let x = position.x - pickerWidth / 2;
    let y = position.y - pickerHeight - 20;
    
    // Ensure picker stays within horizontal bounds
    if (x < 20) x = 20;
    if (x + pickerWidth > screenWidth - 20) x = screenWidth - pickerWidth - 20;
    
    // Ensure picker stays within vertical bounds
    if (y < 50) y = position.y + 40;
    if (y + pickerHeight > screenHeight - 50) y = screenHeight - pickerHeight - 50;
    
    return { x, y };
  };

  const pickerPosition = getPickerPosition();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.emojiModalOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.emojiPicker,
            {
              left: pickerPosition.x,
              top: pickerPosition.y,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <BlurView intensity={80} style={styles.emojiPickerBlur}>
            <View style={styles.emojiGrid}>
              {COMMON_EMOJIS.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => {
                    onEmojiSelect(emoji);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  reactions,
  onReactionPress,
  onReactionRemove,
  currentUserId,
  isOwnMessage,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const addButtonRef = useRef<any>(null);

  const handleAddReaction = () => {
    if (addButtonRef.current) {
      addButtonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setPickerPosition({ x: x + width / 2, y: y });
        setShowEmojiPicker(true);
      });
    }
  };

  const handleReactionPress = (reaction: Reaction) => {
    if (reaction.hasCurrentUser) {
      onReactionRemove(reaction.emoji);
    } else {
      onReactionPress(reaction.emoji);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onReactionPress(emoji);
  };

  if (reactions.length === 0) {
    return (
      <View style={styles.reactionsContainer}>
        <TouchableOpacity
          ref={addButtonRef}
          style={styles.addReactionButton}
          onPress={handleAddReaction}
          activeOpacity={0.7}
        >
          <Smile size={16} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>
        
        <EmojiPicker
          visible={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
          position={pickerPosition}
        />
      </View>
    );
  }

  return (
    <View style={styles.reactionsContainer}>
      <View style={[
        styles.reactionsRow,
        isOwnMessage ? styles.ownMessageReactions : styles.otherMessageReactions
      ]}>
        {reactions.map((reaction, index) => (
          <TouchableOpacity
            key={`${reaction.emoji}-${index}`}
            style={[
              styles.reactionBubble,
              reaction.hasCurrentUser && styles.userReactionBubble,
            ]}
            onPress={() => handleReactionPress(reaction)}
            activeOpacity={0.8}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={[
                styles.reactionCount,
                reaction.hasCurrentUser && styles.userReactionCount,
              ]}>
                {reaction.count}
              </Text>
            )}
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity
          ref={addButtonRef}
          style={styles.addReactionButtonSmall}
          onPress={handleAddReaction}
          activeOpacity={0.7}
        >
          <Plus size={12} color={COLORS.SECONDARY_TEXT} />
        </TouchableOpacity>
      </View>

      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        position={pickerPosition}
      />
    </View>
  );
};

interface QuickReactionsProps {
  messageId: string;
  onReactionSelect: (emoji: string) => void;
  visible: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export const QuickReactions: React.FC<QuickReactionsProps> = ({
  messageId,
  onReactionSelect,
  visible,
  onClose,
  position,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢'];

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.quickReactions,
        {
          left: position.x - 150,
          top: position.y - 60,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <BlurView intensity={80} style={styles.quickReactionsBlur}>
        <View style={styles.quickReactionsContainer}>
          {quickEmojis.map((emoji, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickReactionButton}
              onPress={() => {
                onReactionSelect(emoji);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.quickReactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  reactionsContainer: {
    marginTop: 4,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  ownMessageReactions: {
    justifyContent: 'flex-end',
  },
  otherMessageReactions: {
    justifyContent: 'flex-start',
  },
  reactionBubble: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 24,
  },
  userReactionBubble: {
    backgroundColor: COLORS.YELLOW_CARD,
    borderColor: COLORS.DARK_TEXT,
  },
  reactionEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  reactionCount: {
    fontSize: 10,
    fontFamily: 'Geist-Medium',
    color: COLORS.SECONDARY_TEXT,
    minWidth: 10,
    textAlign: 'center',
  },
  userReactionCount: {
    color: COLORS.DARK_TEXT,
  },
  addReactionButton: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.SECONDARY_TEXT,
    borderStyle: 'dashed',
  },
  addReactionButtonSmall: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 12,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.SECONDARY_TEXT,
    borderStyle: 'dashed',
    minHeight: 24,
  },
  emojiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  emojiPicker: {
    position: 'absolute',
    width: 280,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  emojiPickerBlur: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  emojiGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  emojiButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  emojiText: {
    fontSize: 20,
  },
  quickReactions: {
    position: 'absolute',
    borderRadius: 25,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  quickReactionsBlur: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  quickReactionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  quickReactionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickReactionEmoji: {
    fontSize: 20,
  },
});

export default MessageReactions;
