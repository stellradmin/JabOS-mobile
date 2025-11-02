// Error Context Type Definitions - STRICT TYPING, NO ANY TYPES
// Following all 10 Golden Code Principles

// ============= RECOVERY RESULT TYPES =============
// Single Responsibility: Each type represents one recovery outcome

export interface RecoveryResult {
  success: boolean;
  recoveredAt: Date;
  attempts: number;
  method: RecoveryMethod;
  data?: RecoveryData;
  error?: Error;
}

export type RecoveryMethod = 
  | 'retry'
  | 'circuit_breaker_reset'
  | 'cache_clear'
  | 'network_reconnect'
  | 'auth_refresh'
  | 'custom'
  | 'manual';

export interface RecoveryData {
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
}

// ============= ERROR REPORTING CONTEXT =============
// Meaningful Names: Clear context for error reporting

export interface ErrorReportContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  timestamp?: Date;
  environment?: 'development' | 'staging' | 'production';
  deviceInfo?: DeviceInfo;
  networkInfo?: NetworkInfo;
  metadata?: Record<string, unknown>;
}

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  deviceModel?: string;
  deviceId?: string;
}

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  isConnected: boolean;
  isInternetReachable: boolean;
  strength?: 'excellent' | 'good' | 'fair' | 'poor';
  carrier?: string;
}

// ============= CUSTOM RECOVERY ACTION TYPES =============
// Separation of Concerns: Recovery actions separate from error state

export type CustomRecoveryAction = () => Promise<RecoveryResult>;

export interface RecoveryActionConfig {
  maxAttempts?: number;
  timeout?: number;
  backoffStrategy?: 'linear' | 'exponential' | 'fibonacci';
  fallback?: () => Promise<RecoveryResult>;
}

// ============= TYPE GUARDS =============
// Defensive Programming: Runtime type validation

export function isRecoveryResult(obj: unknown): obj is RecoveryResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    'recoveredAt' in obj &&
    'attempts' in obj &&
    'method' in obj
  );
}

export function isErrorReportContext(obj: unknown): obj is ErrorReportContext {
  return (
    typeof obj === 'object' &&
    obj !== null
  );
}

export function isRecoveryData(obj: unknown): obj is RecoveryData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (
      'previousState' in obj ||
      'newState' in obj ||
      'changedFields' in obj ||
      'metadata' in obj
    )
  );
}