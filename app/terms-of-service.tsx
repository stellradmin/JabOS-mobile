import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance } from '../src/contexts/LegalComplianceContext';

interface ToSSection {
  id: string;
  title: string;
  content: string;
}

const TermsOfServiceScreen: React.FC = () => {
  const { logUserAction } = useLegalCompliance();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const lastUpdated = "September 7, 2025";
  const effectiveDate = "January 1, 2025";

  useEffect(() => {
    logUserAction('terms_of_service_viewed');
  }, []);

  const termsSection: ToSSection[] = [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      content: `By accessing and using Stellr ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.

Key Points:
• These terms constitute a legally binding agreement
• You must be at least 18 years old to use this service
• By creating an account, you agree to comply with all terms
• Violation of these terms may result in account termination
• These terms may be updated periodically with notice

If you do not agree to these terms, you must not use this service.`,
    },
    {
      id: 'service-description',
      title: '2. Service Description',
      content: `Stellr is a dating platform that connects users based on compatibility and shared interests.

Service Features:
• Profile creation and photo sharing
• Matching algorithm based on preferences and location
• Messaging and communication tools
• Video chat features
• Premium subscription features
• Safety and verification tools

Service Limitations:
• We do not guarantee matches or relationships
• Success depends on user participation and compatibility
• Technical limitations may affect service availability
• Geographic restrictions may apply
• Age and identity verification required`,
    },
    {
      id: 'user-accounts',
      title: '3. User Accounts and Registration',
      content: `Account Creation:
• You must provide accurate and complete information
• One account per person is allowed
• You are responsible for maintaining account security
• Fake or duplicate accounts will be terminated
• Identity verification may be required

Account Security:
• Keep your login credentials confidential
• Notify us immediately of any unauthorized use
• You are responsible for all activity under your account
• Strong passwords are required and recommended
• Two-factor authentication available for enhanced security

Account Termination:
• You may delete your account at any time
• We may suspend or terminate accounts for violations
• Termination may result in loss of data and connections
• Some data may be retained for legal compliance
• Refunds for premium services subject to refund policy`,
    },
    {
      id: 'user-conduct',
      title: '4. User Conduct and Community Guidelines',
      content: `Acceptable Use:
• Be respectful and kind to other users
• Use the service only for legitimate dating purposes
• Provide accurate information in your profile
• Report inappropriate behavior or content
• Respect others' privacy and boundaries

Prohibited Conduct:
• Harassment, abuse, or threatening behavior
• Discrimination based on race, religion, gender, or sexual orientation
• Sharing explicit or inappropriate content
• Spam, solicitation, or commercial activity
• Impersonation or misrepresentation of identity
• Use of the service for illegal activities
• Attempting to circumvent safety measures

Content Guidelines:
• Profile photos must show your face clearly
• No nudity or sexually explicit content
• No copyrighted material without permission
• No promotional or commercial content
• No misleading or false information
• Content must comply with local laws

Enforcement:
• Violations may result in warnings, suspensions, or bans
• Serious violations may be reported to authorities
• We reserve the right to remove content at our discretion
• Appeals process available for account actions`,
    },
    {
      id: 'safety-security',
      title: '5. Safety and Security',
      content: `Safety Features:
• Photo verification for authentic profiles
• Report and block functionality for all users
• 24/7 safety team monitoring
• Background checks for verified users (optional)
• Emergency assistance features

User Safety Responsibilities:
• Meet in public places for first dates
• Trust your instincts about potential matches
• Never share personal financial information
• Report suspicious or dangerous behavior immediately
• Use the in-app messaging initially
• Inform friends/family about your dating activities

Platform Security:
• End-to-end encryption for sensitive communications
• Regular security audits and updates
• Fraud detection and prevention systems
• Data protection and privacy controls
• Secure payment processing for premium features

Incident Reporting:
• Report dangerous users immediately
• Contact emergency services for immediate threats
• We cooperate fully with law enforcement
• Support available 24/7 for safety concerns`,
    },
    {
      id: 'privacy-data',
      title: '6. Privacy and Data Protection',
      content: `Data Collection:
• Profile information and preferences
• Location data for matching (approximate)
• Communication and interaction data
• Device and usage information
• Identity verification documents (if applicable)

Data Use:
• Providing and improving our services
• Facilitating matches and connections
• Ensuring safety and security
• Customer support and communication
• Legal compliance and fraud prevention

Data Sharing:
• Profile information visible to potential matches
• Limited sharing with service providers
• Legal disclosure when required by law
• No sale of personal information to third parties

User Controls:
• Privacy settings and profile visibility controls
• Data export and deletion options
• Communication preference management
• Consent withdrawal options
• GDPR and CCPA compliance tools

For detailed information, please see our Privacy Policy.`,
    },
    {
      id: 'payments-subscriptions',
      title: '7. Payments and Subscriptions',
      content: `Free Service:
• Basic matching and messaging features
• Limited daily swipes and interactions
• Standard profile visibility
• Basic safety features

Premium Subscriptions:
• Unlimited swipes and interactions
• Enhanced profile visibility and features
• Advanced matching algorithms
• Premium safety and verification features
• Priority customer support

Billing and Payments:
• Subscription fees charged in advance
• Automatic renewal unless cancelled
• Payment processed through app stores or direct billing
• Prices may vary by location and currency
• Taxes may apply based on jurisdiction

Cancellation and Refunds:
• Cancel subscription anytime through account settings
• Refunds subject to app store policies and applicable law
• No refunds for partial subscription periods
• Premium features remain active until subscription expires
• Contact support for billing disputes

Price Changes:
• Subscription prices may change with 30 days notice
• Existing subscribers grandfathered for current billing cycle
• New prices apply to subscription renewals`,
    },
    {
      id: 'intellectual-property',
      title: '8. Intellectual Property Rights',
      content: `Stellr Intellectual Property:
• Stellr owns all rights to the app, algorithms, and technology
• Trademarks and logos are protected property
• User interface and design elements are copyrighted
• Patent rights apply to matching algorithms
• No license granted except as necessary to use the service

User Content:
• You retain ownership of photos and content you upload
• By posting, you grant Stellr a license to use your content
• License includes right to display, modify, and distribute content
• License is worldwide, non-exclusive, and transferable
• Content may be used for marketing and promotional purposes

Third-Party Content:
• Some content may be licensed from third parties
• Users responsible for respecting third-party rights
• Report copyright infringement to our designated agent
• DMCA takedown procedures available
• Fair use and educational purposes may apply

Trademark Policy:
• Respect for third-party trademarks required
• No use of trademarks in usernames or profiles
• Commercial use of trademarked terms prohibited
• Report trademark violations to support`,
    },
    {
      id: 'disclaimers-limitations',
      title: '9. Disclaimers and Limitation of Liability',
      content: `Service Disclaimers:
• Service provided "as is" without warranties
• No guarantee of matches, relationships, or outcomes
• Technical issues and downtime may occur
• Accuracy of user-provided information not guaranteed
• Third-party integrations may have separate terms

Limitation of Liability:
• Stellr not liable for user interactions or meetings
• Maximum liability limited to subscription fees paid
• No liability for indirect or consequential damages
• Users assume risks of dating and meeting strangers
• Stellr not responsible for user conduct or actions

Force Majeure:
• Service interruptions due to events beyond our control
• Natural disasters, war, government actions
• Internet outages or infrastructure failures
• No liability for delays or failures due to force majeure

Indemnification:
• Users agree to indemnify Stellr against claims
• Indemnification covers user conduct and content
• Includes legal fees and damages from user violations
• Does not apply to Stellr's own negligent or unlawful actions`,
    },
    {
      id: 'dispute-resolution',
      title: '10. Dispute Resolution and Governing Law',
      content: `Governing Law:
• These terms governed by laws of California, USA
• Disputes subject to California state and federal courts
• International users subject to local consumer protection laws
• Conflicts of law principles do not apply

Dispute Resolution Process:
1. Direct communication with customer support
2. Mediation through agreed-upon mediator
3. Binding arbitration if mediation fails
4. Court action only for injunctive relief

Arbitration Terms:
• Individual arbitration only (no class actions)
• American Arbitration Association rules apply
• Arbitration conducted in San Francisco, CA
• Costs split between parties unless otherwise awarded
• Right to opt out of arbitration within 30 days of account creation

Class Action Waiver:
• No class action or collective lawsuits permitted
• Individual claims only in arbitration or court
• No consolidation of individual arbitrations
• Waiver essential element of agreement`,
    },
    {
      id: 'modifications-termination',
      title: '11. Modifications and Termination',
      content: `Terms Modifications:
• We may update these terms periodically
• Material changes require 30 days advance notice
• Continued use constitutes acceptance of new terms
• Users may terminate account if they disagree with changes
• Previous versions available upon request

Service Modifications:
• Features and functionality may change over time
• New features may require additional terms
• Some features may be discontinued with notice
• Premium features subject to change

Account Termination:
• Users may terminate accounts at any time
• We may terminate accounts for terms violations
• Termination may be immediate for serious violations
• Data deletion follows our data retention policy
• Some information retained for legal compliance

Effect of Termination:
• All rights and licenses immediately terminate
• Outstanding obligations survive termination
• Data deletion subject to legal retention requirements
• No refunds unless required by law`,
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

  const handleContactSupport = () => {
    Alert.alert(
      "Legal Support",
      "Need help with legal questions or terms?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email Legal Team",
          onPress: () => {
            logUserAction('legal_support_contacted');
            Linking.openURL('mailto:legal@stellr.app');
          },
        },
      ]
    );
  };

  const handleExpandAll = () => {
    if (expandedSections.size === termsSection.length) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(termsSection.map(section => section.id)));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <TouchableOpacity onPress={handleContactSupport} style={styles.helpButton}>
          <Ionicons name="mail-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Last Updated Info */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>Last Updated: {lastUpdated}</Text>
        <TouchableOpacity onPress={handleExpandAll}>
          <Text style={styles.expandText}>
            {expandedSections.size === termsSection.length ? "Collapse All" : "Expand All"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.introduction}>
          These Terms of Service govern your use of Stellr. Please read them carefully as they
          contain important information about your rights and obligations when using our service.
        </Text>

        <View style={styles.importantNotice}>
          <Ionicons name="warning" size={20} color="#111827" />
          <Text style={styles.noticeText}>
            By using Stellr, you agree to these terms. If you don't agree, please don't use our service.
          </Text>
        </View>

        {termsSection.map((section) => (
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
          <Text style={styles.contactTitle}>Legal Contact Information</Text>
          <Text style={styles.contactText}>
            Legal Team: legal@stellr.app{'\n'}
            General Inquiries: support@stellr.app{'\n'}
            Copyright Agent: copyright@stellr.app{'\n'}
            Mailing Address: Stellr Inc., 123 Legal Lane, San Francisco, CA 94105
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/privacy-policy' as any)}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#FFF" />
            <Text style={styles.buttonText}>View Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gdpr-requests' as any)}
          >
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>Manage Data Rights</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            These terms are effective as of {effectiveDate} and were last updated on {lastUpdated}.
            {'\n\n'}
            By continuing to use Stellr after any modifications to these terms, you agree to the updated terms.
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
    backgroundColor: '#C8A8E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '500',
  },
  expandText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
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
  importantNotice: {
    backgroundColor: '#C8A8E9',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#C8A8E9',
  },
  noticeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFF',
    marginVertical: 6,
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

export default TermsOfServiceScreen;
