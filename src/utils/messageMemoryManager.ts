import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface MemoryStats {
  totalMessages: number;
  estimatedMemoryUsage: number;
  cacheSize: number;
  lastCleanup: Date;
}

interface MessageCache {
  messages: Message[];
  metadata: {
    lastAccessed: Date;
    accessCount: number;
    conversationId: string;
    totalSize: number;
  };
}

interface MemoryManagerConfig {
  maxConversationsInCache: number;
  maxMessagesPerConversation: number;
  maxTotalMessages: number;
  cleanupInterval: number;
  aggressiveCleanupThreshold: number;
  memoryWarningThreshold: number;
}

class MessageMemoryManager {
  private cache = new Map<string, MessageCache>();
  private config: MemoryManagerConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: MemoryStats = {
    totalMessages: 0,
    estimatedMemoryUsage: 0,
    cacheSize: 0,
    lastCleanup: new Date(),
  };

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    this.config = {
      maxConversationsInCache: 10,
      maxMessagesPerConversation: 1000,
      maxTotalMessages: 5000,
      cleanupInterval: 60000, // 1 minute
      aggressiveCleanupThreshold: 0.8, // 80% of max
      memoryWarningThreshold: 0.9, // 90% of max
      ...config,
    };

    this.startCleanupTimer();
  }

  // Add messages to cache with smart memory management
  addMessages(conversationId: string, messages: Message[]): void {
    const existingCache = this.cache.get(conversationId);
    const now = new Date();

    // Merge with existing messages, avoiding duplicates
    let allMessages = messages;
    if (existingCache) {
      const existingIds = new Set(existingCache.messages.map(m => m.id));
      const newMessages = messages.filter(m => !existingIds.has(m.id));
      allMessages = [...existingCache.messages, ...newMessages];
    }

    // Sort messages by timestamp for consistent ordering
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Trim messages if exceeding limit
    if (allMessages.length > this.config.maxMessagesPerConversation) {
      allMessages = allMessages.slice(-this.config.maxMessagesPerConversation);
    }

    // Calculate estimated memory usage
    const totalSize = this.estimateMessageArraySize(allMessages);

    // Update cache
    this.cache.set(conversationId, {
      messages: allMessages,
      metadata: {
        lastAccessed: now,
        accessCount: existingCache ? existingCache.metadata.accessCount + 1 : 1,
        conversationId,
        totalSize,
      },
    });

    this.updateStats();
    this.checkMemoryPressure();
  }

  // Get messages from cache
  getMessages(conversationId: string): Message[] | null {
    const cached = this.cache.get(conversationId);
    if (!cached) return null;

    // Update access metadata
    cached.metadata.lastAccessed = new Date();
    cached.metadata.accessCount++;

    return cached.messages;
  }

  // Remove messages from cache
  removeMessages(conversationId: string): void {
    this.cache.delete(conversationId);
    this.updateStats();
  }

  // Get specific message by ID
  getMessage(conversationId: string, messageId: string): Message | null {
    const messages = this.getMessages(conversationId);
    return messages?.find(m => m.id === messageId) || null;
  }

  // Add single message (for real-time updates)
  addMessage(conversationId: string, message: Message): void {
    const existing = this.cache.get(conversationId);
    if (!existing) {
      this.addMessages(conversationId, [message]);
      return;
    }

    // Check if message already exists
    if (existing.messages.some(m => m.id === message.id)) {
      return;
    }

    // Add message in correct chronological position
    const messages = [...existing.messages];
    const messageTime = new Date(message.created_at).getTime();
    
    let insertIndex = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (new Date(messages[i].created_at).getTime() <= messageTime) {
        insertIndex = i + 1;
        break;
      }
    }

    messages.splice(insertIndex, 0, message);

    // Trim if necessary
    if (messages.length > this.config.maxMessagesPerConversation) {
      messages.shift(); // Remove oldest message
    }

    // Update cache
    existing.messages = messages;
    existing.metadata.lastAccessed = new Date();
    existing.metadata.totalSize = this.estimateMessageArraySize(messages);

    this.updateStats();
  }

  // Intelligent cleanup based on usage patterns
  cleanup(aggressive = false): number {
    const now = new Date();
    let freedMemory = 0;
    const conversationsToRemove: string[] = [];

    // Calculate cleanup thresholds
    const maxAge = aggressive ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5 or 15 minutes
    const minAccessCount = aggressive ? 2 : 1;

    // Sort conversations by priority (least important first)
    const sortedConversations = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        // Priority factors: access count, last accessed time, message count
        const aPriority = a.metadata.accessCount * 
          (now.getTime() - a.metadata.lastAccessed.getTime()) / 
          Math.max(a.messages.length, 1);
        
        const bPriority = b.metadata.accessCount * 
          (now.getTime() - b.metadata.lastAccessed.getTime()) / 
          Math.max(b.messages.length, 1);
        
        return bPriority - aPriority; // Higher priority first
      });

    // Remove old or rarely accessed conversations
    for (const [conversationId, cached] of sortedConversations) {
      const age = now.getTime() - cached.metadata.lastAccessed.getTime();
      
      if (
        age > maxAge || 
        cached.metadata.accessCount < minAccessCount ||
        this.cache.size > this.config.maxConversationsInCache
      ) {
        conversationsToRemove.push(conversationId);
        freedMemory += cached.metadata.totalSize;
        
        // Stop if we've freed enough memory (non-aggressive mode)
        if (!aggressive && this.stats.totalMessages < this.config.maxTotalMessages * 0.7) {
          break;
        }
      }
    }

    // Remove selected conversations
    conversationsToRemove.forEach(id => this.cache.delete(id));

    // Trim messages in remaining conversations if needed
    if (aggressive || this.stats.totalMessages > this.config.maxTotalMessages * 0.8) {
      for (const [, cached] of this.cache) {
        const targetSize = Math.floor(this.config.maxMessagesPerConversation * 0.7);
        if (cached.messages.length > targetSize) {
          const removedCount = cached.messages.length - targetSize;
          cached.messages = cached.messages.slice(-targetSize);
          cached.metadata.totalSize = this.estimateMessageArraySize(cached.messages);
          freedMemory += removedCount * this.estimateAverageMessageSize();
        }
      }
    }

    this.updateStats();
    this.stats.lastCleanup = now;

    if (__DEV__) {
      const freedKB = (freedMemory / 1024).toFixed(2);
      logDebug(`Memory cleanup: freed ${freedKB}KB, removed ${conversationsToRemove.length} conversations`, "Debug");
    }

    return freedMemory;
  }

  // Get current memory statistics
  getStats(): MemoryStats {
    return { ...this.stats };
  }

  // Clear all cached data
  clear(): void {
    this.cache.clear();
    this.updateStats();
  }

  // Get cache status for debugging
  getCacheInfo() {
    const conversations = Array.from(this.cache.entries()).map(([id, cached]) => ({
      conversationId: id,
      messageCount: cached.messages.length,
      lastAccessed: cached.metadata.lastAccessed,
      accessCount: cached.metadata.accessCount,
      estimatedSize: cached.metadata.totalSize,
    }));

    return {
      totalConversations: this.cache.size,
      conversations,
      stats: this.getStats(),
      config: this.config,
    };
  }

  // Preload conversations that are likely to be accessed
  preloadConversations(conversationIds: string[]): void {
    // This would trigger loading in the background
    // Implementation depends on your data fetching strategy
    if (__DEV__) {
      logDebug('Preloading conversations:', "Debug", conversationIds);
    }
  }

  // Memory pressure detection and response
  private checkMemoryPressure(): void {
    const usage = this.stats.totalMessages / this.config.maxTotalMessages;
    
    if (usage > this.config.memoryWarningThreshold) {
      if (__DEV__) {
        logWarn('High memory usage detected:', "Warning", `${(usage * 100).toFixed(1)}%`);
      }
      this.cleanup(true); // Aggressive cleanup
    } else if (usage > this.config.aggressiveCleanupThreshold) {
      this.cleanup(false); // Normal cleanup
    }
  }

  // Estimate memory usage of message array
  private estimateMessageArraySize(messages: Message[]): number {
    return messages.reduce((total, message) => {
      let size = 0;
      size += message.content.length * 2; // String size (UTF-16)
      size += message.id.length * 2;
      size += message.sender_id.length * 2;
      size += message.conversation_id.length * 2;
      size += message.created_at.length * 2;
      size += message.media_url ? message.media_url.length * 2 : 0;
      size += message.media_type ? message.media_type.length * 2 : 0;
      size += 64; // Object overhead
      return total + size;
    }, 0);
  }

  // Estimate average message size for calculations
  private estimateAverageMessageSize(): number {
    const sampleSizes: number[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.messages.length > 0) {
        sampleSizes.push(cached.metadata.totalSize / cached.messages.length);
      }
    }

    if (sampleSizes.length === 0) return 200; // Default estimate

    return sampleSizes.reduce((sum, size) => sum + size, 0) / sampleSizes.length;
  }

  // Update internal statistics
  private updateStats(): void {
    let totalMessages = 0;
    let estimatedMemoryUsage = 0;

    for (const cached of this.cache.values()) {
      totalMessages += cached.messages.length;
      estimatedMemoryUsage += cached.metadata.totalSize;
    }

    this.stats = {
      totalMessages,
      estimatedMemoryUsage,
      cacheSize: this.cache.size,
      lastCleanup: this.stats.lastCleanup,
    };
  }

  // Start automatic cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup(false);
    }, this.config.cleanupInterval);
  }

  // Stop cleanup timer
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Singleton instance for app-wide use
export const messageMemoryManager = new MessageMemoryManager({
  maxConversationsInCache: Platform.OS === 'ios' ? 12 : 8,
  maxMessagesPerConversation: Platform.OS === 'ios' ? 1200 : 800,
  maxTotalMessages: Platform.OS === 'ios' ? 6000 : 4000,
  cleanupInterval: 45000, // 45 seconds
  aggressiveCleanupThreshold: 0.75,
  memoryWarningThreshold: 0.85,
});

// Export utility functions
export function estimateMessageSize(message: Message): number {
  let size = 0;
  size += message.content.length * 2;
  size += message.id.length * 2;
  size += message.sender_id.length * 2;
  size += message.conversation_id.length * 2;
  size += message.created_at.length * 2;
  size += message.media_url ? message.media_url.length * 2 : 0;
  size += message.media_type ? message.media_type.length * 2 : 0;
  size += 64; // Object overhead
  return size;
}

export function formatMemorySize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

export default MessageMemoryManager;
