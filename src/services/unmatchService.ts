/**
 * Unmatch Service
 * 
 * Single Responsibility: Handles all unmatch and conversation deletion operations
 * Following Command Query Separation and Fail Fast principles
 */

import { supabase } from '../lib/supabase';
import { validateUserId, sanitizeInput } from '../utils/validation';
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Types for clarity and type safety
export interface UnmatchRequest {
  userId: string;
  otherUserId: string;
  reason?: UnmatchReason;
  metadata?: Record<string, any>;
}

export interface UnmatchResponse {
  success: boolean;
  matchId?: string;
  conversationId?: string;
  deletedAt?: string;
  message: string;
}

export interface DeleteConversationRequest {
  conversationId: string;
  hardDelete?: boolean;
}

export interface DeleteConversationResponse {
  success: boolean;
  conversationId: string;
  action: 'soft_delete' | 'hard_delete';
  deletedAt?: string;
  message: string;
}

export interface ArchiveConversationRequest {
  conversationId: string;
  archive: boolean;
}

export interface ArchiveConversationResponse {
  success: boolean;
  conversationId: string;
  archivedAt?: string;
  unarchivedAt?: string;
  message: string;
}

export type UnmatchReason = 
  | 'user_unmatch'
  | 'user_block'
  | 'admin_action'
  | 'policy_violation'
  | 'account_deletion';

// Error types for specific error handling
export class UnmatchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'UnmatchError';
  }
}

/**
 * Unmatch Service Class
 * Implements all unmatch-related operations with proper error handling
 */
class UnmatchService {
  /**
   * Unmatch two users
   * Command operation - performs action, doesn't return data
   */
  async unmatchUsers(request: UnmatchRequest): Promise<UnmatchResponse> {
    // Validate inputs (Fail Fast principle)
    this.validateUnmatchRequest(request);

    try {
      const { data, error } = await supabase.rpc('unmatch_users', {
        p_user_id: request.userId,
        p_other_user_id: request.otherUserId,
        p_reason: request.reason || 'user_unmatch',
        p_metadata: request.metadata || {}
      });

      if (error) {
        throw new UnmatchError(
          'Failed to unmatch users',
          error.code || 'UNMATCH_FAILED',
          error
        );
      }

      // Track success metric
      this.trackUnmatchEvent('success', request);

      return data as UnmatchResponse;
    } catch (error) {
      // Track error and re-throw
      this.handleUnmatchError(error as Error, request);
      throw error;
    }
  }

  /**
   * Delete a conversation
   * Command operation with optional hard delete
   */
  async deleteConversation(
    request: DeleteConversationRequest
  ): Promise<DeleteConversationResponse> {
    // Validate conversation ID
    if (!this.isValidUuid(request.conversationId)) {
      throw new UnmatchError(
        'Invalid conversation ID',
        'INVALID_CONVERSATION_ID'
      );
    }

    try {
      const { data, error } = await supabase.rpc('delete_conversation', {
        p_conversation_id: request.conversationId,
        p_hard_delete: request.hardDelete || false
      });

      if (error) {
        throw new UnmatchError(
          'Failed to delete conversation',
          error.code || 'DELETE_FAILED',
          error
        );
      }

      // Track deletion event
      this.trackConversationDeletion(request, data);

      return data as DeleteConversationResponse;
    } catch (error) {
      this.handleConversationError(error as Error, request);
      throw error;
    }
  }

  /**
   * Archive or unarchive a conversation
   * Command operation for conversation archival
   */
  async archiveConversation(
    request: ArchiveConversationRequest
  ): Promise<ArchiveConversationResponse> {
    // Validate conversation ID
    if (!this.isValidUuid(request.conversationId)) {
      throw new UnmatchError(
        'Invalid conversation ID',
        'INVALID_CONVERSATION_ID'
      );
    }

    try {
      const { data, error } = await supabase.rpc('archive_conversation', {
        p_conversation_id: request.conversationId,
        p_archive: request.archive
      });

      if (error) {
        throw new UnmatchError(
          `Failed to ${request.archive ? 'archive' : 'unarchive'} conversation`,
          error.code || 'ARCHIVE_FAILED',
          error
        );
      }

      return data as ArchiveConversationResponse;
    } catch (error) {
      this.handleArchiveError(error as Error, request);
      throw error;
    }
  }

  /**
   * Check if user can unmatch
   * Query operation - returns data, doesn't modify state
   */
  async canUnmatch(userId: string, otherUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, status, deleted_at')
        .or(
          `and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`
        )
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return false;
      }

      return data.status === 'active';
    } catch {
      return false;
    }
  }

  /**
   * Get deletion history for a user
   * Query operation for audit purposes
   */
  async getDeletionHistory(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('deletion_audit')
        .select('*')
        .eq('deleted_by', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logError('Failed to fetch deletion history:', "Error", error);
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  }

  // Private helper methods (following Single Responsibility)

  private validateUnmatchRequest(request: UnmatchRequest): void {
    if (!validateUserId(request.userId)) {
      throw new UnmatchError('Invalid user ID', 'INVALID_USER_ID');
    }

    if (!validateUserId(request.otherUserId)) {
      throw new UnmatchError('Invalid other user ID', 'INVALID_OTHER_USER_ID');
    }

    if (request.userId === request.otherUserId) {
      throw new UnmatchError(
        'Cannot unmatch from yourself',
        'SELF_UNMATCH_ATTEMPT'
      );
    }
  }

  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private trackUnmatchEvent(
    status: 'success' | 'failure',
    request: UnmatchRequest
  ): void {
    try {
      Sentry.addBreadcrumb({
        category: 'unmatch',
        message: `Unmatch ${status}`,
        level: status === 'success' ? 'info' : 'error',
        data: {
          userId: request.userId,
          otherUserId: request.otherUserId,
          reason: request.reason
        }
      });
    } catch {
      // Silently fail tracking to not break main flow
    }
  }

  private trackConversationDeletion(
    request: DeleteConversationRequest,
    response: any
  ): void {
    try {
      Sentry.addBreadcrumb({
        category: 'conversation',
        message: 'Conversation deleted',
        level: 'info',
        data: {
          conversationId: request.conversationId,
          hardDelete: request.hardDelete,
          action: response?.action
        }
      });
    } catch {
      // Silently fail tracking
    }
  }

  private handleUnmatchError(error: Error, request: UnmatchRequest): void {
    Sentry.captureException(error, {
      tags: {
        operation: 'unmatch',
        userId: request.userId
      },
      extra: request as unknown as Record<string, unknown>
    });

    this.trackUnmatchEvent('failure', request);
  }

  private handleConversationError(
    error: Error,
    request: DeleteConversationRequest
  ): void {
    Sentry.captureException(error, {
      tags: {
        operation: 'delete_conversation',
        conversationId: request.conversationId
      },
      extra: request as unknown as Record<string, unknown>
    });
  }

  private handleArchiveError(
    error: Error,
    request: ArchiveConversationRequest
  ): void {
    Sentry.captureException(error, {
      tags: {
        operation: 'archive_conversation',
        conversationId: request.conversationId,
        archive: request.archive
      },
      extra: request as unknown as Record<string, unknown>
    });
  }
}

// Export singleton instance (Dependency Injection pattern)
export const unmatchService = new UnmatchService();

// Export for testing and dependency injection
export default UnmatchService;
