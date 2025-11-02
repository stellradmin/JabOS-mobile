import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { AlertTriangle, RefreshCw, ArrowLeft, Bug } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import { trackCriticalError } from '../lib/sentry-enhanced';
import { useDatingAppTracking } from '../hooks/usePerformanceMonitoring';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Error types for different scenarios
export type ErrorBoundaryType = 
  | 'match-presentation' 
  | 'match-card' 
  | 'compatibility-screen' 
  | 'match-flow-manager' 
  | 'context-provider'
  | 'messaging'
  | 'general';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void; onClose?: () => void }>;
  errorType?: ErrorBoundaryType;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onRetry?: () => void;
  onClose?: () => void;
  showErrorDetails?: boolean;
  allowRetry?: boolean;
  customMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  errorType: ErrorBoundaryType;
  retryCount: number;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries = 3;
  private trackingHooks: any = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorId: null,
      errorType: props.errorType || 'general',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { 
      hasError: true, 
      error,
      errorId: Date.now().toString() 
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorContext = this.buildErrorContext(error, errorInfo);
    
    // Track critical UI errors with enhanced context
    trackCriticalError(error, errorContext);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error details
    console.group(`🚨 ErrorBoundary [${this.state.errorType}] caught an error:`);
    logError('Error:', "Error", error);
    logError('Component stack:', "Error", errorInfo.componentStack);
    logError('Error context:', "Error", errorContext);
    console.groupEnd();

    // Show development alert for critical errors
    if (__DEV__ && this.getErrorSeverity(error) === 'critical') {
      Alert.alert(
        '🚨 Critical Error Detected',
        `${error.message}\n\nCheck console for details.`,
        [{ text: 'OK' }]
      );
    }
  }

  buildErrorContext = (error: Error, errorInfo: React.ErrorInfo) => {
    return {
      component_stack: errorInfo.componentStack,
      error_boundary: true,
      error_id: this.state.errorId,
      error_type: this.state.errorType,
      retry_count: this.state.retryCount,
      timestamp: new Date().toISOString(),
      error_severity: this.getErrorSeverity(error),
      error_category: this.categorizeError(error),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      stack_trace: error.stack,
    };
  };

  getErrorSeverity = (error: Error): ErrorSeverity => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Critical errors that crash the app
    if (
      message.includes('network error') ||
      message.includes('failed to fetch') ||
      message.includes('supabase') ||
      stack.includes('compatibility') ||
      stack.includes('matching')
    ) {
      return 'critical';
    }

    // High severity for component-specific errors
    if (
      this.state.errorType.includes('match') ||
      message.includes('permission') ||
      message.includes('unauthorized')
    ) {
      return 'high';
    }

    // Medium for UI errors
    if (
      message.includes('render') ||
      message.includes('component') ||
      message.includes('animation')
    ) {
      return 'medium';
    }

    return 'low';
  };

  categorizeError = (error: Error): string => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('permission') || message.includes('auth')) return 'authentication';
    if (message.includes('parse') || message.includes('json')) return 'data-parsing';
    if (stack.includes('animation') || stack.includes('reanimated')) return 'animation';
    if (stack.includes('gesture') || stack.includes('touch')) return 'user-interaction';
    if (this.state.errorType.includes('match')) return 'matching-system';
    
    return 'unknown';
  };

  retry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      Alert.alert(
        'Maximum Retries Reached',
        'This error persists after multiple attempts. Please restart the app or contact support.',
        [
          { text: 'Close', onPress: this.props.onClose },
          { text: 'Report Issue', onPress: this.reportIssue }
        ]
      );
      return;
    }

    this.setState(prevState => ({ 
      hasError: false, 
      error: null, 
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));

    // Call custom retry handler
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  reportIssue = () => {
    if (this.state.error) {
      // Create issue report data
      const issueData = {
        error_message: this.state.error.message,
        error_stack: this.state.error.stack,
        error_id: this.state.errorId,
        error_type: this.state.errorType,
        timestamp: new Date().toISOString(),
        retry_count: this.state.retryCount
      };

      // This could integrate with your issue reporting system
      logDebug('📝 Issue Report Data:', "Debug", issueData);
    }
  };

  getErrorTitle = (): string => {
    switch (this.state.errorType) {
      case 'match-presentation':
        return 'Match Display Error';
      case 'match-card':
        return 'Match Card Error';
      case 'compatibility-screen':
        return 'Compatibility Error';
      case 'match-flow-manager':
        return 'Matching System Error';
      case 'context-provider':
        return 'Data Connection Error';
      default:
        return 'Something went wrong';
    }
  };

  getErrorMessage = (): string => {
    if (this.props.customMessage) {
      return this.props.customMessage;
    }

    const severity = this.getErrorSeverity(this.state.error!);
    const category = this.categorizeError(this.state.error!);

    switch (category) {
      case 'network':
        return 'Connection issue detected. Please check your internet and try again.';
      case 'authentication':
        return 'Authentication error. Please log in again.';
      case 'matching-system':
        return 'Temporary issue with the matching system. We\'re working to fix it.';
      case 'data-parsing':
        return 'Data format error. This usually resolves itself quickly.';
      case 'animation':
        return 'Display issue detected. Refreshing should help.';
      default:
        return severity === 'critical' 
          ? 'Critical error detected. We\'ve been notified and are working on a fix.'
          : 'We\'ve been notified and are working on a fix.';
    }
  };

  renderErrorIcon = () => {
    const severity = this.getErrorSeverity(this.state.error!);
    const iconColor = severity === 'critical' ? '#ef4444' : '#f59e0b';
    
    return (
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
        <AlertTriangle size={40} color={iconColor} />
      </View>
    );
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return (
          <this.props.fallback 
            error={this.state.error!} 
            retry={this.retry} 
            onClose={this.props.onClose}
          />
        );
      }

      const allowRetry = this.props.allowRetry !== false && this.state.retryCount < this.maxRetries;
      const showDetails = this.props.showErrorDetails !== false;

      return (
        <View style={[styles.container, { backgroundColor: '#0F172A' }]}>
          <View style={styles.content}>
            {/* Header with back button if onClose is provided */}
            {this.props.onClose && (
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={this.props.onClose}
                >
                  <ArrowLeft size={24} color="black" />
                </TouchableOpacity>
              </View>
            )}

            {/* Error Icon */}
            {this.renderErrorIcon()}
            
            {/* Title and Message */}
            <Text style={styles.title}>{this.getErrorTitle()}</Text>
            <Text style={styles.subtitle}>{this.getErrorMessage()}</Text>
            
            {/* Development Error Details */}
            {__DEV__ && showDetails && this.state.error && (
              <View style={styles.errorDetails}>
                <View style={styles.errorHeader}>
                  <Bug size={16} color="#c62828" />
                  <Text style={styles.errorHeaderText}>Debug Info</Text>
                </View>
                <Text style={styles.errorText}>
                  {this.state.error.message}
                </Text>
                <Text style={styles.errorMeta}>
                  Type: {this.state.errorType} | Severity: {this.getErrorSeverity(this.state.error)}
                </Text>
              </View>
            )}
            
            {/* Action Buttons */}
            <View style={styles.actions}>
              {allowRetry && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.retryButton]}
                  onPress={this.retry}
                >
                  <RefreshCw size={20} color="white" style={styles.buttonIcon} />
                  <Text style={styles.retryButtonText}>
                    Try Again {this.state.retryCount > 0 ? `(${this.state.retryCount}/${this.maxRetries})` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              
              {this.props.onClose && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={this.props.onClose}
                >
                  <Text style={styles.closeButtonText}>Go Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.actionButton, styles.reportButton]}
                onPress={this.reportIssue}
              >
                <Text style={styles.reportButtonText}>Report Issue</Text>
              </TouchableOpacity>
            </View>
            
            {/* Error ID */}
            {this.state.errorId && (
              <Text style={styles.errorId}>
                Error ID: {this.state.errorId}
              </Text>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 20,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  content: {
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    marginBottom: 12,
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
    marginBottom: 32,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
  },
  errorDetails: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorHeaderText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: '#ef4444',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'monospace',
    lineHeight: 16,
    marginBottom: 8,
  },
  errorMeta: {
    fontSize: 11,
    color: 'rgba(239, 68, 68, 0.7)',
    fontFamily: 'Geist-Regular',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'black',
    width: '100%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButton: {
    backgroundColor: '#22c55e',
  },
  closeButton: {
    backgroundColor: 'white',
  },
  reportButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: 'white',
    fontFamily: 'Geist-Regular',
    fontSize: 16,
  },
  closeButtonText: {
    color: 'black',
    fontFamily: 'Geist-Regular',
    fontSize: 16,
  },
  reportButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Geist-Medium',
    fontSize: 14,
  },
  errorId: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'monospace',
    marginTop: 16,
    textAlign: 'center',
  },
});

// Create a HOC version for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) => {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export default Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: ({ error, resetError }) => (
    <View style={styles.container}>
      <Text style={styles.title}>Application Error</Text>
      <Text style={styles.subtitle}>
        The app encountered an unexpected error
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={resetError}>
        <Text style={styles.retryButtonText}>Restart App</Text>
      </TouchableOpacity>
    </View>
  ),
});
