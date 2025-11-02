import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { useState } from "react";
import { supabase } from "../src/lib/supabase";
import * as Sentry from '@sentry/react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

export default function ReportIssue() {
  const router = useRouter();
  const [issueDescription, setIssueDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!issueDescription.trim()) {
      Alert.alert("Error", "Please describe the issue you're experiencing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'report-issue',
        { body: { issue_description: issueDescription.trim() } }
      );

      if (error) {
        Alert.alert("Error", `Failed to submit issue: ${error.message}`);
        Sentry.captureException(error, { 
          extra: { context: "ReportIssue Submit Error", issueDescription } 
        });
      } else {
        Alert.alert("Success", "Your issue has been reported. We'll look into it!", [
          { 
            text: "OK", 
            onPress: () => router.back() 
          }
        ]);
        logDebug("Issue reported:", "Debug", data);
      }
    } catch (e: any) {
      Alert.alert("Error", `An unexpected error occurred: ${e.message}`);
      Sentry.captureException(e, { 
        extra: { context: "ReportIssue Catch Error", issueDescription } 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentWrapper}>
        {/* Header with colored background matching onboarding */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="black" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Report Issue</Text>
            <Text style={styles.headerSubtitle}>
              Tell us about any problems you're experiencing
            </Text>
          </View>
        </View>

        {/* Content section */}
        <View style={styles.contentSection}>
          {/* Explanatory text card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Help us improve Stellr</Text>
            <Text style={styles.infoText}>
              Describe the issue you're experiencing. Include as much detail as possible - 
              what you were doing, what you expected to happen, and what actually happened.
            </Text>
          </View>

          {/* Issue description input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Issue Description</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={8}
              placeholder="Please describe the issue you're experiencing..."
              placeholderTextColor="#9CA3AF"
              value={issueDescription}
              onChangeText={setIssueDescription}
              textAlignVertical="top"
            />
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!issueDescription.trim() || isSubmitting) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!issueDescription.trim() || isSubmitting}
          >
            <Send size={20} color="white" />
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Submitting..." : "Submit Issue"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // Navy background matching settings
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    backgroundColor: "#E5E7EB", // Light gray background matching onboarding
    paddingHorizontal: 16,
    paddingTop: 60, // Account for status bar
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 4, // Consistent with onboarding style
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: "black",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: "#4B5563",
    lineHeight: 22,
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    flex: 1,
  },
  infoCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: "black",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: "#4B5563",
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "white",
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    padding: 16,
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: "black",
    minHeight: 120,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButton: {
    backgroundColor: "#10B981", // Green background for submit
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 4, // Consistent with onboarding style
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "white",
    marginLeft: 8,
  },
});
