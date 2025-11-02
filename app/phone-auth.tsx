import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhoneAuthScreen() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const { signInWithPhone, loading } = useAuth();
  const router = useRouter();

  const formatPhoneNumber = (text: string) => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');

    // Format as US number: (XXX) XXX-XXXX
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhone(formatted);
    setError('');
  };

  const getE164Phone = (formatted: string) => {
    // Convert (555) 123-4567 to +15551234567
    const digits = formatted.replace(/\D/g, '');
    return `+1${digits}`;
  };

  const handleContinue = async () => {
    const digits = phone.replace(/\D/g, '');

    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      const e164Phone = getE164Phone(phone);
      await signInWithPhone(e164Phone);
      router.push('/phone-otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    }
  };

  const isNextDisabled = loading || phone.replace(/\D/g, '').length !== 10;

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
              <View style={styles.formSection}>
                <Text style={styles.title}>Your phone number</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
                  <View style={styles.inputRow}>
                    <Text style={styles.flagLabel}>🇺🇸 +1</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="(555) 123-4567"
                      placeholderTextColor="rgba(236, 233, 255, 0.55)"
                      value={phone}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      maxLength={14}
                      returnKeyType="done"
                      autoFocus
                    />
                  </View>
                </View>

                <Text style={styles.helperText}>
                  We use this to confirm your login and make sure no one poses as you. We won't spam you or share your
                  number.
                </Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            </ScrollView>

            <View style={styles.navActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/welcome')}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, isNextDisabled && styles.primaryButtonDisabled]}
                onPress={handleContinue}
                disabled={isNextDisabled}
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
    paddingTop: 120,
    paddingBottom: 64,
  },
  formSection: {
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-SemiBold',
    color: '#F5F3FF',
    marginBottom: 32,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 243, 255, 0.3)',
    paddingBottom: 12,
  },
  flagLabel: {
    fontSize: 18,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: 'rgba(237, 233, 255, 0.75)',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Geist-Medium',
  },
  navActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
