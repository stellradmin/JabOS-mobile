import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logger, logMessaging } from '../utils/logger';
import * as Sentry from '@sentry/react-native';
import { secureStorage } from '../utils/secure-storage';

// Types for real-time messaging features
export interface TypingIndicator {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  timestamp: string;
}

export interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
}

export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: string;
  status?: 'online' | 'away' | 'busy' | 'invisible';
}

export interface MessageDelivery {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export interface MessageReaction {
  messageId: string;
  userId: string;
  reaction: string;
  timestamp: string;
}

 

export interface PhotoMessage {
  id: string;
  conversationId: string;
  senderId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  metadata?: {
    width: number;
    height: number;
    size: number;
  };
  createdAt: string;
}

// Service class for real-time messaging features
export class RealtimeMessagingService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private onlineStatusInterval?: NodeJS.Timeout;
  private currentUserId?: string;
  private privacySettings: {
    readReceipts: boolean;
    onlineStatus: boolean;
    typingIndicators: boolean;
  } = {
    readReceipts: true,
    onlineStatus: true,
    typingIndicators: true,
  };

  // Event listeners
  private listeners: {
    onTyping: ((data: TypingIndicator) => void)[];
    onReadReceipt: ((data: ReadReceipt) => void)[];
    onOnlineStatus: ((data: OnlineStatus) => void)[];
    onMessageDelivery: ((data: MessageDelivery) => void)[];
    onMessageReaction: ((data: MessageReaction) => void)[];
    onPhotoMessage: ((data: PhotoMessage) => void)[];
  } = {
    onTyping: [],
    onReadReceipt: [],
    onOnlineStatus: [],
    onMessageDelivery: [],
    onMessageReaction: [],
    onPhotoMessage: [],
  };

  constructor(userId?: string) {
    this.currentUserId = userId;
    this.loadPrivacySettings();
  }

  // Initialize service
  async initialize(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;
      await this.loadPrivacySettings();
      await this.initializeOnlinePresence();
      
      logMessaging('RealtimeMessagingService initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize RealtimeMessagingService', error instanceof Error ? error : undefined, { userId }, 'MESSAGING');
      Sentry.captureException(error);
      throw error;
    }
  }

  // Privacy settings management
  private async loadPrivacySettings(): Promise<void> {
    try {
      const settings = await secureStorage.getSecureItem(`privacy_settings_${this.currentUserId}`);
      if (settings) {
        this.privacySettings = { ...this.privacySettings, ...JSON.parse(settings) };
      }
    } catch (error) {
      logger.error('Failed to load privacy settings', error instanceof Error ? error : undefined, { userId: this.currentUserId }, 'MESSAGING');
    }
  }

  async updatePrivacySettings(settings: Partial<typeof this.privacySettings>): Promise<void> {
    try {
      this.privacySettings = { ...this.privacySettings, ...settings };
      await secureStorage.storeSecureItem(
        `privacy_settings_${this.currentUserId}`,
        JSON.stringify(this.privacySettings)
      );
      
      logMessaging('Privacy settings updated', { settings });
    } catch (error) {
      logger.error('Failed to update privacy settings', error instanceof Error ? error : undefined, { settings }, 'MESSAGING');
      throw error;
    }
  }

  // Typing indicators
  async startTyping(conversationId: string): Promise<void> {
    if (!this.privacySettings.typingIndicators || !this.currentUserId) return;

    try {
      const channel = this.getOrCreateChannel(conversationId);
      
      await channel.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: {
          userId: this.currentUserId,
          conversationId,
          timestamp: new Date().toISOString(),
        },
      });

      // Auto-stop typing after 3 seconds
      const existingTimeout = this.typingTimeouts.get(conversationId);
      if (existingTimeout) clearTimeout(existingTimeout);
      
      const timeout = setTimeout(() => {
        this.stopTyping(conversationId);
      }, 3000);
      
      this.typingTimeouts.set(conversationId, timeout);
      
      logMessaging('Started typing indicator', { conversationId });
    } catch (error) {
      logger.error('Failed to start typing indicator', error instanceof Error ? error : undefined, { conversationId }, 'MESSAGING');
    }
  }

  async stopTyping(conversationId: string): Promise<void> {
    if (!this.privacySettings.typingIndicators || !this.currentUserId) return;

    try {
      const channel = this.getOrCreateChannel(conversationId);
      
      await channel.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: {
          userId: this.currentUserId,
          conversationId,
          timestamp: new Date().toISOString(),
        },
      });

      const timeout = this.typingTimeouts.get(conversationId);
      if (timeout) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(conversationId);
      }
      
      logMessaging('Stopped typing indicator', { conversationId });
    } catch (error) {
      logger.error('Failed to stop typing indicator', error instanceof Error ? error : undefined, { conversationId }, 'MESSAGING');
    }
  }

  // Read receipts
  async markMessageAsRead(messageId: string, conversationId: string): Promise<void> {
    if (!this.privacySettings.readReceipts || !this.currentUserId) return;

    try {
      // Update database
      const { error } = await supabase
        .from('message_read_receipts')
        .upsert({
          message_id: messageId,
          user_id: this.currentUserId,
          read_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Broadcast read receipt
      const channel = this.getOrCreateChannel(conversationId);
      await channel.send({
        type: 'broadcast',
        event: 'message_read',
        payload: {
          messageId,
          userId: this.currentUserId,
          readAt: new Date().toISOString(),
        },
      });
      
      logMessaging('Message marked as read', { messageId, conversationId });
    } catch (error) {
      logger.error('Failed to mark message as read', error instanceof Error ? error : undefined, { messageId, conversationId }, 'MESSAGING');
      throw error;
    }
  }

  // Online presence
  private async initializeOnlinePresence(): Promise<void> {
    if (!this.privacySettings.onlineStatus || !this.currentUserId) return;

    try {
      // Set initial online status
      await this.updateOnlineStatus('online');

      // Update presence every 30 seconds
      this.onlineStatusInterval = setInterval(async () => {
        await this.updateOnlineStatus('online');
      }, 30000);

      // Handle app state changes
      // Note: This would need to be integrated with React Native's AppState
      
      logMessaging('Online presence initialized', { userId: this.currentUserId });
    } catch (error) {
      logger.error('Failed to initialize online presence', error instanceof Error ? error : undefined, { userId: this.currentUserId }, 'MESSAGING');
    }
  }

  async updateOnlineStatus(status: OnlineStatus['status'] = 'online'): Promise<void> {
    if (!this.privacySettings.onlineStatus || !this.currentUserId) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: this.currentUserId,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      logMessaging('Online status updated', { status });
    } catch (error) {
      logger.error('Failed to update online status', error instanceof Error ? error : undefined, { status }, 'MESSAGING');
    }
  }

  // Message delivery confirmation
  async confirmMessageDelivery(messageId: string, conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('message_delivery_status')
        .upsert({
          message_id: messageId,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Broadcast delivery confirmation
      const channel = this.getOrCreateChannel(conversationId);
      await channel.send({
        type: 'broadcast',
        event: 'message_delivered',
        payload: {
          messageId,
          status: 'delivered',
          timestamp: new Date().toISOString(),
        },
      });
      
      logMessaging('Message delivery confirmed', { messageId });
    } catch (error) {
      logger.error('Failed to confirm message delivery', error instanceof Error ? error : undefined, { messageId }, 'MESSAGING');
    }
  }

  // Message reactions
  async addMessageReaction(messageId: string, reaction: string, conversationId: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase
        .from('message_reactions')
        .upsert({
          message_id: messageId,
          user_id: this.currentUserId,
          reaction,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Broadcast reaction
      const channel = this.getOrCreateChannel(conversationId);
      await channel.send({
        type: 'broadcast',
        event: 'message_reaction',
        payload: {
          messageId,
          userId: this.currentUserId,
          reaction,
          timestamp: new Date().toISOString(),
        },
      });
      
      logMessaging('Message reaction added', { messageId, reaction });
    } catch (error) {
      logger.error('Failed to add message reaction', error instanceof Error ? error : undefined, { messageId, reaction }, 'MESSAGING');
      throw error;
    }
  }

  async removeMessageReaction(messageId: string, conversationId: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', this.currentUserId);

      if (error) throw error;

      // Broadcast reaction removal
      const channel = this.getOrCreateChannel(conversationId);
      await channel.send({
        type: 'broadcast',
        event: 'reaction_removed',
        payload: {
          messageId,
          userId: this.currentUserId,
          timestamp: new Date().toISOString(),
        },
      });
      
      logMessaging('Message reaction removed', { messageId });
    } catch (error) {
      logger.error('Failed to remove message reaction', error instanceof Error ? error : undefined, { messageId }, 'MESSAGING');
      throw error;
    }
  }

  // Channel management
  private getOrCreateChannel(conversationId: string): RealtimeChannel {
    let channel = this.channels.get(conversationId);
    
    if (!channel) {
      channel = supabase.channel(`conversation:${conversationId}`)
        .on('broadcast', { event: 'typing_start' }, (payload) => {
          this.notifyListeners('onTyping', { ...payload.payload, isTyping: true });
        })
        .on('broadcast', { event: 'typing_stop' }, (payload) => {
          this.notifyListeners('onTyping', { ...payload.payload, isTyping: false });
        })
        .on('broadcast', { event: 'message_read' }, (payload) => {
          this.notifyListeners('onReadReceipt', payload.payload);
        })
        .on('broadcast', { event: 'message_delivered' }, (payload) => {
          this.notifyListeners('onMessageDelivery', payload.payload);
        })
        .on('broadcast', { event: 'message_reaction' }, (payload) => {
          this.notifyListeners('onMessageReaction', payload.payload);
        })
        .on('broadcast', { event: 'reaction_removed' }, (payload) => {
          this.notifyListeners('onMessageReaction', { ...payload.payload, reaction: null });
        })
        .subscribe();

      this.channels.set(conversationId, channel);
    }
    
    return channel;
  }

  // Event listeners
  onTyping(callback: (data: TypingIndicator) => void): () => void {
    this.listeners.onTyping.push(callback);
    return () => {
      const index = this.listeners.onTyping.indexOf(callback);
      if (index > -1) this.listeners.onTyping.splice(index, 1);
    };
  }

  onReadReceipt(callback: (data: ReadReceipt) => void): () => void {
    this.listeners.onReadReceipt.push(callback);
    return () => {
      const index = this.listeners.onReadReceipt.indexOf(callback);
      if (index > -1) this.listeners.onReadReceipt.splice(index, 1);
    };
  }

  onOnlineStatus(callback: (data: OnlineStatus) => void): () => void {
    this.listeners.onOnlineStatus.push(callback);
    return () => {
      const index = this.listeners.onOnlineStatus.indexOf(callback);
      if (index > -1) this.listeners.onOnlineStatus.splice(index, 1);
    };
  }

  onMessageDelivery(callback: (data: MessageDelivery) => void): () => void {
    this.listeners.onMessageDelivery.push(callback);
    return () => {
      const index = this.listeners.onMessageDelivery.indexOf(callback);
      if (index > -1) this.listeners.onMessageDelivery.splice(index, 1);
    };
  }

  onMessageReaction(callback: (data: MessageReaction) => void): () => void {
    this.listeners.onMessageReaction.push(callback);
    return () => {
      const index = this.listeners.onMessageReaction.indexOf(callback);
      if (index > -1) this.listeners.onMessageReaction.splice(index, 1);
    };
  }

  // Helper method to notify all listeners
  private notifyListeners<T extends keyof typeof this.listeners>(
    event: T,
    data: any
  ): void {
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Error in real-time messaging listener', error instanceof Error ? error : undefined, { event, data }, 'MESSAGING');
      }
    });
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      // Clear typing timeouts
      this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
      this.typingTimeouts.clear();

      // Clear online status interval
      if (this.onlineStatusInterval) {
        clearInterval(this.onlineStatusInterval);
        this.onlineStatusInterval = undefined;
      }

      // Update status to offline
      if (this.currentUserId) {
        await this.updateOnlineStatus('offline' as any);
      }

      // Unsubscribe from all channels
      for (const [, channel] of this.channels) {
        await supabase.removeChannel(channel);
      }
      this.channels.clear();

      // Clear listeners
      Object.keys(this.listeners).forEach(key => {
        (this.listeners as any)[key] = [];
      });
      
      logMessaging('RealtimeMessagingService cleaned up');
    } catch (error) {
      logger.error('Error during cleanup', error instanceof Error ? error : undefined, {}, 'MESSAGING');
    }
  }
}

// Singleton instance
let realtimeMessagingService: RealtimeMessagingService | null = null;

export const getRealtimeMessagingService = (userId?: string): RealtimeMessagingService => {
  if (!realtimeMessagingService) {
    realtimeMessagingService = new RealtimeMessagingService(userId);
  }
  return realtimeMessagingService;
};

export const initializeRealtimeMessaging = async (userId: string): Promise<RealtimeMessagingService> => {
  const service = getRealtimeMessagingService();
  await service.initialize(userId);
  return service;
};
