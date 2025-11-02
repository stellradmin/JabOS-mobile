/**
 * Monitoring Dashboard Component for Stellr Dating App
 * 
 * Purpose: Comprehensive monitoring dashboard for development and admin use
 * Security: Respects user consent and privacy settings
 * Features: Real-time metrics, alerts, recommendations, system health
 * 
 * Architecture: Follows the 10 Golden Code Principles
 * - Clear separation of concerns
 * - Responsive and accessible design
 * - Error boundaries for robustness
 * - Privacy-compliant by design
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  AccessibilityInfo
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnifiedMonitoring } from '../hooks/useUnifiedMonitoring';
import ErrorBoundary from './ErrorBoundary';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import type { 
  MonitoringDashboard as DashboardType,
  Alert as MonitoringAlert,
  Recommendation 
} from '../services/unified-monitoring-service';

// ===============================================================================
// TYPES
// ===============================================================================

interface DashboardProps {
  isVisible: boolean;
  onClose: () => void;
  adminMode?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'healthy' | 'warning' | 'error';
  onPress?: () => void;
}

interface AlertCardProps {
  alert: MonitoringAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onImplement?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

// ===============================================================================
// UTILITY FUNCTIONS
// ===============================================================================

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return '#FF4444';
    case 'high': return '#FF8800';
    case 'medium': return '#FFBB00';
    case 'low': return '#00AA44';
    default: return '#666666';
  }
};

const getHealthColor = (health: string): string => {
  switch (health) {
    case 'healthy': return '#00AA44';
    case 'degraded': return '#FFBB00';
    case 'unhealthy': return '#FF8800';
    case 'critical': return '#FF4444';
    default: return '#666666';
  }
};

// ===============================================================================
// SUB-COMPONENTS
// ===============================================================================

/**
 * Metric card component
 * Principle 1: Single Responsibility - Displays one metric
 */
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  status = 'healthy',
  onPress
}) => {
  const statusColor = status === 'healthy' ? '#00AA44' : 
                     status === 'warning' ? '#FFBB00' : '#FF4444';

  return (
    <TouchableOpacity 
      style={[styles.metricCard, { borderLeftColor: statusColor }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`}
      accessibilityHint={onPress ? "Tap to view details" : undefined}
    >
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={[styles.metricValue, { color: statusColor }]}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </Text>
      {subtitle && (
        <Text style={styles.metricSubtitle}>{subtitle}</Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * Alert card component
 * Principle 2: Meaningful Names - Clear component purpose
 */
const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onAcknowledge,
  onResolve
}) => {
  const severityColor = getSeverityColor(alert.severity);

  return (
    <View style={[styles.alertCard, { borderLeftColor: severityColor }]}>
      <View style={styles.alertHeader}>
        <Text style={[styles.alertTitle, { color: severityColor }]}>
          {alert.title}
        </Text>
        <Text style={styles.alertTime}>
          {new Date(alert.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      
      <Text style={styles.alertDescription}>{alert.description}</Text>
      <Text style={styles.alertImpact}>Impact: {alert.businessImpact}</Text>
      
      {alert.recommendedAction && (
        <Text style={styles.alertAction}>
          Recommended: {alert.recommendedAction}
        </Text>
      )}

      <View style={styles.alertButtons}>
        {alert.status === 'active' && (
          <TouchableOpacity
            style={[styles.alertButton, styles.acknowledgeButton]}
            onPress={() => onAcknowledge(alert.id)}
            accessibilityRole="button"
            accessibilityLabel="Acknowledge alert"
          >
            <Text style={styles.alertButtonText}>Acknowledge</Text>
          </TouchableOpacity>
        )}
        
        {alert.status !== 'resolved' && (
          <TouchableOpacity
            style={[styles.alertButton, styles.resolveButton]}
            onPress={() => onResolve(alert.id)}
            accessibilityRole="button"
            accessibilityLabel="Resolve alert"
          >
            <Text style={styles.alertButtonText}>Resolve</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Recommendation card component
 * Principle 3: Small, Focused Functions - Single purpose component
 */
const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onImplement,
  onDismiss
}) => {
  const priorityColor = getSeverityColor(recommendation.priority);

  return (
    <View style={[styles.recommendationCard, { borderLeftColor: priorityColor }]}>
      <Text style={[styles.recommendationTitle, { color: priorityColor }]}>
        {recommendation.title}
      </Text>
      <Text style={styles.recommendationCategory}>
        {recommendation.category.replace('_', ' ').toUpperCase()}
      </Text>
      
      <Text style={styles.recommendationDescription}>
        {recommendation.description}
      </Text>
      
      <Text style={styles.recommendationImpact}>
        Expected Impact: {recommendation.estimatedImpact}
      </Text>
      
      <Text style={styles.recommendationImplementation}>
        Implementation: {recommendation.implementation}
      </Text>

      <View style={styles.recommendationButtons}>
        {onImplement && (
          <TouchableOpacity
            style={[styles.recommendationButton, styles.implementButton]}
            onPress={() => onImplement(recommendation.id)}
            accessibilityRole="button"
            accessibilityLabel="Implement recommendation"
          >
            <Text style={styles.recommendationButtonText}>Implement</Text>
          </TouchableOpacity>
        )}
        
        {onDismiss && (
          <TouchableOpacity
            style={[styles.recommendationButton, styles.dismissButton]}
            onPress={() => onDismiss(recommendation.id)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss recommendation"
          >
            <Text style={styles.recommendationButtonText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ===============================================================================
// MAIN COMPONENT
// ===============================================================================

/**
 * Main monitoring dashboard component
 * Principle 4: Separation of Concerns - Dashboard logic separate from monitoring logic
 */
export const MonitoringDashboard: React.FC<DashboardProps> = ({
  isVisible,
  onClose,
  adminMode = false
}) => {
  const [monitoringState, monitoringActions] = useUnifiedMonitoring({
    screenName: 'MonitoringDashboard',
    feature: 'admin_dashboard',
    trackScreenTime: true,
    trackPerformance: true
  });

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'alerts' | 'recommendations' | 'privacy'>('overview');
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  // Check screen reader status
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);
    
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled
    );
    
    return () => subscription?.remove();
  }, []);

  /**
   * Refreshes dashboard data
   * Principle 6: Fail Fast & Defensive - Error handling for data refresh
   */
  const refreshDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Measure refresh performance
      await monitoringActions.measurePerformance(
        async () => {
          // Dashboard refresh logic would go here
          await new Promise(resolve => setTimeout(resolve, 1000));
        },
        'dashboard_refresh'
      );
      
    } catch (error) {
      logError('Dashboard refresh failed:', "Error", error);
      monitoringActions.trackError(error as Error, {
        component: 'MonitoringDashboard',
        action: 'refresh',
        recovered: false,
        userImpact: 'minimal'
      });
      
      Alert.alert('Error', 'Failed to refresh dashboard data');
    } finally {
      setRefreshing(false);
    }
  }, [monitoringActions]);

  /**
   * Handles alert acknowledgment
   */
  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    try {
      // In a real implementation, this would call the monitoring service
      logDebug('Acknowledging alert:', "Debug", alertId);
      
      monitoringActions.trackCustomEvent('alert_acknowledged', {
        alertId,
        adminMode
      });

    } catch (error) {
      logError('Failed to acknowledge alert:', "Error", error);
    }
  }, [monitoringActions, adminMode]);

  /**
   * Handles alert resolution
   */
  const handleResolveAlert = useCallback((alertId: string) => {
    try {
      logDebug('Resolving alert:', "Debug", alertId);
      
      monitoringActions.trackCustomEvent('alert_resolved', {
        alertId,
        adminMode
      });

    } catch (error) {
      logError('Failed to resolve alert:', "Error", error);
    }
  }, [monitoringActions, adminMode]);

  /**
   * Handles recommendation implementation
   */
  const handleImplementRecommendation = useCallback((recommendationId: string) => {
    Alert.alert(
      'Implement Recommendation',
      'This would open the implementation guide or trigger the automated implementation.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Proceed', 
          onPress: () => {
            monitoringActions.trackConversion('recommendation_implemented', 1);
            monitoringActions.trackCustomEvent('recommendation_implemented', {
              recommendationId,
              adminMode
            });
          }
        }
      ]
    );
  }, [monitoringActions, adminMode]);

  // Don't render if not visible or not initialized
  if (!isVisible || !monitoringState.isInitialized) {
    return null;
  }

  const dashboard = monitoringState.dashboard;
  if (!dashboard) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Dashboard Error: {error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshDashboard}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Monitoring Dashboard</Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close dashboard"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* System Health */}
        <View style={styles.healthContainer}>
          <Text style={styles.healthLabel}>System Health</Text>
          <View style={[
            styles.healthIndicator,
            { backgroundColor: getHealthColor(dashboard.systemHealth) }
          ]} />
          <Text style={[
            styles.healthText,
            { color: getHealthColor(dashboard.systemHealth) }
          ]}>
            {dashboard.systemHealth.toUpperCase()}
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {(['overview', 'alerts', 'recommendations', 'privacy'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                selectedTab === tab && styles.activeTab
              ]}
              onPress={() => setSelectedTab(tab)}
              accessibilityRole="button"
              accessibilityLabel={`${tab} tab`}
              accessibilityState={{ selected: selectedTab === tab }}
            >
              <Text style={[
                styles.tabText,
                selectedTab === tab && styles.activeTabText
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshDashboard}
              tintColor="#007AFF"
            />
          }
          accessibilityLabel="Dashboard content"
        >
          {selectedTab === 'overview' && (
            <View style={styles.tabContent}>
              {/* Business Metrics */}
              <Text style={styles.sectionTitle}>Business Metrics</Text>
              <View style={styles.metricsGrid}>
                <MetricCard
                  title="Profile Views"
                  value={dashboard.businessMetrics.profileViews}
                  subtitle="Today"
                  status="healthy"
                />
                <MetricCard
                  title="Matches"
                  value={dashboard.businessMetrics.matchCount}
                  subtitle="This week"
                  status="healthy"
                />
                <MetricCard
                  title="Messages"
                  value={dashboard.businessMetrics.messagesSent}
                  subtitle="Active conversations"
                  status="healthy"
                />
                <MetricCard
                  title="Session Time"
                  value={formatDuration(dashboard.businessMetrics.sessionDuration)}
                  subtitle="Average"
                  status="healthy"
                />
              </View>

              {/* Performance Metrics */}
              <Text style={styles.sectionTitle}>Performance</Text>
              <View style={styles.metricsGrid}>
                <MetricCard
                  title="App Start"
                  value={formatDuration(dashboard.performanceMetrics.appStartTime)}
                  status={dashboard.performanceMetrics.appStartTime > 5000 ? 'warning' : 'healthy'}
                />
                <MetricCard
                  title="Memory"
                  value={`${Math.round(dashboard.performanceMetrics.memoryUsage)}MB`}
                  status={dashboard.performanceMetrics.memoryUsage > 512 ? 'error' : 'healthy'}
                />
                <MetricCard
                  title="API Avg"
                  value={formatDuration(
                    Object.values(dashboard.performanceMetrics.apiResponseTimes)
                      .reduce((sum, time) => sum + time, 0) / 
                    Object.keys(dashboard.performanceMetrics.apiResponseTimes).length || 0
                  )}
                  status="healthy"
                />
              </View>

              {/* Feature Metrics */}
              <Text style={styles.sectionTitle}>Feature Usage</Text>
              <View style={styles.metricsGrid}>
                <MetricCard
                  title="Unmatches"
                  value={dashboard.featureMetrics.unmatch.totalUnmatches}
                  subtitle={`${((dashboard.featureMetrics.unmatch.unmatchErrorRate) * 100).toFixed(1)}% error rate`}
                  status={dashboard.featureMetrics.unmatch.unmatchErrorRate > 0.1 ? 'warning' : 'healthy'}
                />
                <MetricCard
                  title="Message Errors"
                  value={dashboard.featureMetrics.errorHandling.totalErrors}
                  subtitle={`${(dashboard.featureMetrics.errorHandling.errorRecoveryRate * 100).toFixed(1)}% recovered`}
                  status={dashboard.featureMetrics.errorHandling.errorRecoveryRate < 0.8 ? 'warning' : 'healthy'}
                />
                <MetricCard
                  title="Accessibility"
                  value={dashboard.featureMetrics.accessibility.screenReaderUsage}
                  subtitle="Screen reader users"
                  status="healthy"
                />
              </View>
            </View>
          )}

          {selectedTab === 'alerts' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>
                Active Alerts ({dashboard.activeAlerts.length})
              </Text>
              {dashboard.activeAlerts.length === 0 ? (
                <Text style={styles.emptyText}>No active alerts</Text>
              ) : (
                dashboard.activeAlerts.map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={handleAcknowledgeAlert}
                    onResolve={handleResolveAlert}
                  />
                ))
              )}
            </View>
          )}

          {selectedTab === 'recommendations' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>
                Recommendations ({dashboard.recommendations.length})
              </Text>
              {dashboard.recommendations.length === 0 ? (
                <Text style={styles.emptyText}>No recommendations available</Text>
              ) : (
                dashboard.recommendations.map(recommendation => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onImplement={adminMode ? handleImplementRecommendation : undefined}
                  />
                ))
              )}
            </View>
          )}

          {selectedTab === 'privacy' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Privacy & Compliance</Text>
              
              <View style={styles.privacyCard}>
                <Text style={styles.privacyTitle}>Compliance Status</Text>
                <View style={styles.privacyRow}>
                  <Text style={styles.privacyLabel}>GDPR Compliant:</Text>
                  <Text style={[
                    styles.privacyValue,
                    { color: dashboard.privacyCompliance.gdprCompliant ? '#00AA44' : '#FF4444' }
                  ]}>
                    {dashboard.privacyCompliance.gdprCompliant ? 'Yes' : 'No'}
                  </Text>
                </View>
                <View style={styles.privacyRow}>
                  <Text style={styles.privacyLabel}>CCPA Compliant:</Text>
                  <Text style={[
                    styles.privacyValue,
                    { color: dashboard.privacyCompliance.ccpaCompliant ? '#00AA44' : '#FF4444' }
                  ]}>
                    {dashboard.privacyCompliance.ccpaCompliant ? 'Yes' : 'No'}
                  </Text>
                </View>
                <View style={styles.privacyRow}>
                  <Text style={styles.privacyLabel}>Encryption:</Text>
                  <Text style={[
                    styles.privacyValue,
                    { color: dashboard.privacyCompliance.encryptionStatus === 'enabled' ? '#00AA44' : '#FF4444' }
                  ]}>
                    {dashboard.privacyCompliance.encryptionStatus}
                  </Text>
                </View>
                <View style={styles.privacyRow}>
                  <Text style={styles.privacyLabel}>Anonymization:</Text>
                  <Text style={styles.privacyValue}>
                    {dashboard.privacyCompliance.anonymizationLevel}
                  </Text>
                </View>
              </View>

              {dashboard.privacyCompliance.userConsent && (
                <View style={styles.privacyCard}>
                  <Text style={styles.privacyTitle}>User Consent</Text>
                  <View style={styles.privacyRow}>
                    <Text style={styles.privacyLabel}>Analytics:</Text>
                    <Text style={styles.privacyValue}>
                      {dashboard.privacyCompliance.userConsent.analytics ? 'Granted' : 'Denied'}
                    </Text>
                  </View>
                  <View style={styles.privacyRow}>
                    <Text style={styles.privacyLabel}>Performance:</Text>
                    <Text style={styles.privacyValue}>
                      {dashboard.privacyCompliance.userConsent.performance ? 'Granted' : 'Denied'}
                    </Text>
                  </View>
                  <View style={styles.privacyRow}>
                    <Text style={styles.privacyLabel}>Marketing:</Text>
                    <Text style={styles.privacyValue}>
                      {dashboard.privacyCompliance.userConsent.marketing ? 'Granted' : 'Denied'}
                    </Text>
                  </View>
                  <Text style={styles.consentDate}>
                    Consent recorded: {new Date(dashboard.privacyCompliance.userConsent.consentDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

// ===============================================================================
// STYLES
// ===============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666666',
  },
  healthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
  },
  healthLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 10,
  },
  healthIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  healthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    margin: 5,
    borderLeftWidth: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricTitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 5,
  },
  metricSubtitle: {
    fontSize: 11,
    color: '#999999',
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alertTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  alertTime: {
    fontSize: 12,
    color: '#999999',
  },
  alertDescription: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
  },
  alertImpact: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  alertAction: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  alertButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  acknowledgeButton: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFBB00',
  },
  resolveButton: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#00AA44',
  },
  alertButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  recommendationCategory: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 10,
    fontWeight: '500',
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 10,
  },
  recommendationImpact: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 5,
  },
  recommendationImplementation: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  recommendationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  recommendationButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  implementButton: {
    backgroundColor: '#007AFF',
  },
  dismissButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  recommendationButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  privacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 15,
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  privacyLabel: {
    fontSize: 14,
    color: '#333333',
  },
  privacyValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  consentDate: {
    fontSize: 12,
    color: '#666666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 50,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MonitoringDashboard;
