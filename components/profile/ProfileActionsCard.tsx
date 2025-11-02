import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Camera, ClipboardList } from 'lucide-react-native';
import { BLUE_CARD_STYLES, COLORS } from '../../constants/theme';
import { usePremium } from '../../src/hooks/usePremium';
import PremiumBadge from '../premium/PremiumBadge';

interface ProfileActionsCardProps {
  onEditPhoto: () => void;
  onViewQuestionnaire: () => void;
}

const ProfileActionsCard: React.FC<ProfileActionsCardProps> = ({
  onEditPhoto,
  onViewQuestionnaire,
}) => {
  const { isPremium } = usePremium();

  return (
    <View style={[styles.container, BLUE_CARD_STYLES, styles.bottomCardRounding]}>
      {/* Header with Premium Badge */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Manage Your Profile</Text>
          {isPremium && <PremiumBadge size="small" showIcon={false} />}
        </View>
        <Text style={styles.subtitle}>
          {isPremium
            ? 'Premium member - Access all features'
            : 'Update your information and preferences'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Edit Photo – outlined for visibility over blue card */}
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={onEditPhoto}
          activeOpacity={0.8}
        >
          <Camera size={18} color={COLORS.DARK_TEXT} />
          <Text style={styles.secondaryButtonText}>Edit Photo</Text>
        </TouchableOpacity>

        {/* View Compatibility – filled dark with white text */}
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={onViewQuestionnaire}
          activeOpacity={0.8}
        >
          <ClipboardList size={18} color={COLORS.CARD_WHITE_TEXT} />
          <Text style={styles.primaryButtonText}>View Compatibility</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 0, // Remove side margins for full width
    marginBottom: -20, // Negative margin to overlap with navigation bar
    paddingBottom: 16, // Increased to match Settings page AccountActionsCard spacing
    minHeight: 120,
    zIndex: 10, // Higher z-index to appear above navigation bar
    elevation: 10, // For Android shadow and layering
    position: 'relative', // Ensure z-index works properly
  },
  bottomCardRounding: {
    borderTopLeftRadius: 20, // Round top corners for curvature
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20, // Keep bottom corners rounded
    borderBottomRightRadius: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    opacity: 0.8,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.BLACK_CARD,
  },
  secondaryButton: {
    backgroundColor: COLORS.CARD_WHITE_TEXT,
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.CARD_WHITE_TEXT,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
});

export default ProfileActionsCard;
