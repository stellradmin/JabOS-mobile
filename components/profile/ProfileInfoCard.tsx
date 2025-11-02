import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { ArrowLeft, Camera, Radius, ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { WHITE_CARD_STYLES, COLORS } from '../../constants/theme';
import { useAuth } from "../../src/contexts/AuthContext";
import { resolveFirstName, resolveInitial } from "../../src/utils/displayName";
import PlanetIcon from '../PlanetIcon';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../../src/utils/logger";
import { calculateAgeFromBirthDate } from "../../src/utils/birthDateValidation";
import { usePremium } from '../../src/hooks/usePremium';

interface ProfileInfoCardProps {
  profile: any;
  userData: any;
  natalChartPlanets: any[];
  onPhotoUpload: () => void;
  isUploadingPhoto: boolean;
  hidePhotoUploadButton?: boolean;
  titleText?: string;
  subtitleText?: string;
  hideBackButton?: boolean;
}

const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  profile,
  userData,
  natalChartPlanets,
  onPhotoUpload,
  isUploadingPhoto,
  hidePhotoUploadButton,
  titleText,
  subtitleText,
  hideBackButton,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, loading: premiumLoading } = usePremium();
  const displayName = resolveFirstName(profile, user, userData);
  const displayInitial = resolveInitial(profile, user, userData);
  const resolvedAge = React.useMemo(() => {
    if (userData?.birth_date) {
      const { age } = calculateAgeFromBirthDate(userData.birth_date);
      if (typeof age === 'number') {
        return age;
      }
    }
    return typeof profile?.age === 'number' ? profile.age : null;
  }, [userData?.birth_date, profile?.age]);
  
  // Pagination state for natal chart
  const [currentPage, setCurrentPage] = React.useState(0);
  const planetsPerPage = 3;

  // Get all planets with priority ordering
  const getAllPlanets = (planets: any[]) => {
    const priorityOrder = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const orderedPlanets: any[] = [];
    
    // First add planets in priority order
    priorityOrder.forEach(planetName => {
      const planet = planets.find(p => p.name === planetName);
      if (planet) {
        orderedPlanets.push(planet);
      }
    });
    
    // Then add any remaining planets not in priority list
    planets.forEach(planet => {
      if (!priorityOrder.includes(planet.name)) {
        orderedPlanets.push(planet);
      }
    });
    
    return orderedPlanets;
  };

  const allPlanets = getAllPlanets(natalChartPlanets);
  const totalPages = Math.ceil(allPlanets.length / planetsPerPage);
  const currentPagePlanets = allPlanets.slice(
    currentPage * planetsPerPage,
    (currentPage + 1) * planetsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Compress profile tags to maximum of 4
  const getCompressedTags = () => {
    const tags: string[] = [];
    
    if (profile?.gender) tags.push(profile.gender);
    if (typeof resolvedAge === 'number') tags.push(`Age ${resolvedAge}`);
    
    // Combine relationship status
    if (profile?.is_single !== null) {
      tags.push(profile?.is_single ? "Single" : "In Relationship");
    }
    
    // Combine children status
    if (profile?.has_kids !== null || profile?.wants_kids) {
      if (profile?.has_kids) {
        tags.push("Has Children");
      } else if (profile?.wants_kids === "Yes") {
        tags.push("Wants Children");
      } else {
        tags.push("No Children");
      }
    }
    
    return tags.slice(0, 4); // Limit to 4 tags max
  };

  const compressedTags = getCompressedTags();

  const handlePremiumPress = React.useCallback(() => {
    if (premiumLoading) {
      return;
    }

    if (isPremium) {
      router.push('/subscription-management' as any);
    } else {
      router.push('/paywall' as any);
    }
  }, [isPremium, premiumLoading, router]);

  return (
    <View 
      style={[
        styles.container,
        WHITE_CARD_STYLES,
        styles.topCardRounding,
        styles.noShadow, // Remove drop shadow on top card
      ]}
    >
      {/* Header - matching messages screen */}
      <View style={styles.header}>
        {!hideBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={COLORS.DARK_TEXT} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.premiumIconButton,
          styles.premiumIconButtonFloating,
          premiumLoading && styles.premiumIconButtonDisabled,
        ]}
        onPress={handlePremiumPress}
        activeOpacity={0.8}
        disabled={premiumLoading}
        accessibilityLabel={isPremium ? 'Manage subscription' : 'Upgrade to premium'}
      >
        <Star
          size={18}
          color={isPremium ? '#D4AF37' : COLORS.DARK_TEXT}
          strokeWidth={isPremium ? 1.6 : 2}
          fill={isPremium ? '#FDF4BF' : 'none'}
        />
      </TouchableOpacity>

      {/* Title Section - matching messages screen */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{titleText || 'Profile'}</Text>
        <Text style={styles.subtitle}>{subtitleText || 'Manage your information and preferences'}</Text>
      </View>

      {/* User Profile Section */}
      <View style={styles.userInfoContainer}>
        <View style={styles.profilePictureContainer}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url || userData?.photo_url ? (
              <Image 
                source={{ uri: profile?.avatar_url || userData?.photo_url }} 
                style={styles.avatarImage}
                onError={() => logDebug('Failed to load profile image', "Debug")}
              />
            ) : (
              <Text style={styles.avatarText}>
                {displayInitial}
              </Text>
            )}
          </View>
          {!hidePhotoUploadButton && (
            <TouchableOpacity 
              style={[styles.cameraButton, isUploadingPhoto && styles.cameraButtonDisabled]} 
              onPress={onPhotoUpload}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color="black" />
              ) : (
                <Camera size={16} color="black" />
              )}
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{displayName}</Text>
          
          {/* Compressed Tags */}
          <View style={styles.tagsContainer}>
            {compressedTags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Compressed Natal Chart Section */}
      <View style={styles.natalChartSection}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderLeft}>
            <View style={styles.iconCircle}>
              <Radius size={16} color="black" />
            </View>
            <Text style={styles.chartTitle}>Natal Chart</Text>
          </View>
          <View style={styles.paginationControls}>
            <TouchableOpacity 
              style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
              onPress={handlePrevPage}
              disabled={currentPage === 0}
            >
              <ChevronLeft size={16} color={currentPage === 0 ? COLORS.SECONDARY_TEXT : COLORS.DARK_TEXT} />
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              {totalPages > 0 ? `${currentPage + 1} of ${totalPages}` : '0 of 0'}
            </Text>
            <TouchableOpacity 
              style={[styles.paginationButton, currentPage >= totalPages - 1 && styles.paginationButtonDisabled]}
              onPress={handleNextPage}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight size={16} color={currentPage >= totalPages - 1 ? COLORS.SECONDARY_TEXT : COLORS.DARK_TEXT} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.chartTable}>
          <View style={styles.chartTableHeader}>
            <View style={styles.planetHeaderCell}>
              <Text style={styles.chartHeaderText}>PLANET</Text>
            </View>
            <View style={styles.signHeaderCell}>
              <Text style={styles.chartHeaderText}>SIGN</Text>
            </View>
            <View style={styles.degreeHeaderCell}>
              <Text style={styles.chartHeaderText}>DEGREE</Text>
            </View>
          </View>

          {currentPagePlanets.length > 0 ? (
            currentPagePlanets.map((planet, index) => (
              <View key={index} style={styles.chartRow}>
                <View style={styles.chartCell}>
                  <PlanetIcon planetName={planet.name} size={16} />
                  <Text style={styles.chartCellText}>{planet.name}</Text>
                </View>
                <View style={styles.signCell}>
                  <Text style={styles.chartCellText}>{planet.sign}</Text>
                </View>
                <View style={styles.degreeCell}>
                  <Text style={styles.chartCellText}>{planet.degree.toFixed(1)}°</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.chartRow}>
              <View style={styles.noChartDataContainer}>
                <Text style={styles.noDataText}>No natal chart data available</Text>
              </View>
            </View>
          )}
        </View>
      </View>

    </View>
  );
};

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    height: screenHeight * 0.5 + 100, // Combined height matching messages screen
    paddingTop: 80, // Match messages screen padding
    paddingHorizontal: 20,
    paddingBottom: 24, // Increased to provide more spacing below natal chart
    marginHorizontal: 0,
    marginBottom: 0,
    justifyContent: 'flex-start',
  },
  topCardRounding: {
    borderTopLeftRadius: 0, // Square top corners for full width
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20, // Keep bottom corners rounded
    borderBottomRightRadius: 20,
  },
  noShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 16, // Match messages screen
    minHeight: 36,
  },
  backButton: {
    width: 36, // Keep size for touch target
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumIconButton: {
    minWidth: 36,
    minHeight: 36,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumIconButtonFloating: {
    position: 'absolute',
    top: 90,
    right: 20,
    width: 40,
    height: 40,
    zIndex: 2,
  },
  premiumIconButtonDisabled: {
    opacity: 0.6,
  },
  titleContainer: {
    marginBottom: 24, // Match messages screen
  },
  title: {
    fontSize: 32, // Match messages screen
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18, // Match messages screen
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 24,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  profilePictureContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#B8D4F1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraButtonDisabled: {
    opacity: 0.6,
    backgroundColor: "#f0f0f0",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: "#f5f5f5",
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tagText: {
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    color: COLORS.DARK_TEXT,
  },
  natalChartSection: {
    marginBottom: 24, // Further increased for better visual separation
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationButton: {
    width: 32, // Keep size for touch target
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  pageIndicator: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: COLORS.SECONDARY_TEXT,
    minWidth: 40,
    textAlign: 'center',
  },
  chartTable: {
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "white",
  },
  chartTableHeader: {
    flexDirection: "row",
    backgroundColor: "#B8D4F1",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "black",
  },
  chartHeaderText: {
    fontFamily: 'Geist-Regular',
    fontSize: 10,
    color: COLORS.DARK_TEXT,
  },
  chartRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
  },
  chartCell: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signCell: {
    flex: 2,
    alignItems: 'center',
  },
  degreeCell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  planetHeaderCell: {
    flex: 2,
  },
  signHeaderCell: {
    flex: 2,
    alignItems: 'center',
  },
  degreeHeaderCell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  chartCellText: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  noChartDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
  },
});

export default ProfileInfoCard;
