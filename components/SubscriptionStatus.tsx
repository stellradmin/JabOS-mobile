import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSubscription } from '../src/contexts/SubscriptionContext';

interface SubscriptionStatusProps {
  showDetails?: boolean;
  style?: any;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ 
  showDetails = false, 
  style 
}) => {
  const { 
    isActive, 
    hasTicket, 
    planId, 
    currentPeriodEnd, 
    loading, 
    error,
    refresh,
    checkAccess
  } = useSubscription();

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.statusText}>Loading subscription...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasAccess = checkAccess();

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.statusIndicator, 
        { backgroundColor: hasAccess ? '#4CAF50' : '#F44336' }
      ]}>
        <Text style={styles.statusText}>
          {hasAccess ? '✓ Premium Access' : '⚠ No Access'}
        </Text>
      </View>
      
      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.detailText}>
            Subscription: {isActive ? 'Active' : 'Inactive'}
          </Text>
          {planId && (
            <Text style={styles.detailText}>
              Plan: {planId}
            </Text>
          )}
          {currentPeriodEnd && (
            <Text style={styles.detailText}>
              Expires: {currentPeriodEnd.toLocaleDateString()}
            </Text>
          )}
          <Text style={styles.detailText}>
            Ticket: {hasTicket ? 'Available' : 'None'}
          </Text>
          
          <TouchableOpacity onPress={refresh} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh Status</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 8,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  details: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  detailText: {
    fontSize: 12,
    marginBottom: 2,
    color: '#333',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
  },
  refreshButton: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#2196F3',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  refreshText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default SubscriptionStatus;