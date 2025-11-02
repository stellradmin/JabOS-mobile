import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowLeft, MessageSquare } from "lucide-react-native";
import { WHITE_CARD_STYLES, COLORS } from '../../constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessaging } from '../../src/contexts/MessagingContext';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";

interface MessageItemProps {
  initial: string;
  name: string;
  message: string;
  time: string;
  matchDate: string;
  messageCount: number;
  unreadCount: number;
  isOnline?: boolean;
  conversationId?: string;
  avatarUrl?: string;
  onPress?: (conversationId: string) => void;
}

const MessageItem = ({
  initial,
  name,
  message,
  time,
  matchDate,
  messageCount,
  unreadCount,
  isOnline,
  conversationId,
  avatarUrl,
  onPress,
}: MessageItemProps) => {
  const router = useRouter();
  const { markConversationAsRead } = useMessaging();

  const handlePress = () => {
    if (conversationId) {
      markConversationAsRead(conversationId);
      if (onPress) {
        onPress(conversationId);
      } else {
        // Fallback to navigation if no callback provided
        router.push(`/conversation?conversationId=${conversationId}`);
      }
    } else {
      logWarn('No conversation ID available', "Warning");
    }
  };

  return (
    <TouchableOpacity style={styles.messageCard} onPress={handlePress}>
      <View style={styles.messageHeader}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={styles.avatarImage}
                onError={() => logDebug('Failed to load avatar in messenger', "Debug")}
              />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.messageContent}>
          <View style={styles.nameTimeRow}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.timeText}>{time}</Text>
          </View>
          <Text style={styles.messageText} numberOfLines={1}>
            {message}
          </Text>
          <View style={styles.divider} />
          <View style={styles.tagsRow}>
            <View style={styles.matchTag}>
              <Text style={styles.matchTagText}>Matched {matchDate}</Text>
            </View>
            <View style={styles.tagsRightSection}>
              <View style={styles.messageCountTag}>
                <MessageSquare size={12} color={COLORS.SECONDARY_TEXT} />
                <Text style={styles.messageCountText}>{messageCount}</Text>
              </View>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface MessagesCardProps {
  userName?: string;
  onConversationPress?: (conversationId: string) => void;
}

const MessagesCard: React.FC<MessagesCardProps> = ({
  userName = 'Friend',
  onConversationPress,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, unreadCounts } = useMessaging();

  return (
    <View 
      style={[
        styles.container,
        WHITE_CARD_STYLES,
        styles.topCardRounding,
        styles.noShadow, // Remove drop shadow on top card
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={COLORS.DARK_TEXT} />
        </TouchableOpacity>
      </View>

      {/* Title Section */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Connect with your matches</Text>
      </View>

      {/* Messages List */}
      <ScrollView 
        style={styles.messagesScrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
      >
        {conversations.length > 0 ? (
          conversations.map((item) => {
            const otherUser = item.user1?.id === user?.id ? item.user2 : item.user1;
            if (!otherUser) return null;
            
            return (
              <MessageItem
                key={item.id}
                initial={otherUser.display_name ? otherUser.display_name.charAt(0).toUpperCase() : "U"}
                name={otherUser.display_name || "Unknown User"}
                message={item.last_message_preview || "No messages yet"}
                time={item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ""}
                matchDate={new Date(item.created_at).toLocaleDateString()}
                messageCount={0}
                unreadCount={unreadCounts[item.id] || 0}
                isOnline={false}
                conversationId={item.id}
                avatarUrl={otherUser.avatar_url}
                onPress={onConversationPress}
              />
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={COLORS.SECONDARY_TEXT} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyStateTitle}>No conversations yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start matching with people to begin conversations!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    height: screenHeight * 0.5 + 100, // Combined height of zodiac + date activity blocks
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginHorizontal: 0,
    marginBottom: 0,
    justifyContent: 'flex-start',
  },
  topCardRounding: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  noShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36, // Keep size for touch target
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: { marginBottom: 24 },
  title: {
    fontSize: 32, // Match Profile title size
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18, // Match Profile subtitle size
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 24,
  },
  messagesScrollView: {
    flex: 1,
    marginHorizontal: -20, // Extend to card edges
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageCard: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    // Stronger outer border for visibility
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    borderStyle: 'solid',
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 10,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.WHITE_CARD,
    alignItems: "center",
    justifyContent: "center",
    // Stronger circular outline around initial/avatar
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    borderStyle: 'solid',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    backgroundColor: COLORS.SECONDARY_TEXT,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.WHITE_CARD,
  },
  messageContent: {
    flex: 1,
  },
  nameTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  userName: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'Geist-Medium',
  },
  messageText: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 6,
    fontFamily: 'Geist-Regular',
  },
  divider: {
    // Stronger middle separator line
    height: 1.25,
    backgroundColor: COLORS.PRIMARY_BLACK,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchTag: {
    backgroundColor: COLORS.TAG_BG,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchTagText: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'Geist-Medium',
  },
  messageCountTag: {
    backgroundColor: COLORS.TAG_BG,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  messageCountText: {
    fontSize: 11,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'Geist-Medium',
  },
  tagsRightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  unreadBadgeText: {
    fontSize: 11,
    color: COLORS.DARK_TEXT,
    fontFamily: 'Geist-Medium',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default MessagesCard;
