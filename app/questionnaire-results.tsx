import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { ChevronLeft, ClipboardList } from "lucide-react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { COLORS, WHITE_CARD_STYLES, TEXT_STYLES } from '../constants/theme';

// Response labels for questionnaire
const responseLabels: Record<string, string> = {
  stronglyDisagree: "Strongly Disagree",
  disagree: "Disagree",
  neutral: "Neutral",
  agree: "Agree",
  stronglyAgree: "Strongly Agree",
  // Legacy numeric support
  "1": "Strongly Disagree",
  "2": "Disagree",
  "3": "Neutral",
  "4": "Agree",
  "5": "Strongly Agree",
};

// Group labels for questionnaire sections
const groupLabels: Record<string, string> = {
  G0: "Personality",
  G1: "Communication",
  G2: "Emotions",
  G3: "Future Goals",
  G4: "Beliefs",
};

export default function QuestionnaireResults() {
  const router = useRouter();
  const { userData, refetchProfile } = useAuth();
  const [questionnairePage, setQuestionnairePage] = useState(1);

  useEffect(() => {
    refetchProfile();
  }, []);

  // Process questionnaire data to handle both legacy and new formats
  const questionnaireData = userData?.questionnaire_responses 
    ? Array.isArray(userData.questionnaire_responses) 
      ? userData.questionnaire_responses.map((response: any) => {
          // Handle both legacy format (question/answer) and new format (questionText/response/group)
          if (response.questionText && response.response) {
            // New structured format
            return {
              question: response.questionText,
              answer: responseLabels[String(response.response)] || `Response: ${response.response}`,
              group: response.group || "",
            };
          } else if (response.question && response.answer) {
            // Legacy format
            return {
              question: response.question,
              answer: response.answer,
              group: "",
            };
          }
          return null;
        }).filter(Boolean)
      : []
    : [];

  // Questionnaire pagination
  const itemsPerPageQuestionnaire = 3;
  const totalQuestionnairePages = Math.ceil(questionnaireData.length / itemsPerPageQuestionnaire);
  const paginatedQuestionnaireData = questionnaireData.slice(
    (questionnairePage - 1) * itemsPerPageQuestionnaire,
    questionnairePage * itemsPerPageQuestionnaire
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BLACK_CARD} translucent={false} />
      <View style={styles.container}>
        <View style={styles.blackBackground}>
          <ScrollView style={styles.scrollContainer}>
            <View style={styles.contentWrapper}>
            {/* Header with back button */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <ChevronLeft size={24} color="black" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Questionnaire Results</Text>
              <Text style={styles.subtitle}>Your personality insights and responses</Text>
            </View>

            {/* Questionnaire Section */}
            <View style={styles.questionnaireCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.iconCircle}>
                    <ClipboardList size={20} color="black" />
                  </View>
                  <Text style={styles.sectionTitle}>Your Responses</Text>
                </View>
              </View>

              {questionnaireData.length > 0 ? (
                <>
                  <View style={styles.questionnaireSummary}>
                    <Text style={styles.summaryText}>
                      Total Responses: {questionnaireData.length} / 25
                    </Text>
                  </View>
                  
                  {paginatedQuestionnaireData.map((response: any, index: number) => {
                    const overallQuestionNumber = (questionnairePage - 1) * itemsPerPageQuestionnaire + index + 1;
                    return (
                      <View key={index} style={styles.questionAnswerContainer}>
                        <View style={styles.questionHeader}>
                          <Text style={styles.questionNumber}>Question {overallQuestionNumber}</Text>
                          {response.group && (
                            <Text style={styles.groupText}>{groupLabels[response.group] || response.group}</Text>
                          )}
                        </View>
                        <Text style={styles.questionText}>{response.question}</Text>
                        <Text style={styles.answerText}>{response.answer}</Text>
                      </View>
                    );
                  })}

                  {/* Pagination */}
                  {questionnaireData.length > itemsPerPageQuestionnaire && (
                    <View style={styles.pagination}>
                      <TouchableOpacity
                        style={styles.paginationButton}
                        onPress={() => setQuestionnairePage(Math.max(1, questionnairePage - 1))}
                        disabled={questionnairePage === 1}
                      >
                        <Text style={[styles.paginationButtonText, questionnairePage === 1 && styles.disabledText]}>Back</Text>
                      </TouchableOpacity>

                      <Text style={styles.paginationText}>
                        Page {questionnairePage} of {totalQuestionnairePages}
                      </Text>

                      <TouchableOpacity
                        style={[styles.paginationButton, styles.nextButton]}
                        onPress={() => setQuestionnairePage(Math.min(totalQuestionnairePages, questionnairePage + 1))}
                        disabled={questionnairePage === totalQuestionnairePages}
                      >
                        <Text style={[styles.nextButtonText, questionnairePage === totalQuestionnairePages && styles.disabledText]}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noDataText}>No questionnaire responses available</Text>
              )}
            </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD,
  },
  container: {
    flex: 1,
  },
  blackBackground: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD,
  },
  scrollContainer: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    padding: 16,
    paddingTop: 20,
    gap: 10,
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
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
    borderBottomWidth: 4, // 3D effect
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  titleContainer: {
    marginBottom: 4,
  },
  title: {
    ...TEXT_STYLES.DISPLAY_MEDIUM,
    color: COLORS.CARD_WHITE_TEXT,
  },
  subtitle: {
    ...TEXT_STYLES.BODY_MEDIUM,
    color: COLORS.CARD_WHITE_TEXT,
  },
  questionnaireCard: {
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 20,
    padding: 16,
    marginBottom: 40,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BACKGROUND_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER_SECONDARY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 12,
  },
  sectionTitle: {
    ...TEXT_STYLES.HEADING_SMALL,
    textAlign: "left",
  },
  questionnaireSummary: {
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SECONDARY,
  },
  summaryText: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
    textAlign: "center",
  },
  questionAnswerContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.BACKGROUND_PRIMARY,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SECONDARY,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionNumber: {
    ...TEXT_STYLES.CAPTION_MEDIUM,
    color: "#666",
  },
  groupText: {
    ...TEXT_STYLES.CAPTION_MEDIUM,
    color: COLORS.DARK_TEXT,
    backgroundColor: COLORS.TAG_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_SECONDARY,
  },
  questionText: {
    ...TEXT_STYLES.BODY_SMALL,
    marginBottom: 6,
    color: COLORS.DARK_TEXT,
  },
  answerText: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
    color: "#666",
    marginBottom: 8,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    backgroundColor: "#f5f5f5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButton: {
    backgroundColor: "#B8D4F1",
  },
  paginationButtonText: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
  },
  nextButtonText: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
  },
  paginationText: {
    ...TEXT_STYLES.BODY_SMALL,
  },
  noDataText: {
    ...TEXT_STYLES.BODY_SMALL,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 16,
  },
  disabledText: {
    opacity: 0.5,
  },
});
