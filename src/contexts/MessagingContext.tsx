import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { unmatchService } from '../services/unmatchService';
import * as Sentry from '@sentry/react-native';
import { logger, logMessaging } from '../utils/logger';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  last_message_preview?: string;
  last_message_at?: string;
  updated_at: string;
  unread_count?: number;
  user1?: { id: string; display_name: string; avatar_url?: string };
  user2?: { id: string; display_name: string; avatar_url?: string };
  deleted_at?: string | null;
  deleted_by?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
}

interface MessagingContextType {
  conversations: Conversation[];
  unreadCounts: Record<string, number>;
  refreshConversations: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => void;
  updateConversationPreview: (conversationId: string, lastMessage: string, timestamp: string) => void;
  addNewConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  archiveConversation: (conversationId: string, archive: boolean) => Promise<boolean>;
  unmatchUser: (otherUserId: string) => Promise<boolean>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Fetch all conversations for the current user
  const refreshConversations = useCallback(async () => {
    if (!user) return;

    try {
      // First get conversations
      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch conversations', error instanceof Error ? error : undefined, { userId: user.id }, 'MESSAGING');
        return;
      }

      // Then get user profiles for each conversation
      const conversationsWithProfiles = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const [user1Profile, user2Profile] = await Promise.all([
            supabase.from('profiles').select('id, display_name, avatar_url').eq('id', conv.user1_id).single(),
            supabase.from('profiles').select('id, display_name, avatar_url').eq('id', conv.user2_id).single()
          ]);

          return {
            ...conv,
            user1: user1Profile.data,
            user2: user2Profile.data
          };
        })
      );

      const data = conversationsWithProfiles;

      setConversations(data || []);
      
      // Calculate unread counts for each conversation
      const unreadPromises = (data || []).map(async (conv) => {
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gte('created_at', conv.last_read_at || '1970-01-01');

        if (countError) {
          logger.error('Failed to count unread messages', countError instanceof Error ? countError : undefined, { conversationId: conv.id, userId: user.id }, 'MESSAGING');
          return { conversationId: conv.id, count: 0 };
        }

        return { conversationId: conv.id, count: count || 0 };
      });

      const unreadResults = await Promise.all(unreadPromises);
      const newUnreadCounts: Record<string, number> = {};
      unreadResults.forEach(({ conversationId, count }) => {
        newUnreadCounts[conversationId] = count;
      });
      setUnreadCounts(newUnreadCounts);

    } catch (error) {
      logger.error('refreshConversations failed', error instanceof Error ? error : undefined, { userId: user.id }, 'MESSAGING');
    }
  }, [user]);

  // Mark conversation as read (reset unread count)
  const markConversationAsRead = useCallback((conversationId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: 0
    }));
  }, []);

  // Update conversation preview when new message arrives
  const updateConversationPreview = useCallback((conversationId: string, lastMessage: string, timestamp: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { 
              ...conv, 
              last_message_preview: lastMessage.length > 100 ? lastMessage.substring(0, 100) + '...' : lastMessage,
              last_message_at: timestamp,
              updated_at: timestamp
            }
          : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  }, []);

  // Add new conversation to the list
  const addNewConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => {
      const exists = prev.find(conv => conv.id === conversation.id);
      if (exists) return prev;
      return [conversation, ...prev];
    });
  }, []);

  // Set up global message subscription for all user conversations
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`user_messages:${user.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=neq.${user.id}` // Only listen for messages from others
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          logMessaging('New message received globally', { messageId: newMessage.id, conversationId: newMessage.conversation_id, senderId: newMessage.sender_id });

          // Check if this message is for one of user's conversations
          const { data: conversationData, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', newMessage.conversation_id)
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

          if (error || !conversationData) return;

          // Update conversation preview
          updateConversationPreview(
            newMessage.conversation_id,
            newMessage.content,
            newMessage.created_at
          );

          // Increment unread count
          setUnreadCounts(prev => ({
            ...prev,
            [newMessage.conversation_id]: (prev[newMessage.conversation_id] || 0) + 1
          }));
        }
      )
      .subscribe();

    // Also listen for new conversations
    const conversationSubscription = supabase
      .channel(`user_conversations:${user.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `user1_id=eq.${user.id}`
        },
        async (payload) => {
          const newConversation = payload.new as Conversation;
          logMessaging('New conversation created (as user1)', { conversationId: newConversation?.id, userId: user.id });
          await refreshConversations();
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `user2_id=eq.${user.id}`
        },
        async (payload) => {
          const newConversation = payload.new as Conversation;
          logMessaging('New conversation created (as user2)', { conversationId: newConversation?.id, userId: user.id });
          await refreshConversations();
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

  // Delete conversation handler
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const result = await unmatchService.deleteConversation({
        conversationId,
        hardDelete: false
      });

      if (result.success) {
        // Remove from local state
        setConversations(prev => 
          prev.filter(conv => conv.id !== conversationId)
        );
        
        // Remove unread count
        setUnreadCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[conversationId];
          return newCounts;
        });

        return true;
      }
      return false;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'delete_conversation' },
        extra: { conversationId }
      });
      logger.error('Conversation deletion failed', error instanceof Error ? error : undefined, { conversationId }, 'MESSAGING');
      return false;
    }
  }, []);

  // Archive conversation handler
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
        // Update local state to reflect archive status
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
      logger.error('Conversation archiving failed', error instanceof Error ? error : undefined, { conversationId, archive }, 'MESSAGING');
      return false;
    }
  }, []);

  // Unmatch user handler
  const unmatchUser = useCallback(async (otherUserId: string): Promise<boolean> => {
    if (!user) {
      logger.warn('Cannot unmatch user - user not authenticated', undefined, {}, 'MESSAGING');
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
          
          // Remove unread count
          setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[result.conversationId!];
            return newCounts;
          });
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
      logger.error('User unmatching failed', error instanceof Error ? error : undefined, { userId: user.id, otherUserId }, 'MESSAGING');
      return false;
    }
  }, [user]);

  const value: MessagingContextType = {
    conversations,
    unreadCounts,
    refreshConversations,
    markConversationAsRead,
    updateConversationPreview,
    addNewConversation,
    deleteConversation,
    archiveConversation,
    unmatchUser,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};