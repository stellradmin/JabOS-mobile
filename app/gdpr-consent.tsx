import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance, ConsentSettings } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';

interface ConsentCategory {
  id: keyof ConsentSettings;
  title: string;
  description: string;
  required: boolean;
  details: string[];
  purposes: string[];
  retention: string;
}

const GDPRConsentScreen: React.FC = () => {
  const {
    consentSettings,
    updateConsent,
    hasValidConsent,
    logUserAction,
    loading: complianceLoading,
  } = useLegalCompliance();

  const [localSettings, setLocalSettings] = useState<ConsentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    logUserAction('gdpr_consent_page_viewed');
    if (consentSettings) {
      setLocalSettings({ ...consentSettings });
    }
  }, [consentSettings]);

  const consentCategories: ConsentCategory[] = [
    {
      id: 'essential',
      title: 'Essential Cookies & Data',
      description: 'Required for the basic functionality of Stellr',
      required: true,
      details: [
        'User authentication and login sessions',
        'Account security and fraud prevention',
        'Core matching and messaging functionality',
        'Technical performance and error monitoring',
        'Legal compliance and safety features',
      ],
      purposes: [
        'Provide core dating service functionality',
        'Maintain account security',
        'Prevent fraud and ensure safety',
        'Enable communication between users',
      ],
      retention: 'Retained for account lifetime plus 30 days after deletion',
    },
    {
      id: 'analytics',
      title: 'Analytics & Performance',
      description: 'Help us understand how you use Stellr to improve our service',
      required: false,
      details: [
        'App usage statistics and feature interaction',
        'Performance metrics and crash reporting',
        'User journey and conversion tracking',
        'A/B testing for feature improvements',
        'General demographic trends (anonymized)',
      ],
      purposes: [
        'Improve app performance and reliability',
        'Understand user behavior patterns',
        'Optimize matching algorithms',
        'Test and develop new features',
      ],
      retention: 'Aggregated data retained indefinitely, individual data 24 months',
    },
    {
      id: 'marketing',
      title: 'Marketing & Communications',
      description: 'Personalized content and promotional communications',
      required: false,
      details: [
        'Email marketing and promotional campaigns',
        'Push notifications about app updates',
        'Personalized content recommendations',
        'Success stories and testimonials (with permission)',
        'Survey invitations and feedback requests',
      ],
      purposes: [
        'Send relevant promotional content',
        'Notify about new features and updates',
        'Gather feedback for service improvement',
        'Share success stories (anonymized)',
      ],
      retention: 'Marketing preferences retained until withdrawal',
    },
    {
      id: 'advertising',
      title: 'Advertising & Personalization',
      description: 'Tailored advertisements and personalized experiences',
      required: false,
      details: [
        'Targeted advertising based on interests',
        'Cross-platform advertising tracking',
        'Personalized match recommendations',
        'Custom content based on behavior',
        'Third-party advertising partners',
      ],
      purposes: [
        'Show relevant advertisements',
        'Personalize your dating experience',
        'Improve match quality and relevance',
        'Support free service through advertising',
      ],
      retention: 'Advertising profiles retained for 12 months',
    },
    {
      id: 'location',
      title: 'Location Data',
      description: 'Your location for matching and safety features',
      required: false,
      details: [
        'Approximate location for match discovery',
        'Distance calculations between users',
        'Safety features and emergency services',
        'Local event and venue recommendations',
        'Geographic analytics (aggregated)',
      ],
      purposes: [
        'Find matches near your location',
        'Enable distance-based filtering',
        'Provide safety and emergency features',
        'Recommend local dating venues',
      ],
      retention: 'Location data retained for 24 hours unless deleted sooner',
    },
  ];

  const handleConsentChange = (categoryId: keyof ConsentSettings, value: boolean) => {
    if (!localSettings) return;

    const newSettings = {
      ...localSettings,
      [categoryId]: value,
    };

    setLocalSettings(newSettings);
    setHasChanges(true);
    logUserAction('consent_setting_changed', { category: categoryId, value });
  };

  const handleSaveSettings = async () => {
    if (!localSettings || !hasChanges) return;

    try {
      setSaving(true);

      // Ensure essential consent is always true
      const settingsToSave = {
        ...localSettings,
        essential: true,
      };

      await updateConsent(settingsToSave);
      setHasChanges(false);

      Alert.alert(
        'Settings Saved',
        'Your consent preferences have been updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.',
        [{ text: 'OK' }]
      );
      logger.error('Failed to save consent settings', error instanceof Error ? error : undefined, {}, 'GDPR_CONSENT');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all consent settings to their default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const defaultSettings: ConsentSettings = {
              essential: true,
              analytics: false,
              marketing: false,
              advertising: false,
              location: false,
              updatedAt: new Date().toISOString(),
            };
            setLocalSettings(defaultSettings);
            setHasChanges(true);
            logUserAction('consent_reset_to_defaults');
          },
        },
      ]
    );
  };

  const toggleCategoryDetails = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getConsentSummary = () => {
    if (!localSettings) return '';
    const enabledCount = Object.values(localSettings).filter(Boolean).length - 1; // Subtract updatedAt
    const totalCount = Object.keys(localSettings).length - 1; // Subtract updatedAt
    return `${enabledCount} of ${totalCount} categories enabled`;
  };

  if (complianceLoading && !localSettings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading consent settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isConsentValid = hasValidConsent();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Consent</Text>
        <TouchableOpacity onPress={handleResetToDefaults} style={styles.resetButton}>
          <Ionicons name="refresh" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      {/* Consent Status */}
      <View style={[styles.statusBar, isConsentValid ? styles.validStatus : styles.expiredStatus]}>
        <Ionicons
          name={isConsentValid ? "checkmark-circle" : "warning"}
          size={20}
          color={isConsentValid ? "#4CAF50" : "#C8A8E9"}
        />
        <Text style={[styles.statusText, isConsentValid ? styles.validText : styles.expiredText]}>
          {isConsentValid 
            ? `Consent valid • ${getConsentSummary()}` 
            : 'Consent expired • Please review settings'
          }
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.introduction}>
          We respect your privacy and give you control over your data. Choose which types of data
          processing you're comfortable with. You can change these settings at any time.
        </Text>

        <View style={styles.gdprNotice}>
          <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
          <View style={styles.gdprTextContainer}>
            <Text style={styles.gdprTitle}>GDPR Compliance</Text>
            <Text style={styles.gdprText}>
              Your consent is freely given, specific, informed, and withdrawable at any time.
              We process your data lawfully and transparently.
            </Text>
          </View>
        </View>

        {consentCategories.map((category) => (
          <View key={category.id} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>
                  {category.title}
                  {category.required && <Text style={styles.requiredText}> (Required)</Text>}
                </Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
              </View>
              <Switch
                value={!!(localSettings?.[category.id])}
                onValueChange={(value) => handleConsentChange(category.id, value)}
                disabled={category.required || saving}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                thumbColor={localSettings?.[category.id] ? '#FFF' : '#FFF'}
              />
            </View>

            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => toggleCategoryDetails(category.id)}
            >
              <Text style={styles.detailsToggleText}>
                {expandedCategory === category.id ? 'Hide details' : 'Show details'}
              </Text>
              <Ionicons
                name={expandedCategory === category.id ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#007AFF"
              />
            </TouchableOpacity>

            {expandedCategory === category.id && (
              <View style={styles.categoryDetails}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Data Collection:</Text>
                  {category.details.map((detail, index) => (
                    <Text key={index} style={styles.detailItem}>• {detail}</Text>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Purposes:</Text>
                  {category.purposes.map((purpose, index) => (
                    <Text key={index} style={styles.detailItem}>• {purpose}</Text>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Retention Period:</Text>
                  <Text style={styles.detailItem}>{category.retention}</Text>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.saveButton, (!hasChanges || saving) && styles.disabledButton]}
            onPress={handleSaveSettings}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Preferences</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.learnMoreButton}
            onPress={() => router.push('/privacy-policy' as any)}
          >
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.learnMoreText}>Learn More About Privacy</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Information */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your consent choices are stored securely and can be changed at any time.
            For questions about data processing, contact privacy@stellr.app
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
  resetButton: {
    padding: 8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  validStatus: {
    backgroundColor: '#E8F5E8',
  },
  expiredStatus: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  validText: {
    color: '#2E7D32',
  },
  expiredText: {
    color: '#111827',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  introduction: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginVertical: 16,
    textAlign: 'center',
  },
  gdprNotice: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  gdprTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  gdprTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  gdprText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1976D2',
  },
  categoryCard: {
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
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  categoryInfo: {
    flex: 1,
    marginRight: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  requiredText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 4,
  },
  detailsToggleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  categoryDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailSection: {
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  detailItem: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    marginBottom: 2,
  },
  actionButtons: {
    gap: 12,
    marginVertical: 20,
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
  disabledButton: {
    backgroundColor: '#CCC',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  learnMoreButton: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  learnMoreText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default GDPRConsentScreen;
