// @ts-nocheck
// Animation lifecycle tracking and cleanup utilities
// Monitors animation performance, tracks lifecycle events, and ensures proper cleanup
// Provides comprehensive animation management for React Native applications

import { useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useTimers } from './useTimers';
import { useAnimatedValues } from './useAnimatedValues';
import { useGestureHandlers } from './useGestureHandlers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface AnimationLifecycleEntry {
  id: string;
  name: string;
  type: 'timing' | 'spring' | 'decay' | 'gesture' | 'layout' | 'shared-element' | 'custom';
  state: 'created' | 'starting' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  
  // Timing information
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  expectedDuration?: number;
  
  // Performance tracking
  frameDrops: number;
  avgFrameTime: number;
  maxFrameTime: number;
  frameCount: number;
  
  // Resource tracking
  animatedValueIds: string[];
  gestureHandlerIds: string[];
  timerIds: string[];
  
  // Configuration
  config: {
    easing?: string;
    tension?: number;
    friction?: number;
    mass?: number;
    damping?: number;
    stiffness?: number;
    overshootClamping?: boolean;
    restDisplacementThreshold?: number;
    restSpeedThreshold?: number;
    [key: string]: any;
  };
  
  // Callbacks and cleanup
  onStart?: () => void;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  cleanup?: () => void;
  
  // Error tracking
  errors: Array<{
    timestamp: number;
    error: string;
    stack?: string;
  }>;
}

interface AnimationGroup {
  id: string;
  name: string;
  animationIds: string[];
  type: 'parallel' | 'sequence' | 'staggered';
  state: 'pending' | 'running' | 'completed' | 'cancelled';
  startedAt?: number;
  completedAt?: number;
  staggerDelay?: number;
  cleanup?: () => void;
}

interface PerformanceThresholds {
  maxFrameTime: number;
  maxFrameDrops: number;
  maxDuration: number;
  warningFrameTime: number;
  warningFrameDrops: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxFrameTime: 32, // ~30fps
  maxFrameDrops: 5,
  maxDuration: 10000, // 10 seconds
  warningFrameTime: 20, // ~50fps
  warningFrameDrops: 2,
};

export const useAnimationCleanup = (options: {
  enablePerformanceTracking?: boolean;
  enableLifecycleLogging?: boolean;
  performanceThresholds?: Partial<PerformanceThresholds>;
} = {}) => {
  const {
    enablePerformanceTracking = __DEV__,
    enableLifecycleLogging = __DEV__,
    performanceThresholds = {},
  } = options;

  const { createTimeout, clearTimer } = useTimers();
  const { getAnimationStatus, cleanupAnimatedValue } = useAnimatedValues();
  const { getGestureStatus, cleanupGesture } = useGestureHandlers();

  const animationsRef = useRef<Map<string, AnimationLifecycleEntry>>(new Map());
  const groupsRef = useRef<Map<string, AnimationGroup>>(new Map());
  const performanceMonitorRef = useRef<number | null>(null);
  const nextIdRef = useRef(0);

  const thresholds: PerformanceThresholds = { ...DEFAULT_THRESHOLDS, ...performanceThresholds };

  // Generate unique animation ID
  const generateAnimationId = useCallback((type: string, name?: string) => {
    return `anim_${type}_${name || 'unnamed'}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Start animation lifecycle tracking
  const startAnimationTracking = useCallback((config: {
    name: string;
    type: 'timing' | 'spring' | 'decay' | 'gesture' | 'layout' | 'shared-element' | 'custom';
    priority?: 'low' | 'normal' | 'high' | 'critical';
    expectedDuration?: number;
    animatedValueIds?: string[];
    gestureHandlerIds?: string[];
    config?: any;
    onStart?: () => void;
    onUpdate?: (progress: number) => void;
    onComplete?: () => void;
    onCancel?: () => void;
  }): string => {
    const animationId = generateAnimationId(config.type, config.name);
    
    const entry: AnimationLifecycleEntry = {
      id: animationId,
      name: config.name,
      type: config.type,
      state: 'created',
      priority: config.priority || 'normal',
      
      createdAt: Date.now(),
      expectedDuration: config.expectedDuration,
      
      frameDrops: 0,
      avgFrameTime: 0,
      maxFrameTime: 0,
      frameCount: 0,
      
      animatedValueIds: config.animatedValueIds || [],
      gestureHandlerIds: config.gestureHandlerIds || [],
      timerIds: [],
      
      config: config.config || {},
      
      onStart: config.onStart,
      onUpdate: config.onUpdate,
      onComplete: config.onComplete,
      onCancel: config.onCancel,
      
      errors: [],
      
      cleanup: () => {
        // Cleanup associated resources
        entry.animatedValueIds.forEach(valueId => cleanupAnimatedValue(valueId));
        entry.gestureHandlerIds.forEach(gestureId => cleanupGesture(gestureId));
        entry.timerIds.forEach(timerId => clearTimer(timerId));
        
        // Clear callbacks
        entry.onStart = undefined;
        entry.onUpdate = undefined;
        entry.onComplete = undefined;
        entry.onCancel = undefined;
      },
    };

    animationsRef.current.set(animationId, entry);

    if (enableLifecycleLogging) {
      logDebug(`🎬 Animation created: ${config.name} (${animationId}, "Debug")`);
    }

    return animationId;
  }, [generateAnimationId, cleanupAnimatedValue, cleanupGesture, clearTimer, enableLifecycleLogging]);

  // Update animation state
  const updateAnimationState = useCallback((
    animationId: string,
    newState: AnimationLifecycleEntry['state'],
    additionalData?: Partial<AnimationLifecycleEntry>
  ): boolean => {
    const animation = animationsRef.current.get(animationId);
    if (!animation) return false;

    const previousState = animation.state;
    animation.state = newState;

    // Update timing information
    const now = Date.now();
    switch (newState) {
      case 'starting':
        animation.startedAt = now;
        if (animation.onStart) animation.onStart();
        break;
      case 'completed':
      case 'cancelled':
      case 'failed':
        animation.completedAt = now;
        if (animation.startedAt) {
          animation.duration = now - animation.startedAt;
        }
        
        if (newState === 'completed' && animation.onComplete) {
          animation.onComplete();
        } else if (newState === 'cancelled' && animation.onCancel) {
          animation.onCancel();
        }
        break;
    }

    // Merge additional data
    if (additionalData) {
      Object.assign(animation, additionalData);
    }

    if (enableLifecycleLogging) {
      logDebug(`🎬 Animation ${animation.name} (${animationId}, "Debug"): ${previousState} → ${newState}`);
    }

    return true;
  }, [enableLifecycleLogging]);

  // Track animation frame performance
  const trackAnimationFrame = useCallback((animationId: string, frameTime: number): boolean => {
    if (!enablePerformanceTracking) return true;

    const animation = animationsRef.current.get(animationId);
    if (!animation || animation.state !== 'running') return false;

    animation.frameCount++;
    animation.maxFrameTime = Math.max(animation.maxFrameTime, frameTime);
    animation.avgFrameTime = (animation.avgFrameTime * (animation.frameCount - 1) + frameTime) / animation.frameCount;

    // Track frame drops
    if (frameTime > thresholds.warningFrameTime) {
      animation.frameDrops++;
      
      if (frameTime > thresholds.maxFrameTime) {
        logWarn(`🚨 Animation ${animation.name} dropped frame: ${frameTime.toFixed(2, "Warning")}ms`);
      }
    }

    // Check for performance issues
    if (animation.frameDrops > thresholds.maxFrameDrops) {
      const error = `High frame drop count: ${animation.frameDrops} drops`;
      animation.errors.push({
        timestamp: Date.now(),
        error,
      });
      
      logWarn(`🚨 Animation ${animation.name} performance issue: ${error}`, "Warning");
    }

    return true;
  }, [enablePerformanceTracking, thresholds]);

  // Add error to animation
  const addAnimationError = useCallback((animationId: string, error: string, stack?: string): boolean => {
    const animation = animationsRef.current.get(animationId);
    if (!animation) return false;

    animation.errors.push({
      timestamp: Date.now(),
      error,
      stack,
    });

    logError(`🚨 Animation ${animation.name} error: ${error}`, "Error");
    return true;
  }, []);

  // Create animation group for coordinated animations
  const createAnimationGroup = useCallback((config: {
    name: string;
    animationIds: string[];
    type: 'parallel' | 'sequence' | 'staggered';
    staggerDelay?: number;
  }): string => {
    const groupId = `group_${config.name}_${Date.now()}`;
    
    const group: AnimationGroup = {
      id: groupId,
      name: config.name,
      animationIds: [...config.animationIds],
      type: config.type,
      state: 'pending',
      staggerDelay: config.staggerDelay,
      cleanup: () => {
        // Cleanup all animations in the group
        config.animationIds.forEach(animId => {
          const animation = animationsRef.current.get(animId);
          if (animation && animation.cleanup) {
            animation.cleanup();
          }
        });
      },
    };

    groupsRef.current.set(groupId, group);

    if (enableLifecycleLogging) {
      logDebug(`🎭 Animation group created: ${config.name} (${groupId}, "Debug") with ${config.animationIds.length} animations`);
    }

    return groupId;
  }, [enableLifecycleLogging]);

  // Start animation group
  const startAnimationGroup = useCallback((groupId: string): boolean => {
    const group = groupsRef.current.get(groupId);
    if (!group || group.state !== 'pending') return false;

    group.state = 'running';
    group.startedAt = Date.now();

    switch (group.type) {
      case 'parallel':
        // Start all animations simultaneously
        group.animationIds.forEach(animId => {
          updateAnimationState(animId, 'starting');
        });
        break;

      case 'sequence':
        // Start first animation, others will be chained
        if (group.animationIds.length > 0) {
          updateAnimationState(group.animationIds[0], 'starting');
        }
        break;

      case 'staggered':
        // Start animations with stagger delay
        group.animationIds.forEach((animId, index) => {
          const delay = (group.staggerDelay || 100) * index;
          const timerId = createTimeout(() => {
            updateAnimationState(animId, 'starting');
          }, delay, `stagger_${animId}`);
          
          const animation = animationsRef.current.get(animId);
          if (animation) {
            animation.timerIds.push(timerId);
          }
        });
        break;
    }

    if (enableLifecycleLogging) {
      logDebug(`🎭 Animation group started: ${group.name} (${groupId}, "Debug")`);
    }

    return true;
  }, [updateAnimationState, createTimeout, enableLifecycleLogging]);

  // Complete animation group
  const completeAnimationGroup = useCallback((groupId: string): boolean => {
    const group = groupsRef.current.get(groupId);
    if (!group) return false;

    group.state = 'completed';
    group.completedAt = Date.now();

    if (enableLifecycleLogging) {
      const duration = group.startedAt ? group.completedAt - group.startedAt : 0;
      logDebug(`🎭 Animation group completed: ${group.name} (${groupId}, "Debug") in ${duration}ms`);
    }

    return true;
  }, [enableLifecycleLogging]);

  // Get animation performance report
  const getAnimationPerformanceReport = useCallback((animationId?: string) => {
    if (animationId) {
      const animation = animationsRef.current.get(animationId);
      if (!animation) return null;

      return {
        id: animation.id,
        name: animation.name,
        type: animation.type,
        state: animation.state,
        duration: animation.duration,
        expectedDuration: animation.expectedDuration,
        performance: {
          frameCount: animation.frameCount,
          frameDrops: animation.frameDrops,
          avgFrameTime: Math.round(animation.avgFrameTime * 100) / 100,
          maxFrameTime: Math.round(animation.maxFrameTime * 100) / 100,
          frameRate: animation.duration && animation.frameCount > 0 
            ? Math.round((animation.frameCount / animation.duration) * 1000)
            : 0,
        },
        errors: animation.errors,
        resources: {
          animatedValues: animation.animatedValueIds.length,
          gestureHandlers: animation.gestureHandlerIds.length,
          timers: animation.timerIds.length,
        },
      };
    }

    // Return report for all animations
    const animations = Array.from(animationsRef.current.values());
    const groups = Array.from(groupsRef.current.values());

    return {
      summary: {
        totalAnimations: animations.length,
        runningAnimations: animations.filter(a => a.state === 'running').length,
        completedAnimations: animations.filter(a => a.state === 'completed').length,
        failedAnimations: animations.filter(a => a.state === 'failed').length,
        totalGroups: groups.length,
        runningGroups: groups.filter(g => g.state === 'running').length,
      },
      performance: {
        totalFrameDrops: animations.reduce((sum, a) => sum + a.frameDrops, 0),
        avgFrameTime: animations.length > 0 
          ? animations.reduce((sum, a) => sum + a.avgFrameTime, 0) / animations.length
          : 0,
        maxFrameTime: Math.max(...animations.map(a => a.maxFrameTime), 0),
        totalErrors: animations.reduce((sum, a) => sum + a.errors.length, 0),
      },
      byType: animations.reduce((acc, animation) => {
        const type = animation.type;
        if (!acc[type]) {
          acc[type] = { count: 0, frameDrops: 0, errors: 0 };
        }
        acc[type].count++;
        acc[type].frameDrops += animation.frameDrops;
        acc[type].errors += animation.errors.length;
        return acc;
      }, {} as Record<string, { count: number; frameDrops: number; errors: number }>),
      problematicAnimations: animations.filter(a => 
        a.frameDrops > thresholds.warningFrameDrops || 
        a.errors.length > 0 ||
        (a.duration && a.expectedDuration && a.duration > a.expectedDuration * 1.5)
      ).map(a => ({
        id: a.id,
        name: a.name,
        issues: [
          ...(a.frameDrops > thresholds.warningFrameDrops ? [`High frame drops: ${a.frameDrops}`] : []),
          ...(a.errors.length > 0 ? [`Errors: ${a.errors.length}`] : []),
          ...(a.duration && a.expectedDuration && a.duration > a.expectedDuration * 1.5 
            ? [`Slow completion: ${a.duration}ms vs expected ${a.expectedDuration}ms`] : []),
        ],
      })),
    };
  }, [thresholds]);

  // Cleanup specific animation
  const cleanupAnimation = useCallback((animationId: string): boolean => {
    const animation = animationsRef.current.get(animationId);
    if (!animation) return false;

    try {
      // Cancel if still running
      if (animation.state === 'running' || animation.state === 'starting') {
        updateAnimationState(animationId, 'cancelled');
      }

      // Run cleanup
      if (animation.cleanup) {
        animation.cleanup();
      }

      // Remove from tracking
      animationsRef.current.delete(animationId);

      if (enableLifecycleLogging) {
        logDebug(`🧹 Animation cleaned up: ${animation.name} (${animationId}, "Debug")`);
      }

      return true;
    } catch (error) {
      logError(`Error cleaning up animation ${animationId}:`, "Error", error);
      return false;
    }
  }, [updateAnimationState, enableLifecycleLogging]);

  // Cleanup animation group
  const cleanupAnimationGroup = useCallback((groupId: string): boolean => {
    const group = groupsRef.current.get(groupId);
    if (!group) return false;

    try {
      // Cleanup all animations in the group
      if (group.cleanup) {
        group.cleanup();
      }

      // Remove from tracking
      groupsRef.current.delete(groupId);

      if (enableLifecycleLogging) {
        logDebug(`🧹 Animation group cleaned up: ${group.name} (${groupId}, "Debug")`);
      }

      return true;
    } catch (error) {
      logError(`Error cleaning up animation group ${groupId}:`, "Error", error);
      return false;
    }
  }, [enableLifecycleLogging]);

  // Cleanup all animations and groups
  const cleanupAllAnimations = useCallback((): {
    cleaned: { animations: number; groups: number };
    errors: string[];
  } => {
    const result = {
      cleaned: { animations: 0, groups: 0 },
      errors: [] as string[],
    };

    // Cleanup all groups first
    for (const [groupId] of groupsRef.current.entries()) {
      try {
        if (cleanupAnimationGroup(groupId)) {
          result.cleaned.groups++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup animation group ${groupId}: ${error}`);
      }
    }

    // Cleanup all animations
    for (const [animationId] of animationsRef.current.entries()) {
      try {
        if (cleanupAnimation(animationId)) {
          result.cleaned.animations++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup animation ${animationId}: ${error}`);
      }
    }

    return result;
  }, [cleanupAnimation, cleanupAnimationGroup]);

  // Start performance monitoring
  const startPerformanceMonitoring = useCallback(() => {
    if (!enablePerformanceTracking || performanceMonitorRef.current) return;

    const monitor = () => {
      const animations = Array.from(animationsRef.current.values());
      const runningAnimations = animations.filter(a => a.state === 'running');

      // Check for stuck animations
      const now = Date.now();
      runningAnimations.forEach(animation => {
        if (animation.startedAt) {
          const duration = now - animation.startedAt;
          
          // Check for animations exceeding expected duration
          if (animation.expectedDuration && duration > animation.expectedDuration * 2) {
            addAnimationError(animation.id, `Animation stuck: running for ${duration}ms (expected ${animation.expectedDuration}ms)`);
          }
          
          // Check for extremely long animations
          if (duration > thresholds.maxDuration) {
            addAnimationError(animation.id, `Animation timeout: running for ${duration}ms`);
            updateAnimationState(animation.id, 'failed');
          }
        }
      });

      // Schedule next check
      performanceMonitorRef.current = createTimeout(monitor, 5000, 'animation_performance_monitor');
    };

    monitor();
  }, [enablePerformanceTracking, addAnimationError, updateAnimationState, createTimeout, thresholds]);

  // Stop performance monitoring
  const stopPerformanceMonitoring = useCallback(() => {
    if (performanceMonitorRef.current) {
      clearTimer(performanceMonitorRef.current);
      performanceMonitorRef.current = null;
    }
  }, [clearTimer]);

  // Auto-cleanup and monitoring setup
  useEffect(() => {
    if (enablePerformanceTracking) {
      startPerformanceMonitoring();
    }

    return () => {
      stopPerformanceMonitoring();
      const cleanupResult = cleanupAllAnimations();
      
      if (__DEV__ && (cleanupResult.cleaned.animations > 0 || cleanupResult.cleaned.groups > 0)) {
        logDebug(`🧹 Animation lifecycle cleanup on unmount:`, "Debug", cleanupResult.cleaned);
        if (cleanupResult.errors.length > 0) {
          logWarn('🚨 Animation lifecycle cleanup errors:', "Warning", cleanupResult.errors);
        }
      }
    };
  }, [enablePerformanceTracking, startPerformanceMonitoring, stopPerformanceMonitoring, cleanupAllAnimations]);

  return {
    // Animation lifecycle management
    startAnimationTracking,
    updateAnimationState,
    trackAnimationFrame,
    addAnimationError,
    
    // Animation groups
    createAnimationGroup,
    startAnimationGroup,
    completeAnimationGroup,
    
    // Performance monitoring
    startPerformanceMonitoring,
    stopPerformanceMonitoring,
    getAnimationPerformanceReport,
    
    // Cleanup operations
    cleanupAnimation,
    cleanupAnimationGroup,
    cleanupAllAnimations,
  };
};
// @ts-nocheck
