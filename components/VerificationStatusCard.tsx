/**
 * Verification Status Card Component
 *
 * Displays detailed verification status with actionable items.
 * Used in profile settings and onboarding screens.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PersonaVerificationStatus } from '../src/services/persona-verification-service';

interface VerificationStatusCardProps {
  status: PersonaVerificationStatus;
  onVerify?: () => void;
  onRetry?: () => void;
  style?: any;
}

const VerificationStatusCard: React.FC<VerificationStatusCardProps> = ({
  status,
  onVerify,
  onRetry,
  style
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
        return {
          icon: 'shield-checkmark',
          iconColor: '#4CAF50',
          backgroundColor: '#E8F5E9',
          title: 'Identity Verified',
          description: 'Your identity has been verified successfully.',
          actionText: null,
          action: null
        };

      case 'pending':
        return {
          icon: 'time',
          iconColor: '#FF9800',
          backgroundColor: '#FFF3E0',
          title: 'Verification Pending',
          description: 'Your verification is under review. We\'ll notify you when complete.',
          actionText: null,
          action: null
        };

      case 'in_progress':
        return {
          icon: 'hourglass',
          iconColor: '#2196F3',
          backgroundColor: '#E3F2FD',
          title: 'Verification In Progress',
          description: 'Please complete the verification process.',
          actionText: 'Continue Verification',
          action: onRetry
        };

      case 'declined':
        return {
          icon: 'close-circle',
          iconColor: '#F44336',
          backgroundColor: '#FFEBEE',
          title: 'Verification Declined',
          description: 'Your verification was declined. Please contact support for assistance.',
          actionText: 'Contact Support',
          action: () => {
            // Navigate to report-issue page for support
            const { useRouter } = require('expo-router');
            const router = useRouter();
            router.push('/report-issue');
          }
        };

      case 'failed':
        return {
          icon: 'alert-circle',
          iconColor: '#FF6B6B',
          backgroundColor: '#FFE5E5',
          title: 'Verification Failed',
          description: 'We were unable to verify your identity. Please try again.',
          actionText: 'Try Again',
          action: onRetry
        };

      case 'requires_retry':
        return {
          icon: 'refresh-circle',
          iconColor: '#9C27B0',
          backgroundColor: '#F3E5F5',
          title: 'Verification Incomplete',
          description: 'You started verification but didn\'t complete it. Try again when ready.',
          actionText: 'Retry Verification',
          action: onRetry
        };

      case 'not_started':
      default:
        return {
          icon: 'shield-outline',
          iconColor: '#757575',
          backgroundColor: '#F5F5F5',
          title: 'Not Verified',
          description: 'Complete identity verification to unlock all features and increase trust.',
          actionText: 'Verify Identity',
          action: onVerify
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }, style]}>
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon as any} size={32} color={config.iconColor} />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.description}>{config.description}</Text>

        {config.actionText && config.action && (
          <TouchableOpacity style={styles.actionButton} onPress={config.action}>
            <Text style={[styles.actionText, { color: config.iconColor }]}>
              {config.actionText}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={config.iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start'
  },
  iconContainer: {
    marginRight: 16,
    marginTop: 2
  },
  contentContainer: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600'
  }
});

export default VerificationStatusCard;
