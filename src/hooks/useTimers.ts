// Memory-safe timer management hook
// Automatically cleans up all timers on component unmount
// Enhanced with React Native support for animation timers and requestAnimationFrame

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface TimerRef {
  id: NodeJS.Timeout | number; // number for requestAnimationFrame
  type: 'timeout' | 'interval' | 'animation-frame' | 'immediate';
  cleanup?: () => void;
  startTime?: number;
  description?: string;
}

export const useTimers = () => {
  const timersRef = useRef<Map<string, TimerRef>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique timer ID
  const generateTimerId = useCallback(() => {
    return `timer_${nextIdRef.current++}`;
  }, []);

  // Safe setTimeout with automatic cleanup
  const createTimeout = useCallback((
    callback: () => void,
    delay: number,
    timerId?: string,
    description?: string
  ): string => {
    const id = timerId || generateTimerId();
    
    // Clear existing timer with same ID
    if (timersRef.current.has(id)) {
      const existing = timersRef.current.get(id)!;
      if (existing.type === 'animation-frame') {
        cancelAnimationFrame(existing.id as number);
      } else {
        clearTimeout(existing.id as NodeJS.Timeout);
      }
      existing.cleanup?.();
    }

    const timeoutId = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        logError(`Timer callback error for ${id}:`, "Error", error);
      } finally {
        // Auto-cleanup completed timeout
        timersRef.current.delete(id);
      }
    }, delay);

    timersRef.current.set(id, {
      id: timeoutId,
      type: 'timeout',
      startTime: Date.now(),
      description,
    });

    return id;
  }, [generateTimerId]);

  // Safe setInterval with automatic cleanup
  const createInterval = useCallback((
    callback: () => void,
    delay: number,
    timerId?: string,
    description?: string
  ): string => {
    const id = timerId || generateTimerId();
    
    // Clear existing timer with same ID
    if (timersRef.current.has(id)) {
      const existing = timersRef.current.get(id)!;
      if (existing.type === 'animation-frame') {
        cancelAnimationFrame(existing.id as number);
      } else {
        clearInterval(existing.id as NodeJS.Timeout);
      }
      existing.cleanup?.();
    }

    const intervalId = setInterval(() => {
      try {
        callback();
      } catch (error) {
        logError(`Interval callback error for ${id}:`, "Error", error);
        // Don't auto-cleanup intervals on error, let them continue
      }
    }, delay);

    timersRef.current.set(id, {
      id: intervalId,
      type: 'interval',
      startTime: Date.now(),
      description,
    });

    return id;
  }, [generateTimerId]);

  // React Native safe requestAnimationFrame with automatic cleanup
  const createAnimationFrame = useCallback((
    callback: () => void,
    timerId?: string,
    description?: string
  ): string => {
    const id = timerId || generateTimerId();
    
    // Clear existing timer with same ID
    if (timersRef.current.has(id)) {
      const existing = timersRef.current.get(id)!;
      if (existing.type === 'animation-frame') {
        cancelAnimationFrame(existing.id as number);
      } else if (existing.type === 'timeout') {
        clearTimeout(existing.id as NodeJS.Timeout);
      } else {
        clearInterval(existing.id as NodeJS.Timeout);
      }
      existing.cleanup?.();
    }

    const frameId = requestAnimationFrame(() => {
      try {
        callback();
      } catch (error) {
        logError(`Animation frame callback error for ${id}:`, "Error", error);
      } finally {
        // Auto-cleanup completed frame
        timersRef.current.delete(id);
      }
    });

    timersRef.current.set(id, {
      id: frameId,
      type: 'animation-frame',
      startTime: Date.now(),
      description,
    });

    return id;
  }, [generateTimerId]);

  // React Native safe setImmediate with automatic cleanup
  const createImmediate = useCallback((
    callback: () => void,
    timerId?: string,
    description?: string
  ): string => {
    const id = timerId || generateTimerId();
    
    // Clear existing timer with same ID
    if (timersRef.current.has(id)) {
      const existing = timersRef.current.get(id)!;
      if (existing.type === 'animation-frame') {
        cancelAnimationFrame(existing.id as number);
      } else if (existing.type === 'immediate') {
        // Use clearTimeout for zero-delay immediate emulation
        clearTimeout(existing.id as any);
      } else if (existing.type === 'timeout') {
        clearTimeout(existing.id as any);
      } else {
        clearInterval(existing.id as any);
      }
      existing.cleanup?.();
    }

    const immediateId = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        logError(`Immediate callback error for ${id}:`, "Error", error);
      } finally {
        // Auto-cleanup completed immediate
        timersRef.current.delete(id);
      }
    }, 0);

    timersRef.current.set(id, {
      id: immediateId,
      type: 'immediate',
      startTime: Date.now(),
      description,
    });

    return id;
  }, [generateTimerId]);

  // Animation loop with frame-perfect timing
  const createAnimationLoop = useCallback((
    callback: () => boolean | void, // return false to stop the loop
    timerId?: string,
    description?: string
  ): string => {
    const id = timerId || generateTimerId();
    let isRunning = true;
    
    // Clear existing timer with same ID
    if (timersRef.current.has(id)) {
      clearTimer(id);
    }

    const loop = () => {
      if (!isRunning) return;
      
      try {
        const shouldContinue = callback();
        if (shouldContinue === false) {
          timersRef.current.delete(id);
          return;
        }
      } catch (error) {
        logError(`Animation loop callback error for ${id}:`, "Error", error);
        timersRef.current.delete(id);
        return;
      }
      
      // Schedule next frame
      if (isRunning && timersRef.current.has(id)) {
        const frameId = requestAnimationFrame(loop);
        const timer = timersRef.current.get(id);
        if (timer) {
          timer.id = frameId;
        }
      }
    };

    const initialFrameId = requestAnimationFrame(loop);

    timersRef.current.set(id, {
      id: initialFrameId,
      type: 'animation-frame',
      startTime: Date.now(),
      description: `animation-loop-${description || 'default'}`,
      cleanup: () => {
        isRunning = false;
      },
    });

    return id;
  }, [generateTimerId]);

  // Platform-specific high-precision timer
  const createHighPrecisionTimer = useCallback((
    callback: (timestamp: number) => void,
    targetFPS: number = 60,
    timerId?: string,
    description?: string
  ): string => {
    const id = timerId || generateTimerId();
    const targetInterval = 1000 / targetFPS;
    let lastTime = 0;
    let isRunning = true;
    
    // Clear existing timer with same ID
    if (timersRef.current.has(id)) {
      clearTimer(id);
    }

    const loop = (currentTime: number) => {
      if (!isRunning) return;
      
      const deltaTime = currentTime - lastTime;
      
      if (deltaTime >= targetInterval) {
        try {
          callback(currentTime);
          lastTime = currentTime;
        } catch (error) {
          logError(`High precision timer callback error for ${id}:`, "Error", error);
          timersRef.current.delete(id);
          return;
        }
      }
      
      // Schedule next frame
      if (isRunning && timersRef.current.has(id)) {
        const frameId = requestAnimationFrame(loop);
        const timer = timersRef.current.get(id);
        if (timer) {
          timer.id = frameId;
        }
      }
    };

    const initialFrameId = requestAnimationFrame(loop);

    timersRef.current.set(id, {
      id: initialFrameId,
      type: 'animation-frame',
      startTime: Date.now(),
      description: `high-precision-${targetFPS}fps-${description || 'timer'}`,
      cleanup: () => {
        isRunning = false;
      },
    });

    return id;
  }, [generateTimerId]);

  // Clear specific timer
  const clearTimer = useCallback((timerId: string) => {
    const timer = timersRef.current.get(timerId);
    if (!timer) return;

    try {
      switch (timer.type) {
        case 'timeout':
          clearTimeout(timer.id as any);
          break;
        case 'interval':
          clearInterval(timer.id as any);
          break;
        case 'animation-frame':
          cancelAnimationFrame(timer.id as number);
          break;
        case 'immediate':
          clearTimeout(timer.id as any);
          break;
        default:
          logWarn(`Unknown timer type: ${timer.type}`, "Warning");
      }

      timer.cleanup?.();
    } catch (error) {
      logError(`Error clearing timer ${timerId}:`, "Error", error);
    }

    timersRef.current.delete(timerId);
  }, []);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    const timers = Array.from(timersRef.current.entries());
    let clearedCount = 0;

    for (const [id, timer] of timers) {
      try {
        switch (timer.type) {
          case 'timeout':
            clearTimeout(timer.id as any);
            break;
          case 'interval':
            clearInterval(timer.id as any);
            break;
          case 'animation-frame':
            cancelAnimationFrame(timer.id as number);
            break;
          case 'immediate':
            clearTimeout(timer.id as any);
            break;
          default:
            logWarn(`Unknown timer type: ${timer.type}`, "Warning");
        }

        timer.cleanup?.();
        clearedCount++;
      } catch (error) {
        logError(`Error clearing timer ${id}:`, "Error", error);
      }
    }

    timersRef.current.clear();
    return clearedCount;
  }, []);

  // Get active timer count (useful for debugging)
  const getActiveTimerCount = useCallback(() => {
    return timersRef.current.size;
  }, []);

  // Get timer details (debugging only)
  const getTimerDetails = useCallback(() => {
    const details: Array<{ id: string; type: string }> = [];
    for (const [id, timer] of timersRef.current.entries()) {
      details.push({ id, type: timer.type });
    }
    return details;
  }, []);

  // Delayed function execution with cancellation support
  const delayedExecution = useCallback((
    callback: () => void,
    delay: number,
    cancelCondition?: () => boolean
  ): { cancel: () => void } => {
    let cancelled = false;
    
    const timerId = createTimeout(() => {
      if (cancelled || (cancelCondition && cancelCondition())) {
        return;
      }
      callback();
    }, delay);

    return {
      cancel: () => {
        cancelled = true;
        clearTimer(timerId);
      }
    };
  }, [createTimeout, clearTimer]);

  // Debounced execution
  const createDebouncedTimer = useCallback((
    callback: () => void,
    delay: number,
    timerId: string = 'debounced'
  ) => {
    // Clear existing debounced timer
    clearTimer(timerId);
    
    // Create new debounced timer
    return createTimeout(callback, delay, timerId);
  }, [createTimeout, clearTimer]);

  // Throttled execution
  const createThrottledTimer = useCallback((
    callback: () => void,
    delay: number,
    timerId: string = 'throttled'
  ) => {
    // Only create if timer doesn't exist
    if (!timersRef.current.has(timerId)) {
      return createTimeout(() => {
        callback();
        // Timer auto-cleans up, allowing next throttled call
      }, delay, timerId);
    }
    return timerId;
  }, [createTimeout]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    // Core timer functions
    createTimeout,
    createInterval,
    clearTimer,
    clearAllTimers,
    
    // React Native animation timers
    createAnimationFrame,
    createImmediate,
    createAnimationLoop,
    createHighPrecisionTimer,
    
    // Advanced timer utilities
    delayedExecution,
    createDebouncedTimer,
    createThrottledTimer,
    
    // Debugging utilities
    getActiveTimerCount,
    getTimerDetails,
  };
};

// Specialized hooks for common use cases

// Hook for accessibility announcements with automatic cleanup
export const useAccessibilityTimers = () => {
  const { createTimeout, clearTimer, clearAllTimers } = useTimers();

  const announceAfterDelay = useCallback((
    announcement: () => void,
    delay: number = 500
  ) => {
    return createTimeout(announcement, delay, 'accessibility_announcement');
  }, [createTimeout]);

  const scheduleDelayedFocus = useCallback((
    focusAction: () => void,
    delay: number = 300
  ) => {
    return createTimeout(focusAction, delay, 'delayed_focus');
  }, [createTimeout]);

  return {
    announceAfterDelay,
    scheduleDelayedFocus,
    clearTimer,
    clearAllTimers,
  };
};

// Hook for React Native animation timers with frame-perfect timing
export const useAnimationTimers = () => {
  const { 
    createAnimationFrame, 
    createAnimationLoop, 
    createHighPrecisionTimer,
    clearTimer, 
    clearAllTimers 
  } = useTimers();

  const scheduleAnimationFrame = useCallback((
    callback: () => void,
    description?: string
  ) => {
    return createAnimationFrame(callback, undefined, description);
  }, [createAnimationFrame]);

  const createSmoothAnimationLoop = useCallback((
    callback: () => boolean | void, // return false to stop
    description?: string
  ) => {
    return createAnimationLoop(callback, undefined, description);
  }, [createAnimationLoop]);

  const createTargetedFPSLoop = useCallback((
    callback: (timestamp: number) => void,
    targetFPS: number = 60,
    description?: string
  ) => {
    return createHighPrecisionTimer(callback, targetFPS, undefined, description);
  }, [createHighPrecisionTimer]);

  return {
    scheduleAnimationFrame,
    createSmoothAnimationLoop,
    createTargetedFPSLoop,
    clearTimer,
    clearAllTimers,
  };
};

// Hook for React Native gesture and interaction timers
export const useInteractionTimers = () => {
  const { 
    createTimeout, 
    createImmediate, 
    createDebouncedTimer, 
    createThrottledTimer,
    clearTimer, 
    clearAllTimers 
  } = useTimers();

  // Debounced user input handling
  const debounceUserInput = useCallback((
    callback: () => void,
    delay: number = 300
  ) => {
    return createDebouncedTimer(callback, delay, 'user_input_debounce');
  }, [createDebouncedTimer]);

  // Throttled scroll/pan gesture handling
  const throttleGesture = useCallback((
    callback: () => void,
    delay: number = 16 // ~60fps
  ) => {
    return createThrottledTimer(callback, delay, 'gesture_throttle');
  }, [createThrottledTimer]);

  // Immediate response for critical interactions
  const scheduleImmediate = useCallback((
    callback: () => void,
    description?: string
  ) => {
    return createImmediate(callback, undefined, description);
  }, [createImmediate]);

  // Double-tap detection with timeout
  const createDoubleTapTimer = useCallback((
    onSingleTap: () => void,
    onDoubleTap: () => void,
    delay: number = 300
  ) => {
    let tapCount = 0;
    let tapTimer: string | null = null;

    return {
      handleTap: () => {
        tapCount++;
        
        if (tapCount === 1) {
          tapTimer = createTimeout(() => {
            if (tapCount === 1) {
              onSingleTap();
            }
            tapCount = 0;
            tapTimer = null;
          }, delay, 'double_tap_timer');
        } else if (tapCount === 2) {
          if (tapTimer) {
            clearTimer(tapTimer);
            tapTimer = null;
          }
          onDoubleTap();
          tapCount = 0;
        }
      },
      cancel: () => {
        if (tapTimer) {
          clearTimer(tapTimer);
          tapTimer = null;
        }
        tapCount = 0;
      }
    };
  }, [createTimeout, clearTimer]);

  return {
    debounceUserInput,
    throttleGesture,
    scheduleImmediate,
    createDoubleTapTimer,
    clearTimer,
    clearAllTimers,
  };
};

// Hook for React Native performance monitoring timers
export const usePerformanceTimers = () => {
  const { 
    createInterval, 
    createTimeout,
    createAnimationFrame,
    getActiveTimerCount,
    getTimerDetails,
    clearTimer, 
    clearAllTimers 
  } = useTimers();

  // Monitor frame rate and detect performance issues
  const createPerformanceMonitor = useCallback((
    onPerformanceIssue: (issue: { type: string; severity: 'low' | 'medium' | 'high'; data: any }) => void,
    monitorInterval: number = 5000
  ) => {
    let frameCount = 0;
    let lastTime = Date.now();
    
    // Frame rate monitoring
    const frameMonitorId = createAnimationFrame(function frameCounter() {
      frameCount++;
      return true; // Continue the loop
    }, 'performance_frame_monitor');

    // Periodic performance check
    const performanceCheckId = createInterval(() => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;
      const fps = Math.round((frameCount * 1000) / deltaTime);
      
      // Reset counters
      frameCount = 0;
      lastTime = currentTime;
      
      // Check for performance issues
      if (fps < 45) { // Below 45 FPS
        onPerformanceIssue({
          type: 'low_framerate',
          severity: fps < 30 ? 'high' : 'medium',
          data: { fps, expectedFps: 60 }
        });
      }
      
      // Check timer count
      const timerCount = getActiveTimerCount();
      if (timerCount > 50) {
        onPerformanceIssue({
          type: 'high_timer_count',
          severity: timerCount > 100 ? 'high' : 'medium',
          data: { timerCount, details: getTimerDetails() }
        });
      }
    }, monitorInterval, 'performance_check');

    return {
      stop: () => {
        clearTimer(frameMonitorId);
        clearTimer(performanceCheckId);
      }
    };
  }, [createAnimationFrame, createInterval, getActiveTimerCount, getTimerDetails, clearTimer]);

  // Memory usage monitoring (where available)
  const createMemoryMonitor = useCallback((
    onMemoryIssue: (data: { usedMB: number; totalMB: number; percentage: number }) => void,
    threshold: number = 100, // MB
    interval: number = 30000 // 30 seconds
  ) => {
    return createInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const percentage = Math.round((usedMB / totalMB) * 100);
        
        if (usedMB > threshold) {
          onMemoryIssue({ usedMB, totalMB, percentage });
        }
      }
    }, interval, 'memory_monitor');
  }, [createInterval]);

  return {
    createPerformanceMonitor,
    createMemoryMonitor,
    clearTimer,
    clearAllTimers,
  };
};

// Development-only hook for memory leak detection
export const useTimerLeakDetection = () => {
  const { getActiveTimerCount, getTimerDetails } = useTimers();

  useEffect(() => {
    if (__DEV__) {
      const checkInterval = setInterval(() => {
        const count = getActiveTimerCount();
        if (count > 10) { // Threshold for concern
          logWarn(`🚨 High timer count detected: ${count} active timers`, "Warning");
          logDebug('Timer details:', "Debug", getTimerDetails());
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkInterval);
    }
  }, [getActiveTimerCount, getTimerDetails]);
};
