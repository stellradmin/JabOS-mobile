/**
 * Verification Badge Component
 *
 * Displays verification status badge for verified users.
 * Used in profiles, match cards, and chat headers.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerificationBadgeProps {
  isVerified: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  style?: any;
}

const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  isVerified,
  size = 'medium',
  showLabel = false,
  style
}) => {
  if (!isVerified) return null;

  const iconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;
  const fontSize = size === 'small' ? 12 : size === 'medium' ? 14 : 16;

  return (
    <View style={[styles.container, styles[size], style]}>
      <Ionicons name="shield-checkmark" size={iconSize} color="#4CAF50" />
      {showLabel && (
        <Text style={[styles.label, { fontSize }]}>Verified</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  medium: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  large: {
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  label: {
    color: '#2E7D32',
    fontWeight: '600'
  }
});

export default VerificationBadge;
