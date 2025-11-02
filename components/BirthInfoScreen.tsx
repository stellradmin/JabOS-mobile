import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { CalendarDays, Clock } from "lucide-react-native";
import BirthDateSelectionTray from "./BirthDateSelectionTray";
import BirthTimeSelectionTray from "./BirthTimeSelectionTray";

const { width } = Dimensions.get("window");
const TOTAL_PROFILE_SETUP_STEPS = 4; // Name, Birth Info, Questionnaire, Profile Setup

interface BirthInfo {
  birthDate: string;
  birthTime: string;
}

interface BirthInfoScreenProps {
  onContinue: (birthInfo: BirthInfo) => void;
  initialData?: BirthInfo;
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const BirthInfoScreen: React.FC<BirthInfoScreenProps> = ({ 
  onContinue, 
  initialData, 
  hideProgressBar = false, 
  hideBackButton = false,
  backgroundColor = '#B8D4F1'
}) => {
  const MONTHS_ARRAY = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ];

  const [selectedDate, setSelectedDate] = useState(initialData?.birthDate || "January 1, 1990");
  const [selectedTime, setSelectedTime] = useState(initialData?.birthTime || "Select time");

  const [isDateTrayVisible, setDateTrayVisible] = useState(false);
  const [isTimeTrayVisible, setTimeTrayVisible] = useState(false);

  // State variables to track user interaction
  const [birthDateInteracted, setBirthDateInteracted] = useState(false);
  const [birthTimeInteracted, setBirthTimeInteracted] = useState(false);
  const [isContinuePressed, setIsContinuePressed] = useState(false); // For continue button press effect

  const handleOpenDateTray = () => setDateTrayVisible(true);
  const handleConfirmDate = (month: string, day: string, year: string) => {
    setSelectedDate(`${month} ${parseInt(day, 10)}, ${year}`);
    setBirthDateInteracted(true);
    setDateTrayVisible(false);
  };


  const handleOpenTimeTray = () => {
    console.log('📱 [BirthInfoScreen] Opening time tray');
    setTimeTrayVisible(true);
  };

  const handleConfirmTime = (hour: string, minute: string, amPm: string) => {
    console.log('📱 [BirthInfoScreen] Confirming time:', { hour, minute, amPm });
    setSelectedTime(`${hour}:${minute} ${amPm}`);
    setBirthTimeInteracted(true);
    setTimeTrayVisible(false);
  };

  const handleContinue = () => {
    const birthInfo = {
      birthDate: selectedDate,
      birthTime: selectedTime === "Select time" ? "" : selectedTime,
    };
    if (onContinue) {
      onContinue(birthInfo);
    }
  };

  const isAllFieldsValid = birthDateInteracted && birthTimeInteracted && selectedTime !== "Select time";

  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 2 of 4</Text>
        <Text style={styles.mainTitle}>Birth Date & Time</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Enter when you were born for your astrology profile</Text>

        <Text style={styles.sectionTitle}>Birth Date</Text>
        <TouchableOpacity
          style={[
            styles.selectionButton,
            { backgroundColor: birthDateInteracted ? "#B8D4F1" : "white" },
          ]}
          onPress={handleOpenDateTray}
          activeOpacity={0.7}
        >
          <View>
            <Text style={[styles.buttonLabel, { color: birthDateInteracted ? "black" : "#555555" }]}>Date</Text>
            <Text style={[styles.buttonValue, { color: birthDateInteracted ? "black" : "black" }]}>{selectedDate}</Text>
          </View>
          <CalendarDays size={24} color={birthDateInteracted ? "black" : "black"} />
        </TouchableOpacity>


        <Text style={styles.sectionTitle}>Birth Time</Text>
        <TouchableOpacity
          style={[
            styles.selectionButton,
            { backgroundColor: birthTimeInteracted && selectedTime !== "Select time" ? "#B8D4F1" : "white" },
          ]}
          onPress={handleOpenTimeTray}
          activeOpacity={0.7}
        >
          <View>
            <Text style={[styles.buttonLabel, { color: birthTimeInteracted && selectedTime !== "Select time" ? "black" : "#555555" }]}>Time</Text>
            <Text style={[styles.buttonValue, { color: birthTimeInteracted && selectedTime !== "Select time" ? "black" : "black" }]}>{selectedTime}</Text>
          </View>
          <Clock size={24} color={birthTimeInteracted && selectedTime !== "Select time" ? "black" : "black"} />
        </TouchableOpacity>
      </View>

      {/* Button at the bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            { 
              backgroundColor: isContinuePressed && isAllFieldsValid ? "#9FC4E7" : "#B8D4F1",
            },
            !isAllFieldsValid && styles.disabledButton,
          ]}
          onPress={handleContinue}
          onPressIn={() => isAllFieldsValid && setIsContinuePressed(true)}
          onPressOut={() => setIsContinuePressed(false)}
          disabled={!isAllFieldsValid}
        >
          <Text style={styles.continueButtonText}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>

      {isDateTrayVisible && (() => {
        const parts = selectedDate.split(' ');
        const initialMonth = parts[0];
        const initialDay = parts[1]?.replace(',', '').padStart(2, '0');
        const initialYear = parts[2];
        const isValidDateParts = MONTHS_ARRAY.includes(initialMonth) && initialDay && initialYear;
        return (
          <BirthDateSelectionTray
            isVisible={isDateTrayVisible}
            onClose={() => setDateTrayVisible(false)}
            onConfirmDate={handleConfirmDate}
            initialMonth={isValidDateParts ? initialMonth : MONTHS_ARRAY[0]}
            initialDay={isValidDateParts ? initialDay : "01"}
            initialYear={isValidDateParts ? initialYear : new Date().getFullYear().toString()}
          />
        );
      })()}


      {isTimeTrayVisible && (() => {
        let initialHour = "01", initialMinute = "00", initialAmPm = "AM";
        if (selectedTime !== "Select time") {
          const timeParts = selectedTime.split(/[:\s]/);
          if (timeParts.length === 3) {
            initialHour = timeParts[0];
            initialMinute = timeParts[1];
            initialAmPm = timeParts[2].toUpperCase();
          }
        }
        console.log('📱 [BirthInfoScreen] Rendering BirthTimeSelectionTray with:', { initialHour, initialMinute, initialAmPm });
        return (
          <BirthTimeSelectionTray
            isVisible={isTimeTrayVisible}
            onClose={() => setTimeTrayVisible(false)}
            onConfirmTime={handleConfirmTime}
            initialHour={initialHour}
            initialMinute={initialMinute}
            initialAmPm={initialAmPm}
          />
        );
      })()}
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
  disabledButton: {
    opacity: 0.5,
  },
});

export default BirthInfoScreen;
