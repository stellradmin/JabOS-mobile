// Memory-safe async operations management hook
// Automatically cancels all pending promises and async operations on unmount

import { useEffect, useRef, useCallback } from 'react';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface AsyncOperationRef {
  id: string;
  abortController?: AbortController;
  cleanup?: () => void;
  type: 'promise' | 'async-generator' | 'observable' | 'custom';
  startTime: number;
  description?: string;
}

interface AsyncOperationOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  description?: string;
}

export const useAsyncOperations = () => {
  const operationsRef = useRef<Map<string, AsyncOperationRef>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique operation ID
  const generateOperationId = useCallback((prefix: string = 'async') => {
    return `${prefix}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Create cancellable promise with automatic cleanup
  const createCancellablePromise = useCallback(<T>(
    promiseFactory: (signal: AbortSignal) => Promise<T>,
    options: AsyncOperationOptions = {}
  ): Promise<T> => {
    const {
      timeout = 30000,
      description = 'async-operation',
    } = options;

    const id = generateOperationId('promise');
    const abortController = new AbortController();
    const startTime = Date.now();

    // Set up timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    }

    // Store operation reference
    operationsRef.current.set(id, {
      id,
      abortController,
      type: 'promise',
      startTime,
      description,
      cleanup: () => {
        if (timeoutId) clearTimeout(timeoutId);
      },
    });

    // Create the actual promise
    const promise = promiseFactory(abortController.signal)
      .finally(() => {
        // Auto-cleanup on completion
        const operation = operationsRef.current.get(id);
        if (operation) {
          operation.cleanup?.();
          operationsRef.current.delete(id);
        }
        if (timeoutId) clearTimeout(timeoutId);
      });

    return promise;
  }, [generateOperationId]);

  // Create async generator with cleanup
  const createAsyncGenerator = useCallback(<T>(
    generatorFactory: (signal: AbortSignal) => AsyncGenerator<T, void, unknown>,
    options: AsyncOperationOptions = {}
  ) => {
    const {
      description = 'async-generator',
    } = options;

    const id = generateOperationId('generator');
    const abortController = new AbortController();
    const startTime = Date.now();

    // Store operation reference
    operationsRef.current.set(id, {
      id,
      abortController,
      type: 'async-generator',
      startTime,
      description,
    });

    const generator = generatorFactory(abortController.signal);

    // Return wrapped generator with cleanup
    return {
      [Symbol.asyncIterator]: () => generator,
      cancel: () => {
        abortController.abort();
        operationsRef.current.delete(id);
      },
      id,
    };
  }, [generateOperationId]);

  // Register custom async operation with cleanup function
  const registerAsyncOperation = useCallback((
    cleanup: () => void,
    options: AsyncOperationOptions & { id?: string } = {}
  ): string => {
    const {
      description = 'custom-operation',
      id: providedId,
    } = options;

    const id = providedId || generateOperationId('custom');
    const startTime = Date.now();

    operationsRef.current.set(id, {
      id,
      type: 'custom',
      startTime,
      description,
      cleanup,
    });

    return id;
  }, [generateOperationId]);

  // Cancel specific operation
  const cancelOperation = useCallback((operationId: string) => {
    const operation = operationsRef.current.get(operationId);
    if (!operation) return false;

    try {
      // Abort if it's an abortable operation
      if (operation.abortController) {
        operation.abortController.abort();
      }

      // Run custom cleanup
      operation.cleanup?.();

      operationsRef.current.delete(operationId);
      return true;
    } catch (error) {
      logError(`Error cancelling operation ${operationId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cancel all operations
  const cancelAllOperations = useCallback(() => {
    const operations = Array.from(operationsRef.current.entries());
    let cancelledCount = 0;

    for (const [id, operation] of operations) {
      try {
        // Abort if it's an abortable operation
        if (operation.abortController) {
          operation.abortController.abort();
        }

        // Run custom cleanup
        operation.cleanup?.();
        cancelledCount++;
      } catch (error) {
        logError(`Error cancelling operation ${id}:`, "Error", error);
      }
    }

    operationsRef.current.clear();
    return cancelledCount;
  }, []);

  // Get operation status and details
  const getOperationStatus = useCallback(() => {
    const operations = Array.from(operationsRef.current.values());
    
    return {
      total: operations.length,
      byType: operations.reduce((acc, op) => {
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      longRunning: operations.filter(op => 
        Date.now() - op.startTime > 10000 // 10+ seconds
      ),
      details: operations.map(op => ({
        id: op.id,
        type: op.type,
        description: op.description,
        duration: Date.now() - op.startTime,
        isAbortable: !!op.abortController,
      })),
    };
  }, []);

  // Specialized promise utilities
  const withRetry = useCallback(async <T>(
    promiseFactory: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    options: AsyncOperationOptions = {}
  ): Promise<T> => {
    return createCancellablePromise(async (signal) => {
      let lastError: Error | undefined;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal.aborted) {
          throw new Error('Operation was cancelled');
        }

        try {
          return await promiseFactory();
        } catch (error) {
          lastError = error as Error;
          
          if (attempt < maxRetries) {
            // Wait before retry, but respect cancellation
            await new Promise((resolve, reject) => {
              const timeoutId = setTimeout(resolve, delayMs * (attempt + 1));
              
              const abortHandler = () => {
                clearTimeout(timeoutId);
                reject(new Error('Retry cancelled'));
              };
              
              signal.addEventListener('abort', abortHandler, { once: true });
            });
          }
        }
      }
      
      throw lastError || new Error(`Failed after ${maxRetries + 1} attempts`);
    }, { ...options, description: `retry-${options.description || 'operation'}` });
  }, [createCancellablePromise]);

  const withTimeout = useCallback(<T>(
    promise: Promise<T>,
    timeoutMs: number,
    options: AsyncOperationOptions = {}
  ): Promise<T> => {
    return createCancellablePromise(async (signal) => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Operation was cancelled'));
        }, { once: true });
      });

      return Promise.race([promise, timeoutPromise]);
    }, { ...options, timeout: timeoutMs });
  }, [createCancellablePromise]);

  // Race with cancellation support
  const raceWithCancellation = useCallback(<T>(
    promises: Promise<T>[],
    options: AsyncOperationOptions = {}
  ): Promise<T> => {
    return createCancellablePromise(async (signal) => {
      const racePromise = Promise.race(promises);
      
      const cancellationPromise = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new Error('Race cancelled'));
        }, { once: true });
      });

      return Promise.race([racePromise, cancellationPromise]);
    }, { ...options, description: `race-${options.description || 'operation'}` });
  }, [createCancellablePromise]);

  // All with cancellation support
  const allWithCancellation = useCallback(<T>(
    promises: Promise<T>[],
    options: AsyncOperationOptions = {}
  ): Promise<T[]> => {
    return createCancellablePromise(async (signal) => {
      const allPromise = Promise.all(promises);
      
      const cancellationPromise = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new Error('Promise.all cancelled'));
        }, { once: true });
      });

      return Promise.race([allPromise, cancellationPromise]);
    }, { ...options, description: `all-${options.description || 'operation'}` });
  }, [createCancellablePromise]);

  // Cleanup all operations on unmount
  useEffect(() => {
    return () => {
      const cancelledCount = cancelAllOperations();
      if (__DEV__ && cancelledCount > 0) {
        logDebug(`🧹 Cleaned up ${cancelledCount} async operations on unmount`, "Debug");
      }
    };
  }, [cancelAllOperations]);

  return {
    // Core async operations
    createCancellablePromise,
    createAsyncGenerator,
    registerAsyncOperation,
    
    // Operation management
    cancelOperation,
    cancelAllOperations,
    getOperationStatus,
    
    // Promise utilities
    withRetry,
    withTimeout,
    raceWithCancellation,
    allWithCancellation,
  };
};

// Specialized hooks for common use cases

// Hook for data fetching with automatic cleanup
export const useDataFetching = () => {
  const { createCancellablePromise, withRetry, withTimeout } = useAsyncOperations();

  const fetchWithCleanup = useCallback(<T>(
    fetcher: (signal: AbortSignal) => Promise<T>,
    options: AsyncOperationOptions & {
      enableRetry?: boolean;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ) => {
    const {
      enableRetry = false,
      maxRetries = 3,
      retryDelay = 1000,
      timeout = 30000,
      ...restOptions
    } = options;

    if (enableRetry) {
      return withRetry(
        () => createCancellablePromise(fetcher, { timeout, ...restOptions }),
        maxRetries,
        retryDelay,
        restOptions
      );
    }

    return createCancellablePromise(fetcher, { timeout, ...restOptions });
  }, [createCancellablePromise, withRetry]);

  return { fetchWithCleanup };
};

// Hook for background tasks
export const useBackgroundTasks = () => {
  const { createAsyncGenerator, registerAsyncOperation } = useAsyncOperations();

  const createBackgroundTask = useCallback((
    taskFunction: (signal: AbortSignal) => Promise<void>,
    intervalMs: number = 5000,
    options: AsyncOperationOptions = {}
  ) => {
    return createAsyncGenerator(async function* (signal) {
      while (!signal.aborted) {
        try {
          yield await taskFunction(signal);
          
          // Wait for interval or cancellation
          await new Promise<void>((resolve) => {
            const timeoutId = setTimeout(resolve, intervalMs);
            signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              resolve();
            }, { once: true });
          });
        } catch (error) {
          if (signal.aborted) break;
          logError('Background task error:', "Error", error);
          
          // Wait before retry
          await new Promise<void>((resolve) => {
            const timeoutId = setTimeout(resolve, Math.min(intervalMs, 5000));
            signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              resolve();
            }, { once: true });
          });
        }
      }
    }, { ...options, description: `background-task-${options.description}` });
  }, [createAsyncGenerator]);

  return { createBackgroundTask };
};

// Development-only hook for async operation leak detection
export const useAsyncOperationLeakDetection = () => {
  const { getOperationStatus } = useAsyncOperations();

  useEffect(() => {
    if (__DEV__) {
      const checkInterval = setInterval(() => {
        const status = getOperationStatus();
        
        if (status.total > 20) { // Threshold for concern
          logWarn(`🚨 High async operation count: ${status.total} active operations`, "Warning");
          logDebug('Operation breakdown:', "Debug", status.byType);
          logDebug('Long running operations:', "Debug", status.longRunning);
        }

        if (status.longRunning.length > 0) {
          logWarn(`⏰ Long running operations detected: ${status.longRunning.length}`, "Warning");
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkInterval);
    }
  }, [getOperationStatus]);
};
