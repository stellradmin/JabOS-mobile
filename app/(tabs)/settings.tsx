import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { SettingsProvider, useSettings } from "../../src/contexts/SettingsContext";
import { 
  PreferencesSettingsCard, 
  AccountActionsCard 
} from "../../components/settings";
import { TEXT_STYLES, COLORS } from "../../constants/theme";
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";
import AnimatedTabScreenContainer from '../../components/navigation/AnimatedTabScreenContainer';

// Settings component with context wrapper
const SettingsContent: React.FC = () => {
  const router = useRouter();
  const { deleteAccount, signOut } = useAuth();
  // Pull context and expose a friendlier alias
  const settingsCtx = useSettings();
  const prefs = settingsCtx.settings;
  
  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Handle delete account modal
  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      Alert.alert("Error", "Please type 'DELETE' to confirm account deletion.");
      return;
    }

    setIsDeletingAccount(true);
    try {
      const result = await deleteAccount(deleteConfirmationText);
      
      // Show success with details
      let successMessage = "Your account has been successfully deleted.";
      if (result?.deletionLog) {
        const datasets = Array.isArray((result.deletionLog as any).datasetsDeleted)
          ? (result.deletionLog as any).datasetsDeleted.join(', ')
          : '';
        successMessage = datasets
          ? `Your account has been successfully deleted.\n\nDatasets removed: ${datasets}`
          : successMessage;
      }
        
      Alert.alert("Account Deleted", successMessage, [
        {
          text: "OK",
          onPress: () => {
            setShowDeleteModal(false);
            router.replace('/welcome');
          }
        }
      ]);
    } catch (e: any) {
      logError("Exception deleting account:", "Error", e.message);
      
      let errorMessage = "Failed to delete account.";
      if (e.message.includes('CRITICAL')) {
        errorMessage = "Critical error during account deletion. Your account may still exist. Please contact support immediately.";
      } else if (e.message.includes('step')) {
        errorMessage = `Account deletion failed during processing: ${e.message}`;
      } else {
        errorMessage = `Account deletion failed: ${e.message}`;
      }
      
      Alert.alert("Deletion Failed", errorMessage);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const cancelDeleteAccount = () => {
    setShowDeleteModal(false);
    setDeleteConfirmationText('');
  };

  return (
    <AnimatedTabScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.WHITE_CARD} translucent={false} />
        <View style={styles.container}>
          <View style={styles.blackBackground}>
            <View style={styles.scrollContainer}>
              {/* Preferences Settings Card - Block 1 */}
              <PreferencesSettingsCard
                distance={prefs.distance}
                minAge={prefs.minAge}
                maxAge={prefs.maxAge}
                showHeight={prefs.showHeight}
                searchFilter={prefs.searchFilter}
                // Map nested settings to simple booleans used by the card
                readReceipts={prefs.privacy?.showReadReceipts ?? true}
                // Use messages notifications as the general toggle
                notifications={(prefs.notifications?.messages ?? true) && (prefs.notifications?.matches ?? true)}
                activeStatus={prefs.privacy?.showOnlineStatus ?? true}
                pauseAccount={prefs.pauseAccount}
                // Inline handlers update context properly
                onDistanceChange={(value) => settingsCtx.updateSettings({ distance: value })}
                onAgeRangeChange={(min, max) => settingsCtx.updateSettings({ minAge: min, maxAge: max })}
                onShowHeightChange={(value) => settingsCtx.updateSettings({ showHeight: value })}
                onSearchFilterChange={(value) => settingsCtx.updateSettings({ searchFilter: value })}
                onReadReceiptsChange={(value) => settingsCtx.updateSettings({
                  privacy: { ...prefs.privacy, showReadReceipts: value },
                })}
                onNotificationsChange={(value) => settingsCtx.updateSettings({
                  notifications: { ...prefs.notifications, messages: value, matches: value },
                })}
                onActiveStatusChange={(value) => settingsCtx.updateSettings({
                  privacy: { ...prefs.privacy, showOnlineStatus: value },
                })}
                onPauseAccountChange={(value) => settingsCtx.updateSettings({ pauseAccount: value })}
                // Legal page navigation and report issue handler
                onPrivacyPolicy={() => router.push('/privacy-policy')}
                onTermsConditions={() => router.push('/terms-of-service')}
                onReportIssue={() => router.push('/report-issue')}
                isLoading={settingsCtx.isLoading}
              />

              {/* Account Actions Card - Block 2 */}
              <AccountActionsCard
                onLogout={async () => {
                  try {
                    await signOut();
                  } catch (e) {
                    Alert.alert('Logout failed', e instanceof Error ? e.message : 'Unknown error');
                  }
                }}
                onDeleteAccount={handleDeleteAccount}
                // No loading flags provided by settings context; default to false
                isLoggingOut={false}
                isDeletingAccount={isDeletingAccount}
              />

              {/* Developer tools (visible in dev builds) */}
              {process.env.EXPO_PUBLIC_APP_ENV !== 'production' && (
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => router.push('/dev-matching' as any)}
                    style={{
                      backgroundColor: COLORS.BLACK_CARD,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      borderWidth: 0,
                    }}
                  >
                    <Text style={{ color: COLORS.CARD_WHITE_TEXT, fontFamily: 'Geist-Regular' }}>
                      Developer: Matching & Messaging UI
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Delete Account Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelDeleteAccount}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <Text style={styles.modalWarning}>
                ⚠️ This action cannot be undone. All your data, matches, conversations, and profile information will be permanently deleted.
              </Text>
              
              <Text style={styles.modalInstruction}>
                To confirm, type "DELETE" in the box below:
              </Text>
              
              <TextInput
                style={styles.confirmationInput}
                value={deleteConfirmationText}
                onChangeText={setDeleteConfirmationText}
                placeholder="Type DELETE here"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelDeleteAccount}
                  disabled={isDeletingAccount}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.modalButton, 
                    styles.deleteButton,
                    (deleteConfirmationText !== 'DELETE' || isDeletingAccount) && styles.disabledButton
                  ]}
                  onPress={confirmDeleteAccount}
                  disabled={deleteConfirmationText !== 'DELETE' || isDeletingAccount}
                >
                  <Text style={styles.deleteButtonText}>
                    {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AnimatedTabScreenContainer>
  );
};

// Main Settings component with SettingsProvider wrapper
export default function Settings() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.WHITE_CARD, // Keep status bar white
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD, // Ensure area beneath content is black
  },
  blackBackground: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD, // Dark background matching other screens
  },
  scrollContainer: {
    flex: 1,
    paddingTop: 0, // No extra padding since cards handle their own spacing
    paddingBottom: 60, // Reverted back from 12 - the previous reduction was incorrect
    gap: 6, // 6px gap between cards matching other screens
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: 'black',
  },
  modalTitle: {
    ...TEXT_STYLES.HEADING_LARGE,
    color: COLORS.CORAL,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalWarning: {
    ...TEXT_STYLES.BODY_MEDIUM,
    color: COLORS.CHARCOAL,
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInstruction: {
    ...TEXT_STYLES.BODY_MEDIUM,
    color: COLORS.CHARCOAL,
    marginBottom: 12,
  },
  confirmationInput: {
    ...TEXT_STYLES.BODY_MEDIUM,
    borderWidth: 2,
    borderColor: COLORS.CORAL,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.25,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'white',
    borderColor: 'black',
  },
  cancelButtonText: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
    color: COLORS.CHARCOAL,
  },
  deleteButton: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  deleteButtonText: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
    color: COLORS.SOFT_WHITE,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
    opacity: 0.6,
  },
});
