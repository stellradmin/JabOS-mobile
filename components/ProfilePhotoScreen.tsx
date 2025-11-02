import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator, Modal } from "react-native";
import { Camera, CheckCircle, AlertCircle, Clock } from "lucide-react-native";
import { uploadPhotoFlow, UploadResult } from "../src/services/photo-upload-service";
import { useAuth } from "../src/contexts/AuthContext";
import SafeImage from "./SafeImage";
import PersonaVerificationScreen from "./PersonaVerificationScreen";
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

interface ProfilePhotoScreenProps {
  initialData: {
    photoUri?: string | null;
  };
  onContinue: (data: { photoUri: string | null }) => void;
  onBack: () => void;
  currentSubStepInFlow: number;
  overallStepsCompletedBeforeThisFlow: number;
  totalSubStepsInFlow: number;
  totalOverallOnboardingSteps: number;
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const ProfilePhotoScreen: React.FC<ProfilePhotoScreenProps> = ({
  initialData,
  onContinue,
  onBack,
  currentSubStepInFlow,
  overallStepsCompletedBeforeThisFlow,
  totalSubStepsInFlow,
  totalOverallOnboardingSteps,
  hideProgressBar = false,
  hideBackButton = false,
  backgroundColor = '#B8D4F1',
}) => {
  const { user } = useAuth();
  const [photoUri, setPhotoUri] = useState(initialData.photoUri || null);
  const [isContinuePressed, setIsContinuePressed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [personaVerified, setPersonaVerified] = useState<boolean | 'pending' | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string>('');

  const handlePhotoUpload = () => {
    Alert.alert(
      "Select Photo",
      "Choose how you'd like to add your profile photo",
      [
        { text: "Camera", onPress: () => uploadPhoto('camera') },
        { text: "Gallery", onPress: () => uploadPhoto('gallery') },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const uploadPhoto = async (source: 'camera' | 'gallery') => {
    if (!user?.id) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    setIsLoading(true);
    setVerificationMessage('Uploading photo...');

    try {
      const result = await uploadPhotoFlow(user.id, source, {
        quality: 0.8,
        aspect: [1, 1],
        allowsEditing: true
      });

      if (result.success && result.url) {
        setPhotoUri(result.url);
        setVerificationMessage('Photo uploaded successfully!');

        // Show Persona verification modal after successful upload
        setTimeout(() => {
          setShowVerificationModal(true);
        }, 500);
      } else {
        // Handle upload failure
        setVerificationMessage(result.error || 'Upload failed.');
        Alert.alert("Upload Error", result.error || "Failed to upload photo. Please try again.");
      }
    } catch (error: any) {
      logError('Error uploading photo:', "Error", error);
      setVerificationMessage('Upload failed due to an unexpected error.');
      Alert.alert("Error", error.message || "Failed to upload photo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = (verified: boolean, status?: 'approved' | 'pending' | 'declined') => {
    if (status === 'approved') {
      setPersonaVerified(true);
      setVerificationMessage('Identity verified! ✓');
    } else if (status === 'pending') {
      setPersonaVerified('pending');
      setVerificationMessage('Verification submitted - under review');
    } else {
      setPersonaVerified(false);
      setVerificationMessage('Verification failed');
    }
  };

  const handleModalClose = () => {
    setShowVerificationModal(false);
  };

  const handleContinuePress = () => {
    // Allow continue if photo is uploaded AND (verified OR pending)
    if (!photoUri) {
      Alert.alert("Photo Required", "Please upload a profile photo to continue.");
      return;
    }

    if (personaVerified === null) {
      Alert.alert("Verification Required", "Please complete identity verification to continue.");
      return;
    }

    onContinue({ photoUri });
  };

  const progressPercentage =
    (overallStepsCompletedBeforeThisFlow / totalOverallOnboardingSteps) * 100 +
    (currentSubStepInFlow / totalSubStepsInFlow) * (1 / totalOverallOnboardingSteps) * 100;

  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 4 of 5</Text>
        <Text style={styles.mainTitle}>Profile Photo</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Add your profile photo</Text>

        {/* Photo Upload UI */}
        <View style={styles.photoContainer}>
          <TouchableOpacity
            onPress={handlePhotoUpload}
            style={[styles.avatarTouchable, isLoading && styles.disabledTouchable]}
            disabled={isLoading}
          >
            {photoUri ? (
              <SafeImage
                source={{ uri: photoUri }}
                style={[styles.avatarImage, isLoading && styles.disabledImage]}
                fallbackText="U"
                fallbackIcon={false}
              />
            ) : (
              <View style={[styles.avatarCircle, isLoading && styles.disabledCircle]}>
                <Text style={styles.avatarText}>
                  {isLoading ? "..." : "U"}
                </Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Camera size={20} color="white" />
            </View>

            {/* Verification Status Indicator */}
            {personaVerified === true && (
              <View style={styles.verificationIndicator}>
                <CheckCircle size={20} color="#34C759" />
              </View>
            )}
            {personaVerified === 'pending' && (
              <View style={styles.verificationIndicator}>
                <Clock size={20} color="#FF9500" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.uploadText}>
            {isLoading ? "Processing..." : "Upload Profile Photo"}
          </Text>

          <Text style={styles.uploadSubtext}>
            {isLoading ? "Please wait..." : photoUri ? "Tap to change your photo" : "Tap to add your photo"}
          </Text>

          {/* Verification Status Message */}
          {verificationMessage && (
            <View style={[
              styles.verificationMessageContainer,
              personaVerified === true && styles.verificationSuccess,
              personaVerified === false && styles.verificationError,
              personaVerified === 'pending' && styles.verificationPending,
            ]}>
              <Text style={[
                styles.verificationMessageText,
                personaVerified === true && styles.verificationSuccessText,
                personaVerified === false && styles.verificationErrorText,
                personaVerified === 'pending' && styles.verificationPendingText,
              ]}>
                {verificationMessage}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: isContinuePressed ? "#9FC4E7" : "#B8D4F1",
            },
          ]}
          onPress={handleContinuePress}
          onPressIn={() => setIsContinuePressed(true)}
          onPressOut={() => setIsContinuePressed(false)}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Persona Verification Modal */}
      <Modal
        visible={showVerificationModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleModalClose}
      >
        <PersonaVerificationScreen
          isModal={true}
          onComplete={handleVerificationComplete}
          onClose={handleModalClose}
          allowSkip={false}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 2,
    borderTopColor: 'black',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
  },
  stepIndicator: {
    fontSize: 14,
    color: 'black',
    opacity: 0.6,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555555",
    marginBottom: 60,
    marginTop: 0,
  },
  photoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatarTouchable: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "black"
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "black"
  },
  avatarText: {
    fontSize: 48,
    fontFamily: 'Geist-Regular',
    color: "black"
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "black",
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: 'white'
  },
  uploadText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: "black",
    marginBottom: 8,
  },
  uploadSubtext: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  disabledTouchable: {
    opacity: 0.6,
  },
  disabledImage: {
    opacity: 0.6,
  },
  disabledCircle: {
    opacity: 0.6,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  continueButton: {
    backgroundColor: "#B8D4F1",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 0,
  },
  continueButtonText: {
    fontFamily: 'Geist-Regular',
    fontSize: 18,
    color: "black",
  },
  // Verification status styles
  verificationIndicator: {
    position: "absolute",
    top: -5,
    left: -5,
    backgroundColor: "white",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  verificationMessageContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F8F9FA",
  },
  verificationSuccess: {
    borderColor: "#34C759",
    backgroundColor: "#E8F5E8",
  },
  verificationError: {
    borderColor: "#FF3B30",
    backgroundColor: "#FFF0F0",
  },
  verificationPending: {
    borderColor: "#FF9500",
    backgroundColor: "#FFF8E6",
  },
  verificationMessageText: {
    fontSize: 14,
    textAlign: "center",
    color: "#666666",
    lineHeight: 20,
  },
  verificationSuccessText: {
    color: "#2D7D32",
  },
  verificationErrorText: {
    color: "#C62828",
  },
  verificationPendingText: {
    color: "#111827",
  },
  helpButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#007AFF",
    borderRadius: 6,
    alignSelf: "center",
  },
  helpButtonText: {
    color: "white",
    fontSize: 12,
    fontFamily: 'Geist-Regular',
  },
});

export default ProfilePhotoScreen;
