import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance, GDPRRequest } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface GDPRAction {
  id: GDPRRequest['requestType'];
  title: string;
  description: string;
  icon: string;
  color: string;
  estimatedTime: string;
  requirements?: string[];
}

const GDPRRequestsScreen: React.FC = () => {
  const {
    submitGDPRRequest,
    getGDPRRequests,
    exportUserData,
    requestDataDeletion,
    logUserAction,
    loading: complianceLoading,
  } = useLegalCompliance();

  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  useEffect(() => {
    logUserAction('gdpr_requests_page_viewed');
    loadRequests();
  }, []);

  const gdprActions: GDPRAction[] = [
    {
      id: 'data_export',
      title: 'Export My Data',
      description: 'Download a copy of all your personal data in a portable format',
      icon: 'download-outline',
      color: '#007AFF',
      estimatedTime: '5-15 minutes',
      requirements: [
        'Account must be active for at least 24 hours',
        'Valid email address required for delivery',
        'Large exports may be split into multiple files',
      ],
    },
    {
      id: 'data_deletion',
      title: 'Delete My Account',
      description: 'Permanently delete your account and all associated data',
      icon: 'trash-outline',
      color: '#FF6B6B',
      estimatedTime: '30 days',
      requirements: [
        'This action cannot be undone',
        'All matches and conversations will be permanently deleted',
        'Premium subscriptions will be cancelled',
        'Some data may be retained for legal compliance',
      ],
    },
    {
      id: 'data_portability',
      title: 'Data Portability',
      description: 'Get your data in a machine-readable format to transfer to another service',
      icon: 'swap-horizontal-outline',
      color: '#4CAF50',
      estimatedTime: '24-48 hours',
      requirements: [
        'Data provided in JSON format',
        'Includes profile, preferences, and interaction data',
        'Photos and media files included as separate downloads',
      ],
    },
    {
      id: 'data_correction',
      title: 'Correct My Data',
      description: 'Request correction of inaccurate or incomplete personal data',
      icon: 'create-outline',
      color: '#C8A8E9',
      estimatedTime: '7-14 days',
      requirements: [
        'Provide details of the incorrect information',
        'Include evidence for the correction if available',
        'Some data may require identity verification',
      ],
    },
  ];

  const loadRequests = async () => {
    try {
      setRefreshing(true);
      const userRequests = await getGDPRRequests();
      setRequests(userRequests);
    } catch (error) {
      logger.error('Failed to load GDPR requests', error instanceof Error ? error : undefined, {}, 'GDPR_REQUESTS');
      Alert.alert('Error', 'Failed to load your requests. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmitRequest = async (requestType: GDPRRequest['requestType']) => {
    // Special handling for data export - execute immediately
    if (requestType === 'data_export') {
      return handleDataExport();
    }

    // Special handling for data deletion - show confirmation
    if ((requestType as string) === 'data_deletion') {
      return handleDeleteAccountRequest();
    }

    try {
      setProcessingRequest(requestType);

      const action = gdprActions.find(a => a.id === requestType);
      const confirmMessage = ((requestType as string) === 'data_deletion') 
        ? 'This will permanently delete your account and cannot be undone. Are you sure?'
        : `Submit a ${action?.title.toLowerCase()} request? Processing time: ${action?.estimatedTime}`;

      Alert.alert(
        'Confirm Request',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            style: ((requestType as string) === 'data_deletion') ? 'destructive' : 'default',
            onPress: async () => {
              try {
                const requestId = await submitGDPRRequest(requestType);
                Alert.alert(
                  'Request Submitted',
                  `Your ${action?.title.toLowerCase()} request has been submitted. Request ID: ${requestId}`,
                  [{ text: 'OK' }]
                );
                await loadRequests();
              } catch (error) {
                Alert.alert('Error', 'Failed to submit request. Please try again.');
              }
            },
          },
        ]
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDataExport = async () => {
    try {
      setProcessingRequest('data_export');

      Alert.alert(
        'Export Your Data',
        'This will compile all your personal data into a downloadable file. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Export',
            onPress: async () => {
              try {
                const data = await exportUserData();
                await shareExportedData(data);
              } catch (error) {
                Alert.alert('Error', 'Failed to export your data. Please try again.');
                logger.error('Data export failed', error instanceof Error ? error : undefined, {}, 'GDPR_REQUESTS');
              }
            },
          },
        ]
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  const shareExportedData = async (data: any) => {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      const fileName = `stellr_data_export_${new Date().getTime()}.json`;

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // Save to file system and share
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
  const fileUri = `${(docDir || '')}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonData);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Your Stellr Data',
          });
        } else {
          // Fallback to system share
          await Share.share({
            message: `Your Stellr data export from ${new Date().toLocaleDateString()}`,
            url: fileUri,
            title: 'Stellr Data Export',
          });
        }
      } else {
        // Web fallback
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }

      Alert.alert(
        'Export Complete',
        'Your data has been exported successfully. The file contains all your personal information in JSON format.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to share exported data. Please try again.');
      logger.error('Failed to share exported data', error instanceof Error ? error : undefined, {}, 'GDPR_REQUESTS');
    }
  };

  const handleDeleteAccountRequest = () => {
    Alert.alert(
      'Delete Account',
      'This action will permanently delete your account and all associated data. This includes:\n\n• Your profile and photos\n• All matches and conversations\n• Subscription and payment history\n• App preferences and settings\n\nThis action cannot be undone. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Last chance to change your mind. Deleting your account is irreversible.',
              [
                { text: 'Keep My Account', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setProcessingRequest('data_deletion');
                      const requestId = await requestDataDeletion();
                      Alert.alert(
                        'Deletion Request Submitted',
                        `Your account deletion request has been submitted. Request ID: ${requestId}\n\nYour account will be deleted within 30 days. You can cancel this request by contacting support before the deletion date.`,
                        [{ text: 'Understood' }]
                      );
                      await loadRequests();
                    } catch (error) {
                      Alert.alert('Error', 'Failed to submit deletion request. Please contact support.');
                    } finally {
                      setProcessingRequest(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const getStatusColor = (status: GDPRRequest['status']) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'processing':
        return '#C8A8E9';
      case 'rejected':
        return '#FF6B6B';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status: GDPRRequest['status']) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'processing':
        return 'time';
      case 'rejected':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Rights</Text>
        <TouchableOpacity onPress={loadRequests} style={styles.refreshButton}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="refresh" size={24} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Your Data Rights</Text>
          <Text style={styles.introText}>
            Under GDPR and other privacy laws, you have rights regarding your personal data.
            Use the options below to exercise these rights.
          </Text>
        </View>

        {/* GDPR Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Available Actions</Text>
          
          {gdprActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={() => handleSubmitRequest(action.id)}
              disabled={processingRequest === action.id || complianceLoading}
            >
              <View style={styles.actionHeader}>
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                  {processingRequest === action.id ? (
                    <ActivityIndicator size="small" color={action.color} />
                  ) : (
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  )}
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                  <Text style={styles.estimatedTime}>Estimated time: {action.estimatedTime}</Text>
                </View>
              </View>
              
              {action.requirements && (
                <View style={styles.requirementsSection}>
                  <Text style={styles.requirementsTitle}>Requirements:</Text>
                  {action.requirements.map((req, index) => (
                    <Text key={index} style={styles.requirementText}>• {req}</Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Request History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Request History</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : requests.length > 0 ? (
            requests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestTypeInfo}>
                    <Ionicons
                      name={getStatusIcon(request.status) as any}
                      size={20}
                      color={getStatusColor(request.status)}
                    />
                    <Text style={styles.requestType}>
                      {gdprActions.find(a => a.id === request.requestType)?.title || request.requestType}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>{request.status}</Text>
                  </View>
                </View>
                
                <View style={styles.requestMetadata}>
                  <Text style={styles.requestDate}>
                    Submitted: {formatDate(request.requestedAt)}
                  </Text>
                  {request.completedAt && (
                    <Text style={styles.requestDate}>
                      Completed: {formatDate(request.completedAt)}
                    </Text>
                  )}
                </View>
                
                <Text style={styles.requestId}>Request ID: {request.id}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#CCC" />
              <Text style={styles.emptyStateText}>No requests yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Use the actions above to exercise your data rights
              </Text>
            </View>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Need Help?</Text>
          <Text style={styles.contactText}>
            For questions about your data rights or to cancel a pending request:
            {'\n'}Email: dpo@stellr.app
            {'\n'}Phone: +1-800-STELLR-1
          </Text>
        </View>
      </ScrollView>
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
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  introSection: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginVertical: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    textAlign: 'center',
  },
  actionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 4,
  },
  estimatedTime: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  requirementsSection: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#666',
    marginBottom: 2,
  },
  historySection: {
    marginBottom: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  requestMetadata: {
    marginBottom: 6,
  },
  requestDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  requestId: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    marginTop: 4,
  },
  contactSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
});

export default GDPRRequestsScreen;
