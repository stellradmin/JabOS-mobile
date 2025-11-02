import { AccessibilityInfo, Platform } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
}

interface AccessibilityConfig {
  announceNewMessages: boolean;
  announceScrollPosition: boolean;
  announceLoadingStates: boolean;
  announcePaginationUpdates: boolean;
  reducedMotion: boolean;
  highContrastMode: boolean;
  enableHapticFeedback: boolean;
  customVoiceSpeed: number;
}

interface AccessibilityState {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isHighContrastEnabled: boolean;
  currentFocus: string | null;
  lastAnnouncement: string | null;
  voiceOverRate: number;
}

class MessageAccessibilityManager {
  private config: AccessibilityConfig;
  private state: AccessibilityState;
  private listeners: (() => void)[] = [];

  constructor(config: Partial<AccessibilityConfig> = {}) {
    this.config = {
      announceNewMessages: true,
      announceScrollPosition: true,
      announceLoadingStates: true,
      announcePaginationUpdates: true,
      reducedMotion: false,
      highContrastMode: false,
      enableHapticFeedback: true,
      customVoiceSpeed: 1.0,
      ...config,
    };

    this.state = {
      isScreenReaderEnabled: false,
      isReduceMotionEnabled: false,
      isHighContrastEnabled: false,
      currentFocus: null,
      lastAnnouncement: null,
      voiceOverRate: 1.0,
    };

    this.initializeAccessibility();
  }

  // Initialize accessibility services
  private async initializeAccessibility(): Promise<void> {
    try {
      // Check screen reader status
      this.state.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      // Check reduce motion preference
      if (Platform.OS === 'ios') {
        this.state.isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      }

      // Set up listeners for accessibility changes
      this.setupAccessibilityListeners();

      if (__DEV__) {
        logDebug('Accessibility initialized:', "Debug", this.state);
      }
    } catch (error) {
      logError('Failed to initialize accessibility:', "Error", error);
    }
  }

  // Set up listeners for accessibility state changes
  private setupAccessibilityListeners(): void {
    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (isEnabled: boolean) => {
        this.state.isScreenReaderEnabled = isEnabled;
        this.notifyListeners();
      }
    );

    if (Platform.OS === 'ios') {
      const reduceMotionListener = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (isEnabled: boolean) => {
          this.state.isReduceMotionEnabled = isEnabled;
          this.config.reducedMotion = isEnabled;
          this.notifyListeners();
        }
      );
      
      this.listeners.push(() => reduceMotionListener.remove());
    }

    this.listeners.push(() => screenReaderListener.remove());
  }

  // Generate accessibility label for message
  generateMessageAccessibilityLabel(
    message: Message, 
    isFromCurrentUser: boolean, 
    userName: string,
    index: number,
    totalMessages: number
  ): string {
    const sender = isFromCurrentUser ? 'You' : userName;
    const timestamp = this.formatTimestampForAccessibility(message.created_at);
    const position = `Message ${index + 1} of ${totalMessages}`;
    const mediaInfo = message.media_url ? ', contains media attachment' : '';
    
    return `${position}. ${sender} sent: ${message.content}${mediaInfo}. ${timestamp}`;
  }

  // Generate accessibility hint for message actions
  generateMessageAccessibilityHint(
    message: Message,
    hasActions: boolean = false
  ): string {
    let hint = 'Double tap to view details';
    
    if (hasActions) {
      hint += ', swipe up for more actions';
    }
    
    if (message.media_url) {
      hint += ', contains media that can be opened';
    }
    
    return hint;
  }

  // Format timestamp for screen readers
  private formatTimestampForAccessibility(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) {
      return 'Sent just now';
    } else if (diffMinutes < 60) {
      return `Sent ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `Sent ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Sent yesterday';
    } else if (diffDays < 7) {
      return `Sent ${diffDays} days ago`;
    } else {
      return `Sent on ${date.toLocaleDateString()}`;
    }
  }

  // Announce new message arrival
  announceNewMessage(message: Message, userName: string, isFromCurrentUser: boolean): void {
    if (!this.config.announceNewMessages || !this.state.isScreenReaderEnabled) {
      return;
    }

    const sender = isFromCurrentUser ? 'You' : userName;
    const announcement = `New message from ${sender}: ${message.content}`;
    
    this.announceToScreenReader(announcement);
  }

  // Announce loading states
  announceLoadingState(state: 'loading' | 'loaded' | 'error', context: string): void {
    if (!this.config.announceLoadingStates || !this.state.isScreenReaderEnabled) {
      return;
    }

    let announcement = '';
    switch (state) {
      case 'loading':
        announcement = `Loading ${context}`;
        break;
      case 'loaded':
        announcement = `${context} loaded`;
        break;
      case 'error':
        announcement = `Failed to load ${context}`;
        break;
    }

    this.announceToScreenReader(announcement);
  }

  // Announce pagination updates
  announcePaginationUpdate(
    loadedCount: number,
    totalCount: number,
    direction: 'older' | 'newer'
  ): void {
    if (!this.config.announcePaginationUpdates || !this.state.isScreenReaderEnabled) {
      return;
    }

    const announcement = `Loaded ${loadedCount} ${direction} messages. ${totalCount} total messages available.`;
    this.announceToScreenReader(announcement);
  }

  // Announce scroll position
  announceScrollPosition(
    currentIndex: number,
    totalMessages: number,
    conversationName: string
  ): void {
    if (!this.config.announceScrollPosition || !this.state.isScreenReaderEnabled) {
      return;
    }

    // Throttle announcements to avoid spam
    const announcement = `Message ${currentIndex + 1} of ${totalMessages} in conversation with ${conversationName}`;
    this.announceToScreenReader(announcement, true);
  }

  // Generate accessibility props for input field
  getInputAccessibilityProps(
    characterCount: number = 0,
    maxLength: number = 1000,
    hasText: boolean = false
  ) {
    return {
      accessible: true,
      accessibilityRole: 'textbox' as const,
      accessibilityLabel: 'Message input',
      accessibilityHint: hasText 
        ? `${characterCount} of ${maxLength} characters. Double tap to edit, swipe right to send`
        : 'Type your message here',
      accessibilityValue: {
        text: hasText ? `${characterCount} characters` : 'Empty',
      },
      accessibilityState: {
        disabled: false,
      },
    };
  }

  // Generate accessibility props for send button
  getSendButtonAccessibilityProps(canSend: boolean, isLoading: boolean) {
    return {
      accessible: true,
      accessibilityRole: 'button' as const,
      accessibilityLabel: 'Send message',
      accessibilityHint: canSend 
        ? 'Double tap to send your message'
        : 'Enter a message first',
      accessibilityState: {
        disabled: !canSend || isLoading,
        busy: isLoading,
      },
    };
  }

  // Generate accessibility props for pagination controls
  getPaginationControlProps(
    type: 'load-older' | 'load-newer' | 'refresh',
    isLoading: boolean,
    hasMore: boolean
  ) {
    const labels = {
      'load-older': 'Load older messages',
      'load-newer': 'Load newer messages',
      'refresh': 'Refresh messages',
    };

    const hints = {
      'load-older': hasMore 
        ? 'Double tap to load previous messages'
        : 'No more previous messages available',
      'load-newer': hasMore 
        ? 'Double tap to load newer messages'
        : 'You are viewing the latest messages',
      'refresh': 'Double tap to refresh the conversation',
    };

    return {
      accessible: true,
      accessibilityRole: 'button' as const,
      accessibilityLabel: labels[type],
      accessibilityHint: hints[type],
      accessibilityState: {
        disabled: !hasMore && type !== 'refresh',
        busy: isLoading,
      },
    };
  }

  // Generate accessibility props for message list
  getMessageListAccessibilityProps(
    messageCount: number,
    conversationName: string,
    isLoading: boolean
  ) {
    return {
      accessible: true,
      accessibilityRole: 'list' as const,
      accessibilityLabel: `Message list with ${conversationName}`,
      accessibilityHint: `${messageCount} messages. Swipe up or down to browse, double tap a message for details`,
      accessibilityState: {
        busy: isLoading,
      },
    };
  }

  // Generate accessibility props for calendar (date proposal)
  getCalendarAccessibilityProps(
    selectedDate: Date,
    selectedTime: string,
    monthName: string,
    year: number
  ) {
    return {
      modal: {
        accessible: true,
        accessibilityViewIsModal: true,
        accessibilityLabel: `Date proposal calendar for ${monthName} ${year}`,
        accessibilityHint: 'Select a date and time to propose a meetup',
      },
      dayButton: (day: number, isSelected: boolean, isDisabled: boolean) => ({
        accessible: true,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `Day ${day}`,
        accessibilityHint: isDisabled 
          ? 'Not selectable'
          : isSelected 
            ? 'Currently selected, double tap to confirm'
            : 'Double tap to select this date',
        accessibilityState: {
          selected: isSelected,
          disabled: isDisabled,
        },
      }),
      timeButton: (time: string, isSelected: boolean) => ({
        accessible: true,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `Time ${time}`,
        accessibilityHint: isSelected 
          ? 'Currently selected time'
          : 'Double tap to select this time',
        accessibilityState: {
          selected: isSelected,
        },
      }),
    };
  }

  // Private method to announce to screen reader
  private announceToScreenReader(message: string, throttle: boolean = false): void {
    if (!this.state.isScreenReaderEnabled) return;

    // Throttle announcements if requested
    if (throttle && this.state.lastAnnouncement === message) {
      return;
    }

    this.state.lastAnnouncement = message;

    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    } else {
      // Android screen readers
      AccessibilityInfo.announceForAccessibilityWithOptions(message, {
        queue: false,
      });
    }
  }

  // Add listener for state changes
  addListener(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of state changes
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logError('Error in accessibility listener:', "Error", error);
      }
    });
  }

  // Get current accessibility state
  getState(): AccessibilityState {
    return { ...this.state };
  }

  // Update configuration
  updateConfig(updates: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // Cleanup
  destroy(): void {
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
  }
}

// Singleton instance
export const messageAccessibilityManager = new MessageAccessibilityManager();

// Utility functions
export function createAccessibilityLabel(
  role: 'message' | 'button' | 'input' | 'list',
  content: string,
  additionalInfo?: string
): string {
  const prefix = role.charAt(0).toUpperCase() + role.slice(1);
  return additionalInfo 
    ? `${prefix}: ${content}. ${additionalInfo}`
    : `${prefix}: ${content}`;
}

export function shouldReduceAnimations(accessibilityState: AccessibilityState): boolean {
  return accessibilityState.isReduceMotionEnabled || accessibilityState.isScreenReaderEnabled;
}

export function getOptimalAnnouncementDelay(isScreenReaderEnabled: boolean): number {
  return isScreenReaderEnabled ? 500 : 0; // Slower for screen readers
}

export default MessageAccessibilityManager;
