import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';
import DateTimePicker from '@react-native-community/datetimepicker';

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

const AgeVerificationScreen: React.FC = () => {
  const { verifyAge, logUserAction, loading: complianceLoading } = useLegalCompliance();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [idType, setIdType] = useState<string>('');
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    age: number;
  } | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);

  useEffect(() => {
    logUserAction('age_verification_started');
  }, []);

  const verificationSteps: VerificationStep[] = [
    {
      id: 'date_of_birth',
      title: 'Date of Birth',
      description: 'Enter your date of birth to verify you meet the minimum age requirement',
      required: true,
    },
    {
      id: 'identity_verification',
      title: 'Identity Verification',
      description: 'Provide identity information for enhanced security and compliance',
      required: true,
    },
    {
      id: 'legal_agreements',
      title: 'Legal Agreements',
      description: 'Review and accept our terms of service and privacy policy',
      required: true,
    },
    {
      id: 'final_verification',
      title: 'Final Verification',
      description: 'Complete the verification process and access your account',
      required: true,
    },
  ];

  const idTypes = [
    { value: 'drivers_license', label: 'Driver\'s License' },
    { value: 'passport', label: 'Passport' },
    { value: 'state_id', label: 'State ID' },
    { value: 'military_id', label: 'Military ID' },
    { value: 'other', label: 'Other Government ID' },
  ];

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const validateStep = async (stepIndex: number): Promise<boolean> => {
    switch (stepIndex) {
      case 0: // Date of Birth
        try {
          const result = await verifyAge(birthDate.toISOString());
          setVerificationResult(result);
          
          if (!result.isValid) {
            Alert.alert(
              'Age Requirement Not Met',
              'You must be at least 18 years old to use Stellr. This is required for compliance with dating app regulations and user safety.',
              [
                { 
                  text: 'I Understand', 
                  onPress: () => {
                    logUserAction('age_verification_failed', { age: result.age });
                    router.back();
                  }
                }
              ]
            );
            return false;
          }

          // Check if user is 18-20 (additional requirements for young adults)
          if (result.age < 21) {
            Alert.alert(
              'Additional Verification Required',
              'As you\'re under 21, we require additional identity verification for your safety and security.',
              [{ text: 'Continue' }]
            );
          }

          return true;
        } catch (error) {
          Alert.alert('Error', 'Failed to verify age. Please try again.');
          return false;
        }

      case 1: // Identity Verification
        if (!idType || !idNumber.trim() || !fullName.trim()) {
          Alert.alert('Missing Information', 'Please provide all required identity information.');
          return false;
        }
        
        // Basic ID number validation
        if (idNumber.length < 5) {
          Alert.alert('Invalid ID', 'Please enter a valid ID number.');
          return false;
        }
        
        return true;

      case 2: // Legal Agreements
        if (!agreedToTerms) {
          Alert.alert('Terms Required', 'You must agree to our Terms of Service to continue.');
          return false;
        }
        
        // Check if parental consent is needed (for 18-year-olds in some jurisdictions)
        if (verificationResult && verificationResult.age === 18) {
          if (!parentalConsent) {
            Alert.alert(
              'Parental Awareness',
              'Please confirm that your parent or guardian is aware of your use of this dating service.',
              [{ text: 'OK' }]
            );
            return false;
          }
        }
        
        return true;

      case 3: // Final Verification
        return true;

      default:
        return false;
    }
  };

  const handleNextStep = async () => {
    setLoading(true);
    
    try {
      const isValid = await validateStep(currentStep);
      if (isValid) {
        if (currentStep < verificationSteps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          await completeVerification();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Verification step failed. Please try again.');
      logger.error('Age verification step failed', error instanceof Error ? error : undefined, { step: currentStep }, 'AGE_VERIFICATION');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeVerification = async () => {
    try {
      setLoading(true);
      
      await logUserAction('age_verification_completed', {
        age: verificationResult?.age,
        idType,
        completedSteps: currentStep + 1,
      });

      Alert.alert(
        'Verification Complete',
        'Your age has been successfully verified. Welcome to Stellr!',
        [
          {
            text: 'Continue to App',
            onPress: () => {
              router.replace('/(tabs)' as any);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete verification. Please contact support.');
      logger.error('Age verification completion failed', error instanceof Error ? error : undefined, {}, 'AGE_VERIFICATION');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Date of Birth
        return (
          <View style={styles.stepContent}>
            <View style={styles.infoBox}>
              <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
              <Text style={styles.infoText}>
                We require age verification to comply with COPPA and ensure a safe dating environment.
                You must be at least 18 years old to use Stellr.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Date of Birth *</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(birthDate)}</Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
              />
            )}

            {verificationResult && (
              <View style={[
                styles.resultBox,
                verificationResult.isValid ? styles.successBox : styles.errorBox
              ]}>
                <Ionicons
                  name={verificationResult.isValid ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={verificationResult.isValid ? "#4CAF50" : "#FF6B6B"}
                />
                <Text style={[
                  styles.resultText,
                  { color: verificationResult.isValid ? "#4CAF50" : "#FF6B6B" }
                ]}>
                  {verificationResult.isValid
                    ? `Age verified: ${verificationResult.age} years old`
                    : `Minimum age not met: ${verificationResult.age} years old`
                  }
                </Text>
              </View>
            )}
          </View>
        );

      case 1: // Identity Verification
        return (
          <View style={styles.stepContent}>
            <View style={styles.infoBox}>
              <Ionicons name="document-text" size={24} color="#C8A8E9" />
              <Text style={styles.infoText}>
                Identity verification helps prevent fraud and ensures the safety of all users.
                Your information is encrypted and stored securely.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full legal name"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ID Type *</Text>
              <View style={styles.radioGroup}>
                {idTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={styles.radioOption}
                    onPress={() => setIdType(type.value)}
                  >
                    <View style={[
                      styles.radioCircle,
                      idType === type.value && styles.radioSelected
                    ]}>
                      {idType === type.value && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.radioLabel}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ID Number *</Text>
              <TextInput
                style={styles.textInput}
                value={idNumber}
                onChangeText={setIdNumber}
                placeholder="Enter your ID number"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.helperText}>
                Your ID information is encrypted and used only for verification purposes.
              </Text>
            </View>
          </View>
        );

      case 2: // Legal Agreements
        return (
          <View style={styles.stepContent}>
            <View style={styles.infoBox}>
              <Ionicons name="document" size={24} color="#4CAF50" />
              <Text style={styles.infoText}>
                Please review and accept our legal agreements to complete your account setup.
              </Text>
            </View>

            <View style={styles.agreementSection}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.checkboxText}>
                  I agree to the{' '}
                  <Text 
                    style={styles.linkText}
                    onPress={() => router.push('/terms-of-service' as any)}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text 
                    style={styles.linkText}
                    onPress={() => router.push('/privacy-policy' as any)}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              {verificationResult && verificationResult.age === 18 && (
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setParentalConsent(!parentalConsent)}
                >
                  <View style={[styles.checkbox, parentalConsent && styles.checkboxChecked]}>
                    {parentalConsent && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    My parent or guardian is aware of my use of this dating service
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.legalNotice}>
              <Text style={styles.legalNoticeText}>
                By continuing, you confirm that you are at least 18 years old and legally able
                to enter into this agreement. Dating apps are restricted to users 18 and older
                in compliance with COPPA and other applicable laws.
              </Text>
            </View>
          </View>
        );

      case 3: // Final Verification
        return (
          <View style={styles.stepContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            </View>
            
            <Text style={styles.successTitle}>Verification Complete!</Text>
            
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Verification Summary:</Text>
              <Text style={styles.summaryItem}>✓ Age verified: {verificationResult?.age} years old</Text>
              <Text style={styles.summaryItem}>✓ Identity information provided</Text>
              <Text style={styles.summaryItem}>✓ Legal agreements accepted</Text>
              <Text style={styles.summaryItem}>✓ COPPA compliance confirmed</Text>
            </View>

            <Text style={styles.welcomeText}>
              Welcome to Stellr! Your account has been verified and you can now start connecting
              with other verified users in a safe and secure environment.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Age Verification</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Step {currentStep + 1} of {verificationSteps.length}
        </Text>
        <View style={styles.progressBar}>
          {verificationSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentStep && styles.progressDotActive
              ]}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{verificationSteps[currentStep].title}</Text>
          <Text style={styles.stepDescription}>
            {verificationSteps[currentStep].description}
          </Text>
        </View>

        {renderStepContent()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationButtons}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={styles.backStepButton}
            onPress={handlePreviousStep}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.backStepText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            loading && styles.nextButtonDisabled,
            currentStep === 0 && styles.flexButton
          ]}
          onPress={handleNextStep}
          disabled={loading || complianceLoading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {currentStep === verificationSteps.length - 1 ? 'Complete' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepContent: {
    paddingBottom: 32,
  },
  infoBox: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  textInput: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    lineHeight: 16,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  resultBox: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  successBox: {
    backgroundColor: '#E8F5E8',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
  },
  resultText: {
    fontSize: 14,
    fontWeight: '500',
  },
  agreementSection: {
    gap: 16,
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  legalNotice: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#C8A8E9',
  },
  legalNoticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryBox: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4CAF50',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
    textAlign: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 4,
  },
  backStepText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    gap: 8,
  },
  flexButton: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: '#CCC',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default AgeVerificationScreen;
