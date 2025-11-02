import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronDown, HeartHandshake, UserCheck } from "lucide-react-native";
import PopUpTray from "../components/PopUpTray";
import HorizontalCardCarousel from "../components/HorizontalCardCarousel";
import MatchReceptionContent, { PotentialMatchProfile } from "../components/MatchReceptionContent";
import LoadingProgress from "../components/LoadingProgress";
import MatchLimitModal from "../components/MatchLimitModal";
import { supabase } from "../src/lib/supabase"; // Corrected path
import { useAuth } from "../src/contexts/AuthContext"; // Corrected path
import { useSubscription } from "../src/contexts/SubscriptionContext";
import { useSettings } from "../src/contexts/SettingsContext"; // Import settings for age/distance filters
import { getOfferings, purchasePackage, restorePurchases } from '../src/services/revenuecat-service';
// Type definition for packages (RevenueCat not installed for beta)
type PurchasesPackage = any;
import { MatchLimitsService } from "../src/services/match-limits-service";
import { RealCompatibilityService } from "../src/services/real-compatibility-service";
import { logger, logDebug, logError, logWarn, logInfo } from "../src/utils/logger";
// import { usePotentialMatch } from "../src/contexts/PotentialMatchContext"; // Temporarily disabled

const zodiacSigns = [
  "Any", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];
import { ACTIVITY_CARDS } from "../components/constants/dateNightCardData";
const dateTypes = ["Any", ...ACTIVITY_CARDS.map(a => a.name)];

// Helper function to convert compatibility scores to letter grades
const convertScoreToGrade = (score: number): string => {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  return 'D';
};

export default function DateNightScreen() {
  const router = useRouter();
  const [selectedSign, setSelectedSign] = useState("Any");
  const [selectedDateType, setSelectedDateType] = useState("Any");
  
  // Track selection state
  const bothSelected = selectedSign !== "Any" && selectedDateType !== "Any";
  logInfo('Date night preferences updated', 'DATE_NIGHT', { bothSelected, selectedSign, selectedDateType });
  
  const [isZodiacTrayVisible, setIsZodiacTrayVisible] = useState(false);
  const [isDateActivityTrayVisible, setIsDateActivityTrayVisible] = useState(false);
  const [isConfirmButtonPressed, setIsConfirmButtonPressed] = useState(false); // New state for button press

  const [isPaywallTrayVisible, setIsPaywallTrayVisible] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // New state for potential matches flow
  const [showingMatches, setShowingMatches] = useState(false);
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatchProfile[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [loadingMatches, setLoadingMatches] = useState(false);
  
  // State for limit modal
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalData, setLimitModalData] = useState<{
    type: 'active_matches' | 'hourly' | 'daily';
    message: string;
  }>({ type: 'daily', message: '' });
  
  // State to track pending match request after paywall
  const [pendingMatchRequest, setPendingMatchRequest] = useState<string | null>(null);


  const handleSignChange = (sign: string) => {
    setSelectedSign(sign);
    logInfo('Zodiac sign preference changed', 'DATE_NIGHT', { sign, dateType: selectedDateType });
    // setIsZodiacTrayVisible(false); // Closure handled by PopUpTray's onConfirm/onClose
  };

  const handleDateTypeChange = (type: string) => {
    setSelectedDateType(type);
    logInfo('Date type preference changed', 'DATE_NIGHT', { type, sign: selectedSign });
    // setIsDateActivityTrayVisible(false); // Closure handled by PopUpTray's onConfirm/onClose
  };

  const { user } = useAuth(); // Added useAuth
  const { checkAccess, loading: subscriptionLoading } = useSubscription();
  const { settings } = useSettings(); // Get user settings for age/distance filters
  // const { startFetchingPotentialMatches, isLoading: isPotentialMatchLoading } = usePotentialMatch(); // Temporarily disabled
  const isPotentialMatchLoading = false;

  const handleConfirmAndCreateMatch = async () => {
    logInfo('handleConfirmAndCreateMatch called', 'DATE_NIGHT', { hasUser: !!user, isPotentialMatchLoading, subscriptionLoading });
    
    if (!user || isPotentialMatchLoading || subscriptionLoading) {
      logger.warn('Match creation blocked - missing user or loading state', undefined, { hasUser: !!user, isPotentialMatchLoading, subscriptionLoading }, 'MATCHING');
      return;
    }

    // Check match limits first
    logInfo('Checking match limits', 'DATE_NIGHT');
    const { canCreate, message } = await MatchLimitsService.canCreateMatchRequest(user!.id);
    
    if (!canCreate) {
      logger.warn('Match limit reached in handleConfirmAndCreateMatch', undefined, { message, userId: user?.id }, 'MATCHING');
      
      // Determine limit type based on message content
      let limitType: 'active_matches' | 'hourly' | 'daily' = 'daily';
      if (message?.includes('active matches')) {
        limitType = 'active_matches';
      } else if (message?.includes('give us more time')) {
        limitType = 'hourly';
      }
      
      setLimitModalData({ type: limitType, message: message || 'Match limit reached' });
      setShowLimitModal(true);
      return;
    }

    // Allow users to explore potential matches without paywall check
    logInfo('Finding potential matches for user to explore', 'DATE_NIGHT');
    await findPotentialMatches();
  };

  const findPotentialMatches = async () => {
    logInfo('Starting findPotentialMatches function', 'DATE_NIGHT', { selectedSign, selectedDateType });
    setLoadingMatches(true);
    
    try {
      // Add a small delay to ensure loading screen is visible
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logInfo('Calling get-potential-matches-optimized Edge Function', 'DATE_NIGHT');
      
      // Call the actual Supabase Edge Function with proper query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('pageSize', '10');

      if (selectedSign !== "Any") {
        queryParams.append('zodiac_sign', selectedSign);
      }
      if (selectedDateType !== "Any") {
        queryParams.append('activity_type', selectedDateType);
      }

      // Add age range filters from user settings
      if (settings.minAge) {
        queryParams.append('min_age', settings.minAge.toString());
      }
      if (settings.maxAge) {
        queryParams.append('max_age', settings.maxAge.toString());
      }

      // Add distance filter from user settings (convert miles to km)
      if (settings.distance) {
        const distanceKm = Math.round(settings.distance * 1.609);
        queryParams.append('max_distance_km', distanceKm.toString());
      }

      logDebug('📡 Calling Edge Function with query params:', "Debug", queryParams.toString());
      
      // Create the URL with query parameters for GET request
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
      const url = new URL(`${baseUrl}/functions/v1/get-potential-matches-optimized`);
      queryParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
      
      // Get the auth session for authorization header
      const { data: sessionData } = await supabase.auth.getSession();
      logDebug('🔐 Session debug', 'DATE_NIGHT', {
        hasSession: !!sessionData.session,
        hasAccessToken: !!sessionData.session?.access_token,
      });
      
      let matchesData = null;
      let edgeFunctionWorked = false;
      
      const accessToken = sessionData.session?.access_token;
      logDebug('🔑 Using access token present', 'DATE_NIGHT', !!accessToken);
      
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          matchesData = await response.json();
          
          // Check if the response contains an error property
          if (!matchesData.error) {
            logDebug('✅ Successfully fetched potential matches:', "Debug", matchesData);
            edgeFunctionWorked = true;
          } else {
            logError('❌ Edge Function returned error:', "Error", matchesData.error);
          }
        } else {
          logError('❌ Edge Function HTTP error:', "Error", response.status);
        }
      } catch (fetchError) {
        logError('❌ Edge Function fetch failed:', "Error", fetchError);
      }
      
      // If we have matches from the Edge Function, use them
      if (edgeFunctionWorked && matchesData && Array.isArray(matchesData) && matchesData.length > 0) {
        logDebug('✅ Using matches from Edge Function:', "Debug", matchesData.length);
        const realMatches: PotentialMatchProfile[] = matchesData.map((match: any) => ({
          id: match.id,
          display_name: match.display_name || 'Unknown User',
          avatar_url: match.avatar_url,
          bio: match.bio || match.interests?.join(', ') || 'No bio available',
          zodiac_sign: match.zodiac_sign,
          // STANDARDIZED FALLBACK: 50 (neutral/unknown compatibility)
          compatibility_score: match.compatibility_score ?? 50,
          astrological_grade: match.astrological_grade || 'C',
          questionnaire_grade: match.questionnaire_grade || 'C',
          overall_score: match.overall_score ?? match.compatibility_score ?? 50,
          is_match_recommended: match.is_match_recommended ?? (match.compatibility_score >= 60)
        }));
        setPotentialMatches(realMatches);
        setCurrentMatchIndex(0);
        setShowingMatches(true);
        return;
      }
      
      // Fallback: For production, we'll use real data from Supabase directly as fallback
      logDebug('🔄 Attempting direct database query as fallback...', 'DATE_NIGHT');
      
      // Query profiles directly as fallback
      let directQuery = supabase
        .from('profiles')
        .select('id, display_name, avatar_url, zodiac_sign, gender, age, interests')
        .eq('onboarding_completed', true)
        .not('display_name', 'is', null)
        .not('zodiac_sign', 'is', null)
        .neq('id', user!.id) // Exclude current user
        .limit(5);

      // Apply filters if specified
      if (selectedSign !== "Any") {
        directQuery = directQuery.eq('zodiac_sign', selectedSign);
      }

      // Apply age range filters from settings
      if (settings.minAge) {
        directQuery = directQuery.gte('age', settings.minAge);
      }
      if (settings.maxAge) {
        directQuery = directQuery.lte('age', settings.maxAge);
      }
      
      const { data: directMatches, error: directError } = await directQuery;
      
      if (directError) {
        logError('❌ Direct query also failed:', "Error", directError);
        logDebug('❌ No matches available - all database queries failed', "Debug");
        alert('No potential matches found. Please try again later or adjust your preferences.');
        return;
      } else if (directMatches && directMatches.length > 0) {
        logDebug('✅ Direct query successful, "Debug", found real users:', directMatches.length);
        logDebug('🧮 Calculating real compatibility scores...', "Debug");
        
        // Use RealCompatibilityService to get matches with actual compatibility scores
        try {
          const filters = {
            ageRange: [settings.minAge || 18, settings.maxAge || 99] as [number, number],
            distanceRange: settings.distance || 50,
            zodiacSigns: selectedSign !== "Any" ? [selectedSign] : [],
            dateActivities: selectedDateType !== "Any" ? [selectedDateType] : []
          };
          
          const matchesWithCompatibility = await RealCompatibilityService.getPotentialMatches(
            user!.id,
            filters,
            Math.min(directMatches.length, 10)
          );
          
          if (matchesWithCompatibility.length > 0) {
            logDebug('✅ Got matches with real compatibility scores:', "Debug", matchesWithCompatibility.length);
            
            // Convert to expected format
        const realMatches: PotentialMatchProfile[] = matchesWithCompatibility.map((match: any) => ({
          id: match.id,
          display_name: match.name || 'Unknown User',
          avatar_url: match?.photos?.[0] || match?.avatar_url || null,
              bio: match.bio || match.interests?.join(', ') || 'No bio available',
              zodiac_sign: match.sunSign || 'Unknown',
              compatibility_score: match.compatibility?.combinedScore || 50,
              astrological_grade: convertScoreToGrade(match.compatibility?.natalScore || 50),
              questionnaire_grade: convertScoreToGrade(match.compatibility?.questionnaireScore || 50),
              overall_score: match.compatibility?.combinedScore || 50,
              is_match_recommended: (match.compatibility?.combinedScore || 50) >= 60
            }));
            
            setPotentialMatches(realMatches);
            setCurrentMatchIndex(0);
            setShowingMatches(true);
            logDebug('🚀 Real compatibility calculations completed with', "Debug", realMatches.length, 'users');
            return;
          }
        } catch (compatibilityError) {
          logError('❌ Real compatibility calculation failed, "Error", using fallback scores:', compatibilityError);
        }
        
        // Fallback to default scores if compatibility calculation fails
        const realMatches: PotentialMatchProfile[] = directMatches.map((match: any) => ({
          id: match.id,
          display_name: match.display_name || 'Unknown User',
          avatar_url: match.avatar_url || null,
          bio: match.interests?.join(', ') || 'No interests listed',
          zodiac_sign: match.zodiac_sign,
          // STANDARDIZED FALLBACK: 50 (neutral/unknown compatibility)
          compatibility_score: 50,
          astrological_grade: 'C',
          questionnaire_grade: 'C',
          overall_score: 50,
          is_match_recommended: false // Default to false for unknown compatibility
        }));
        
        setPotentialMatches(realMatches);
        setCurrentMatchIndex(0);
        setShowingMatches(true);
        logDebug('🚀 Real user fallback activated with default scores:', "Debug", realMatches.length, 'users');
        return;
      } else {
        logDebug('❌ No real users found in database', "Debug");
        alert('No potential matches found. Please check back later as more users join the platform.');
        return;
      }

      
      
    } catch (error: any) {
      logError('💥 Unexpected error finding matches:', "Error", error);
      alert(`Something went wrong while finding matches: ${error?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setLoadingMatches(false);
      logDebug('🏁 findPotentialMatches completed', "Debug");
    }
  };

  const createMatchRequestAfterPayment = async () => {
    // Small delay to allow payment processing to complete
    setTimeout(async () => {
      if (pendingMatchRequest) {
        // If there's a pending match request, process it
        logDebug('✅ Processing pending match request after payment:', "Debug", pendingMatchRequest);
        await processPendingMatchRequest(pendingMatchRequest);
        setPendingMatchRequest(null);
      } else {
        // Otherwise, just find potential matches
        await findPotentialMatches();
      }
    }, 2000); // 2 second delay to allow webhook processing
  };

  const processPendingMatchRequest = async (targetUserId: string) => {
    try {
      logDebug('🔄 Processing pending match request for:', "Debug", targetUserId);
      
      // Check limits before sending the swipe
      const { canCreate, message } = await MatchLimitsService.canCreateMatchRequest(user!.id);
      
      if (!canCreate) {
        logDebug('❌ Match limit reached:', "Debug", message);
        
        // Determine limit type based on message content
        let limitType: 'active_matches' | 'hourly' | 'daily' = 'daily';
        if (message?.includes('active matches')) {
          limitType = 'active_matches';
        } else if (message?.includes('give us more time')) {
          limitType = 'hourly';
        }
        
        setLimitModalData({ type: limitType, message: message || 'Match limit reached' });
        setShowLimitModal(true);
        return;
      }

      // User has subscription and within limits - proceed with match
      logDebug('✅ Sending pending match proposal...', "Debug");
      const { data, error } = await supabase.functions.invoke('record-swipe', {
        body: {
          swiped_id: targetUserId,
          swipe_type: 'like'
        }
      });

      if (error) {
        logError('Error sending match proposal:', "Error", error);
        alert('Failed to send match proposal. Please try again.');
        return;
      }

      logDebug('Swipe recorded:', "Debug", data);
      
      // Check if this created a match (mutual like)
      if (data && data.match && data.match.match_created) {
        const matchDetails = data.match.match_details;
        logDebug('Match created with details:', "Debug", matchDetails);
        
        // Show success alert
        alert(`🎉 It's a match! You can now start chatting.`);
        
        // Navigate to conversation if conversation ID is available
        if (matchDetails?.conversation_id) {
          logDebug('Navigating to conversation:', "Debug", matchDetails.conversation_id);
          router.push(`/conversation?conversationId=${matchDetails.conversation_id}`);
          return; // Exit early to avoid showing more matches
        } else {
          logWarn('Match created but no conversation ID available', "Warning");
          // Still show success, conversation might be created asynchronously
        }
      } else {
        alert(`💝 Like sent! If they like you back, you'll be matched.`);
      }
      
      // Remove this match from the list or go to next
      const newMatches = potentialMatches.filter(match => match.id !== targetUserId);
      if (newMatches.length === 0) {
        setShowingMatches(false);
        alert('All potential matches have been reviewed! Try creating another request later.');
        return;
      }
      
      setPotentialMatches(newMatches);
      if (currentMatchIndex >= newMatches.length) {
        setCurrentMatchIndex(newMatches.length - 1);
      }
      
    } catch (error) {
      logError('Unexpected error processing pending match:', "Error", error);
      alert('Something went wrong processing your match. Please try again.');
    }
  };

  // Navigation functions for matches
  const goToNextMatch = () => {
    if (currentMatchIndex < potentialMatches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    }
  };

  const goToPreviousMatch = () => {
    if (currentMatchIndex > 0) {
      setCurrentMatchIndex(currentMatchIndex - 1);
    }
  };

  const handleSendMatchProposal = async (targetUserId: string) => {
    try {
      // Check subscription first - this is where the paywall logic now happens
      logDebug('🔐 Checking subscription before sending match proposal...', "Debug");
      if (!checkAccess()) {
        logDebug('❌ User needs subscription, "Debug", showing paywall');
        // Store the pending match request to continue after payment
        setPendingMatchRequest(targetUserId);
        // Fetch RevenueCat packages before showing paywall
        await ensurePackages();
        setIsPaywallTrayVisible(true);
        return;
      }

      // Check limits before sending the swipe
      const { canCreate, message } = await MatchLimitsService.canCreateMatchRequest(user!.id);
      
      if (!canCreate) {
        logDebug('❌ Match limit reached:', "Debug", message);
        
        // Determine limit type based on message content
        let limitType: 'active_matches' | 'hourly' | 'daily' = 'daily';
        if (message?.includes('active matches')) {
          limitType = 'active_matches';
        } else if (message?.includes('give us more time')) {
          limitType = 'hourly';
        }
        
        setLimitModalData({ type: limitType, message: message || 'Match limit reached' });
        setShowLimitModal(true);
        return;
      }

      // User has subscription and within limits - proceed with match
      logDebug('✅ User has subscription access and within limits, "Debug", sending match proposal...');
      const { data, error } = await supabase.functions.invoke('record-swipe', {
        body: {
          swiped_id: targetUserId,
          swipe_type: 'like'
        }
      });

      if (error) {
        logError('Error sending match proposal:', "Error", error);
        alert('Failed to send match proposal. Please try again.');
        return;
      }

      logDebug('Swipe recorded:', "Debug", data);
      
      // Check if this created a match (mutual like)
      if (data && data.match && data.match.match_created) {
        const matchDetails = data.match.match_details;
        logDebug('Match created with details:', "Debug", matchDetails);
        
        // Show success alert
        alert(`🎉 It's a match! You can now start chatting.`);
        
        // Navigate to conversation if conversation ID is available
        if (matchDetails?.conversation_id) {
          logDebug('Navigating to conversation:', "Debug", matchDetails.conversation_id);
          router.push(`/conversation?conversationId=${matchDetails.conversation_id}`);
          return; // Exit early to avoid showing more matches
        } else {
          logWarn('Match created but no conversation ID available', "Warning");
          // Still show success, conversation might be created asynchronously
        }
      } else {
        alert(`💝 Like sent! If they like you back, you'll be matched.`);
      }
      
      // Remove this match from the list or go to next
      const newMatches = potentialMatches.filter(match => match.id !== targetUserId);
      if (newMatches.length === 0) {
        setShowingMatches(false);
        alert('All potential matches have been reviewed! Try creating another request later.');
        return;
      }
      
      setPotentialMatches(newMatches);
      if (currentMatchIndex >= newMatches.length) {
        setCurrentMatchIndex(newMatches.length - 1);
      }
      
    } catch (error) {
      logError('Unexpected error sending proposal:', "Error", error);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleDeclineMatch = async () => {
    const currentMatch = potentialMatches[currentMatchIndex];
    
    try {
      // Record the decline in the backend
      await supabase.functions.invoke('record-swipe', {
        body: {
          swiped_id: currentMatch.id,
          swipe_type: 'pass'
        }
      });
      
      logDebug('Decline recorded for user:', "Debug", currentMatch.id);
    } catch (error) {
      logError('Error recording decline:', "Error", error);
      // Continue with UI update even if backend call fails
    }
    
    // Remove this match from the list
    const newMatches = potentialMatches.filter((_, index) => index !== currentMatchIndex);
    if (newMatches.length === 0) {
      setShowingMatches(false);
      alert('All potential matches have been reviewed! Try creating another request later.');
      return;
    }
    
    setPotentialMatches(newMatches);
    if (currentMatchIndex >= newMatches.length) {
      setCurrentMatchIndex(newMatches.length - 1);
    }
  };

  const handleBackToDateNight = () => {
    setShowingMatches(false);
    setPotentialMatches([]);
    setCurrentMatchIndex(0);
    // Navigate back to dashboard with proper back animation
    router.back();
  };

  const ensurePackages = async () => {
    if (packages.length > 0 || packagesLoading) return;
    setPackagesLoading(true);
    try {
      const result = await getOfferings();
      if (result.success && result.packages) {
        setPackages(result.packages);
        // Default selection to first package
        if (result.packages.length > 0) {
          setSelectedPackage(result.packages[0]);
        }
      }
    } finally {
      setPackagesLoading(false);
    }
  };

  const handleSubscriptionPurchase = async () => {
    if (!selectedPackage) return;
    setProcessingPayment(true);

    try {
      logDebug('Initiating RevenueCat purchase:', "Debug", selectedPackage.identifier);

      const result = await purchasePackage(selectedPackage);

      if (result.success && result.hasPremium) {
        logDebug('✅ Subscription purchased successfully', "Debug");
        setIsPaywallTrayVisible(false);
        createMatchRequestAfterPayment();
      } else if (result.userCancelled) {
        logDebug('Purchase cancelled by user', "Debug");
      } else {
        logError('❌ Subscription purchase failed:', "Error", result.error);
      }
    } catch (error) {
      logError('🚨 Subscription purchase error:', "Error", error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleRestorePurchases = async () => {
    setProcessingPayment(true);

    try {
      logDebug('Restoring RevenueCat purchases...', "Debug");

      const result = await restorePurchases();

      if (result.success && result.hasPremium) {
        logDebug('✅ Purchases restored successfully - Premium access granted', "Debug");
        setIsPaywallTrayVisible(false);
        createMatchRequestAfterPayment();
      } else if (result.success && !result.hasPremium) {
        logDebug('Purchases restored but no active subscription found', "Debug");
        alert('No active subscription found. Please purchase a subscription to continue.');
      } else {
        logError('❌ Failed to restore purchases:', "Error", result.error);
        alert('Failed to restore purchases. Please try again.');
      }
    } catch (error) {
      logError('🚨 Restore purchases error:', "Error", error);
      alert('An error occurred while restoring purchases. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Ticket purchase flow removed — subscription only

  // Debug logging for conditional rendering
  logDebug('🔍 Date Night Render Check:', "Debug", {
    showingMatches,
    potentialMatchesLength: potentialMatches.length,
    currentMatchIndex,
    loadingMatches,
    shouldShowMatches: showingMatches && potentialMatches.length > 0
  });

  // If loading matches, show loading screen
  if (loadingMatches) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.contentWrapper}>
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
            onPress={() => router.back()}
            >
              <ArrowLeft size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Title and subtitle */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Finding Potential Matches</Text>
            <Text style={styles.subtitle}>
              Searching for compatible profiles based on your preferences.
            </Text>
          </View>

          {/* Loading Progress Card */}
          <LoadingProgress 
            message="Finding Potential Matches"
            subMessage={`Looking for ${selectedSign !== "Any" ? selectedSign + " signs" : "compatible signs"} interested in ${selectedDateType !== "Any" ? selectedDateType.toLowerCase() : "any activity"}...`}
          />
        </View>
      </ScrollView>
    );
  }

  // If showing potential matches, render the MatchReceptionContent
  if (showingMatches && potentialMatches.length > 0) {
    logDebug('✅ Rendering MatchReceptionContent with current match:', "Debug", potentialMatches[currentMatchIndex]);
    const currentMatch = potentialMatches[currentMatchIndex];
    
    return (
      <View style={styles.container}>
        <View style={styles.matchViewContainer}>
          {/* Back Button - Positioned absolutely like other screens */}
          <View style={styles.matchBackButtonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToDateNight}
            >
              <ArrowLeft size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Header Section */}
          <View style={styles.matchHeaderContainer}>
            <Text style={styles.matchHeaderTitle}>Potential Matches</Text>
            <Text style={styles.matchCounterText}>
              {currentMatchIndex + 1} / {potentialMatches.length}
            </Text>
          </View>

          {/* Match Reception Content */}
          <View style={styles.matchContent}>
            <MatchReceptionContent
              mode="potential"
              potentialMatchProfile={currentMatch}
              sourceMatchRequestId="temp-request-id" // This would be from actual match request
              onAcceptPotentialMatch={handleSendMatchProposal}
              onDecline={handleDeclineMatch}
              onViewCompatibility={() => {
                // This will show compatibility view within MatchReceptionContent
                logDebug('View compatibility for', "Debug", currentMatch.id);
              }}
              dateActivity={selectedDateType !== "Any" ? selectedDateType : "Coffee"}
              currentMatchIndex={currentMatchIndex}
              totalMatches={potentialMatches.length}
              onNext={goToNextMatch}
              onPrevious={goToPreviousMatch}
              hasNext={currentMatchIndex < potentialMatches.length - 1}
              hasPrevious={currentMatchIndex > 0}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentWrapper}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="black" />
          </TouchableOpacity>
        </View>

        {/* Title and subtitle */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Date Night</Text>
          <Text style={styles.subtitle}>
            Select your preferences and find your match.
          </Text>
        </View>

        {/* Main Content Card */}
        <View style={styles.card}>
          {/* Zodiac Sign Selection Button */}
          <TouchableOpacity
            style={[
              styles.selectionButton,
              { backgroundColor: selectedSign !== "Any" ? "#C8A8E9" : "#f5f5f5" },
            ]}
            onPress={() => {
              // logDebug("Zodiac sign button pressed, "Debug", setting tray visible"); // Removed console.log
              setIsZodiacTrayVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.buttonLabel}>Match with Sign</Text>
              <Text style={styles.buttonValue}>{selectedSign}</Text>
            </View>
            <UserCheck size={24} color="black" />
          </TouchableOpacity>

          {/* Date Activity Selection Button */}
          <TouchableOpacity
            style={[
              styles.selectionButton,
              { backgroundColor: selectedDateType !== "Any" ? "#C8A8E9" : "#f5f5f5" },
            ]}
            onPress={() => {
              // logDebug("Date activity button pressed, "Debug", setting tray visible"); // Removed console.log
              setIsDateActivityTrayVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.buttonLabel}>First Date Idea</Text>
              <Text style={styles.buttonValue}>{selectedDateType}</Text>
            </View>
            <HeartHandshake size={24} color="black" />
          </TouchableOpacity>
          
          <View style={[
            styles.confirmationDetails,
            { backgroundColor: bothSelected ? "#C8A8E9" : "#f5f5f5" }
          ]}>
            <View style={styles.confirmationItem}>
              <Text style={styles.confirmationLabel}>Selected Sign:</Text>
              <Text style={styles.confirmationValue}>{selectedSign}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.confirmationItem}>
              <Text style={styles.confirmationLabel}>Selected Date:</Text>
              <Text style={styles.confirmationValue}>{selectedDateType}</Text>
            </View>
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: "#C8A8E9" },
              isConfirmButtonPressed && styles.nextButtonPressed,
              (subscriptionLoading || isPotentialMatchLoading) && { opacity: 0.7 }
            ]}
            onPress={handleConfirmAndCreateMatch}
            onPressIn={() => setIsConfirmButtonPressed(true)}
            onPressOut={() => setIsConfirmButtonPressed(false)}
            activeOpacity={1} // To ensure our custom pressed style is visible
            disabled={subscriptionLoading || isPotentialMatchLoading || loadingMatches}
          >
            <Text style={styles.nextButtonText}>
              {subscriptionLoading ? "Loading..." : 
               loadingMatches ? "Finding Matches..." :
               "Find Potential Matches"}
            </Text>
          </TouchableOpacity>

        </View>
      </View>

      {/* Zodiac Sign Selection Tray */}
      <PopUpTray
        isVisible={isZodiacTrayVisible}
        onClose={() => setIsZodiacTrayVisible(false)}
        onConfirm={() => {
            setIsZodiacTrayVisible(false); 
        }}
        title="Select Zodiac Sign"
        confirmButtonText="Done"
        headerTabColor="#C8A8E9"
      >
        <HorizontalCardCarousel
          items={zodiacSigns.map(sign => ({ id: sign, label: sign }))}
          selectedItem={selectedSign}
          onItemSelect={handleSignChange}
          cardWidth={100}
          cardHeight={80}
          spacing={12}
        />
      </PopUpTray>

      {/* Date Activity Selection Tray */}
      <PopUpTray
        isVisible={isDateActivityTrayVisible}
        onClose={() => setIsDateActivityTrayVisible(false)}
        onConfirm={() => {
            setIsDateActivityTrayVisible(false);
        }}
        title="Select Date Activity"
        confirmButtonText="Done"
        headerTabColor="#C8A8E9"
      >
        <HorizontalCardCarousel
          items={dateTypes.map(type => ({ id: type, label: type }))}
          selectedItem={selectedDateType}
          onItemSelect={handleDateTypeChange}
          cardWidth={100}
          cardHeight={80}
          spacing={12}
        />
      </PopUpTray>

      {/* Paywall Tray (Subscription only) */}
      <PopUpTray
        isVisible={isPaywallTrayVisible}
        onClose={() => setIsPaywallTrayVisible(false)}
        title=" " 
        headerTabColor="#E5E7EB" 
        // No onConfirm or confirmButtonText needed here as paywall has internal buttons
      >
        
          <View style={styles.paywallContent}>
            <View style={styles.contentBlockWrapper}>
              <View style={styles.unlimitedAccessBlock}>
                <View style={styles.unlimitedAccessContainer}>
                  <Text style={styles.unlimitedAccessTitle}>
                    UNLIMITED ACCESS
                  </Text>
                  <Text style={styles.unlimitedAccessSubtitle}>
                    All dinners, every Wednesday
                  </Text>
                  <View style={styles.starsContainer}>
                    <Text style={styles.stars}>★★★★★</Text>
                  </View>
                </View>
              </View>
              {/* Dynamic RevenueCat packages */}
              {packagesLoading ? (
                <View style={styles.subscriptionOptions}>
                  <Text style={{ textAlign: 'center', padding: 20 }}>Loading packages...</Text>
                </View>
              ) : packages.length > 0 ? (
                <View style={styles.subscriptionOptions}>
                  <View style={styles.optionRow}>
                    {packages.map((pkg) => (
                      <TouchableOpacity
                        key={pkg.identifier}
                        style={[
                          styles.priceCard,
                          selectedPackage?.identifier === pkg.identifier
                            ? styles.selectedPriceCard
                            : styles.unselectedPriceCard,
                        ]}
                        onPress={() => setSelectedPackage(pkg)}
                      >
                        <Text
                          style={[
                            styles.optionLabel,
                            selectedPackage?.identifier === pkg.identifier
                              ? styles.selectedOptionLabel
                              : null,
                          ]}
                        >
                          {pkg.product.introPrice ? 'SAVE' : 'Premium'}
                        </Text>
                        <Text style={styles.priceTitle}>
                          {pkg.product.title.replace('(Stellr Dating App)', '').trim()}
                        </Text>
                        <Text style={styles.priceValue}>
                          {pkg.product.priceString}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.subscriptionOptions}>
                  <Text style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                    No packages available
                  </Text>
                </View>
              )}
              <Text style={styles.termsText}>
                By selecting Subscribe, you will be charged, your
                subscription will auto-renew for the same price and
                package length until you cancel via settings, and you
                agree to our Terms.
              </Text>
              <TouchableOpacity
                style={[styles.purchaseButton, (processingPayment || !selectedPackage) && { opacity: 0.7 }]}
                onPress={handleSubscriptionPurchase}
                disabled={processingPayment || !selectedPackage}
              >
                <Text style={styles.purchaseButtonText}>
                  {processingPayment ? "Processing..." :
                    selectedPackage ? `Subscribe - ${selectedPackage.product.priceString}` :
                    "Select a package"
                  }
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestorePurchases}
                disabled={processingPayment}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>
            </View>
          </View>
      </PopUpTray>

      {/* Match Limit Modal */}
      <MatchLimitModal
        isVisible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType={limitModalData.type}
        message={limitModalData.message}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // Navy background like dashboard
  },
  contentWrapper: {
    flex: 1,
    padding: 16,
    paddingTop: 48,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  titleContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: "white",
  },
  subtitle: {
    fontSize: 16,
    color: "white",
    opacity: 0.8,
  },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    borderWidth: 0, // Remove border to match dashboard
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    textAlign: "center",
    marginBottom: 24,
  },
  nextButton: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  nextButtonPressed: {
    backgroundColor: "#C8A8E9", 
  },
  nextButtonText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  dateOptionsContainer: {
    width: "100%",
    marginVertical: 16,
  },
  dateOption: {
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  selectedDateOption: {
    backgroundColor: "#d0d0d0",
    borderBottomWidth: 4, 
  },
  dateOptionText: {
    fontSize: 18,
    fontFamily: 'Geist-Medium',
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    textAlign: "center",
    marginBottom: 20,
  },
  confirmationDetails: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    padding: 16,
    marginVertical: 16,
  },
  confirmationItem: {
    marginBottom: 12,
  },
  confirmationLabel: {
    fontSize: 16,
    color: "black",
  },
  confirmationValue: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: "black",
  },
  confirmationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  confirmButton: {
    backgroundColor: "#d0d0d0",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 4,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flex: 1,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: "#d0d0d0",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    borderBottomWidth: 4,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flex: 1,
    marginLeft: 8,
  },
  confirmButtonText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    marginLeft: 8,
  },
  cancelButtonText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    marginLeft: 8,
  },
  separator: {
    height: 2,
    backgroundColor: "black",
    width: "100%",
    marginTop: 16,
    marginBottom: 8,
  },
  selectionButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    // backgroundColor: "#BAF2BB", // Removed: Will be set dynamically
    marginBottom: 20, 
    minHeight: 70, 
  },
  buttonLabel: { 
    fontSize: 14,
    color: "black",
    marginBottom: 2,
  },
  buttonValue: { 
    fontSize: 18,
    fontFamily: 'Geist-Medium',
    color: "black",
  },
  // Styles for Paywall content (some might be adjusted after PopUpTray integration)
  paywallContent: {
    width: "100%",
    backgroundColor: "#F3F4F6", // Neutral light background
    paddingBottom: 4, // Reduced from 8 to 4
  },
  contentBlockWrapper: {
    backgroundColor: "white", // White card background
    margin: 16,
    borderRadius: 12,
    borderWidth: 0, // Remove border to match design
    paddingTop: 16, 
    paddingHorizontal: 16, 
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  unlimitedAccessBlock: {
    backgroundColor: "#E5E7EB", // Neutral gray header
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    padding: 16,
    marginBottom: 16,
  },
  unlimitedAccessContainer: {
    alignItems: "center",
  },
  unlimitedAccessTitle: {
    fontSize: 22,
    fontFamily: 'Geist-Regular',
    textAlign: "center",
  },
  unlimitedAccessSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 4,
  },
  starsContainer: {
    marginTop: 8,
  },
  stars: {
    fontSize: 16,
    color: "black",
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "#C8A8E9", // Purple background for tabs
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  tabButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200, 168, 233, 0.5)", // Lighter purple for inactive tabs
    overflow: "hidden", 
  },
  tabButtonActive: {
    backgroundColor: "#C8A8E9", // Purple for active tab
    overflow: "hidden",
  },
  tabButtonLeft: { // New style
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  tabButtonRight: { // New style
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  tabButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "white",
  },
  tabActiveText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "white", // White text on purple background
  },
  subscriptionOptions: {
    backgroundColor: "white", // White background for subscription cards
    marginBottom: 0, // Changed from 16 to 0
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  selectedPriceCard: {
    // This style can be used for additional visual cues if needed,
    // e.g., a slightly different border color or intensity.
    // For now, primary selection is via selectedOptionLabel.
    // borderColor: 'gold', // Example
  },
  unselectedPriceCard: { // Restoring this definition
    backgroundColor: "white", // White for unselected cards
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    backgroundColor: "#d0d0d0",
    width: "100%",
    textAlign: "center",
    paddingVertical: 4,
    borderTopLeftRadius: 8, // Will be overridden by priceCard's borderRadius if label is full width
    borderTopRightRadius: 8, 
  },
  selectedOptionLabel: {
    backgroundColor: "#E5E7EB", // Neutral for selected option labels
  },
  priceCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginHorizontal: 4,
    backgroundColor: "white", // White background for price cards
    overflow: "hidden",
    paddingTop: 0,
    paddingBottom: 16,
  },
  priceTitle: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    marginTop: 8,
    color: "black", // Black text on white background
  },
  priceValue: {
    fontSize: 14,
    marginBottom: 8,
    color: "black", // Black text on white background
  },
  termsText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 0, // Changed from 16 to 0
    // Adding padding for visual separation instead of border for Text
    paddingBottom: 16, 
    // borderBottomWidth: 2, // Removed as per feedback
    // borderBottomColor: "black", // Removed as per feedback
  },
  purchaseButton: {
    backgroundColor: "#E5E7EB", // Neutral background for purchase button
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
  },
  restoreButton: {
    padding: 12,
    alignItems: "center",
    marginTop: 0,
    marginBottom: 4, // Changed from 8 to 4
  },
  restoreButtonText: {
    fontSize: 14,
    color: "#666",
  },
  ticketDetails: {
    backgroundColor: "#f5f5f5",
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "black",
    backgroundColor: "#f5f5f5",
  },
  ticketLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
  },
  ticketChevron: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
  },
  ticketContent: {
    padding: 12,
    backgroundColor: "#C8A8E9",
  },
  ticketField: {
    marginBottom: 8,
  },
  ticketFieldLabel: {
    fontSize: 14,
    color: "#1f2937",
  },
  ticketFieldValue: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    borderBottomWidth: 1,
    borderBottomColor: "black",
    paddingBottom: 4,
  },
  promoCodeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "black",
    backgroundColor: "#C8A8E9",
  },
  expandedSection: {
    padding: 12,
    backgroundColor: "#C8A8E9",
  },
  promoInputContainer: {
    width: "100%",
  },
  promoInput: {
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "black",
    padding: 10,
    fontSize: 16,
    color: "black",
  },
  collapsedSection: {
    height: 0,
    overflow: "hidden",
  },
  chevronDown: {
    transform: [{ rotate: "0deg" }],
    color: "black",
  },
  chevronUp: {
    transform: [{ rotate: "180deg" }],
    color: "black",
  },
  ticketTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  ticketTotalLabel: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
  ticketTotalValue: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
  },
  // New styles for match viewing
  matchViewContainer: {
    flex: 1,
    backgroundColor: "#0F172A", // Navy background to match main app theme
  },
  matchBackButtonContainer: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 20,
  },
  matchHeaderContainer: {
    paddingTop: 100, // Account for back button
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  matchCounterWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  matchHeaderTitle: {
    fontSize: 28,
    fontFamily: 'Geist-Regular',
    color: "white",
    marginBottom: 8,
  },
  matchHeaderSubtitle: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "white",
    opacity: 0.8,
  },
  matchContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  navigationControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: "#0F172A",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C8A8E9",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "black",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  navButtonDisabled: {
    backgroundColor: "#555",
    opacity: 0.6,
  },
  navButtonText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "white",
    marginHorizontal: 8,
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  matchCounterText: {
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    color: "rgba(255, 255, 255, 0.8)",
  },
  bottomNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
});
