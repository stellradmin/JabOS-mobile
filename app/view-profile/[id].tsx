import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import ProfileInfoCard from '../../components/profile/ProfileInfoCard';
import { COLORS, TEXT_STYLES } from '../../constants/theme';
import { NatalChartService, getPlanetArray } from '../../src/lib/natalChartService';
import { logDebug, logError } from '../../src/utils/logger';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

// Response labels for questionnaire
const responseLabels: Record<string, string> = {
  stronglyDisagree: 'Strongly Disagree',
  disagree: 'Disagree',
  neutral: 'Neutral',
  agree: 'Agree',
  stronglyAgree: 'Strongly Agree',
  '1': 'Strongly Disagree',
  '2': 'Disagree',
  '3': 'Neutral',
  '4': 'Agree',
  '5': 'Strongly Agree',
};

const groupLabels: Record<string, string> = {
  G0: 'Personality',
  G1: 'Communication',
  G2: 'Emotions',
  G3: 'Future Goals',
  G4: 'Beliefs',
};

export default function ViewProfileById() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; conversationId?: string }>();
  const otherUserId = (params?.id as string) || '';
  const originatingConversationId = (params?.conversationId as string) || '';

  const [profile, setProfile] = useState<any | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [natalChartPlanets, setNatalChartPlanets] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!otherUserId) return;
        const [{ data: prof }, { data: user }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherUserId).single(),
          supabase
            .from('users')
            .select('id, birth_date, birth_location, birth_time, questionnaire_responses, natal_chart_data, email, sun_sign, moon_sign, rising_sign')
            .eq('id', otherUserId)
            .single(),
        ]);
        if (!mounted) return;
        setProfile(prof);
        setUserData(user);

        // Populate natal chart planets from available data
        const sourceChart: any = (user?.natal_chart_data ?? prof?.natal_chart_data) as any;
        const isEmptyObject = (obj: any) => obj && typeof obj === 'object' && Object.keys(obj).length === 0;

        if (sourceChart && !isEmptyObject(sourceChart)) {
          try {
            const anyChart: any = sourceChart;
            logDebug('[VIEW-PROFILE] Chart data present for other user', 'Debug');
            if (anyChart.chartData && Array.isArray(anyChart.chartData.planets)) {
              setNatalChartPlanets(anyChart.chartData.planets);
            } else if (anyChart.corePlacements && typeof anyChart.corePlacements === 'object') {
              const placements = anyChart.corePlacements;
              const planets = Object.keys(placements)
                .map((key) => {
                  const p = placements[key];
                  if (!p || typeof p !== 'object') return null;
                  return {
                    name: p.Name || key,
                    sign: p.Sign,
                    degree: typeof p.Degree === 'number' ? p.Degree : 0,
                  };
                })
                .filter(Boolean) as any[];
              setNatalChartPlanets(planets);
            } else if (anyChart.CorePlacements && typeof anyChart.CorePlacements === 'object') {
              const placements = anyChart.CorePlacements;
              const planets = Object.keys(placements)
                .map((key) => {
                  const p = placements[key];
                  if (!p || typeof p !== 'object') return null;
                  return {
                    name: p.Name || key,
                    sign: p.Sign,
                    degree: typeof p.Degree === 'number' ? p.Degree : 0,
                  };
                })
                .filter(Boolean) as any[];
              setNatalChartPlanets(planets);
            } else {
              const chartPlanets = getPlanetArray(anyChart);
              setNatalChartPlanets(chartPlanets);
            }
          } catch (e) {
            logError('[VIEW-PROFILE] Error parsing chart', 'Error', e);
            setNatalChartPlanets([]);
          }
        } else if (user?.birth_date && user?.birth_location) {
          // As a fallback, attempt generation if they have birth data (non-blocking, best-effort)
          try {
            const chart = await NatalChartService.generateNatalChart({
              date: user.birth_date,
              time: user.birth_time || '',
              location: user.birth_location,
            });
            if (!mounted) return;
            setNatalChartPlanets(chart.planets || []);
          } catch (e) {
            logError('[VIEW-PROFILE] Chart generation failed', 'Error', e);
          }
        }
      } catch (e) {
        logError('[VIEW-PROFILE] Fetch error', 'Error', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [otherUserId]);

  // Prepare questionnaire data for display
  const questionnaireData = useMemo(() => {
    const qr = (userData?.questionnaire_responses || []) as any;
    return Array.isArray(qr)
      ? qr
          .map((response: any) => {
            if (response?.questionText && response?.response) {
              return {
                question: response.questionText,
                answer: responseLabels[String(response.response)] || `Response: ${response.response}`,
                group: response.group || '',
              };
            } else if (response?.question && response?.answer) {
              return { question: response.question, answer: response.answer, group: '' };
            }
            return null;
          })
          .filter(Boolean)
      : [];
  }, [userData?.questionnaire_responses]);

  const [questionnairePage, setQuestionnairePage] = useState(1);
  const itemsPerPageQuestionnaire = 3;
  const totalQuestionnairePages = Math.max(1, Math.ceil((questionnaireData?.length || 0) / itemsPerPageQuestionnaire));
  const currentPageItems = (questionnaireData || []).slice(
    (questionnairePage - 1) * itemsPerPageQuestionnaire,
    questionnairePage * itemsPerPageQuestionnaire
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BLACK_CARD} />
      <View style={styles.container}>
        <View style={styles.blackBackground}>
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            {/* Back to Chat header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  if (originatingConversationId) {
                    try { router.replace(`/conversation?conversationId=${encodeURIComponent(originatingConversationId)}` as any); } catch { router.back(); }
                  } else {
                    try { router.back(); } catch {}
                  }
                }}
                accessibilityLabel="Back to chat"
              >
                <ChevronLeft size={20} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Back to Chat</Text>
            </View>
            <ProfileInfoCard
              profile={profile}
              userData={userData}
              natalChartPlanets={natalChartPlanets}
              onPhotoUpload={() => {}}
              isUploadingPhoto={false}
              hidePhotoUploadButton
              hideBackButton
              titleText={profile?.display_name ? `${profile.display_name}` : 'Profile'}
              subtitleText={'View profile details and natal chart'}
            />

            <View style={styles.questionnaireCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Their Questionnaire</Text>
                {questionnaireData?.length > 0 && (
                  <View style={styles.headerRight}>
                    <Text style={styles.pageBadge}>Total {questionnaireData.length}</Text>
                    <Text style={styles.pageText}>Page {questionnairePage} / {totalQuestionnairePages}</Text>
                  </View>
                )}
              </View>
              {currentPageItems?.length > 0 ? (
                currentPageItems.map((response: any, index: number) => (
                  <View key={index} style={styles.qaBlock}>
                    <View style={styles.qaHeader}>
                      <Text style={styles.qaIndex}>Question {((questionnairePage - 1) * itemsPerPageQuestionnaire) + index + 1}</Text>
                      {response.group ? (
                        <Text style={styles.qaGroup}>{groupLabels[response.group] || response.group}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.qaQuestion}>{response.question}</Text>
                    <Text style={styles.qaAnswer}>{response.answer}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No questionnaire responses available</Text>
              )}
              {questionnaireData?.length > itemsPerPageQuestionnaire && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.chevronButton, questionnairePage === 1 && styles.disabledChevron]}
                    onPress={() => setQuestionnairePage(Math.max(1, questionnairePage - 1))}
                    disabled={questionnairePage === 1}
                    accessibilityLabel="Previous page"
                  >
                    <ChevronLeft size={20} color={questionnairePage === 1 ? '#ccc' : COLORS.DARK_TEXT} />
                  </TouchableOpacity>
                  <Text style={styles.paginationText}>Page {questionnairePage} of {totalQuestionnairePages}</Text>
                  <TouchableOpacity
                    style={[styles.chevronButton, questionnairePage === totalQuestionnairePages && styles.disabledChevron]}
                    onPress={() => setQuestionnairePage(Math.min(totalQuestionnairePages, questionnairePage + 1))}
                    disabled={questionnairePage === totalQuestionnairePages}
                    accessibilityLabel="Next page"
                  >
                    <ChevronRight size={20} color={questionnairePage === totalQuestionnairePages ? '#ccc' : COLORS.DARK_TEXT} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.BLACK_CARD },
  container: { flex: 1 },
  blackBackground: { flex: 1, backgroundColor: COLORS.BLACK_CARD },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 32, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    marginRight: 8,
  },
  headerTitle: { ...TEXT_STYLES.BODY_SMALL_MEDIUM, color: COLORS.CARD_BLACK_TEXT },

  questionnaireCard: {
    backgroundColor: COLORS.WHITE_CARD,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { ...TEXT_STYLES.HEADING_SMALL, color: COLORS.DARK_TEXT },
  pageBadge: {
    ...TEXT_STYLES.CAPTION_MEDIUM,
    color: COLORS.SECONDARY_TEXT,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageText: { ...TEXT_STYLES.CAPTION_MEDIUM, color: COLORS.SECONDARY_TEXT },
  qaBlock: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  qaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  qaIndex: { ...TEXT_STYLES.CAPTION_MEDIUM, color: '#6b7280' },
  qaGroup: {
    ...TEXT_STYLES.CAPTION_MEDIUM,
    color: COLORS.DARK_TEXT,
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'black',
    overflow: 'hidden',
  },
  qaQuestion: { ...TEXT_STYLES.BODY_SMALL, marginBottom: 6, color: COLORS.DARK_TEXT },
  qaAnswer: {
    ...TEXT_STYLES.BODY_SMALL_MEDIUM,
    color: '#2563eb',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  noDataText: { ...TEXT_STYLES.BODY_SMALL, color: '#999', fontStyle: 'italic', textAlign: 'center' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  chevronButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledChevron: {
    opacity: 0.5,
    backgroundColor: COLORS.LIGHT_INTERACTIVE_BG,
  },
  paginationText: {
    ...TEXT_STYLES.BODY_SMALL,
    color: COLORS.SECONDARY_TEXT,
  },
});
