import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { User, MapPin } from "lucide-react-native";
import BirthLocationSelectionTray from "./BirthLocationSelectionTray";

const TOTAL_PROFILE_SETUP_STEPS = 4; // Name, Birth Info, Questionnaire, Profile Setup

interface NameInfo {
  name: string;
  birthCity: string;
}

interface NameInfoScreenProps {
  onContinue: (nameInfo: NameInfo) => void;
  initialData?: NameInfo;
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const NameInfoScreen: React.FC<NameInfoScreenProps> = ({ 
  onContinue, 
  initialData, 
  hideProgressBar = false, 
  hideBackButton = false,
  backgroundColor = '#B8D4F1'
}) => {
  const [selectedName, setSelectedName] = useState(initialData?.name || "");
  const [selectedCity, setSelectedCity] = useState(initialData?.birthCity || "New York");
  const [nameInteracted, setNameInteracted] = useState(false);
  const [birthCityInteracted, setBirthCityInteracted] = useState(true); // Default city is already selected
  const [isContinuePressed, setIsContinuePressed] = useState(false);
  const [isCityTrayVisible, setCityTrayVisible] = useState(false);

  const handleContinue = () => {
    if (isFormValid) {
      const nameInfo = {
        name: selectedName.trim(),
        birthCity: selectedCity,
      };
      if (onContinue) {
        onContinue(nameInfo);
      }
    }
  };

  const handleOpenCityTray = () => setCityTrayVisible(true);
  const handleConfirmLocation = (loc: { city: string; country: string; lat: number; lng: number; displayName: string }) => {
    // Store only the city name to keep backend geocoding robust
    setSelectedCity(loc.city);
    setBirthCityInteracted(true);
    setCityTrayVisible(false);
  };

  const isNameValid = selectedName.trim().length >= 2;
  const isFormValid = isNameValid && birthCityInteracted;

  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 1 of 4</Text>
        <Text style={styles.mainTitle}>What's your name?</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Enter your name and birth city</Text>

        <Text style={styles.sectionTitle}>Full Name</Text>
        <View style={[
          styles.inputContainer,
          { backgroundColor: nameInteracted && selectedName ? "#B8D4F1" : "white" },
        ]}>
          <User size={24} color={nameInteracted && selectedName ? "black" : "black"} />
          <TextInput
            style={[
              styles.textInput,
              { color: nameInteracted && selectedName ? "black" : "black" }
            ]}
            placeholder="Enter your full name"
            placeholderTextColor={nameInteracted && selectedName ? "#555555" : "#555555"}
            value={selectedName}
            onChangeText={(text) => {
              setSelectedName(text);
              setNameInteracted(true);
            }}
            autoFocus={true}
            returnKeyType="next"
          />
        </View>

        <Text style={styles.sectionTitle}>Birth City</Text>
        <TouchableOpacity
          style={[
            styles.selectionButton,
            { backgroundColor: birthCityInteracted ? "#B8D4F1" : "white" },
          ]}
          onPress={handleOpenCityTray}
          activeOpacity={0.7}
        >
          <View>
            <Text style={[styles.buttonLabel, { color: birthCityInteracted ? "black" : "#555555" }]}>City</Text>
            <Text style={[styles.buttonValue, { color: birthCityInteracted ? "black" : "black" }]}>{selectedCity}</Text>
          </View>
          <MapPin size={24} color={birthCityInteracted ? "black" : "black"} />
        </TouchableOpacity>
      </View>

      {/* Button at the bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { 
              backgroundColor: isContinuePressed && isFormValid ? "#9FC4E7" : "#B8D4F1",
            },
            !isFormValid && styles.disabledButton,
          ]}
          onPress={handleContinue}
          onPressIn={() => isFormValid && setIsContinuePressed(true)}
          onPressOut={() => setIsContinuePressed(false)}
          disabled={!isFormValid}
        >
          <Text style={styles.continueButtonText}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>

      {isCityTrayVisible && (
        <BirthLocationSelectionTray
          isVisible={isCityTrayVisible}
          onClose={() => setCityTrayVisible(false)}
          onConfirmLocation={handleConfirmLocation}
          initialLocation={selectedCity}
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
  inputContainer: {
    flexDirection: "row",
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
  textInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    marginLeft: 16,
    color: "black",
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
    marginBottom: 0,
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
    marginTop: 30,
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
  disabledButton: {
    opacity: 0.5,
  },
});

export default NameInfoScreen;
