import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, RefreshCw, ArrowLeft, Eye, X, AlertCircle } from 'lucide-react-native';
import ErrorBoundary, { ErrorBoundaryType } from './ErrorBoundary';

// Specialized fallback components for different matching scenarios

interface MatchingErrorFallbackProps {
  error: Error;
  retry: () => void;
  onClose?: () => void;
}

// Fallback for PotentialMatchPresentation errors
export const MatchPresentationErrorFallback: React.FC<MatchingErrorFallbackProps> = ({
  error,
  retry,
  onClose,
}) => (
  <View style={matchingStyles.container}>
    {/* Header with back button */}
    <View style={matchingStyles.header}>
      <TouchableOpacity
        style={matchingStyles.backButton}
        onPress={onClose}
      >
        <ArrowLeft size={24} color="black" />
      </TouchableOpacity>
    </View>

    <View style={matchingStyles.content}>
      <View style={matchingStyles.iconContainer}>
        <AlertCircle size={48} color="#ef4444" />
      </View>
      
      <Text style={matchingStyles.title}>Match Display Error</Text>
      <Text style={matchingStyles.subtitle}>
        Unable to display potential matches. This is usually a temporary issue.
      </Text>
      
      <View style={matchingStyles.actions}>
        <TouchableOpacity 
          style={[matchingStyles.actionButton, matchingStyles.retryButton]}
          onPress={retry}
        >
          <RefreshCw size={20} color="white" style={matchingStyles.buttonIcon} />
          <Text style={matchingStyles.retryButtonText}>Reload Matches</Text>
        </TouchableOpacity>
        
        {onClose && (
          <TouchableOpacity 
            style={[matchingStyles.actionButton, matchingStyles.closeButton]}
            onPress={onClose}
          >
            <Text style={matchingStyles.closeButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </View>
);

// Fallback for MatchCard errors
export const MatchCardErrorFallback: React.FC<MatchingErrorFallbackProps> = ({
  error,
  retry,
  onClose,
}) => (
  <View style={matchCardStyles.container}>
    <View style={matchCardStyles.errorCard}>
      <View style={matchCardStyles.iconContainer}>
        <Heart size={32} color="#ef4444" />
      </View>
      
      <Text style={matchCardStyles.title}>Match Card Error</Text>
      <Text style={matchCardStyles.subtitle}>
        Unable to display this match profile
      </Text>
      
      <View style={matchCardStyles.actions}>
        <TouchableOpacity 
          style={matchCardStyles.retryButton}
          onPress={retry}
        >
          <RefreshCw size={16} color="white" />
        </TouchableOpacity>
        
        {onClose && (
          <TouchableOpacity 
            style={matchCardStyles.skipButton}
            onPress={onClose}
          >
            <X size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  </View>
);

// Fallback for CompatibilityScreenContent errors
export const CompatibilityErrorFallback: React.FC<MatchingErrorFallbackProps> = ({
  error,
  retry,
  onClose,
}) => (
  <View style={compatibilityStyles.container}>
    <View style={compatibilityStyles.header}>
      <TouchableOpacity 
        onPress={onClose} 
        style={compatibilityStyles.backButton}
      >
        <ArrowLeft size={24} color="black" />
      </TouchableOpacity>
      <Text style={compatibilityStyles.headerTitle}>Compatibility</Text>
      <View style={compatibilityStyles.spacer} />
    </View>

    <View style={compatibilityStyles.content}>
      <View style={compatibilityStyles.iconContainer}>
        <Eye size={40} color="#f59e0b" />
      </View>
      
      <Text style={compatibilityStyles.title}>Compatibility Data Error</Text>
      <Text style={compatibilityStyles.subtitle}>
        Unable to load compatibility information. This could be due to a connection issue.
      </Text>
      
      <TouchableOpacity
        onPress={retry}
        style={compatibilityStyles.retryButton}
      >
        <RefreshCw size={20} color="white" style={compatibilityStyles.buttonIcon} />
        <Text style={compatibilityStyles.retryButtonText}>Reload Compatibility</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={compatibilityStyles.closeAction}>
        <X size={16} color="gray" style={compatibilityStyles.closeIcon} />
        <Text style={compatibilityStyles.closeText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// HOC wrappers for easy integration
export const withMatchPresentationErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & { onClose?: () => void }>((props, ref) => (
    <ErrorBoundary
      errorType="match-presentation"
      fallback={MatchPresentationErrorFallback}
      onClose={props.onClose}
      allowRetry={true}
      showErrorDetails={true}
    >
      <Component {...(props as P)} ref={ref} />
    </ErrorBoundary>
  ));
};

export const withMatchCardErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & { onCardError?: () => void }>((props, ref) => (
    <ErrorBoundary
      errorType="match-card"
      fallback={MatchCardErrorFallback}
      onClose={props.onCardError}
      allowRetry={true}
      showErrorDetails={false}
    >
      <Component {...(props as P)} ref={ref} />
    </ErrorBoundary>
  ));
};

export const withCompatibilityErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & { onCompatibilityError?: () => void }>((props, ref) => (
    <ErrorBoundary
      errorType="compatibility-screen"
      fallback={CompatibilityErrorFallback}
      onClose={props.onCompatibilityError}
      allowRetry={true}
      showErrorDetails={true}
    >
      <Component {...(props as P)} ref={ref} />
    </ErrorBoundary>
  ));
};

export const withMatchFlowErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & { onFlowError?: () => void }>((props, ref) => (
    <ErrorBoundary
      errorType="match-flow-manager"
      fallback={MatchPresentationErrorFallback}
      onClose={props.onFlowError}
      allowRetry={true}
      showErrorDetails={true}
      customMessage="The matching system encountered an error. Please try again."
    >
      <Component {...(props as P)} ref={ref} />
    </ErrorBoundary>
  ));
};

// Context Provider Error Boundary
export const PotentialMatchContextErrorBoundary: React.FC<{
  children: React.ReactNode;
  onContextError?: () => void;
}> = ({ children, onContextError }) => (
  <ErrorBoundary
    errorType="context-provider"
    allowRetry={true}
    showErrorDetails={true}
    onClose={onContextError}
    customMessage="Lost connection to the matching system. Retrying should restore functionality."
  >
    {children}
  </ErrorBoundary>
);

// Styles for matching-specific error boundaries
const matchingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 90,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
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
  },
  retryButton: {
    backgroundColor: '#22c55e',
  },
  closeButton: {
    backgroundColor: 'white',
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
});

const matchCardStyles = StyleSheet.create({
  container: {
    minHeight: 600,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    alignSelf: 'center',
    width: '90%',
    maxWidth: 400,
  },
  errorCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  retryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const compatibilityStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
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
    borderBottomWidth: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: 'white',
  },
  spacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 4,
    borderColor: 'black',
    borderBottomWidth: 8,
    padding: 32,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: 'black',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Geist-Regular',
  },
  closeAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeIcon: {
    marginRight: 4,
  },
  closeText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Geist-Regular',
  },
});

export default {
  MatchPresentationErrorFallback,
  MatchCardErrorFallback,
  CompatibilityErrorFallback,
  withMatchPresentationErrorBoundary,
  withMatchCardErrorBoundary,
  withCompatibilityErrorBoundary,
  withMatchFlowErrorBoundary,
  PotentialMatchContextErrorBoundary,
};