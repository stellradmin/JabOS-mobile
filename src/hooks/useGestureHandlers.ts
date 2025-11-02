// Memory-safe React Native Gesture Handler management
// Automatically cleans up gesture handlers, recognizers, and related resources
// Prevents memory leaks in React Native gesture handling

import { useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRefs } from './useRefs';
import { useTimers } from './useTimers';
import { useAnimatedValues } from './useAnimatedValues';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

// React Native Gesture Handler types (these would be imported from 'react-native-gesture-handler' in real usage)
interface GestureHandler {
  handlerTag?: number;
  config?: any;
  enabled?: boolean;
  shouldCancelWhenOutside?: boolean;
  simultaneousHandlers?: any[];
  waitFor?: any[];
  isWorklet?: boolean;
}

interface PanGestureHandler extends GestureHandler {
  onBegin?: (event: any) => void;
  onUpdate?: (event: any) => void;
  onEnd?: (event: any) => void;
  onFail?: (event: any) => void;
  onCancel?: (event: any) => void;
  minDistance?: number;
  minVelocity?: number;
  minPointers?: number;
  maxPointers?: number;
  activeOffsetX?: number[];
  activeOffsetY?: number[];
  failOffsetX?: number[];
  failOffsetY?: number[];
}

interface TapGestureHandler extends GestureHandler {
  onBegin?: (event: any) => void;
  onEnd?: (event: any) => void;
  onFail?: (event: any) => void;
  numberOfTaps?: number;
  maxDurationMs?: number;
  maxDelayMs?: number;
  maxDeltaX?: number;
  maxDeltaY?: number;
  maxDistance?: number;
  minPointers?: number;
}

interface PinchGestureHandler extends GestureHandler {
  onBegin?: (event: any) => void;
  onUpdate?: (event: any) => void;
  onEnd?: (event: any) => void;
  onFail?: (event: any) => void;
  onCancel?: (event: any) => void;
}

interface RotationGestureHandler extends GestureHandler {
  onBegin?: (event: any) => void;
  onUpdate?: (event: any) => void;
  onEnd?: (event: any) => void;
  onFail?: (event: any) => void;
  onCancel?: (event: any) => void;
}

interface FlingGestureHandler extends GestureHandler {
  onBegin?: (event: any) => void;
  onEnd?: (event: any) => void;
  onFail?: (event: any) => void;
  direction?: number;
  numberOfPointers?: number;
}

interface LongPressGestureHandler extends GestureHandler {
  onBegin?: (event: any) => void;
  onEnd?: (event: any) => void;
  onFail?: (event: any) => void;
  onCancel?: (event: any) => void;
  minDurationMs?: number;
  maxDistance?: number;
}

type GestureType = 'pan' | 'tap' | 'pinch' | 'rotation' | 'fling' | 'longPress' | 'native' | 'manual';

interface GestureEntry {
  id: string;
  handler: GestureHandler;
  type: GestureType;
  description?: string;
  enabled: boolean;
  simultaneousHandlers: Set<string>;
  waitForHandlers: Set<string>;
  animatedValueIds: string[]; // References to animated values used by this gesture
  workletIds: string[]; // References to worklets used by this gesture
  eventCallbacks: Map<string, Function>;
  isActive: boolean;
  lastActiveTime?: number;
  cleanup?: () => void;
}

interface GestureComposition {
  id: string;
  name: string;
  gestures: string[]; // Gesture IDs in this composition
  type: 'simultaneous' | 'exclusive' | 'race' | 'sequence';
  enabled: boolean;
  cleanup?: () => void;
}

export const useGestureHandlers = () => {
  const { createGestureRef, nullRef } = useRefs();
  const { createTimeout, clearTimer } = useTimers();
  const { registerWorklet, getAnimatedValue } = useAnimatedValues();
  
  const gesturesRef = useRef<Map<string, GestureEntry>>(new Map());
  const compositionsRef = useRef<Map<string, GestureComposition>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique gesture ID
  const generateGestureId = useCallback((type: GestureType) => {
    return `gesture_${type}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Create managed pan gesture with automatic cleanup
  const createPanGesture = useCallback((config: {
    onBegin?: (event: any) => void;
    onUpdate?: (event: any) => void;
    onEnd?: (event: any) => void;
    onFail?: (event: any) => void;
    onCancel?: (event: any) => void;
    minDistance?: number;
    minVelocity?: number;
    minPointers?: number;
    maxPointers?: number;
    activeOffsetX?: number[];
    activeOffsetY?: number[];
    failOffsetX?: number[];
    failOffsetY?: number[];
    description?: string;
    animatedValueIds?: string[];
    enabled?: boolean;
  } = {}): [PanGestureHandler, string] => {
    const gestureId = generateGestureId('pan');
    const [gestureRef, refId] = createGestureRef(`pan-gesture-${config.description || gestureId}`);

    const handler: PanGestureHandler = {
      handlerTag: Math.floor(Math.random() * 1000000), // Simulate handler tag
      enabled: config.enabled ?? true,
      onBegin: config.onBegin,
      onUpdate: config.onUpdate,
      onEnd: config.onEnd,
      onFail: config.onFail,
      onCancel: config.onCancel,
      minDistance: config.minDistance,
      minVelocity: config.minVelocity,
      minPointers: config.minPointers ?? 1,
      maxPointers: config.maxPointers ?? 1,
      activeOffsetX: config.activeOffsetX,
      activeOffsetY: config.activeOffsetY,
      failOffsetX: config.failOffsetX,
      failOffsetY: config.failOffsetY,
    };

    const eventCallbacks = new Map<string, Function>();
    if (config.onBegin) eventCallbacks.set('onBegin', config.onBegin);
    if (config.onUpdate) eventCallbacks.set('onUpdate', config.onUpdate);
    if (config.onEnd) eventCallbacks.set('onEnd', config.onEnd);
    if (config.onFail) eventCallbacks.set('onFail', config.onFail);
    if (config.onCancel) eventCallbacks.set('onCancel', config.onCancel);

    const entry: GestureEntry = {
      id: gestureId,
      handler,
      type: 'pan',
      description: `pan-gesture-${config.description || 'unnamed'}`,
      enabled: config.enabled ?? true,
      simultaneousHandlers: new Set(),
      waitForHandlers: new Set(),
      animatedValueIds: config.animatedValueIds || [],
      workletIds: [],
      eventCallbacks,
      isActive: false,
      cleanup: () => {
        // Clear event callbacks
        eventCallbacks.clear();
        
        // Disable handler
        handler.enabled = false;
        
        // Clear animated value references
        entry.animatedValueIds.length = 0;
        
        // Null the gesture ref
        nullRef(refId);
      },
    };

    gesturesRef.current.set(gestureId, entry);

    return [handler, gestureId];
  }, [generateGestureId, createGestureRef, nullRef]);

  // Create managed tap gesture with automatic cleanup
  const createTapGesture = useCallback((config: {
    onBegin?: (event: any) => void;
    onEnd?: (event: any) => void;
    onFail?: (event: any) => void;
    numberOfTaps?: number;
    maxDurationMs?: number;
    maxDelayMs?: number;
    maxDeltaX?: number;
    maxDeltaY?: number;
    maxDistance?: number;
    minPointers?: number;
    description?: string;
    animatedValueIds?: string[];
    enabled?: boolean;
  } = {}): [TapGestureHandler, string] => {
    const gestureId = generateGestureId('tap');
    const [gestureRef, refId] = createGestureRef(`tap-gesture-${config.description || gestureId}`);

    const handler: TapGestureHandler = {
      handlerTag: Math.floor(Math.random() * 1000000),
      enabled: config.enabled ?? true,
      onBegin: config.onBegin,
      onEnd: config.onEnd,
      onFail: config.onFail,
      numberOfTaps: config.numberOfTaps ?? 1,
      maxDurationMs: config.maxDurationMs,
      maxDelayMs: config.maxDelayMs,
      maxDeltaX: config.maxDeltaX,
      maxDeltaY: config.maxDeltaY,
      maxDistance: config.maxDistance,
      minPointers: config.minPointers ?? 1,
    };

    const eventCallbacks = new Map<string, Function>();
    if (config.onBegin) eventCallbacks.set('onBegin', config.onBegin);
    if (config.onEnd) eventCallbacks.set('onEnd', config.onEnd);
    if (config.onFail) eventCallbacks.set('onFail', config.onFail);

    const entry: GestureEntry = {
      id: gestureId,
      handler,
      type: 'tap',
      description: `tap-gesture-${config.description || 'unnamed'}`,
      enabled: config.enabled ?? true,
      simultaneousHandlers: new Set(),
      waitForHandlers: new Set(),
      animatedValueIds: config.animatedValueIds || [],
      workletIds: [],
      eventCallbacks,
      isActive: false,
      cleanup: () => {
        eventCallbacks.clear();
        handler.enabled = false;
        entry.animatedValueIds.length = 0;
        nullRef(refId);
      },
    };

    gesturesRef.current.set(gestureId, entry);

    return [handler, gestureId];
  }, [generateGestureId, createGestureRef, nullRef]);

  // Create managed pinch gesture with automatic cleanup
  const createPinchGesture = useCallback((config: {
    onBegin?: (event: any) => void;
    onUpdate?: (event: any) => void;
    onEnd?: (event: any) => void;
    onFail?: (event: any) => void;
    onCancel?: (event: any) => void;
    description?: string;
    animatedValueIds?: string[];
    enabled?: boolean;
  } = {}): [PinchGestureHandler, string] => {
    const gestureId = generateGestureId('pinch');
    const [gestureRef, refId] = createGestureRef(`pinch-gesture-${config.description || gestureId}`);

    const handler: PinchGestureHandler = {
      handlerTag: Math.floor(Math.random() * 1000000),
      enabled: config.enabled ?? true,
      onBegin: config.onBegin,
      onUpdate: config.onUpdate,
      onEnd: config.onEnd,
      onFail: config.onFail,
      onCancel: config.onCancel,
    };

    const eventCallbacks = new Map<string, Function>();
    if (config.onBegin) eventCallbacks.set('onBegin', config.onBegin);
    if (config.onUpdate) eventCallbacks.set('onUpdate', config.onUpdate);
    if (config.onEnd) eventCallbacks.set('onEnd', config.onEnd);
    if (config.onFail) eventCallbacks.set('onFail', config.onFail);
    if (config.onCancel) eventCallbacks.set('onCancel', config.onCancel);

    const entry: GestureEntry = {
      id: gestureId,
      handler,
      type: 'pinch',
      description: `pinch-gesture-${config.description || 'unnamed'}`,
      enabled: config.enabled ?? true,
      simultaneousHandlers: new Set(),
      waitForHandlers: new Set(),
      animatedValueIds: config.animatedValueIds || [],
      workletIds: [],
      eventCallbacks,
      isActive: false,
      cleanup: () => {
        eventCallbacks.clear();
        handler.enabled = false;
        entry.animatedValueIds.length = 0;
        nullRef(refId);
      },
    };

    gesturesRef.current.set(gestureId, entry);

    return [handler, gestureId];
  }, [generateGestureId, createGestureRef, nullRef]);

  // Create managed long press gesture
  const createLongPressGesture = useCallback((config: {
    onBegin?: (event: any) => void;
    onEnd?: (event: any) => void;
    onFail?: (event: any) => void;
    onCancel?: (event: any) => void;
    minDurationMs?: number;
    maxDistance?: number;
    description?: string;
    animatedValueIds?: string[];
    enabled?: boolean;
  } = {}): [LongPressGestureHandler, string] => {
    const gestureId = generateGestureId('longPress');
    const [gestureRef, refId] = createGestureRef(`longpress-gesture-${config.description || gestureId}`);

    const handler: LongPressGestureHandler = {
      handlerTag: Math.floor(Math.random() * 1000000),
      enabled: config.enabled ?? true,
      onBegin: config.onBegin,
      onEnd: config.onEnd,
      onFail: config.onFail,
      onCancel: config.onCancel,
      minDurationMs: config.minDurationMs ?? 500,
      maxDistance: config.maxDistance ?? 10,
    };

    const eventCallbacks = new Map<string, Function>();
    if (config.onBegin) eventCallbacks.set('onBegin', config.onBegin);
    if (config.onEnd) eventCallbacks.set('onEnd', config.onEnd);
    if (config.onFail) eventCallbacks.set('onFail', config.onFail);
    if (config.onCancel) eventCallbacks.set('onCancel', config.onCancel);

    const entry: GestureEntry = {
      id: gestureId,
      handler,
      type: 'longPress',
      description: `longpress-gesture-${config.description || 'unnamed'}`,
      enabled: config.enabled ?? true,
      simultaneousHandlers: new Set(),
      waitForHandlers: new Set(),
      animatedValueIds: config.animatedValueIds || [],
      workletIds: [],
      eventCallbacks,
      isActive: false,
      cleanup: () => {
        eventCallbacks.clear();
        handler.enabled = false;
        entry.animatedValueIds.length = 0;
        nullRef(refId);
      },
    };

    gesturesRef.current.set(gestureId, entry);

    return [handler, gestureId];
  }, [generateGestureId, createGestureRef, nullRef]);

  // Set up gesture composition (simultaneous, exclusive, etc.)
  const createGestureComposition = useCallback((
    name: string,
    gestureIds: string[],
    type: 'simultaneous' | 'exclusive' | 'race' | 'sequence' = 'simultaneous'
  ): string => {
    const compositionId = `composition_${name}_${Date.now()}`;

    const composition: GestureComposition = {
      id: compositionId,
      name,
      gestures: [...gestureIds],
      type,
      enabled: true,
      cleanup: () => {
        // Remove composition references from gestures
        gestureIds.forEach(gestureId => {
          const gesture = gesturesRef.current.get(gestureId);
          if (gesture) {
            gesture.simultaneousHandlers.delete(compositionId);
            gesture.waitForHandlers.delete(compositionId);
          }
        });
      },
    };

    compositionsRef.current.set(compositionId, composition);

    // Update gesture relationships based on composition type
    if (type === 'simultaneous') {
      gestureIds.forEach(gestureId => {
        const gesture = gesturesRef.current.get(gestureId);
        if (gesture) {
          gestureIds.forEach(otherId => {
            if (otherId !== gestureId) {
              gesture.simultaneousHandlers.add(otherId);
            }
          });
        }
      });
    }

    return compositionId;
  }, []);

  // Enable/disable gesture
  const setGestureEnabled = useCallback((gestureId: string, enabled: boolean): boolean => {
    const gesture = gesturesRef.current.get(gestureId);
    if (!gesture) return false;

    gesture.enabled = enabled;
    gesture.handler.enabled = enabled;
    
    return true;
  }, []);

  // Mark gesture as active (for tracking)
  const markGestureActive = useCallback((gestureId: string, isActive: boolean): boolean => {
    const gesture = gesturesRef.current.get(gestureId);
    if (!gesture) return false;

    gesture.isActive = isActive;
    if (isActive) {
      gesture.lastActiveTime = Date.now();
    }
    
    return true;
  }, []);

  // Update gesture animated values
  const updateGestureAnimatedValues = useCallback((
    gestureId: string,
    valueUpdates: Record<string, any>
  ): boolean => {
    const gesture = gesturesRef.current.get(gestureId);
    if (!gesture) return false;

    gesture.animatedValueIds.forEach(valueId => {
      if (valueUpdates.hasOwnProperty(valueId)) {
        const animatedValue = getAnimatedValue(valueId);
        if (animatedValue) {
          animatedValue.value = valueUpdates[valueId];
        }
      }
    });
    
    return true;
  }, [getAnimatedValue]);

  // Cleanup specific gesture
  const cleanupGesture = useCallback((gestureId: string): boolean => {
    const gesture = gesturesRef.current.get(gestureId);
    if (!gesture) return false;

    try {
      // Run custom cleanup
      if (gesture.cleanup) {
        gesture.cleanup();
      }

      // Remove from any compositions
      for (const [compositionId, composition] of compositionsRef.current.entries()) {
        const index = composition.gestures.indexOf(gestureId);
        if (index !== -1) {
          composition.gestures.splice(index, 1);
        }
      }

      // Remove from tracking
      gesturesRef.current.delete(gestureId);
      
      return true;
    } catch (error) {
      logError(`Error cleaning up gesture ${gestureId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cleanup gesture composition
  const cleanupGestureComposition = useCallback((compositionId: string): boolean => {
    const composition = compositionsRef.current.get(compositionId);
    if (!composition) return false;

    try {
      if (composition.cleanup) {
        composition.cleanup();
      }
      
      compositionsRef.current.delete(compositionId);
      return true;
    } catch (error) {
      logError(`Error cleaning up gesture composition ${compositionId}:`, "Error", error);
      return false;
    }
  }, []);

  // Get gesture status
  const getGestureStatus = useCallback(() => {
    const gestures = Array.from(gesturesRef.current.values());
    const compositions = Array.from(compositionsRef.current.values());
    const now = Date.now();

    return {
      gestures: {
        total: gestures.length,
        enabled: gestures.filter(g => g.enabled).length,
        active: gestures.filter(g => g.isActive).length,
        byType: gestures.reduce((acc, gesture) => {
          acc[gesture.type] = (acc[gesture.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        stale: gestures.filter(g => 
          g.lastActiveTime && (now - g.lastActiveTime) > 300000 // 5 minutes
        ).length,
        withAnimatedValues: gestures.filter(g => g.animatedValueIds.length > 0).length,
      },
      compositions: {
        total: compositions.length,
        enabled: compositions.filter(c => c.enabled).length,
        byType: compositions.reduce((acc, comp) => {
          acc[comp.type] = (acc[comp.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };
  }, []);

  // Find potential gesture leaks
  const findGestureLeaks = useCallback(() => {
    const gestures = Array.from(gesturesRef.current.values());
    const now = Date.now();
    
    const leaks: Array<{
      id: string;
      type: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    gestures.forEach(gesture => {
      // Check for stale gestures
      if (gesture.lastActiveTime && (now - gesture.lastActiveTime) > 600000) { // 10 minutes
        leaks.push({
          id: gesture.id,
          type: gesture.type,
          issue: `Stale gesture: not active for ${Math.round((now - gesture.lastActiveTime) / 60000)} minutes`,
          severity: 'medium',
          recommendation: 'Consider cleaning up unused gestures',
        });
      }

      // Check for gestures with many event callbacks
      if (gesture.eventCallbacks.size > 5) {
        leaks.push({
          id: gesture.id,
          type: gesture.type,
          issue: `High callback count: ${gesture.eventCallbacks.size} event callbacks`,
          severity: 'medium',
          recommendation: 'Check for unnecessary event handlers',
        });
      }

      // Check for gestures with many animated values
      if (gesture.animatedValueIds.length > 10) {
        leaks.push({
          id: gesture.id,
          type: gesture.type,
          issue: `High animated value count: ${gesture.animatedValueIds.length} animated values`,
          severity: 'medium',
          recommendation: 'Consider optimizing animated value usage',
        });
      }

      // Check for disabled gestures that are still tracked
      if (!gesture.enabled && gesture.lastActiveTime && (now - gesture.lastActiveTime) > 60000) { // 1 minute
        leaks.push({
          id: gesture.id,
          type: gesture.type,
          issue: 'Disabled gesture still being tracked',
          severity: 'low',
          recommendation: 'Clean up disabled gestures to free memory',
        });
      }
    });

    return leaks;
  }, []);

  // Cleanup all gestures and compositions
  const cleanupAllGestures = useCallback((): {
    cleaned: { gestures: number; compositions: number };
    errors: string[];
  } => {
    const result = {
      cleaned: { gestures: 0, compositions: 0 },
      errors: [] as string[],
    };

    // Cleanup all compositions first
    for (const [compositionId] of compositionsRef.current.entries()) {
      try {
        if (cleanupGestureComposition(compositionId)) {
          result.cleaned.compositions++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup composition ${compositionId}: ${error}`);
      }
    }

    // Cleanup all gestures
    for (const [gestureId] of gesturesRef.current.entries()) {
      try {
        if (cleanupGesture(gestureId)) {
          result.cleaned.gestures++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup gesture ${gestureId}: ${error}`);
      }
    }

    return result;
  }, [cleanupGesture, cleanupGestureComposition]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanupResult = cleanupAllGestures();
      if (__DEV__ && (cleanupResult.cleaned.gestures > 0 || cleanupResult.cleaned.compositions > 0)) {
        logDebug(`🧹 Gesture cleanup on unmount:`, "Debug", cleanupResult.cleaned);
        if (cleanupResult.errors.length > 0) {
          logWarn('🚨 Gesture cleanup errors:', "Warning", cleanupResult.errors);
        }
      }
    };
  }, [cleanupAllGestures]);

  return {
    // Gesture creation
    createPanGesture,
    createTapGesture,
    createPinchGesture,
    createLongPressGesture,
    
    // Gesture composition
    createGestureComposition,
    
    // Gesture control
    setGestureEnabled,
    markGestureActive,
    updateGestureAnimatedValues,
    
    // Cleanup operations
    cleanupGesture,
    cleanupGestureComposition,
    cleanupAllGestures,
    
    // Status and debugging
    getGestureStatus,
    findGestureLeaks,
  };
};

// Specialized hook for common gesture patterns
export const useCommonGestures = () => {
  const { 
    createPanGesture, 
    createTapGesture, 
    createPinchGesture, 
    createLongPressGesture,
    createGestureComposition 
  } = useGestureHandlers();

  // Create swipe gesture (pan with directional constraints)
  const createSwipeGesture = useCallback((config: {
    direction: 'left' | 'right' | 'up' | 'down';
    onSwipe?: (event: any) => void;
    minVelocity?: number;
    maxDuration?: number;
    description?: string;
  }) => {
    const { direction, onSwipe, minVelocity = 200, maxDuration = 300 } = config;
    
    const startTime = Date.now();
    
    return createPanGesture({
      minVelocity,
      onEnd: (event) => {
        const duration = Date.now() - startTime;
        if (duration > maxDuration) return;
        
        const { translationX, translationY, velocityX, velocityY } = event;
        
        let isValidSwipe = false;
        
        switch (direction) {
          case 'left':
            isValidSwipe = translationX < -50 && Math.abs(velocityX) > minVelocity && velocityX < 0;
            break;
          case 'right':
            isValidSwipe = translationX > 50 && Math.abs(velocityX) > minVelocity && velocityX > 0;
            break;
          case 'up':
            isValidSwipe = translationY < -50 && Math.abs(velocityY) > minVelocity && velocityY < 0;
            break;
          case 'down':
            isValidSwipe = translationY > 50 && Math.abs(velocityY) > minVelocity && velocityY > 0;
            break;
        }
        
        if (isValidSwipe && onSwipe) {
          onSwipe(event);
        }
      },
      description: `swipe-${direction}-${config.description || 'unnamed'}`,
    });
  }, [createPanGesture]);

  // Create double tap gesture
  const createDoubleTapGesture = useCallback((config: {
    onDoubleTap?: (event: any) => void;
    maxDelayMs?: number;
    maxDistance?: number;
    description?: string;
  } = {}) => {
    return createTapGesture({
      numberOfTaps: 2,
      maxDelayMs: config.maxDelayMs ?? 300,
      maxDistance: config.maxDistance ?? 10,
      onEnd: config.onDoubleTap,
      description: `double-tap-${config.description || 'unnamed'}`,
    });
  }, [createTapGesture]);

  // Create zoom gesture (pinch with scale tracking)
  const createZoomGesture = useCallback((config: {
    onZoomStart?: (event: any) => void;
    onZoomUpdate?: (event: any) => void;
    onZoomEnd?: (event: any) => void;
    minScale?: number;
    maxScale?: number;
    description?: string;
  } = {}) => {
    const { minScale = 0.5, maxScale = 3.0 } = config;
    let currentScale = 1.0;
    
    return createPinchGesture({
      onBegin: (event) => {
        currentScale = event.scale || 1.0;
        if (config.onZoomStart) {
          config.onZoomStart({ ...event, currentScale });
        }
      },
      onUpdate: (event) => {
        const newScale = Math.max(minScale, Math.min(maxScale, event.scale || 1.0));
        currentScale = newScale;
        
        if (config.onZoomUpdate) {
          config.onZoomUpdate({ ...event, currentScale });
        }
      },
      onEnd: (event) => {
        if (config.onZoomEnd) {
          config.onZoomEnd({ ...event, currentScale });
        }
      },
      description: `zoom-${config.description || 'unnamed'}`,
    });
  }, [createPinchGesture]);

  // Create drag and drop gesture composition
  const createDragAndDropGesture = useCallback((config: {
    onDragStart?: (event: any) => void;
    onDragUpdate?: (event: any) => void;
    onDrop?: (event: any) => void;
    dragThreshold?: number;
    description?: string;
  } = {}) => {
    const { dragThreshold = 10 } = config;
    let isDragging = false;
    let startPosition = { x: 0, y: 0 };
    
    const [longPressHandler, longPressId] = createLongPressGesture({
      minDurationMs: 200,
      maxDistance: dragThreshold,
      onEnd: (event) => {
        startPosition = { x: event.x, y: event.y };
        isDragging = true;
        if (config.onDragStart) {
          config.onDragStart(event);
        }
      },
      description: `drag-start-${config.description || 'unnamed'}`,
    });
    
    const [panHandler, panId] = createPanGesture({
      onUpdate: (event) => {
        if (isDragging && config.onDragUpdate) {
          config.onDragUpdate({
            ...event,
            startPosition,
            deltaX: event.translationX,
            deltaY: event.translationY,
          });
        }
      },
      onEnd: (event) => {
        if (isDragging) {
          isDragging = false;
          if (config.onDrop) {
            config.onDrop({
              ...event,
              startPosition,
              dropPosition: { x: startPosition.x + event.translationX, y: startPosition.y + event.translationY },
            });
          }
        }
      },
      description: `drag-move-${config.description || 'unnamed'}`,
    });
    
    const compositionId = createGestureComposition(
      `drag-drop-${config.description || 'unnamed'}`,
      [longPressId, panId],
      'sequence'
    );
    
    return {
      longPressHandler,
      panHandler,
      compositionId,
      longPressId,
      panId,
    };
  }, [createLongPressGesture, createPanGesture, createGestureComposition]);

  return {
    createSwipeGesture,
    createDoubleTapGesture,
    createZoomGesture,
    createDragAndDropGesture,
  };
};
