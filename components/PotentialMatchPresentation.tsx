import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { ChevronLeft, ChevronRight, SkipForward, ArrowLeft } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import MatchCard, { MatchProfile } from './MatchCard';
import { withMatchPresentationErrorBoundary } from '../src/components/MatchingErrorBoundaries';
import { useMatchingErrorRecovery } from '../src/hooks/useErrorRecovery';
import { logError as reportMatchingError } from '../src/services/error-monitoring-service';
import { useAccessibilityTimers, useAnimationTimers } from '../src/hooks/useTimers';
import {
  createNavigationAnnouncement,
  createAccessibleButtonProps,
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  announceToScreenReader,
  ModalAccessibility,
  createHeadingProps,
  FocusManager,
} from '../src/utils/accessibility';
import { useInviteStatus } from '../src/hooks/useInviteStatus';
import PaywallModal, { PaywallTrigger } from './PaywallModal';

interface PotentialMatch {
  id: string;
  target_user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  age?: number;
  interests?: string[];
  traits?: string[];
  source_match_request_id?: string;
  compatibility_score?: number;
}

interface PotentialMatchPresentationProps {
  matches: PotentialMatch[];
  onAcceptMatch: (matchId: string, sourceRequestId: string) => Promise<void>;
  onDeclineMatch: (matchId: string) => void;
  onViewCompatibility: (matchId: string) => void;
  onClose: () => void;
  title?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const PotentialMatchPresentationBase: React.FC<PotentialMatchPresentationProps> = ({
  matches,
  onAcceptMatch,
  onDeclineMatch,
  onViewCompatibility,
  onClose,
  title = "Potential Matches",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const errorRecovery = useMatchingErrorRecovery();
  const { announceAfterDelay, scheduleDelayedFocus } = useAccessibilityTimers();
  const { scheduleAnimationFrame } = useAnimationTimers();

  // Invite status management
  const { canSendInvite, refreshInviteStatus, inviteStatus } = useInviteStatus();
  const [paywallVisible, setPaywallVisible] = useState(false);
  
  // Animation values
  const slideValue = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  
  // Accessibility refs
  const containerRef = useRef<View>(null);
  const backButtonRef = useRef<any>(null);
  
  // Announce screen opening and focus management
  useEffect(() => {
    const screenDescription = `${title} screen opened. ${matches.length} potential ${matches.length === 1 ? 'match' : 'matches'} available.`;
    
    announceAfterDelay(() => {
      announceToScreenReader(screenDescription, 'assertive');
    }, 300);
    
    scheduleDelayedFocus(() => {
      // Set initial focus to back button for screen reader users
      if (backButtonRef.current) {
        FocusManager.setFocus(backButtonRef);
      }
    }, 300);
    
    return () => {
      // Announce screen closing
      announceToScreenReader('Potential matches screen closed', 'polite');
    };
  }, [title, matches.length, announceAfterDelay, scheduleDelayedFocus]);
  
  // Announce navigation changes
  useEffect(() => {
    if (matches.length > 0) {
      const announcement = createNavigationAnnouncement(currentIndex, matches.length, 'potential match');
      const currentMatch = matches[currentIndex];
      const matchInfo = currentMatch ? ` Current match: ${currentMatch.display_name || 'Anonymous user'}` : '';
      
      announceAfterDelay(() => {
        announceToScreenReader(`${announcement}.${matchInfo}`, 'polite');
      }, 300);
    }
  }, [currentIndex, matches.length, matches, announceAfterDelay]);

  const currentMatch = matches[currentIndex];
  const hasNext = currentIndex < matches.length - 1;
  const hasPrevious = currentIndex > 0;

  // Convert match data to MatchProfile format
  const convertToMatchProfile = useCallback((match: PotentialMatch): MatchProfile => {
    return {
      id: match.target_user_id || match.id,
      display_name: match.display_name,
      avatar_url: match.avatar_url,
      bio: match.bio,
      age: match.age,
      interests: match.interests,
      traits: match.traits,
    };
  }, []);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (!hasNext || isProcessing) return;
    
    slideValue.value = withTiming(-screenWidth, { duration: 300 }, () => {
      runOnJS(setCurrentIndex)(currentIndex + 1);
      slideValue.value = screenWidth;
      slideValue.value = withTiming(0, { duration: 300 });
    });
  }, [currentIndex, hasNext, isProcessing, slideValue]);

  const goToPrevious = useCallback(() => {
    if (!hasPrevious || isProcessing) return;
    
    slideValue.value = withTiming(screenWidth, { duration: 300 }, () => {
      runOnJS(setCurrentIndex)(currentIndex - 1);
      slideValue.value = -screenWidth;
      slideValue.value = withTiming(0, { duration: 300 });
    });
  }, [currentIndex, hasPrevious, isProcessing, slideValue]);

  // Match action handlers with error recovery
  const handleAccept = useCallback(async () => {
    if (!currentMatch || isProcessing) return;

    // CHECK INVITES BEFORE PROCEEDING
    if (!canSendInvite()) {
      setPaywallVisible(true);
      return; // Block the action
    }

    setIsProcessing(true);

    const result = await errorRecovery.executeWithRecovery(async () => {
      return await onAcceptMatch(
        currentMatch.target_user_id || currentMatch.id,
        currentMatch.source_match_request_id || ''
      );
    }, 'match_accept');

    if (result !== null) {
      // Refresh invite count after successful match
      await refreshInviteStatus();

      // Success - auto-advance to next match
      if (hasNext) {
        scheduleAnimationFrame(() => {
          goToNext();
          setIsProcessing(false);
        }, 'advance_match');
      } else {
        setIsProcessing(false);
        onClose();
      }
    } else if (errorRecovery.error) {
      // Report the error
      reportMatchingError(errorRecovery.error, {
        match_id: currentMatch.target_user_id || currentMatch.id,
        interaction_type: 'accept',
        component: 'PotentialMatchPresentation',
      });

      setIsProcessing(false);
      Alert.alert(
        "Error",
        errorRecovery.error.message || "Could not accept match.",
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: () => errorRecovery.retry() }
        ]
      );
    }
  }, [currentMatch, isProcessing, canSendInvite, onAcceptMatch, hasNext, goToNext, onClose, errorRecovery, scheduleAnimationFrame, refreshInviteStatus]);

  const handleDecline = useCallback(() => {
    if (!currentMatch || isProcessing) return;
    
    onDeclineMatch(currentMatch.target_user_id || currentMatch.id);
    
    // Auto-advance to next match after decline
    if (hasNext) {
      scheduleAnimationFrame(() => {
        goToNext();
      }, 'advance_match');
    } else {
      onClose();
    }
  }, [currentMatch, isProcessing, onDeclineMatch, hasNext, goToNext, onClose, scheduleAnimationFrame]);

  const handleViewCompatibility = useCallback(() => {
    if (!currentMatch) return;
    onViewCompatibility(currentMatch.target_user_id || currentMatch.id);
  }, [currentMatch, onViewCompatibility]);

  // Animation styles
  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: slideValue.value }],
      opacity: cardOpacity.value,
    };
  });

  const progressAnimatedStyle = useAnimatedStyle(() => {
    const progress = matches.length > 0 ? (currentIndex + 1) / matches.length : 0;
    return {
      width: withTiming(`${progress * 100}%`, { duration: 300 }),
    };
  });

  if (!currentMatch) {
    return (
      <View 
        style={styles.container}
        accessibilityLabel="No matches screen"
      >
        <View style={styles.emptyContainer}>
          <Text 
            style={styles.emptyText}
            {...createHeadingProps(1, 'No potential matches available')}
          >
            No potential matches available
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            style={[styles.closeButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
            {...createAccessibleButtonProps(
              'Close matches screen',
              'Return to previous screen',
              ACCESSIBILITY_ROLES.ACTION_BUTTON
            )}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View 
      ref={containerRef}
      style={styles.container}
      {...ModalAccessibility.getModalProps(title, `Browsing potential matches, ${matches.length} total`)}
    >
      {/* Header with Onboarding Style */}
      <View 
        style={styles.header}
        accessibilityLabel="Header with navigation controls"
      >
        <TouchableOpacity
          ref={backButtonRef}
          style={[styles.backButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
          onPress={() => {
            announceToScreenReader('Closing potential matches screen', 'assertive');
            onClose();
          }}
          {...createAccessibleButtonProps(
            'Go back',
            'Close potential matches and return to previous screen',
            ACCESSIBILITY_ROLES.NAVIGATION_BUTTON
          )}
        >
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Title Container */}
      <View 
        style={styles.titleContainer}
        accessibilityRole="text"
      >
        <Text 
          style={styles.title}
          {...createHeadingProps(1, title)}
        >
          {title}
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityRole="text"
          accessibilityLabel={createNavigationAnnouncement(currentIndex, matches.length, 'match')}
          accessibilityLiveRegion="polite"
        >
          {currentIndex + 1} of {matches.length}
        </Text>
      </View>

      {/* Match Card */}
      <View 
        style={styles.cardContainer}
        accessibilityLabel="Match card container"
      >
        <Animated.View 
          style={[styles.cardWrapper, cardAnimatedStyle]}
          accessibilityLabel={`Match card for ${currentMatch.display_name || 'anonymous user'}`}
        >
          <MatchCard
            profile={convertToMatchProfile(currentMatch)}
            compatibilityScore={currentMatch.compatibility_score}
            onAccept={handleAccept}
            onPass={handleDecline}
            onViewCompatibility={handleViewCompatibility}
            onNext={goToNext}
            onPrevious={goToPrevious}
            hasNext={hasNext && !isProcessing}
            hasPrevious={hasPrevious && !isProcessing}
            style={styles.matchCard}
            currentMatchIndex={currentIndex}
            totalMatches={matches.length}
          />
        </Animated.View>
      </View>

      {/* Paywall Modal for Exhausted Invites */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="exhausted_invites"
        remainingInvites={inviteStatus?.remaining || 0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Navy background like onboarding
    paddingHorizontal: 16,
    paddingTop: 20, // DRASTICALLY reduced from 48
    paddingBottom: 90,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Reduced from 16
  },
  backButton: {
    width: Math.max(40, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    height: Math.max(40, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    borderRadius: Math.max(20, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET / 2),
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    // Enhanced focus indicator
    elevation: 3,
  },
  titleContainer: {
    marginBottom: 0, // ELIMINATE ALL MARGIN
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Geist-Regular',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
  },
  closeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 0, // Remove all top padding
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 400,
    marginTop: -20, // Move margin adjustment here for better layout control
  },
  matchCard: {
    alignSelf: 'center',
  },
});

// Export the component wrapped with error boundary
const PotentialMatchPresentation = withMatchPresentationErrorBoundary(PotentialMatchPresentationBase);

export default PotentialMatchPresentation;
