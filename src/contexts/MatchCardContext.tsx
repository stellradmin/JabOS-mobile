import React, { createContext, useContext, useMemo, useState } from 'react';

// Types used by match card components
export interface MatchProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  age?: number;
  interests?: string[];
  traits?: string[];
}

export interface MatchCardActions {
  onAccept: () => void;
  onPass: () => void;
  onViewCompatibility?: () => void;
}

// Provider props
interface MatchCardProviderProps {
  actions: MatchCardActions;
  initialProfile: MatchProfile;
  initialCompatibility?: {
    score?: number;
    astrologicalGrade?: string;
    questionnaireGrade?: string;
  };
  initialContext?: {
    dateActivity?: string;
    zodiacSign?: string;
  };
  initialNavigation?: {
    currentMatchIndex?: number;
    totalMatches?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
    onNext?: () => void;
    onPrevious?: () => void;
  };
  children: React.ReactNode;
}

// Context shapes
interface ProfileCtx {
  profile: MatchProfile;
  displayName: string;
}

interface CompatibilityCtx {
  compatibilityScore?: number;
  astrologicalGrade?: string;
  questionnaireGrade?: string;
}

interface NavigationCtx {
  hasNext: boolean;
  hasPrevious: boolean;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
  currentMatchIndex: number;
  totalMatches: number;
  onNext?: () => void;
  onPrevious?: () => void;
}

interface AnimationCtx {
  isAnimating: boolean;
  setAnimationState: (state: Partial<{ isAnimating: boolean; isFlipped: boolean }>) => void;
  onFlip?: () => void;
}

interface ActionsCtx {
  onAccept: () => void;
  onPass: () => void;
  recordInteraction: (type: 'tap' | 'swipe' | 'flip') => void;
}

interface ExtraCtx {
  dateActivity?: string;
  zodiacSign?: string;
}

const ProfileContext = createContext<ProfileCtx | undefined>(undefined);
const CompatibilityContext = createContext<CompatibilityCtx | undefined>(undefined);
const NavigationContext = createContext<NavigationCtx | undefined>(undefined);
const AnimationContext = createContext<AnimationCtx | undefined>(undefined);
const ActionsContext = createContext<ActionsCtx | undefined>(undefined);
const ExtraContext = createContext<ExtraCtx | undefined>(undefined);

export const MatchCardProvider: React.FC<MatchCardProviderProps> = ({
  actions,
  initialProfile,
  initialCompatibility,
  initialContext,
  initialNavigation,
  children,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const profileValue = useMemo<ProfileCtx>(() => ({
    profile: initialProfile,
    displayName: initialProfile.display_name || 'Anonymous User',
  }), [initialProfile]);

  const compatibilityValue = useMemo<CompatibilityCtx>(() => ({
    compatibilityScore: initialCompatibility?.score,
    astrologicalGrade: initialCompatibility?.astrologicalGrade,
    questionnaireGrade: initialCompatibility?.questionnaireGrade,
  }), [initialCompatibility]);

  const navigationValue = useMemo<NavigationCtx>(() => ({
    hasNext: !!initialNavigation?.hasNext,
    hasPrevious: !!initialNavigation?.hasPrevious,
    canNavigateNext: !!initialNavigation?.hasNext,
    canNavigatePrevious: !!initialNavigation?.hasPrevious,
    currentMatchIndex: initialNavigation?.currentMatchIndex ?? 0,
    totalMatches: initialNavigation?.totalMatches ?? 1,
    onNext: initialNavigation?.onNext,
    onPrevious: initialNavigation?.onPrevious,
  }), [initialNavigation]);

  const animationValue = useMemo<AnimationCtx>(() => ({
    isAnimating,
    setAnimationState: (state) => {
      if (state.isAnimating !== undefined) setIsAnimating(state.isAnimating);
      if (state.isFlipped !== undefined) setIsFlipped(state.isFlipped);
    },
    onFlip: undefined,
  }), [isAnimating]);

  const actionsValue = useMemo<ActionsCtx>(() => ({
    onAccept: actions.onAccept,
    onPass: actions.onPass,
    recordInteraction: () => {},
  }), [actions]);

  const extraValue = useMemo<ExtraCtx>(() => ({
    dateActivity: initialContext?.dateActivity,
    zodiacSign: initialContext?.zodiacSign,
  }), [initialContext]);

  return (
    <ProfileContext.Provider value={profileValue}>
      <CompatibilityContext.Provider value={compatibilityValue}>
        <NavigationContext.Provider value={navigationValue}>
          <AnimationContext.Provider value={animationValue}>
            <ActionsContext.Provider value={actionsValue}>
              <ExtraContext.Provider value={extraValue}>
                {children}
              </ExtraContext.Provider>
            </ActionsContext.Provider>
          </AnimationContext.Provider>
        </NavigationContext.Provider>
      </CompatibilityContext.Provider>
    </ProfileContext.Provider>
  );
};

function useReq<T>(ctx: T | undefined, name: string): T {
  if (!ctx) throw new Error(`${name} must be used within MatchCardProvider`);
  return ctx;
}

export const useMatchCardProfile = () => useReq(useContext(ProfileContext), 'useMatchCardProfile');
export const useMatchCardCompatibility = () => useReq(useContext(CompatibilityContext), 'useMatchCardCompatibility');
export const useMatchCardNavigation = () => useReq(useContext(NavigationContext), 'useMatchCardNavigation');
export const useMatchCardAnimation = () => useReq(useContext(AnimationContext), 'useMatchCardAnimation');
export const useMatchCardActions = () => useReq(useContext(ActionsContext), 'useMatchCardActions');
export const useMatchCardContext = () => useReq(useContext(ExtraContext), 'useMatchCardContext');

// Backwards compat alias used in some components
export const useMatchCard = () => ({
  ...useMatchCardProfile(),
  ...useMatchCardCompatibility(),
  ...useMatchCardNavigation(),
  ...useMatchCardAnimation(),
  ...useMatchCardActions(),
  ...useMatchCardContext(),
});

