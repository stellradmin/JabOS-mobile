import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import ActivitySelectionTray from './ActivitySelectionTray';

interface ActivityPreferencesStepProps {
  preferredActivity: string;
  onComplete: (preferredActivity: string) => void;
  backgroundColor: string;
}

const ActivityPreferencesStep: React.FC<ActivityPreferencesStepProps> = ({
  preferredActivity,
  onComplete,
  backgroundColor,
}) => {
  const [localPreferredActivity, setLocalPreferredActivity] = useState<string>(preferredActivity || 'Any');
  const [showPreferredTray, setShowPreferredTray] = useState(false);

  const animatedValue = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(animatedValue.value),
      transform: [{ scale: withSpring(animatedValue.value * 0.1 + 0.9) }],
    };
  });

  React.useEffect(() => {
    animatedValue.value = 1;
  }, []);

  const handlePreferredActivityToggle = (activity: string) => {
    setLocalPreferredActivity(activity);
  };

  const handleContinue = () => {
    onComplete(localPreferredActivity);
  };

  const canContinue = localPreferredActivity !== '';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 2 of 2</Text>
        <Text style={styles.mainTitle}>Activity Preferences</Text>
      </View>

      <View style={styles.content}>

        {/* Preferred Activities Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>What date activity do you prefer?</Text>
          <Text style={styles.fieldHint}>(You can edit this later)</Text>
          
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowPreferredTray(true)}
          >
            <Text style={styles.dropdownText} numberOfLines={2}>
              {localPreferredActivity || 'Select preferred activity...'}
            </Text>
            <ChevronDown size={20} color="black" />
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !canContinue && styles.disabledButton
          ]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={[
            styles.continueButtonText,
            !canContinue && styles.disabledButtonText
          ]}>
            Complete Setup
          </Text>
        </TouchableOpacity>
      </View>

      {/* Activity selection tray (scroll wheel) */}
      {showPreferredTray && (
        <ActivitySelectionTray
          isVisible={showPreferredTray}
          onClose={() => setShowPreferredTray(false)}
          onConfirm={(activity) => handlePreferredActivityToggle(activity)}
          initialActivity={localPreferredActivity}
          headerTabColor={'#C8A8E9'}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 2,
    borderTopColor: 'black',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
  },
  stepIndicator: {
    fontSize: 14,
    color: 'black',
    opacity: 0.6,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: 'black',
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 14,
    color: 'black',
    opacity: 0.6,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  dropdownButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'black',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    minHeight: 56,
  },
  dropdownText: {
    fontSize: 16,
    color: 'black',
    flex: 1,
    marginRight: 8,
  },
  continueButton: {
    backgroundColor: "#C8A8E9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 24,
  },
  continueButtonText: {
    fontFamily: 'Geist-Regular',
    fontSize: 18,
    color: "black",
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: "black",
  },
});

export default ActivityPreferencesStep;
