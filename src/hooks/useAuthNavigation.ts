// @ts-nocheck
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { logger, logNavigation } from '../utils/logger';
import { User } from '@supabase/supabase-js';

interface Profile {
  onboarding_completed: boolean;
}

interface UseAuthNavigationProps {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

export const useAuthNavigation = ({ user, profile, loading }: UseAuthNavigationProps) => {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) {
      logNavigation('Auth still loading, skipping navigation logic');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inAuthPages = segments[0] === 'login' || segments[0] === 'signup' || segments[0] === 'password-reset' || segments[0] === 'update-password' || segments[0] === 'welcome';

    logNavigation('Auth navigation check', {
      hasUser: !!user,
      hasProfile: !!profile,
      onboardingCompleted: profile?.onboarding_completed,
      currentSegment: segments[0],
      inAuthGroup,
      inAuthPages
    });

    if (!user) {
      handleUnauthenticatedUser(inAuthGroup, inAuthPages);
    } else if (!profile?.onboarding_completed) {
      handleIncompleteOnboarding();
    } else if (profile?.onboarding_completed) {
      handleCompletedOnboarding();
    } else {
      logger.warn('Unexpected auth state', undefined, {
        hasUser: !!user,
        hasProfile: !!profile,
        onboardingCompleted: profile?.onboarding_completed
      }, 'NAVIGATION');
    }

    function handleUnauthenticatedUser(inAuthGroup: boolean, inAuthPages: boolean) {
      logNavigation('No user found');
      const inPhoneAuth = segments[0] === 'phone-auth' || segments[0] === 'phone-otp';

      if (!inAuthGroup && !inAuthPages && !inPhoneAuth) {
        logNavigation('Redirecting to welcome screen - user not authenticated');
        router.replace('/welcome');
      }
    }

    function handleIncompleteOnboarding() {
      const inOnboardingFlow = segments[0] === 'onboarding' || 
                              segments[0] === 'questionnaire' || 
                              segments[0] === 'date-night-preferences' || 
                              segments[0] === 'onboarding-complete';
      
      logNavigation('User has incomplete onboarding', { 
        inOnboardingFlow, 
        currentSegment: segments[0] 
      });
      
      if (!inOnboardingFlow) {
        logNavigation('Redirecting to onboarding');
        router.replace('/onboarding');
      }
    }

    function handleCompletedOnboarding() {
      const authLandingSegments = new Set([
        'index',
        'welcome',
        'login',
        'signup',
        'password-reset',
        'update-password',
        'onboarding-complete',
      ]);

      const shouldRedirectToDashboard =
        segments.length === 0 || authLandingSegments.has(segments[0]);
      
      logNavigation('User has completed onboarding', {
        shouldRedirectToDashboard,
        currentSegment: segments[0],
        segmentsLength: segments.length
      });
      
      if (shouldRedirectToDashboard) {
        logNavigation('Redirecting to dashboard');
        router.replace('/(tabs)/dashboard');
      }
    }
  }, [user, profile, loading, segments, router]);
};
// @ts-nocheck
