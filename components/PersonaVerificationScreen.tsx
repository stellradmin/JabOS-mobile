/**
 * Persona Verification Screen Component
 *
 * Embedded identity verification flow using Persona SDK.
 * Features:
 * - Introduction/explanation screen
 * - Embedded Persona Inquiry flow
 * - Real-time status updates
 * - Error handling with retry logic
 * - Success/failure messaging
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../src/contexts/AuthContext';

// Detect if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Persona Inquiry (not available in Expo Go)
let Inquiry: any = null;

if (!isExpoGo) {
  try {
    const PersonaModule = require('react-native-persona');
    Inquiry = PersonaModule.Inquiry;
  } catch (error) {
    console.warn('Persona module not available (expected in Expo Go)');
  }
}
import {
  startPersonaVerification,
  handleInquiryComplete,
  handleInquiryError,
  handleInquiryCancelled,
  getVerificationStatus,
  getStatusMessage,
  getPersonaEnvironment,
  PersonaVerificationStatus,
  isPersonaConfigured
} from '../src/services/persona-verification-service';
import { logError, logInfo, logDebug } from '../src/utils/logger';

interface PersonaVerificationScreenProps {
  onComplete: (verified: boolean, status?: 'approved' | 'pending' | 'declined') => void;
  onClose?: () => void;
  isModal?: boolean;
  onSkip?: () => void;
  allowSkip?: boolean;
  onBack?: () => void;
  hideBackButton?: boolean;
}

type VerificationStep = 'intro' | 'verifying' | 'processing' | 'completed' | 'failed';

const PersonaVerificationScreen: React.FC<PersonaVerificationScreenProps> = ({
  onComplete,
  onClose,
  isModal = false,
  onSkip,
  allowSkip = false,
  onBack,
  hideBackButton = false
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<VerificationStep>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<PersonaVerificationStatus>('not_started');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if Persona is configured
  const personaConfigured = isPersonaConfigured();

  // Check current verification status on mount
  useEffect(() => {
    if (user?.id) {
      checkVerificationStatus();
    }
  }, [user?.id]);

  const checkVerificationStatus = async () => {
    if (!user?.id) return;

    try {
      const status = await getVerificationStatus(user.id);
      setVerificationStatus(status.status);
      setInquiryId(status.inquiryId || null);

      // If already verified, skip to completed
      if (status.status === 'approved') {
        setCurrentStep('completed');
        return;
      }

      // If verification is in progress or pending, show processing
      if (status.status === 'in_progress' || status.status === 'pending') {
        setCurrentStep('processing');
        return;
      }
    } catch (error) {
      logError('[PersonaScreen] Error checking verification status:', error);
    }
  };

  const startVerification = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to continue');
      return;
    }

    if (!personaConfigured) {
      Alert.alert(
        'Configuration Error',
        'Identity verification is not properly configured. Please contact support.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      logInfo('[PersonaScreen] Starting verification flow');

      const result = await startPersonaVerification({
        userId: user.id,
        referenceId: `user_${user.id}`,
        fields: {
          name_first: user.user_metadata?.name?.split(' ')[0] || '',
          name_last: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
          email_address: user.email || ''
        }
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to start verification');
        setCurrentStep('failed');
        setIsLoading(false);
        return;
      }

      // Store session data and move to verification step
      setSessionToken(result.sessionToken || null);
      setInquiryId(result.inquiryId || null);
      setCurrentStep('verifying');
      setIsLoading(false);
    } catch (error) {
      logError('[PersonaScreen] Error starting verification:', error);
      setErrorMessage('An unexpected error occurred');
      setCurrentStep('failed');
      setIsLoading(false);
    }
  };

  const renderInquiry = useCallback(() => {
    if (!sessionToken || !inquiryId) {
      logError('[PersonaScreen] Missing session token or inquiry ID');
      return null;
    }

    // Check if Inquiry component is available
    if (isExpoGo || !Inquiry) {
      return (
        <View style={styles.inquiryContainer}>
          <View style={styles.expoGoWarning}>
            <Ionicons name="information-circle" size={48} color="#FFA500" />
            <Text style={styles.expoGoWarningTitle}>Expo Go Limitation</Text>
            <Text style={styles.expoGoWarningText}>
              Identity verification requires a development build and is not available in Expo Go.
            </Text>
            <Text style={styles.expoGoWarningText}>
              Please build a development client using 'eas build --profile development' to test this feature.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => onSkip ? onSkip() : onClose?.()}
            >
              <Text style={styles.buttonText}>Continue Without Verification</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.inquiryContainer}>
        <Inquiry
          sessionToken={sessionToken}
          environment={getPersonaEnvironment()}
          onComplete={(inquiryId: string, status: string, fields: any) => {
            logInfo('[PersonaScreen] Inquiry completed:', { inquiryId, status });
            handleComplete(inquiryId, status);
          }}
          onError={(error: any) => {
            logError('[PersonaScreen] Inquiry error:', error);
            handleError(error);
          }}
          onCancelled={(inquiryId: string, sessionToken: string) => {
            logInfo('[PersonaScreen] Inquiry cancelled');
            handleCancel(inquiryId);
          }}
          onEvent={(event: any) => {
            logDebug('[PersonaScreen] Inquiry event:', event);
          }}
        />
      </View>
    );
  }, [sessionToken, inquiryId]);

  const handleComplete = async (inquiryId: string, status: string) => {
    try {
      setCurrentStep('processing');

      if (user?.id) {
        await handleInquiryComplete(user.id, inquiryId, status);
      }

      // Check if immediately approved or needs review
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus === 'approved') {
        setVerificationStatus('approved');
        setCurrentStep('completed');
        // Call onComplete with status, then close modal after delay
        setTimeout(() => {
          onComplete(true, 'approved');
          onClose?.();
        }, 2000);
      } else if (normalizedStatus === 'pending') {
        setVerificationStatus('pending');
        setCurrentStep('processing');
        // For pending, show message then close
        setTimeout(() => {
          onComplete(false, 'pending');
          onClose?.();
        }, 2000);
      } else {
        setVerificationStatus('declined');
        setCurrentStep('failed');
        onComplete(false, 'declined');
      }
    } catch (error) {
      logError('[PersonaScreen] Error handling completion:', error);
      setCurrentStep('failed');
    }
  };

  const handleError = async (error: any) => {
    try {
      if (user?.id && inquiryId) {
        await handleInquiryError(user.id, inquiryId, error);
      }

      setErrorMessage(error?.message || 'Verification failed');
      setCurrentStep('failed');
    } catch (err) {
      logError('[PersonaScreen] Error handling error:', err);
      setCurrentStep('failed');
    }
  };

  const handleCancel = async (inquiryId: string) => {
    try {
      if (user?.id) {
        await handleInquiryCancelled(user.id, inquiryId);
      }

      setCurrentStep('intro');
    } catch (error) {
      logError('[PersonaScreen] Error handling cancel:', error);
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setCurrentStep('intro');
  };

  const handleSkip = () => {
    if (allowSkip && onSkip) {
      Alert.alert(
        'Skip Verification?',
        'Identity verification is required to match with other users. You can complete it later from your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Skip for Now',
            style: 'destructive',
            onPress: () => onSkip()
          }
        ]
      );
    }
  };

  // Render different steps
  const renderIntro = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={80} color="#4CAF50" />
      </View>

      <Text style={styles.title}>Identity Verification</Text>
      <Text style={styles.subtitle}>
        We use Persona's secure verification to ensure all users are authentic.
      </Text>

      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Ionicons name="camera" size={24} color="#6366F1" style={styles.infoIcon} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Take a Selfie</Text>
            <Text style={styles.infoDescription}>
              We'll guide you through taking a quick selfie with liveness detection
            </Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="eye" size={24} color="#6366F1" style={styles.infoIcon} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Liveness Check</Text>
            <Text style={styles.infoDescription}>
              Follow simple prompts to verify you're a real person
            </Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="lock-closed" size={24} color="#6366F1" style={styles.infoIcon} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Secure & Private</Text>
            <Text style={styles.infoDescription}>
              Your data is encrypted and only used for verification
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle" size={20} color="#666" />
        <Text style={styles.disclaimerText}>
          This process typically takes less than 2 minutes. Your verification helps keep Stellr safe for everyone.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={startVerification}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Text style={styles.buttonText}>Start Verification</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </>
        )}
      </TouchableOpacity>

      {allowSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderVerifying = () => (
    <View style={styles.centeredContainer}>
      {renderInquiry()}
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.centeredContainer}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={styles.processingTitle}>Processing Verification</Text>
      <Text style={styles.processingText}>
        {getStatusMessage(verificationStatus)}
      </Text>
      <Text style={styles.processingSubtext}>
        This may take a few moments. You'll be notified once verification is complete.
      </Text>
    </View>
  );

  const renderCompleted = () => (
    <View style={styles.centeredContainer}>
      <View style={styles.successIconContainer}>
        <Ionicons name="checkmark-circle" size={100} color="#4CAF50" />
      </View>
      <Text style={styles.successTitle}>Verification Complete!</Text>
      <Text style={styles.successText}>
        Your identity has been verified. Welcome to Stellr!
      </Text>
      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={() => onComplete(true)}
      >
        <Text style={styles.buttonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  const renderFailed = () => (
    <View style={styles.centeredContainer}>
      <View style={styles.errorIconContainer}>
        <Ionicons name="alert-circle" size={100} color="#FF6B6B" />
      </View>
      <Text style={styles.errorTitle}>Verification Failed</Text>
      <Text style={styles.errorText}>
        {errorMessage || 'We were unable to verify your identity. Please try again.'}
      </Text>
      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={handleRetry}
      >
        <Ionicons name="refresh" size={20} color="#FFF" />
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
      {allowSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {!hideBackButton && onBack && currentStep === 'intro' && !isModal && (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      )}

      {isModal && onClose && currentStep === 'intro' && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
      )}

      {currentStep === 'intro' && renderIntro()}
      {currentStep === 'verifying' && renderVerifying()}
      {currentStep === 'processing' && renderProcessing()}
      {currentStep === 'completed' && renderCompleted()}
      {currentStep === 'failed' && renderFailed()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  backButton: {
    padding: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10
  },
  closeButton: {
    padding: 16,
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center'
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  iconContainer: {
    marginVertical: 32
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24
  },
  infoSection: {
    width: '100%',
    marginBottom: 24
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2
  },
  infoText: {
    flex: 1
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  infoDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%'
  },
  disclaimerText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    marginLeft: 12,
    lineHeight: 20
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    gap: 8
  },
  primaryButton: {
    backgroundColor: '#6366F1'
  },
  buttonDisabled: {
    backgroundColor: '#CCC'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF'
  },
  skipButton: {
    marginTop: 16,
    padding: 12
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  inquiryContainer: {
    flex: 1,
    width: '100%'
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center'
  },
  processingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8
  },
  processingSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32
  },
  successIconContainer: {
    marginBottom: 24
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 12,
    textAlign: 'center'
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 32
  },
  errorIconContainer: {
    marginBottom: 24
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 12,
    textAlign: 'center'
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 32
  },
  expoGoWarning: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFF'
  },
  expoGoWarningTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center'
  },
  expoGoWarningText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24
  },
  buttonPrimary: {
    backgroundColor: '#6366F1',
    marginTop: 24
  }
});

export default PersonaVerificationScreen;
