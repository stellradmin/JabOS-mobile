import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { unmatchService } from '../services/unmatchService';
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
  is_own_message: boolean;
}

interface ConversationOptimized {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  last_message_preview?: string;
  last_message_at?: string;
  other_user_name: string;
  other_user_avatar?: string;
  unread_count: number;
  archived_at?: string | null;
  deleted_at?: string | null;
}

interface MessagingContextType {
  conversations: ConversationOptimized[];
  loading: boolean;
  error: string | null;
  refreshConversations: () => Promise<void>;
  searchConversations: (searchTerm?: string) => Promise<ConversationOptimized[]>;
  getConversationMessages: (conversationId: string, limit?: number, beforeTimestamp?: string) => Promise<Message[]>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  updateConversationPreview: (conversationId: string, lastMessage: string, timestamp: string) => void;
  addNewConversation: (conversation: ConversationOptimized) => void;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  archiveConversation: (conversationId: string, archive: boolean) => Promise<boolean>;
  unmatchUser: (otherUserId: string) => Promise<boolean>;
  getTotalUnreadCount: () => number;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

export const OptimizedMessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationOptimized[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OPTIMIZED: Single query to fetch all conversations with profiles and unread counts
  // This replaces the N+1 query pattern in the original MessagingContext
  const refreshConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Use the optimized database function that eliminates N+1 queries
      const { data, error: queryError } = await supabase
        .rpc('get_user_conversations_optimized', { p_user_id: user.id });

      if (queryError) {
        logError('Error fetching optimized conversations:', "Error", queryError);
        setError('Failed to load conversations');
        return;
      }

      // Transform the data to match our interface
      const optimizedConversations: ConversationOptimized[] = (data || []).map((conv: any) => ({
        id: conv.id,
        user1_id: conv.user1_id,
        user2_id: conv.user2_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_preview: conv.last_message_preview,
        last_message_at: conv.last_message_at,
        other_user_name: user.id === conv.user1_id ? conv.user2_display_name : conv.user1_display_name,
        other_user_avatar: user.id === conv.user1_id ? conv.user2_avatar_url : conv.user1_avatar_url,
        unread_count: conv.unread_count || 0,
        archived_at: conv.archived_at,
        deleted_at: conv.deleted_at
      }));

      setConversations(optimizedConversations);

      // Log performance improvement for monitoring
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `Loaded ${optimizedConversations.length} conversations with single query`,
        level: 'info',
        data: {
          conversation_count: optimizedConversations.length,
          optimization: 'single_query_replace_n_plus_1',
          total_unread: optimizedConversations.reduce((sum, conv) => sum + conv.unread_count, 0)
        }
      });

    } catch (error) {
      logError('Error in refreshConversations:', "Error", error);
      setError('Failed to load conversations');
      Sentry.captureException(error, {
        tags: { operation: 'refresh_conversations_optimized' },
        extra: { userId: user.id }
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // OPTIMIZED: Conversation search with single query
  const searchConversations = useCallback(async (searchTerm?: string): Promise<ConversationOptimized[]> => {
    if (!user) return [];

    try {
      const { data, error: queryError } = await supabase
        .rpc('search_conversations_optimized', { 
          p_user_id: user.id,
          p_search_term: searchTerm || null,
          p_limit: 50,
          p_offset: 0
        });

      if (queryError) {
        logError('Error searching conversations:', "Error", queryError);
        return [];
      }

      return (data || []).map((conv: any) => ({
        id: conv.id,
        user1_id: conv.user1_id,
        user2_id: conv.user2_id,
        created_at: new Date().toISOString(), // We don't get this from search function
        updated_at: new Date().toISOString(),
        last_message_preview: conv.last_message_preview,
        last_message_at: conv.last_message_at,
        other_user_name: conv.other_user_name,
        other_user_avatar: conv.other_user_avatar,
        unread_count: conv.unread_count || 0,
        archived_at: null,
        deleted_at: null
      }));

    } catch (error) {
      logError('Error searching conversations:', "Error", error);
      Sentry.captureException(error, {
        tags: { operation: 'search_conversations' },
        extra: { userId: user.id, searchTerm }
      });
      return [];
    }
  }, [user]);

  // OPTIMIZED: Message loading with sender profiles in single query
  const getConversationMessages = useCallback(async (
    conversationId: string, 
    limit: number = 50, 
    beforeTimestamp?: string
  ): Promise<Message[]> => {
    if (!user) return [];

    try {
      const { data, error: queryError } = await supabase
        .rpc('get_conversation_messages_optimized', {
          p_conversation_id: conversationId,
          p_user_id: user.id,
          p_limit: limit,
          p_offset: 0,
          p_before_timestamp: beforeTimestamp ? new Date(beforeTimestamp).toISOString() : null
        });

      if (queryError) {
        logError('Error fetching messages:', "Error", queryError);
        return [];
      }

      return (data || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name || 'Unknown User',
        sender_avatar: msg.sender_avatar,
        conversation_id: conversationId,
        created_at: msg.created_at,
        media_url: msg.media_url,
        media_type: msg.media_type,
        is_own_message: msg.is_own_message
      }));

    } catch (error) {
      logError('Error loading messages:', "Error", error);
      Sentry.captureException(error, {
        tags: { operation: 'get_conversation_messages' },
        extra: { userId: user.id, conversationId, limit }
      });
      return [];
    }
  }, [user]);

  // OPTIMIZED: Mark conversation as read with database update
  const markConversationAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      // Update the last_read_at timestamp in the database
      const updateField = conversations.find(c => c.id === conversationId)?.user1_id === user.id 
        ? 'user1_last_read_at' 
        : 'user2_last_read_at';

      const { error } = await supabase
        .from('conversations')
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        logError('Error marking conversation as read:', "Error", error);
        return;
      }

      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );

    } catch (error) {
      logError('Error in markConversationAsRead:', "Error", error);
      Sentry.captureException(error, {
        tags: { operation: 'mark_conversation_read' },
        extra: { userId: user.id, conversationId }
      });
    }
  }, [user, conversations]);

  // Update conversation preview when new message arrives
  const updateConversationPreview = useCallback((conversationId: string, lastMessage: string, timestamp: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { 
              ...conv, 
              last_message_preview: lastMessage.length > 100 ? lastMessage.substring(0, 100) + '...' : lastMessage,
              last_message_at: timestamp,
              updated_at: timestamp,
              unread_count: conv.unread_count + 1 // Increment unread count
            }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  }, []);

  // Add new conversation to the list
  const addNewConversation = useCallback((conversation: ConversationOptimized) => {
    setConversations(prev => {
      const exists = prev.find(conv => conv.id === conversation.id);
      if (exists) return prev;
      return [conversation, ...prev];
    });
  }, []);

  // Get total unread count across all conversations
  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((total, conv) => total + conv.unread_count, 0);
  }, [conversations]);

  // OPTIMIZED: Real-time subscription with improved filtering
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`user_messages:${user.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=neq.${user.id}` // Only messages from others
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          logDebug('New message received:', "Debug", newMessage);

          // OPTIMIZED: Use the efficient participant lookup function
          const { data: participants } = await supabase
            .rpc('get_conversation_participants', { p_conversation_id: newMessage.conversation_id });

          if (!participants || participants.length === 0) return;

          const participant = participants[0];
          const isUserConversation = participant.user1_id === user.id || participant.user2_id === user.id;

          if (!isUserConversation) return;

          // Update conversation preview and unread count
          updateConversationPreview(
            newMessage.conversation_id,
            newMessage.content,
            newMessage.created_at
          );
        }
      )
      .subscribe();

    // Optimized conversation subscription
    const conversationSubscription = supabase
      .channel(`user_conversations:${user.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          const newConversation = payload.new as any;
          
          // Check if this conversation involves the current user
          if (newConversation.user1_id === user.id || newConversation.user2_id === user.id) {
            logDebug('New conversation detected, "Debug", refreshing...');
            await refreshConversations(); // This is now optimized
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(conversationSubscription);
    };
  }, [user, updateConversationPreview, refreshConversations]);

  // Initial load of conversations
  useEffect(() => {
    if (user) {
      refreshConversations();
    }
  }, [user, refreshConversations]);

  // Delete conversation handler (unchanged - already efficient)
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const result = await unmatchService.deleteConversation({
        conversationId,
        hardDelete: false
      });

      if (result.success) {
        setConversations(prev => 
          prev.filter(conv => conv.id !== conversationId)
        );
        return true;
      }
      return false;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'delete_conversation' },
        extra: { conversationId }
      });
      logError('Failed to delete conversation:', "Error", error);
      return false;
    }
  }, []);

  // Archive conversation handler (unchanged - already efficient)
  const archiveConversation = useCallback(async (
    conversationId: string,
    archive: boolean
  ): Promise<boolean> => {
    try {
      const result = await unmatchService.archiveConversation({
        conversationId,
        archive
      });

      if (result.success) {
        setConversations(prev =>
          prev.map(conv =>
            conv.id === conversationId
              ? { ...conv, archived_at: archive ? new Date().toISOString() : null }
              : conv
          )
        );
        return true;
      }
      return false;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'archive_conversation' },
        extra: { conversationId, archive }
      });
      logError('Failed to archive conversation:', "Error", error);
      return false;
    }
  }, []);

  // Unmatch user handler (unchanged - already efficient)  
  const unmatchUser = useCallback(async (otherUserId: string): Promise<boolean> => {
    if (!user) {
      logError('User not authenticated', "Error");
      return false;
    }

    try {
      const result = await unmatchService.unmatchUsers({
        userId: user.id,
        otherUserId,
        reason: 'user_unmatch'
      });

      if (result.success) {
        // Remove conversation from local state
        if (result.conversationId) {
          setConversations(prev =>
            prev.filter(conv => conv.id !== result.conversationId)
          );
        } else {
          // Find and remove conversation by user IDs
          setConversations(prev =>
            prev.filter(conv =>
              !(
                (conv.user1_id === user.id && conv.user2_id === otherUserId) ||
                (conv.user1_id === otherUserId && conv.user2_id === user.id)
              )
            )
          );
        }
        return true;
      }
      return false;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'unmatch_user' },
        extra: { userId: user.id, otherUserId }
      });
      logError('Failed to unmatch user:', "Error", error);
      return false;
    }
  }, [user]);

  const value: MessagingContextType = {
    conversations,
    loading,
    error,
    refreshConversations,
    searchConversations,
    getConversationMessages,
    markConversationAsRead,
    updateConversationPreview,
    addNewConversation,
    deleteConversation,
    archiveConversation,
    unmatchUser,
    getTotalUnreadCount,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};

// Export both the optimized and original contexts for gradual migration
export { OptimizedMessagingProvider as MessagingProvider };

// Performance monitoring hook for the optimized messaging context
export const useMessagingPerformance = () => {
  const { conversations, loading } = useMessaging();
  
  return {
    conversationCount: conversations.length,
    totalUnreadCount: conversations.reduce((sum, conv) => sum + conv.unread_count, 0),
    isLoading: loading,
    performanceMetrics: {
      // These would be populated by actual performance monitoring
      avgLoadTime: 0,
      queryCount: 1, // Now only 1 query instead of N+1
      cacheHitRate: 0,
    }
  };
};
