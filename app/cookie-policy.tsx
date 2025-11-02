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
import { useLegalCompliance } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';

interface CookieCategory {
  id: string;
  title: string;
  description: string;
  required: boolean;
  cookies: CookieDetail[];
  purposes: string[];
  duration: string;
}

interface CookieDetail {
  name: string;
  purpose: string;
  duration: string;
  type: 'first-party' | 'third-party';
  provider?: string;
}

const CookiePolicyScreen: React.FC = () => {
  const {
    cookieSettings,
    updateCookieSettings,
    logUserAction,
    loading: complianceLoading,
  } = useLegalCompliance();

  const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const lastUpdated = "September 7, 2025";

  useEffect(() => {
    logUserAction('cookie_policy_viewed');
    if (cookieSettings) {
      setLocalSettings({ ...cookieSettings });
    } else {
      // Set default cookie settings
      const defaultSettings = {
        essential: true,
        performance: false,
        functionality: false,
        advertising: false,
        analytics: false,
      };
      setLocalSettings(defaultSettings);
    }
  }, [cookieSettings]);

  const cookieCategories: CookieCategory[] = [
    {
      id: 'essential',
      title: 'Strictly Necessary Cookies',
      description: 'Essential for the basic functionality of the website and cannot be disabled.',
      required: true,
      duration: 'Session to 1 year',
      purposes: [
        'User authentication and login sessions',
        'Security and fraud prevention',
        'Load balancing and performance',
        'Essential app functionality',
      ],
      cookies: [
        {
          name: 'stellr_session',
          purpose: 'Maintains user login session',
          duration: '30 days',
          type: 'first-party',
        },
        {
          name: 'stellr_csrf',
          purpose: 'Prevents cross-site request forgery attacks',
          duration: 'Session',
          type: 'first-party',
        },
        {
          name: 'stellr_auth',
          purpose: 'User authentication token',
          duration: '7 days',
          type: 'first-party',
        },
        {
          name: 'stellr_preferences',
          purpose: 'Stores user preferences and settings',
          duration: '1 year',
          type: 'first-party',
        },
      ],
    },
    {
      id: 'performance',
      title: 'Performance Cookies',
      description: 'Help us understand how you interact with our website by collecting usage information.',
      required: false,
      duration: '30 days to 2 years',
      purposes: [
        'Analyze website usage and performance',
        'Monitor page load times and errors',
        'Track user navigation patterns',
        'Optimize website functionality',
      ],
      cookies: [
        {
          name: '_ga',
          purpose: 'Google Analytics - distinguishes users',
          duration: '2 years',
          type: 'third-party',
          provider: 'Google',
        },
        {
          name: '_gat',
          purpose: 'Google Analytics - throttles request rate',
          duration: '1 minute',
          type: 'third-party',
          provider: 'Google',
        },
        {
          name: 'stellr_perf',
          purpose: 'Performance monitoring and optimization',
          duration: '30 days',
          type: 'first-party',
        },
        {
          name: '_hotjar',
          purpose: 'Hotjar analytics - user behavior tracking',
          duration: '1 year',
          type: 'third-party',
          provider: 'Hotjar',
        },
      ],
    },
    {
      id: 'functionality',
      title: 'Functionality Cookies',
      description: 'Enable enhanced functionality and personalization, such as remembering your preferences.',
      required: false,
      duration: '30 days to 1 year',
      purposes: [
        'Remember user preferences and settings',
        'Personalize content and recommendations',
        'Enable social media integrations',
        'Store user-selected options',
      ],
      cookies: [
        {
          name: 'stellr_lang',
          purpose: 'Stores preferred language setting',
          duration: '1 year',
          type: 'first-party',
        },
        {
          name: 'stellr_theme',
          purpose: 'Remembers dark/light mode preference',
          duration: '1 year',
          type: 'first-party',
        },
        {
          name: 'stellr_location',
          purpose: 'Stores location preferences for matching',
          duration: '30 days',
          type: 'first-party',
        },
        {
          name: 'fb_connect',
          purpose: 'Facebook integration functionality',
          duration: '90 days',
          type: 'third-party',
          provider: 'Facebook',
        },
      ],
    },
    {
      id: 'advertising',
      title: 'Advertising Cookies',
      description: 'Used to deliver relevant advertisements and track the effectiveness of advertising campaigns.',
      required: false,
      duration: '30 days to 13 months',
      purposes: [
        'Show relevant advertisements',
        'Prevent repeated display of ads',
        'Measure advertising effectiveness',
        'Support retargeting campaigns',
      ],
      cookies: [
        {
          name: '_fbp',
          purpose: 'Facebook Pixel - tracks conversions',
          duration: '90 days',
          type: 'third-party',
          provider: 'Facebook',
        },
        {
          name: 'google_ads',
          purpose: 'Google Ads - tracks ad performance',
          duration: '30 days',
          type: 'third-party',
          provider: 'Google',
        },
        {
          name: 'stellr_ads',
          purpose: 'Internal advertising optimization',
          duration: '90 days',
          type: 'first-party',
        },
        {
          name: '_adsystem',
          purpose: 'Ad serving and frequency capping',
          duration: '13 months',
          type: 'third-party',
          provider: 'Various',
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics Cookies',
      description: 'Help us understand user behavior and improve our services through detailed analytics.',
      required: false,
      duration: '24 hours to 2 years',
      purposes: [
        'Track user engagement and behavior',
        'Measure feature usage and adoption',
        'A/B testing and optimization',
        'Generate usage reports and insights',
      ],
      cookies: [
        {
          name: 'posthog_session',
          purpose: 'PostHog analytics - session tracking',
          duration: '30 minutes',
          type: 'third-party',
          provider: 'PostHog',
        },
        {
          name: 'amplitude_id',
          purpose: 'Amplitude - user identification',
          duration: '10 years',
          type: 'third-party',
          provider: 'Amplitude',
        },
        {
          name: 'stellr_events',
          purpose: 'Custom event tracking and analytics',
          duration: '1 year',
          type: 'first-party',
        },
        {
          name: 'mixpanel_distinct',
          purpose: 'Mixpanel - unique user tracking',
          duration: '1 year',
          type: 'third-party',
          provider: 'Mixpanel',
        },
      ],
    },
  ];

  const handleCookieSettingChange = (categoryId: string, value: boolean) => {
    const newSettings = {
      ...localSettings,
      [categoryId]: value,
    };

    setLocalSettings(newSettings);
    setHasChanges(true);
    logUserAction('cookie_setting_changed', { category: categoryId, value });
  };

  const handleSaveSettings = async () => {
    if (!hasChanges) return;

    try {
      setSaving(true);

      // Ensure essential cookies are always enabled
      const settingsToSave = {
        ...localSettings,
        essential: true,
      };

      await updateCookieSettings(settingsToSave);
      setHasChanges(false);

      Alert.alert(
        'Settings Saved',
        'Your cookie preferences have been updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.',
        [{ text: 'OK' }]
      );
      logger.error('Failed to save cookie settings', error instanceof Error ? error : undefined, {}, 'COOKIE_POLICY');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptAll = () => {
    const allEnabledSettings: Record<string, boolean> = {};
    cookieCategories.forEach(category => {
      allEnabledSettings[category.id] = true;
    });
    
    setLocalSettings(allEnabledSettings);
    setHasChanges(true);
    logUserAction('cookie_accept_all');
  };

  const handleRejectAll = () => {
    const essentialOnlySettings: Record<string, boolean> = {};
    cookieCategories.forEach(category => {
      essentialOnlySettings[category.id] = category.required;
    });
    
    setLocalSettings(essentialOnlySettings);
    setHasChanges(true);
    logUserAction('cookie_reject_all');
  };

  const toggleCategoryDetails = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getEnabledCategoriesCount = () => {
    return Object.values(localSettings).filter(Boolean).length;
  };

  if (complianceLoading && Object.keys(localSettings).length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading cookie settings...</Text>
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
        <Text style={styles.headerTitle}>Cookie Policy</Text>
        <TouchableOpacity 
          onPress={() => router.push('/gdpr-consent' as any)} 
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Settings Summary */}
      <View style={styles.summaryBar}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.summaryText}>
          {getEnabledCategoriesCount()} of {cookieCategories.length} cookie categories enabled
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.introduction}>
          We use cookies and similar technologies to provide, improve, and promote our services.
          You can control which cookies we use through the settings below.
        </Text>

        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        {/* What Are Cookies Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What are cookies?</Text>
          <Text style={styles.infoText}>
            Cookies are small text files stored on your device when you visit a website. They help
            websites remember information about your visit, making your experience more convenient
            and the website more useful to you.
          </Text>
        </View>

        {/* Cookie Categories */}
        {cookieCategories.map((category) => (
          <View key={category.id} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>
                  {category.title}
                  {category.required && <Text style={styles.requiredText}> (Required)</Text>}
                </Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
                <Text style={styles.categoryDuration}>Duration: {category.duration}</Text>
              </View>
              <Switch
                value={localSettings[category.id] ?? false}
                onValueChange={(value) => handleCookieSettingChange(category.id, value)}
                disabled={category.required || saving}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                thumbColor={localSettings[category.id] ? '#FFF' : '#FFF'}
              />
            </View>

            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => toggleCategoryDetails(category.id)}
            >
              <Text style={styles.detailsToggleText}>
                {expandedCategory === category.id ? 'Hide details' : 'Show cookie details'}
              </Text>
              <Ionicons
                name={expandedCategory === category.id ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#007AFF"
              />
            </TouchableOpacity>

            {expandedCategory === category.id && (
              <View style={styles.categoryDetails}>
                <View style={styles.purposeSection}>
                  <Text style={styles.detailSectionTitle}>Purposes:</Text>
                  {category.purposes.map((purpose, index) => (
                    <Text key={index} style={styles.detailItem}>• {purpose}</Text>
                  ))}
                </View>

                <View style={styles.cookiesSection}>
                  <Text style={styles.detailSectionTitle}>Specific Cookies:</Text>
                  {category.cookies.map((cookie, index) => (
                    <View key={index} style={styles.cookieItem}>
                      <View style={styles.cookieHeader}>
                        <Text style={styles.cookieName}>{cookie.name}</Text>
                        <View style={styles.cookieType}>
                          <Text style={styles.cookieTypeText}>{cookie.type}</Text>
                        </View>
                      </View>
                      <Text style={styles.cookiePurpose}>{cookie.purpose}</Text>
                      <View style={styles.cookieMetadata}>
                        <Text style={styles.cookieDuration}>Duration: {cookie.duration}</Text>
                        {cookie.provider && (
                          <Text style={styles.cookieProvider}>Provider: {cookie.provider}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Additional Information */}
        <View style={styles.additionalInfo}>
          <Text style={styles.additionalTitle}>Managing Cookies</Text>
          <Text style={styles.additionalText}>
            You can also manage cookies through your browser settings. Most browsers allow you to:
            {'\n'}• View and delete cookies
            {'\n'}• Block cookies from specific sites
            {'\n'}• Block all cookies (may affect functionality)
            {'\n'}• Get notified when cookies are set
          </Text>
        </View>

        <View style={styles.additionalInfo}>
          <Text style={styles.additionalTitle}>Contact Information</Text>
          <Text style={styles.additionalText}>
            For questions about our cookie policy or data practices:
            {'\n'}Email: privacy@stellr.app
            {'\n'}Data Protection Officer: dpo@stellr.app
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Action Buttons */}
      <View style={styles.actionButtons}>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleRejectAll}
            disabled={saving}
          >
            <Text style={styles.rejectButtonText}>Essential Only</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAcceptAll}
            disabled={saving}
          >
            <Text style={styles.acceptButtonText}>Accept All</Text>
          </TouchableOpacity>
        </View>

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
      </View>
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
  settingsButton: {
    padding: 8,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E3F2FD',
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
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
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
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
    marginBottom: 4,
  },
  categoryDuration: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
  purposeSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailItem: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    marginBottom: 2,
  },
  cookiesSection: {
    marginBottom: 8,
  },
  cookieItem: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cookieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cookieName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  cookieType: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  cookieTypeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '500',
  },
  cookiePurpose: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  cookieMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cookieDuration: {
    fontSize: 12,
    color: '#999',
  },
  cookieProvider: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  additionalInfo: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  additionalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  additionalText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  actionButtons: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
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
});

export default CookiePolicyScreen;