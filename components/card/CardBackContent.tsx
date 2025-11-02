import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Heart, X, Eye } from 'lucide-react-native';
import {
  createMatchAccessibilityLabel,
  createAccessibilityHint,
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  createAccessibleButtonProps,
} from '../../src/utils/accessibility';
import { MatchProfile } from '../MatchCard';

interface CardBackContentProps {
  profile: MatchProfile;
  compatibilityScore?: number;
  astrologicalGrade?: string;
  questionnaireGrade?: string;
  onAccept: () => void;
  onDecline: () => void;
  onFlip: () => void;
  dateActivity?: string;
  styles: any;
}

/**
 * Back content component for match cards
 * Displays compatibility information and action buttons
 * Follows Single Responsibility Principle
 */
export const CardBackContent: React.FC<CardBackContentProps> = ({
  profile,
  compatibilityScore,
  astrologicalGrade,
  questionnaireGrade,
  onAccept,
  onDecline,
  onFlip,
  dateActivity,
  styles,
}) => {
  return (
    <>
      {/* Title */}
      <Text 
        style={styles.compatibilityBackTitle}
        accessibilityRole="header"
        accessibilityLabel={`Compatibility details for ${profile.display_name || 'this person'}`}
      >
        Compatibility with {profile.display_name || 'Anonymous User'}
      </Text>

      {/* Compatibility Content */}
      <View style={styles.compatibilityBackContent}>
        {/* Overall Score */}
        {compatibilityScore && (
          <View style={styles.compatibilityBackSection}>
            <Text style={styles.compatibilityBackSectionTitle}>Overall Score</Text>
            <View style={styles.compatibilityBackScoreContainer}>
              <Text style={styles.compatibilityBackScore}>{compatibilityScore}%</Text>
            </View>
            <Text style={styles.compatibilityBackDescription}>
              Overall compatibility based on all factors
            </Text>
          </View>
        )}
        
        {/* Astrological Grade */}
        {astrologicalGrade && (
          <View style={styles.compatibilityBackSection}>
            <Text style={styles.compatibilityBackSectionTitle}>Astrological</Text>
            <View style={styles.compatibilityBackGradeContainer}>
              <Text style={styles.compatibilityBackGrade}>{astrologicalGrade}</Text>
            </View>
            <Text style={styles.compatibilityBackDescription}>
              Based on birth charts and zodiac compatibility
            </Text>
          </View>
        )}
        
        {/* Questionnaire Grade */}
        {questionnaireGrade && (
          <View style={styles.compatibilityBackSection}>
            <Text style={styles.compatibilityBackSectionTitle}>Values</Text>
            <View style={styles.compatibilityBackGradeContainer}>
              <Text style={styles.compatibilityBackGrade}>{questionnaireGrade}</Text>
            </View>
            <Text style={styles.compatibilityBackDescription}>
              Based on personality and values questionnaire
            </Text>
          </View>
        )}

        {/* Children Preferences - Family Tags */}
        {(profile.has_kids !== undefined && profile.has_kids !== null || profile.wants_kids) && (
          <View style={styles.compatibilityBackSection}>
            <Text style={styles.compatibilityBackSectionTitle}>Family</Text>
            <View style={styles.familyTagsContainer}>
              {profile.has_kids && (
                <View style={styles.familyTag}>
                  <Text style={styles.familyTagText}>Has Kids</Text>
                </View>
              )}
              {profile.wants_kids && (
                <View style={styles.familyTag}>
                  <Text style={styles.familyTagText}>{profile.wants_kids} Kids</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View 
        style={styles.circularButtonsContainer}
        accessibilityLabel="Match decision buttons"
      >
        <TouchableOpacity
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
          onPress={onFlip}
          style={[styles.circularCompatibilityButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
          {...createAccessibleButtonProps(
            'View profile details',
            createAccessibilityHint('double_tap'),
            ACCESSIBILITY_ROLES.ACTION_BUTTON
          )}
        >
          <Eye size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
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
