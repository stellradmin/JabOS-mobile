// @ts-nocheck
/**
 * Accessible Match Card Component
 * Provides fully accessible swiping interactions with keyboard and screen reader support
 * Includes gesture alternatives and comprehensive accessibility features
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler as useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Heart, X, Star, Info, Camera } from 'lucide-react-native';

import {
  enhancedAccessibilityManager,
  createMatchCardAccessibilityProps,
  createGestureAlternativeProps,
  EnhancedFocusManager,
  ScreenReaderOptimization,
  ENHANCED_ACCESSIBILITY_CONSTANTS,
  GESTURE_ALTERNATIVES,
} from '../../utils/enhancedAccessibility';
import { useFocusManagement } from '../../hooks/useFocusManagement';

interface MatchCardProps {
  profile: {
    id: string;
    name: string;
    age: number;
    bio?: string;
    photos: string[];
    compatibility?: number;
    interests?: string[];
    isOnline?: boolean;
    lastSeen?: string;
    distance?: number;
  };
  index: number;
  totalProfiles: number;
  onLike: () => void;
  onPass: () => void;
  onSuperLike?: () => void;
  onViewProfile?: () => void;
  testID?: string;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 40;
const SWIPE_THRESHOLD = screenWidth * 0.3;

export const AccessibleMatchCard: React.FC<MatchCardProps> = ({
  profile,
  index,
  totalProfiles,
  onLike,
  onPass,
  onSuperLike,
  onViewProfile,
  testID = 'accessible-match-card',
}) => {
  const { createFocusGroup, registerFocusableElement, focusElement } = useFocusManagement();
  const [accessibilityState, setAccessibilityState] = useState(enhancedAccessibilityManager.getState());
  const [showGestureAlternatives, setShowGestureAlternatives] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);

  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // Refs for gesture alternatives
  const cardRef = useRef<View>(null);
  const likeButtonRef = useRef<any>(null);
  const passButtonRef = useRef<any>(null);
  const superLikeButtonRef = useRef<any>(null);
  const viewProfileButtonRef = useRef<any>(null);

  // Set up accessibility state listener
  useEffect(() => {
    const removeListener = enhancedAccessibilityManager.addListener((state) => {
      setAccessibilityState(state);
      setShowGestureAlternatives(state.gestureAlternativesEnabled);
    });
    return removeListener;
  }, []);

  // Create focus group for card interactions
  useEffect(() => {
    const groupId = createFocusGroup({
      trapFocus: false,
      restoreFocus: false,
    });
    setFocusGroupId(groupId);

    // Register focusable elements
    if (likeButtonRef.current) {
      registerFocusableElement(groupId, 'like-button', likeButtonRef.current, {
        priority: 3,
        accessibilityLabel: 'Like profile',
        accessibilityRole: 'button',
      });
    }
    if (passButtonRef.current) {
      registerFocusableElement(groupId, 'pass-button', passButtonRef.current, {
        priority: 2,
        accessibilityLabel: 'Pass on profile',
        accessibilityRole: 'button',
      });
    }
    if (superLikeButtonRef.current && onSuperLike) {
      registerFocusableElement(groupId, 'super-like-button', superLikeButtonRef.current, {
        priority: 4,
        accessibilityLabel: 'Super like profile',
        accessibilityRole: 'button',
      });
    }
    if (viewProfileButtonRef.current && onViewProfile) {
      registerFocusableElement(groupId, 'view-profile-button', viewProfileButtonRef.current, {
        priority: 1,
        accessibilityLabel: 'View full profile',
        accessibilityRole: 'button',
      });
    }

    return () => {
      if (groupId) {
        // Focus group cleanup handled by useFocusManagement
      }
    };
  }, [createFocusGroup, registerFocusableElement, onSuperLike, onViewProfile]);

  // Handle gesture-based interactions
  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      // Announce gesture start for screen readers
      if (accessibilityState.screenReaderEnabled) {
        runOnJS(ScreenReaderOptimization.announceStateChange)(
          'Match card', 'static', 'being swiped'
        );
      }
    },
    onActive: (event) => {
      translateX.value = event.translationX;
      rotate.value = interpolate(
        event.translationX,
        [-screenWidth, 0, screenWidth],
        [-15, 0, 15]
      );
    },
    onEnd: (event) => {
      const shouldLike = event.translationX > SWIPE_THRESHOLD;
      const shouldPass = event.translationX < -SWIPE_THRESHOLD;
      const shouldSuperLike = event.translationY < -SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD;

      if (shouldLike) {
        // Animate out and trigger like
        translateX.value = withSpring(screenWidth);
        opacity.value = withTiming(0, { duration: 300 });
        runOnJS(handleLike)();
      } else if (shouldPass) {
        // Animate out and trigger pass
        translateX.value = withSpring(-screenWidth);
        opacity.value = withTiming(0, { duration: 300 });
        runOnJS(handlePass)();
      } else if (shouldSuperLike && onSuperLike) {
        // Animate out and trigger super like
        translateY.value = withSpring(-screenWidth);
        opacity.value = withTiming(0, { duration: 300 });
        runOnJS(handleSuperLike)();
      } else {
        // Spring back to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
        runOnJS(ScreenReaderOptimization.announceStateChange)(
          'Match card', 'being swiped', 'returned to center'
        );
      }
    },
  });

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const likeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD / 2], [0, 1]),
  }));

  const passIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD / 2], [0, 1]),
  }));

  const superLikeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, -SWIPE_THRESHOLD / 2], [0, 1]),
  }));

  // Action handlers
  const handleLike = useCallback(() => {
    ScreenReaderOptimization.announceMatchEvent('new_match', `Liked ${profile.name}'s profile`);
    onLike();
  }, [onLike, profile.name]);

  const handlePass = useCallback(() => {
    ScreenReaderOptimization.announceStateChange('Match card', 'visible', 'passed');
    onPass();
  }, [onPass]);

  const handleSuperLike = useCallback(() => {
    if (onSuperLike) {
      ScreenReaderOptimization.announceMatchEvent('new_match', `Super liked ${profile.name}'s profile`);
      onSuperLike();
    }
  }, [onSuperLike, profile.name]);

  const handleViewProfile = useCallback(() => {
    if (onViewProfile) {
      ScreenReaderOptimization.announceNavigation('match card', 'full profile', `Viewing ${profile.name}'s profile`);
      onViewProfile();
    }
  }, [onViewProfile, profile.name]);

  // Photo navigation
  const nextPhoto = useCallback(() => {
    if (currentPhotoIndex < profile.photos.length - 1) {
      const newIndex = currentPhotoIndex + 1;
      setCurrentPhotoIndex(newIndex);
      ScreenReaderOptimization.announceStateChange(
        'Photo',
        `${currentPhotoIndex + 1} of ${profile.photos.length}`,
        `${newIndex + 1} of ${profile.photos.length}`
      );
    }
  }, [currentPhotoIndex, profile.photos.length]);

  const previousPhoto = useCallback(() => {
    if (currentPhotoIndex > 0) {
      const newIndex = currentPhotoIndex - 1;
      setCurrentPhotoIndex(newIndex);
      ScreenReaderOptimization.announceStateChange(
        'Photo',
        `${currentPhotoIndex + 1} of ${profile.photos.length}`,
        `${newIndex + 1} of ${profile.photos.length}`
      );
    }
  }, [currentPhotoIndex, profile.photos.length]);

  // Create accessibility props for the main card
  const cardAccessibilityProps = createMatchCardAccessibilityProps(
    profile,
    index,
    totalProfiles
  );

  // Gesture alternative props
  const likeGestureProps = createGestureAlternativeProps('SWIPE_RIGHT', {
    userName: profile.name,
  });

  const passGestureProps = createGestureAlternativeProps('SWIPE_LEFT', {
    userName: profile.name,
  });

  const superLikeGestureProps = createGestureAlternativeProps('SWIPE_UP', {
    userName: profile.name,
  });

  return (
    <View style={styles.container} testID={testID}>
      <PanGestureHandler
        onGestureEvent={gestureHandler}
        enabled={!accessibilityState.screenReaderEnabled && !accessibilityState.keyboardNavigationMode}
      >
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          {/* Swipe indicators */}
          <Animated.View style={[styles.swipeIndicator, styles.likeIndicator, likeIndicatorStyle]}>
            <Heart size={50} color="#4ade80" />
            <Text style={styles.indicatorText}>LIKE</Text>
          </Animated.View>

          <Animated.View style={[styles.swipeIndicator, styles.passIndicator, passIndicatorStyle]}>
            <X size={50} color="#ef4444" />
            <Text style={styles.indicatorText}>PASS</Text>
          </Animated.View>

          <Animated.View style={[styles.swipeIndicator, styles.superLikeIndicator, superLikeIndicatorStyle]}>
            <Star size={50} color="#3b82f6" />
            <Text style={styles.indicatorText}>SUPER LIKE</Text>
          </Animated.View>

          {/* Photo carousel */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: profile.photos[currentPhotoIndex] }}
              style={styles.photo}
              contentFit="cover"
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`Photo ${currentPhotoIndex + 1} of ${profile.photos.length} of ${profile.name}`}
            />

            {/* Photo navigation */}
            {profile.photos.length > 1 && (
              <View style={styles.photoNavigation}>
                <TouchableOpacity
                  style={[styles.photoNavButton, styles.photoNavLeft]}
                  onPress={previousPhoto}
                  disabled={currentPhotoIndex === 0}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  accessibilityState={{ disabled: currentPhotoIndex === 0 }}
                />
                <TouchableOpacity
                  style={[styles.photoNavButton, styles.photoNavRight]}
                  onPress={nextPhoto}
                  disabled={currentPhotoIndex === profile.photos.length - 1}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  accessibilityState={{ disabled: currentPhotoIndex === profile.photos.length - 1 }}
                />
              </View>
            )}

            {/* Photo indicators */}
            <View style={styles.photoIndicators}>
              {profile.photos.map((_, photoIndex) => (
                <View
                  key={photoIndex}
                  style={[
                    styles.photoIndicator,
                    photoIndex === currentPhotoIndex && styles.activePhotoIndicator,
                  ]}
                />
              ))}
            </View>

            {/* Online status */}
            {profile.isOnline && (
              <View style={styles.onlineIndicator}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            )}
          </View>

          {/* Profile information */}
          <View style={styles.profileInfo}>
            <View style={styles.nameSection}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.age}>{profile.age}</Text>
              {profile.compatibility && (
                <View style={styles.compatibilityBadge}>
                  <Text style={styles.compatibilityText}>{profile.compatibility}%</Text>
                </View>
              )}
            </View>

            {profile.bio && (
              <Text 
                style={styles.bio}
                numberOfLines={2}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`Bio: ${profile.bio}`}
              >
                {profile.bio}
              </Text>
            )}

            {profile.interests && profile.interests.length > 0 && (
              <View style={styles.interests}>
                {profile.interests.slice(0, 3).map((interest, idx) => (
                  <View key={idx} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
                {profile.interests.length > 3 && (
                  <View style={styles.interestTag}>
                    <Text style={styles.interestText}>+{profile.interests.length - 3}</Text>
                  </View>
                )}
              </View>
            )}

            {profile.distance && (
              <Text style={styles.distance}>{profile.distance} km away</Text>
            )}
          </View>

          {/* Main card accessibility wrapper */}
          <Pressable
            ref={cardRef}
            style={StyleSheet.absoluteFill}
            onPress={handleViewProfile}
            {...cardAccessibilityProps}
            testID={`${testID}-main`}
          />
        </Animated.View>
      </PanGestureHandler>

      {/* Gesture alternatives (always visible for accessibility) */}
      <View style={styles.actionButtons}>
        {/* Pass button */}
        <TouchableOpacity
          ref={passButtonRef}
          style={[styles.actionButton, styles.passButton]}
          onPress={handlePass}
          {...passGestureProps}
          testID={`${testID}-pass`}
        >
          <X size={24} color="#ef4444" />
        </TouchableOpacity>

        {/* Super like button (if available) */}
        {onSuperLike && (
          <TouchableOpacity
            ref={superLikeButtonRef}
            style={[styles.actionButton, styles.superLikeButton]}
            onPress={handleSuperLike}
            {...superLikeGestureProps}
            testID={`${testID}-super-like`}
          >
            <Star size={20} color="#3b82f6" />
          </TouchableOpacity>
        )}

        {/* Like button */}
        <TouchableOpacity
          ref={likeButtonRef}
          style={[styles.actionButton, styles.likeButton]}
          onPress={handleLike}
          {...likeGestureProps}
          testID={`${testID}-like`}
        >
          <Heart size={24} color="#4ade80" />
        </TouchableOpacity>

        {/* View profile button (if available) */}
        {onViewProfile && (
          <TouchableOpacity
            ref={viewProfileButtonRef}
            style={[styles.actionButton, styles.viewProfileButton]}
            onPress={handleViewProfile}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`View ${profile.name}'s full profile`}
            accessibilityHint="Double tap to see detailed profile information"
            testID={`${testID}-view-profile`}
          >
            <Info size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.4,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoNavigation: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  photoNavButton: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  photoNavLeft: {
    // Left half of the photo for previous navigation
  },
  photoNavRight: {
    // Right half of the photo for next navigation
  },
  photoIndicators: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
  },
  photoIndicator: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  activePhotoIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  onlineIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  onlineText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Geist-Medium',
  },
  profileInfo: {
    padding: 20,
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: '#0f172a',
    flex: 1,
  },
  age: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#64748b',
  },
  compatibilityBadge: {
    backgroundColor: '#F2BAC9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  compatibilityText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#0f172a',
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  interestTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  interestText: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: '#475569',
  },
  distance: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#6b7280',
  },
  swipeIndicator: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  likeIndicator: {
    right: 32,
  },
  passIndicator: {
    left: 32,
  },
  superLikeIndicator: {
    left: '50%',
    marginLeft: -60,
    top: '20%',
  },
  indicatorText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    marginTop: 8,
    color: '#0f172a',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    gap: 16,
  },
  actionButton: {
    width: ENHANCED_ACCESSIBILITY_CONSTANTS.LARGE_TOUCH_TARGET,
    height: ENHANCED_ACCESSIBILITY_CONSTANTS.LARGE_TOUCH_TARGET,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  passButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  likeButton: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  superLikeButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#93c5fd',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  viewProfileButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

export default AccessibleMatchCard;
// @ts-nocheck
