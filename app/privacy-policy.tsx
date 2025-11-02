import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';

interface PrivacySection {
  id: string;
  title: string;
  content: string;
  lastUpdated?: string;
}

const PrivacyPolicyScreen: React.FC = () => {
  const { logUserAction, exportUserData, loading: complianceLoading } = useLegalCompliance();
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const lastUpdated = "September 7, 2025";
  const effectiveDate = "January 1, 2025";

  useEffect(() => {
    logUserAction('privacy_policy_viewed');
  }, []);

  const privacySections: PrivacySection[] = [
    {
      id: 'overview',
      title: '1. Privacy Overview',
      content: `Stellr ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our dating application and related services (collectively, the "Service").

Key Points:
• We collect information to provide you with meaningful connections
• Your data is protected with industry-standard security measures  
• You have control over your privacy settings and data
• We comply with GDPR, CCPA, and other applicable privacy laws
• Your location data is used only for matching and safety features`,
    },
    {
      id: 'information-collection',
      title: '2. Information We Collect',
      content: `Personal Information:
• Profile information (name, age, photos, bio, interests)
• Contact information (email, phone number if provided)
• Identity verification data (government ID for safety verification)
• Location data (approximate location for matching)
• Dating preferences and relationship goals

Usage Information:
• App interaction data (swipes, matches, messages)
• Device information (device type, OS, app version)
• Log data (IP address, access times, error logs)
• Analytics data (feature usage, session duration)

Communication Data:
• Messages sent and received through our platform
• Report and feedback submissions

Third-Party Information:
• Social media profile data (if you choose to connect)
• Information from identity verification services
• Data from payment processors for premium features`,
    },
    {
      id: 'how-we-use',
      title: '3. How We Use Your Information',
      content: `Service Provision:
• Create and manage your dating profile
• Show your profile to potential matches
• Facilitate connections and communication
• Provide customer support and resolve disputes

Safety and Security:
• Verify user identities and prevent fraud
• Detect and prevent harassment or inappropriate behavior
• Maintain the security and integrity of our platform
• Respond to legal requests and enforce our terms

Improvement and Analytics:
• Analyze usage patterns to improve our services
• Develop new features and functionality
• Conduct research (in aggregated, anonymized form)
• Send service updates and important notifications

Marketing (with your consent):
• Send promotional emails about new features
• Personalize advertisements and content
• Conduct surveys and gather feedback`,
    },
    {
      id: 'information-sharing',
      title: '4. Information Sharing and Disclosure',
      content: `With Other Users:
• Your profile information is visible to potential matches
• Messages are shared with your conversation partners
• Match status and basic interaction data

With Service Providers:
• Cloud hosting and data storage providers
• Identity verification and background check services
• Payment processors for subscription management
• Customer support and communication tools
• Analytics and crash reporting services

Legal Requirements:
• When required by law or legal process
• To protect the safety and security of our users
• To investigate fraud or other illegal activities
• To enforce our Terms of Service

Business Transfers:
• In connection with mergers, acquisitions, or asset sales
• Data will remain subject to privacy protections

We do not sell your personal information to third parties for their marketing purposes.`,
    },
    {
      id: 'data-retention',
      title: '5. Data Retention',
      content: `Active Accounts:
• Profile data retained while your account is active
• Message history maintained for user experience
• Analytics data retained for service improvement

Inactive Accounts:
• Profile data deleted after 2 years of inactivity
• Essential data may be retained for legal compliance
• Anonymized data may be retained for research

Account Deletion:
• Most data deleted within 30 days of account deletion
• Legal compliance data retained as required
• Anonymized analytics data may be retained

Specific Retention Periods:
• Messages: Retained until account deletion or user request
• Photos: Deleted immediately upon removal from profile
• Location data: Retained for 24 hours unless deleted sooner
• Payment data: Retained as required for financial records`,
    },
    {
      id: 'your-rights',
      title: '6. Your Privacy Rights',
      content: `Access and Portability:
• View all personal information we have about you
• Download your data in a portable format
• Request copies of your information

Correction and Updates:
• Correct inaccurate or incomplete information
• Update your profile and preferences anytime
• Request corrections to data we cannot modify

Deletion Rights:
• Delete your account and associated data
• Request deletion of specific information
• Right to be forgotten (where legally applicable)

Control and Consent:
• Manage privacy and communication preferences
• Withdraw consent for data processing
• Opt out of marketing communications
• Control who can see your profile

GDPR Rights (EU Users):
• Right to object to data processing
• Right to restrict processing in certain circumstances  
• Right to lodge complaints with supervisory authorities

CCPA Rights (California Users):
• Right to know what personal information is collected
• Right to delete personal information
• Right to opt out of sale (we don't sell personal information)
• Right to non-discrimination for exercising privacy rights`,
    },
    {
      id: 'data-security',
      title: '7. Data Security',
      content: `Technical Safeguards:
• End-to-end encryption for sensitive communications
• Industry-standard encryption for data transmission
• Secure data storage with access controls
• Regular security audits and vulnerability assessments

Operational Security:
• Employee background checks and security training
• Limited access to personal data on need-to-know basis
• Multi-factor authentication for administrative access
• Regular security policy updates and reviews

Incident Response:
• 24/7 monitoring for security threats
• Rapid response procedures for data breaches
• User notification within 72 hours of confirmed breaches
• Coordination with law enforcement when appropriate

Third-Party Security:
• Vendor security assessments and contractual requirements
• Regular reviews of third-party security practices
• Compliance requirements for all service providers`,
    },
    {
      id: 'international-transfers',
      title: '8. International Data Transfers',
      content: `Global Service:
• Stellr operates globally and may transfer data internationally
• Data transfers comply with applicable privacy laws
• Appropriate safeguards implemented for international transfers

EU Data Transfers:
• Standard Contractual Clauses (SCCs) for EU data transfers
• Adequacy decisions respected where applicable
• Additional safeguards for transfers to non-adequate countries

Data Processing Locations:
• Primary data centers in the United States and Europe
• Backup and disaster recovery facilities globally
• User data processed in compliance with local laws`,
    },
    {
      id: 'childrens-privacy',
      title: '9. Children\'s Privacy (COPPA Compliance)',
      content: `Age Requirements:
• Stellr is intended for users 18 years and older
• We do not knowingly collect data from users under 18
• Age verification required during registration

Parental Rights:
• Parents may request information about data collection
• Immediate deletion if we discover underage user data
• Report suspected underage users to support@stellr.app

Verification Process:
• Identity verification required for all users
• Additional verification for users appearing underage
• Continuous monitoring for underage account creation`,
    },
    {
      id: 'policy-updates',
      title: '10. Privacy Policy Updates',
      content: `Notification of Changes:
• Users notified of material policy changes via email
• In-app notifications for significant updates
• 30-day notice period for major changes

Continued Use:
• Continued use of the service constitutes acceptance
• Users may delete accounts if they disagree with changes
• Historical versions available upon request

Version Control:
• All policy versions maintained and dated
• Change logs available for transparency
• Previous versions accessible through support`,
    },
  ];

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      Alert.alert(
        "Export Your Data",
        "This will compile all your personal data into a downloadable file. This process may take a few moments.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Export",
            onPress: async () => {
              try {
                const data = await exportUserData();
                const shareData = {
                  title: 'Stellr Data Export',
                  message: `Your Stellr data export from ${new Date().toLocaleDateString()}`,
                  url: `data:application/json;base64,${Buffer.from(JSON.stringify(data, null, 2)).toString('base64')}`,
                };
                await Share.share(shareData);
              } catch (error) {
                Alert.alert("Error", "Failed to export your data. Please try again.");
                logger.error('Failed to export user data from privacy policy', error instanceof Error ? error : undefined, {}, 'PRIVACY_POLICY');
              }
            },
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Privacy Support",
      "Need help with privacy-related questions?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email Support",
          onPress: () => {
            // This would open the email client or redirect to support
            logUserAction('privacy_support_contacted');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <TouchableOpacity onPress={handleContactSupport} style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Last Updated Info */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>Last Updated: {lastUpdated}</Text>
        <Text style={styles.infoText}>Effective: {effectiveDate}</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.introduction}>
          This Privacy Policy describes how Stellr collects, uses, and protects your information.
          Your privacy is important to us, and we're committed to transparency about our data practices.
        </Text>

        {privacySections.map((section) => (
          <View key={section.id} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.id)}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Ionicons
                name={expandedSections.has(section.id) ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
            
            {expandedSections.has(section.id) && (
              <View style={styles.sectionContent}>
                <Text style={styles.sectionText}>{section.content}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Contact Information */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Contact Information</Text>
          <Text style={styles.contactText}>
            Data Protection Officer: privacy@stellr.app{'\n'}
            General Inquiries: support@stellr.app{'\n'}
            Mailing Address: Stellr Inc., 123 Privacy Lane, San Francisco, CA 94105
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleExportData}
            disabled={loading || complianceLoading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Export My Data</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gdpr-requests' as any)}
          >
            <Ionicons name="shield-outline" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>Manage Data Rights</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This privacy policy is effective as of {effectiveDate} and was last updated on {lastUpdated}.
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
  helpButton: {
    padding: 8,
  },
  infoBar: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: 12,
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
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: '#FFF',
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#555',
  },
  contactSection: {
    backgroundColor: '#FFF',
    padding: 16,
    marginVertical: 16,
    borderRadius: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
  actionButtons: {
    gap: 12,
    marginVertical: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
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

export default PrivacyPolicyScreen;
