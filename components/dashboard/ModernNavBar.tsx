import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { COLORS, TEXT_STYLES } from '../../constants/theme';
import { Home, MessageSquare, User, Settings } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef } from 'react';
import { useTabTransition } from '../../src/contexts/TabTransitionContext';

interface NavItem {
  id: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  route: string;
}

interface ModernNavBarProps extends BottomTabBarProps {
  unreadMessages?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: Home, label: 'Home', route: 'dashboard' },
  { id: 'messenger', icon: MessageSquare, label: 'Messages', route: 'messenger' },
  { id: 'profile', icon: User, label: 'Profile', route: 'profile' },
  { id: 'settings', icon: Settings, label: 'Settings', route: 'settings' },
];

const ModernNavBar: React.FC<ModernNavBarProps> = ({
  state,
  navigation,
  unreadMessages = 0,
}) => {
  const { setDirection } = useTabTransition();
  const prevIndexRef = useRef<number>(state.index);

  // Infer direction on any index change (covers programmatic navigations)
  useEffect(() => {
    const prevIndex = prevIndexRef.current;
    const nextIndex = state.index;
    if (nextIndex !== prevIndex) {
      setDirection(nextIndex > prevIndex ? 'left' : 'right');
      prevIndexRef.current = nextIndex;
    }
  }, [state.index, setDirection]);

  const handleNavPress = (route: string) => {
    // Set direction based on relative tab order vs current
    const currentIndex = state.index;
    const nextIndex = state.routes.findIndex(r => r.name === route);
    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      setDirection(nextIndex > currentIndex ? 'left' : 'right');
    }
    navigation.navigate(route);
  };

  const isActive = (route: string) => {
    const currentTabIndex = state.index;
    const currentRoute = state.routes[currentTabIndex]?.name;
    return currentRoute === route;
  };

  return (
    <View style={styles.container}>
      {/* Black gap filler - extend to full width */}
      <View style={styles.blackGapFiller} />
      <View style={styles.navBar}>
        {navItems.map((item) => {
          const active = isActive(item.route);
          const IconComponent = item.icon;
          const showBadge = item.id === 'messenger' && unreadMessages > 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              onPress={() => handleNavPress(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <IconComponent 
                  size={22} 
                  color={COLORS.CARD_WHITE_TEXT} // Always white icons on black bar
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </Text>
                  </View>
                )}
              </View>
              
              <Text style={[
                styles.navLabel,
                styles.whiteNavLabel
              ]}>
                {item.label}
              </Text>

              {active && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.bottomSafeArea} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: 0, // No margins to ensure full width
    zIndex: 1, // Lower z-index so search card appears above
    backgroundColor: COLORS.BLACK_CARD, // Ensure area behind home indicator is black
  },
  blackGapFiller: {
    height: 16, // Taller to fully cover any white arc above
    backgroundColor: COLORS.BLACK_CARD,
    marginHorizontal: 0, // Full width without extending
    width: '100%', // Ensure full width
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.BLACK_CARD, // Black background
    paddingTop: 6, // Further reduced height
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, // Shorter while still covering insets
    paddingHorizontal: 16, // Proper spacing for content
    marginHorizontal: 0, // No negative margins
    width: '100%', // Ensure full width
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    position: 'relative',
    marginHorizontal: 0, // Remove horizontal margins to prevent white gaps
  },
  // No white background for active items; keep bar uniformly black
  iconContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  navLabel: {
    ...TEXT_STYLES.CAPTION_SMALL,
    fontFamily: 'Geist-Medium',
    color: COLORS.CARD_WHITE_TEXT,
  },
  whiteNavLabel: {
    color: COLORS.CARD_WHITE_TEXT, // White text for labels
    fontFamily: 'Geist-Medium',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: 16,
    height: 3,
    backgroundColor: COLORS.CARD_WHITE_TEXT, // White indicator for active state
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: COLORS.CORAL,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.WHITE_CARD,
  },
  badgeText: {
    ...TEXT_STYLES.CAPTION_SMALL,
    fontSize: 10,
    fontFamily: 'Geist-Regular',
    color: COLORS.CARD_WHITE_TEXT,
    lineHeight: 12,
  },
  // Ensures any remaining bottom safe area shows black behind the iOS home indicator
  bottomSafeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Platform.OS === 'ios' ? 40 : 0,
    backgroundColor: COLORS.BLACK_CARD,
    zIndex: 0,
  },
});

export default ModernNavBar;
