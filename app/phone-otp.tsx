import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import StarField from '../components/common/StarField';

export default function PhoneOtpScreen() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const { verifyPhoneOtp, signInWithPhone, phoneAuthPending, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!phoneAuthPending) {
      router.replace('/phone-auth');
      return;
    }

    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [phoneAuthPending, router]);

  const handleOtpChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;
    setOtp(value);
    if (error) setError('');
  };

  const handleVerify = async (code?: string) => {
    const otpCode = (code ?? otp).trim();

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!phoneAuthPending) {
      setError('Phone number not found. Please start over.');
      return;
    }

    try {
      await verifyPhoneOtp(phoneAuthPending, otpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
      setOtp('');
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || !phoneAuthPending) return;

    try {
      await signInWithPhone(phoneAuthPending);
      setResendTimer(60);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  const maskedPhone = phoneAuthPending ? `(***) ***-${phoneAuthPending.slice(-4)}` : '';
  const isVerifyDisabled = loading || otp.length !== 6;

  return (
    <LinearGradient
      colors={['#1B365D', '#6B46C1']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View style={styles.keyboardContent}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'interactive'}
              bounces={false}
            >
              <View style={styles.contentWrapper}>
                <View style={styles.starLayer} pointerEvents="none">
                  <StarField variant="top" style={styles.starFieldTop} />
                  <StarField variant="bottom" style={styles.starFieldBottom} />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.title}>What is the code we sent to your mobile?</Text>
                  <Text style={styles.subtitle}>CODE · {maskedPhone}</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>ENTER CODE</Text>
                    <TextInput
                      style={styles.codeInput}
                      value={otp}
                      onChangeText={handleOtpChange}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                      autoFocus
                      onSubmitEditing={() => !isVerifyDisabled && handleVerify(otp)}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={resendTimer > 0 || loading}
                  >
                    <Text
                      style={[
                        styles.resendText,
                        (resendTimer > 0 || loading) && styles.resendTextDisabled,
                      ]}
                    >
                      {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
              </View>
            </ScrollView>

            <View style={styles.navActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.back()}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, isVerifyDisabled && styles.primaryButtonDisabled]}
                onPress={() => handleVerify(otp)}
                disabled={isVerifyDisabled}
              >
                {loading ? (
                  <ActivityIndicator color="#1B365D" />
                ) : (
                  <Text style={styles.primaryButtonText}>Next</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  keyboardContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  scroll: { flex: 1 },
  contentContainer: {
    paddingTop: 64,
    paddingBottom: 40,
  },
  contentWrapper: {
    position: 'relative',
    paddingBottom: 24,
  },
  starLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    opacity: 0.45,
  },
  starFieldTop: {
    width: '100%',
    height: 220,
    marginTop: -60,
  },
  starFieldBottom: {
    width: '100%',
    height: 220,
    marginBottom: -60,
  },
  cardContent: {
    paddingHorizontal: 4,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Geist-SemiBold',
    color: '#F5F3FF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Geist-Medium',
    color: 'rgba(245, 243, 255, 0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    letterSpacing: 1.1,
    fontFamily: 'Geist-Medium',
    color: 'rgba(245, 243, 255, 0.7)',
    marginBottom: 12,
  },
  codeInput: {
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(13, 10, 36, 0.35)',
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: 'Geist-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 243, 255, 0.55)',
  },
  resendText: {
    fontSize: 15,
    fontFamily: 'Geist-Medium',
    color: '#E2DFFF',
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: 'rgba(226, 223, 255, 0.45)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    marginTop: 16,
  },
  navActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    alignItems: 'center',
    marginRight: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: '#1B365D',
    letterSpacing: 0.6,
  },
});
