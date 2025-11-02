import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Stepper, { Step, StepperHandle } from './Stepper';
import QuestionnaireStepScreen from './QuestionnaireStepScreen';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QuestionnaireResult {
  question: string;
  answer: string;
}

interface QuestionnaireResponse {
  questionText: string;
  response: 'stronglyDisagree' | 'disagree' | 'neutral' | 'agree' | 'stronglyAgree';
  group: string;
}

interface QuestionnaireStepperFlowProps {
  onComplete: (results?: QuestionnaireResult[], structuredResponses?: QuestionnaireResponse[]) => void;
  onGoBackToOnboarding?: () => void;
}

// Personality Questions (Group 0 - original 5 questions)
const personalityQuestions = [
  "I prefer to take the initiative when meeting someone new.",
  "I enjoy spending time in large social gatherings.",
  "I find it easy to stay organized and follow a routine.",
  "I tend to think about how my actions affect others.",
  "I prefer having a detailed plan rather than being spontaneous.",
];

// Relationship Questions - Group 1: Communication, Expectations & Conflict Resolution
const group1Questions = [
  "Communication about expectations lead to relationship success.",
  "I prefer discussing relationship expectations and needs early on.",
  "Communicating during disagreements is essential to navigating conflict.",
  "Openly discussing finances is necessary for success in a serious long term relationship.",
  "I expect both partners to communicate openly about nurturing the relationship.",
];

// Group 2: Emotional Connection, Intimacy & Affection
const group2Questions = [
  "Communicating relationship expectations and roles is necessary in a relationship.",
  "Feeling that initial \"spark\" is important for me to open up to a deeper connection.",
  "When making important relationship choices, I primarily trust emotional intuition.",
  "When feeling a genuine emotional bond, I will look past my partner's flaws.",
  "I prefer getting to know a partner's deeper self gradually.",
];

// Group 3: Shared Life, Practicalities & Future Vision
const group3Questions = [
  "A strong physical connection is crucial for a successful relationship.",
  "Shared goals and vision for the future is essential for relationship success.",
  "When making important relationship choices, I primarily trust emotional intuition.",
  "I prefer a partner whose daily lifestyle harmonizes with mine.",
  "Relationship decisions should balance emotional needs with practical needs.",
];

// Group 4: Individuality, Boundaries & Personal Beliefs
const group4Questions = [
  "A strong physical connection is crucial for a relationship.",
  "Sharing a vision for the future is essential for a successful relationship.",
  "Shared values provide a foundation for navigating life and decisions together.",
  "Communicating needs in a relationship is necessary and healthy.",
  "Astrology can be a valuable lens to understand relationship dynamics.",
];

// All question groups
const questionGroups = [
  { title: "Personality", subtitle: "Help us understand your personality", questions: personalityQuestions, groupCode: "G0" },
  { title: "Communication", subtitle: "How do you handle communication and expectations?", questions: group1Questions, groupCode: "G1" },
  { title: "Emotions", subtitle: "How do you approach emotional intimacy?", questions: group2Questions, groupCode: "G2" },
  { title: "Future Goals", subtitle: "How do you envision building a life together?", questions: group3Questions, groupCode: "G3" },
  { title: "Beliefs", subtitle: "How do you maintain your identity in relationships?", questions: group4Questions, groupCode: "G4" },
];

const options = [
  "Strongly Disagree",
  "Disagree", 
  "Neutral",
  "Agree",
  "Strongly Agree",
];

// Mapping from option indices to database response values
const responseMapping: Record<number, 'stronglyDisagree' | 'disagree' | 'neutral' | 'agree' | 'stronglyAgree'> = {
  0: 'stronglyDisagree',
  1: 'disagree',
  2: 'neutral',
  3: 'agree',
  4: 'stronglyAgree'
};

const QuestionnaireStepperFlow: React.FC<QuestionnaireStepperFlowProps> = ({ onComplete, onGoBackToOnboarding }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const stepperRef = useRef<StepperHandle>(null);

  // State for collected answers for all groups
  const [allQuestionnaireAnswers, setAllQuestionnaireAnswers] = useState<(number | null)[][]>(
    questionGroups.map(group => Array(group.questions.length).fill(null))
  );

  // Get current group's answers
  const currentGroupAnswers = allQuestionnaireAnswers[currentGroupIndex];
  const currentGroup = questionGroups[currentGroupIndex];

  const handleQuestionComplete = (questionIndex: number, answer: number) => {
    // Update the current group's answers
    const newAllAnswers = [...allQuestionnaireAnswers];
    const newGroupAnswers = [...newAllAnswers[currentGroupIndex]];
    newGroupAnswers[questionIndex] = answer;
    newAllAnswers[currentGroupIndex] = newGroupAnswers;
    setAllQuestionnaireAnswers(newAllAnswers);
    
    if (questionIndex < currentGroup.questions.length - 1) {
      // More questions remaining in current group, advance to next step
      stepperRef.current?.next();
    } else {
      // Current group completed
      if (currentGroupIndex < questionGroups.length - 1) {
        // Move to next group - advance group and reset step with proper delay
        setTimeout(() => {
          setCurrentGroupIndex(currentGroupIndex + 1);
          setCurrentStep(1);
        }, 600); // Match the delay in QuestionnaireStepScreen
      } else {
        // All groups completed - convert all answers to both formats
        const results: QuestionnaireResult[] = [];
        const structuredResponses: QuestionnaireResponse[] = [];
        
        questionGroups.forEach((group, groupIndex) => {
          group.questions.forEach((question, questionIndex) => {
            const answerIndex = newAllAnswers[groupIndex][questionIndex];
            if (answerIndex !== null) {
              // Legacy format for backward compatibility
              results.push({
                question,
                answer: options[answerIndex]
              });
              
              // New structured format for database storage
              structuredResponses.push({
                questionText: question,
                response: responseMapping[answerIndex],
                group: group.groupCode
              });
            }
          });
        });
        
        logDebug('QuestionnaireStepperFlow: Calling onComplete with results:', "Debug", results.length, 'structured:', structuredResponses.length);
        
        // Add delay before calling onComplete to ensure smooth transition
        setTimeout(() => {
          onComplete(results, structuredResponses);
        }, 600);
      }
    }
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const getStepBackgroundColor = (step: number) => {
    // Use pink theme for all questionnaire steps
    return '#F2BAC9';
  };

  return (
    <View style={[
      styles.container,
      { paddingBottom: Math.max(16, insets.bottom + 8) }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentStep > 1) {
              // Go back to previous question within current group
              stepperRef.current?.back();
            } else if (currentGroupIndex > 0) {
              // Go back to previous group's last question
              setCurrentGroupIndex(currentGroupIndex - 1);
              setCurrentStep(questionGroups[currentGroupIndex - 1].questions.length);
            } else {
              // First question of first group - go back to onboarding
              if (onGoBackToOnboarding) {
                onGoBackToOnboarding();
              } else {
                router.back();
              }
            }
          }}
        >
          <ArrowLeft size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Questionnaire</Text>
        <Text style={styles.subtitle}>
          Group {currentGroupIndex + 1} of {questionGroups.length}
        </Text>
      </View>

      {/* Main Card */}
      <Stepper
        key={`group-${currentGroupIndex}`}
        ref={stepperRef}
        initialStep={currentStep}
        onStepChange={handleStepChange}
        onFinalStepCompleted={() => {
          // This should not be called as we handle completion in handleQuestionComplete
          // But if it is, we'll do nothing to prevent any issues
        }}
        backButtonText="Back"
        nextButtonText="Continue"
      >
        {currentGroup.questions.map((question, index) => (
          <Step key={`${currentGroupIndex}-${index}`}>
            <QuestionnaireStepScreen
              question={question}
              options={options}
              questionIndex={index}
              totalQuestions={currentGroup.questions.length}
              selectedAnswer={currentGroupAnswers[index]}
              onComplete={handleQuestionComplete}
              backgroundColor={getStepBackgroundColor(index + 1)}
              sectionTitle={currentGroup.title}
            />
          </Step>
        ))}
      </Stepper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Navy background like date night
    paddingHorizontal: 16,
    paddingTop: 48,
    // Bottom padding is applied dynamically via safe area insets in component
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  titleContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
  },
});

export default QuestionnaireStepperFlow;
