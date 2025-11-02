import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { AlertCircle, Clock, Heart } from 'lucide-react-native';

interface MatchLimitModalProps {
  isVisible: boolean;
  onClose: () => void;
  limitType: 'active_matches' | 'hourly' | 'daily';
  message: string;
}

export default function MatchLimitModal({ 
  isVisible, 
  onClose, 
  limitType,
  message 
}: MatchLimitModalProps) {
  
  const getIcon = () => {
    switch (limitType) {
      case 'active_matches':
        return <Heart size={48} color="#C8A8E9" />;
      case 'hourly':
        return <Clock size={48} color="#C8A8E9" />;
      case 'daily':
        return <AlertCircle size={48} color="#C8A8E9" />;
      default:
        return <AlertCircle size={48} color="#C8A8E9" />;
    }
  };

  const getTitle = () => {
    switch (limitType) {
      case 'active_matches':
        return 'Match Limit Reached';
      case 'hourly':
        return 'Take a Break';
      case 'daily':
        return 'Daily Limit Reached';
      default:
        return 'Limit Reached';
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          
          <Text style={styles.title}>{getTitle()}</Text>
          
          <Text style={styles.message}>{message}</Text>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
    marginBottom: 24,
    color: '#4a4a4a',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#C8A8E9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: 'black',
  },
});