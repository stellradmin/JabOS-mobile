// ===============================================================================
// STELLR SECURITY MONITORING DASHBOARD
// ===============================================================================
// Purpose: Real-time security monitoring and threat visualization
// Features: Live threat detection, risk assessment, compliance status
// ===============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  TouchableOpacity,
  Modal
} from 'react-native';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { supabase } from '../lib/supabase';
import { useSecurity } from '../hooks/useSecurity';
import { securityIntegration } from '../lib/security-integration';
import { securityMonitor } from '../lib/security-monitor';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// ===============================================================================
// TYPES AND INTERFACES
// ===============================================================================

interface SecurityMetrics {
  totalEvents: number;
  criticalThreats: number;
  riskScore: number;
  complianceScore: number;
  threatsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
  recentIncidents: SecurityIncident[];
  complianceStatus: ComplianceStatus;
}

interface SecurityIncident {
  id: string;
  type: string;
  severity: string;
  timestamp: string;
  description: string;
  status: 'active' | 'investigating' | 'resolved';
  riskScore: number;
}

interface ComplianceStatus {
  gdpr: {
    score: number;
    pendingRequests: number;
    overdueTasks: number;
  };
  dataRetention: {
    expiredRecords: number;
    totalRecords: number;
    compliancePercentage: number;
  };
  auditTrail: {
    integrityScore: number;
    completenessScore: number;
  };
}

interface ThreatAlert {
  id: string;
  threatType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  timestamp: string;
  userId?: string;
  indicators: string[];
  autoMitigated: boolean;
}

// ===============================================================================
// MAIN DASHBOARD COMPONENT
// ===============================================================================

export const SecurityDashboard: React.FC = () => {
  const { securityState } = useSecurity({ enableRealTimeMonitoring: true });
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [threatAlerts, setThreatAlerts] = useState<ThreatAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'overview' | 'threats' | 'compliance'>('overview');

  const screenWidth = Dimensions.get('window').width;

  // ===============================================================================
  // DATA FETCHING
  // ===============================================================================

  const fetchSecurityMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch security events summary
      const { data: events } = await supabase
        .from('security_audit_comprehensive')
        .select('event_type, event_category, severity, risk_score, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      // Fetch threat detection data
      const { data: threats } = await supabase
        .from('threat_detection_log')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      // Fetch compliance data
      const { data: complianceData } = await supabase
        .from('gdpr_compliance_dashboard')
        .select('*');

      // Process and aggregate data
      const processedMetrics = processSecurityData(events || [], threats || [], complianceData || []);
      setMetrics(processedMetrics);

      // Update threat alerts
      const alerts = threats?.map(threat => ({
        id: threat.id,
        threatType: threat.threat_type,
        severity: threat.severity,
        confidence: threat.confidence_score,
        timestamp: threat.created_at,
        userId: threat.user_id,
        indicators: threat.indicators?.indicators || [],
        autoMitigated: threat.automated_response?.includes('auto_mitigate') || false
      })) || [];

      setThreatAlerts(alerts);

    } catch (error) {
      logError('Failed to fetch security metrics:', "Error", error);
      Alert.alert('Error', 'Failed to load security metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh data
  useEffect(() => {
    fetchSecurityMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSecurityMetrics, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [fetchSecurityMetrics, autoRefresh]);

  // Real-time threat alerts
  useEffect(() => {
    if (!autoRefresh) return;

    const threatChannel = supabase
      .channel('threat-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'threat_detection_log'
      }, (payload) => {
        const newThreat = payload.new as any;
        const alert: ThreatAlert = {
          id: newThreat.id,
          threatType: newThreat.threat_type,
          severity: newThreat.severity,
          confidence: newThreat.confidence_score,
          timestamp: newThreat.created_at,
          userId: newThreat.user_id,
          indicators: newThreat.indicators?.indicators || [],
          autoMitigated: newThreat.automated_response?.includes('auto_mitigate') || false
        };

        setThreatAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts

        // Show critical threat notification
        if (alert.severity === 'CRITICAL') {
          showCriticalThreatAlert(alert);
        }
      })
      .subscribe();

    return () => {
      threatChannel.unsubscribe();
    };
  }, [autoRefresh]);

  // ===============================================================================
  // EVENT HANDLERS
  // ===============================================================================

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSecurityMetrics();
  }, [fetchSecurityMetrics]);

  const showCriticalThreatAlert = (alert: ThreatAlert) => {
    Alert.alert(
      '🚨 Critical Security Threat Detected',
      `Threat Type: ${alert.threatType}\nConfidence: ${alert.confidence}%\nTime: ${new Date(alert.timestamp).toLocaleTimeString()}`,
      [
        { text: 'View Details', onPress: () => showThreatDetails(alert) },
        { text: 'Acknowledge', style: 'default' }
      ],
      { cancelable: false }
    );
  };

  const showThreatDetails = (alert: ThreatAlert) => {
    Alert.alert(
      `Threat Details: ${alert.threatType}`,
      `Severity: ${alert.severity}\n` +
      `Confidence: ${alert.confidence}%\n` +
      `Indicators: ${alert.indicators.join(', ')}\n` +
      `Auto-Mitigated: ${alert.autoMitigated ? 'Yes' : 'No'}\n` +
      `Time: ${new Date(alert.timestamp).toLocaleString()}`,
      [{ text: 'Close' }]
    );
  };

  const handleIncidentPress = (incident: SecurityIncident) => {
    setSelectedIncident(incident);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  // ===============================================================================
  // CHART CONFIGURATIONS
  // ===============================================================================

  const chartConfig = {
    backgroundColor: '#1a1a1a',
    backgroundGradientFrom: '#2a2a2a',
    backgroundGradientTo: '#1a1a1a',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#00ff88'
    }
  };

  const threatTypeData = useMemo(() => {
    if (!metrics?.threatsByType) return [];
    
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b'];
    return Object.entries(metrics.threatsByType).map(([type, count], index) => ({
      name: type.replace(/_/g, ' ').toUpperCase(),
      population: count,
      color: colors[index % colors.length],
      legendFontColor: '#ffffff',
      legendFontSize: 12
    }));
  }, [metrics?.threatsByType]);

  const riskTrendData = useMemo(() => {
    // Mock trend data - in real implementation, this would come from historical data
    return {
      labels: ['6h', '5h', '4h', '3h', '2h', '1h', 'Now'],
      datasets: [{
        data: [20, 25, 45, 60, 40, 35, metrics?.riskScore || 0]
      }]
    };
  }, [metrics?.riskScore]);

  // ===============================================================================
  // RENDER METHODS
  // ===============================================================================

  const renderOverviewTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Security Score Cards */}
      <View style={styles.scoreCardsContainer}>
        <View style={[styles.scoreCard, { backgroundColor: getRiskColor(metrics?.riskScore || 0) }]}>
          <Text style={styles.scoreTitle}>Risk Score</Text>
          <Text style={styles.scoreValue}>{metrics?.riskScore || 0}</Text>
          <Text style={styles.scoreSubtitle}>/100</Text>
        </View>
        
        <View style={[styles.scoreCard, { backgroundColor: '#4ecdc4' }]}>
          <Text style={styles.scoreTitle}>Compliance</Text>
          <Text style={styles.scoreValue}>{metrics?.complianceScore || 0}%</Text>
          <Text style={styles.scoreSubtitle}>GDPR Ready</Text>
        </View>
      </View>

      {/* Events Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>24-Hour Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{metrics?.totalEvents || 0}</Text>
            <Text style={styles.summaryLabel}>Total Events</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#ff6b6b' }]}>{metrics?.criticalThreats || 0}</Text>
            <Text style={styles.summaryLabel}>Critical Threats</Text>
          </View>
        </View>
      </View>

      {/* Risk Trend Chart */}
      {metrics && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Risk Score Trend</Text>
          <LineChart
            data={riskTrendData}
            width={screenWidth - 40}
            height={200}
            chartConfig={chartConfig}
            bezier
          />
        </View>
      )}

      {/* Recent Incidents */}
      <View style={styles.incidentsCard}>
        <Text style={styles.cardTitle}>Recent Security Incidents</Text>
        {metrics?.recentIncidents.slice(0, 5).map(incident => (
          <TouchableOpacity 
            key={incident.id} 
            style={styles.incidentItem}
            onPress={() => handleIncidentPress(incident)}
          >
            <View style={[styles.severityIndicator, { backgroundColor: getSeverityColor(incident.severity) }]} />
            <View style={styles.incidentContent}>
              <Text style={styles.incidentType}>{incident.type}</Text>
              <Text style={styles.incidentTime}>{formatTime(incident.timestamp)}</Text>
            </View>
            <Text style={[styles.incidentStatus, getStatusStyle(incident.status)]}>{incident.status.toUpperCase()}</Text>
          </TouchableOpacity>
        )) || (
          <Text style={styles.noDataText}>No recent incidents</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderThreatsTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Threat Type Distribution */}
      {threatTypeData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Threat Types Distribution</Text>
          <PieChart
            data={threatTypeData}
            width={screenWidth - 40}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
          />
        </View>
      )}

      {/* Live Threat Alerts */}
      <View style={styles.alertsCard}>
        <View style={styles.alertsHeader}>
          <Text style={styles.cardTitle}>Live Threat Alerts</Text>
          <View style={[styles.statusIndicator, autoRefresh ? styles.activeIndicator : styles.inactiveIndicator]}>
            <Text style={styles.statusText}>{autoRefresh ? 'LIVE' : 'PAUSED'}</Text>
          </View>
        </View>
        
        {threatAlerts.slice(0, 10).map(alert => (
          <TouchableOpacity 
            key={alert.id} 
            style={styles.alertItem}
            onPress={() => showThreatDetails(alert)}
          >
            <View style={[styles.severityIndicator, { backgroundColor: getSeverityColor(alert.severity) }]} />
            <View style={styles.alertContent}>
              <Text style={styles.alertType}>{alert.threatType.replace(/_/g, ' ')}</Text>
              <Text style={styles.alertDetails}>
                Confidence: {alert.confidence}% | {formatTime(alert.timestamp)}
              </Text>
              <Text style={styles.alertIndicators}>
                {alert.indicators.slice(0, 3).join(', ')}
                {alert.indicators.length > 3 && '...'}
              </Text>
            </View>
            {alert.autoMitigated && (
              <View style={styles.mitigatedBadge}>
                <Text style={styles.mitigatedText}>AUTO</Text>
              </View>
            )}
          </TouchableOpacity>
        )) || (
          <Text style={styles.noDataText}>No recent threat alerts</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderComplianceTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* GDPR Compliance Status */}
      <View style={styles.complianceCard}>
        <Text style={styles.cardTitle}>GDPR Compliance Status</Text>
        <View style={styles.complianceGrid}>
          <View style={styles.complianceItem}>
            <Text style={styles.complianceNumber}>{metrics?.complianceStatus.gdpr.score || 0}%</Text>
            <Text style={styles.complianceLabel}>Overall Score</Text>
          </View>
          <View style={styles.complianceItem}>
            <Text style={[styles.complianceNumber, { color: '#f9ca24' }]}>
              {metrics?.complianceStatus.gdpr.pendingRequests || 0}
            </Text>
            <Text style={styles.complianceLabel}>Pending Requests</Text>
          </View>
          <View style={styles.complianceItem}>
            <Text style={[styles.complianceNumber, { color: '#ff6b6b' }]}>
              {metrics?.complianceStatus.gdpr.overdueTasks || 0}
            </Text>
            <Text style={styles.complianceLabel}>Overdue Tasks</Text>
          </View>
        </View>
      </View>

      {/* Data Retention Compliance */}
      <View style={styles.complianceCard}>
        <Text style={styles.cardTitle}>Data Retention Compliance</Text>
        <View style={styles.retentionProgress}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${metrics?.complianceStatus.dataRetention.compliancePercentage || 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {metrics?.complianceStatus.dataRetention.compliancePercentage || 0}% Compliant
          </Text>
        </View>
        <Text style={styles.retentionDetails}>
          {metrics?.complianceStatus.dataRetention.expiredRecords || 0} expired records out of{' '}
          {metrics?.complianceStatus.dataRetention.totalRecords || 0} total
        </Text>
      </View>

      {/* Audit Trail Integrity */}
      <View style={styles.complianceCard}>
        <Text style={styles.cardTitle}>Audit Trail Integrity</Text>
        <View style={styles.integrityGrid}>
          <View style={styles.integrityItem}>
            <Text style={styles.integrityScore}>
              {metrics?.complianceStatus.auditTrail.integrityScore || 0}%
            </Text>
            <Text style={styles.integrityLabel}>Integrity</Text>
          </View>
          <View style={styles.integrityItem}>
            <Text style={styles.integrityScore}>
              {metrics?.complianceStatus.auditTrail.completenessScore || 0}%
            </Text>
            <Text style={styles.integrityLabel}>Completeness</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderIncidentModal = () => (
    <Modal
      visible={!!selectedIncident}
      transparent
      animationType="slide"
      onRequestClose={() => setSelectedIncident(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Security Incident Details</Text>
          {selectedIncident && (
            <>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Type:</Text>
                <Text style={styles.modalValue}>{selectedIncident.type}</Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Severity:</Text>
                <Text style={[styles.modalValue, { color: getSeverityColor(selectedIncident.severity) }]}>
                  {selectedIncident.severity}
                </Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Risk Score:</Text>
                <Text style={styles.modalValue}>{selectedIncident.riskScore}/100</Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Status:</Text>
                <Text style={[styles.modalValue, getStatusStyle(selectedIncident.status)]}>
                  {selectedIncident.status.toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Time:</Text>
                <Text style={styles.modalValue}>
                  {new Date(selectedIncident.timestamp).toLocaleString()}
                </Text>
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Description:</Text>
                <Text style={styles.modalDescription}>{selectedIncident.description}</Text>
              </View>
            </>
          )}
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setSelectedIncident(null)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ===============================================================================
  // MAIN RENDER
  // ===============================================================================

  if (loading && !metrics) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading Security Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Security Dashboard</Text>
        <TouchableOpacity onPress={toggleAutoRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>
            {autoRefresh ? 'LIVE' : 'REFRESH'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {['overview', 'threats', 'compliance'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, viewMode === tab && styles.activeTab]}
            onPress={() => setViewMode(tab as typeof viewMode)}
          >
            <Text style={[styles.tabText, viewMode === tab && styles.activeTabText]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {viewMode === 'overview' && renderOverviewTab()}
      {viewMode === 'threats' && renderThreatsTab()}
      {viewMode === 'compliance' && renderComplianceTab()}

      {/* Incident Details Modal */}
      {renderIncidentModal()}
    </View>
  );
};

// ===============================================================================
// HELPER FUNCTIONS
// ===============================================================================

const processSecurityData = (events: any[], threats: any[], complianceData: any[]): SecurityMetrics => {
  const totalEvents = events?.length || 0;
  const criticalThreats = threats?.filter(t => t.severity === 'CRITICAL').length || 0;
  
  // Calculate risk score based on recent events
  const riskScore = Math.min(100, Math.max(0, 
    (criticalThreats * 20) + 
    (threats?.filter(t => t.severity === 'HIGH').length * 10) +
    (events?.filter(e => e.severity === 'HIGH').length * 5)
  ));

  // Process threat types
  const threatsByType: Record<string, number> = {};
  threats?.forEach(threat => {
    threatsByType[threat.threat_type] = (threatsByType[threat.threat_type] || 0) + 1;
  });

  // Process event categories
  const eventsByCategory: Record<string, number> = {};
  events?.forEach(event => {
    eventsByCategory[event.event_category] = (eventsByCategory[event.event_category] || 0) + 1;
  });

  // Create recent incidents
  const recentIncidents: SecurityIncident[] = threats?.slice(0, 10).map(threat => ({
    id: threat.id,
    type: threat.threat_type,
    severity: threat.severity,
    timestamp: threat.created_at,
    description: `${threat.threat_type} detected with ${threat.confidence_score}% confidence`,
    status: threat.response_status === 'resolved' ? 'resolved' : 'active',
    riskScore: threat.confidence_score || 0
  })) || [];

  // Mock compliance status (in real implementation, this would be calculated from actual data)
  const complianceStatus: ComplianceStatus = {
    gdpr: {
      score: 85,
      pendingRequests: complianceData?.find(d => d.metric_name === 'data_subject_requests')?.pending_count || 0,
      overdueTasks: complianceData?.find(d => d.metric_name === 'data_subject_requests')?.overdue_count || 0
    },
    dataRetention: {
      expiredRecords: 45,
      totalRecords: 1250,
      compliancePercentage: 96
    },
    auditTrail: {
      integrityScore: 98,
      completenessScore: 94
    }
  };

  return {
    totalEvents,
    criticalThreats,
    riskScore,
    complianceScore: complianceStatus.gdpr.score,
    threatsByType,
    eventsByCategory,
    recentIncidents,
    complianceStatus
  };
};

const getRiskColor = (score: number): string => {
  if (score >= 80) return '#ff6b6b';
  if (score >= 60) return '#f9ca24';
  if (score >= 40) return '#f0932b';
  return '#4ecdc4';
};

const getSeverityColor = (severity: string): string => {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return '#ff4757';
    case 'HIGH': return '#ff6b6b';
    case 'MEDIUM': return '#f9ca24';
    case 'LOW': return '#4ecdc4';
    default: return '#95a5a6';
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'active': return { color: '#ff6b6b' };
    case 'investigating': return { color: '#f9ca24' };
    case 'resolved': return { color: '#4ecdc4' };
    default: return { color: '#95a5a6' };
  }
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
};

// ===============================================================================
// STYLES
// ===============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  refreshButtonText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4ecdc4',
  },
  tabText: {
    color: '#95a5a6',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#4ecdc4',
  },
  tabContent: {
    flex: 1,
  },
  scoreCardsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  scoreCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreTitle: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreSubtitle: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.6,
  },
  summaryCard: {
    margin: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    color: '#4ecdc4',
    fontSize: 28,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#95a5a6',
    fontSize: 12,
    marginTop: 4,
  },
  chartCard: {
    margin: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  incidentsCard: {
    margin: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  incidentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  severityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  incidentContent: {
    flex: 1,
  },
  incidentType: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  incidentTime: {
    color: '#95a5a6',
    fontSize: 12,
    marginTop: 2,
  },
  incidentStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertsCard: {
    margin: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeIndicator: {
    backgroundColor: '#4ecdc4',
  },
  inactiveIndicator: {
    backgroundColor: '#95a5a6',
  },
  statusText: {
    color: '#0a0a0a',
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertType: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  alertDetails: {
    color: '#95a5a6',
    fontSize: 12,
    marginTop: 2,
  },
  alertIndicators: {
    color: '#f9ca24',
    fontSize: 11,
    marginTop: 4,
  },
  mitigatedBadge: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mitigatedText: {
    color: '#0a0a0a',
    fontSize: 10,
    fontWeight: 'bold',
  },
  complianceCard: {
    margin: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  complianceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  complianceItem: {
    alignItems: 'center',
  },
  complianceNumber: {
    color: '#4ecdc4',
    fontSize: 24,
    fontWeight: 'bold',
  },
  complianceLabel: {
    color: '#95a5a6',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  retentionProgress: {
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ecdc4',
  },
  progressText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  retentionDetails: {
    color: '#95a5a6',
    fontSize: 12,
    textAlign: 'center',
  },
  integrityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  integrityItem: {
    alignItems: 'center',
  },
  integrityScore: {
    color: '#4ecdc4',
    fontSize: 28,
    fontWeight: 'bold',
  },
  integrityLabel: {
    color: '#95a5a6',
    fontSize: 14,
    marginTop: 4,
  },
  noDataText: {
    color: '#95a5a6',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalField: {
    marginBottom: 12,
  },
  modalLabel: {
    color: '#95a5a6',
    fontSize: 12,
    marginBottom: 4,
  },
  modalValue: {
    color: '#ffffff',
    fontSize: 16,
  },
  modalDescription: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: '#4ecdc4',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  modalCloseText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default SecurityDashboard;
