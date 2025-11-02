import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';
import { supabase } from '../../src/lib/supabase';
import { logger } from '../../src/utils/logger';

interface OnlinePresenceProps {
  userId: string;
  showLastSeen?: boolean;
  showOnlineStatus?: boolean;
  size?: 'small' | 'medium' | 'large';
}

interface PresenceData {
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
  updatedAt: string;
}

const OnlinePresence: React.FC<OnlinePresenceProps> = ({
  userId,
  showLastSeen = true,
  showOnlineStatus = true,
  size = 'medium',
}) => {
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPresence();
    setupPresenceSubscription();

    return () => {
      // Cleanup subscription would go here
    };
  }, [userId]);

  const fetchPresence = async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('status, last_seen, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        // User might not have presence data yet
        if (error.code !== 'PGRST116') {
          logger.error('Failed to fetch user presence', error, { userId }, 'MESSAGING');
        }
        setPresence({ status: 'offline', lastSeen: '', updatedAt: '' });
      } else {
        const d: any = data;
        setPresence({
          status: d.status,
          lastSeen: d.last_seen || '',
          updatedAt: d.updated_at || '',
        });
      }
    } catch (error) {
      logger.error('Unexpected error fetching presence', error instanceof Error ? error : undefined, { userId }, 'MESSAGING');
      setPresence({ status: 'offline', lastSeen: '', updatedAt: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const setupPresenceSubscription = () => {
    const subscription = supabase
      .channel(`user_presence:${userId}`)
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new) {
            const p: any = payload.new;
            setPresence({
              status: p.status,
              lastSeen: p.last_seen || '',
              updatedAt: p.updated_at || '',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return COLORS.SUCCESS;
      case 'away':
        return '#C8A8E9'; // Lavender
      case 'busy':
        return '#FF4444'; // Red
      case 'offline':
      default:
        return COLORS.SECONDARY_TEXT;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  const formatLastSeen = (lastSeen: string): string => {
    if (!lastSeen) return '';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
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

  const isOnline = presence?.status === 'online';
  const isRecent = presence?.lastSeen && 
    (new Date().getTime() - new Date(presence.lastSeen).getTime()) < 5 * 60 * 1000; // 5 minutes

  if (isLoading || !showOnlineStatus) {
    return null;
  }

  const indicatorSize = {
    small: 8,
    medium: 12,
    large: 16,
  }[size];

  const textSize = {
    small: 10,
    medium: 12,
    large: 14,
  }[size];

  return (
    <View style={styles.container}>
      {/* Status indicator dot */}
      <View 
        style={[
          styles.statusIndicator, 
          { 
            width: indicatorSize,
            height: indicatorSize,
            borderRadius: indicatorSize / 2,
            backgroundColor: getStatusColor(presence?.status || 'offline'),
            opacity: isOnline || isRecent ? 1 : 0.5,
          }
        ]} 
      />
      
      {/* Status text */}
      {showLastSeen && (
        <Text style={[styles.statusText, { fontSize: textSize }]}>
          {isOnline 
            ? getStatusText(presence?.status || 'offline')
            : presence?.lastSeen
              ? `Last seen ${formatLastSeen(presence.lastSeen)}`
              : 'Last seen long ago'
          }
        </Text>
      )}
    </View>
  );
};

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'small' | 'medium' | 'large';
  showBorder?: boolean;
}

export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({
  isOnline,
  size = 'medium',
  showBorder = true,
}) => {
  const indicatorSize = {
    small: 8,
    medium: 12,
    large: 16,
  }[size];

  return (
    <View 
      style={[
        styles.onlineIndicator,
        {
          width: indicatorSize,
          height: indicatorSize,
          borderRadius: indicatorSize / 2,
          backgroundColor: isOnline ? COLORS.SUCCESS : 'transparent',
          borderWidth: showBorder ? 2 : 0,
          borderColor: COLORS.WHITE_CARD,
        }
      ]} 
    />
  );
};

interface PresenceAvatarOverlayProps {
  isOnline: boolean;
  lastSeen?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export const PresenceAvatarOverlay: React.FC<PresenceAvatarOverlayProps> = ({
  isOnline,
  lastSeen,
  status = 'offline',
}) => {
  const isRecent = lastSeen && 
    (new Date().getTime() - new Date(lastSeen).getTime()) < 15 * 60 * 1000; // 15 minutes

  const shouldShow = isOnline || isRecent;

  if (!shouldShow) return null;

  return (
    <View style={styles.avatarOverlay}>
      <View 
        style={[
          styles.avatarIndicator,
          { backgroundColor: getStatusColor(isOnline ? status : 'away') }
        ]} 
      />
    </View>
  );
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online':
      return COLORS.SUCCESS;
    case 'away':
      return '#C8A8E9';
    case 'busy':
      return '#FF4444';
    default:
      return COLORS.SECONDARY_TEXT;
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'Geist-Medium',
  },
  onlineIndicator: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  avatarIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.WHITE_CARD,
  },
});

export default OnlinePresence;
