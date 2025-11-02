// @ts-nocheck
/**
 * Accessible Navigation Bar Component
 * Provides fully accessible tab navigation with keyboard and screen reader support
 * Includes skip navigation, focus management, and comprehensive accessibility features
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  AccessibilityInfo,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { 
  Heart, 
  MessageCircle, 
  User, 
  Settings, 
  Search,
  Bell,
  Filter,
  ChevronDown,
} from 'lucide-react-native';

import {
  enhancedAccessibilityManager,
  createEnhancedNavigationProps,
  EnhancedFocusManager,
  ScreenReaderOptimization,
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  ENHANCED_ACCESSIBILITY_ROLES,
} from '../../utils/enhancedAccessibility';
import { useNavigationFocus } from '../../hooks/useFocusManagement';

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  isActive?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

interface NavigationBarProps {
  tabs: readonly TabItem[];
  activeTabId: string;
  onTabPress: (tabId: string) => void;
  onSkipToContent?: () => void;
  showSkipNavigation?: boolean;
  hasNotifications?: boolean;
  notificationCount?: number;
  onNotificationPress?: () => void;
  showSecondaryActions?: boolean;
  onSearchPress?: () => void;
  onFilterPress?: () => void;
  testID?: string;
}

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  animatedValue: Animated.SharedValue<number>;
  index: number;
}

const TabButton: React.FC<TabButtonProps> = ({
  tab,
  isActive,
  onPress,
  animatedValue,
  index,
}) => {
  const [accessibilityState, setAccessibilityState] = useState(enhancedAccessibilityManager.getState());
  const scaleAnim = useSharedValue(1);
  const pressedAnim = useSharedValue(0);

  useEffect(() => {
    const removeListener = enhancedAccessibilityManager.addListener(setAccessibilityState);
    return removeListener;
  }, []);

  // Animation for tab indicator
  const indicatorStyle = useAnimatedStyle(() => {
    const isCurrentTab = animatedValue.value === index;
    return {
      transform: [
        {
          scaleX: withSpring(isCurrentTab ? 1 : 0, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
      opacity: withTiming(isCurrentTab ? 1 : 0, { duration: 200 }),
    };
  });

  // Animation for press feedback
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    backgroundColor: interpolateColor(
      pressedAnim.value,
      [0, 1],
      ['transparent', 'rgba(242, 186, 201, 0.1)']
    ),
  }));

  const handlePressIn = useCallback(() => {
    if (!accessibilityState.reduceMotionEnabled) {
      scaleAnim.value = withSpring(0.95, { duration: 100 });
      pressedAnim.value = withTiming(1, { duration: 100 });
    }
  }, [scaleAnim, pressedAnim, accessibilityState.reduceMotionEnabled]);

  const handlePressOut = useCallback(() => {
    if (!accessibilityState.reduceMotionEnabled) {
      scaleAnim.value = withSpring(1, { duration: 100 });
      pressedAnim.value = withTiming(0, { duration: 100 });
    }
  }, [scaleAnim, pressedAnim, accessibilityState.reduceMotionEnabled]);

  const handlePress = useCallback(() => {
    // Announce tab change for screen readers
    if (accessibilityState.screenReaderEnabled) {
      ScreenReaderOptimization.announceNavigation('tab', tab.label, 'selected');
    }
    onPress();
  }, [onPress, tab.label, accessibilityState.screenReaderEnabled]);

  return (
    <Animated.View style={[styles.tabContainer, buttonStyle]}>
      <Pressable
        style={styles.tabButton}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessible={true}
        accessibilityRole="tab"
        accessibilityLabel={tab.accessibilityLabel || tab.label}
        accessibilityHint={tab.accessibilityHint || `Navigate to ${tab.label} tab`}
        accessibilityState={{
          selected: isActive,
        }}
      >
        <View style={styles.tabIconContainer}>
          {React.cloneElement(tab.icon as React.ReactElement, {
            size: 24,
            color: isActive ? '#F2BAC9' : '#64748b',
          })}
          {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
            <View 
              style={styles.badge}
              accessible={true}
              accessibilityLabel={`${tab.badgeCount} notification${tab.badgeCount !== 1 ? 's' : ''}`}
              accessibilityRole="text"
            >
              <Text style={styles.badgeText}>
                {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
          {tab.label}
        </Text>
      </Pressable>
      
      {/* Active tab indicator */}
      <Animated.View style={[styles.activeIndicator, indicatorStyle]} />
    </Animated.View>
  );
};

export const AccessibleNavigationBar: React.FC<NavigationBarProps> = ({
  tabs,
  activeTabId,
  onTabPress,
  onSkipToContent,
  showSkipNavigation = true,
  hasNotifications = false,
  notificationCount = 0,
  onNotificationPress,
  showSecondaryActions = false,
  onSearchPress,
  onFilterPress,
  testID = 'accessible-navigation-bar',
}) => {
  const { createNavigationFocusGroup } = useNavigationFocus();
  const [accessibilityState, setAccessibilityState] = useState(enhancedAccessibilityManager.getState());
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);

  // Animation values
  const activeTabIndex = useSharedValue(0);
  const backgroundOpacity = useSharedValue(1);

  // Refs for secondary actions
  const notificationButtonRef = useRef<TouchableOpacity>(null);
  const searchButtonRef = useRef<TouchableOpacity>(null);
  const filterButtonRef = useRef<TouchableOpacity>(null);

  // Set up accessibility state listener
  useEffect(() => {
    const removeListener = enhancedAccessibilityManager.addListener(setAccessibilityState);
    return removeListener;
  }, []);

  // Create navigation focus group
  useEffect(() => {
    const { groupId } = createNavigationFocusGroup('horizontal');
    setFocusGroupId(groupId);

    return () => {
      // Cleanup handled by useFocusManagement
    };
  }, [createNavigationFocusGroup]);

  // Update active tab animation
  useEffect(() => {
    const index = tabs.findIndex(tab => tab.id === activeTabId);
    if (index !== -1) {
      activeTabIndex.value = withSpring(index, {
        damping: 20,
        stiffness: 300,
      });
    }
  }, [activeTabId, tabs, activeTabIndex]);

  // Skip navigation handler
  const handleSkipToContent = useCallback(() => {
    if (onSkipToContent) {
      ScreenReaderOptimization.announceNavigation('navigation', 'main content', 'Skipped to main content');
      onSkipToContent();
    }
  }, [onSkipToContent]);

  // Secondary action handlers
  const handleNotificationPress = useCallback(() => {
    if (onNotificationPress) {
      EnhancedFocusManager.announceFocusChange(`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`);
      onNotificationPress();
    }
  }, [onNotificationPress, notificationCount]);

  const handleSearchPress = useCallback(() => {
    if (onSearchPress) {
      EnhancedFocusManager.announceFocusChange('Search');
      onSearchPress();
    }
  }, [onSearchPress]);

  const handleFilterPress = useCallback(() => {
    if (onFilterPress) {
      EnhancedFocusManager.announceFocusChange('Filters');
      onFilterPress();
    }
  }, [onFilterPress]);

  // Background animation for reduced motion
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  // Create navigation accessibility props
  const currentTabIndex = tabs.findIndex(tab => tab.id === activeTabId);
  const navigationProps = createEnhancedNavigationProps(
    tabs[currentTabIndex]?.label || 'Navigation',
    tabs.length,
    currentTabIndex,
    currentTabIndex > 0,
    currentTabIndex < tabs.length - 1
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Skip Navigation Link */}
      {showSkipNavigation && onSkipToContent && (
        <TouchableOpacity
          style={styles.skipNavigation}
          onPress={handleSkipToContent}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Skip to main content"
          accessibilityHint="Bypass navigation and go directly to main content"
          testID={`${testID}-skip-navigation`}
        >
          <Text style={styles.skipNavigationText}>Skip to main content</Text>
        </TouchableOpacity>
      )}

      {/* Main Navigation Bar */}
      <Animated.View 
        style={[styles.navigationBar, backgroundStyle]}
        accessible={true}
        accessibilityRole="tablist"
        {...navigationProps}
      >
        {/* Secondary Actions (Left Side) */}
        {showSecondaryActions && (
          <View style={styles.secondaryActions}>
            {onSearchPress && (
              <TouchableOpacity
                ref={searchButtonRef}
                style={styles.secondaryActionButton}
                onPress={handleSearchPress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Search"
                accessibilityHint="Open search functionality"
                testID={`${testID}-search`}
              >
                <Search size={20} color="#64748b" />
              </TouchableOpacity>
            )}
            
            {onFilterPress && (
              <TouchableOpacity
                ref={filterButtonRef}
                style={styles.secondaryActionButton}
                onPress={handleFilterPress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Filters"
                accessibilityHint="Open filter options"
                testID={`${testID}-filter`}
              >
                <Filter size={20} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tab Buttons */}
        <View 
          style={styles.tabsContainer}
          accessible={false} // Individual tabs are accessible
        >
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTabId === tab.id}
              onPress={() => onTabPress(tab.id)}
              animatedValue={activeTabIndex}
              index={index}
            />
          ))}
        </View>

        {/* Notifications (Right Side) */}
        {hasNotifications && onNotificationPress && (
          <View style={styles.notificationContainer}>
            <TouchableOpacity
              ref={notificationButtonRef}
              style={styles.notificationButton}
              onPress={handleNotificationPress}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
              accessibilityHint="View notifications"
              testID={`${testID}-notifications`}
            >
              <Bell size={20} color={notificationCount > 0 ? '#F2BAC9' : '#64748b'} />
              {notificationCount > 0 && (
                <View 
                  style={styles.notificationBadge}
                  accessible={true}
                  accessibilityLabel={`${notificationCount} unread`}
                  accessibilityRole="text"
                >
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Screen reader announcement region */}
      <View
        style={styles.srOnly}
        accessible={true}
        accessibilityLiveRegion="polite"
        importantForAccessibility="yes"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
  },
  skipNavigation: {
    position: 'absolute',
    top: -100,
    left: 16,
    right: 16,
    backgroundColor: '#F2BAC9',
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
    // Show on focus
    ...Platform.select({
      web: {
        ':focus': {
          top: 16,
        },
      },
    }),
  },
  skipNavigationText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#0f172a',
    textAlign: 'center',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 8, // Safe area for iOS
    paddingHorizontal: 8,
    minHeight: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET + 16,
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  secondaryActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
    minWidth: ENHANCED_ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET,
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F2BAC9',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Geist-Regular',
    color: '#0f172a',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  activeTabLabel: {
    color: '#F2BAC9',
    fontFamily: 'Geist-Regular',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#F2BAC9',
    borderRadius: 2,
  },
  notificationContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontFamily: 'Geist-Regular',
    color: 'white',
  },
  srOnly: {
    position: 'absolute',
    left: -10000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

// Default tab configurations for common dating app scenarios
export const DefaultTabs = {
  main: [
    {
      id: 'discover',
      label: 'Discover',
      icon: <Heart />,
      accessibilityLabel: 'Discover potential matches',
      accessibilityHint: 'Browse and swipe through potential matches',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: <MessageCircle />,
      accessibilityLabel: 'Messages and conversations',
      accessibilityHint: 'View and manage your conversations',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User />,
      accessibilityLabel: 'Your profile',
      accessibilityHint: 'View and edit your profile information',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings />,
      accessibilityLabel: 'Settings and preferences',
      accessibilityHint: 'Manage your app settings and preferences',
    },
  ],
} as const;

export default AccessibleNavigationBar;
// @ts-nocheck
