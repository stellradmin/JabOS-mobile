import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BLUE_CARD_STYLES, COLORS } from '../../constants/theme';
import { Save, Check, Loader } from 'lucide-react-native';

interface SaveSettingsCardProps {
  onSaveSettings: () => void;
  isSaving: boolean;
  isLoading: boolean;
  hasUnsavedChanges: boolean;
  lastSavedTime?: Date;
}

const SaveSettingsCard: React.FC<SaveSettingsCardProps> = ({
  onSaveSettings,
  isSaving,
  isLoading,
  hasUnsavedChanges,
  lastSavedTime,
}) => {
  const getButtonText = () => {
    if (isLoading) return "Loading...";
    if (isSaving) return "Saving...";
    if (!hasUnsavedChanges && lastSavedTime) return "Settings Saved";
    return "Save Settings";
  };

  const getButtonIcon = () => {
    if (isSaving) return <Loader size={20} color={COLORS.CARD_WHITE_TEXT} />;
    if (!hasUnsavedChanges && lastSavedTime) return <Check size={20} color={COLORS.CARD_WHITE_TEXT} />;
    return <Save size={20} color={COLORS.CARD_WHITE_TEXT} />;
  };

  const formatLastSavedTime = () => {
    if (!lastSavedTime) return null;
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastSavedTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return lastSavedTime.toLocaleDateString();
  };

  return (
    <View 
      style={[
        styles.container,
        BLUE_CARD_STYLES,
        styles.bottomCardRounding,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Save Changes</Text>
        <Text style={styles.subtitle}>
          {hasUnsavedChanges 
            ? "You have unsaved changes" 
            : lastSavedTime 
              ? `Last saved ${formatLastSavedTime()}`
              : "All settings are up to date"
          }
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (isSaving || isLoading) && styles.saveButtonDisabled,
          (!hasUnsavedChanges && lastSavedTime) && styles.saveButtonSuccess
        ]}
        onPress={onSaveSettings}
        disabled={isSaving || isLoading || (!hasUnsavedChanges && !lastSavedTime)}
        activeOpacity={0.8}
      >
        {getButtonIcon()}
        <Text style={styles.saveButtonText}>
          {getButtonText()}
        </Text>
      </TouchableOpacity>

      {/* Status Indicator */}
      {hasUnsavedChanges && (
        <View style={styles.statusContainer}>
          <View style={styles.unsavedIndicator} />
          <Text style={styles.statusText}>Unsaved changes</Text>
        </View>
      )}

      {lastSavedTime && !hasUnsavedChanges && (
        <View style={styles.statusContainer}>
          <View style={styles.savedIndicator} />
          <Text style={styles.statusText}>All changes saved</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginHorizontal: 0,
    marginBottom: -20, // Negative margin to overlap with navigation bar
    paddingBottom: 12, // Minimal padding for tight spacing with nav
    minHeight: 140,
    zIndex: 10, // Higher z-index to appear above navigation bar
    elevation: 10, // For Android shadow and layering
    position: 'relative', // Ensure z-index works properly
  },
  bottomCardRounding: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    opacity: 0.8,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.DARK_TEXT,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  saveButtonSuccess: {
    backgroundColor: "#10B981", // Green for success state
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.CARD_WHITE_TEXT,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    opacity: 0.7,
  },
  unsavedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444', // Red for unsaved
  },
  savedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981', // Green for saved
  },
});

export default SaveSettingsCard;