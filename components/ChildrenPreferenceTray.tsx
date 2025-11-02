import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from "react-native";
import { Baby, X } from "lucide-react-native";

const { height } = Dimensions.get("window");

interface ChildrenPreferenceData {
  hasKids: boolean;
  wantsKids: string;
}

interface ChildrenPreferenceTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmPreference: (preference: ChildrenPreferenceData) => void;
  initialHasKids?: boolean;
  initialWantsKids?: string;
}

const WANTS_KIDS_OPTIONS = ["Yes", "No", "Maybe", "Open to it"];

const ChildrenPreferenceTray: React.FC<ChildrenPreferenceTrayProps> = ({
  isVisible,
  onClose,
  onConfirmPreference,
  initialHasKids = false,
  initialWantsKids = "Maybe",
}) => {
  const [hasKids, setHasKids] = useState(initialHasKids);
  const [wantsKids, setWantsKids] = useState(initialWantsKids);

  useEffect(() => {
    if (isVisible) {
      // Reset to initial values when tray opens
      setHasKids(initialHasKids);
      setWantsKids(initialWantsKids);
    }
  }, [isVisible, initialHasKids, initialWantsKids]);

  const handleConfirm = () => {
    onConfirmPreference({ hasKids, wantsKids });
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.tray}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Children Preferences</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={24} color="black" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Help us find compatible matches
          </Text>

          {/* Has Kids Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Do you have children?</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  !hasKids && styles.toggleButtonActive
                ]}
                onPress={() => setHasKids(false)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.toggleButtonText,
                  !hasKids && styles.toggleButtonTextActive
                ]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  hasKids && styles.toggleButtonActive
                ]}
                onPress={() => setHasKids(true)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.toggleButtonText,
                  hasKids && styles.toggleButtonTextActive
                ]}>
                  Yes
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Wants Kids Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Do you want children?</Text>
            <View style={styles.optionsContainer}>
              {WANTS_KIDS_OPTIONS.map((option) => {
                const isSelected = wantsKids === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonActive
                    ]}
                    onPress={() => setWantsKids(option)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      isSelected && styles.optionButtonTextActive
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Preview */}
          <View style={styles.previewContainer}>
            <Baby size={20} color="#666" />
            <Text style={styles.previewText}>
              {hasKids ? "Has kids" : "No kids"} • {wantsKids} kids
            </Text>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmButtonText}>
              Confirm Preferences
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  tray: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 34,
    maxHeight: height * 0.7,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "black",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Geist-Regular",
    color: "black",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    color: "black",
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#B8D4F1",
    borderColor: "black",
  },
  toggleButtonText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "#666",
  },
  toggleButtonTextActive: {
    color: "black",
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
  },
  optionButtonActive: {
    backgroundColor: "#B8D4F1",
    borderColor: "black",
  },
  optionButtonText: {
    fontSize: 15,
    fontFamily: "Geist-Medium",
    color: "#666",
  },
  optionButtonTextActive: {
    color: "black",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  previewText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Geist-Medium",
  },
  confirmButton: {
    backgroundColor: "#B8D4F1",
    borderRadius: 12,
    paddingVertical: 16,
    alignSelf: 'center',
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "black",
  },
  confirmButtonText: {
    fontSize: 18,
    fontFamily: "Geist-Regular",
    color: "black",
  },
});

export default ChildrenPreferenceTray;
