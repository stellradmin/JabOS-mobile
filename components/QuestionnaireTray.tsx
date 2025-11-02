import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react-native";
import PopUpTray from "./PopUpTray";
import { COLORS, WHITE_CARD_STYLES } from '../constants/theme';

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

interface QuestionnaireTrayProps {
  isVisible: boolean;
  onClose: () => void;
  userData: any;
}

const QuestionnaireTray: React.FC<QuestionnaireTrayProps> = ({
  isVisible,
  onClose,
  userData,
}) => {
  const [questionnairePage, setQuestionnairePage] = useState(1);

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
  const itemsPerPageQuestionnaire = 2;
  const totalQuestionnairePages = Math.ceil(questionnaireData.length / itemsPerPageQuestionnaire);
  const paginatedQuestionnaireData = questionnaireData.slice(
    (questionnairePage - 1) * itemsPerPageQuestionnaire,
    questionnairePage * itemsPerPageQuestionnaire
  );


  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={onClose}
      title="Questionnaire Results"
      confirmButtonText="Done"
      headerTabColor="#B8D4F1"
      customHeight={0.9} // Large height for questionnaire content with pagination space
    >
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.container}>
          
          {/* Questionnaire Section */}
          <View style={styles.questionnaireCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.headerContent}>
                <View style={styles.iconCircle}>
                  <ClipboardList size={20} color="black" />
                </View>
                <Text style={styles.sectionTitle}>Your Responses</Text>
              </View>
              {questionnaireData.length > 2 && (
                <Text style={styles.pageIndicator}>
                  {questionnairePage} / {totalQuestionnairePages}
                </Text>
              )}
            </View>

            {questionnaireData.length > 0 ? (
              <>
                <View style={styles.contentArea}>
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
                </View>

                {/* Navigation Container */}
                {questionnaireData.length > 2 && (
                  <View style={styles.navigationContainer}>
                    <TouchableOpacity 
                      style={[styles.chevronButton, questionnairePage === 1 && styles.disabledChevron]}
                      onPress={() => setQuestionnairePage(Math.max(1, questionnairePage - 1))}
                      disabled={questionnairePage === 1}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={20} color={questionnairePage === 1 ? "#ccc" : COLORS.DARK_TEXT} />
                    </TouchableOpacity>

                    <View style={styles.navigationSpacer} />

                    <TouchableOpacity 
                      style={[styles.chevronButton, questionnairePage === totalQuestionnairePages && styles.disabledChevron]}
                      onPress={() => setQuestionnairePage(Math.min(totalQuestionnairePages, questionnairePage + 1))}
                      disabled={questionnairePage === totalQuestionnairePages}
                      activeOpacity={0.7}
                    >
                      <ChevronRight size={20} color={questionnairePage === totalQuestionnairePages ? "#ccc" : COLORS.DARK_TEXT} />
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
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    padding: 8,
    paddingBottom: 20,
  },
  questionnaireCard: {
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 20,
    padding: 12,
    marginBottom: 8,
    // Remove drop shadow for flat appearance
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    // Remove drop shadow
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    textAlign: "left",
  },
  pageIndicator: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    backgroundColor: COLORS.LIGHT_INTERACTIVE_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    textAlign: 'center',
    minWidth: 40,
  },
  questionAnswerContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'black',
    borderBottomWidth: 2,
    // Remove drop shadow
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: "#666",
  },
  groupText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: "black",
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "black",
    overflow: 'hidden',
  },
  questionText: {
    fontSize: 15,
    marginBottom: 8,
    fontFamily: 'Geist-Regular',
    color: 'black',
    lineHeight: 20,
  },
  answerText: {
    fontSize: 14,
    color: "#2563eb",
    fontFamily: 'Geist-Regular',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: 'center',
    alignSelf: 'flex-start',
  },
  contentArea: {
    marginBottom: 16,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  chevronButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    justifyContent: 'center',
    alignItems: 'center',
    // Remove drop shadow
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  navigationSpacer: {
    flex: 1,
  },
  disabledChevron: {
    backgroundColor: COLORS.LIGHT_INTERACTIVE_BG,
    opacity: 0.5,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 16,
  },
});

export default QuestionnaireTray;
