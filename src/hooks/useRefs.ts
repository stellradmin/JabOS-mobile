// Memory-safe ref management hook
// Automatically nulls all refs on unmount to prevent memory leaks
// Provides centralized ref management with automatic cleanup

import { useRef, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import { Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface RefEntry<T = any> {
  ref: MutableRefObject<T | null>;
  id: string;
  type: 'element' | 'component' | 'animation' | 'gesture' | 'custom';
  description?: string;
  cleanup?: () => void;
  lastAccessed?: number;
}

interface RefOptions {
  type?: 'element' | 'component' | 'animation' | 'gesture' | 'custom';
  description?: string;
  autoNullOnUnmount?: boolean;
  cleanup?: () => void;
  trackAccess?: boolean;
}

export const useRefs = () => {
  const refsMapRef = useRef<Map<string, RefEntry>>(new Map());
  const nextIdRef = useRef(0);

  // Generate unique ref ID
  const generateRefId = useCallback((prefix: string = 'ref') => {
    return `${prefix}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Create a new managed ref
  const createRef = useCallback(<T = any>(
    initialValue: T | null = null,
    options: RefOptions = {}
  ): [MutableRefObject<T | null>, string] => {
    const {
      type = 'custom',
      description,
      autoNullOnUnmount = true,
      cleanup,
      trackAccess = false,
    } = options;

    const refId = generateRefId(type);
    const ref = useRef<T | null>(initialValue);

    // Create proxy to track access if needed
    let trackedRef = ref;
    if (trackAccess) {
      trackedRef = new Proxy(ref, {
        get(target, prop) {
          if (prop === 'current') {
            const entry = refsMapRef.current.get(refId);
            if (entry) {
              entry.lastAccessed = Date.now();
            }
          }
          return target[prop as keyof typeof target];
        },
      });
    }

    const refEntry: RefEntry<T> = {
      ref,
      id: refId,
      type,
      description,
      cleanup,
      lastAccessed: trackAccess ? Date.now() : undefined,
    };

    refsMapRef.current.set(refId, refEntry);

    return [trackedRef, refId];
  }, [generateRefId]);

  // Create element ref (React Native View/React DOM element)
  const createElementRef = useCallback(<T extends any = any>(
    description?: string
  ): [MutableRefObject<T | null>, string] => {
    return createRef<T>(null, {
      type: 'element',
      description: `element-${description || 'unnamed'}`,
      autoNullOnUnmount: true,
      trackAccess: true,
    });
  }, [createRef]);

  // Create component ref for child component instances
  const createComponentRef = useCallback(<T = any>(
    description?: string
  ): [MutableRefObject<T | null>, string] => {
    return createRef<T>(null, {
      type: 'component',
      description: `component-${description || 'unnamed'}`,
      autoNullOnUnmount: true,
      trackAccess: true,
    });
  }, [createRef]);

  // Create animation ref for React Native Reanimated values
  const createAnimationRef = useCallback(<T = any>(
    initialValue: T | null = null,
    description?: string,
    cleanup?: () => void
  ): [MutableRefObject<T | null>, string] => {
    return createRef<T>(initialValue, {
      type: 'animation',
      description: `animation-${description || 'unnamed'}`,
      autoNullOnUnmount: true,
      cleanup,
      trackAccess: true,
    });
  }, [createRef]);

  // Create gesture ref for React Native gesture handlers
  const createGestureRef = useCallback(<T = any>(
    description?: string,
    cleanup?: () => void
  ): [MutableRefObject<T | null>, string] => {
    return createRef<T>(null, {
      type: 'gesture',
      description: `gesture-${description || 'unnamed'}`,
      autoNullOnUnmount: true,
      cleanup,
      trackAccess: true,
    });
  }, [createRef]);

  // Get ref by ID
  const getRef = useCallback(<T = any>(refId: string): MutableRefObject<T | null> | null => {
    const entry = refsMapRef.current.get(refId);
    if (!entry) return null;

    // Update last accessed time
    if (entry.lastAccessed !== undefined) {
      entry.lastAccessed = Date.now();
    }

    return entry.ref as MutableRefObject<T | null>;
  }, []);

  // Check if ref is still valid/not null
  const isRefValid = useCallback((refId: string): boolean => {
    const entry = refsMapRef.current.get(refId);
    return entry ? entry.ref.current !== null : false;
  }, []);

  // Manually null a specific ref
  const nullRef = useCallback((refId: string): boolean => {
    const entry = refsMapRef.current.get(refId);
    if (!entry) return false;

    try {
      // Run custom cleanup if provided
      if (entry.cleanup) {
        entry.cleanup();
      }

      // Null the ref
      entry.ref.current = null;
      
      return true;
    } catch (error) {
      logError(`Error nulling ref ${refId}:`, "Error", error);
      return false;
    }
  }, []);

  // Null all refs of a specific type
  const nullRefsByType = useCallback((
    type: 'element' | 'component' | 'animation' | 'gesture' | 'custom'
  ): number => {
    let nulledCount = 0;
    
    for (const [id, entry] of refsMapRef.current.entries()) {
      if (entry.type === type) {
        if (nullRef(id)) {
          nulledCount++;
        }
      }
    }
    
    return nulledCount;
  }, [nullRef]);

  // Null all refs
  const nullAllRefs = useCallback((): number => {
    let nulledCount = 0;
    
    for (const [id] of refsMapRef.current.entries()) {
      if (nullRef(id)) {
        nulledCount++;
      }
    }
    
    return nulledCount;
  }, [nullRef]);

  // Remove ref from management (doesn't null it)
  const removeRef = useCallback((refId: string): boolean => {
    return refsMapRef.current.delete(refId);
  }, []);

  // Get refs status for debugging
  const getRefsStatus = useCallback(() => {
    const refs = Array.from(refsMapRef.current.values());
    const now = Date.now();
    
    return {
      total: refs.length,
      byType: refs.reduce((acc, ref) => {
        acc[ref.type] = (acc[ref.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      nullRefs: refs.filter(ref => ref.ref.current === null).length,
      staleRefs: refs.filter(ref => 
        ref.lastAccessed && (now - ref.lastAccessed) > 60000 // 1 minute
      ).length,
      details: refs.map(ref => ({
        id: ref.id,
        type: ref.type,
        description: ref.description,
        isNull: ref.ref.current === null,
        lastAccessed: ref.lastAccessed,
        timeSinceAccess: ref.lastAccessed ? now - ref.lastAccessed : undefined,
      })),
    };
  }, []);

  // Find refs that might be leaking
  const findPotentialLeaks = useCallback(() => {
    const refs = Array.from(refsMapRef.current.values());
    const now = Date.now();
    const leaks: Array<{
      id: string;
      type: string;
      description?: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    refs.forEach(ref => {
      // Check for stale refs (not accessed in 5 minutes)
      if (ref.lastAccessed && (now - ref.lastAccessed) > 300000) {
        leaks.push({
          id: ref.id,
          type: ref.type,
          description: ref.description,
          issue: `Stale ref: not accessed for ${Math.round((now - ref.lastAccessed) / 60000)} minutes`,
          severity: 'medium',
        });
      }

      // Check for non-null refs that should have been cleaned up
      if (ref.ref.current !== null && ref.type === 'element') {
        // For DOM elements, check if they're still in the document
        if (Platform.OS === 'web' && ref.ref.current instanceof Element) {
          if (!document.contains(ref.ref.current)) {
            leaks.push({
              id: ref.id,
              type: ref.type,
              description: ref.description,
              issue: 'Element ref points to detached DOM node',
              severity: 'high',
            });
          }
        }
      }
    });

    return leaks;
  }, []);

  // Batch operations for performance
  const batchNullRefs = useCallback((refIds: string[]): { success: number; failed: number } => {
    let success = 0;
    let failed = 0;

    refIds.forEach(id => {
      if (nullRef(id)) {
        success++;
      } else {
        failed++;
      }
    });

    return { success, failed };
  }, [nullRef]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const nulledCount = nullAllRefs();
      if (__DEV__ && nulledCount > 0) {
        logDebug(`🧹 Auto-nulled ${nulledCount} refs on component unmount`, "Debug");
      }
    };
  }, [nullAllRefs]);

  return {
    // Ref creation
    createRef,
    createElementRef,
    createComponentRef,
    createAnimationRef,
    createGestureRef,
    
    // Ref access
    getRef,
    isRefValid,
    
    // Ref cleanup
    nullRef,
    nullRefsByType,
    nullAllRefs,
    removeRef,
    batchNullRefs,
    
    // Debugging and monitoring
    getRefsStatus,
    findPotentialLeaks,
  };
};

// Specialized hooks for common use cases

// Hook for managing form element refs
export const useFormRefs = () => {
  const { createElementRef, getRef, nullAllRefs, getRefsStatus } = useRefs();

  const createInputRef = useCallback((fieldName: string) => {
    return createElementRef(`input-${fieldName}`);
  }, [createElementRef]);

  const createTextAreaRef = useCallback((fieldName: string) => {
    return createElementRef(`textarea-${fieldName}`);
  }, [createElementRef]);

  const createSelectRef = useCallback((fieldName: string) => {
    return createElementRef(`select-${fieldName}`);
  }, [createElementRef]);

  const focusField = useCallback((refId: string) => {
    const ref = getRef(refId);
    if (ref?.current?.focus) {
      ref.current.focus();
    }
  }, [getRef]);

  const clearForm = useCallback(() => {
    const status = getRefsStatus();
    status.details.forEach(({ id }) => {
      const ref = getRef(id);
      if (ref?.current?.value !== undefined) {
        ref.current.value = '';
      }
    });
  }, [getRefsStatus, getRef]);

  return {
    createInputRef,
    createTextAreaRef,
    createSelectRef,
    focusField,
    clearForm,
    nullAllRefs,
  };
};

// Hook for managing React Native animation refs
export const useAnimationRefs = () => {
  const { createAnimationRef, createGestureRef, nullRefsByType, getRefsStatus } = useRefs();

  const createSharedValueRef = useCallback(<T>(
    initialValue: T,
    description?: string
  ) => {
    return createAnimationRef(initialValue, `shared-value-${description}`, () => {
      // Cleanup shared value if needed
      // This would integrate with React Native Reanimated
    });
  }, [createAnimationRef]);

  const createAnimatedStyleRef = useCallback((description?: string) => {
    return createAnimationRef(null, `animated-style-${description}`, () => {
      // Cleanup animated style
    });
  }, [createAnimationRef]);

  const createPanGestureRef = useCallback((description?: string) => {
    return createGestureRef(`pan-gesture-${description}`, () => {
      // Cleanup gesture handler
    });
  }, [createGestureRef]);

  const createTapGestureRef = useCallback((description?: string) => {
    return createGestureRef(`tap-gesture-${description}`, () => {
      // Cleanup gesture handler
    });
  }, [createGestureRef]);

  const cleanupAllAnimations = useCallback(() => {
    const animationCount = nullRefsByType('animation');
    const gestureCount = nullRefsByType('gesture');
    return { animationCount, gestureCount };
  }, [nullRefsByType]);

  return {
    createSharedValueRef,
    createAnimatedStyleRef,
    createPanGestureRef,
    createTapGestureRef,
    cleanupAllAnimations,
  };
};

// Hook for managing modal and overlay refs
export const useModalRefs = () => {
  const { createElementRef, getRef, nullRef, isRefValid } = useRefs();

  const createModalRef = useCallback((modalName: string) => {
    return createElementRef(`modal-${modalName}`);
  }, [createElementRef]);

  const createBackdropRef = useCallback((modalName: string) => {
    return createElementRef(`backdrop-${modalName}`);
  }, [createElementRef]);

  const createOverlayRef = useCallback((overlayName: string) => {
    return createElementRef(`overlay-${overlayName}`);
  }, [createElementRef]);

  const focusModal = useCallback((refId: string) => {
    const ref = getRef(refId);
    if (ref?.current) {
      // Focus management for accessibility
      if (ref.current.focus) {
        ref.current.focus();
      }
    }
  }, [getRef]);

  const closeModal = useCallback((refId: string) => {
    if (isRefValid(refId)) {
      nullRef(refId);
    }
  }, [isRefValid, nullRef]);

  return {
    createModalRef,
    createBackdropRef,
    createOverlayRef,
    focusModal,
    closeModal,
  };
};

// Development-only hook for ref leak detection
export const useRefLeakDetection = () => {
  const { getRefsStatus, findPotentialLeaks } = useRefs();

  useEffect(() => {
    if (__DEV__) {
      const checkInterval = setInterval(() => {
        const status = getRefsStatus();
        const leaks = findPotentialLeaks();
        
        if (status.total > 50) { // Threshold for concern
          logWarn(`🚨 High ref count detected: ${status.total} active refs`, "Warning");
          logDebug('Ref breakdown:', "Debug", status.byType);
        }

        if (status.staleRefs > 10) {
          logWarn(`⏰ Stale refs detected: ${status.staleRefs} refs not accessed recently`, "Warning");
        }

        if (leaks.length > 0) {
          logWarn(`💧 Potential ref leaks detected: ${leaks.length} issues`, "Warning");
          leaks.forEach(leak => {
            logWarn(`  • ${leak.id}: ${leak.issue} (${leak.severity}, "Warning")`);
          });
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkInterval);
    }
  }, [getRefsStatus, findPotentialLeaks]);
};
