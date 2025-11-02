import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';

export default function PasswordResetScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();

  const validateEmail = () => {
    if (!email.trim()) {
      setValidationError("Email is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationError("Email is invalid");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handlePasswordReset = async () => {
    if (!validateEmail()) {
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'exp://127.0.0.1:8081/--/update-password',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password reset link sent to your email.');
      router.push('/welcome');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentWrapper}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/stellr.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Forgot Password Card */}
        <View style={styles.resetCard}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Forgot Password</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Mail size={24} color="#9ca3af" />
                <TextInput
                  style={styles.textInput}
                  placeholder="your@email.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {validationError && (
                <Text style={styles.validationError}>{validationError}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.resetButton,
                loading ? styles.resetButtonLoading : null,
              ]}
              onPress={handlePasswordReset}
              disabled={loading}
            >
              <Text style={styles.resetButtonText}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity onPress={() => router.push('/welcome')} style={styles.backLinkContainer}>
          <Text style={styles.backLinkText}>Back to <Text style={styles.backLinkActionText}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Navy background
  },
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    paddingTop: 32,
    paddingBottom: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoImage: {
    width: 160,
    height: 160,
    marginBottom: 0,
    tintColor: "white",
  },
  resetCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formContainer: {
    width: '100%',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: 'black',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 20,
    color: '#1f2937',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    color: '#1f2937',
  },
  validationError: {
    color: '#ef4444',
    marginTop: 4,
  },
  resetButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#C8A8E9',
    borderWidth: 2,
    borderColor: 'black',
    marginTop: 16,
  },
  resetButtonLoading: {
    backgroundColor: '#A88BC9',
  },
  resetButtonText: {
    color: 'black',
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
    fontSize: 18,
  },
  backLinkContainer: {
    marginTop: 24,
  },
  backLinkText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
  backLinkActionText: {
    fontFamily: 'Geist-Regular',
    color: 'white',
    textDecorationLine: 'underline',
  },
});