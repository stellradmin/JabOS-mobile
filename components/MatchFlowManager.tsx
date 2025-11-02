import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import PotentialMatchPresentation from './PotentialMatchPresentation';
import MatchReceptionContent from './MatchReceptionContent';
import { usePotentialMatch } from '../src/contexts/PotentialMatchContext';
import CompatibilityMatchingService from '../src/services/compatibility-matching-service';
import { withMatchFlowErrorBoundary } from '../src/components/MatchingErrorBoundaries';
import { useMatchingErrorRecovery } from '../src/hooks/useErrorRecovery';
import { logError as reportMatchingError } from '../src/services/error-monitoring-service';
import {
  ModalAccessibility,
  announceToScreenReader,
  FocusManager,
} from '../src/utils/accessibility';

// Import our new memory management hooks
import { useRefs, useModalRefs } from '../src/hooks/useRefs';
import { useModalFocus } from '../src/hooks/useFocusManagement';
import { useTimers } from '../src/hooks/useTimers';
import { useAsyncOperations } from '../src/hooks/useAsyncOperations';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import { useInviteStatus } from '../src/hooks/useInviteStatus';
import PaywallModal, { PaywallTrigger } from './PaywallModal';

// Define the different match modes
type MatchFlowMode = 'browse' | 'popup' | 'none';

interface MatchFlowManagerProps {
  // For browsing potential matches (date night flow)
  potentialMatches?: Array<{
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
  }>;
  
  // For receiving individual match popups
  incomingCompatibilityMatch?: {
    id: string;
    compatibility_score: number;
    other_user: {
      id: string;
      name: string;
      avatar_url?: string;
      age: number;
      interests: string[];
      traits: string[];
    };
  };

  // Control which flow is active
  mode: MatchFlowMode;
  onModeChange: (mode: MatchFlowMode) => void;
  
  // Callbacks
  onAcceptPotentialMatch?: (targetUserId: string, sourceRequestId: string) => Promise<void>;
  onAcceptCompatibilityMatch?: (matchId: string) => Promise<void>;
  onDeclineMatch?: (matchId: string) => void;
  onViewCompatibility?: (userId: string) => void;
  onClose?: () => void;
}

const MatchFlowManagerBase: React.FC<MatchFlowManagerProps> = ({
  potentialMatches = [],
  incomingCompatibilityMatch,
  mode,
  onModeChange,
  onAcceptPotentialMatch,
  onAcceptCompatibilityMatch,
  onDeclineMatch,
  onViewCompatibility,
  onClose,
}) => {
  // Use the context for automatic potential match handling
  const {
    currentPotentialMatch,
    acceptCurrentPotentialMatch,
    declineCurrentPotentialMatch,
    isLoading: contextLoading,
  } = usePotentialMatch();

  const errorRecovery = useMatchingErrorRecovery();

  // Invite status management
  const { canSendInvite, refreshInviteStatus, inviteStatus } = useInviteStatus();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger>('exhausted_invites');
  
  // Memory-safe ref management
  const { createModalRef, createBackdropRef, focusModal, closeModal } = useModalRefs();
  const { createModalFocusGroup } = useModalFocus();
  const { createTimeout, clearTimer } = useTimers();
  const { createCancellablePromise } = useAsyncOperations();
  
  // Create managed refs
  const [browseModalRef, browseModalId] = createModalRef('browse-modal');
  const [popupModalRef, popupModalId] = createModalRef('popup-modal');
  const [browseBackdropRef, browseBackdropId] = createBackdropRef('browse-backdrop');
  const [popupBackdropRef, popupBackdropId] = createBackdropRef('popup-backdrop');
  
  // Focus management for modals
  const browseFocusGroup = createModalFocusGroup('Browse Matches');
  const popupFocusGroup = createModalFocusGroup('Match Notification');
  
  // Track previous mode for accessibility announcements
  const [previousMode, setPreviousMode] = useState<MatchFlowMode>('none');

  // Handle automatic potential match popup from context
  useEffect(() => {
    if (currentPotentialMatch && mode === 'none') {
      // Automatically switch to popup mode when context provides a match
      onModeChange('popup');
    }
  }, [currentPotentialMatch, mode, onModeChange]);
  
  // Handle accessibility announcements for mode changes with memory-safe timers
  useEffect(() => {
    if (mode !== previousMode) {
      let announcement = '';
      
      switch (mode) {
        case 'browse':
          announcement = `Match browsing mode opened. ${potentialMatches.length} potential ${potentialMatches.length === 1 ? 'match' : 'matches'} available.`;
          // Setup focus for browse modal
          if (browseModalRef.current) {
            browseFocusGroup.focusModal();
          }
          break;
        case 'popup':
          const matchName = currentPotentialMatch?.display_name || incomingCompatibilityMatch?.other_user.name || 'unknown user';
          announcement = `Match notification popup opened for ${matchName}.`;
          // Setup focus for popup modal
          if (popupModalRef.current) {
            popupFocusGroup.focusModal();
          }
          break;
        case 'none':
          if (previousMode !== 'none') {
            announcement = 'Match interface closed.';
            // Close focus groups
            browseFocusGroup.closeModal();
            popupFocusGroup.closeModal();
          }
          break;
      }
      
      if (announcement) {
        createTimeout(() => {
          announceToScreenReader(announcement, 'assertive');
        }, 300, `mode_announcement_${mode}`);
      }
      
      setPreviousMode(mode);
    }
  }, [mode, previousMode, potentialMatches.length, currentPotentialMatch, incomingCompatibilityMatch, 
      browseModalRef, popupModalRef, browseFocusGroup, popupFocusGroup, createTimeout]);

  // Handlers for potential match browsing with error recovery and memory-safe async operations
  const handleAcceptPotentialMatch = async (targetUserId: string, sourceRequestId: string) => {
    // CHECK INVITES BEFORE PROCEEDING
    if (!canSendInvite()) {
      logUserAction('Paywall triggered: No invites remaining', 'Monetization', {
        trigger: 'exhausted_invites',
        remaining: inviteStatus?.remaining || 0
      });
      setPaywallTrigger('exhausted_invites');
      setPaywallVisible(true);
      return; // Block the action
    }

    try {
      const result = await createCancellablePromise(async (signal) => {
        return await errorRecovery.executeWithRecovery(async () => {
          if (signal.aborted) throw new Error('Operation cancelled');

          if (onAcceptPotentialMatch) {
            return await onAcceptPotentialMatch(targetUserId, sourceRequestId);
          } else {
            // Use the service directly (targetUserId, matchRequestId)
            return await CompatibilityMatchingService.confirmMatch(
              targetUserId,
              sourceRequestId
            );
          }
        }, 'accept_potential_match');
      }, {
        timeout: 30000, // 30 second timeout
        description: `accept-match-${targetUserId}`,
      });

      if (result !== null) {
        // Refresh invite count after successful match
        await refreshInviteStatus();
        Alert.alert("Success", "Match request sent!");
      }
    } catch (error: any) {
      if (error.message === 'Operation cancelled' || error.message?.includes('aborted')) {
        logDebug('Match accept operation was cancelled', "Debug");
        return;
      }

      reportMatchingError(error, {
        match_id: targetUserId,
        interaction_type: 'accept',
        component: 'MatchFlowManager',
      });

      Alert.alert(
        "Error",
        error.message || "Could not accept match",
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: () => handleAcceptPotentialMatch(targetUserId, sourceRequestId) }
        ]
      );
    }
  };

  const handleDeclinePotentialMatch = (targetUserId: string) => {
    if (onDeclineMatch) {
      onDeclineMatch(targetUserId);
    }
    logDebug('Declined potential match:', "Debug", targetUserId);
  };

  // Handlers for compatibility match popup with error recovery
  const handleAcceptCompatibilityMatch = async (matchId: string) => {
    try {
      const result = await createCancellablePromise(async (signal) => {
        return await errorRecovery.executeWithRecovery(async () => {
          if (signal.aborted) throw new Error('Operation cancelled');
          
          if (onAcceptCompatibilityMatch) {
            return await onAcceptCompatibilityMatch(matchId);
          } else {
            // Use the service directly
            return await CompatibilityMatchingService.respondToMatch(matchId, 'interested');
          }
        }, 'accept_compatibility_match');
      }, {
        timeout: 30000, // 30 second timeout
        description: `accept-compatibility-match-${matchId}`,
      });
      
      if (result !== null) {
        if (result && typeof result === 'object' && 'mutual_match' in result && result.mutual_match) {
          Alert.alert("It's a Match!", "You can now start chatting!");
        } else {
          Alert.alert("Response Sent", "Your interest has been recorded.");
        }
        onModeChange('none');
      }
    } catch (error: any) {
      if (error.message === 'Operation cancelled' || error.message?.includes('aborted')) {
        logDebug('Compatibility match accept operation was cancelled', "Debug");
        return;
      }
      
      reportMatchingError(error, {
        match_id: matchId,
        interaction_type: 'accept',
        component: 'MatchFlowManager',
      });
      
      Alert.alert(
        "Error", 
        error.message || "Could not accept compatibility match",
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: () => handleAcceptCompatibilityMatch(matchId) }
        ]
      );
    }
  };

  const handleDeclineCompatibilityMatch = async () => {
    if (incomingCompatibilityMatch) {
      try {
        await CompatibilityMatchingService.respondToMatch(incomingCompatibilityMatch.id, 'not_interested');
        onModeChange('none');
      } catch (error: any) {
        logError('Error declining compatibility match:', "Error", error);
      }
    }
  };

  // Handle potential match popup from context
  const handleContextAccept = async () => {
    try {
      const result = await createCancellablePromise(async (signal) => {
        if (signal.aborted) throw new Error('Operation cancelled');
        return await acceptCurrentPotentialMatch();
      }, {
        timeout: 30000, // 30 second timeout
        description: 'context-accept-match',
      });
      
      if (result !== null) {
        onModeChange('none');
      }
    } catch (error: any) {
      if (error.message === 'Operation cancelled' || error.message?.includes('aborted')) {
        logDebug('Context match accept operation was cancelled', "Debug");
        return;
      }
      
      Alert.alert("Error", error.message || "Could not accept match");
    }
  };

  const handleContextDecline = () => {
    declineCurrentPotentialMatch();
    onModeChange('none');
  };

  const handleViewCompatibility = (userId: string) => {
    if (onViewCompatibility) {
      onViewCompatibility(userId);
    } else {
      logDebug('View compatibility for user:', "Debug", userId);
      // Navigate to compatibility screen or show modal
    }
  };

  const handleClose = () => {
    // Announce modal closing
    if (mode === 'browse') {
      ModalAccessibility.announceModalClose();
    }
    
    if (onClose) {
      onClose();
    }
    onModeChange('none');
  };

  return (
    <>
      {/* Browse Potential Matches Flow - Full Screen */}
      <Modal
        visible={mode === 'browse'}
        animationType="slide"
        presentationStyle="fullScreen"
        accessibilityViewIsModal={true}
        onShow={() => {
          ModalAccessibility.announceModalOpen('Potential Matches Browser');
          // Set focus to modal content after animation
          createTimeout(() => {
            if (browseModalRef.current) {
              FocusManager.setFocus(browseModalRef);
            }
          }, 500, 'browse_modal_focus');
        }}
        onRequestClose={handleClose}
      >
        <View 
          ref={browseModalRef}
          style={styles.fullScreenModalContainer}
          {...ModalAccessibility.getModalProps(
            'Potential Matches Browser',
            `Browse ${potentialMatches.length} potential matches for date night`
          )}
        >
          <PotentialMatchPresentation
            matches={potentialMatches}
            onAcceptMatch={handleAcceptPotentialMatch}
            onDeclineMatch={handleDeclinePotentialMatch}
            onViewCompatibility={handleViewCompatibility}
            onClose={handleClose}
            title="Your Date Night Matches"
          />
        </View>
      </Modal>

      {/* Individual Match Reception Popup - Modal */}
      <Modal
        visible={mode === 'popup'}
        animationType="slide"
        presentationStyle="pageSheet"
        accessibilityViewIsModal={true}
        onShow={() => {
          const matchName = currentPotentialMatch?.display_name || incomingCompatibilityMatch?.other_user.name || 'unknown user';
          ModalAccessibility.announceModalOpen(`Match notification for ${matchName}`);
          
          // Set focus to popup content after animation
          createTimeout(() => {
            if (popupModalRef.current) {
              FocusManager.setFocus(popupModalRef);
            }
          }, 500, 'popup_modal_focus');
        }}
        onRequestClose={handleClose}
      >
        <View 
          ref={popupModalRef}
          style={styles.modalContainer}
          {...ModalAccessibility.getModalProps(
            'Match Notification',
            'New match notification popup'
          )}
        >
          {/* Handle automatic context-based potential match */}
          {currentPotentialMatch && (
            <MatchReceptionContent
              mode="potential"
              potentialMatchProfile={currentPotentialMatch}
              sourceMatchRequestId={currentPotentialMatch.id}
              onAcceptPotentialMatch={async (targetUserId, sourceRequestId) => {
                await handleContextAccept();
              }}
              onDecline={handleContextDecline}
              onViewCompatibility={() => handleViewCompatibility(currentPotentialMatch.id)}
            />
          )}

          {/* Handle incoming compatibility match */}
          {incomingCompatibilityMatch && !currentPotentialMatch && (
            <MatchReceptionContent
              mode="compatibility"
              compatibilityMatch={incomingCompatibilityMatch}
              onAcceptCompatibilityMatch={handleAcceptCompatibilityMatch}
              onDecline={handleDeclineCompatibilityMatch}
              onViewCompatibility={() => handleViewCompatibility(incomingCompatibilityMatch.other_user.id)}
            />
          )}
        </View>
      </Modal>

      {/* Paywall Modal for Exhausted Invites */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger={paywallTrigger}
        remainingInvites={inviteStatus?.remaining || 0}
      />
    </>
  );
};

const styles = StyleSheet.create({
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#0F172A', // Match the PotentialMatchPresentation background
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});

// Export the component wrapped with error boundary
const MatchFlowManager = withMatchFlowErrorBoundary(MatchFlowManagerBase);

export default MatchFlowManager;
