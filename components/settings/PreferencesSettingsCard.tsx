import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from "expo-router";
import { WHITE_CARD_STYLES, COLORS } from '../../constants/theme';
import { Slider } from "@miblanchard/react-native-slider";
import PopUpTray from '../PopUpTray';
import {
  ArrowLeft,
  MoreHorizontal,
  ChevronDown,
  FileText,
  AlertCircle,
  Settings
} from 'lucide-react-native';

interface PreferencesSettingsCardProps {
  distance: number;
  minAge: number;
  maxAge: number;
  showHeight: boolean;
  searchFilter: number;
  readReceipts: boolean;
  notifications: boolean;
  activeStatus: boolean;
  pauseAccount: boolean;
  onDistanceChange: (value: number) => void;
  onAgeRangeChange: (minAge: number, maxAge: number) => void;
  onShowHeightChange: (value: boolean) => void;
  onSearchFilterChange: (value: number) => void;
  onReadReceiptsChange: (value: boolean) => void;
  onNotificationsChange: (value: boolean) => void;
  onActiveStatusChange: (value: boolean) => void;
  onPauseAccountChange: (value: boolean) => void;
  onPrivacyPolicy: () => void;
  onTermsConditions: () => void;
  onReportIssue: () => void;
  isLoading: boolean;
}

const PreferencesSettingsCard: React.FC<PreferencesSettingsCardProps> = ({
  distance,
  minAge,
  maxAge,
  showHeight,
  searchFilter,
  readReceipts,
  notifications,
  activeStatus,
  pauseAccount,
  onDistanceChange,
  onAgeRangeChange,
  onShowHeightChange,
  onSearchFilterChange,
  onReadReceiptsChange,
  onNotificationsChange,
  onActiveStatusChange,
  onPauseAccountChange,
  onPrivacyPolicy,
  onTermsConditions,
  onReportIssue,
  isLoading,
}) => {
  const router = useRouter();
  const [showLegalMenu, setShowLegalMenu] = useState(false);
  const [showSettingsTray, setShowSettingsTray] = useState(false);
  const [showReportTray, setShowReportTray] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  
  // Helper function to get search filter label
  const getSearchFilterLabel = (value: number): string => {
    switch (value) {
      case 0:
        return "Flexible";
      case 1:
        return "Recommended";
      case 2:
        return "Strict";
      default:
        return "Recommended";
    }
  };
  
  return (
    <View 
      style={[
        styles.container,
        WHITE_CARD_STYLES,
        styles.topCardRounding,
        styles.noShadow,
      ]}
    >
      {/* Header Row - Back Button Only */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={COLORS.DARK_TEXT} />
        </TouchableOpacity>
      </View>

      {/* Title Section */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Customize your search criteria</Text>
      </View>

      {/* Legal Menu Button - positioned absolute */}
      <TouchableOpacity 
        style={styles.legalMenuButton}
        onPress={() => setShowLegalMenu(true)}
        disabled={isLoading}
      >
        <MoreHorizontal size={20} color={COLORS.DARK_TEXT} />
      </TouchableOpacity>

      {/* Distance Section */}
      <View style={styles.section}>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Distance</Text>
          <Text style={styles.sliderValue}>{distance} miles</Text>
        </View>

        <Slider
          value={distance}
          onValueChange={(value) => onDistanceChange(Math.round(value[0]))}
          minimumValue={1}
          maximumValue={100}
          step={1}
          thumbTintColor={isLoading ? "#ccc" : COLORS.DARK_TEXT}
          minimumTrackTintColor={isLoading ? "#ccc" : COLORS.DARK_TEXT}
          maximumTrackTintColor="#ccc"
          thumbStyle={StyleSheet.flatten([styles.sliderThumb, isLoading && { backgroundColor: "#ccc" }])}
          trackStyle={styles.sliderTrack}
          disabled={isLoading}
        />

      </View>

      {/* Age Range Section */}
      <View style={styles.section}>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Age Range</Text>
          <Text style={styles.sliderValue}>{minAge} - {maxAge} years</Text>
        </View>

        <Slider
          value={[minAge, maxAge]}
          onValueChange={(values) => {
            const newMinAge = Math.round(values[0]);
            const newMaxAge = Math.round(values[1]);
            onAgeRangeChange(newMinAge, newMaxAge);
          }}
          minimumValue={18}
          maximumValue={100}
          step={1}
          // Ensure two distinct, always-visible thumbs for age range
          renderThumbComponent={(index) => (
            <View
              // give each thumb a distinct style to ensure visibility
              style={StyleSheet.flatten([
                styles.sliderThumb,
                styles.ageRangeThumb,
                isLoading && { backgroundColor: "#ccc" },
              ])}
            />
          )}
          thumbTouchSize={{ width: 40, height: 40 }}
          minimumTrackTintColor={isLoading ? "#ccc" : COLORS.DARK_TEXT}
          maximumTrackTintColor="#ccc"
          trackStyle={styles.sliderTrack}
          disabled={isLoading}
        />

      </View>

      {/* Search Filter Section */}
      <View style={styles.section}>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Search Filter</Text>
          <Text style={styles.sliderValue}>{getSearchFilterLabel(searchFilter)}</Text>
        </View>

        <Slider
          value={searchFilter}
          onValueChange={(value) => onSearchFilterChange(Math.round(value[0]))}
          minimumValue={0}
          maximumValue={2}
          step={1}
          thumbTintColor={isLoading ? "#ccc" : COLORS.DARK_TEXT}
          minimumTrackTintColor={isLoading ? "#ccc" : COLORS.DARK_TEXT}
          maximumTrackTintColor="#ccc"
          thumbStyle={StyleSheet.flatten([styles.sliderThumb, isLoading && { backgroundColor: "#ccc" }])}
          trackStyle={styles.sliderTrack}
          disabled={isLoading}
        />

      </View>

      {/* Inline Action Buttons */}
      <View style={styles.inlineActionsContainer}>
        <TouchableOpacity 
          style={styles.inlineActionButton}
          onPress={() => setShowSettingsTray(true)}
          disabled={isLoading}
        >
          <Settings size={20} color={COLORS.DARK_TEXT} />
          <Text style={styles.inlineActionButtonText}>Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.inlineActionButton}
          onPress={() => setShowReportTray(true)}
          disabled={isLoading}
        >
          <AlertCircle size={20} color={COLORS.DARK_TEXT} />
          <Text style={styles.inlineActionButtonText}>Report an Issue</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy & Notifications Settings Tray */}
      <PopUpTray
        isVisible={showSettingsTray}
        onClose={() => setShowSettingsTray(false)}
        onConfirm={() => setShowSettingsTray(false)}
        title="Notifications & Privacy"
        confirmButtonText="Done"
        customHeight={0.6}
      >
        <View style={styles.trayContent}>
          {/* Read Receipts Toggle */}
          <View style={styles.trayToggleRow}>
            <View style={styles.trayToggleInfo}>
              <Text style={styles.trayToggleLabel}>Read Receipts</Text>
              <Text style={styles.trayToggleDescription}>Show when messages are read</Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={onReadReceiptsChange}
              disabled={isLoading}
              trackColor={{ false: "#ccc", true: COLORS.DARK_TEXT }}
              thumbColor={readReceipts ? COLORS.WHITE_CARD : "#f4f3f4"}
              ios_backgroundColor="#ccc"
            />
          </View>

          {/* Notifications Toggle */}
          <View style={styles.trayToggleRow}>
            <View style={styles.trayToggleInfo}>
              <Text style={styles.trayToggleLabel}>Notifications</Text>
              <Text style={styles.trayToggleDescription}>Receive push notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={onNotificationsChange}
              disabled={isLoading}
              trackColor={{ false: "#ccc", true: COLORS.DARK_TEXT }}
              thumbColor={notifications ? COLORS.WHITE_CARD : "#f4f3f4"}
              ios_backgroundColor="#ccc"
            />
          </View>

          {/* Active Status Toggle */}
          <View style={styles.trayToggleRow}>
            <View style={styles.trayToggleInfo}>
              <Text style={styles.trayToggleLabel}>Active Status</Text>
              <Text style={styles.trayToggleDescription}>Show online status to matches</Text>
            </View>
            <Switch
              value={activeStatus}
              onValueChange={onActiveStatusChange}
              disabled={isLoading}
              trackColor={{ false: "#ccc", true: COLORS.DARK_TEXT }}
              thumbColor={activeStatus ? COLORS.WHITE_CARD : "#f4f3f4"}
              ios_backgroundColor="#ccc"
            />
          </View>

          {/* Pause Account Toggle */}
          <View style={styles.trayToggleRow}>
            <View style={styles.trayToggleInfo}>
              <Text style={styles.trayToggleLabel}>Pause Account</Text>
              <Text style={styles.trayToggleDescription}>Temporarily hide profile from discovery</Text>
            </View>
            <Switch
              value={pauseAccount}
              onValueChange={onPauseAccountChange}
              disabled={isLoading}
              trackColor={{ false: "#ccc", true: COLORS.DARK_TEXT }}
              thumbColor={pauseAccount ? COLORS.WHITE_CARD : "#f4f3f4"}
              ios_backgroundColor="#ccc"
            />
          </View>
        </View>
      </PopUpTray>

      {/* Report Issue Tray */}
      <PopUpTray
        isVisible={showReportTray}
        onClose={() => {
          setShowReportTray(false);
          setReportDescription('');
        }}
        onConfirm={() => {
          if (reportDescription.trim().length === 0) {
            Alert.alert("Error", "Please describe the issue you're experiencing.");
            return;
          }
          
          Alert.alert(
            "Report Submitted", 
            "Thank you for your feedback. We'll review your report and get back to you if needed.",
            [
              {
                text: "OK",
                onPress: () => {
                  setShowReportTray(false);
                  setReportDescription('');
                }
              }
            ]
          );
        }}
        title="Report an Issue"
        confirmButtonText="Submit Report"
        customHeight={0.7}
      >
        <View style={styles.reportContent}>
          <Text style={styles.reportLabel}>Help us improve Stellr</Text>
          <Text style={styles.reportDescription}>
            Describe the issue you're experiencing. Include as much detail as possible - what you were doing, what you expected to happen, and what actually happened.
          </Text>
          
          <Text style={styles.reportInputLabel}>Issue Description</Text>
          <TextInput
            style={styles.reportInput}
            value={reportDescription}
            onChangeText={setReportDescription}
            placeholder="Please describe the issue you're experiencing..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
          
          <Text style={styles.reportCharCount}>
            {reportDescription.length}/500 characters
          </Text>
        </View>
      </PopUpTray>

      {/* Legal Menu Modal */}
      <Modal
        visible={showLegalMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLegalMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Legal Information</Text>
            
            <TouchableOpacity 
              style={styles.menuOption}
              onPress={() => {
                setShowLegalMenu(false);
                onPrivacyPolicy();
              }}
            >
              <Text style={styles.menuOptionText}>Privacy Policy</Text>
              <ChevronDown size={16} color={COLORS.DARK_TEXT} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuOption}
              onPress={() => {
                setShowLegalMenu(false);
                onTermsConditions();
              }}
            >
              <Text style={styles.menuOptionText}>Terms & Conditions</Text>
              <FileText size={16} color={COLORS.DARK_TEXT} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuOption, styles.cancelOption]}
              onPress={() => setShowLegalMenu(false)}
            >
              <Text style={[styles.menuOptionText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 80, // Match other screens like messages for proper header positioning
    paddingHorizontal: 20,
    paddingBottom: 8, // Reduced from 30 to match Date Scheduler tight spacing
    marginHorizontal: 0,
    marginTop: 0, // Attach to top
    marginBottom: 0,
    minHeight: 400,
  },
  topCardRounding: {
    borderTopLeftRadius: 0, // Square top corners for full width
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  noShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16, // Match ProfileInfoCard
  },
  backButton: {
    width: 36, // Keep size for touch target
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    marginBottom: 24, // Match ProfileInfoCard
  },
  legalMenuButton: {
    position: 'absolute',
    top: 90, // Position after header + back button row
    right: 20,
    width: 40, // Keep size for touch target
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
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
    width: '80%',
    maxWidth: 300,
    borderWidth: 2,
    borderColor: COLORS.DARK_TEXT,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
    marginBottom: 20,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.DARK_TEXT,
    backgroundColor: COLORS.WHITE_CARD,
    marginBottom: 12,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelOption: {
    borderColor: COLORS.SECONDARY_TEXT,
    backgroundColor: '#f5f5f5',
  },
  menuOptionText: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  cancelText: {
    color: COLORS.SECONDARY_TEXT,
  },
  title: {
    fontSize: 32, // Match ProfileInfoCard
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18, // Match ProfileInfoCard
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 24, // Match ProfileInfoCard
  },
  section: {
    marginBottom: 16, // Reduced to match standardized action button spacing
  },
  sliderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  sliderValue: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.DARK_TEXT,
  },
  ageRangeThumb: {
    // add a subtle border to help distinguish the two handles
    borderWidth: 2,
    borderColor: COLORS.WHITE_CARD,
  },
  sliderTrack: {
    height: 4,
  },
  sliderDescription: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 8,
    marginBottom: 16,
  },
  inlineActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  inlineActionButton: {
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
  inlineActionButtonText: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    marginLeft: 8,
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
  },
  trayContent: {
    paddingTop: 16,
  },
  trayToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trayToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  trayToggleLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 2,
  },
  trayToggleDescription: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 18,
  },
  reportContent: {
    paddingTop: 16,
  },
  reportLabel: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  reportDescription: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  reportInputLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  reportInput: {
    borderWidth: 2,
    borderColor: COLORS.DARK_TEXT,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    backgroundColor: COLORS.WHITE_CARD,
    minHeight: 120,
    marginBottom: 8,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  reportCharCount: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'right',
    marginBottom: 16,
  },
});

export default PreferencesSettingsCard;
