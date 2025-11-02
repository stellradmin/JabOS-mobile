import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { Heart, X, Eye, User, Star, ChevronLeft, ChevronRight } from 'lucide-react-native';
import PlanetIcon from './PlanetIcon';
import { getPlanetArray } from '../src/lib/natalChartService';
import { supabase } from '../src/lib/supabase';
import { COLORS } from '../constants/theme';
import { useDatingAppTracking } from '../src/hooks/usePerformanceMonitoring';
import { withMatchCardErrorBoundary } from '../src/components/MatchingErrorBoundaries';
import { useUIErrorRecovery } from '../src/hooks/useErrorRecovery';
import { logError as reportUIError } from '../src/services/error-monitoring-service';
import { useAccessibilityTimers } from '../src/hooks/useTimers';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import {
  createMatchAccessibilityLabel,
  createAccessibilityHint,
  createNavigationAnnouncement,
  createAccessibleButtonProps,
  ensureAccessibleTouchTarget,
  ACCESSIBILITY_CONSTANTS,
  ACCESSIBILITY_ROLES,
  announceToScreenReader,
  ImageAccessibility,
  createStateDescription,
} from '../src/utils/accessibility';

// Define match profile interface
export interface MatchProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  age?: number;
  interests?: string[];
  traits?: string[];
  has_kids?: boolean;
  wants_kids?: string;
  current_city?: string;
}

interface MatchCardProps {
  profile: MatchProfile;
  compatibilityScore?: number;
  astrologicalGrade?: string;
  questionnaireGrade?: string;
  onAccept: () => void;
  onPass: () => void;
  onViewCompatibility: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  style?: any;
  dateActivity?: string;
  zodiacSign?: string;
  currentMatchIndex?: number;
  totalMatches?: number;
}

const MatchCardBase: React.FC<MatchCardProps> = ({
  profile,
  compatibilityScore,
  astrologicalGrade,
  questionnaireGrade,
  onAccept,
  onPass,
  onViewCompatibility,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  style,
  dateActivity,
  zodiacSign,
  currentMatchIndex = 0,
  totalMatches = 1,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.9, 400);
  
  // Dynamic height calculation for responsive design
  // Ensures card fits on small screens while maintaining proportions
  const maxCardHeight = screenHeight * 0.8; // Max 80% of screen height
  const minCardHeight = 500; // Minimum height for content readability
  const dynamicCardHeight = Math.max(
    Math.min(maxCardHeight, 650), // Cap at reasonable max height
    minCardHeight
  );
  
  // Dynamic image height based on card size
  const imageHeight = Math.min(
    280, // Original height
    dynamicCardHeight * 0.4 // 40% of card height
  );
  const { trackMatchingAction } = useDatingAppTracking();
  const errorRecovery = useUIErrorRecovery();
  const { announceAfterDelay } = useAccessibilityTimers();
  
  // Accessibility refs for focus management
  const cardRef = useRef<any>(null);
  const acceptButtonRef = useRef<any>(null);
  const declineButtonRef = useRef<any>(null);
  const compatibilityButtonRef = useRef<any>(null);
  
  // Announce navigation changes for screen readers
  useEffect(() => {
    const navigationAnnouncement = createNavigationAnnouncement(
      currentMatchIndex,
      totalMatches,
      'potential match'
    );
    
    announceAfterDelay(() => {
      announceToScreenReader(
        `${navigationAnnouncement}. ${profile.display_name || 'Anonymous user'} profile loaded.`,
        'polite'
      );
    }, 500);
  }, [currentMatchIndex, totalMatches, profile.display_name, announceAfterDelay]);

  // Enhanced error tracking for UI interactions
  const handleTrackingError = useCallback((error: Error, action: string) => {
    reportUIError(error, { component: 'MatchCard', action });
    logWarn(`MatchCard tracking error for ${action}:`, "Warning", error);
  }, []);

  // Safe tracking wrapper
  const safeTrackMatchingAction = useCallback((action: string, profileId: string, metadata: any) => {
    try {
      const isMatchingAction = action === 'approve' || action === 'reject' || action === 'view_profile' || action === 'view_compatibility';
      if (isMatchingAction) {
        trackMatchingAction(action as 'approve' | 'reject' | 'view_profile' | 'view_compatibility', profileId, metadata);
      }
    } catch (error) {
      handleTrackingError(error as Error, action);
    }
  }, [trackMatchingAction, handleTrackingError]);

  // UI toggle: main match vs. details
  const [activeTab, setActiveTab] = React.useState<'match' | 'details'>('match');
  // Abbreviated natal chart for the presented match
  const [matchPlanets, setMatchPlanets] = React.useState<any[]>([]);
  const [chartLoading, setChartLoading] = React.useState(false);
  const [chartPage, setChartPage] = React.useState(0);
  const planetsPerPage = 3;

  // Load natal chart on demand when switching to details
  useEffect(() => {
    if (activeTab !== 'details') return;
    let cancelled = false;
    (async () => {
      try {
        setChartLoading(true);
        const { data } = await supabase
          .from('profiles')
          .select('natal_chart_data')
          .eq('id', profile.id)
          .maybeSingle();
        if (!cancelled && data?.natal_chart_data) {
          try {
            const anyChart: any = data.natal_chart_data;
            if (anyChart?.chartData && Array.isArray(anyChart.chartData.planets)) {
              setMatchPlanets(anyChart.chartData.planets as any[]);
            } else if (anyChart?.corePlacements && typeof anyChart.corePlacements === 'object') {
              const placements = anyChart.corePlacements;
              const planets = Object.keys(placements)
                .map((key) => {
                  const p = placements[key];
                  if (!p || typeof p !== 'object') return null;
                  return { name: p.Name || key, sign: p.Sign, degree: typeof p.Degree === 'number' ? p.Degree : 0 };
                })
                .filter(Boolean) as any[];
              setMatchPlanets(planets);
            } else if (anyChart?.CorePlacements && typeof anyChart.CorePlacements === 'object') {
              const placements = anyChart.CorePlacements;
              const planets = Object.keys(placements)
                .map((key) => {
                  const p = placements[key];
                  if (!p || typeof p !== 'object') return null;
                  return { name: p.Name || key, sign: p.Sign, degree: typeof p.Degree === 'number' ? p.Degree : 0 };
                })
                .filter(Boolean) as any[];
              setMatchPlanets(planets);
            } else {
              const planets = getPlanetArray(anyChart);
              setMatchPlanets(Array.isArray(planets) ? planets : []);
            }
          } catch {
            setMatchPlanets([]);
          }
        }
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, profile.id]);

  const orderedPlanets = React.useMemo(() => {
    const priority = ['Sun', 'Moon', 'Ascendant', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const result: any[] = [];
    priority.forEach(n => {
      const p = matchPlanets.find((x: any) => x.name === n);
      if (p) result.push(p);
    });
    matchPlanets.forEach((p: any) => { if (!result.includes(p)) result.push(p); });
    return result;
  }, [matchPlanets]);
  const totalChartPages = Math.ceil(Math.max(orderedPlanets.length, 1) / planetsPerPage);
  const pagePlanets = orderedPlanets.slice(chartPage * planetsPerPage, (chartPage + 1) * planetsPerPage);


  return (
    <View style={[
      styles.container, 
      { 
        width: cardWidth, 
        height: dynamicCardHeight,
        maxHeight: maxCardHeight 
      }, 
      style
    ]}>
      {/* Navigation Header */}
      <View 
        style={styles.navigationHeader}
        accessibilityLabel="Match navigation controls"
      >
        <TouchableOpacity
          onPress={() => {
            onPrevious?.();
            announceToScreenReader('Moved to previous match', 'polite');
          }}
          disabled={!hasPrevious}
          style={[
            styles.circularNavButton,
            !hasPrevious && styles.circularNavButtonDisabled
          ]}
          {...createAccessibleButtonProps(
            'Previous match',
            hasPrevious ? 'Go to previous potential match' : 'No previous matches available',
            ACCESSIBILITY_ROLES.NAVIGATION_BUTTON,
            createStateDescription(false, !hasPrevious)
          )}
        >
          <ChevronLeft 
            size={20} 
            color={!hasPrevious ? "#999" : "#000"} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            onNext?.();
            announceToScreenReader('Moved to next match', 'polite');
          }}
          disabled={!hasNext}
          style={[
            styles.circularNavButton,
            !hasNext && styles.circularNavButtonDisabled
          ]}
          {...createAccessibleButtonProps(
            'Next match',
            hasNext ? 'Go to next potential match' : 'No more matches available',
            ACCESSIBILITY_ROLES.NAVIGATION_BUTTON,
            createStateDescription(false, !hasNext)
          )}
        >
          <ChevronRight 
            size={20} 
            color={!hasNext ? "#999" : "#000"} 
          />
        </TouchableOpacity>
      </View>

      {/* Top Strip with Date Details */}
      <View 
        style={styles.topStrip}
        accessibilityRole="text"
        accessibilityLabel={`Date context: ${zodiacSign || 'Unknown sign'} compatibility for ${dateActivity || 'dinner'} date`}
      >
        <Text 
          style={styles.dateHeaderText}
          accessibilityRole="text"
          accessibilityLabel={`Zodiac sign: ${zodiacSign || 'Unknown sign'}`}
        >
          {zodiacSign || 'Unknown Sign'}
        </Text>
        <Text 
          style={styles.zodiacSubheaderText}
          accessibilityRole="text"
          accessibilityLabel={`Date type: ${dateActivity || 'Dinner'} date`}
        >
          {`${dateActivity || 'Dinner'} Date`}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('match')}
          style={[styles.tabButton, activeTab === 'match' && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'match' }}
        >
          <Text style={[styles.tabText, activeTab === 'match' && styles.tabTextActive]}>Match</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('details')}
          style={[styles.tabButton, activeTab === 'details' && styles.tabButtonActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'details' }}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>
      </View>

      {/* Content Section */}
      <View 
        style={styles.contentSection}
        accessibilityLabel="Match profile content"
      >
        {activeTab === 'match' ? (
          <>
            {/* Responsive image region */}
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={[styles.profileImageSquare, { height: imageHeight }]}
                accessibilityRole={ACCESSIBILITY_ROLES.PROFILE_IMAGE}
                accessibilityLabel={ImageAccessibility.createProfileImageAlt(profile.display_name ?? undefined, true)}
                accessible={true}
              />
            ) : (
              <View 
                style={[styles.profileImagePlaceholderSquare, { height: imageHeight }]}
                accessibilityRole={ACCESSIBILITY_ROLES.PROFILE_IMAGE}
                accessibilityLabel={ImageAccessibility.createProfileImageAlt(profile.display_name ?? undefined, false)}
                accessible={true}
              >
                <User size={Math.min(80, imageHeight * 0.3)} color="#666" />
              </View>
            )}

            {/* Meet User Text */}
            <Text 
              style={styles.meetUserText}
              accessibilityRole="header"
              accessibilityLabel={`Meet ${profile.display_name || 'Anonymous User'}${profile.age ? `, age ${profile.age}` : ''}`}
              accessible={true}
            >
              Meet {profile.display_name || 'Anonymous User'}
            </Text>

            {/* Compatibility Scores Display */}
            {(compatibilityScore || astrologicalGrade || questionnaireGrade) && (
              <View style={styles.compatibilitySection}>
                <Text style={styles.compatibilityTitle}>Compatibility</Text>
                
                <View style={styles.compatibilityScoresContainer}>
                  {/* Overall Score */}
                  {compatibilityScore && (
                    <View style={styles.compatibilityScoreBox}>
                      <Text style={styles.compatibilityScoreLabel}>Overall</Text>
                      <Text style={styles.compatibilityScoreValue}>{compatibilityScore}%</Text>
                    </View>
                  )}
                  
                  {/* Astrological Grade */}
                  {astrologicalGrade && (
                    <View style={styles.compatibilityScoreBox}>
                      <Text style={styles.compatibilityScoreLabel}>Astrology</Text>
                      <Text style={styles.compatibilityGradeValue}>{astrologicalGrade}</Text>
                    </View>
                  )}
                  
                  {/* Questionnaire Grade */}
                  {questionnaireGrade && (
                    <View style={styles.compatibilityScoreBox}>
                      <Text style={styles.compatibilityScoreLabel}>Values</Text>
                      <Text style={styles.compatibilityGradeValue}>{questionnaireGrade}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Circular Action Buttons */}
            <View 
              style={styles.circularButtonsContainer}
              accessibilityLabel="Match decision buttons"
            >
              <TouchableOpacity
                ref={declineButtonRef}
                onPress={() => {
                  safeTrackMatchingAction('reject', profile.id, {
                    source: 'discover',
                    date_activity: dateActivity,
                    zodiac_sign: zodiacSign,
                    astrological_grade: astrologicalGrade,
                    questionnaire_grade: questionnaireGrade,
                    compatibility_score: compatibilityScore,
                    match_index: currentMatchIndex,
                    total_matches: totalMatches
                  });
                  announceToScreenReader(
                    `Declined match with ${profile.display_name || 'this person'}`,
                    'assertive'
                  );
                  onPass();
                }}
                style={[styles.circularDeclineButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
                {...createAccessibleButtonProps(
                  createMatchAccessibilityLabel('decline', profile.display_name ?? undefined, compatibilityScore, dateActivity),
                  createAccessibilityHint('double_tap'),
                  ACCESSIBILITY_ROLES.ACTION_BUTTON
                )}
              >
                <X size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                ref={compatibilityButtonRef}
                onPress={() => {
                  safeTrackMatchingAction('view_compatibility', profile.id, {
                    compatibility_scores: {
                      overallScore: compatibilityScore,
                      questionnaireGrade: questionnaireGrade,
                      astrologicalGrade: astrologicalGrade
                    },
                    source: 'match_card',
                    date_activity: dateActivity,
                    zodiac_sign: zodiacSign
                  });
                  announceToScreenReader(
                    `Opening compatibility details for ${profile.display_name || 'this person'}`,
                    'assertive'
                  );
                  onViewCompatibility();
                }}
                style={[styles.circularCompatibilityButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
                {...createAccessibleButtonProps(
                  createMatchAccessibilityLabel('view_compatibility', profile.display_name ?? undefined, compatibilityScore),
                  createAccessibilityHint('double_tap'),
                  ACCESSIBILITY_ROLES.ACTION_BUTTON
                )}
              >
                <Eye size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                ref={acceptButtonRef}
                onPress={() => {
                  safeTrackMatchingAction('approve', profile.id, {
                    source: 'discover',
                    date_activity: dateActivity,
                    zodiac_sign: zodiacSign,
                    astrological_grade: astrologicalGrade,
                    questionnaire_grade: questionnaireGrade,
                    compatibility_score: compatibilityScore,
                    match_index: currentMatchIndex,
                    total_matches: totalMatches
                  });
                  announceToScreenReader(
                    `Accepted match with ${profile.display_name || 'this person'}`,
                    'assertive'
                  );
                  onAccept();
                }}
                style={[styles.circularAcceptButton, { minWidth: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET, minHeight: ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET }]}
                {...createAccessibleButtonProps(
                  createMatchAccessibilityLabel('accept', profile.display_name ?? undefined, compatibilityScore, dateActivity),
                  createAccessibilityHint('double_tap'),
                  ACCESSIBILITY_ROLES.ACTION_BUTTON
                )}
              >
              <Heart size={24} color="white" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Abbreviated natal chart */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsHeader}>Astrology</Text>
              <View style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                  <Text style={styles.chartHeaderCol}>Planet</Text>
                  <Text style={styles.chartHeaderCol}>Sign</Text>
                  <Text style={styles.chartHeaderCol}>Degree</Text>
                </View>
                {chartLoading ? (
                  <View style={styles.chartRow}><Text style={styles.chartCellMuted}>Loading chart…</Text></View>
                ) : pagePlanets.length > 0 ? (
                  pagePlanets.map((p, idx) => (
                    <View key={idx} style={styles.chartRow}>
                      <View style={styles.chartCellPlanet}><PlanetIcon planetName={p.name} size={14} /><Text style={styles.chartCellText}>{p.name}</Text></View>
                      <Text style={styles.chartCellText}>{p.sign || '-'}</Text>
                      <Text style={styles.chartCellText}>{typeof p.degree === 'number' ? `${p.degree.toFixed(1)}°` : '-'}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.chartRow}><Text style={styles.chartCellMuted}>No natal chart data</Text></View>
                )}
                <View style={styles.chartPager}>
                  <TouchableOpacity onPress={() => setChartPage(Math.max(0, chartPage - 1))} disabled={chartPage === 0} style={[styles.pagerBtn, chartPage===0&&styles.pagerBtnDisabled]}>
                    <ChevronLeft size={14} color={chartPage===0? '#999':'#000'} />
                  </TouchableOpacity>
                  <Text style={styles.pagerText}>{totalChartPages ? `${Math.min(chartPage+1,totalChartPages)} / ${totalChartPages}` : '0 / 0'}</Text>
                  <TouchableOpacity onPress={() => setChartPage(Math.min(totalChartPages-1, chartPage + 1))} disabled={chartPage >= totalChartPages - 1} style={[styles.pagerBtn, chartPage>=totalChartPages-1&&styles.pagerBtnDisabled]}>
                    <ChevronRight size={14} color={chartPage>=totalChartPages-1? '#999':'#000'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Compatibility under chart */}
            {(compatibilityScore || astrologicalGrade || questionnaireGrade) && (
              <View style={styles.compatibilitySection}>
                <Text style={styles.compatibilityTitle}>Compatibility</Text>
                <View style={styles.compatibilityScoresContainer}>
                  {compatibilityScore && (
                    <View style={styles.compatibilityScoreBox}>
                      <Text style={styles.compatibilityScoreLabel}>Overall</Text>
                      <Text style={styles.compatibilityScoreValue}>{compatibilityScore}%</Text>
                    </View>
                  )}
                  {astrologicalGrade && (
                    <View style={styles.compatibilityScoreBox}>
                      <Text style={styles.compatibilityScoreLabel}>Astrology</Text>
                      <Text style={styles.compatibilityGradeValue}>{astrologicalGrade}</Text>
                    </View>
                  )}
                  {questionnaireGrade && (
                    <View style={styles.compatibilityScoreBox}>
                      <Text style={styles.compatibilityScoreLabel}>Questionnaire</Text>
                      <Text style={styles.compatibilityGradeValue}>{questionnaireGrade}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Removed fixed minHeight - now uses dynamic height calculation
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    alignSelf: 'center',
    // Enable flex to properly distribute content
    display: 'flex',
    flexDirection: 'column',
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  circularNavButton: {
    width: Math.max(32, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    height: Math.max(32, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    borderRadius: Math.max(16, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET / 2),
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    // Enhanced focus indicator for keyboard navigation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  circularNavButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  topStrip: {
    backgroundColor: '#B8D4F1', // Baby blue matching onboarding cards
    borderTopWidth: 2,
    borderTopColor: 'black',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  dateHeaderText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: '#666',
    textAlign: 'left',
  },
  zodiacSubheaderText: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: '#000',
    textAlign: 'left',
    marginTop: 4,
  },
  meetUserText: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE_CARD,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.BORDER_PRIMARY,
  },
  tabButton: {
    flex: 1,
    backgroundColor: COLORS.WHITE_CARD,
    borderWidth: 2,
    borderColor: COLORS.BORDER_PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.BORDER_PRIMARY,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  tabTextActive: {
    color: COLORS.CARD_WHITE_TEXT,
  },
  contentSection: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 40,
  },
  // Details section with chart
  detailsSection: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  detailsHeader: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  chartCard: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER_PRIMARY,
    padding: 12,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.CARD_BORDER,
    marginBottom: 6,
  },
  chartHeaderCol: {
    width: '33.33%',
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  chartCellPlanet: {
    width: '33.33%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chartCellText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  chartCellMuted: {
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
  chartPager: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  pagerBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.BORDER_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE_CARD,
  },
  pagerBtnDisabled: {
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderColor: COLORS.CARD_BORDER,
  },
  pagerText: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  profileImageSquare: {
    width: '100%',
    // Height now set dynamically via style prop
    marginBottom: 16,
    backgroundColor: '#f3f4f6',
    resizeMode: 'cover', // Ensure proper image scaling
  },
  profileImagePlaceholderSquare: {
    width: '100%',
    // Height now set dynamically via style prop
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  age: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  circularButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 'auto',
    paddingBottom: 20,
  },
  circularDeclineButton: {
    width: Math.max(60, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    height: Math.max(60, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    borderRadius: Math.max(30, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET / 2),
    backgroundColor: '#dc2626', // Enhanced red for better contrast
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    // Focus indicator
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circularCompatibilityButton: {
    width: Math.max(60, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    height: Math.max(60, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    borderRadius: Math.max(30, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET / 2),
    backgroundColor: '#1f2937', // Improved black for better contrast
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    // Focus indicator
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circularAcceptButton: {
    width: Math.max(60, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    height: Math.max(60, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET),
    borderRadius: Math.max(30, ACCESSIBILITY_CONSTANTS.MIN_TOUCH_TARGET / 2),
    backgroundColor: '#16a34a', // Enhanced green for better contrast
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    // Focus indicator
    borderWidth: 2,
    borderColor: 'transparent',
  },
  compatibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compatibilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginLeft: 4,
  },
  detailsContainer: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  tagText: {
    color: '#374151',
    fontWeight: '500',
    fontSize: 14,
  },
  detailsBio: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
  },
  bottomNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 0,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginHorizontal: 4,
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  // Compatibility section styles
  compatibilitySection: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  compatibilityTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  compatibilityScoresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 12,
  },
  compatibilityScoreBox: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compatibilityScoreLabel: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  compatibilityScoreValue: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: '#16a34a', // Green for percentages
    textAlign: 'center',
  },
  compatibilityGradeValue: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: '#1f2937', // Dark gray for letter grades
    textAlign: 'center',
  },
});

// Export the component wrapped with error boundary
const MatchCard = withMatchCardErrorBoundary(MatchCardBase);

export default MatchCard;
