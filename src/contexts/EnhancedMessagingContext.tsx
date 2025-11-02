import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { unmatchService } from '../services/unmatchService';
import { useMessagePagination } from '../hooks/useMessagePagination';
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

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

interface ConversationCache {
  [conversationId: string]: {
    messages: Message[];
    lastUpdated: number;
    totalCount: number;
    hasMore: boolean;
  };
}

interface PaginationState {
  [conversationId: string]: {
    page: number;
    isLoading: boolean;
    hasMore: boolean;
    lastCursor?: string;
  };
}

interface EnhancedMessagingContextType {
  // Original MessagingContext interface
  conversations: Conversation[];
  unreadCounts: Record<string, number>;
  refreshConversations: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => void;
  updateConversationPreview: (conversationId: string, lastMessage: string, timestamp: string) => void;
  addNewConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  archiveConversation: (conversationId: string, archive: boolean) => Promise<boolean>;
  unmatchUser: (otherUserId: string) => Promise<boolean>;

  // Enhanced pagination features
  getMessagesForConversation: (conversationId: string) => Message[];
  loadMoreMessages: (conversationId: string) => Promise<void>;
  refreshConversationMessages: (conversationId: string) => Promise<void>;
  addRealtimeMessage: (message: Message) => void;
  getMessageCount: (conversationId: string) => number;
  clearMessageCache: (conversationId?: string) => void;
  isConversationLoading: (conversationId: string) => boolean;
  hasMoreMessages: (conversationId: string) => boolean;
  
  // Performance and caching
  preloadConversation: (conversationId: string) => Promise<void>;
  getCacheStatus: () => { size: number; conversations: number };
  optimizeCache: () => void;
}

const CACHE_SIZE_LIMIT = 10; // Number of conversations to keep in cache
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const MESSAGE_PAGE_SIZE = 50;

const EnhancedMessagingContext = createContext<EnhancedMessagingContextType | undefined>(undefined);

export const useEnhancedMessaging = () => {
  const context = useContext(EnhancedMessagingContext);
  if (!context) {
    throw new Error('useEnhancedMessaging must be used within an EnhancedMessagingProvider');
  }
  return context;
};

export const EnhancedMessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [messageCache, setMessageCache] = useState<ConversationCache>({});
  const [paginationStates, setPaginationStates] = useState<PaginationState>({});
  
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const cacheCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cache management utilities
  const getCacheKey = useCallback((conversationId: string) => conversationId, []);

  const isValidCacheEntry = useCallback((cacheEntry: any) => {
    return cacheEntry && (Date.now() - cacheEntry.lastUpdated) < CACHE_EXPIRY;
  }, []);

  const updateMessageCache = useCallback((
    conversationId: string,
    messages: Message[],
    totalCount: number,
    hasMore: boolean
  ) => {
    setMessageCache(prev => {
      const updated = {
        ...prev,
        [conversationId]: {
          messages,
          lastUpdated: Date.now(),
          totalCount,
          hasMore,
        },
      };

      // Cleanup old cache entries if we exceed the limit
      const entries = Object.entries(updated);
      if (entries.length > CACHE_SIZE_LIMIT) {
        const sortedEntries = entries.sort((a, b) => b[1].lastUpdated - a[1].lastUpdated);
        const toKeep = sortedEntries.slice(0, CACHE_SIZE_LIMIT);
        return Object.fromEntries(toKeep);
      }

      return updated;
    });
  }, []);

  // Fetch all conversations for the current user
  const refreshConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        logError('Error fetching conversations:', "Error", error);
        return;
      }

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

      setConversations(conversationsWithProfiles || []);
      
      // Calculate unread counts for each conversation
      const unreadPromises = (conversationsWithProfiles || []).map(async (conv) => {
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gte('created_at', conv.last_read_at || '1970-01-01');

        if (countError) {
          logError('Error counting unread messages:', "Error", countError);
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
      logError('Error in refreshConversations:', "Error", error);
      Sentry.captureException(error, {
        tags: { operation: 'refresh_conversations' },
      });
    }
  }, [user]);

  // Enhanced message loading with pagination
  const getMessagesForConversation = useCallback((conversationId: string): Message[] => {
    const cached = messageCache[conversationId];
    return isValidCacheEntry(cached) ? cached.messages : [];
  }, [messageCache, isValidCacheEntry]);

  const loadMoreMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    const currentState = paginationStates[conversationId];
    if (currentState?.isLoading) return;

    setPaginationStates(prev => ({
      ...prev,
      [conversationId]: {
        ...prev[conversationId],
        isLoading: true,
      },
    }));

    try {
      const cached = messageCache[conversationId];
      const existingMessages = cached?.messages || [];
      const lastCursor = existingMessages.length > 0 
        ? existingMessages[0].created_at 
        : undefined;

      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (lastCursor) {
        query = query.lt('created_at', lastCursor);
      }

      const { data, error } = await query;

      if (error) {
        logError('Error loading more messages:', "Error", error);
        throw error;
      }

      const newMessages = (data || []).reverse();
      const allMessages = [...newMessages, ...existingMessages];

      // Get total count if not cached
      let totalCount = cached?.totalCount || 0;
      if (!cached) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);
        totalCount = count || 0;
      }

      const hasMore = newMessages.length === MESSAGE_PAGE_SIZE;

      updateMessageCache(conversationId, allMessages, totalCount, hasMore);

      setPaginationStates(prev => ({
        ...prev,
        [conversationId]: {
          page: (prev[conversationId]?.page || 0) + 1,
          isLoading: false,
          hasMore,
          lastCursor: newMessages.length > 0 ? newMessages[0].created_at : undefined,
        },
      }));

    } catch (error) {
      logError('Error loading more messages:', "Error", error);
      setPaginationStates(prev => ({
        ...prev,
        [conversationId]: {
          ...prev[conversationId],
          isLoading: false,
        },
      }));
      
      Sentry.captureException(error, {
        tags: { operation: 'load_more_messages' },
        extra: { conversationId },
      });
    }
  }, [user, messageCache, paginationStates, updateMessageCache]);

  const refreshConversationMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      // Clear existing cache and pagination state
      setMessageCache(prev => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });

      setPaginationStates(prev => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });

      // Load fresh messages
      await loadMoreMessages(conversationId);

    } catch (error) {
      logError('Error refreshing conversation messages:', "Error", error);
      Sentry.captureException(error, {
        tags: { operation: 'refresh_conversation_messages' },
        extra: { conversationId },
      });
    }
  }, [user, loadMoreMessages]);

  // Add real-time message
  const addRealtimeMessage = useCallback((message: Message) => {
    setMessageCache(prev => {
      const cached = prev[message.conversation_id];
      if (!cached) return prev;

      const messageExists = cached.messages.some(m => m.id === message.id);
      if (messageExists) return prev;

      return {
        ...prev,
        [message.conversation_id]: {
          ...cached,
          messages: [...cached.messages, message],
          totalCount: cached.totalCount + 1,
          lastUpdated: Date.now(),
        },
      };
    });

    // Update conversation preview
    updateConversationPreview(
      message.conversation_id,
      message.content,
      message.created_at
    );

    // Update unread count if not from current user
    if (message.sender_id !== user?.id) {
      setUnreadCounts(prev => ({
        ...prev,
        [message.conversation_id]: (prev[message.conversation_id] || 0) + 1,
      }));
    }
  }, [user?.id]);

  // Utility functions
  const getMessageCount = useCallback((conversationId: string): number => {
    const cached = messageCache[conversationId];
    return cached?.totalCount || 0;
  }, [messageCache]);

  const isConversationLoading = useCallback((conversationId: string): boolean => {
    return paginationStates[conversationId]?.isLoading || false;
  }, [paginationStates]);

  const hasMoreMessages = useCallback((conversationId: string): boolean => {
    return paginationStates[conversationId]?.hasMore !== false;
  }, [paginationStates]);

  const clearMessageCache = useCallback((conversationId?: string) => {
    if (conversationId) {
      setMessageCache(prev => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });
      setPaginationStates(prev => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });
    } else {
      setMessageCache({});
      setPaginationStates({});
    }
  }, []);

  // Performance optimization functions
  const preloadConversation = useCallback(async (conversationId: string) => {
    const cached = messageCache[conversationId];
    if (!cached || !isValidCacheEntry(cached)) {
      await loadMoreMessages(conversationId);
    }
  }, [messageCache, isValidCacheEntry, loadMoreMessages]);

  const getCacheStatus = useCallback(() => ({
    size: Object.keys(messageCache).reduce((total, key) => 
      total + messageCache[key].messages.length, 0),
    conversations: Object.keys(messageCache).length,
  }), [messageCache]);

  const optimizeCache = useCallback(() => {
    const now = Date.now();
    setMessageCache(prev => {
      const optimized: ConversationCache = {};
      
      Object.entries(prev).forEach(([conversationId, cache]) => {
        if ((now - cache.lastUpdated) < CACHE_EXPIRY) {
          optimized[conversationId] = cache;
        }
      });

      return optimized;
    });
  }, []);

  // Original MessagingContext functions
  const markConversationAsRead = useCallback((conversationId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: 0
    }));
  }, []);

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

  const addNewConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => {
      const exists = prev.find(conv => conv.id === conversation.id);
      if (exists) return prev;
      return [conversation, ...prev];
    });
  }, []);

  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const result = await unmatchService.deleteConversation({
        conversationId,
        hardDelete: false
      });

      if (result.success) {
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        setUnreadCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[conversationId];
          return newCounts;
        });
        clearMessageCache(conversationId);
        return true;
      }
      return false;
    } catch (error) {
      logError('Failed to delete conversation:', "Error", error);
      return false;
    }
  }, [clearMessageCache]);

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
      logError('Failed to archive conversation:', "Error", error);
      return false;
    }
  }, []);

  const unmatchUser = useCallback(async (otherUserId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const result = await unmatchService.unmatchUsers({
        userId: user.id,
        otherUserId,
        reason: 'user_unmatch'
      });

      if (result.success) {
        if (result.conversationId) {
          setConversations(prev => prev.filter(conv => conv.id !== result.conversationId));
          setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[result.conversationId!];
            return newCounts;
          });
          clearMessageCache(result.conversationId);
        }
        return true;
      }
      return false;
    } catch (error) {
      logError('Failed to unmatch user:', "Error", error);
      return false;
    }
  }, [user, clearMessageCache]);

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
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Check if this message is for one of user's conversations
          const { data: conversationData, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', newMessage.conversation_id)
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

          if (error || !conversationData) return;

          addRealtimeMessage(newMessage);
        }
      )
      .subscribe();

    subscriptionsRef.current.set('messages', subscription);

    return () => {
      supabase.removeChannel(subscription);
      subscriptionsRef.current.delete('messages');
    };
  }, [user, addRealtimeMessage]);

  // Initial load of conversations
  useEffect(() => {
    if (user) {
      refreshConversations();
    }
  }, [user, refreshConversations]);

  // Cache cleanup timer
  useEffect(() => {
    cacheCleanupTimerRef.current = setInterval(optimizeCache, CACHE_EXPIRY);
    
    return () => {
      if (cacheCleanupTimerRef.current) {
        clearInterval(cacheCleanupTimerRef.current);
      }
    };
  }, [optimizeCache]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(subscription => {
        supabase.removeChannel(subscription);
      });
      subscriptionsRef.current.clear();
    };
  }, []);

  const value: EnhancedMessagingContextType = {
    // Original interface
    conversations,
    unreadCounts,
    refreshConversations,
    markConversationAsRead,
    updateConversationPreview,
    addNewConversation,
    deleteConversation,
    archiveConversation,
    unmatchUser,
    
    // Enhanced features
    getMessagesForConversation,
    loadMoreMessages,
    refreshConversationMessages,
    addRealtimeMessage,
    getMessageCount,
    clearMessageCache,
    isConversationLoading,
    hasMoreMessages,
    preloadConversation,
    getCacheStatus,
    optimizeCache,
  };

  return (
    <EnhancedMessagingContext.Provider value={value}>
      {children}
    </EnhancedMessagingContext.Provider>
  );
};
