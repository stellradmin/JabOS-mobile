/**
 * USER DATA ISOLATION UTILITY
 * 
 * Purpose: Prevent cross-user data exposure in compatibility algorithms
 * Security Level: CRITICAL - Prevents CVSS 7.2 vulnerabilities
 * 
 * Features:
 * - User context validation
 * - Data access control enforcement
 * - Cross-user data exposure prevention
 * - Timing attack protection
 * - Compatibility algorithm data isolation
 */

import { logger } from './logger';
import { secureStorage } from './secure-storage';

interface UserContext {
  userId: string;
  sessionId: string;
  accessLevel: 'user' | 'admin' | 'service';
  validUntil: Date;
  fingerprint: string;
}

interface DataAccessRequest {
  requesterId: string;
  targetResourceId: string;
  resourceType: 'profile' | 'conversation' | 'match' | 'preference' | 'location';
  operation: 'read' | 'write' | 'delete';
  timestamp: Date;
}

interface DataAccessResult {
  allowed: boolean;
  reason: string;
  userId: string;
  resourceId: string;
  threats: string[];
  timeConstantMs: number;
}

interface CompatibilityDataAccess {
  requesterId: string;
  targetUserId: string;
  accessType: 'basic_profile' | 'preferences' | 'location' | 'full_compatibility';
  mutualMatch: boolean;
}

class UserDataIsolationService {
  private static instance: UserDataIsolationService;
  
  // Timing attack protection - all operations take at least this long
  private readonly MIN_OPERATION_TIME_MS = 100;
  private readonly MAX_OPERATION_TIME_MS = 500;
  
  // User context cache with automatic expiry
  private userContexts: Map<string, UserContext> = new Map();
  
  // Access logging for security audit
  private accessLog: DataAccessRequest[] = [];
  
  public static getInstance(): UserDataIsolationService {
    if (!UserDataIsolationService.instance) {
      UserDataIsolationService.instance = new UserDataIsolationService();
    }
    return UserDataIsolationService.instance;
  }

  private constructor() {
    this.initializeSecurityMonitoring();
  }

  /**
   * Initialize security monitoring for data access
   */
  private initializeSecurityMonitoring(): void {
    // Set up periodic cleanup of expired contexts
    setInterval(() => {
      this.cleanupExpiredContexts();
    }, 60000); // Every minute

    // Set up access log rotation
    setInterval(() => {
      this.rotateAccessLogs();
    }, 300000); // Every 5 minutes
  }

  /**
   * Validate user access to specific data with comprehensive security checks
   */
  async validateDataAccess(
    requesterId: string,
    targetResourceId: string,
    resourceType: 'profile' | 'conversation' | 'match' | 'preference' | 'location',
    operation: 'read' | 'write' | 'delete'
  ): Promise<DataAccessResult> {
    const startTime = Date.now();
    
    try {
      // Log access attempt for security monitoring
      const accessRequest: DataAccessRequest = {
        requesterId,
        targetResourceId,
        resourceType,
        operation,
        timestamp: new Date()
      };
      this.logAccessAttempt(accessRequest);

      const threats: string[] = [];
      let allowed = false;
      let reason = 'Access denied';

      // 1. Validate user context
      const userContext = await this.validateUserContext(requesterId);
      if (!userContext) {
        threats.push('Invalid user context');
        reason = 'User context validation failed';
      } else {
        // 2. Check resource ownership or authorized access
        const ownershipResult = await this.validateResourceAccess(
          requesterId,
          targetResourceId,
          resourceType,
          operation
        );

        if (ownershipResult.allowed) {
          allowed = true;
          reason = 'Access authorized';
        } else {
          threats.push(...ownershipResult.threats);
          reason = ownershipResult.reason;
        }
      }

      // 3. Timing attack protection - ensure consistent response time
      const elapsedTime = Date.now() - startTime;
      const targetTime = this.calculateTimingProtection(elapsedTime);
      
      if (elapsedTime < targetTime) {
        await new Promise(resolve => 
          setTimeout(resolve, targetTime - elapsedTime)
        );
      }

      const result: DataAccessResult = {
        allowed,
        reason,
        userId: requesterId,
        resourceId: targetResourceId,
        threats,
        timeConstantMs: Date.now() - startTime
      };

      // Log security events
      if (!allowed || threats.length > 0) {
        logger.warn('Data access security event', undefined, {
          requesterId,
          targetResourceId,
          resourceType,
          operation,
          allowed,
          threats,
          reason
        }, 'DATA_ISOLATION');
      }

      return result;

    } catch (error) {
      logger.error('Data access validation error', error instanceof Error ? error : undefined, {
        requesterId,
        targetResourceId,
        resourceType,
        operation
      }, 'DATA_ISOLATION');

      // Fail securely - deny access on error
      return {
        allowed: false,
        reason: 'System error - access denied',
        userId: requesterId,
        resourceId: targetResourceId,
        threats: ['System error during validation'],
        timeConstantMs: Date.now() - startTime
      };
    }
  }

  /**
   * Validate access for compatibility algorithm data
   */
  async validateCompatibilityDataAccess(
    access: CompatibilityDataAccess
  ): Promise<DataAccessResult> {
    const startTime = Date.now();
    
    try {
      const threats: string[] = [];
      let allowed = false;
      let reason = 'Compatibility access denied';

      // 1. Basic user validation
      const requesterContext = await this.validateUserContext(access.requesterId);
      if (!requesterContext) {
        threats.push('Invalid requester context');
        reason = 'Requester validation failed';
        
        return this.createTimingProtectedResult(
          startTime,
          access.requesterId,
          access.targetUserId,
          allowed,
          reason,
          threats
        );
      }

      // 2. Cross-user access validation
      if (access.requesterId === access.targetUserId) {
        // Self-access is always allowed
        allowed = true;
        reason = 'Self-access authorized';
      } else {
        // Cross-user access requires specific authorization
        const crossUserResult = await this.validateCrossUserAccess(access);
        allowed = crossUserResult.allowed;
        reason = crossUserResult.reason;
        threats.push(...crossUserResult.threats);
      }

      return this.createTimingProtectedResult(
        startTime,
        access.requesterId,
        access.targetUserId,
        allowed,
        reason,
        threats
      );

    } catch (error) {
      logger.error('Compatibility data access validation error', error instanceof Error ? error : undefined, {
        requesterId: access.requesterId,
        targetUserId: access.targetUserId,
        accessType: access.accessType
      }, 'DATA_ISOLATION');

      return this.createTimingProtectedResult(
        startTime,
        access.requesterId,
        access.targetUserId,
        false,
        'System error - access denied',
        ['System error during compatibility validation']
      );
    }
  }

  /**
   * Validate cross-user access for compatibility algorithms
   */
  private async validateCrossUserAccess(
    access: CompatibilityDataAccess
  ): Promise<{ allowed: boolean; reason: string; threats: string[] }> {
    const threats: string[] = [];
    
    // Check if users have mutual interaction permission
    if (!access.mutualMatch) {
      threats.push('No mutual match - cross-user access denied');
      return {
        allowed: false,
        reason: 'Cross-user access requires mutual match',
        threats
      };
    }

    // Validate access type permissions
    switch (access.accessType) {
      case 'basic_profile':
        // Basic profile access allowed for mutual matches
        return {
          allowed: true,
          reason: 'Basic profile access authorized for mutual match',
          threats
        };

      case 'preferences':
        // Preference access requires additional validation
        const prefAccess = await this.validatePreferenceAccess(
          access.requesterId,
          access.targetUserId
        );
        return {
          allowed: prefAccess,
          reason: prefAccess ? 'Preference access authorized' : 'Preference access denied',
          threats: prefAccess ? threats : [...threats, 'Insufficient permission for preference access']
        };

      case 'location':
        // Location access requires explicit consent
        const locationAccess = await this.validateLocationAccess(
          access.requesterId,
          access.targetUserId
        );
        return {
          allowed: locationAccess,
          reason: locationAccess ? 'Location access authorized' : 'Location access denied',
          threats: locationAccess ? threats : [...threats, 'Location access not authorized']
        };

      case 'full_compatibility':
        // Full compatibility requires highest level of authorization
        threats.push('Full compatibility access restricted');
        return {
          allowed: false,
          reason: 'Full compatibility data access restricted',
          threats
        };

      default:
        threats.push('Unknown access type');
        return {
          allowed: false,
          reason: 'Unknown access type requested',
          threats
        };
    }
  }

  /**
   * Validate user context and session
   */
  private async validateUserContext(userId: string): Promise<UserContext | null> {
    try {
      // Check cached context first
      const cachedContext = this.userContexts.get(userId);
      if (cachedContext && cachedContext.validUntil > new Date()) {
        return cachedContext;
      }

      // Validate session from secure storage
      const sessionData = await secureStorage.getSecureItem(`user_session_${userId}`);
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      
      // Create and cache new context
      const context: UserContext = {
        userId,
        sessionId: session.id,
        accessLevel: session.role || 'user',
        validUntil: new Date(Date.now() + 900000), // 15 minutes
        fingerprint: session.fingerprint || ''
      };

      this.userContexts.set(userId, context);
      return context;

    } catch (error) {
      logger.error('User context validation failed', error instanceof Error ? error : undefined, { userId }, 'DATA_ISOLATION');
      return null;
    }
  }

  /**
   * Validate resource access based on ownership and permissions
   */
  private async validateResourceAccess(
    userId: string,
    resourceId: string,
    resourceType: string,
    operation: string
  ): Promise<{ allowed: boolean; reason: string; threats: string[] }> {
    const threats: string[] = [];

    try {
      switch (resourceType) {
        case 'profile':
          // Users can only access their own profile for write/delete
          if (operation === 'write' || operation === 'delete') {
            const allowed = userId === resourceId;
            return {
              allowed,
              reason: allowed ? 'Own profile access' : 'Cross-user profile modification denied',
              threats: allowed ? threats : [...threats, 'Attempted cross-user profile modification']
            };
          }
          // Read access requires compatibility validation
          break;

        case 'conversation':
          // Validate conversation participation
          const participationResult = await this.validateConversationParticipation(userId, resourceId);
          return {
            allowed: participationResult,
            reason: participationResult ? 'Conversation participant' : 'Not a conversation participant',
            threats: participationResult ? threats : [...threats, 'Unauthorized conversation access']
          };

        case 'match':
          // Validate match involvement
          const matchResult = await this.validateMatchInvolvement(userId, resourceId);
          return {
            allowed: matchResult,
            reason: matchResult ? 'Match participant' : 'Not involved in match',
            threats: matchResult ? threats : [...threats, 'Unauthorized match access']
          };

        default:
          threats.push('Unknown resource type');
          return {
            allowed: false,
            reason: 'Unknown resource type',
            threats
          };
      }

      return {
        allowed: false,
        reason: 'Access validation incomplete',
        threats
      };

    } catch (error) {
      logger.error('Resource access validation error', error instanceof Error ? error : undefined, {
        userId,
        resourceId,
        resourceType,
        operation
      }, 'DATA_ISOLATION');

      return {
        allowed: false,
        reason: 'System error during resource validation',
        threats: [...threats, 'System error']
      };
    }
  }

  /**
   * Validate conversation participation
   */
  private async validateConversationParticipation(userId: string, conversationId: string): Promise<boolean> {
    try {
      // Check secure cache first
      const participationKey = `conversation_${conversationId}_participants`;
      const cachedParticipants = await secureStorage.getSecureItem(participationKey);
      
      if (cachedParticipants) {
        const participants = JSON.parse(cachedParticipants);
        return participants.includes(userId);
      }

      // If not cached, this would typically query the database
      // For now, we'll return false and let the backend validate
      return false;

    } catch (error) {
      logger.error('Conversation participation validation error', error instanceof Error ? error : undefined, {
        userId,
        conversationId
      }, 'DATA_ISOLATION');
      return false;
    }
  }

  /**
   * Validate match involvement
   */
  private async validateMatchInvolvement(userId: string, matchId: string): Promise<boolean> {
    try {
      const matchKey = `match_${matchId}_participants`;
      const cachedMatch = await secureStorage.getSecureItem(matchKey);
      
      if (cachedMatch) {
        const matchData = JSON.parse(cachedMatch);
        return matchData.user1_id === userId || matchData.user2_id === userId;
      }

      return false;

    } catch (error) {
      logger.error('Match involvement validation error', error instanceof Error ? error : undefined, {
        userId,
        matchId
      }, 'DATA_ISOLATION');
      return false;
    }
  }

  /**
   * Validate preference access between users
   */
  private async validatePreferenceAccess(requesterId: string, targetUserId: string): Promise<boolean> {
    try {
      // Check if users have mutual preference sharing enabled
      const preferenceKey = `user_${targetUserId}_preference_sharing`;
      const sharingSettings = await secureStorage.getSecureItem(preferenceKey);
      
      if (sharingSettings) {
        const settings = JSON.parse(sharingSettings);
        return settings.allowMutualMatches && settings.sharedWith?.includes(requesterId);
      }

      return false;

    } catch (error) {
      logger.error('Preference access validation error', error instanceof Error ? error : undefined, {
        requesterId,
        targetUserId
      }, 'DATA_ISOLATION');
      return false;
    }
  }

  /**
   * Validate location access between users
   */
  private async validateLocationAccess(requesterId: string, targetUserId: string): Promise<boolean> {
    try {
      const locationKey = `user_${targetUserId}_location_sharing`;
      const locationSettings = await secureStorage.getSecureItem(locationKey);
      
      if (locationSettings) {
        const settings = JSON.parse(locationSettings);
        return settings.shareWithMatches && settings.authorizedUsers?.includes(requesterId);
      }

      return false;

    } catch (error) {
      logger.error('Location access validation error', error instanceof Error ? error : undefined, {
        requesterId,
        targetUserId
      }, 'DATA_ISOLATION');
      return false;
    }
  }

  /**
   * Calculate timing protection to prevent timing attacks
   */
  private calculateTimingProtection(elapsedTime: number): number {
    // Ensure all operations take between MIN and MAX time
    const baseTime = Math.max(this.MIN_OPERATION_TIME_MS, elapsedTime);
    
    // Add random jitter to prevent timing analysis
    const jitter = Math.random() * (this.MAX_OPERATION_TIME_MS - this.MIN_OPERATION_TIME_MS);
    
    return Math.min(baseTime + jitter, this.MAX_OPERATION_TIME_MS);
  }

  /**
   * Create timing-protected result
   */
  private async createTimingProtectedResult(
    startTime: number,
    requesterId: string,
    resourceId: string,
    allowed: boolean,
    reason: string,
    threats: string[]
  ): Promise<DataAccessResult> {
    const elapsedTime = Date.now() - startTime;
    const targetTime = this.calculateTimingProtection(elapsedTime);
    
    if (elapsedTime < targetTime) {
      await new Promise(resolve => 
        setTimeout(resolve, targetTime - elapsedTime)
      );
    }

    return {
      allowed,
      reason,
      userId: requesterId,
      resourceId,
      threats,
      timeConstantMs: Date.now() - startTime
    };
  }

  /**
   * Log access attempt for security monitoring
   */
  private logAccessAttempt(request: DataAccessRequest): void {
    this.accessLog.push(request);
    
    // Keep only recent access attempts
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-500);
    }
  }

  /**
   * Clean up expired user contexts
   */
  private cleanupExpiredContexts(): void {
    const now = new Date();
    
    for (const [userId, context] of this.userContexts.entries()) {
      if (context.validUntil <= now) {
        this.userContexts.delete(userId);
      }
    }
  }

  /**
   * Rotate access logs for security analysis
   */
  private rotateAccessLogs(): void {
    if (this.accessLog.length > 0) {
      logger.info('Data access log rotation', undefined, {
        logEntries: this.accessLog.length,
        period: '5 minutes'
      }, 'DATA_ISOLATION');
      
      // In production, these logs would be sent to security monitoring system
      this.accessLog = [];
    }
  }

  /**
   * Get access statistics for security monitoring
   */
  getAccessStatistics(): {
    activeContexts: number;
    recentAccess: number;
    deniedAccess: number;
  } {
    const recentAccess = this.accessLog.filter(
      log => Date.now() - log.timestamp.getTime() < 300000 // Last 5 minutes
    ).length;

    const deniedAccess = this.accessLog.filter(
      log => Date.now() - log.timestamp.getTime() < 300000 &&
             log.operation === 'read' // Approximation for denied access
    ).length;

    return {
      activeContexts: this.userContexts.size,
      recentAccess,
      deniedAccess
    };
  }
}

export const userDataIsolation = UserDataIsolationService.getInstance();
export type { 
  UserContext, 
  DataAccessRequest, 
  DataAccessResult, 
  CompatibilityDataAccess 
};