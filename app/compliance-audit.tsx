import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLegalCompliance, AuditLogEntry } from '../src/contexts/LegalComplianceContext';
import { logger } from '../src/utils/logger';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface ComplianceMetrics {
  totalActions: number;
  consentUpdates: number;
  dataRequests: number;
  securityEvents: number;
  lastAuditDate: string;
  complianceScore: number;
}

interface FilterOptions {
  dateRange: 'today' | 'week' | 'month' | 'all';
  actionType: 'all' | 'consent' | 'data_access' | 'security' | 'privacy';
  sortOrder: 'newest' | 'oldest';
}

const ComplianceAuditScreen: React.FC = () => {
  const { logUserAction, loading: complianceLoading } = useLegalCompliance();
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [metrics, setMetrics] = useState<ComplianceMetrics>({
    totalActions: 0,
    consentUpdates: 0,
    dataRequests: 0,
    securityEvents: 0,
    lastAuditDate: new Date().toISOString(),
    complianceScore: 95,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'month',
    actionType: 'all',
    sortOrder: 'newest',
  });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    logUserAction('compliance_audit_viewed');
    loadAuditData();
  }, [filters]);

  // Mock audit log data - in production, this would come from your backend
  const mockAuditLogs: AuditLogEntry[] = [
    {
      id: '1',
      userId: 'user123',
      action: 'consent_updated',
      details: {
        consentType: 'analytics',
        previousValue: false,
        newValue: true,
        source: 'gdpr_consent_page',
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      ipAddress: '192.168.1.1',
      userAgent: 'Stellr-iOS/1.0',
    },
    {
      id: '2',
      userId: 'user123',
      action: 'data_export_requested',
      details: {
        requestType: 'full_export',
        fileSize: 1024000,
        format: 'json',
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      ipAddress: '192.168.1.1',
      userAgent: 'Stellr-iOS/1.0',
    },
    {
      id: '3',
      userId: 'user123',
      action: 'privacy_policy_viewed',
      details: {
        pageSection: 'data_collection',
        timeSpent: 120,
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      ipAddress: '192.168.1.1',
      userAgent: 'Stellr-iOS/1.0',
    },
    {
      id: '4',
      userId: 'user123',
      action: 'age_verification_completed',
      details: {
        age: 25,
        verificationMethod: 'id_document',
        success: true,
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 1 week ago
      ipAddress: '192.168.1.1',
      userAgent: 'Stellr-iOS/1.0',
    },
    {
      id: '5',
      userId: 'user123',
      action: 'cookie_settings_updated',
      details: {
        analytics: true,
        advertising: false,
        functional: true,
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), // 2 weeks ago
      ipAddress: '192.168.1.1',
      userAgent: 'Stellr-iOS/1.0',
    },
  ];

  const loadAuditData = async () => {
    try {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Filter and sort mock data based on current filters
      let filteredLogs = mockAuditLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        
        // Apply date range filter
        switch (filters.dateRange) {
          case 'today':
            return logDate.toDateString() === now.toDateString();
          case 'week':
            return (now.getTime() - logDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          case 'month':
            return (now.getTime() - logDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          default:
            return true;
        }
      }).filter(log => {
        // Apply action type filter
        if (filters.actionType === 'all') return true;
        
        const actionTypeMap: Record<string, string[]> = {
          consent: ['consent_updated', 'gdpr_consent_page_viewed'],
          data_access: ['data_export_requested', 'privacy_policy_viewed'],
          security: ['age_verification_completed', 'login_attempt'],
          privacy: ['cookie_settings_updated', 'privacy_settings_changed'],
        };
        
        return actionTypeMap[filters.actionType]?.includes(log.action) || false;
      });

      // Apply sorting
      filteredLogs.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return filters.sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });

      setAuditLogs(filteredLogs);
      
      // Update metrics
      setMetrics({
        totalActions: filteredLogs.length,
        consentUpdates: filteredLogs.filter(log => log.action.includes('consent')).length,
        dataRequests: filteredLogs.filter(log => log.action.includes('data_')).length,
        securityEvents: filteredLogs.filter(log => log.action.includes('verification') || log.action.includes('security')).length,
        lastAuditDate: new Date().toISOString(),
        complianceScore: Math.min(95 + Math.floor(Math.random() * 5), 100),
      });
      
    } catch (error) {
      logger.error('Failed to load audit data', error instanceof Error ? error : undefined, {}, 'COMPLIANCE_AUDIT');
      Alert.alert('Error', 'Failed to load audit data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAuditData();
    setRefreshing(false);
  };

  const handleExportAuditLog = async () => {
    try {
      Alert.alert(
        'Export Audit Log',
        'Export your compliance audit trail as a downloadable file?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Export',
            onPress: async () => {
              setLoading(true);
              try {
                const exportData = {
                  exportDate: new Date().toISOString(),
                  filters,
                  metrics,
                  auditLogs: auditLogs.map(log => ({
                    ...log,
                    // Redact sensitive information
                    ipAddress: log.ipAddress ? `${log.ipAddress.split('.').slice(0, 2).join('.')}.xxx.xxx` : undefined,
                  })),
                };

                const jsonData = JSON.stringify(exportData, null, 2);
                const fileName = `stellr_audit_log_${new Date().getTime()}.json`;

                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                  const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                  const fileUri = `${docDir}${fileName}`;
                  await FileSystem.writeAsStringAsync(fileUri, jsonData);
                  
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: 'application/json',
                      dialogTitle: 'Export Compliance Audit Log',
                    });
                  }
                }

                await logUserAction('audit_log_exported', { recordCount: auditLogs.length });
                Alert.alert('Export Complete', 'Your audit log has been exported successfully.');
              } catch (error) {
                Alert.alert('Error', 'Failed to export audit log. Please try again.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      logger.error('Failed to export audit log', error instanceof Error ? error : undefined, {}, 'COMPLIANCE_AUDIT');
    }
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('consent')) return 'shield-checkmark';
    if (action.includes('data_')) return 'download';
    if (action.includes('privacy') || action.includes('policy')) return 'document-text';
    if (action.includes('verification') || action.includes('security')) return 'lock-closed';
    if (action.includes('cookie')) return 'settings';
    return 'information-circle';
  };

  const getActionColor = (action: string) => {
    if (action.includes('consent')) return '#4CAF50';
    if (action.includes('data_')) return '#007AFF';
    if (action.includes('privacy') || action.includes('policy')) return '#C8A8E9';
    if (action.includes('verification') || action.includes('security')) return '#9C27B0';
    if (action.includes('cookie')) return '#607D8B';
    return '#666';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date().getTime();
    const logTime = new Date(timestamp).getTime();
    const diffMinutes = Math.floor((now - logTime) / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compliance Audit</Text>
        <TouchableOpacity onPress={handleExportAuditLog} style={styles.exportButton}>
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="share-outline" size={24} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Metrics Dashboard */}
      <View style={styles.metricsSection}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.totalActions}</Text>
            <Text style={styles.metricLabel}>Total Actions</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: '#4CAF50' }]}>{metrics.complianceScore}%</Text>
            <Text style={styles.metricLabel}>Compliance Score</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.consentUpdates}</Text>
            <Text style={styles.metricLabel}>Consent Updates</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.dataRequests}</Text>
            <Text style={styles.metricLabel}>Data Requests</Text>
          </View>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Date Range:</Text>
            {['today', 'week', 'month', 'all'].map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.filterButton,
                  filters.dateRange === range && styles.filterButtonActive
                ]}
                onPress={() => handleFilterChange('dateRange', range)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filters.dateRange === range && styles.filterButtonTextActive
                ]}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Type:</Text>
            {['all', 'consent', 'data_access', 'security', 'privacy'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterButton,
                  filters.actionType === type && styles.filterButtonActive
                ]}
                onPress={() => handleFilterChange('actionType', type)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filters.actionType === type && styles.filterButtonTextActive
                ]}>
                  {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Audit Log */}
      <ScrollView
        style={styles.logSection}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading && auditLogs.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading audit logs...</Text>
          </View>
        ) : auditLogs.length > 0 ? (
          auditLogs.map((log) => (
            <TouchableOpacity
              key={log.id}
              style={styles.logEntry}
              onPress={() => toggleLogExpansion(log.id)}
            >
              <View style={styles.logHeader}>
                <View style={styles.logIconContainer}>
                  <Ionicons
                    name={getActionIcon(log.action) as any}
                    size={20}
                    color={getActionColor(log.action)}
                  />
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logAction}>
                    {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                  <Text style={styles.logTime}>{getRelativeTime(log.timestamp)}</Text>
                </View>
                <View style={styles.logActions}>
                  <Ionicons
                    name={expandedLog === log.id ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#666"
                  />
                </View>
              </View>

              {expandedLog === log.id && (
                <View style={styles.logDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Timestamp:</Text>
                    <Text style={styles.detailValue}>{formatTimestamp(log.timestamp)}</Text>
                  </View>
                  
                  {log.ipAddress && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>IP Address:</Text>
                      <Text style={styles.detailValue}>{log.ipAddress}</Text>
                    </View>
                  )}

                  {log.userAgent && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>User Agent:</Text>
                      <Text style={styles.detailValue}>{log.userAgent}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Details:</Text>
                    <View style={styles.detailsContainer}>
                      {Object.entries(log.details).map(([key, value]) => (
                        <View key={key} style={styles.detailItem}>
                          <Text style={styles.detailKey}>{key.replace(/_/g, ' ')}:</Text>
                          <Text style={styles.detailItemValue}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color="#CCC" />
            <Text style={styles.emptyStateText}>No audit logs found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your filters or check back later
            </Text>
          </View>
        )}

        {/* Footer Information */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This audit log shows your compliance-related activities for transparency and regulatory compliance.
            Logs are retained for 7 years as required by law.
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
  exportButton: {
    padding: 8,
  },
  metricsSection: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricCard: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  filtersSection: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  logSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  logEntry: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginVertical: 4,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  logIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logInfo: {
    flex: 1,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  logTime: {
    fontSize: 14,
    color: '#666',
  },
  logActions: {
    padding: 4,
  },
  logDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  detailKey: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    minWidth: 100,
    textTransform: 'capitalize',
  },
  detailItemValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
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
  footer: {
    padding: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default ComplianceAuditScreen;
