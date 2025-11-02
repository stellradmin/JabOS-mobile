/**
 * Premium Coming Soon Modal - Beta Version
 *
 * Displays during beta phase when users attempt to upgrade to premium
 * Informs users that premium features are coming soon and all features
 * are currently free for beta testers
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Crown, X } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';

interface PremiumComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: string; // e.g., "20 daily swipes", "unlimited matches"
}

export default function PremiumComingSoonModal({
  visible,
  onClose,
  feature = 'premium features'
}: PremiumComingSoonModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={COLORS.DARK_TEXT} />
          </TouchableOpacity>

          {/* Crown icon */}
          <View style={styles.iconContainer}>
            <Crown size={64} color="#C8A8E9" strokeWidth={1.5} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Premium Coming Soon!</Text>

          {/* Message */}
          <Text style={styles.message}>
            We're preparing to launch {feature} for premium members.
          </Text>
          <Text style={styles.submessage}>
            During this beta phase, all features are free for early testers like you!
          </Text>
          <Text style={styles.submessage}>
            Enjoy unlimited access and help us improve Stellr.
          </Text>

          {/* Beta badge */}
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>BETA TESTER</Text>
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
            <Text style={styles.gotItText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  iconContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  submessage: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  betaBadge: {
    backgroundColor: '#C8A8E9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 24,
    marginBottom: 24,
  },
  betaText: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: 'white',
    letterSpacing: 1,
  },
  gotItButton: {
    backgroundColor: COLORS.BLACK_CARD,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
  },
  gotItText: {
    fontSize: 17,
    fontFamily: 'Geist-Medium',
    color: 'white',
    textAlign: 'center',
  },
});
