// Potential Match Type Definitions - STRICT TYPING, NO ANY TYPES
// Following all 10 Golden Code Principles

// ============= CIRCUIT BREAKER TYPES =============
// Single Responsibility: Circuit breaker state management

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number;
  threshold?: number;
  timeout?: number;
}

// ============= OPERATION TYPES =============
// Meaningful Names: Clear operation types for retry logic

export type OperationType = 'fetch' | 'accept' | 'decline';

export interface LastOperationDetails {
  type: OperationType;
  params: OperationParams;
  timestamp?: Date;
  attemptCount?: number;
}

export interface OperationParams {
  matchRequestId?: string;
  userId?: string;
  matchId?: string;
  metadata?: Record<string, unknown>;
}

// ============= ERROR CONTEXT TYPES =============
// Defensive Programming: Strong typing for error contexts

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  matchRequestId?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

// ============= TYPE GUARDS =============
// Security by Design: Runtime type validation

export function isCircuitBreakerState(obj: unknown): obj is CircuitBreakerState {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'state' in obj &&
    'failures' in obj &&
    'lastFailureTime' in obj &&
    typeof (obj as CircuitBreakerState).failures === 'number'
  );
}

export function isOperationParams(obj: unknown): obj is OperationParams {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (
      'matchRequestId' in obj ||
      'userId' in obj ||
      'matchId' in obj ||
      'metadata' in obj
    )
  );
}

export function isErrorContext(obj: unknown): obj is ErrorContext {
  return (
    typeof obj === 'object' &&
    obj !== null
  );
}