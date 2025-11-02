import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Heart, X, Eye, User } from 'lucide-react-native';
import {
  createMatchAccessibilityLabel,
  createAccessibilityHint,
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  ImageAccessibility,
  createAccessibleButtonProps,
} from '../../src/utils/accessibility';
import { MatchProfile } from '../MatchCard';

interface CardFrontContentProps {
  profile: MatchProfile;
  imageHeight: number;
  onAccept: () => void;
  onDecline: () => void;
  onFlip: () => void;
  compatibilityScore?: number;
  dateActivity?: string;
  isFlipped?: boolean;
  declineButtonRef?: React.Ref<any>;
  acceptButtonRef?: React.Ref<any>;
  compatibilityButtonRef?: React.Ref<any>;
  styles: any;
  announceToScreenReader: (message: string, priority: 'polite' | 'assertive') => void;
}

/**
 * Front content component for match cards
 * Displays profile image, name, and action buttons
 * Follows Single Responsibility Principle
 */
export const CardFrontContent: React.FC<CardFrontContentProps> = ({
  profile,
  imageHeight,
  onAccept,
  onDecline,
  onFlip,
  compatibilityScore,
  dateActivity,
  isFlipped = false,
  declineButtonRef,
  acceptButtonRef,
  compatibilityButtonRef,
  styles,
  announceToScreenReader,
}) => {
  return (
    <>
      {/* Profile Image */}
      {profile.avatar_url ? (
        <Image
          source={{ uri: profile.avatar_url }}
          style={[styles.profileImageSquare, { height: imageHeight }]}
          accessibilityRole={ACCESSIBILITY_ROLES.PROFILE_IMAGE}
          accessibilityLabel={ImageAccessibility.createProfileImageAlt(profile.display_name ?? undefined, true)}
          accessible={true}
        />
      ) : (
        <View 
          style={[styles.profileImagePlaceholderSquare, { height: imageHeight }]}
          accessibilityRole={ACCESSIBILITY_ROLES.PROFILE_IMAGE}
          accessibilityLabel={ImageAccessibility.createProfileImageAlt(profile.display_name ?? undefined, false)}
          accessible={true}
        >
          <User size={Math.min(80, imageHeight * 0.3)} color="#666" />
        </View>
      )}

      {/* User Name */}
      <Text 
        style={styles.meetUserText}
        accessibilityRole="header"
        accessibilityLabel={`Meet ${profile.display_name || 'Anonymous User'}${profile.age ? `, age ${profile.age}` : ''}`}
        accessible={true}
      >
        Meet {profile.display_name || 'Anonymous User'}
      </Text>

      {/* Action Buttons */}
      <View 
        style={styles.circularButtonsContainer}
        accessibilityLabel="Match decision buttons"
      >
        <TouchableOpacity
          ref={declineButtonRef}
          onPress={onDecline}
          style={[styles.circularDeclineButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
          {...createAccessibleButtonProps(
            createMatchAccessibilityLabel('decline', profile.display_name ?? undefined, compatibilityScore, dateActivity || undefined),
            createAccessibilityHint('double_tap'),
            ACCESSIBILITY_ROLES.ACTION_BUTTON
          )}
        >
          <X size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          ref={compatibilityButtonRef}
          onPress={onFlip}
          style={[styles.circularCompatibilityButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
          {...createAccessibleButtonProps(
            `${isFlipped ? 'View profile' : 'View compatibility'} for ${profile.display_name || 'this person'}`,
            createAccessibilityHint('double_tap'),
            ACCESSIBILITY_ROLES.ACTION_BUTTON
          )}
        >
          <Eye size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          ref={acceptButtonRef}
          onPress={onAccept}
          style={[styles.circularAcceptButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
          {...createAccessibleButtonProps(
            createMatchAccessibilityLabel('accept', profile.display_name ?? undefined, compatibilityScore, dateActivity || undefined),
            createAccessibilityHint('double_tap'),
            ACCESSIBILITY_ROLES.ACTION_BUTTON
          )}
        >
          <Heart size={24} color="white" />
        </TouchableOpacity>
      </View>
    </>
  );
};
