/**
 * Specialized Error Boundaries for Context-Specific Error Handling
 * Follows Single Responsibility Principle with dedicated boundaries for each app context
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { 
  MessageCircle, 
  Heart, 
  User, 
  Shield, 
  CreditCard, 
  RefreshCw, 
  ArrowLeft, 
  AlertTriangle,
  Wifi,
  WifiOff 
} from 'lucide-react-native';
import ErrorBoundary, { ErrorBoundaryType } from './ErrorBoundary';
import { StellerError, ErrorSeverity } from '../types/error-types';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { 
  trackMessagingError, 
  trackMatchingError, 
  trackOnboardingError, 
  trackPaymentError 
} from '../lib/sentry-enhanced';

// Base props for all specialized error boundaries
interface SpecializedErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onRetry?: () => void;
  onClose?: () => void;
  showErrorDetails?: boolean;
  customFallback?: React.ComponentType<SpecializedErrorFallbackProps>;
}

// Fallback component props
interface SpecializedErrorFallbackProps {
  error: Error;
  retry: () => void;
  onClose?: () => void;
  context: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: () => void;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
}

// Specialized Error Fallback Component
const SpecializedErrorFallback: React.FC<SpecializedErrorFallbackProps> = ({
  error,
  retry,
  onClose,
  context,
  icon,
  title,
  message,
  actions = []
}) => {
  const defaultActions = [
    {
      label: 'Try Again',
      action: retry,
      style: 'primary' as const
    },
    ...(onClose ? [{
      label: 'Go Back',
      action: onClose,
      style: 'secondary' as const
    }] : [])
  ];

  const allActions = [...actions, ...defaultActions];

  return (
    <View style={styles.fallbackContainer}>
      <View style={styles.fallbackContent}>
        {/* Context Icon */}
        <View style={styles.iconContainer}>
          {icon}
        </View>

        {/* Title and Message */}
        <Text style={styles.fallbackTitle}>{title}</Text>
        <Text style={styles.fallbackMessage}>{message}</Text>

        {/* Development Error Details */}
        {__DEV__ && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorDetailsTitle}>Debug Info ({context})</Text>
            <Text style={styles.errorDetailsText}>{error.message}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {allActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                action.style === 'primary' && styles.primaryButton,
                action.style === 'secondary' && styles.secondaryButton,
                action.style === 'danger' && styles.dangerButton
              ]}
              onPress={action.action}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  action.style === 'primary' && styles.primaryButtonText,
                  action.style === 'secondary' && styles.secondaryButtonText,
                  action.style === 'danger' && styles.dangerButtonText
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

// Messaging Error Boundary
export const MessagingErrorBoundary: React.FC<SpecializedErrorBoundaryProps> = ({
  children,
  onError,
  onRetry,
  onClose,
  showErrorDetails,
  customFallback
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    trackMessagingError(error, {
      conversationId: undefined, // Will be set by context
      messageType: undefined
    });
    onError?.(error, errorInfo);
  };

  const MessagingFallback = customFallback || (({ error, retry, onClose: fallbackOnClose }) => (
    <SpecializedErrorFallback
      error={error}
      retry={retry}
      onClose={fallbackOnClose}
      context="messaging"
      icon={<MessageCircle size={48} color="#ef4444" />}
      title="Messaging Error"
      message="Unable to load messages. This might be due to a connection issue or temporary server problem."
      actions={[
        {
          label: 'Refresh Conversation',
          action: retry,
          style: 'primary'
        }
      ]}
    />
  ));

  return (
    <ErrorBoundary
      errorType="general"
      fallback={MessagingFallback as any}
      onError={handleError}
      onRetry={onRetry}
      onClose={onClose}
      showErrorDetails={showErrorDetails}
    >
      {children}
    </ErrorBoundary>
  );
};

// Matching Error Boundary
export const MatchingErrorBoundary: React.FC<SpecializedErrorBoundaryProps> = ({
  children,
  onError,
  onRetry,
  onClose,
  showErrorDetails,
  customFallback
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    trackMatchingError(error, {
      userId: undefined, // Will be set by context
      matchUserId: undefined,
      action: undefined
    });
    onError?.(error, errorInfo);
  };

  const MatchingFallback = customFallback || (({ error, retry, onClose: fallbackOnClose }) => (
    <SpecializedErrorFallback
      error={error}
      retry={retry}
      onClose={fallbackOnClose}
      context="matching"
      icon={<Heart size={48} color="#ef4444" />}
      title="Matching Error"
      message="Unable to load potential matches. We're working to fix this issue."
      actions={[
        {
          label: 'Find New Matches',
          action: retry,
          style: 'primary'
        },
        {
          label: 'View Profile',
          action: () => {
            // Navigate to profile
          },
          style: 'secondary'
        }
      ]}
    />
  ));

  return (
    <ErrorBoundary
      errorType="match-presentation"
      fallback={MatchingFallback as any}
      onError={handleError}
      onRetry={onRetry}
      onClose={onClose}
      showErrorDetails={showErrorDetails}
    >
      {children}
    </ErrorBoundary>
  );
};

// Onboarding Error Boundary
export const OnboardingErrorBoundary: React.FC<SpecializedErrorBoundaryProps> = ({
  children,
  onError,
  onRetry,
  onClose,
  showErrorDetails,
  customFallback
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    trackOnboardingError(error, {
      step: undefined, // Will be set by context
      stepNumber: undefined
    });
    onError?.(error, errorInfo);
  };

  const OnboardingFallback = customFallback || (({ error, retry, onClose: fallbackOnClose }) => (
    <SpecializedErrorFallback
      error={error}
      retry={retry}
      onClose={fallbackOnClose}
      context="onboarding"
      icon={<User size={48} color="#ef4444" />}
      title="Profile Setup Error"
      message="Unable to save your profile information. Your progress has been saved and you can continue from where you left off."
      actions={[
        {
          label: 'Continue Setup',
          action: retry,
          style: 'primary'
        },
        {
          label: 'Save Progress',
          action: () => {
            // Save current progress
            retry();
          },
          style: 'secondary'
        }
      ]}
    />
  ));

  return (
    <ErrorBoundary
      errorType="context-provider"
      fallback={OnboardingFallback as any}
      onError={handleError}
      onRetry={onRetry}
      onClose={onClose}
      showErrorDetails={showErrorDetails}
    >
      {children}
    </ErrorBoundary>
  );
};

// Authentication Error Boundary
export const AuthenticationErrorBoundary: React.FC<SpecializedErrorBoundaryProps> = ({
  children,
  onError,
  onRetry,
  onClose,
  showErrorDetails,
  customFallback
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Authentication errors are critical for the app
    logError('Authentication Error:', "Error", error);
    onError?.(error, errorInfo);
  };

  const AuthFallback = customFallback || (({ error, retry, onClose: fallbackOnClose }) => (
    <SpecializedErrorFallback
      error={error}
      retry={retry}
      onClose={fallbackOnClose}
      context="authentication"
      icon={<Shield size={48} color="#ef4444" />}
      title="Authentication Error"
      message="Your session has expired or there's an authentication issue. Please log in again to continue."
      actions={[
        {
          label: 'Sign In Again',
          action: () => {
            // Navigate to sign in
          },
          style: 'primary'
        },
        {
          label: 'Try Again',
          action: retry,
          style: 'secondary'
        }
      ]}
    />
  ));

  return (
    <ErrorBoundary
      errorType="context-provider"
      fallback={AuthFallback as any}
      onError={handleError}
      onRetry={onRetry}
      onClose={onClose}
      showErrorDetails={showErrorDetails}
    >
      {children}
    </ErrorBoundary>
  );
};

// Payment Error Boundary
export const PaymentErrorBoundary: React.FC<SpecializedErrorBoundaryProps> = ({
  children,
  onError,
  onRetry,
  onClose,
  showErrorDetails,
  customFallback
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    trackPaymentError(error, {
      plan: undefined, // Will be set by context
      amount: undefined,
      paymentMethod: undefined
    });
    onError?.(error, errorInfo);
  };

  const PaymentFallback = customFallback || (({ error, retry, onClose: fallbackOnClose }) => (
    <SpecializedErrorFallback
      error={error}
      retry={retry}
      onClose={fallbackOnClose}
      context="payment"
      icon={<CreditCard size={48} color="#ef4444" />}
      title="Payment Error"
      message="Unable to process your payment. Your card was not charged. Please check your payment method and try again."
      actions={[
        {
          label: 'Update Payment Method',
          action: () => {
            // Navigate to payment methods
          },
          style: 'primary'
        },
        {
          label: 'Try Again',
          action: retry,
          style: 'secondary'
        },
        {
          label: 'Contact Support',
          action: () => {
            // Open support
          },
          style: 'secondary'
        }
      ]}
    />
  ));

  return (
    <ErrorBoundary
      errorType="context-provider"
      fallback={PaymentFallback as any}
      onError={handleError}
      onRetry={onRetry}
      onClose={onClose}
      showErrorDetails={showErrorDetails}
    >
      {children}
    </ErrorBoundary>
  );
};

// Network Error Boundary (for offline/connectivity issues)
export const NetworkErrorBoundary: React.FC<SpecializedErrorBoundaryProps & {
  isOnline?: boolean;
}> = ({
  children,
  onError,
  onRetry,
  onClose,
  showErrorDetails,
  customFallback,
  isOnline = true
}) => {
  const NetworkFallback = customFallback || (({ error, retry, onClose: fallbackOnClose }) => (
    <SpecializedErrorFallback
      error={error}
      retry={retry}
      onClose={fallbackOnClose}
      context="network"
      icon={isOnline ? <Wifi size={48} color="#f59e0b" /> : <WifiOff size={48} color="#ef4444" />}
      title={isOnline ? "Connection Issue" : "You're Offline"}
      message={
        isOnline 
          ? "Unable to connect to our servers. Please check your internet connection."
          : "You appear to be offline. Please check your internet connection and try again."
      }
      actions={[
        {
          label: isOnline ? 'Retry Connection' : 'Check Connection',
          action: retry,
          style: 'primary'
        }
      ]}
    />
  ));

  return (
    <ErrorBoundary
      errorType="context-provider"
      fallback={NetworkFallback as any}
      onError={onError}
      onRetry={onRetry}
      onClose={onClose}
      showErrorDetails={showErrorDetails}
    >
      {children}
    </ErrorBoundary>
  );
};

// Higher-order component for wrapping components with specialized error boundaries
export const withSpecializedErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  boundaryType: 'messaging' | 'matching' | 'onboarding' | 'authentication' | 'payment' | 'network',
  options?: {
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    onRetry?: () => void;
    onClose?: () => void;
    customFallback?: React.ComponentType<SpecializedErrorFallbackProps>;
  }
) => {
  return React.forwardRef<any, P & { errorBoundaryKey?: string }>((props, ref) => {
    const { errorBoundaryKey, ...componentProps } = props;
    
    const getBoundaryComponent = () => {
      switch (boundaryType) {
        case 'messaging':
          return MessagingErrorBoundary;
        case 'matching':
          return MatchingErrorBoundary;
        case 'onboarding':
          return OnboardingErrorBoundary;
        case 'authentication':
          return AuthenticationErrorBoundary;
        case 'payment':
          return PaymentErrorBoundary;
        case 'network':
          return NetworkErrorBoundary;
        default:
          return ErrorBoundary;
      }
    };

    const BoundaryComponent = getBoundaryComponent();

    return (
      <BoundaryComponent
        key={errorBoundaryKey}
        onError={options?.onError}
        onRetry={options?.onRetry}
        onClose={options?.onClose}
        customFallback={options?.customFallback}
      >
        <Component {...(componentProps as P)} ref={ref} />
      </BoundaryComponent>
    );
  });
};

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 20,
  },
  fallbackContent: {
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  fallbackTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  fallbackMessage: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
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
  errorDetailsTitle: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  actionsContainer: {
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
    width: '100%',
    maxWidth: 280,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderColor: 'black',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderColor: 'black',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    borderColor: 'black',
  },
  actionButtonText: {
    fontFamily: 'Geist-Regular',
    fontSize: 16,
  },
  primaryButtonText: {
    color: 'white',
  },
  secondaryButtonText: {
    color: 'black',
  },
  dangerButtonText: {
    color: 'white',
  },
});

export default {
  MessagingErrorBoundary,
  MatchingErrorBoundary,
  OnboardingErrorBoundary,
  AuthenticationErrorBoundary,
  PaymentErrorBoundary,
  NetworkErrorBoundary,
  withSpecializedErrorBoundary,
  SpecializedErrorFallback
};
