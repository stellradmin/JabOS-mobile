import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { YELLOW_CARD_STYLES, COLORS } from '../../constants/theme';
import { LogOut, Trash2 } from 'lucide-react-native';

interface AccountActionsCardProps {
  onLogout: () => void;
  onDeleteAccount: () => void;
  isLoggingOut: boolean;
  isDeletingAccount: boolean;
}

const AccountActionsCard: React.FC<AccountActionsCardProps> = ({
  onLogout,
  onDeleteAccount,
  isLoggingOut,
  isDeletingAccount,
}) => {
  return (
    <View 
      style={[
        styles.container,
        YELLOW_CARD_STYLES,
        styles.middleCardRounding,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Account Actions</Text>
        <Text style={styles.subtitle}>Manage your account</Text>
      </View>

      {/* Account Actions - Inline Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[
            styles.actionButton,
            styles.logoutButton,
            isLoggingOut && styles.actionButtonDisabled
          ]}
          onPress={onLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={20} color={COLORS.DARK_TEXT} />
          <Text style={styles.actionButtonText}>
            {isLoggingOut ? "Logging out..." : "Log out"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.actionButton,
            styles.deleteButton,
            isDeletingAccount && styles.actionButtonDisabled
          ]}
          onPress={onDeleteAccount}
          disabled={isDeletingAccount}
        >
          <Trash2 size={20} color="#E53935" />
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            Delete Account
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 16, // Reduced from 20 to match Date Scheduler (removes 4px excess)
    paddingBottom: 16, // Reduced from 20 to remove 4px excess spacing
    paddingHorizontal: 16, // Reduced to match Profile block spacing
    marginHorizontal: 0,
    marginBottom: 0,
    minHeight: 120, // Keep at 120 - this was the correct fix
  },
  middleCardRounding: {
    borderRadius: 20,
  },
  header: {
    marginBottom: 16, // Reduced to match Profile block spacing
    alignItems: 'center',
  },
  title: {
    fontSize: 16, // Reduced from 20 to match Date Scheduler
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13, // Reduced from 14 to match Date Scheduler
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    opacity: 0.8,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButton: {
    backgroundColor: COLORS.WHITE_CARD,
    borderColor: COLORS.DARK_TEXT,
  },
  deleteButton: {
    backgroundColor: COLORS.WHITE_CARD,
    borderColor: "#E53935",
  },
  actionButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 15, // Increased from 14 to match Date Scheduler
    fontFamily: 'Geist-Regular',
    marginLeft: 8,
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
  },
  dangerText: {
    color: "#E53935",
  },
});

export default AccountActionsCard;
