// Memory-safe network request management hook
// Automatically cancels all pending HTTP requests on unmount
// Integrates with existing Supabase and API services

import { useEffect, useRef, useCallback } from 'react';
import { useAsyncOperations } from './useAsyncOperations';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface NetworkRequestRef {
  id: string;
  url: string;
  method: string;
  abortController: AbortController;
  startTime: number;
  timeout?: NodeJS.Timeout;
  retryCount: number;
  maxRetries: number;
}

interface NetworkRequestOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  requestPriority?: 'low' | 'normal' | 'high';
  cacheStrategy?: 'no-cache' | 'cache-first' | 'network-first';
  description?: string;
}

interface RequestCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export const useNetworkRequests = () => {
  const requestsRef = useRef<Map<string, NetworkRequestRef>>(new Map());
  const cacheRef = useRef<Map<string, RequestCacheEntry>>(new Map());
  const nextIdRef = useRef(0);
  const { createCancellablePromise, registerAsyncOperation } = useAsyncOperations();

  // Generate unique request ID
  const generateRequestId = useCallback((method: string, url: string) => {
    return `${method.toLowerCase()}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Create cache key from request parameters
  const createCacheKey = useCallback((url: string, method: string, body?: any) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyStr}`;
  }, []);

  // Check cache for existing data
  const getCachedData = useCallback((cacheKey: string): any | null => {
    const entry = cacheRef.current.get(cacheKey);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      cacheRef.current.delete(cacheKey);
      return null;
    }

    return entry.data;
  }, []);

  // Store data in cache
  const setCachedData = useCallback((cacheKey: string, data: any, ttl: number = 300000) => { // 5 min default
    cacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }, []);

  // Enhanced fetch with automatic cleanup and retry logic
  const safeFetch = useCallback(async <T = any>(
    url: string,
    options: RequestInit & NetworkRequestOptions = {}
  ): Promise<T> => {
    const {
      method = 'GET',
      timeout = 30000,
      retryCount = 0,
      retryDelay = 1000,
      cacheStrategy = 'network-first',
      headers = {},
      requestPriority = 'normal',
      description,
      ...fetchOptions
    } = options;

    const requestId = generateRequestId(method, url);
    const cacheKey = createCacheKey(url, method, fetchOptions.body);

    // Handle cache strategies
    if (cacheStrategy === 'cache-first' || cacheStrategy === 'network-first') {
      const cachedData = getCachedData(cacheKey);
      if (cachedData && cacheStrategy === 'cache-first') {
        return cachedData;
      }
    }

    return createCancellablePromise<T>(async (signal) => {
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          abortController.abort(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
      }

      // Forward cancellation from parent signal
      if (signal.aborted) {
        throw new Error('Request was cancelled before starting');
      }

      signal.addEventListener('abort', () => {
        abortController.abort();
        if (timeoutId) clearTimeout(timeoutId);
      }, { once: true });

      // Store request reference
      const requestRef: NetworkRequestRef = {
        id: requestId,
        url,
        method,
        abortController,
        startTime: Date.now(),
        timeout: timeoutId,
        retryCount: 0,
        maxRetries: retryCount,
      };

      requestsRef.current.set(requestId, requestRef);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache successful responses
        if (cacheStrategy !== 'no-cache' && method === 'GET') {
          setCachedData(cacheKey, data);
        }

        return data;
      } catch (error) {
        // Handle retry logic
        if (requestRef.retryCount < requestRef.maxRetries && !signal.aborted) {
          requestRef.retryCount++;
          
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, requestRef.retryCount - 1);
          
          await new Promise<void>((resolve) => {
            const retryTimeoutId = setTimeout(resolve, delay);
            signal.addEventListener('abort', () => {
              clearTimeout(retryTimeoutId);
              resolve();
            }, { once: true });
          });

          if (!signal.aborted) {
            // Recursive retry
            return safeFetch(url, { ...options, retryCount: retryCount - 1 });
          }
        }

        throw error;
      } finally {
        // Cleanup
        if (timeoutId) clearTimeout(timeoutId);
        requestsRef.current.delete(requestId);
      }
    }, {
      timeout: 0, // We handle timeout internally
      description: description || `${method} ${url}`,
    });
  }, [createCancellablePromise, generateRequestId, createCacheKey, getCachedData, setCachedData]);

  // Specialized HTTP methods
  const get = useCallback(<T = any>(url: string, options: NetworkRequestOptions = {}) => {
    return safeFetch<T>(url, { ...options, method: 'GET' });
  }, [safeFetch]);

  const post = useCallback(<T = any>(url: string, data?: any, options: NetworkRequestOptions = {}) => {
    return safeFetch<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [safeFetch]);

  const put = useCallback(<T = any>(url: string, data?: any, options: NetworkRequestOptions = {}) => {
    return safeFetch<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [safeFetch]);

  const patch = useCallback(<T = any>(url: string, data?: any, options: NetworkRequestOptions = {}) => {
    return safeFetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }, [safeFetch]);

  const del = useCallback(<T = any>(url: string, options: NetworkRequestOptions = {}) => {
    return safeFetch<T>(url, { ...options, method: 'DELETE' });
  }, [safeFetch]);

  // Cancel specific request
  const cancelRequest = useCallback((requestId: string) => {
    const request = requestsRef.current.get(requestId);
    if (!request) return false;

    try {
      request.abortController.abort();
      if (request.timeout) clearTimeout(request.timeout);
      requestsRef.current.delete(requestId);
      return true;
    } catch (error) {
      logError(`Error cancelling request ${requestId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cancel all pending requests
  const cancelAllRequests = useCallback(() => {
    const requests = Array.from(requestsRef.current.values());
    let cancelledCount = 0;

    for (const request of requests) {
      try {
        request.abortController.abort();
        if (request.timeout) clearTimeout(request.timeout);
        cancelledCount++;
      } catch (error) {
        logError(`Error cancelling request ${request.id}:`, "Error", error);
      }
    }

    requestsRef.current.clear();
    return cancelledCount;
  }, []);

  // Get active requests status
  const getRequestStatus = useCallback(() => {
    const requests = Array.from(requestsRef.current.values());
    
    return {
      total: requests.length,
      byMethod: requests.reduce((acc, req) => {
        acc[req.method] = (acc[req.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      longRunning: requests.filter(req => 
        Date.now() - req.startTime > 10000 // 10+ seconds
      ),
      withRetries: requests.filter(req => req.retryCount > 0),
      details: requests.map(req => ({
        id: req.id,
        url: req.url,
        method: req.method,
        duration: Date.now() - req.startTime,
        retryCount: req.retryCount,
        maxRetries: req.maxRetries,
      })),
    };
  }, []);

  // Clear cache
  const clearCache = useCallback((pattern?: string) => {
    if (!pattern) {
      cacheRef.current.clear();
      return;
    }

    const keysToDelete = Array.from(cacheRef.current.keys())
      .filter(key => key.includes(pattern));
    
    keysToDelete.forEach(key => cacheRef.current.delete(key));
  }, []);

  // Get cache status
  const getCacheStatus = useCallback(() => {
    const entries = Array.from(cacheRef.current.entries());
    const now = Date.now();
    
    return {
      total: entries.length,
      expired: entries.filter(([_, entry]) => now - entry.timestamp > entry.ttl).length,
      totalSize: JSON.stringify(entries).length, // Rough size estimate
      oldestEntry: entries.reduce((oldest, [key, entry]) => {
        return !oldest || entry.timestamp < oldest.timestamp ? entry : oldest;
      }, null as RequestCacheEntry | null),
    };
  }, []);

  // Batch requests with automatic deduplication
  const batchRequests = useCallback(async <T = any>(
    requests: Array<{ url: string; options?: NetworkRequestOptions }>,
    options: { parallel?: boolean; deduplicateUrls?: boolean } = {}
  ): Promise<T[]> => {
    const { parallel = true, deduplicateUrls = true } = options;

    let processedRequests = requests;
    
    if (deduplicateUrls) {
      const seen = new Set<string>();
      processedRequests = requests.filter(req => {
        if (seen.has(req.url)) return false;
        seen.add(req.url);
        return true;
      });
    }

    const requestPromises = processedRequests.map(req => 
      safeFetch<T>(req.url, req.options)
    );

    if (parallel) {
      return Promise.all(requestPromises);
    } else {
      const results: T[] = [];
      for (const promise of requestPromises) {
        results.push(await promise);
      }
      return results;
    }
  }, [safeFetch]);

  // Cleanup all requests on unmount
  useEffect(() => {
    return () => {
      const cancelledCount = cancelAllRequests();
      if (__DEV__ && cancelledCount > 0) {
        logDebug(`🧹 Cancelled ${cancelledCount} network requests on unmount`, "Debug");
      }
    };
  }, [cancelAllRequests]);

  return {
    // Core request methods
    safeFetch,
    get,
    post,
    put,
    patch,
    delete: del,
    
    // Batch operations
    batchRequests,
    
    // Request management
    cancelRequest,
    cancelAllRequests,
    getRequestStatus,
    
    // Cache management
    clearCache,
    getCacheStatus,
  };
};

// Specialized hook for Supabase integration
export const useSupabaseRequests = () => {
  const { safeFetch, post, get, put, patch } = useNetworkRequests();

  const supabaseRequest = useCallback(async <T = any>(
    endpoint: string,
    options: NetworkRequestOptions & {
      supabaseKey?: string;
      userId?: string;
    } = {}
  ) => {
    const { supabaseKey, userId, headers = {}, ...restOptions } = options;
    
    const supabaseHeaders = {
      ...headers,
      'apikey': supabaseKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      'Authorization': `Bearer ${supabaseKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''}`,
      ...(userId && { 'X-User-ID': userId }),
    };

    return safeFetch<T>(endpoint, {
      ...restOptions,
      headers: supabaseHeaders,
      description: `supabase-${endpoint.split('/').pop()}`,
    });
  }, [safeFetch]);

  return {
    supabaseRequest,
    get,
    post,
    put,
    patch,
  };
};

// Hook for API rate limiting
export const useRateLimitedRequests = () => {
  const { safeFetch } = useNetworkRequests();
  const rateLimitRef = useRef<Map<string, number>>(new Map());

  const rateLimitedFetch = useCallback(async <T = any>(
    url: string,
    options: NetworkRequestOptions & {
      rateLimit?: number; // requests per minute
      rateLimitKey?: string;
    } = {}
  ) => {
    const { rateLimit = 60, rateLimitKey = url, ...restOptions } = options;
    
    const now = Date.now();
    const lastRequest = rateLimitRef.current.get(rateLimitKey) || 0;
    const minInterval = 60000 / rateLimit; // milliseconds between requests
    
    const timeToWait = minInterval - (now - lastRequest);
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    rateLimitRef.current.set(rateLimitKey, Date.now());
    
    return safeFetch<T>(url, {
      ...restOptions,
      description: `rate-limited-${restOptions.description || url}`,
    });
  }, [safeFetch]);

  return { rateLimitedFetch };
};

// Development-only hook for network request leak detection
export const useNetworkRequestLeakDetection = () => {
  const { getRequestStatus, getCacheStatus } = useNetworkRequests();

  useEffect(() => {
    if (__DEV__) {
      const checkInterval = setInterval(() => {
        const requestStatus = getRequestStatus();
        const cacheStatus = getCacheStatus();
        
        if (requestStatus.total > 15) { // Threshold for concern
          logWarn(`🚨 High network request count: ${requestStatus.total} active requests`, "Warning");
          logDebug('Request breakdown:', "Debug", requestStatus.byMethod);
          logDebug('Long running requests:', "Debug", requestStatus.longRunning);
        }

        if (requestStatus.longRunning.length > 0) {
          logWarn(`⏰ Long running requests detected: ${requestStatus.longRunning.length}`, "Warning");
        }

        if (cacheStatus.total > 100) {
          logWarn(`💾 Large cache detected: ${cacheStatus.total} entries`, "Warning");
        }

        if (cacheStatus.expired > 20) {
          logWarn(`🗑️ Many expired cache entries: ${cacheStatus.expired}`, "Warning");
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkInterval);
    }
  }, [getRequestStatus, getCacheStatus]);
};
