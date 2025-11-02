import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';

interface DataCategory {
  id: string;
  name: string;
  description: string;
  retentionPeriod: string;
  autoDelete: boolean;
  canModify: boolean;
  examples: string[];
  legalBasis: string;
  lastUpdated: string;
}

interface RetentionSettings {
  autoDeleteInactive: boolean;
  inactivityPeriod: string;
  autoDeleteMessages: boolean;
  messageRetentionDays: number;
  autoDeletePhotos: boolean;
  photoRetentionDays: number;
  anonymizeAnalytics: boolean;
  analyticsRetentionDays: number;
}

const DataRetentionScreen: React.FC = () => {
  const { logUserAction, loading: complianceLoading } = useLegalCompliance();
  
  const [retentionSettings, setRetentionSettings] = useState<RetentionSettings>({
    autoDeleteInactive: true,
    inactivityPeriod: '730', // 2 years
    autoDeleteMessages: false,
    messageRetentionDays: 365,
    autoDeletePhotos: false,
    photoRetentionDays: 90,
    anonymizeAnalytics: true,
    analyticsRetentionDays: 730,
  });
  
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    logUserAction('data_retention_page_viewed');
    loadRetentionSettings();
  }, []);

  const dataCategories: DataCategory[] = [
    {
      id: 'profile_data',
      name: 'Profile Information',
      description: 'Your basic profile information, photos, and preferences',
      retentionPeriod: 'Account lifetime + 30 days after deletion',
      autoDelete: true,
      canModify: false,
      legalBasis: 'Contract performance and legitimate interests',
      lastUpdated: '2025-09-07',
      examples: [
        'Profile photos and descriptions',
        'Age, location, and basic demographics',
        'Dating preferences and interests',
        'Account settings and preferences',
      ],
    },
    {
      id: 'communication_data',
      name: 'Messages & Communications',
      description: 'Chat messages and photo attachments',
      retentionPeriod: 'Configurable: 90 days to indefinite',
      autoDelete: false,
      canModify: true,
      legalBasis: 'Contract performance and user consent',
      lastUpdated: '2025-09-07',
      examples: [
        'Text messages between users',
        'Photo attachments',
        'Emoji reactions and read receipts',
      ],
    },
    {
      id: 'location_data',
      name: 'Location Information',
      description: 'Approximate location for matching and safety',
      retentionPeriod: '24 hours (unless manually deleted sooner)',
      autoDelete: true,
      canModify: false,
      legalBasis: 'Contract performance and legitimate interests',
      lastUpdated: '2025-09-07',
      examples: [
        'Approximate location for matching',
        'Distance calculations',
        'Safety check-in locations',
        'Venue check-ins (if enabled)',
      ],
    },
    {
      id: 'interaction_data',
      name: 'Interaction History',
      description: 'Swipes, matches, and app usage patterns',
      retentionPeriod: 'Account lifetime + 90 days',
      autoDelete: true,
      canModify: false,
      legalBasis: 'Legitimate interests for service improvement',
      lastUpdated: '2025-09-07',
      examples: [
        'Swipe history (like/pass decisions)',
        'Match information and status',
        'App usage statistics',
        'Feature interaction data',
      ],
    },
    {
      id: 'payment_data',
      name: 'Payment Information',
      description: 'Subscription and payment history',
      retentionPeriod: '7 years (legal requirement)',
      autoDelete: true,
      canModify: false,
      legalBasis: 'Legal obligation and contract performance',
      lastUpdated: '2025-09-07',
      examples: [
        'Subscription history and status',
        'Payment method information (tokenized)',
        'Transaction records and receipts',
        'Billing address information',
      ],
    },
    {
      id: 'safety_data',
      name: 'Safety & Security',
      description: 'Reports, blocks, and safety-related information',
      retentionPeriod: '5 years or as required by law',
      autoDelete: true,
      canModify: false,
      legalBasis: 'Legal obligation and legitimate interests',
      lastUpdated: '2025-09-07',
      examples: [
        'User reports and safety incidents',
        'Blocked user lists',
        'Identity verification records',
        'Safety check-in history',
      ],
    },
    {
      id: 'analytics_data',
      name: 'Analytics & Performance',
      description: 'Usage analytics and app performance data',
      retentionPeriod: 'Configurable: 30 days to 2 years',
      autoDelete: true,
      canModify: true,
      legalBasis: 'Legitimate interests and consent',
      lastUpdated: '2025-09-07',
      examples: [
        'App performance metrics',
        'Feature usage statistics',
        'Crash reports and error logs',
        'A/B testing data',
      ],
    },
  ];

  const loadRetentionSettings = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would load from the backend
      // For now, we'll use the default settings
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error('Failed to load retention settings', error instanceof Error ? error : undefined, {}, 'DATA_RETENTION');
      Alert.alert('Error', 'Failed to load retention settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof RetentionSettings, value: boolean | number) => {
    setRetentionSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
    logUserAction('retention_setting_changed', { setting: key, value });
  };

  const handleSaveSettings = async () => {
    if (!hasChanges) return;

    try {
      setLoading(true);
      
      Alert.alert(
        'Save Retention Settings',
        'These changes will affect how long your data is stored. Are you sure you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Changes',
            onPress: async () => {
              try {
                // In a real implementation, this would save to the backend
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                setHasChanges(false);
                await logUserAction('retention_settings_saved', { settings: retentionSettings });
                
                Alert.alert(
                  'Settings Saved',
                  'Your data retention preferences have been updated successfully.',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert('Error', 'Failed to save settings. Please try again.');
                logger.error('Failed to save retention settings', error instanceof Error ? error : undefined, {}, 'DATA_RETENTION');
              }
            },
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDeletion = (categoryId: string) => {
    const category = dataCategories.find(c => c.id === categoryId);
    if (!category) return;

    Alert.alert(
      'Delete Data Category',
      `Request deletion of all ${category.name.toLowerCase()}? This action may affect app functionality.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            await logUserAction('data_category_deletion_requested', { category: categoryId });
            Alert.alert(
              'Deletion Requested',
              'Your request has been submitted. You will receive confirmation once the data has been deleted.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const formatRetentionPeriod = (days: number) => {
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  };

  const getRetentionColor = (canModify: boolean, autoDelete: boolean) => {
    if (!canModify) return '#C8A8E9';
    return autoDelete ? '#4CAF50' : '#666';
  };

  if (loading && !hasChanges) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading retention settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Retention</Text>
        <TouchableOpacity onPress={() => router.push('/gdpr-requests' as any)} style={styles.requestsButton}>
          <Ionicons name="document-text-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Data Retention Policy</Text>
          <Text style={styles.introText}>
            We automatically delete your data according to our retention policies and legal requirements.
            You can customize some retention settings to better control your data.
          </Text>
        </View>

        {/* Retention Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Retention Settings</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto-Delete Inactive Account</Text>
                <Text style={styles.settingDescription}>
                  Automatically delete account after {formatRetentionPeriod(parseInt(retentionSettings.inactivityPeriod))} of inactivity
                </Text>
              </View>
              <Switch
                value={retentionSettings.autoDeleteInactive}
                onValueChange={(value) => handleSettingChange('autoDeleteInactive', value)}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto-Delete Messages</Text>
                <Text style={styles.settingDescription}>
                  Automatically delete messages after {retentionSettings.messageRetentionDays} days
                </Text>
              </View>
              <Switch
                value={retentionSettings.autoDeleteMessages}
                onValueChange={(value) => handleSettingChange('autoDeleteMessages', value)}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto-Delete Photos</Text>
                <Text style={styles.settingDescription}>
                  Automatically delete removed photos after {retentionSettings.photoRetentionDays} days
                </Text>
              </View>
              <Switch
                value={retentionSettings.autoDeletePhotos}
                onValueChange={(value) => handleSettingChange('autoDeletePhotos', value)}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Anonymize Analytics Data</Text>
                <Text style={styles.settingDescription}>
                  Anonymize analytics data after {formatRetentionPeriod(retentionSettings.analyticsRetentionDays)}
                </Text>
              </View>
              <Switch
                value={retentionSettings.anonymizeAnalytics}
                onValueChange={(value) => handleSettingChange('anonymizeAnalytics', value)}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              />
            </View>
          </View>
        </View>

        {/* Data Categories */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Data Categories & Retention</Text>
          
          {dataCategories.map((category) => (
            <View key={category.id} style={styles.categoryCard}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategoryExpansion(category.id)}
              >
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                  <View style={styles.categoryMetadata}>
                    <View style={[
                      styles.retentionBadge,
                      { backgroundColor: `${getRetentionColor(category.canModify, category.autoDelete)}20` }
                    ]}>
                      <Text style={[
                        styles.retentionText,
                        { color: getRetentionColor(category.canModify, category.autoDelete) }
                      ]}>
                        {category.retentionPeriod}
                      </Text>
                    </View>
                    {category.autoDelete && (
                      <View style={styles.autoDeleteBadge}>
                        <Ionicons name="time" size={12} color="#4CAF50" />
                        <Text style={styles.autoDeleteText}>Auto-delete</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.categoryActions}>
                  {category.canModify && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRequestDeletion(category.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                  <Ionicons
                    name={expandedCategory === category.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {expandedCategory === category.id && (
                <View style={styles.categoryDetails}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Data Examples:</Text>
                    {category.examples.map((example, index) => (
                      <Text key={index} style={styles.detailItem}>• {example}</Text>
                    ))}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Legal Basis:</Text>
                    <Text style={styles.detailText}>{category.legalBasis}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Last Updated:</Text>
                    <Text style={styles.detailText}>
                      {new Date(category.lastUpdated).toLocaleDateString()}
                    </Text>
                  </View>

                  {!category.canModify && (
                    <View style={styles.restrictionNotice}>
                      <Ionicons name="lock-closed" size={16} color="#C8A8E9" />
                      <Text style={styles.restrictionText}>
                        This data category cannot be modified due to legal requirements
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Information Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>Important Information</Text>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark" size={20} color="#007AFF" />
            <Text style={styles.infoItemText}>
              Some data must be retained for legal compliance (e.g., payment records for 7 years)
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="refresh" size={20} color="#4CAF50" />
            <Text style={styles.infoItemText}>
              Data marked for auto-deletion is permanently removed at scheduled intervals
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="download" size={20} color="#C8A8E9" />
            <Text style={styles.infoItemText}>
              You can export your data before deletion through our GDPR tools
            </Text>
          </View>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <View style={styles.saveSection}>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSaveSettings}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  requestsButton: {
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
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  categoriesSection: {
    marginBottom: 24,
  },
  categoryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  categoryInfo: {
    flex: 1,
    marginRight: 16,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  categoryMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retentionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  retentionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  autoDeleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
  },
  autoDeleteText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
  categoryDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailSection: {
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  detailItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
    lineHeight: 18,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  restrictionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginTop: 8,
  },
  restrictionText: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    lineHeight: 16,
  },
  infoSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  infoItemText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  saveSection: {
    marginBottom: 32,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#CCC',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DataRetentionScreen;
