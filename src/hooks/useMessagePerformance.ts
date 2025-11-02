import { useCallback, useEffect, useRef, useMemo } from 'react';
import { InteractionManager, LayoutAnimation, Platform } from 'react-native';
import { useSharedValue, runOnJS, cancelAnimation } from 'react-native-reanimated';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface PerformanceConfig {
  enableBatching: boolean;
  batchSize: number;
  debounceDelay: number;
  maxCacheSize: number;
  enableOptimizations: boolean;
  trackMetrics: boolean;
}

interface PerformanceMetrics {
  renderTime: number;
  scrollPerformance: number;
  memoryUsage: number;
  cacheHitRate: number;
  averageMessageRenderTime: number;
}

interface UseMessagePerformanceReturn {
  // Performance optimization functions
  optimizeRender: (messages: Message[]) => Message[];
  batchUpdates: (callback: () => void) => void;
  debounceScroll: (callback: () => void) => void;
  preloadImages: (messages: Message[]) => void;
  
  // Memory management
  cleanupMemory: () => void;
  optimizeCache: () => void;
  getMemoryStats: () => { used: number; available: number };
  
  // Scroll performance
  enableScrollOptimizations: () => void;
  disableScrollOptimizations: () => void;
  getScrollPerformance: () => number;
  
  // Metrics and monitoring
  startMetricsCollection: () => void;
  stopMetricsCollection: () => void;
  getPerformanceMetrics: () => PerformanceMetrics;
  
  // Animation optimizations
  optimizeAnimations: (enabled: boolean) => void;
  reduceAnimations: (enabled: boolean) => void;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enableBatching: true,
  batchSize: 20,
  debounceDelay: 16, // ~60fps
  maxCacheSize: 1000,
  enableOptimizations: true,
  trackMetrics: false,
};

export function useMessagePerformance(
  config: Partial<PerformanceConfig> = {}
): UseMessagePerformanceReturn {
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  
  // Performance tracking refs
  const renderTimeRef = useRef<number[]>([]);
  const scrollTimeRef = useRef<number[]>([]);
  const memoryUsageRef = useRef<number[]>([]);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);
  const isMetricsActiveRef = useRef(false);
  const imageCache = useRef<Map<string, boolean>>(new Map());
  
  // Animation values for performance tracking
  const scrollVelocity = useSharedValue(0);
  const renderTime = useSharedValue(0);
  
  // Debounce and batch refs
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const batchedUpdatesRef = useRef<(() => void)[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Optimize message rendering with memoization
  const optimizeRender = useCallback((messages: Message[]): Message[] => {
    if (!finalConfig.enableOptimizations) return messages;
    
    const startTime = performance.now();
    
    // Batch process messages for better performance
    const optimizedMessages = messages.reduce((acc, message, index) => {
      // Only process visible messages based on batch size
      if (index < finalConfig.batchSize || 
          index >= messages.length - finalConfig.batchSize) {
        acc.push({
          ...message,
          // Add performance hints
          _renderHint: 'priority',
          _cacheKey: `${message.id}-${message.created_at}`,
        });
      } else {
        // Lazy load messages outside visible range
        acc.push({
          ...message,
          _renderHint: 'lazy',
          _cacheKey: `${message.id}-${message.created_at}`,
        });
      }
      return acc;
    }, [] as (Message & { _renderHint?: string; _cacheKey?: string })[]);
    
    const endTime = performance.now();
    const renderDuration = endTime - startTime;
    
    // Track render time
    if (finalConfig.trackMetrics && isMetricsActiveRef.current) {
      renderTimeRef.current.push(renderDuration);
      renderTime.value = renderDuration;
    }
    
    return optimizedMessages as Message[];
  }, [finalConfig]);

  // Batch multiple updates together for better performance
  const batchUpdates = useCallback((callback: () => void) => {
    if (!finalConfig.enableBatching) {
      callback();
      return;
    }
    
    batchedUpdatesRef.current.push(callback);
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(() => {
      const updates = batchedUpdatesRef.current.splice(0);
      
      InteractionManager.runAfterInteractions(() => {
        updates.forEach(update => update());
      });
    }, finalConfig.debounceDelay);
  }, [finalConfig]);

  // Debounce scroll events for better performance
  const debounceScroll = useCallback((callback: () => void) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(callback);
    }, finalConfig.debounceDelay);
  }, [finalConfig.debounceDelay]);

  // Preload images for better user experience
  const preloadImages = useCallback((messages: Message[]) => {
    if (!finalConfig.enableOptimizations) return;
    
    const imagesToPreload = messages
      .filter(msg => msg.media_url && !imageCache.current.has(msg.media_url))
      .slice(0, 10); // Limit to 10 images at a time
    
    imagesToPreload.forEach(message => {
      if (message.media_url) {
        const image = new Image();
        image.onload = () => {
          imageCache.current.set(message.media_url!, true);
          cacheHitsRef.current++;
        };
        image.onerror = () => {
          cacheMissesRef.current++;
        };
        image.src = message.media_url;
      }
    });
  }, [finalConfig.enableOptimizations]);

  // Memory management functions
  const cleanupMemory = useCallback(() => {
    // Clear old render time data
    if (renderTimeRef.current.length > 100) {
      renderTimeRef.current = renderTimeRef.current.slice(-50);
    }
    
    // Clear old scroll performance data
    if (scrollTimeRef.current.length > 100) {
      scrollTimeRef.current = scrollTimeRef.current.slice(-50);
    }
    
    // Clear old memory usage data
    if (memoryUsageRef.current.length > 100) {
      memoryUsageRef.current = memoryUsageRef.current.slice(-50);
    }
    
    // Clear old image cache entries
    if (imageCache.current.size > finalConfig.maxCacheSize) {
      const entries = Array.from(imageCache.current.entries());
      const toKeep = entries.slice(-Math.floor(finalConfig.maxCacheSize * 0.7));
      imageCache.current = new Map(toKeep);
    }
    
    // Force garbage collection if available (development only)
    if (__DEV__ && global.gc) {
      global.gc();
    }
  }, [finalConfig.maxCacheSize]);

  const optimizeCache = useCallback(() => {
    // Clear unused cached data
    cleanupMemory();
    
    // Reset performance counters if they get too large
    if (cacheHitsRef.current > 10000 || cacheMissesRef.current > 10000) {
      cacheHitsRef.current = Math.floor(cacheHitsRef.current * 0.1);
      cacheMissesRef.current = Math.floor(cacheMissesRef.current * 0.1);
    }
  }, [cleanupMemory]);

  const getMemoryStats = useCallback(() => {
    // Estimate memory usage (simplified)
    const estimatedUsage = 
      renderTimeRef.current.length * 8 + // 8 bytes per number
      scrollTimeRef.current.length * 8 +
      memoryUsageRef.current.length * 8 +
      imageCache.current.size * 100; // Rough estimate per cache entry
    
    return {
      used: estimatedUsage,
      available: finalConfig.maxCacheSize * 100 - estimatedUsage,
    };
  }, [finalConfig.maxCacheSize]);

  // Scroll performance optimization
  const enableScrollOptimizations = useCallback(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext({
        ...LayoutAnimation.Presets.easeInEaseOut,
        duration: 200,
      });
    }
  }, []);

  const disableScrollOptimizations = useCallback(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.linear);
    }
  }, []);

  const getScrollPerformance = useCallback((): number => {
    if (scrollTimeRef.current.length === 0) return 0;
    
    const recentTimes = scrollTimeRef.current.slice(-10);
    const averageTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
    
    // Convert to fps-like metric (higher is better)
    return Math.max(0, 60 - (averageTime / 16.67));
  }, []);

  // Metrics collection
  const startMetricsCollection = useCallback(() => {
    isMetricsActiveRef.current = true;
    renderTimeRef.current = [];
    scrollTimeRef.current = [];
    memoryUsageRef.current = [];
    cacheHitsRef.current = 0;
    cacheMissesRef.current = 0;
  }, []);

  const stopMetricsCollection = useCallback(() => {
    isMetricsActiveRef.current = false;
  }, []);

  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    const renderTimes = renderTimeRef.current;
    const scrollTimes = scrollTimeRef.current;
    const memoryUsage = memoryUsageRef.current;
    
    const avgRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
      : 0;
    
    const avgScrollPerformance = scrollTimes.length > 0
      ? scrollTimes.reduce((sum, time) => sum + time, 0) / scrollTimes.length
      : 0;
    
    const avgMemoryUsage = memoryUsage.length > 0
      ? memoryUsage.reduce((sum, usage) => sum + usage, 0) / memoryUsage.length
      : 0;
    
    const totalCacheRequests = cacheHitsRef.current + cacheMissesRef.current;
    const cacheHitRate = totalCacheRequests > 0 
      ? cacheHitsRef.current / totalCacheRequests 
      : 0;
    
    return {
      renderTime: avgRenderTime,
      scrollPerformance: Math.max(0, 60 - (avgScrollPerformance / 16.67)),
      memoryUsage: avgMemoryUsage,
      cacheHitRate: cacheHitRate * 100,
      averageMessageRenderTime: avgRenderTime,
    };
  }, []);

  // Animation optimizations
  const optimizeAnimations = useCallback((enabled: boolean) => {
    if (!enabled) {
      cancelAnimation(scrollVelocity);
      cancelAnimation(renderTime);
    }
  }, [scrollVelocity, renderTime]);

  const reduceAnimations = useCallback((enabled: boolean) => {
    if (enabled && Platform.OS === 'ios') {
      LayoutAnimation.configureNext({
        ...LayoutAnimation.Presets.easeInEaseOut,
        duration: 100, // Reduced duration
      });
    }
  }, []);

  // Auto cleanup interval
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupMemory();
    }, 60000); // Clean up every minute
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [cleanupMemory]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    optimizeRender,
    batchUpdates,
    debounceScroll,
    preloadImages,
    cleanupMemory,
    optimizeCache,
    getMemoryStats,
    enableScrollOptimizations,
    disableScrollOptimizations,
    getScrollPerformance,
    startMetricsCollection,
    stopMetricsCollection,
    getPerformanceMetrics,
    optimizeAnimations,
    reduceAnimations,
  };
}