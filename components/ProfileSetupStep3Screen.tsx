import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { Plus } from "lucide-react-native";

interface ProfileSetupStep3ScreenProps {
  initialData: {
    interests: string[];
    traits: string[];
  };
  onContinue: (data: { interests: string[]; traits: string[] }) => void;
  onBack: () => void;
  currentSubStepInFlow: number;
  overallStepsCompletedBeforeThisFlow: number;
  totalSubStepsInFlow: number;
  totalOverallOnboardingSteps: number;
  hideProgressBar?: boolean;
  hideBackButton?: boolean;
  backgroundColor?: string;
}

const ProfileSetupStep3Screen: React.FC<ProfileSetupStep3ScreenProps> = ({
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
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialData.interests || []);
  const [selectedTraits, setSelectedTraits] = useState<string[]>(initialData.traits || []);
  const [newInterest, setNewInterest] = useState("");
  const [newTrait, setNewTrait] = useState("");
  const [isContinuePressed, setIsContinuePressed] = useState(false);

  const handleAddInterest = () => {
    if (newInterest && !selectedInterests.includes(newInterest) && selectedInterests.length < 15) {
      setSelectedInterests([...selectedInterests, newInterest]);
      setNewInterest("");
    }
  };

  const handleRemoveInterest = (interestToRemove: string) => {
    setSelectedInterests(selectedInterests.filter(interest => interest !== interestToRemove));
  };

  const handleAddTrait = () => {
    if (newTrait && !selectedTraits.includes(newTrait) && selectedTraits.length < 10) {
      setSelectedTraits([...selectedTraits, newTrait]);
      setNewTrait("");
    }
  };

  const handleRemoveTrait = (traitToRemove: string) => {
    setSelectedTraits(selectedTraits.filter(trait => trait !== traitToRemove));
  };

  const handleContinuePress = () => {
    onContinue({ interests: selectedInterests, traits: selectedTraits });
  };

  return (
    <View style={styles.container}>
      {/* Header section with colored background */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={styles.stepIndicator}>Step 5 of 5</Text>
        <Text style={styles.mainTitle}>Interests & Traits</Text>
      </View>

      {/* Content section */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>Tell us what you're passionate about</Text>

        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.tagsContainer}>
          {selectedInterests.map((interest, index) => (
            <View key={index} style={styles.tagWithClose}>
              <Text style={styles.tagText}>{interest}</Text>
              <TouchableOpacity onPress={() => handleRemoveInterest(interest)}>
                <Text style={styles.closeTag}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Add an interest..."
            value={newInterest}
            onChangeText={setNewInterest}
            onSubmitEditing={handleAddInterest}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddInterest}>
            <Plus size={20} color="black" />
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>Add up to 10 interests</Text>
        
        <Text style={styles.sectionTitle}>Traits</Text>
        <View style={styles.tagsContainer}>
          {selectedTraits.map((trait, index) => (
            <View key={index} style={styles.tagWithClose}>
              <Text style={styles.tagText}>{trait}</Text>
              <TouchableOpacity onPress={() => handleRemoveTrait(trait)}>
                <Text style={styles.closeTag}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Add a personality trait..."
            value={newTrait}
            onChangeText={setNewTrait}
            onSubmitEditing={handleAddTrait}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddTrait}>
            <Plus size={20} color="black" />
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>Add up to 10 traits</Text>
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
    marginBottom: 0,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
    minHeight: 8,
  },
  tagWithClose: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "black",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tagText: {
    fontSize: 14,
    color: "black",
    marginRight: 8,
  },
  closeTag: {
    fontSize: 18,
    color: "black",
    fontWeight: "normal",
  },
  addItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 0,
  },
  addItemInput: {
    flex: 1,
    height: 50,
    borderWidth: 2,
    borderColor: "black",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    fontSize: 16,
    backgroundColor: "white",
    color: "black",
  },
  addButton: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: "black",
    borderRadius: 12,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  helperText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
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
});

export default ProfileSetupStep3Screen;