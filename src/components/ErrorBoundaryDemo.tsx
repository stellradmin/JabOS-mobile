import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react-native';

import ErrorBoundary from './ErrorBoundary';
import { 
  withMatchPresentationErrorBoundary,
  withMatchCardErrorBoundary,
  withCompatibilityErrorBoundary,
  PotentialMatchContextErrorBoundary
} from './MatchingErrorBoundaries';
import { 
  useErrorRecovery, 
  useNetworkErrorRecovery, 
  useMatchingErrorRecovery 
} from '../hooks/useErrorRecovery';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { 
  logError as reportError, 
  logError as reportMatchingError, 
  logError as reportNetworkError,
  errorMonitoringService 
} from '../services/error-monitoring-service';

/**
 * Demo component showing error boundary implementation
 * This component demonstrates various error scenarios and recovery mechanisms
 */

// Component that throws errors for testing
const ErrorThrowingComponent: React.FC<{ 
  errorType: 'render' | 'network' | 'matching' | 'animation';
  onError?: () => void;
}> = ({ errorType, onError }) => {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    switch (errorType) {
      case 'render':
        throw new Error('Render error: Component failed to render user profile');
      case 'network':
        throw new Error('Network error: Failed to fetch user data from server');
      case 'matching':
        throw new Error('Matching error: Compatibility calculation failed');
      case 'animation':
        throw new Error('Animation error: React Native Reanimated gesture conflict');
    }
  }

  return (
    <View style={demoStyles.errorComponent}>
      <Text style={demoStyles.componentTitle}>
        {errorType.charAt(0).toUpperCase() + errorType.slice(1)} Component
      </Text>
      <TouchableOpacity
        style={demoStyles.triggerButton}
        onPress={() => {
          setShouldThrow(true);
          onError?.();
        }}
      >
        <Bug size={16} color="white" />
        <Text style={demoStyles.triggerButtonText}>Trigger {errorType} Error</Text>
      </TouchableOpacity>
    </View>
  );
};

// Demo components with different error boundaries
const SafeRenderComponent = withMatchCardErrorBoundary(ErrorThrowingComponent);
const SafeNetworkComponent = withCompatibilityErrorBoundary(ErrorThrowingComponent);
const SafeMatchingComponent = withMatchPresentationErrorBoundary(ErrorThrowingComponent);

// Network operation demo with error recovery
const NetworkOperationDemo: React.FC = () => {
  const [result, setResult] = useState<string | null>(null);
  const errorRecovery = useNetworkErrorRecovery();

  const simulateNetworkOperation = async () => {
    const result = await errorRecovery.executeWithRecovery(async () => {
      // Simulate network operation that might fail
      if (Math.random() < 0.7) {
        throw new Error('Network timeout: Unable to connect to matching service');
      }
      return 'Network operation successful!';
    }, 'demo_network_operation');

    if (result !== null) {
      setResult(result);
    } else {
      setResult('Operation failed - check error recovery state');
    }
  };

  return (
    <View style={demoStyles.operationDemo}>
      <Text style={demoStyles.demoTitle}>Network Error Recovery Demo</Text>
      
      <TouchableOpacity
        style={demoStyles.operationButton}
        onPress={simulateNetworkOperation}
        disabled={errorRecovery.isRetrying}
      >
        <RefreshCw size={16} color="white" />
        <Text style={demoStyles.operationButtonText}>
          {errorRecovery.isRetrying ? 'Retrying...' : 'Simulate Network Operation'}
        </Text>
      </TouchableOpacity>

      {result && (
        <Text style={[
          demoStyles.resultText,
          { color: result.includes('successful') ? '#22c55e' : '#ef4444' }
        ]}>
          {result}
        </Text>
      )}

      {errorRecovery.isError && (
        <View style={demoStyles.errorInfo}>
          <Text style={demoStyles.errorInfoTitle}>Error Recovery State:</Text>
          <Text style={demoStyles.errorInfoText}>
            Retry Count: {errorRecovery.retryCount}
          </Text>
          <Text style={demoStyles.errorInfoText}>
            Can Retry: {errorRecovery.canRetry ? 'Yes' : 'No'}
          </Text>
          {errorRecovery.canRetry && (
            <TouchableOpacity
              style={demoStyles.retryButton}
              onPress={() => errorRecovery.retry()}
            >
              <Text style={demoStyles.retryButtonText}>Manual Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// Error monitoring demo
const ErrorMonitoringDemo: React.FC = () => {
  const [stats, setStats] = useState(errorMonitoringService.getStats());

  const reportTestError = (category: string) => {
    const testError = new Error(`Test ${category} error for demonstration`);
    
    switch (category) {
      case 'matching':
        reportMatchingError(testError, {
          match_id: 'test-match-123',
          interaction_type: 'accept',
          component: 'ErrorBoundaryDemo',
        });
        break;
      case 'network':
        reportNetworkError(testError, {
          url: '/api/test-endpoint',
          method: 'POST',
          status_code: 500,
        });
        break;
      default:
        reportError(testError, {
          component_type: 'demo',
          error_category: 'test',
        });
    }

    // Update stats after reporting
    setTimeout(() => {
      setStats(errorMonitoringService.getStats());
    }, 100);
  };

  const clearErrors = () => {
    // No explicit clear; re-render stats
    setStats(errorMonitoringService.getStats());
  };

  return (
    <View style={demoStyles.monitoringDemo}>
      <Text style={demoStyles.demoTitle}>Error Monitoring Demo</Text>
      
      <View style={demoStyles.statsContainer}>
        <Text style={demoStyles.statsTitle}>Error Monitoring Status:</Text>
        <Text style={demoStyles.statsText}>Initialized: {String(stats.isInitialized)}</Text>
        <Text style={demoStyles.statsText}>Queued Errors: {stats.queuedErrors}</Text>
        <Text style={demoStyles.statsText}>Breadcrumbs: {stats.breadcrumbCount}</Text>
        <Text style={demoStyles.statsText}>Retry Count: {stats.retryCount}</Text>
      </View>

      <View style={demoStyles.buttonRow}>
        <TouchableOpacity
          style={demoStyles.testButton}
          onPress={() => reportTestError('matching')}
        >
          <Text style={demoStyles.testButtonText}>Report Matching Error</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={demoStyles.testButton}
          onPress={() => reportTestError('network')}
        >
          <Text style={demoStyles.testButtonText}>Report Network Error</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={demoStyles.clearButton}
        onPress={clearErrors}
      >
        <Text style={demoStyles.clearButtonText}>Clear Error Reports</Text>
      </TouchableOpacity>

      {/* Common error aggregation unavailable in current monitor; placeholder removed */}
    </View>
  );
};

// Main demo component
const ErrorBoundaryDemo: React.FC = () => {
  return (
    <View style={demoStyles.container}>
      <Text style={demoStyles.title}>Error Boundary Implementation Demo</Text>
      
      {/* Error throwing components with different boundaries */}
      <View style={demoStyles.section}>
        <Text style={demoStyles.sectionTitle}>Protected Components</Text>
        
        <SafeRenderComponent 
          errorType="render" 
          onError={() => logDebug('Render error thrown', "Debug")}
        />
        
        <SafeNetworkComponent 
          errorType="network"
          onError={() => logDebug('Network error thrown', "Debug")}
        />
        
        <SafeMatchingComponent 
          errorType="matching"
          onError={() => logDebug('Matching error thrown', "Debug")}
        />
      </View>

      {/* Context error boundary demo */}
      <View style={demoStyles.section}>
        <Text style={demoStyles.sectionTitle}>Context Error Protection</Text>
        <PotentialMatchContextErrorBoundary>
          <ErrorThrowingComponent 
            errorType="animation"
            onError={() => logDebug('Context error thrown', "Debug")}
          />
        </PotentialMatchContextErrorBoundary>
      </View>

      {/* Network operation demo */}
      <View style={demoStyles.section}>
        <NetworkOperationDemo />
      </View>

      {/* Error monitoring demo */}
      <View style={demoStyles.section}>
        <ErrorMonitoringDemo />
      </View>
    </View>
  );
};

const demoStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: 'white',
    marginBottom: 16,
  },
  errorComponent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  componentTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: 'white',
    marginBottom: 12,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  triggerButtonText: {
    color: 'white',
    fontFamily: 'Geist-Medium',
    fontSize: 14,
  },
  operationDemo: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  demoTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: 'white',
    marginBottom: 16,
  },
  operationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 16,
  },
  operationButtonText: {
    color: 'white',
    fontFamily: 'Geist-Medium',
    fontSize: 14,
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    marginBottom: 12,
  },
  errorInfo: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorInfoTitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorInfoText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#ef4444',
    marginBottom: 4,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Geist-Medium',
  },
  monitoringDemo: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#f59e0b',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#f59e0b',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 16,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    textAlign: 'center',
  },
  commonErrors: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  commonErrorsTitle: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: 'white',
    marginBottom: 8,
  },
  commonErrorText: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
});

export default ErrorBoundaryDemo;
