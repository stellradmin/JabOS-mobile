// Memory-safe React Native Reanimated values management
// Automatically cleans up shared values, animated styles, and worklets on unmount
// Prevents memory leaks in React Native animations

import { useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRefs } from './useRefs';
import { useTimers } from './useTimers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// React Native Reanimated types (these would be imported from 'react-native-reanimated' in real usage)
interface SharedValue<T = any> {
  value: T;
  // Broad compatibility with RN Reanimated variants
  addListener?: (...args: any[]) => any;
  removeListener?: (...args: any[]) => any;
  modify?: (callback: (value: T) => T) => void;
}

interface AnimatedStyle {
  [key: string]: any;
}

interface WorkletFunction {
  __workletHash?: number;
  __optimalization?: number;
}

interface AnimatedValueEntry<T = any> {
  id: string;
  value: SharedValue<T>;
  type: 'shared-value' | 'animated-style' | 'derived-value' | 'interpolation';
  initialValue: T;
  description?: string;
  dependencies?: string[]; // IDs of other animated values this depends on
  listeners: Map<string, (value: T) => void>;
  lastAccessed?: number;
  cleanup?: () => void;
}

interface WorkletEntry {
  id: string;
  worklet: WorkletFunction;
  type: 'gesture' | 'animation' | 'interaction' | 'custom';
  description?: string;
  cleanup?: () => void;
}

interface AnimationEntry {
  id: string;
  type: 'timing' | 'spring' | 'decay' | 'sequence' | 'parallel' | 'loop' | 'delay';
  isRunning: boolean;
  startedAt: number;
  duration?: number;
  description?: string;
  cancel?: () => void;
  targetValues: string[]; // IDs of animated values being animated
}

export const useAnimatedValues = () => {
  const { createAnimationRef, nullRef } = useRefs();
  const { createTimeout, clearTimer } = useTimers();
  
  const animatedValuesRef = useRef<Map<string, AnimatedValueEntry>>(new Map());
  const workletsRef = useRef<Map<string, WorkletEntry>>(new Map());
  const animationsRef = useRef<Map<string, AnimationEntry>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique ID for animated values
  const generateValueId = useCallback((prefix: string = 'animated') => {
    return `${prefix}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Register an externally created shared value (e.g., from Reanimated useSharedValue)
  const registerAnimatedValue = useCallback(
    (
      description: string,
      sharedValue: any
    ): string => {
      const valueId = generateValueId('external_value');

    const initialValue = sharedValue?.value as any;
    const entry: AnimatedValueEntry<any> = {
        id: valueId,
        value: sharedValue,
        type: 'shared-value',
        initialValue,
      description: `external-${description || 'unnamed'}`,
      dependencies: [],
      listeners: new Map(),
      lastAccessed: Date.now(),
      cleanup: () => {
        try {
          // Best-effort reset for shared values
          if (sharedValue && typeof sharedValue === 'object' && 'value' in sharedValue) {
            (sharedValue as any).value = initialValue;
          }
        } catch {}
      },
    };

    animatedValuesRef.current.set(valueId, entry);
    return valueId;
  }, [generateValueId]);

  // Create managed shared value with automatic cleanup
  const createSharedValue = useCallback(<T>({
    initialValue,
    description,
    dependencies = [],
  }: {
    initialValue: T;
    description?: string;
    dependencies?: string[];
  }): [SharedValue<T>, string] => {
    const valueId = generateValueId('shared_value');
    
    // Create the actual shared value (this would use react-native-reanimated in real usage)
    const sharedValue: SharedValue<T> = {
      value: initialValue,
      addListener: function(callbackOrId: any, maybeListener?: any): any {
        const listenerId = `listener_${Date.now()}_${Math.random()}`;
        const entry = animatedValuesRef.current.get(valueId);
        if (entry) {
          const cb = typeof callbackOrId === 'function' ? callbackOrId : maybeListener;
          if (typeof cb === 'function') {
            entry.listeners.set(listenerId, cb);
          }
        }
        return listenerId;
      },
      removeListener: function(listenerId: string | number): void {
        const entry = animatedValuesRef.current.get(valueId);
        if (entry) {
          entry.listeners.delete(String(listenerId));
        }
      },
      modify: function(callback: (value: T) => T): void {
        this.value = callback(this.value);
        // Notify listeners
        const entry = animatedValuesRef.current.get(valueId);
        if (entry) {
          entry.listeners.forEach(listener => listener(this.value));
        }
      },
    };

    const entry: AnimatedValueEntry<T> = {
      id: valueId,
      value: sharedValue,
      type: 'shared-value',
      initialValue,
      description: `shared-value-${description || 'unnamed'}`,
      dependencies,
      listeners: new Map(),
      lastAccessed: Date.now(),
      cleanup: () => {
        // Clear all listeners
        entry.listeners.clear();
        // Reset to initial value
        sharedValue.value = initialValue;
      },
    };

    animatedValuesRef.current.set(valueId, entry);

    return [sharedValue, valueId];
  }, [generateValueId]);

  // Create animated style with dependency tracking
  const createAnimatedStyle = useCallback((
    styleFactory: () => AnimatedStyle,
    dependencies: string[] = [],
    description?: string
  ): [AnimatedStyle, string] => {
    const styleId = generateValueId('animated_style');
    
    const animatedStyle = styleFactory();
    
    const entry: AnimatedValueEntry<AnimatedStyle> = {
      id: styleId,
      value: { value: animatedStyle } as SharedValue<AnimatedStyle>, // Wrapper for consistency
      type: 'animated-style',
      initialValue: animatedStyle,
      description: `animated-style-${description || 'unnamed'}`,
      dependencies,
      listeners: new Map(),
      lastAccessed: Date.now(),
      cleanup: () => {
        // Platform-specific cleanup
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          // Clear animated properties
          Object.keys(animatedStyle).forEach(key => {
            delete animatedStyle[key];
          });
        }
      },
    };

    animatedValuesRef.current.set(styleId, entry);

    return [animatedStyle, styleId];
  }, [generateValueId]);

  // Create derived value that depends on other animated values
  const createDerivedValue = useCallback(<T>({
    computation,
    dependencies,
    description,
  }: {
    computation: () => T;
    dependencies: string[];
    description?: string;
  }): [SharedValue<T>, string] => {
    const derivedId = generateValueId('derived_value');
    
    const computeValue = () => {
      try {
        return computation();
      } catch (error) {
        logError(`Error in derived value ${derivedId}:`, "Error", error);
        return undefined as T;
      }
    };

    const initialValue = computeValue();
    const [sharedValue, _] = createSharedValue({
      initialValue,
      description: `derived-${description || 'unnamed'}`,
      dependencies,
    });

    // Update the entry type
    const entry = animatedValuesRef.current.get(derivedId);
    if (entry) {
      entry.type = 'derived-value';
      entry.id = derivedId; // Use the derived ID instead
    }

    // Set up dependency tracking
    dependencies.forEach(depId => {
      const depEntry = animatedValuesRef.current.get(depId);
      if (depEntry && depEntry.value.addListener) {
        const listenerId: any = (depEntry.value.addListener as any)(() => {
          sharedValue.value = computeValue();
        });
        
        // Store listener for cleanup
        if (entry) {
          entry.listeners.set(`dep_${depId}`, () => {
            if (depEntry.value.removeListener) {
              (depEntry.value.removeListener as any)(listenerId as any);
            }
          });
        }
      }
    });

    return [sharedValue, derivedId];
  }, [createSharedValue, generateValueId]);

  // Create interpolation with automatic cleanup
  const createInterpolation = useCallback(<T>({
    inputValue,
    inputRange,
    outputRange,
    extrapolate = 'clamp',
    description,
  }: {
    inputValue: SharedValue<number>;
    inputRange: number[];
    outputRange: T[];
    extrapolate?: 'identity' | 'clamp' | 'extend';
    description?: string;
  }): [SharedValue<T>, string] => {
    const interpId = generateValueId('interpolation');
    
    const interpolate = (value: number): T => {
      // Simple linear interpolation implementation
      for (let i = 0; i < inputRange.length - 1; i++) {
        if (value >= inputRange[i] && value <= inputRange[i + 1]) {
          const progress = (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
          
          // For numeric values, interpolate
          if (typeof outputRange[i] === 'number' && typeof outputRange[i + 1] === 'number') {
            return (outputRange[i] as any) + progress * ((outputRange[i + 1] as any) - (outputRange[i] as any));
          }
          
          // For non-numeric values, return discrete values
          return progress < 0.5 ? outputRange[i] : outputRange[i + 1];
        }
      }
      
      // Handle extrapolation
      if (value < inputRange[0]) {
        return extrapolate === 'extend' ? outputRange[0] : outputRange[0];
      }
      return extrapolate === 'extend' ? outputRange[outputRange.length - 1] : outputRange[outputRange.length - 1];
    };

    const [interpolatedValue] = createSharedValue({
      initialValue: interpolate(inputValue.value),
      description: `interpolation-${description || 'unnamed'}`,
    });

    // Set up input value listener
    if (inputValue.addListener) {
      const listenerId = (inputValue.addListener as any)((newValue: number) => {
        interpolatedValue.value = interpolate(newValue);
      });

      const entry = animatedValuesRef.current.get(interpId);
      if (entry) {
        entry.type = 'interpolation';
        entry.listeners.set('input_listener', () => {
          if (inputValue.removeListener) {
            (inputValue.removeListener as any)(listenerId);
          }
        });
      }
    }

    return [interpolatedValue, interpId];
  }, [createSharedValue, generateValueId]);

  // Register worklet with cleanup tracking
  const registerWorklet = useCallback((
    worklet: WorkletFunction,
    type: 'gesture' | 'animation' | 'interaction' | 'custom' = 'custom',
    description?: string
  ): string => {
    const workletId = generateValueId('worklet');
    
    const entry: WorkletEntry = {
      id: workletId,
      worklet,
      type,
      description: `worklet-${type}-${description || 'unnamed'}`,
      cleanup: () => {
        // Clear worklet references
        Object.keys(worklet).forEach(key => {
          if (key.startsWith('__')) {
            delete (worklet as any)[key];
          }
        });
      },
    };

    workletsRef.current.set(workletId, entry);
    return workletId;
  }, [generateValueId]);

  // Track running animations
  const trackAnimation = useCallback((
    type: 'timing' | 'spring' | 'decay' | 'sequence' | 'parallel' | 'loop' | 'delay',
    targetValueIds: string[],
    duration?: number,
    description?: string,
    cancelCallback?: () => void
  ): string => {
    const animationId = generateValueId('animation');
    
    const entry: AnimationEntry = {
      id: animationId,
      type,
      isRunning: true,
      startedAt: Date.now(),
      duration,
      description: `animation-${type}-${description || 'unnamed'}`,
      cancel: cancelCallback,
      targetValues: targetValueIds,
    };

    animationsRef.current.set(animationId, entry);

    // Auto-cleanup after duration (if specified)
    if (duration) {
      createTimeout(() => {
        const anim = animationsRef.current.get(animationId);
        if (anim) {
          anim.isRunning = false;
        }
      }, duration, `animation_timeout_${animationId}`);
    }

    return animationId;
  }, [generateValueId, createTimeout]);

  // Stop and cleanup animation
  const stopAnimation = useCallback((animationId: string): boolean => {
    const animation = animationsRef.current.get(animationId);
    if (!animation) return false;

    if (animation.cancel) {
      animation.cancel();
    }

    animation.isRunning = false;
    animationsRef.current.delete(animationId);
    
    return true;
  }, []);

  // Get animated value by ID
  const getAnimatedValue = useCallback(<T>(valueId: string): SharedValue<T> | null => {
    const entry = animatedValuesRef.current.get(valueId);
    if (!entry) return null;

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.value as SharedValue<T>;
  }, []);

  // Update animated value
  const updateAnimatedValue = useCallback(<T>(valueId: string, newValue: T): boolean => {
    const entry = animatedValuesRef.current.get(valueId);
    if (!entry) return false;

    entry.value.value = newValue;
    entry.lastAccessed = Date.now();
    
    // Notify listeners
    entry.listeners.forEach(listener => listener(newValue));
    
    return true;
  }, []);

  // Cleanup specific animated value
  const cleanupAnimatedValue = useCallback((valueId: string): boolean => {
    const entry = animatedValuesRef.current.get(valueId);
    if (!entry) return false;

    try {
      // Run custom cleanup
      if (entry.cleanup) {
        entry.cleanup();
      }

      // Clear listeners
      entry.listeners.clear();

      // Remove from tracking
      animatedValuesRef.current.delete(valueId);
      
      return true;
    } catch (error) {
      logError(`Error cleaning up animated value ${valueId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cleanup worklet
  const cleanupWorklet = useCallback((workletId: string): boolean => {
    const entry = workletsRef.current.get(workletId);
    if (!entry) return false;

    try {
      if (entry.cleanup) {
        entry.cleanup();
      }
      
      workletsRef.current.delete(workletId);
      return true;
    } catch (error) {
      logError(`Error cleaning up worklet ${workletId}:`, "Error", error);
      return false;
    }
  }, []);

  // Get status of all animated resources
  const getAnimationStatus = useCallback(() => {
    const values = Array.from(animatedValuesRef.current.values());
    const worklets = Array.from(workletsRef.current.values());
    const animations = Array.from(animationsRef.current.values());
    const now = Date.now();

    return {
      animatedValues: {
        total: values.length,
        byType: values.reduce((acc, value) => {
          acc[value.type] = (acc[value.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        stale: values.filter(v => v.lastAccessed && (now - v.lastAccessed) > 300000).length, // 5 minutes
        withListeners: values.filter(v => v.listeners.size > 0).length,
      },
      worklets: {
        total: worklets.length,
        byType: worklets.reduce((acc, worklet) => {
          acc[worklet.type] = (acc[worklet.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      animations: {
        total: animations.length,
        running: animations.filter(a => a.isRunning).length,
        byType: animations.reduce((acc, anim) => {
          acc[anim.type] = (acc[anim.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        longRunning: animations.filter(a => a.isRunning && (now - a.startedAt) > 60000), // 1 minute
      },
    };
  }, []);

  // Find potential animation leaks
  const findAnimationLeaks = useCallback(() => {
    const values = Array.from(animatedValuesRef.current.values());
    const animations = Array.from(animationsRef.current.values());
    const now = Date.now();
    
    const leaks: Array<{
      id: string;
      type: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    // Check for stale animated values
    values.forEach(value => {
      if (value.lastAccessed && (now - value.lastAccessed) > 600000) { // 10 minutes
        leaks.push({
          id: value.id,
          type: value.type,
          issue: `Stale animated value: not accessed for ${Math.round((now - value.lastAccessed) / 60000)} minutes`,
          severity: 'medium',
          recommendation: 'Consider cleaning up unused animated values',
        });
      }

      if (value.listeners.size > 10) {
        leaks.push({
          id: value.id,
          type: value.type,
          issue: `High listener count: ${value.listeners.size} listeners`,
          severity: 'high',
          recommendation: 'Check for listener leaks and ensure proper cleanup',
        });
      }
    });

    // Check for long-running animations
    animations.forEach(animation => {
      if (animation.isRunning && (now - animation.startedAt) > 300000) { // 5 minutes
        leaks.push({
          id: animation.id,
          type: animation.type,
          issue: `Long-running animation: ${Math.round((now - animation.startedAt) / 60000)} minutes`,
          severity: animation.type === 'loop' ? 'low' : 'high',
          recommendation: animation.type === 'loop' 
            ? 'Verify loop animation is intentional'
            : 'Check if animation is stuck or needs cancellation',
        });
      }
    });

    return leaks;
  }, []);

  // Cleanup all animated resources
  const cleanupAllAnimatedValues = useCallback((): {
    cleaned: { values: number; worklets: number; animations: number };
    errors: string[];
  } => {
    const result = {
      cleaned: { values: 0, worklets: 0, animations: 0 },
      errors: [] as string[],
    };

    // Stop all running animations
    for (const [id, animation] of animationsRef.current.entries()) {
      try {
        if (animation.isRunning && animation.cancel) {
          animation.cancel();
        }
        animationsRef.current.delete(id);
        result.cleaned.animations++;
      } catch (error) {
        result.errors.push(`Failed to cleanup animation ${id}: ${error}`);
      }
    }

    // Cleanup all worklets
    for (const [id] of workletsRef.current.entries()) {
      try {
        if (cleanupWorklet(id)) {
          result.cleaned.worklets++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup worklet ${id}: ${error}`);
      }
    }

    // Cleanup all animated values
    for (const [id] of animatedValuesRef.current.entries()) {
      try {
        if (cleanupAnimatedValue(id)) {
          result.cleaned.values++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup animated value ${id}: ${error}`);
      }
    }

    return result;
  }, [cleanupAnimatedValue, cleanupWorklet]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanupResult = cleanupAllAnimatedValues();
      if (__DEV__ && (cleanupResult.cleaned.values > 0 || cleanupResult.cleaned.worklets > 0 || cleanupResult.cleaned.animations > 0)) {
        logDebug(`🧹 Animation cleanup on unmount:`, "Debug", cleanupResult.cleaned);
        if (cleanupResult.errors.length > 0) {
          logWarn('🚨 Animation cleanup errors:', "Warning", cleanupResult.errors);
        }
      }
    };
  }, [cleanupAllAnimatedValues]);

  return {
    // Animated value creation
    createSharedValue,
    createAnimatedStyle,
    createDerivedValue,
    createInterpolation,
    registerAnimatedValue,
    
    // Worklet management
    registerWorklet,
    
    // Animation tracking
    trackAnimation,
    stopAnimation,
    
    // Value access and manipulation
    getAnimatedValue,
    updateAnimatedValue,
    
    // Cleanup operations
    cleanupAnimatedValue,
    cleanupWorklet,
    cleanupAllAnimatedValues,
    
    // Status and debugging
    getAnimationStatus,
    findAnimationLeaks,
  };
};

// Specialized hook for React Native Reanimated 3.x integration
export const useReanimated3Values = () => {
  const animatedValues = useAnimatedValues();

  // Helper for creating shared values with Reanimated 3 syntax
  const useSharedValue = useCallback(<T>(initialValue: T, description?: string) => {
    const [sharedValue, id] = animatedValues.createSharedValue({
      initialValue,
      description,
    });
    
    return sharedValue;
  }, [animatedValues]);

  // Helper for creating animated styles with Reanimated 3 syntax
  const useAnimatedStyle = useCallback((
    styleFactory: () => any,
    dependencies: string[] = [],
    description?: string
  ) => {
    const [animatedStyle] = animatedValues.createAnimatedStyle(
      styleFactory,
      dependencies,
      description
    );
    
    return animatedStyle;
  }, [animatedValues]);

  return {
    ...animatedValues,
    useSharedValue,
    useAnimatedStyle,
  };
};
