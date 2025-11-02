import React, { useEffect, useState, useRef } from 'react'; // Added useState
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'; // Added ActivityIndicator
import { ArrowLeft, Heart, MessageSquare, X } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase'; // Assuming supabase client is here
import { withCompatibilityErrorBoundary } from '../src/components/MatchingErrorBoundaries';
import { useNetworkErrorRecovery } from '../src/hooks/useErrorRecovery';
// Alias service logger to keep existing call sites
import { logError as reportNetworkError } from '../src/services/error-monitoring-service';
import { useAccessibilityTimers } from '../src/hooks/useTimers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import {
  createCompatibilityAnnouncement,
  createAccessibleButtonProps,
  createHeadingProps,
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  announceToScreenReader,
  ProgressAccessibility,
  FocusManager,
  ensureAccessibleTouchTarget,
} from '../src/utils/accessibility';

interface CompatibilityDetails {
  astrologicalGrade?: string;
  astrologicalDesc?: string;
  questionnaireGrade?: string;
  questionnaireDesc?: string;
  overallScore?: string;
  overallDesc?: string;
}

interface CompatibilityScreenContentProps {
  matchUserId: string;
  userName?: string;
  onBack: () => void;
  onConnectInChat: () => void;
  onDecline: () => void; // Assuming decline is still an option here
}

interface CompatibilitySectionProps {
  title: string;
  description: string;
  grade?: string;
  gradeDesc?: string;
  score?: string;
  scoreDesc?: string;
}

const CompatibilitySection: React.FC<CompatibilitySectionProps> = ({ title, description, grade, gradeDesc, score, scoreDesc }) => {
  // Create accessibility announcement for compatibility section
  const compatibilityAnnouncement = createCompatibilityAnnouncement(
    grade,
    score ? parseInt(score) : undefined,
    gradeDesc || scoreDesc,
    title
  );

  return (
    // Added border-b-4 for bottom emphasis on the green block
    <View 
      className="bg-[#BAF2BB] p-4 rounded-xl border-2 border-black border-b-4 mb-4 w-full"
      accessibilityRole="text"
      accessibilityLabel={compatibilityAnnouncement}
      accessible={true}
    >
      <View className="flex-row justify-between items-start"> {/* Changed items-center to items-start for better alignment with multi-line text */}
        <View className="flex-1 mr-2"> {/* Added flex-1 and mr-2 to allow text to wrap and have space */}
          <Text 
            className="text-lg font-regular text-black"
            {...createHeadingProps(3, title)}
          >
            {title}
          </Text>
          <Text 
            className="text-xs text-gray-700"
            accessibilityRole="text"
            accessibilityLabel={`Description: ${description}`}
          >
            {description}
          </Text>
        </View>
        
        {/* Grade or Score Circle and its description below */}
        <View 
          className="items-center"
          accessibilityRole="text"
          accessibilityLabel={grade ? `Grade: ${grade}${gradeDesc ? `, ${gradeDesc}` : ''}` : score ? `Score: ${score}${scoreDesc ? `, ${scoreDesc}` : ''}` : 'No score available'}
        >
          {grade && (
            // Added border-b-4 for bottom emphasis on the circle
            <View 
              className="items-center justify-center w-14 h-14 rounded-full bg-pink-200 border-2 border-black border-b-4"
              accessibilityRole="text"
              accessibilityLabel={`Grade ${grade}`}
            >
              <Text className="text-xl font-regular text-pink-600">{grade}</Text>
            </View>
          )}
          {score && (
            // Reverted Animated.View to View, removed animation style
            <View 
              className="items-center justify-center w-14 h-14 rounded-full bg-gray-200 border-2 border-black border-b-4"
              accessibilityRole="text"
              accessibilityLabel={`Score ${score}`}
            >
              <Text className="text-lg font-regular text-black">{score}</Text>
            </View>
          )}
          {gradeDesc && (
            <Text 
              className="text-xs text-black mt-1"
              accessibilityRole="text"
              accessibilityLabel={gradeDesc}
            >
              {gradeDesc}
            </Text>
          )}
          {scoreDesc && (
            <Text 
              className="text-xs text-black mt-1"
              accessibilityRole="text"
              accessibilityLabel={scoreDesc}
            >
              {scoreDesc}
            </Text>
          )}
        </View>

      </View>
    </View>
  );
};

const CompatibilityScreenContentBase: React.FC<CompatibilityScreenContentProps> = ({
  matchUserId,
  userName = "Sarah",
  onBack,
  onConnectInChat,
  onDecline,
}) => {
  const [compatibilityData, setCompatibilityData] = useState<CompatibilityDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errorRecovery = useNetworkErrorRecovery();
  const { announceAfterDelay, scheduleDelayedFocus } = useAccessibilityTimers();
  
  // Accessibility refs
  const backButtonRef = useRef<any>(null);
  const connectButtonRef = useRef<any>(null);
  
  // Announce screen opening
  useEffect(() => {
    announceAfterDelay(() => {
      announceToScreenReader(
        `Compatibility screen opened for ${userName}. Loading compatibility details.`,
        'assertive'
      );
    }, 300);
    
    scheduleDelayedFocus(() => {
      // Set focus to back button for screen reader users
      if (backButtonRef.current) {
        FocusManager.setFocus(backButtonRef);
      }
    }, 300);
  }, [userName, announceAfterDelay, scheduleDelayedFocus]);

  useEffect(() => {
    if (matchUserId) {
      const fetchCompatibility = async () => {
        setIsLoading(true);
        setError(null);
        logDebug(`CompatibilityScreenContent: Fetching compatibility data for matchUserId: ${matchUserId}`, "Debug");
        
        const result = await errorRecovery.executeWithRecovery(async () => {
          const { data, error: funcError } = await supabase.functions.invoke('get-compatibility-details', {
            body: { matchUserId },
          });

          if (funcError) {
            throw funcError;
          }
          return data;
        }, 'compatibility_fetch');
        
        if (result !== null) {
          setCompatibilityData(result);
        } else if (errorRecovery.error) {
          // Report the network error
          reportNetworkError(errorRecovery.error, {
            url: 'get-compatibility-details',
            method: 'POST',
          });
          
          setError(errorRecovery.error.message || "Could not load compatibility information.");
        }
        
        setIsLoading(false);
      };

      fetchCompatibility();
    } else {
      setError("Match user ID is missing.");
      setIsLoading(false);
    }
  }, [matchUserId, errorRecovery]);

  if (isLoading) {
    return (
      <View 
        className="w-full bg-white p-6 items-center justify-center rounded-xl border-4 border-black border-b-8 shadow-lg" 
        style={{ minHeight: 300 }}
        accessibilityRole="progressbar"
        accessibilityLabel={ProgressAccessibility.createLoadingState('compatibility information')}
        accessible={true}
      >
        <ActivityIndicator size="large" color="#000000" />
        <Text 
          className="mt-2 text-black"
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
        >
          Loading Compatibility...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View 
        className="w-full bg-white p-6 items-center justify-center rounded-xl border-4 border-black border-b-8 shadow-lg" 
        style={{ minHeight: 300 }}
        accessibilityRole="alert"
        accessibilityLabel={`Error loading compatibility information: ${error}`}
      >
        <Text 
          className="text-red-500 text-center"
          {...createHeadingProps(2, `Error: ${error}`)}
        >
          {error}
        </Text>
        <View 
          className="flex-row gap-2 mt-4"
          accessibilityLabel="Error recovery options"
        >
          <TouchableOpacity 
            onPress={onBack} 
            className="p-2 bg-gray-200 rounded"
            style={{ minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }}
            {...createAccessibleButtonProps(
              'Go back',
              'Return to previous screen',
              ACCESSIBILITY_ROLES.ACTION_BUTTON
            )}
          >
            <Text>Go Back</Text>
          </TouchableOpacity>
          {errorRecovery.canRetry && (
            <TouchableOpacity 
              onPress={() => {
                announceToScreenReader('Retrying to load compatibility information', 'assertive');
                errorRecovery.retry();
              }} 
              className="p-2 bg-blue-500 rounded"
              style={{ minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }}
              {...createAccessibleButtonProps(
                'Retry loading',
                'Try to load compatibility information again',
                ACCESSIBILITY_ROLES.ACTION_BUTTON
              )}
            >
              <Text className="text-white">Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (!compatibilityData) {
     return (
      <View 
        className="w-full bg-white p-6 items-center justify-center rounded-xl border-4 border-black border-b-8 shadow-lg" 
        style={{ minHeight: 300 }}
        accessibilityRole="alert"
        accessibilityLabel="No compatibility data available"
      >
        <Text 
          className="text-black text-center"
          {...createHeadingProps(2, 'No compatibility data found')}
        >
          No compatibility data found.
        </Text>
        <TouchableOpacity 
          onPress={onBack} 
          className="mt-4 p-2 bg-gray-200 rounded"
          style={{ minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }}
          {...createAccessibleButtonProps(
            'Go back',
            'Return to previous screen',
            ACCESSIBILITY_ROLES.ACTION_BUTTON
          )}
        >
          <Text>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    // This root view will be the white background for the compatibility screen
    // Removed flex-1 to let content define height
    // Added content block styling: rounded-xl, borders, shadow-lg
    <View 
      className="w-full bg-white p-6 items-center rounded-xl border-4 border-black border-b-8 shadow-lg"
      accessibilityLabel={`Compatibility details with ${userName}`}
    >
      {/* Header - Heart icon removed, title centered, back button styled */}
      <View 
        className="flex-row items-center justify-between w-full mb-4"
        accessibilityLabel="Compatibility screen header"
      >
        <TouchableOpacity 
          ref={backButtonRef}
          onPress={() => {
            announceToScreenReader('Closing compatibility details', 'assertive');
            onBack();
          }} 
          className="w-10 h-10 rounded-full bg-white items-center justify-center border-2 border-black border-b-4"
          style={{ 
            minWidth: ensureAccessibleTouchTarget(40), 
            minHeight: ensureAccessibleTouchTarget(40) 
          }}
          {...createAccessibleButtonProps(
            'Go back',
            'Close compatibility details and return to match card',
            ACCESSIBILITY_ROLES.NAVIGATION_BUTTON
          )}
        >
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
        <Text 
          className="text-2xl font-regular text-black"
          {...createHeadingProps(1, 'Compatibility')}
        >
          Compatibility
        </Text>
        {/* Invisible spacer to help center the title, matching width of back button (w-10 is 40px) */}
        <View className="w-10 h-10" /> 
      </View>

      <Text 
        className="text-sm text-gray-600 mb-6 text-center"
        accessibilityRole="text"
        accessibilityLabel={`See how compatible you are with ${userName}`}
      >
        See how compatible you are with {userName}
      </Text>

      <CompatibilitySection
        title="Astrological"
        description="Based on birth charts"
        grade={compatibilityData.astrologicalGrade || 'N/A'}
        gradeDesc={compatibilityData.astrologicalDesc}
      />
      <CompatibilitySection
        title="Questionnaire"
        description="Based on your answers"
        grade={compatibilityData.questionnaireGrade || 'N/A'}
        gradeDesc={compatibilityData.questionnaireDesc}
      />
      <CompatibilitySection
        title="Overall Match Score"
        description="You have great potential for a meaningful connection!"
        score={compatibilityData.overallScore || 'N/A'}
        scoreDesc={compatibilityData.overallDesc}
      />

      <View 
        className="mt-auto w-full"
        accessibilityLabel="Match decision actions"
      >
        <TouchableOpacity
            ref={connectButtonRef}
            onPress={() => {
              announceToScreenReader(`Connecting with ${userName} in chat`, 'assertive');
              onConnectInChat();
            }}
            className="flex-row items-center justify-center bg-black rounded-xl px-6 py-4 w-full mb-4 shadow-lg"
            style={{ minHeight: ensureAccessibleTouchTarget(44) }}
            {...createAccessibleButtonProps(
              `Connect with ${userName} in chat`,
              'Start a conversation with this person',
              ACCESSIBILITY_ROLES.ACTION_BUTTON
            )}
        >
            <MessageSquare size={20} color="white" className="mr-2" />
            <Text className="text-white text-lg font-regular">Connect in Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            announceToScreenReader(`Declined match with ${userName}`, 'assertive');
            onDecline();
          }} 
          className="flex-row items-center self-center"
          style={{ 
            minWidth: ensureAccessibleTouchTarget(44), 
            minHeight: ensureAccessibleTouchTarget(44),
            paddingHorizontal: 12,
            paddingVertical: 8
          }}
          {...createAccessibleButtonProps(
            `Decline match with ${userName}`,
            'Choose not to connect with this person',
            ACCESSIBILITY_ROLES.ACTION_BUTTON
          )}
        >
            <X size={16} color="gray" className="mr-1" />
            <Text className="text-gray-500 text-sm">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Export the component wrapped with error boundary
const CompatibilityScreenContent = withCompatibilityErrorBoundary(CompatibilityScreenContentBase);

export default CompatibilityScreenContent;
