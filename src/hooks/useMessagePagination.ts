import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
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

interface PaginationConfig {
  pageSize: number;
  initialLoadCount: number;
  cacheSize: number;
  prefetchThreshold: number;
}

interface LoadingStates {
  initial: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  refreshing: boolean;
}

interface MessageCache {
  [key: string]: {
    messages: Message[];
    timestamp: number;
    cursor?: string;
  };
}

interface UseMessagePaginationReturn {
  messages: Message[];
  loading: LoadingStates;
  error: string | null;
  hasOlderMessages: boolean;
  hasNewerMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  loadNewerMessages: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  addMessage: (message: Message) => void;
  clearCache: () => void;
  getTotalMessageCount: () => number;
  getVisibleRange: () => { start: number; end: number };
  scrollToMessage: (messageId: string) => boolean;
}

const DEFAULT_CONFIG: PaginationConfig = {
  pageSize: 50,
  initialLoadCount: 100,
  cacheSize: 1000, // Maximum messages to keep in memory
  prefetchThreshold: 10, // Load more when within 10 messages of edge
};

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export function useMessagePagination(
  conversationId: string | null,
  config: Partial<PaginationConfig> = {}
): UseMessagePaginationReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<LoadingStates>({
    initial: true,
    loadingOlder: false,
    loadingNewer: false,
    refreshing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [hasNewerMessages, setHasNewerMessages] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  
  const cacheRef = useRef<MessageCache>({});
  const oldestCursorRef = useRef<string | null>(null);
  const newestCursorRef = useRef<string | null>(null);
  const totalCountRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cache management
  const getCacheKey = useCallback((conversationId: string, direction: 'older' | 'newer', cursor?: string) => {
    return `${conversationId}-${direction}-${cursor || 'initial'}`;
  }, []);

  const isValidCache = useCallback((cacheEntry: any) => {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_EXPIRY;
  }, []);

  const updateCache = useCallback((key: string, messages: Message[], cursor?: string) => {
    cacheRef.current[key] = {
      messages,
      timestamp: Date.now(),
      cursor,
    };

    // Cleanup old cache entries
    const cacheEntries = Object.entries(cacheRef.current);
    if (cacheEntries.length > 20) { // Keep max 20 cache entries
      const sortedEntries = cacheEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const toKeep = sortedEntries.slice(0, 20);
      cacheRef.current = Object.fromEntries(toKeep);
    }
  }, []);

  // Memory management
  const trimMessages = useCallback((messageList: Message[]) => {
    if (messageList.length <= finalConfig.cacheSize) {
      return messageList;
    }

    // Keep most recent messages and a buffer around visible range
    const visibleStart = Math.max(0, visibleRange.start - 20);
    const visibleEnd = Math.min(messageList.length, visibleRange.end + 20);
    
    return messageList.slice(
      Math.max(0, messageList.length - finalConfig.cacheSize),
      messageList.length
    );
  }, [finalConfig.cacheSize, visibleRange]);

  // Fetch messages from Supabase
  const fetchMessages = useCallback(async (
    direction: 'initial' | 'older' | 'newer',
    cursor?: string
  ): Promise<{ messages: Message[]; hasMore: boolean; newCursor?: string }> => {
    if (!conversationId) {
      throw new Error('No conversation ID provided');
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (direction === 'initial') {
        query = query.limit(finalConfig.initialLoadCount);
      } else if (direction === 'older' && cursor) {
        query = query.lt('created_at', cursor).limit(finalConfig.pageSize);
      } else if (direction === 'newer' && cursor) {
        query = query.gt('created_at', cursor).limit(finalConfig.pageSize);
      } else {
        query = query.limit(finalConfig.pageSize);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const fetchedMessages = (data || []).reverse(); // Reverse to get chronological order
      const hasMore = direction === 'initial' 
        ? fetchedMessages.length === finalConfig.initialLoadCount
        : fetchedMessages.length === finalConfig.pageSize;

      const newCursor = fetchedMessages.length > 0 
        ? fetchedMessages[direction === 'newer' ? fetchedMessages.length - 1 : 0].created_at
        : undefined;

      return {
        messages: fetchedMessages,
        hasMore,
        newCursor,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw error;
    }
  }, [conversationId, finalConfig]);

  // Load initial messages
  const loadInitialMessages = useCallback(async () => {
    if (!conversationId) return;

    const cacheKey = getCacheKey(conversationId, 'older');
    const cached = cacheRef.current[cacheKey];

    if (isValidCache(cached)) {
      setMessages(cached.messages);
      setLoading(prev => ({ ...prev, initial: false }));
      return;
    }

    setLoading(prev => ({ ...prev, initial: true }));
    setError(null);

    try {
      const result = await fetchMessages('initial');
      
      setMessages(result.messages);
      updateCache(cacheKey, result.messages, result.newCursor);
      
      setHasOlderMessages(result.hasMore);
      if (result.messages.length > 0) {
        oldestCursorRef.current = result.messages[0].created_at;
        newestCursorRef.current = result.messages[result.messages.length - 1].created_at;
      }

      // Get total message count for the conversation
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);
      
      totalCountRef.current = count || 0;

    } catch (error) {
      if (error.message !== 'Request cancelled') {
        logError('Error loading initial messages:', "Error", error);
        setError('Failed to load messages');
        Sentry.captureException(error, {
          tags: { operation: 'load_initial_messages' },
          extra: { conversationId }
        });
      }
    } finally {
      setLoading(prev => ({ ...prev, initial: false }));
    }
  }, [conversationId, fetchMessages, getCacheKey, isValidCache, updateCache]);

  // Load older messages (pagination backwards)
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loading.loadingOlder || !hasOlderMessages || !oldestCursorRef.current) {
      return;
    }

    const cacheKey = getCacheKey(conversationId, 'older', oldestCursorRef.current);
    const cached = cacheRef.current[cacheKey];

    if (isValidCache(cached)) {
      setMessages(prev => [...cached.messages, ...prev]);
      return;
    }

    setLoading(prev => ({ ...prev, loadingOlder: true }));
    setError(null);

    try {
      const result = await fetchMessages('older', oldestCursorRef.current);
      
      if (result.messages.length > 0) {
        setMessages(prev => {
          const newMessages = [...result.messages, ...prev];
          return trimMessages(newMessages);
        });
        updateCache(cacheKey, result.messages, result.newCursor);
        oldestCursorRef.current = result.messages[0].created_at;
      }

      setHasOlderMessages(result.hasMore);

    } catch (error) {
      if (error.message !== 'Request cancelled') {
        logError('Error loading older messages:', "Error", error);
        setError('Failed to load older messages');
        Sentry.captureException(error, {
          tags: { operation: 'load_older_messages' },
          extra: { conversationId }
        });
      }
    } finally {
      setLoading(prev => ({ ...prev, loadingOlder: false }));
    }
  }, [conversationId, loading.loadingOlder, hasOlderMessages, fetchMessages, getCacheKey, isValidCache, updateCache, trimMessages]);

  // Load newer messages (pagination forwards)
  const loadNewerMessages = useCallback(async () => {
    if (!conversationId || loading.loadingNewer || !hasNewerMessages || !newestCursorRef.current) {
      return;
    }

    const cacheKey = getCacheKey(conversationId, 'newer', newestCursorRef.current);
    const cached = cacheRef.current[cacheKey];

    if (isValidCache(cached)) {
      setMessages(prev => [...prev, ...cached.messages]);
      return;
    }

    setLoading(prev => ({ ...prev, loadingNewer: true }));
    setError(null);

    try {
      const result = await fetchMessages('newer', newestCursorRef.current);
      
      if (result.messages.length > 0) {
        setMessages(prev => {
          const newMessages = [...prev, ...result.messages];
          return trimMessages(newMessages);
        });
        updateCache(cacheKey, result.messages, result.newCursor);
        newestCursorRef.current = result.messages[result.messages.length - 1].created_at;
      }

      setHasNewerMessages(result.hasMore);

    } catch (error) {
      if (error.message !== 'Request cancelled') {
        logError('Error loading newer messages:', "Error", error);
        setError('Failed to load newer messages');
        Sentry.captureException(error, {
          tags: { operation: 'load_newer_messages' },
          extra: { conversationId }
        });
      }
    } finally {
      setLoading(prev => ({ ...prev, loadingNewer: false }));
    }
  }, [conversationId, loading.loadingNewer, hasNewerMessages, fetchMessages, getCacheKey, isValidCache, updateCache, trimMessages]);

  // Refresh messages (pull-to-refresh)
  const refreshMessages = useCallback(async () => {
    if (!conversationId) return;

    setLoading(prev => ({ ...prev, refreshing: true }));
    setError(null);

    try {
      // Clear cache for this conversation
      const keys = Object.keys(cacheRef.current).filter(key => key.startsWith(conversationId));
      keys.forEach(key => delete cacheRef.current[key]);

      // Reset cursors
      oldestCursorRef.current = null;
      newestCursorRef.current = null;

      // Reload initial messages
      await loadInitialMessages();

    } catch (error) {
      logError('Error refreshing messages:', "Error", error);
      setError('Failed to refresh messages');
    } finally {
      setLoading(prev => ({ ...prev, refreshing: false }));
    }
  }, [conversationId, loadInitialMessages]);

  // Add new message (for real-time updates)
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      const exists = prev.find(m => m.id === message.id);
      if (exists) return prev;

      const newMessages = [...prev, message];
      newestCursorRef.current = message.created_at;
      totalCountRef.current += 1;
      
      return trimMessages(newMessages);
    });
  }, [trimMessages]);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current = {};
  }, []);

  // Get total message count
  const getTotalMessageCount = useCallback(() => {
    return totalCountRef.current;
  }, []);

  // Update visible range for virtual scrolling
  const getVisibleRange = useCallback(() => {
    return visibleRange;
  }, [visibleRange]);

  // Scroll to specific message
  const scrollToMessage = useCallback((messageId: string): boolean => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      setVisibleRange(prev => ({
        start: Math.max(0, index - 10),
        end: Math.min(messages.length, index + 10)
      }));
      return true;
    }
    return false;
  }, [messages]);

  // Auto-load more messages when approaching edges
  useEffect(() => {
    const { start, end } = visibleRange;
    
    // Load older messages if approaching start
    if (start < finalConfig.prefetchThreshold && hasOlderMessages && !loading.loadingOlder) {
      loadOlderMessages();
    }
    
    // Load newer messages if approaching end
    if ((messages.length - end) < finalConfig.prefetchThreshold && hasNewerMessages && !loading.loadingNewer) {
      loadNewerMessages();
    }
  }, [visibleRange, messages.length, hasOlderMessages, hasNewerMessages, loading, loadOlderMessages, loadNewerMessages, finalConfig.prefetchThreshold]);

  // Initial load
  useEffect(() => {
    if (conversationId) {
      loadInitialMessages();
    } else {
      setMessages([]);
      setError(null);
      setHasOlderMessages(true);
      setHasNewerMessages(false);
    }
  }, [conversationId, loadInitialMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    loading,
    error,
    hasOlderMessages,
    hasNewerMessages,
    loadOlderMessages,
    loadNewerMessages,
    refreshMessages,
    addMessage,
    clearCache,
    getTotalMessageCount,
    getVisibleRange,
    scrollToMessage,
  };
}
