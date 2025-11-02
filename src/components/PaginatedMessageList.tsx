import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  AccessibilityInfo,
  AccessibilityRole,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { FlashList as FlashListType } from '@shopify/flash-list';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { useMessagePagination } from '../hooks/useMessagePagination';
import LoadingProgress from '../../components/LoadingProgress';
import { messageAccessibilityManager } from '../utils/messageAccessibility';
import { useMessagePerformance } from '../hooks/useMessagePerformance';
import { useEnhancedAccessibility } from '../hooks/useEnhancedAccessibility';
import { 
  enhancedAccessibilityManager,
  createEnhancedListProps,
  ScreenReaderOptimization,
} from '../utils/enhancedAccessibility';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface PaginatedMessageListProps {
  conversationId: string | null;
  currentUserId: string | null;
  otherUserName?: string;
  onMessagePress?: (message: Message) => void;
  onScrollToEnd?: () => void;
  estimatedItemSize?: number;
  initialScrollIndex?: number;
  testID?: string;
  enableAccessibilityAnnouncements?: boolean;
}

interface MessageItemProps {
  message: Message;
  isFromCurrentUser: boolean;
  otherUserName: string;
  onPress?: (message: Message) => void;
  index: number;
  isVisible: boolean;
  totalMessages: number;
}

const { width: screenWidth } = Dimensions.get('window');
const ITEM_HEIGHT_ESTIMATE = 80;
const BUFFER_SIZE = 10;

// Optimized message item component
const MessageItem: React.FC<MessageItemProps> = React.memo(({
  message,
  isFromCurrentUser,
  otherUserName,
  onPress,
  index,
  isVisible,
  totalMessages,
}) => {
  const fadeAnim = useSharedValue(isVisible ? 1 : 0);
  const scaleAnim = useSharedValue(isVisible ? 1 : 0.95);
  const [accessibilityState, setAccessibilityState] = useState(messageAccessibilityManager.getState());

  useEffect(() => {
    const removeListener = messageAccessibilityManager.addListener(() => {
      setAccessibilityState(messageAccessibilityManager.getState());
    });
    return removeListener;
  }, []);

  useEffect(() => {
    const shouldAnimate = !accessibilityState.isReduceMotionEnabled;
    const duration = shouldAnimate ? 200 : 0;
    
    if (shouldAnimate) {
      fadeAnim.value = withTiming(isVisible ? 1 : 0, { duration });
      scaleAnim.value = withTiming(isVisible ? 1 : 0.95, { duration });
    } else {
      fadeAnim.value = isVisible ? 1 : 0;
      scaleAnim.value = 1;
    }
  }, [isVisible, fadeAnim, scaleAnim, accessibilityState.isReduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const messageTime = useMemo(() => {
    return new Date(message.created_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }, [message.created_at]);

  const messageStyle = isFromCurrentUser ? styles.sentMessage : styles.receivedMessage;
  const textStyle = isFromCurrentUser ? styles.sentText : styles.receivedText;
  const timeStyle = [styles.timeText, isFromCurrentUser && styles.sentTimeText];

  // Generate comprehensive accessibility label
  const accessibilityLabel = useMemo(() => {
    return messageAccessibilityManager.generateMessageAccessibilityLabel(
      message,
      isFromCurrentUser,
      otherUserName,
      index,
      totalMessages
    );
  }, [message, isFromCurrentUser, otherUserName, index, totalMessages]);

  // Generate accessibility hint
  const accessibilityHint = useMemo(() => {
    return messageAccessibilityManager.generateMessageAccessibilityHint(
      message,
      !!onPress
    );
  }, [message, onPress]);

  return (
    <Animated.View 
      style={[animatedStyle]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={`message-${message.id}`}
      onAccessibilityTap={() => onPress && onPress(message)}
    >
      <View style={messageStyle}>
        {message.media_url && (
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: message.media_url }}
              style={styles.mediaImage}
              contentFit="cover"
              transition={200}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`Message attachment: ${message.media_type || 'image'}`}
              accessibilityHint="Double tap to view full size"
            />
          </View>
        )}
        <Text style={textStyle} selectable>
          {message.content}
        </Text>
        <Text style={timeStyle}>
          {messageTime}
        </Text>
      </View>
    </Animated.View>
  );
});

MessageItem.displayName = 'MessageItem';

// Loading indicator component
const ListLoadingIndicator: React.FC<{
  loading: boolean;
  text: string;
}> = ({ loading, text }) => {
  const opacity = useSharedValue(loading ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(loading ? 1 : 0, { duration: 300 });
  }, [loading, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!loading) return null;

  return (
    <Animated.View style={[styles.loadingContainer, animatedStyle]}>
      <LoadingProgress 
        message={text}
        subMessage=""
      />
      <Text style={styles.loadingText}>{text}</Text>
    </Animated.View>
  );
};

// Empty state component
const EmptyMessageList: React.FC = () => (
  <View 
    style={styles.emptyContainer}
    accessible={true}
    accessibilityRole="text"
    accessibilityLabel="No messages yet. Start a conversation!"
  >
    <Text style={styles.emptyText}>No messages yet</Text>
    <Text style={styles.emptySubtext}>Start a conversation!</Text>
  </View>
);

// Error state component
const MessageListError: React.FC<{
  error: string;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <View 
    style={styles.errorContainer}
    accessible={true}
    accessibilityRole="alert"
    accessibilityLabel={`Error loading messages: ${error}`}
  >
    <Text style={styles.errorText}>Error loading messages</Text>
    <Text style={styles.errorSubtext}>{error}</Text>
    <Text 
      style={styles.retryText}
      onPress={onRetry}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Tap to retry loading messages"
    >
      Tap to retry
    </Text>
  </View>
);

export const PaginatedMessageList: React.FC<PaginatedMessageListProps> = ({
  conversationId,
  currentUserId,
  otherUserName = 'Contact',
  onMessagePress,
  onScrollToEnd,
  estimatedItemSize = ITEM_HEIGHT_ESTIMATE,
  initialScrollIndex,
  testID = 'paginated-message-list',
  enableAccessibilityAnnouncements = true,
}) => {
  const flashListRef = useRef<any>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  const [accessibilityState, setAccessibilityState] = useState(messageAccessibilityManager.getState());
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousMessageCount = useRef(0);

  // Enhanced accessibility integration
  const {
    liveRegionManager,
    performanceOptimizer,
    shouldReduceMotion,
    getAnimationDuration,
  } = useEnhancedAccessibility({
    enableAutoAnnouncements: true,
    gestureAlternatives: true,
    optimizationLevel: 'ENHANCED',
  });

  const {
    messages,
    loading,
    error,
    hasOlderMessages,
    hasNewerMessages,
    loadOlderMessages,
    loadNewerMessages,
    refreshMessages,
    addMessage,
  } = useMessagePagination(conversationId, {
    pageSize: 50,
    initialLoadCount: 100,
    cacheSize: 1000,
    prefetchThreshold: 10,
  });

  const {
    optimizeRender,
    batchUpdates,
    debounceScroll,
    preloadImages,
    enableScrollOptimizations,
    disableScrollOptimizations,
  } = useMessagePerformance({
    enableOptimizations: true,
    trackMetrics: __DEV__,
  });

  // Set up accessibility listener
  useEffect(() => {
    const removeListener = messageAccessibilityManager.addListener(() => {
      setAccessibilityState(messageAccessibilityManager.getState());
    });
    return removeListener;
  }, []);

  // Announce new messages
  useEffect(() => {
    if (!enableAccessibilityAnnouncements) return;

    const newMessageCount = messages.length;
    const previousCount = previousMessageCount.current;

    if (newMessageCount > previousCount && previousCount > 0) {
      const newMessages = messages.slice(previousCount);
      newMessages.forEach(message => {
        const isFromCurrentUser = message.sender_id === currentUserId;
        messageAccessibilityManager.announceNewMessage(
          message,
          otherUserName,
          isFromCurrentUser
        );
      });
    }

    previousMessageCount.current = newMessageCount;
  }, [messages.length, currentUserId, otherUserName, enableAccessibilityAnnouncements]);

  // Announce loading states
  useEffect(() => {
    if (!enableAccessibilityAnnouncements) return;

    if (loading.initial) {
      messageAccessibilityManager.announceLoadingState('loading', 'conversation messages');
    } else if (loading.loadingOlder) {
      messageAccessibilityManager.announceLoadingState('loading', 'older messages');
    } else if (loading.loadingNewer) {
      messageAccessibilityManager.announceLoadingState('loading', 'newer messages');
    }
  }, [loading, enableAccessibilityAnnouncements]);

  // Optimize messages with performance and accessibility considerations
  const optimizedMessages = useMemo(() => {
    const processedMessages = optimizeRender(messages);
    
    // Preload images for better performance
    if (processedMessages.length > 0) {
      preloadImages(processedMessages);
    }
    
    return processedMessages;
  }, [messages, optimizeRender, preloadImages]);

  // Handle scroll events for performance
  const handleScroll = useCallback((event: any) => {
    setIsScrolling(true);
    
    // Optimize scroll performance based on accessibility settings
    if (accessibilityState.isScreenReaderEnabled) {
      enableScrollOptimizations();
    }
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set scroll end timeout
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      if (accessibilityState.isScreenReaderEnabled) {
        disableScrollOptimizations();
      }
    }, 150);
  }, [accessibilityState.isScreenReaderEnabled, enableScrollOptimizations, disableScrollOptimizations]);

  // Handle viewable items change with accessibility announcements
  const onViewableItemsChanged = useCallback(({ viewableItems, changed }: any) => {
    if (viewableItems.length > 0) {
      const start = viewableItems[0].index || 0;
      const end = viewableItems[viewableItems.length - 1].index || 0;
      setVisibleRange({ start, end });

      // Announce scroll position for accessibility if enabled and screen reader is active
      if (enableAccessibilityAnnouncements && 
          accessibilityState.isScreenReaderEnabled && 
          !isScrolling) {
        debounceScroll(() => {
          messageAccessibilityManager.announceScrollPosition(
            start,
            messages.length,
            otherUserName
          );
        });
      }
    }
  }, [enableAccessibilityAnnouncements, accessibilityState.isScreenReaderEnabled, isScrolling, messages.length, otherUserName, debounceScroll]);

  // Optimized render item with accessibility enhancements
  const renderMessage = useCallback(({ item, index }: any) => {
    if (!currentUserId) return null;

    const isVisible = index >= visibleRange.start - BUFFER_SIZE && 
                     index <= visibleRange.end + BUFFER_SIZE;

    return (
      <MessageItem
        message={item}
        isFromCurrentUser={item.sender_id === currentUserId}
        otherUserName={otherUserName}
        onPress={onMessagePress}
        index={index}
        isVisible={isVisible && !isScrolling}
        totalMessages={messages.length}
      />
    );
  }, [currentUserId, otherUserName, onMessagePress, visibleRange, isScrolling, messages.length]);

  // Header component (newer messages loading)
  const ListHeaderComponent = useCallback(() => (
    <ListLoadingIndicator 
      loading={loading.loadingNewer} 
      text="Loading newer messages..."
    />
  ), [loading.loadingNewer]);

  // Footer component (older messages loading)
  const ListFooterComponent = useCallback(() => (
    <ListLoadingIndicator 
      loading={loading.loadingOlder} 
      text="Loading older messages..."
    />
  ), [loading.loadingOlder]);

  // Handle end reached (load older messages)
  const handleEndReached = useCallback(() => {
    if (hasOlderMessages && !loading.loadingOlder) {
      loadOlderMessages();
    }
  }, [hasOlderMessages, loading.loadingOlder, loadOlderMessages]);

  // Handle scroll to top (load newer messages)
  const handleScrollToTop = useCallback(() => {
    if (hasNewerMessages && !loading.loadingNewer) {
      loadNewerMessages();
    }
  }, [hasNewerMessages, loading.loadingNewer, loadNewerMessages]);

  // Get item layout for better performance
  const getItemLayout = useCallback((data: Message[] | null | undefined, index: number) => ({
    length: estimatedItemSize,
    offset: estimatedItemSize * index,
    index,
  }), [estimatedItemSize]);

  // Key extractor
  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Scroll to end when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && onScrollToEnd) {
      onScrollToEnd();
    }
  }, [messages.length, onScrollToEnd]);

  // Cleanup scroll timeout
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Loading state
  if (loading.initial) {
    return (
      <View 
        style={styles.loadingContainer}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading messages"
      >
        <LoadingProgress message="Loading messages..." subMessage="" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // Error state
  if (error && messages.length === 0) {
    return (
      <MessageListError 
        error={error} 
        onRetry={refreshMessages}
      />
    );
  }

  // Empty state
  if (messages.length === 0 && !loading.initial) {
    return <EmptyMessageList />;
  }

  // Generate comprehensive accessibility props for the list
  const listAccessibilityProps = messageAccessibilityManager.getMessageListAccessibilityProps(
    messages.length,
    otherUserName,
    loading.initial || loading.refreshing
  );

  return (
    <View style={styles.container} testID={testID}>
      <FlashListComponent
        ref={flashListRef}
        data={optimizedMessages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        
        estimatedItemSize={estimatedItemSize}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        onScroll={handleScroll}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        onRefresh={refreshMessages}
        refreshing={loading.refreshing}
        initialScrollIndex={initialScrollIndex}
        showsVerticalScrollIndicator={!accessibilityState.isScreenReaderEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContainer}
        {...listAccessibilityProps}
        testID={`${testID}-flashlist`}
        // Performance optimizations with accessibility considerations
        removeClippedSubviews={Platform.OS === 'android' && !accessibilityState.isScreenReaderEnabled}
        
        getItemType={() => 'message'}
        
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sentMessage: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    maxWidth: '80%',
    alignSelf: 'flex-end',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  receivedMessage: {
    backgroundColor: '#F2BAC9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sentText: {
    color: 'black',
    fontFamily: 'Geist-Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  receivedText: {
    color: 'black',
    fontFamily: 'Geist-Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    alignSelf: 'flex-end',
    marginTop: 4,
    fontFamily: 'Geist-Regular',
  },
  sentTimeText: {
    color: '#666',
  },
  mediaContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(242, 186, 201, 0.1)',
    borderRadius: 12,
    marginVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontFamily: 'Geist-Regular',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#F2BAC9',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#F2BAC9',
    textDecorationLine: 'underline',
  },
});

export default PaginatedMessageList;
// Cast FlashList to any to bypass prop type friction under strict TS
const FlashListComponent: any = FlashList;
