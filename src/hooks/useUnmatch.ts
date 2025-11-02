/**
 * useUnmatch Hook
 * 
 * Single Responsibility: Encapsulate unmatch logic and state management
 * Following Custom Hook pattern and Separation of Concerns
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { unmatchService, UnmatchError } from '../services/unmatchService';
import { announceToScreenReader } from '../utils/accessibility';
import { useMessaging } from '../contexts/MessagingContext';
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export interface UseUnmatchOptions {
  onSuccess?: (action: string) => void;
  onError?: (error: Error) => void;
  showAlerts?: boolean;
  trackEvents?: boolean;
}

export interface UseUnmatchReturn {
  isUnmatching: boolean;
  isDeleting: boolean;
  isArchiving: boolean;
  error: string | null;
  canUnmatch: (userId: string, otherUserId: string) => Promise<boolean>;
  unmatch: (otherUserId: string, reason?: string) => Promise<boolean>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  archiveConversation: (conversationId: string, archive: boolean) => Promise<boolean>;
  clearError: () => void;
}

/**
 * useUnmatch Hook
 * Provides unmatch functionality with proper error handling and state management
 */
export const useUnmatch = (
  userId: string,
  options: UseUnmatchOptions = {}
): UseUnmatchReturn => {
  const {
    onSuccess,
    onError,
    showAlerts = true,
    trackEvents = true,
  } = options;

  const { unmatchUser, deleteConversation: deleteConv, archiveConversation: archiveConv } = useMessaging();

  // State management
  const [isUnmatching, setIsUnmatching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Generic error handler
  const handleError = useCallback((
    err: Error,
    action: string,
    context?: Record<string, any>
  ) => {
    const errorMessage = err instanceof UnmatchError ? err.message : `Failed to ${action}`;
    
    setError(errorMessage);
    
    if (showAlerts) {
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    }
    
    if (trackEvents) {
      Sentry.captureException(err, {
        tags: { operation: action, userId },
        extra: context
      });
    }
    
    announceToScreenReader(`Error: ${errorMessage}`, 'assertive');
    onError?.(err);
  }, [userId, showAlerts, trackEvents, onError]);

  // Generic success handler
  const handleSuccess = useCallback((action: string, message: string) => {
    setError(null);
    announceToScreenReader(message, 'assertive');
    onSuccess?.(action);
  }, [onSuccess]);

  // Check if user can unmatch
  const canUnmatch = useCallback(async (
    currentUserId: string,
    otherUserId: string
  ): Promise<boolean> => {
    try {
      return await unmatchService.canUnmatch(currentUserId, otherUserId);
    } catch (error) {
      logWarn('Failed to check unmatch eligibility:', "Warning", error);
      return false;
    }
  }, []);

  // Unmatch user
  const unmatch = useCallback(async (
    otherUserId: string,
    reason: string = 'user_unmatch'
  ): Promise<boolean> => {
    if (isUnmatching) return false;

    setIsUnmatching(true);
    clearError();

    try {
      const success = await unmatchUser(otherUserId);
      
      if (success) {
        handleSuccess('unmatch', 'Successfully unmatched');
        return true;
      } else {
        throw new UnmatchError('Unmatch operation failed', 'UNMATCH_FAILED');
      }
    } catch (error) {
      handleError(
        error as Error,
        'unmatch',
        { otherUserId, reason }
      );
      return false;
    } finally {
      setIsUnmatching(false);
    }
  }, [userId, isUnmatching, unmatchUser, clearError, handleSuccess, handleError]);

  // Delete conversation
  const deleteConversation = useCallback(async (
    conversationId: string
  ): Promise<boolean> => {
    if (isDeleting) return false;

    setIsDeleting(true);
    clearError();

    try {
      const success = await deleteConv(conversationId);
      
      if (success) {
        handleSuccess('delete', 'Conversation deleted successfully');
        return true;
      } else {
        throw new UnmatchError('Delete operation failed', 'DELETE_FAILED');
      }
    } catch (error) {
      handleError(
        error as Error,
        'delete conversation',
        { conversationId }
      );
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, deleteConv, clearError, handleSuccess, handleError]);

  // Archive/unarchive conversation
  const archiveConversation = useCallback(async (
    conversationId: string,
    archive: boolean
  ): Promise<boolean> => {
    if (isArchiving) return false;

    setIsArchiving(true);
    clearError();

    try {
      const success = await archiveConv(conversationId, archive);
      
      if (success) {
        const message = archive ? 'Conversation archived' : 'Conversation unarchived';
        handleSuccess(archive ? 'archive' : 'unarchive', message);
        return true;
      } else {
        throw new UnmatchError(
          `${archive ? 'Archive' : 'Unarchive'} operation failed`,
          'ARCHIVE_FAILED'
        );
      }
    } catch (error) {
      handleError(
        error as Error,
        archive ? 'archive conversation' : 'unarchive conversation',
        { conversationId, archive }
      );
      return false;
    } finally {
      setIsArchiving(false);
    }
  }, [isArchiving, archiveConv, clearError, handleSuccess, handleError]);

  return {
    isUnmatching,
    isDeleting,
    isArchiving,
    error,
    canUnmatch,
    unmatch,
    deleteConversation,
    archiveConversation,
    clearError,
  };
};

export default useUnmatch;
