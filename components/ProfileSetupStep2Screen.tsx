import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MapPin, Baby } from "lucide-react-native";
import CurrentCitySelectionTray from "./CurrentCitySelectionTray";
import ChildrenPreferenceTray from "./ChildrenPreferenceTray";

// const { width } = Dimensions.get("window"); // Not used

interface ProfileSetupStep2ScreenProps {
  initialData: {
    currentCity: string;
    currentCityCoords: { lat: number; lng: number } | null;
    hasKids: boolean;
    wantsKids: string;
  };
  onContinue: (data: {
    currentCity: string;
    currentCityCoords: { lat: number; lng: number } | null;
    hasKids: boolean;
    wantsKids: string;
  }) => void;
  onBack: () => void;
  currentSubStepInFlow: number;
  overallStepsCompletedBeforeThisFlow: number;
  totalSubStepsInFlow: number;
  totalOverallOnboardingSteps: number;
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const ProfileSetupStep2Screen: React.FC<ProfileSetupStep2ScreenProps> = ({
  initialData,
  onContinue,
  onBack,
  currentSubStepInFlow,
  overallStepsCompletedBeforeThisFlow,
  totalSubStepsInFlow,
  totalOverallOnboardingSteps,
  hideProgressBar = false,
  hideBackButton = false,
  backgroundColor = '#B8D4F1',
}) => {
  const [currentCity, setCurrentCity] = useState(initialData.currentCity);
  const [currentCityCoords, setCurrentCityCoords] = useState(initialData.currentCityCoords);
  const [hasKids, setHasKids] = useState(initialData.hasKids);
  const [wantsKids, setWantsKids] = useState(initialData.wantsKids);

  const [isCityTrayVisible, setCityTrayVisible] = useState(false);
  const [isChildrenTrayVisible, setChildrenTrayVisible] = useState(false);
  const [cityInteracted, setCityInteracted] = useState(false);
  const [childrenInteracted, setChildrenInteracted] = useState(false);
  const [isContinuePressed, setIsContinuePressed] = useState(false);

  useEffect(() => {
    if (initialData.currentCity !== "") setCityInteracted(true);
    if (initialData.wantsKids !== "Maybe") setChildrenInteracted(true);
  }, [initialData]);

  const handleConfirmLocation = (location: { city: string; country: string; lat: number; lng: number; displayName: string }) => {
    setCurrentCity(location.displayName);
    setCurrentCityCoords({ lat: location.lat, lng: location.lng });
    setCityInteracted(true);
    setCityTrayVisible(false);
  };

  const handleConfirmChildren = (preference: { hasKids: boolean; wantsKids: string }) => {
    setHasKids(preference.hasKids);
    setWantsKids(preference.wantsKids);
    setChildrenInteracted(true);
    setChildrenTrayVisible(false);
  };

  const handleContinuePress = () => {
    onContinue({
      currentCity,
      currentCityCoords,
      hasKids,
      wantsKids,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 5 of 5</Text>
        <Text style={styles.mainTitle}>Location & Family</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Tell us where you live and your family preferences</Text>

        <Text style={styles.sectionTitle}>Current City</Text>
        <TouchableOpacity
          style={[styles.selectionButton, { backgroundColor: cityInteracted ? "#B8D4F1" : "white" }]}
          onPress={() => setCityTrayVisible(true)}
          activeOpacity={0.7}
        >
          <View>
            <Text style={[styles.buttonLabel, { color: cityInteracted ? "black" : "#555555" }]}>Where You Live</Text>
            <Text style={[styles.buttonValue, { color: cityInteracted ? "black" : "black" }]}>{currentCity || "Select your city"}</Text>
          </View>
          <MapPin size={24} color={cityInteracted ? "black" : "black"} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Children</Text>
        <TouchableOpacity
          style={[styles.selectionButton, { backgroundColor: childrenInteracted ? "#B8D4F1" : "white" }]}
          onPress={() => setChildrenTrayVisible(true)}
          activeOpacity={0.7}
        >
          <View>
            <Text style={[styles.buttonLabel, { color: childrenInteracted ? "black" : "#555555" }]}>Family Preferences</Text>
            <Text style={[styles.buttonValue, { color: childrenInteracted ? "black" : "black" }]}>
              {hasKids ? "Has kids" : "No kids"} • {wantsKids === 'Yes' ? 'Wants' : wantsKids === 'No' ? "Doesn't Want" : wantsKids === 'Maybe' ? 'Open' : wantsKids}
            </Text>
          </View>
          <Baby size={24} color={childrenInteracted ? "black" : "black"} />
        </TouchableOpacity>

      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: isContinuePressed ? "#9FC4E7" : "#B8D4F1",
            },
          ]}
          onPress={handleContinuePress}
          onPressIn={() => setIsContinuePressed(true)}
          onPressOut={() => setIsContinuePressed(false)}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {isCityTrayVisible && (
        <CurrentCitySelectionTray
          isVisible={isCityTrayVisible}
          onClose={() => setCityTrayVisible(false)}
          onConfirmLocation={handleConfirmLocation}
          initialLocation={currentCity}
        />
      )}
      {isChildrenTrayVisible && (
        <ChildrenPreferenceTray
          isVisible={isChildrenTrayVisible}
          onClose={() => setChildrenTrayVisible(false)}
          onConfirmPreference={handleConfirmChildren}
          initialHasKids={hasKids}
          initialWantsKids={wantsKids}
        />
      )}
    </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555555",
    marginBottom: 40,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "black",
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectionButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    backgroundColor: "white",
    marginBottom: 20,
    minHeight: 70,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonLabel: {
    fontSize: 14,
    color: "#555555",
    marginBottom: 2,
  },
  buttonValue: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  continueButton: {
    backgroundColor: "#B8D4F1",
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
    marginBottom: 0,
  },
  continueButtonText: {
    fontFamily: 'Geist-Regular',
    fontSize: 18,
    color: "black",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  tagWithClose: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffeeb2",
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tagText: {
    fontFamily: 'Geist-Regular',
    marginRight: 4,
    fontSize: 14,
  },
  closeTag: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: 'black',
    marginLeft: 2,
    lineHeight: 16,
  },
  addItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginTop: 2,
  },
  addItemInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 4,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    fontSize: 14,
    backgroundColor: 'white',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffeeb2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 3,
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    marginTop: 4,
  },
});

export default ProfileSetupStep2Screen;
