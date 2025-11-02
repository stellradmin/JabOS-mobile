// @ts-nocheck
/**
 * Accessible Conversation List Component
 * Provides fully accessible conversation browsing with keyboard and screen reader support
 * Includes enhanced navigation, search, and filtering capabilities
 */

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  AccessibilityInfo,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Search, MessageCircle, Clock, Star, MoreVertical } from 'lucide-react-native';

import {
  enhancedAccessibilityManager,
  createConversationAccessibilityProps,
  createEnhancedListProps,
  createEnhancedFormFieldProps,
  EnhancedFocusManager,
  ScreenReaderOptimization,
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  ENHANCED_ACCESSIBILITY_ROLES,
} from '../../utils/enhancedAccessibility';
import { useFocusManagement } from '../../hooks/useFocusManagement';

interface ConversationItem {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isTyping: boolean;
  hasMedia: boolean;
  isPinned: boolean;
  lastSeen?: string;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  onConversationPress: (conversationId: string) => void;
  onConversationLongPress?: (conversationId: string) => void;
  onSearch?: (query: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  searchQuery?: string;
  filterType?: 'all' | 'unread' | 'pinned' | 'online';
  onFilterChange?: (filter: 'all' | 'unread' | 'pinned' | 'online') => void;
  testID?: string;
}

interface ConversationItemProps {
  conversation: ConversationItem;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  isSearchResult?: boolean;
  searchQuery?: string;
}

const ConversationItemComponent: React.FC<ConversationItemProps> = React.memo(({
  conversation,
  index,
  onPress,
  onLongPress,
  isSearchResult = false,
  searchQuery = '',
}) => {
  const [accessibilityState, setAccessibilityState] = useState(enhancedAccessibilityManager.getState());
  const fadeAnim = useSharedValue(1);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    const removeListener = enhancedAccessibilityManager.addListener(setAccessibilityState);
    return removeListener;
  }, []);

  // Animation for press feedback
  const handlePressIn = useCallback(() => {
    if (!accessibilityState.reduceMotionEnabled) {
      scaleAnim.value = withSpring(0.98, { duration: 150 });
    }
  }, [scaleAnim, accessibilityState.reduceMotionEnabled]);

  const handlePressOut = useCallback(() => {
    if (!accessibilityState.reduceMotionEnabled) {
      scaleAnim.value = withSpring(1, { duration: 150 });
    }
  }, [scaleAnim, accessibilityState.reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  // Format timestamp for accessibility
  const formatTimestampForA11y = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }, []);

  // Highlight search terms in text
  const highlightSearchTerms = useCallback((text: string, query: string): string => {
    if (!query || !isSearchResult) return text;
    // For accessibility, we'll just return the text as-is
    // Visual highlighting would be handled in a separate Text component
    return text;
  }, [isSearchResult]);

  // Create accessibility props
  const conversationA11yProps = createConversationAccessibilityProps(
    {
      userName: conversation.userName,
      lastMessage: conversation.lastMessage,
      timestamp: formatTimestampForA11y(conversation.timestamp),
      unreadCount: conversation.unreadCount,
      isOnline: conversation.isOnline,
      hasMedia: conversation.hasMedia,
    },
    index
  );

  return (
    <Animated.View style={[styles.conversationItem, animatedStyle]}>
      <Pressable
        style={styles.conversationPressable}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...conversationA11yProps}
      >
        {/* User photo with online indicator */}
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: conversation.userPhoto }}
            style={styles.userPhoto}
            contentFit="cover"
            accessible={true}
            accessibilityRole="image"
            accessibilityLabel={`Profile photo of ${conversation.userName}`}
          />
          {conversation.isOnline && (
            <View 
              style={styles.onlineIndicator}
              accessible={true}
              accessibilityLabel="Online"
            />
          )}
          {conversation.unreadCount > 0 && (
            <View 
              style={styles.unreadBadge}
              accessible={true}
              accessibilityLabel={`${conversation.unreadCount} unread`}
              accessibilityRole="text"
            >
              <Text style={styles.unreadCount}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* Conversation details */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text 
              style={[styles.userName, conversation.unreadCount > 0 && styles.unreadUserName]}
              numberOfLines={1}
            >
              {highlightSearchTerms(conversation.userName, searchQuery)}
            </Text>
            
            <View style={styles.metaInfo}>
              {conversation.isPinned && (
                <Star 
                  size={12} 
                  color="#fbbf24" 
                  fill="#fbbf24"
                  accessible={true}
                  accessibilityLabel="Pinned conversation"
                />
              )}
              <Text style={styles.timestamp}>
                {formatTimestampForA11y(conversation.timestamp)}
              </Text>
            </View>
          </View>

          <View style={styles.messageRow}>
            <Text 
              style={[styles.lastMessage, conversation.unreadCount > 0 && styles.unreadMessage]}
              numberOfLines={2}
            >
              {conversation.isTyping ? 'Typing...' : highlightSearchTerms(conversation.lastMessage, searchQuery)}
            </Text>
            
            {conversation.hasMedia && (
              <MessageCircle 
                size={14} 
                color="#6b7280" 
                accessible={true}
                accessibilityLabel="Contains media"
              />
            )}
          </View>
        </View>

        {/* More options button */}
        {onLongPress && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => onLongPress()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`More options for conversation with ${conversation.userName}`}
            accessibilityHint="Double tap to show conversation options"
          >
            <MoreVertical size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </Pressable>
    </Animated.View>
  );
});

ConversationItemComponent.displayName = 'ConversationItemComponent';

export const AccessibleConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onConversationPress,
  onConversationLongPress,
  onSearch,
  onRefresh,
  isLoading = false,
  searchQuery = '',
  filterType = 'all',
  onFilterChange,
  testID = 'accessible-conversation-list',
}) => {
  const { createFocusGroup, registerFocusableElement, focusFirst } = useFocusManagement();
  const [accessibilityState, setAccessibilityState] = useState(enhancedAccessibilityManager.getState());
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Refs
  const searchInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  // Set up accessibility state listener
  useEffect(() => {
    const removeListener = enhancedAccessibilityManager.addListener(setAccessibilityState);
    return removeListener;
  }, []);

  // Create focus group for navigation
  useEffect(() => {
    const groupId = createFocusGroup({
      trapFocus: false,
      restoreFocus: false,
    });
    setFocusGroupId(groupId);

    // Register search input
    if (searchInputRef.current) {
      registerFocusableElement(groupId, 'search-input', searchInputRef.current, {
        priority: 10,
        accessibilityLabel: 'Search conversations',
        accessibilityRole: 'textbox',
      });
    }

    return () => {
      // Cleanup handled by useFocusManagement
    };
  }, [createFocusGroup, registerFocusableElement]);

  // Filter conversations based on filter type
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Apply search filter
    if (localSearchQuery.trim()) {
      filtered = filtered.filter(conv =>
        conv.userName.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
        conv.lastMessage.toLowerCase().includes(localSearchQuery.toLowerCase())
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'unread':
        filtered = filtered.filter(conv => conv.unreadCount > 0);
        break;
      case 'pinned':
        filtered = filtered.filter(conv => conv.isPinned);
        break;
      case 'online':
        filtered = filtered.filter(conv => conv.isOnline);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    return filtered;
  }, [conversations, localSearchQuery, filterType]);

  // Handle search input change
  const handleSearchChange = useCallback((text: string) => {
    setLocalSearchQuery(text);
    if (onSearch) {
      onSearch(text);
    }
    
    // Announce search results
    if (text.trim()) {
      ScreenReaderOptimization.announceSearchResults(text, filteredConversations.length);
    }
  }, [onSearch, filteredConversations.length]);

  // Handle conversation press
  const handleConversationPress = useCallback((conversationId: string, userName: string) => {
    EnhancedFocusManager.focusConversation(userName, false);
    onConversationPress(conversationId);
  }, [onConversationPress]);

  // Render conversation item
  const renderConversation = useCallback(({ item, index }: { item: ConversationItem; index: number }) => (
    <ConversationItemComponent
      conversation={item}
      index={index}
      onPress={() => handleConversationPress(item.id, item.userName)}
      onLongPress={onConversationLongPress ? () => onConversationLongPress(item.id) : undefined}
      isSearchResult={!!localSearchQuery.trim()}
      searchQuery={localSearchQuery}
    />
  ), [handleConversationPress, onConversationLongPress, localSearchQuery]);

  // List key extractor
  const keyExtractor = useCallback((item: ConversationItem) => item.id, []);

  // Empty state component
  const EmptyConversations = useCallback(() => (
    <View 
      style={styles.emptyContainer}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={
        localSearchQuery.trim() 
          ? `No conversations found for "${localSearchQuery}"`
          : filterType === 'all' 
            ? "No conversations yet. Start matching to begin conversations!"
            : `No ${filterType} conversations`
      }
    >
      <MessageCircle size={48} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>
        {localSearchQuery.trim() 
          ? 'No Results Found'
          : filterType === 'all'
            ? 'No Conversations'
            : `No ${filterType} Conversations`
        }
      </Text>
      <Text style={styles.emptySubtitle}>
        {localSearchQuery.trim()
          ? `Try adjusting your search for "${localSearchQuery}"`
          : filterType === 'all'
            ? 'Start matching with people to begin conversations'
            : `You don't have any ${filterType} conversations yet`
        }
      </Text>
    </View>
  ), [localSearchQuery, filterType]);

  // Filter buttons
  const FilterButtons = useCallback(() => {
    if (!onFilterChange) return null;

    const filters: Array<{ key: typeof filterType; label: string; count?: number }> = [
      { key: 'all', label: 'All', count: conversations.length },
      { key: 'unread', label: 'Unread', count: conversations.filter(c => c.unreadCount > 0).length },
      { key: 'pinned', label: 'Pinned', count: conversations.filter(c => c.isPinned).length },
      { key: 'online', label: 'Online', count: conversations.filter(c => c.isOnline).length },
    ];

    return (
      <View 
        style={styles.filterContainer}
        accessible={true}
        accessibilityRole="tablist"
        accessibilityLabel="Conversation filters"
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              filterType === filter.key && styles.activeFilterButton,
            ]}
            onPress={() => onFilterChange(filter.key)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={`${filter.label} conversations`}
            accessibilityHint={`Show ${filter.label.toLowerCase()} conversations. ${filter.count} items`}
            accessibilityState={{
              selected: filterType === filter.key,
            }}
          >
            <Text style={[
              styles.filterButtonText,
              filterType === filter.key && styles.activeFilterButtonText,
            ]}>
              {filter.label}
            </Text>
            {filter.count !== undefined && filter.count > 0 && (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{filter.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [filterType, conversations, onFilterChange]);

  // Create list accessibility props
  const listAccessibilityProps = createEnhancedListProps(
    'conversations',
    filteredConversations.length,
    isLoading
  );

  // Create search input accessibility props
  const searchInputProps = createEnhancedFormFieldProps(
    'search',
    'Search conversations',
    {
      placeholder: 'Search by name or message...',
      value: localSearchQuery,
    }
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Search header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={localSearchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search conversations..."
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
            clearButtonMode="while-editing"
            {...searchInputProps}
            testID={`${testID}-search-input`}
          />
        </View>
      </View>

      {/* Filter buttons */}
      <FilterButtons />

      {/* Conversation list */}
      <FlatList
        ref={flatListRef}
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={keyExtractor}
        onRefresh={onRefresh}
        refreshing={isLoading}
        ListEmptyComponent={EmptyConversations}
        showsVerticalScrollIndicator={!accessibilityState.screenReaderEnabled}
        keyboardShouldPersistTaps="handled"
        {...listAccessibilityProps}
        testID={`${testID}-flatlist`}
        // Performance optimizations for accessibility
        removeClippedSubviews={Platform.OS === 'android' && !accessibilityState.screenReaderEnabled}
        maxToRenderPerBatch={accessibilityState.screenReaderEnabled ? 5 : 10}
        updateCellsBatchingPeriod={accessibilityState.screenReaderEnabled ? 100 : 50}
        windowSize={accessibilityState.screenReaderEnabled ? 5 : 10}
        initialNumToRender={accessibilityState.screenReaderEnabled ? 10 : 20}
        getItemLayout={(data, index) => ({
          length: 80,
          offset: 80 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: 'white',
    minHeight: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#334155',
    gap: 4,
    minHeight: 32,
  },
  activeFilterButton: {
    backgroundColor: '#F2BAC9',
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: '#cbd5e1',
  },
  activeFilterButtonText: {
    color: '#0f172a',
  },
  filterCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#e2e8f0',
  },
  conversationItem: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  conversationPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 80,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F2BAC9',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadCount: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#0f172a',
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: '#e2e8f0',
    flex: 1,
  },
  unreadUserName: {
    fontFamily: 'Geist-Regular',
    color: 'white',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#94a3b8',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#94a3b8',
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    color: '#cbd5e1',
    fontFamily: 'Geist-Medium',
  },
  moreButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 6,
    minWidth: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
    minHeight: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#e2e8f0',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default AccessibleConversationList;
// @ts-nocheck
