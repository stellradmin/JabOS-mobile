import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { uploadProfilePhoto } from "../../src/services/photo-upload-service";
import { NatalChartService, getPlanetArray } from "../../src/lib/natalChartService";
import { supabase } from "../../src/lib/supabase";
import ProfileInfoCard from '../../components/profile/ProfileInfoCard';
import ProfileActionsCard from '../../components/profile/ProfileActionsCard';
import PhotoEditTray from '../../components/PhotoEditTray';
import QuestionnaireTray from '../../components/QuestionnaireTray';
import { COLORS } from '../../constants/theme';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";
import AnimatedTabScreenContainer from '../../components/navigation/AnimatedTabScreenContainer';

export default function Profile() {
  const router = useRouter();
  const { profile, userData, refetchProfile } = useAuth();

  const [natalChartPlanets, setNatalChartPlanets] = useState<any[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPhotoEditTrayVisible, setIsPhotoEditTrayVisible] = useState(false);
  const [isQuestionnaireTrayVisible, setIsQuestionnaireTrayVisible] = useState(false);
  const hydrationAttemptedRef = useRef(false);

  useEffect(() => {
    refetchProfile();
  }, []);

  // Photo upload function
  const handlePhotoUpload = async () => {
    if (!userData?.id) {
      Alert.alert("Error", "User not found. Please try again.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const result = await uploadProfilePhoto(userData.id);
      
      if (result.success) {
        Alert.alert("Success", "Photo uploaded successfully!");
        // Refresh profile to show new photo
        await refetchProfile();
      } else {
        Alert.alert("Upload Failed", result.error || "Failed to upload photo. Please try again.");
      }
    } catch (error) {
      logError("Photo upload error:", "Error", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    // Prefer users.natal_chart_data, but fall back to profiles.natal_chart_data if users is empty/null
    const sourceChart: any = (userData?.natal_chart_data ?? (profile as any)?.natal_chart_data) as any;
    const isEmptyObject = (obj: any) => obj && typeof obj === 'object' && Object.keys(obj).length === 0;

    // Extract natal chart planets from either frontend-typed chart or lib-compatible chart
    if (sourceChart && !isEmptyObject(sourceChart)) {
      try {
        const anyChart: any = sourceChart;
        logDebug('[PROFILE] Natal chart data present on user. Keys:', "Debug", Object.keys(anyChart || {}));
        if (anyChart.chartData && Array.isArray(anyChart.chartData.planets)) {
          // Newer profile schema stores planets under chartData
          setNatalChartPlanets(anyChart.chartData.planets);
        } else if (anyChart.corePlacements && typeof anyChart.corePlacements === 'object') {
          // Unified service v2.0 shape: { corePlacements: { Sun: { Sign, Degree, ... }, ... } }
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
            .filter(Boolean);
          setNatalChartPlanets(planets);
        } else if (anyChart.CorePlacements && typeof anyChart.CorePlacements === 'object') {
          // Defensive: handle capitalized CorePlacements if present
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
            .filter(Boolean);
          setNatalChartPlanets(planets);
        } else {
          // Fallback to library shape
          const chartPlanets = getPlanetArray(anyChart);
          setNatalChartPlanets(chartPlanets);
        }
      } catch (error) {
        logError('Error processing natal chart data:', "Error", error);
        setNatalChartPlanets([]);
      }
    }
  }, [userData, profile]);

  // Ultimate fallback: if no chart stored but we have birth data, compute accurately and persist
  useEffect(() => {
    const hasUsersChart = !!userData?.natal_chart_data && !(typeof userData?.natal_chart_data === 'object' && Object.keys(userData?.natal_chart_data as any).length === 0);
    const needHydration = !hasUsersChart && userData?.birth_date && userData?.birth_location;
    if (!needHydration || hydrationAttemptedRef.current) return;

    hydrationAttemptedRef.current = true;

    (async () => {
      try {
        logDebug('[PROFILE] Hydration: attempting accurate chart generation from birth data', "Debug", {
          hasDate: !!userData?.birth_date,
          hasTime: !!userData?.birth_time,
          hasLocation: !!userData?.birth_location,
        });

        const chart = await NatalChartService.generateNatalChart({
          date: userData!.birth_date as string,
          time: userData!.birth_time || '',
          location: userData!.birth_location as string,
        });

        // Update UI immediately
        setNatalChartPlanets(chart.planets || []);
        logDebug('[PROFILE] Hydration: chart generated. Planet count:', "Debug", chart.planets?.length || 0);

        // Persist minimal shape to users.natal_chart_data for future loads
        const storageShape = {
          chartData: { planets: chart.planets || [] },
          meta: {
            calculatedAt: new Date().toISOString(),
            source: 'calculate-natal-chart',
            version: 'ui-1',
          },
        };

        if (userData?.id) {
          const { error } = await supabase
            .from('users')
            .update({
              natal_chart_data: storageShape,
              sun_sign: chart.sunSign,
              moon_sign: chart.moonSign,
              rising_sign: chart.risingSign,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userData.id);

          if (error) {
            logWarn('[PROFILE] Hydration: failed to persist natal_chart_data to users table', "Warning", error);
          } else {
            logDebug('[PROFILE] Hydration: persisted natal_chart_data to users table', "Debug");
          }
        }
      } catch (err) {
        logError('[PROFILE] Hydration: chart generation failed', "Error", err);
      }
    })();
  }, [userData]);

  const handleEditPhoto = () => {
    setIsPhotoEditTrayVisible(true);
  };

  const handleViewQuestionnaire = () => {
    setIsQuestionnaireTrayVisible(true);
  };

  const handlePhotoUpdated = () => {
    refetchProfile();
  };

  return (
    <AnimatedTabScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.WHITE_CARD} translucent={false} />
        <View style={styles.container}>
          <View style={styles.blackBackground}>
            <View style={styles.scrollContainer}>
              {/* Block 1: Main Profile Info Card */}
              <ProfileInfoCard 
                profile={profile}
                userData={userData}
                natalChartPlanets={natalChartPlanets}
                onPhotoUpload={handlePhotoUpload}
                isUploadingPhoto={isUploadingPhoto}
              />

              {/* Block 2: Profile Actions Card */}
              <ProfileActionsCard
                onEditPhoto={handleEditPhoto}
                onViewQuestionnaire={handleViewQuestionnaire}
              />
            </View>
          </View>
        </View>

        {/* Photo Edit Tray */}
        <PhotoEditTray
          isVisible={isPhotoEditTrayVisible}
          onClose={() => setIsPhotoEditTrayVisible(false)}
          userData={userData}
          profile={profile}
          onPhotoUpdated={handlePhotoUpdated}
        />

        {/* Questionnaire Tray */}
        <QuestionnaireTray
          isVisible={isQuestionnaireTrayVisible}
          onClose={() => setIsQuestionnaireTrayVisible(false)}
          userData={userData}
        />
      </SafeAreaView>
    </AnimatedTabScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.WHITE_CARD, // Keep status bar white
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD, // Ensure area beneath content is black
  },
  blackBackground: {
    flex: 1,
    backgroundColor: COLORS.BLACK_CARD, // Black background matching navigation
  },
  scrollContainer: {
    flex: 1,
    paddingTop: 0, // No extra padding since ProfileInfoCard handles its own spacing
    paddingBottom: 20, // Minimal padding since tab navigation handles the nav bar
    gap: 6, // 6px gap between blocks matching dashboard
  },
});
