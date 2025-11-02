import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import { announceToScreenReader } from '../../src/utils/accessibility';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * PopupTrayErrorBoundary - Error boundary specifically for popup trays
 * 
 * Features:
 * - Catches errors in popup tray components
 * - Provides user-friendly error UI
 * - Retry functionality
 * - Accessibility announcements
 * - Graceful degradation
 * 
 * Following Golden Code Principles:
 * 1. Fail Fast: Catches errors immediately
 * 2. Defensive Programming: Safe error handling
 * 3. Single Responsibility: Only handles error boundary logic
 * 4. User Experience First: Provides helpful error UI
 */
class PopupTrayErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    logError('PopupTray Error Boundary caught an error:', "Error", error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Announce error to screen readers
    announceToScreenReader(
      'An error occurred in the popup. Please try refreshing or closing the popup.',
      'assertive'
    );

    // Log to error reporting service in production
    try {
      // In production, you would send this to Sentry or similar
      // Sentry.captureException(error, {
      //   tags: { component: 'PopupTrayErrorBoundary' },
      //   extra: { errorInfo }
      // });
    } catch (reportingError) {
      logError('Failed to report error:', "Error", reportingError);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onRetry?.();
    announceToScreenReader('Retrying...', 'polite');
  };

  handleClose = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onClose?.();
    announceToScreenReader('Closing popup', 'polite');
  };

  render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Something went wrong',
        fallbackMessage = 'We encountered an error while loading this popup. You can try refreshing or closing it.',
        onRetry,
        onClose,
      } = this.props;

      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <AlertTriangle size={48} color={COLORS.ERROR_COLOR} style={styles.errorIcon} />
            
            <Text style={styles.errorTitle}>{fallbackTitle}</Text>
            <Text style={styles.errorMessage}>{fallbackMessage}</Text>
            
            {__DEV__ && this.state.error && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error.message}</Text>
                {this.state.error.stack && (
                  <Text style={styles.debugStack} numberOfLines={5}>
                    {this.state.error.stack}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.actionButtons}>
              {onRetry && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.retryButton]}
                  onPress={this.handleRetry}
                  accessibilityLabel="Try again"
                  accessibilityRole="button"
                >
                  <RefreshCw size={16} color={COLORS.CARD_WHITE_TEXT} />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              )}
              
              {onClose && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={this.handleClose}
                  accessibilityLabel="Close popup"
                  accessibilityRole="button"
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  debugInfo: {
    backgroundColor: COLORS.TAG_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 4,
  },
  debugStack: {
    fontSize: 10,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.BLUE_CARD,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.CARD_WHITE_TEXT,
  },
  closeButton: {
    backgroundColor: COLORS.SECONDARY_TEXT,
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: COLORS.CARD_WHITE_TEXT,
  },
});

export default PopupTrayErrorBoundary;
