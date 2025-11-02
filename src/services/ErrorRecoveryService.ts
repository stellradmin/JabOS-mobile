/**
 * Enhanced Error Recovery Service
 * Implements intelligent retry logic and automatic fallback strategies
 * Follows the Single Responsibility Principle for error recovery management
 */
import { StellerError, RecoveryStrategy, ErrorCategory, ErrorSeverity } from '../types/error-types';
import { trackError, trackCriticalError } from '../lib/sentry-enhanced';
import { secureStorage } from '../utils/secure-storage';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// Recovery attempt configuration
interface RecoveryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitterEnabled: boolean;
  enableFallback: boolean;
  fallbackTimeout: number;
}

// Recovery attempt tracking
interface RecoveryAttempt {
  attemptId: string;
  errorId: string;
  strategy: RecoveryStrategy;
  timestamp: Date;
  success: boolean;
  duration?: number;
  failureReason?: string;
}

// Recovery state for tracking ongoing recoveries
interface RecoveryState {
  errorId: string;
  currentStrategy: RecoveryStrategy;
  attemptCount: number;
  lastAttemptTime: Date;
  isRecovering: boolean;
  recoveryHistory: RecoveryAttempt[];
  fallbackData?: any;
}

// Recovery action definition
interface RecoveryAction {
  execute: () => Promise<any>;
  rollback?: () => Promise<void>;
  validate?: (result: any) => boolean;
  timeout?: number;
}

// Recovery context for sharing data between attempts
interface RecoveryContext {
  originalError: StellerError;
  userContext?: {
    userId?: string;
    sessionId?: string;
    feature?: string;
  };
  technicalContext?: {
    networkStatus?: 'online' | 'offline' | 'poor';
    memoryPressure?: 'normal' | 'moderate' | 'critical';
    batteryLevel?: number;
  };
  metadata?: Record<string, any>;
}

class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryStates = new Map<string, RecoveryState>();
  private recoveryActions = new Map<RecoveryStrategy, RecoveryAction>();
  private defaultConfig: RecoveryConfig;

  private constructor() {
    this.defaultConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBackoff: true,
      jitterEnabled: true,
      enableFallback: true,
      fallbackTimeout: 10000,
    };

    this.initializeRecoveryActions();
  }

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Initialize predefined recovery actions
   * Each action follows the Command pattern for consistency
   */
  private initializeRecoveryActions(): void {
    // Retry strategy
    this.recoveryActions.set('retry', {
      execute: async () => {
        // Generic retry - will be overridden by specific implementation
        throw new Error('Retry action must be provided by caller');
      },
      validate: (result) => result !== null && result !== undefined,
      timeout: 15000,
    });

    // Fallback strategy
    this.recoveryActions.set('fallback', {
      execute: async () => {
        // Load cached or default data
        return await this.loadFallbackData();
      },
      validate: (result) => result !== null,
      timeout: 5000,
    });

    // Refresh auth strategy
    this.recoveryActions.set('refresh-auth', {
      execute: async () => {
        // Attempt to refresh authentication token
        return await this.refreshAuthToken();
      },
      validate: (result) => result?.accessToken !== undefined,
      timeout: 10000,
    });

    // Navigate back strategy
    this.recoveryActions.set('navigate-back', {
      execute: async () => {
        // Navigate to previous screen or safe state
        return await this.navigateToSafeState();
      },
      validate: () => true, // Navigation is always considered successful
      timeout: 1000,
    });

    // Clear state strategy
    this.recoveryActions.set('clear-state', {
      execute: async () => {
        // Clear problematic app state
        return await this.clearApplicationState();
      },
      validate: () => true,
      timeout: 3000,
    });
  }

  /**
   * Main entry point for error recovery
   * Implements the Strategy pattern for different recovery approaches
   */
  async attemptRecovery(
    error: StellerError,
    context: RecoveryContext,
    customAction?: () => Promise<any>,
    config?: Partial<RecoveryConfig>
  ): Promise<{
    success: boolean;
    result?: any;
    strategy: RecoveryStrategy;
    attemptCount: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const recoveryConfig = { ...this.defaultConfig, ...config };
    const errorId = error.id;

    // Get or create recovery state
    let recoveryState = this.recoveryStates.get(errorId);
    if (!recoveryState) {
      recoveryState = {
        errorId,
        currentStrategy: error.recoveryStrategy,
        attemptCount: 0,
        lastAttemptTime: new Date(),
        isRecovering: false,
        recoveryHistory: [],
        fallbackData: null,
      };
      this.recoveryStates.set(errorId, recoveryState);
    }

    // Check if we've exceeded retry limits
    if (recoveryState.attemptCount >= recoveryConfig.maxRetries) {
      return await this.handleRecoveryFailure(error, context, recoveryState);
    }

    // Mark as recovering
    recoveryState.isRecovering = true;
    recoveryState.attemptCount++;
    recoveryState.lastAttemptTime = new Date();

    const attemptId = `${errorId}-${recoveryState.attemptCount}`;

    try {
      // Calculate delay before retry
      const delay = this.calculateRetryDelay(
        recoveryState.attemptCount,
        recoveryConfig
      );

      if (delay > 0) {
        await this.sleep(delay);
      }

      // Execute recovery strategy
      const result = await this.executeRecoveryStrategy(
        error.recoveryStrategy,
        context,
        customAction,
        recoveryConfig
      );

      // Record successful recovery
      const duration = Date.now() - startTime;
      const attempt: RecoveryAttempt = {
        attemptId,
        errorId,
        strategy: error.recoveryStrategy,
        timestamp: new Date(),
        success: true,
        duration,
      };

      recoveryState.recoveryHistory.push(attempt);
      recoveryState.isRecovering = false;

      // Clean up successful recovery
      this.recoveryStates.delete(errorId);

      return {
        success: true,
        result,
        strategy: error.recoveryStrategy,
        attemptCount: recoveryState.attemptCount,
        duration,
      };
    } catch (recoveryError) {
      // Record failed recovery attempt
      const duration = Date.now() - startTime;
      const attempt: RecoveryAttempt = {
        attemptId,
        errorId,
        strategy: error.recoveryStrategy,
        timestamp: new Date(),
        success: false,
        duration,
        failureReason: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
      };

      recoveryState.recoveryHistory.push(attempt);
      recoveryState.isRecovering = false;

      // Track recovery failure
      trackError(recoveryError as Error, {
        recovery_attempt: attemptId,
        original_error_id: errorId,
        recovery_strategy: error.recoveryStrategy,
        attempt_count: recoveryState.attemptCount,
      });

      // Try alternative strategy or fail
      return await this.handleRecoveryAttemptFailure(
        error,
        context,
        recoveryState,
        recoveryError as Error,
        recoveryConfig
      );
    }
  }

  /**
   * Execute specific recovery strategy
   * Each strategy is isolated and follows the Command pattern
   */
  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    context: RecoveryContext,
    customAction?: () => Promise<any>,
    config?: RecoveryConfig
  ): Promise<any> {
    const action = this.recoveryActions.get(strategy);
    
    if (!action) {
      throw new Error(`No recovery action defined for strategy: ${strategy}`);
    }

    // Use custom action if provided, otherwise use predefined action
    const executeAction = customAction || action.execute;
    const timeout = config?.fallbackTimeout || action.timeout || 10000;

    // Execute with timeout
    const result = await this.withTimeout(executeAction(), timeout);

    // Validate result if validator is available
    if (action.validate && !action.validate(result)) {
      throw new Error('Recovery action result validation failed');
    }

    return result;
  }

  /**
   * Handle failure of a recovery attempt
   * Implements escalation strategies
   */
  private async handleRecoveryAttemptFailure(
    error: StellerError,
    context: RecoveryContext,
    recoveryState: RecoveryState,
    recoveryError: Error,
    config: RecoveryConfig
  ): Promise<{
    success: boolean;
    result?: any;
    strategy: RecoveryStrategy;
    attemptCount: number;
    duration: number;
  }> {
    // Try alternative recovery strategy
    const alternativeStrategy = this.getAlternativeStrategy(
      error.recoveryStrategy,
      error.category,
      recoveryState.attemptCount
    );

    if (alternativeStrategy && recoveryState.attemptCount < config.maxRetries) {
      // Update strategy and try again
      const alternativeError: StellerError = {
        ...error,
        recoveryStrategy: alternativeStrategy,
      };

      return await this.attemptRecovery(alternativeError, context, undefined, config);
    }

    // All recovery attempts failed
    return await this.handleRecoveryFailure(error, context, recoveryState);
  }

  /**
   * Handle complete recovery failure
   * Implements graceful degradation
   */
  private async handleRecoveryFailure(
    error: StellerError,
    context: RecoveryContext,
    recoveryState: RecoveryState
  ): Promise<{
    success: boolean;
    result?: any;
    strategy: RecoveryStrategy;
    attemptCount: number;
    duration: number;
  }> {
    // Track critical recovery failure
    trackCriticalError(new Error('Recovery failed completely'), {
      original_error_id: error.id,
      recovery_attempts: recoveryState.attemptCount,
      recovery_history: recoveryState.recoveryHistory,
      last_strategy: recoveryState.currentStrategy,
    });

    // Clean up failed recovery state
    recoveryState.isRecovering = false;
    this.recoveryStates.delete(error.id);

    // Try to provide fallback data if available
    const fallbackData = await this.loadFallbackData(error.category);

    return {
      success: false,
      result: fallbackData,
      strategy: error.recoveryStrategy,
      attemptCount: recoveryState.attemptCount,
      duration: 0,
    };
  }

  /**
   * Get alternative recovery strategy based on error type and attempt count
   */
  private getAlternativeStrategy(
    currentStrategy: RecoveryStrategy,
    category: ErrorCategory,
    attemptCount: number
  ): RecoveryStrategy | null {
    // Strategy escalation matrix
    const strategyEscalation: Record<ErrorCategory, RecoveryStrategy[]> = {
      network: ['retry', 'fallback'],
      authentication: ['refresh-auth', 'navigate-back'],
      authorization: ['refresh-auth', 'navigate-back'],
      validation: ['retry', 'clear-state'],
      'compatibility-calculation': ['retry', 'fallback'],
      'matching-system': ['retry', 'fallback'],
      'data-parsing': ['retry', 'fallback'],
      animation: ['retry', 'clear-state'],
      'user-interaction': ['retry', 'clear-state'],
      'file-upload': ['retry', 'fallback'],
      'location-services': ['retry', 'fallback'],
      performance: ['clear-state', 'fallback'],
      'external-service': ['retry', 'fallback'],
      database: ['retry', 'fallback'],
      'rate-limiting': ['retry', 'fallback'],
      unknown: ['retry', 'fallback'],
    };

    const strategies = strategyEscalation[category] || ['retry', 'fallback'];
    const currentIndex = strategies.indexOf(currentStrategy);
    
    if (currentIndex >= 0 && currentIndex < strategies.length - 1) {
      return strategies[currentIndex + 1];
    }

    return null;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attemptCount: number, config: RecoveryConfig): number {
    if (attemptCount <= 1) return 0;

    let delay = config.baseDelay;

    if (config.exponentialBackoff) {
      delay = config.baseDelay * Math.pow(2, attemptCount - 2);
    }

    // Apply jitter to prevent thundering herd
    if (config.jitterEnabled) {
      delay += Math.random() * (delay * 0.1);
    }

    return Math.min(delay, config.maxDelay);
  }

  /**
   * Load fallback data from cache or default values
   */
  private async loadFallbackData(category?: ErrorCategory): Promise<any> {
    try {
      const cacheKey = `fallback_data_${category || 'general'}`;
      const cachedData = await secureStorage.getSecureItem(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Return category-specific default data
      return this.getDefaultFallbackData(category);
    } catch (error) {
      logWarn('Failed to load fallback data:', "Warning", error);
      return null;
    }
  }

  /**
   * Get default fallback data for different categories
   */
  private getDefaultFallbackData(category?: ErrorCategory): any {
    const defaultData: Record<ErrorCategory, any> = {
      'matching-system': { matches: [], hasMore: false },
      'compatibility-calculation': { score: 0, factors: [] },
      network: { cached: true, stale: true },
      authentication: null,
      authorization: null,
      validation: null,
      'data-parsing': null,
      animation: null,
      'user-interaction': null,
      'file-upload': null,
      'location-services': null,
      performance: null,
      'external-service': null,
      database: null,
      'rate-limiting': null,
      unknown: null,
    };

    return category ? defaultData[category] : null;
  }

  /**
   * Refresh authentication token
   */
  private async refreshAuthToken(): Promise<any> {
    try {
      // This would integrate with your auth service
      // For now, return a placeholder
      return { accessToken: 'refreshed_token', refreshToken: 'new_refresh_token' };
    } catch (error) {
      throw new Error('Failed to refresh authentication token');
    }
  }

  /**
   * Navigate to safe state
   */
  private async navigateToSafeState(): Promise<any> {
    try {
      // This would integrate with your navigation service
      // For now, return a placeholder
      return { navigated: true, screen: 'safe_state' };
    } catch (error) {
      throw new Error('Failed to navigate to safe state');
    }
  }

  /**
   * Clear application state
   */
  private async clearApplicationState(): Promise<any> {
    try {
      // Clear non-essential cached data
      const keysToRemove = [
        'temp_data',
        'ui_state',
        'search_cache',
        'image_cache',
      ];

      await Promise.all(
        keysToRemove.map(key => secureStorage.deleteSecureItem(key))
      );

      return { cleared: true, keys: keysToRemove };
    } catch (error) {
      throw new Error('Failed to clear application state');
    }
  }

  /**
   * Execute operation with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current recovery state for monitoring
   */
  getRecoveryState(errorId: string): RecoveryState | undefined {
    return this.recoveryStates.get(errorId);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    activeRecoveries: number;
    totalRecoveries: number;
    successRate: number;
  } {
    const activeRecoveries = Array.from(this.recoveryStates.values())
      .filter(state => state.isRecovering).length;

    const allAttempts = Array.from(this.recoveryStates.values())
      .flatMap(state => state.recoveryHistory);

    const successfulAttempts = allAttempts.filter(attempt => attempt.success).length;

    return {
      activeRecoveries,
      totalRecoveries: allAttempts.length,
      successRate: allAttempts.length > 0 ? successfulAttempts / allAttempts.length : 0,
    };
  }

  /**
   * Clear all recovery states (for testing or reset)
   */
  clearAllRecoveryStates(): void {
    this.recoveryStates.clear();
  }
}

export default ErrorRecoveryService;
export { RecoveryConfig, RecoveryContext, RecoveryAttempt, RecoveryState };
