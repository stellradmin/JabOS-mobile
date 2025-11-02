import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

interface ReadReceiptsProps {
  messageId: string;
  senderId: string;
  currentUserId: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  readAt?: string;
  showReadReceipts: boolean;
}

const ReadReceipts: React.FC<ReadReceiptsProps> = ({
  messageId,
  senderId,
  currentUserId,
  deliveryStatus,
  readAt,
  showReadReceipts,
}) => {
  // Only show read receipts for messages sent by current user
  if (senderId !== currentUserId || !showReadReceipts) {
    return null;
  }

  const getStatusIcon = () => {
    switch (deliveryStatus) {
      case 'sent':
        return <Check size={12} color={COLORS.SECONDARY_TEXT} />;
      case 'delivered':
        return <CheckCheck size={12} color={COLORS.SECONDARY_TEXT} />;
      case 'read':
        return <CheckCheck size={12} color={COLORS.SUCCESS} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (deliveryStatus) {
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return readAt ? `Read ${formatReadTime(readAt)}` : 'Read';
      default:
        return '';
    }
  };

  const formatReadTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        {getStatusIcon()}
        <Text style={styles.statusText}>
          {getStatusText()}
        </Text>
      </View>
    </View>
  );
};

interface MessageReadStatusProps {
  isRead: boolean;
  readBy?: {
    userId: string;
    userName: string;
    readAt: string;
  }[];
  showReadReceipts: boolean;
}

export const MessageReadStatus: React.FC<MessageReadStatusProps> = ({
  isRead,
  readBy = [],
  showReadReceipts,
}) => {
  if (!showReadReceipts || !isRead || readBy.length === 0) {
    return null;
  }

  return (
    <View style={styles.readByContainer}>
      <Text style={styles.readByText}>
        Read by {readBy.length === 1 
          ? readBy[0].userName 
          : `${readBy.length} people`}
      </Text>
    </View>
  );
};

interface ReadReceiptAvatarsProps {
  readBy: {
    userId: string;
    userName: string;
    avatarUrl?: string;
    readAt: string;
  }[];
  maxAvatars?: number;
  showReadReceipts: boolean;
}

export const ReadReceiptAvatars: React.FC<ReadReceiptAvatarsProps> = ({
  readBy,
  maxAvatars = 3,
  showReadReceipts,
}) => {
  if (!showReadReceipts || readBy.length === 0) {
    return null;
  }

  const displayAvatars = readBy.slice(0, maxAvatars);
  const remainingCount = readBy.length - maxAvatars;

  return (
    <View style={styles.avatarContainer}>
      {displayAvatars.map((reader, index) => (
        <View
          key={reader.userId}
          style={[
            styles.avatar,
            index > 0 && styles.overlappingAvatar,
          ]}
        >
          <Text style={styles.avatarText}>
            {reader.userName.charAt(0).toUpperCase()}
          </Text>
        </View>
      ))}
      {remainingCount > 0 && (
        <View style={[styles.avatar, styles.overlappingAvatar, styles.countAvatar]}>
          <Text style={styles.countText}>
            +{remainingCount}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'Geist-Regular',
  },
  readByContainer: {
    marginTop: 4,
    alignItems: 'center',
  },
  readByText: {
    fontSize: 10,
    color: COLORS.SUCCESS,
    fontFamily: 'Geist-Medium',
    fontStyle: 'italic',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.YELLOW_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.WHITE_CARD,
  },
  overlappingAvatar: {
    marginLeft: -6,
  },
  countAvatar: {
    backgroundColor: COLORS.SECONDARY_TEXT,
  },
  avatarText: {
    fontSize: 8,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  countText: {
    fontSize: 7,
    fontFamily: 'Geist-Regular',
    color: COLORS.WHITE_CARD,
  },
});

export default ReadReceipts;