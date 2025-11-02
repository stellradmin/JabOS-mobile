import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { WHITE_CARD_STYLES, COLORS } from '../../constants/theme';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react-native';
import PopUpTray from '../PopUpTray';
import { useSubscription } from '../../src/contexts/SubscriptionContext';
import { useIncomingMatchRequests } from '../../src/hooks/useIncomingMatchRequests';
import { MatchRequestService } from '../../src/services/match-request-service';
import { useRouter } from 'expo-router';
import { getOfferings, purchasePackage, restorePurchases } from '../../src/services/revenuecat-service';
// Type definition for packages (RevenueCat not installed for beta)
type PurchasesPackage = any;
import { supabase } from '../../src/lib/supabase';
import SubscriptionBanner from '../premium/SubscriptionBanner';
import PremiumStatusBanner from '../premium/PremiumStatusBanner';

interface ZodiacOption {
  id: string;
  name: string;
  emoji: string;
  element: string;
  description: string;
}

interface RotatingZodiacCardProps {
  userName?: string;
  selectedZodiac?: ZodiacOption;
  onZodiacChange: (zodiac: ZodiacOption) => void;
  matchesCount?: number;
  isPremium?: boolean;
  showBanner?: boolean;
  onBannerPress?: () => void;
  onBannerDismiss?: () => void;
}

const zodiacOptions: ZodiacOption[] = [
  { id: 'aries', name: 'Aries', emoji: '♈', element: 'Fire', description: 'Passionate & Dynamic' },
  { id: 'taurus', name: 'Taurus', emoji: '♉', element: 'Earth', description: 'Stable & Reliable' },
  { id: 'gemini', name: 'Gemini', emoji: '♊', element: 'Air', description: 'Curious & Adaptable' },
  { id: 'cancer', name: 'Cancer', emoji: '♋', element: 'Water', description: 'Nurturing & Intuitive' },
  { id: 'leo', name: 'Leo', emoji: '♌', element: 'Fire', description: 'Bold & Creative' },
  { id: 'virgo', name: 'Virgo', emoji: '♍', element: 'Earth', description: 'Thoughtful & Practical' },
  { id: 'libra', name: 'Libra', emoji: '♎', element: 'Air', description: 'Harmonious & Fair' },
  { id: 'scorpio', name: 'Scorpio', emoji: '♏', element: 'Water', description: 'Intense & Mysterious' },
  { id: 'sagittarius', name: 'Sagittarius', emoji: '♐', element: 'Fire', description: 'Adventurous & Free' },
  { id: 'capricorn', name: 'Capricorn', emoji: '♑', element: 'Earth', description: 'Ambitious & Disciplined' },
  { id: 'aquarius', name: 'Aquarius', emoji: '♒', element: 'Air', description: 'Independent & Innovative' },
  { id: 'pisces', name: 'Pisces', emoji: '♓', element: 'Water', description: 'Compassionate & Artistic' }
];

const RotatingZodiacCard: React.FC<RotatingZodiacCardProps> = ({
  userName = 'Daniel',
  selectedZodiac,
  onZodiacChange,
  matchesCount = 0,
  isPremium = false,
  showBanner = false,
  onBannerPress,
  onBannerDismiss,
}) => {
  const router = useRouter();
  const { checkAccess } = useSubscription();
  const { requests: incomingRequests, count: incomingCount, refresh: refreshIncoming } = useIncomingMatchRequests();
  const [showInvitesTray, setShowInvitesTray] = useState(false);
  const [trayMode, setTrayMode] = useState<'list' | 'paywall'>('list');
  const [pendingAcceptId, setPendingAcceptId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loadingAccept, setLoadingAccept] = useState<string | null>(null);
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, { id: string; display_name?: string | null; avatar_url?: string | null }>>({});

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
  
  const openInvites = async () => {
    setTrayMode('list');
    setShowInvitesTray(true);
    try {
      const missingIds = Array.from(new Set(incomingRequests.map(r => r.requester_id))).filter(id => !requesterProfiles[id]);
      if (missingIds.length) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', missingIds);
        if (!error && data) {
          setRequesterProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries(data.map((p) => [p.id, p])),
          }));
        }
      }
    } catch {}
  };

  const handleAcceptInvite = async (matchRequestId: string) => {
    if (checkAccess()) {
      setLoadingAccept(matchRequestId);
      try {
        const result = await MatchRequestService.accept(matchRequestId);
        if (result.success) {
          try { refreshIncoming(); } catch {}
          setShowInvitesTray(false);
          router.push('/(tabs)/messenger');
        }
      } finally {
        setLoadingAccept(null);
      }
    } else {
      setPendingAcceptId(matchRequestId);
      await ensurePackages();
      setTrayMode('paywall');
    }
  };

  const handleDeclineInvite = async (matchRequestId: string) => {
    setLoadingAccept(matchRequestId);
    try {
      await MatchRequestService.reject(matchRequestId);
      try { refreshIncoming(); } catch {}
    } finally {
      setLoadingAccept(null);
    }
  };

  const handlePurchaseThenAccept = async () => {
    if (!pendingAcceptId || !selectedPackage) return;
    try {
      // Purchase via RevenueCat SDK
      const result = await purchasePackage(selectedPackage);

      if (result.success && result.hasPremium) {
        // User now has premium entitlement, attempt accepting match request
        const acceptResult = await MatchRequestService.accept(pendingAcceptId);
        if (acceptResult.success) {
          setPendingAcceptId(null);
          setTrayMode('list');
          try { refreshIncoming(); } catch {}
          setShowInvitesTray(false);
          router.push('/(tabs)/messenger');
        }
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const result = await restorePurchases();
      if (result.success && result.hasPremium) {
        // Purchases restored successfully, user has premium
        if (pendingAcceptId) {
          const acceptResult = await MatchRequestService.accept(pendingAcceptId);
          if (acceptResult.success) {
            setPendingAcceptId(null);
            setTrayMode('list');
            try { refreshIncoming(); } catch {}
            setShowInvitesTray(false);
            router.push('/(tabs)/messenger');
          }
        }
      }
    } catch (error) {
      console.error('Restore purchases failed:', error);
    }
  };
  const [currentIndex, setCurrentIndex] = useState(
    selectedZodiac ? zodiacOptions.findIndex(z => z.id === selectedZodiac.id) : 0
  );

  const animateRotation = (direction: 'left' | 'right') => {
    // Animation removed to eliminate shake effect
  };

  const handleRotate = (direction: 'left' | 'right') => {
    animateRotation(direction);
    
    let newIndex;
    if (direction === 'right') {
      newIndex = (currentIndex + 1) % zodiacOptions.length;
    } else {
      newIndex = currentIndex === 0 ? zodiacOptions.length - 1 : currentIndex - 1;
    }
    
    setCurrentIndex(newIndex);
    onZodiacChange(zodiacOptions[newIndex]);
  };

  const currentZodiac = zodiacOptions[currentIndex];

  return (
    <View 
      style={[
        styles.container,
        WHITE_CARD_STYLES,
        styles.topCardRounding, // Override for selective corner rounding
        styles.noShadow, // Remove drop shadow on top card
      ]}
    >
      {/* Grouped content wrapper */}
      <View style={styles.contentWrapper}>
        {/* Header with greeting and zodiac info */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Hello {userName}
            </Text>

            {/* Show premium status, upgrade banner, or match count */}
            {isPremium && matchesCount === 0 ? (
              <PremiumStatusBanner style={styles.bannerMargin} />
            ) : showBanner && onBannerPress && onBannerDismiss ? (
              <SubscriptionBanner
                onPress={onBannerPress}
                onDismiss={onBannerDismiss}
                style={styles.bannerMargin}
              />
            ) : (
              <Text style={styles.subtitle}>
                {`You have ${matchesCount} ${matchesCount === 1 ? 'match' : 'matches'} currently`}
              </Text>
            )}

            {/* Zodiac info moved to header */}
            <View style={styles.zodiacInfo}>
              <Text style={styles.zodiacElement}>Date Sign</Text>
              <Text style={styles.zodiacName}>{currentZodiac.name}</Text>
            </View>
          </View>

          {/* Incoming invites button (replaces subscription) */}
          <TouchableOpacity style={styles.shareButton} onPress={openInvites} accessibilityLabel={`Open incoming invites (${incomingCount})`}>
            <View style={styles.inviteIconWrap}>
              <Inbox size={18} color={COLORS.DARK_TEXT} />
              {incomingCount > 0 && (
                <View style={styles.inviteBadge} accessibilityLabel={`${incomingCount} pending invites`}>
                  <Text style={styles.inviteBadgeText}>{incomingCount > 99 ? '99+' : incomingCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation chevrons at absolute corners */}
      <TouchableOpacity 
        style={[styles.chevronButton, styles.chevronLeft]}
        onPress={() => handleRotate('left')}
        activeOpacity={0.7}
      >
        <ChevronLeft size={20} color={COLORS.DARK_TEXT} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.chevronButton, styles.chevronRight]}
        onPress={() => handleRotate('right')}
        activeOpacity={0.7}
      >
        <ChevronRight size={20} color={COLORS.DARK_TEXT} />
      </TouchableOpacity>

      {/* Invites Tray (shows list; triggers paywall only when needed) */}
      <PopUpTray
        isVisible={showInvitesTray}
        onClose={() => { setTrayMode('list'); setShowInvitesTray(false); setPendingAcceptId(null); }}
        title={trayMode === 'list' ? 'Incoming Invites' : 'Subscribe to Accept'}
        headerTabColor="#E5E7EB"
        customHeight={0.68}
      >
        {trayMode === 'list' ? (
          <View style={{ paddingHorizontal: 12 }}>
            {incomingRequests.length === 0 ? (
              <Text style={{ textAlign: 'center', color: COLORS.SECONDARY_TEXT }}>No pending invites right now.</Text>
            ) : (
              incomingRequests.map((req) => {
                const p = requesterProfiles[req.requester_id];
                return (
                  <View key={req.id} style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: 'white' }}>
                    <Text style={{ fontFamily: 'Geist-Regular', fontSize: 16, color: COLORS.DARK_TEXT }}>
                      {p?.display_name || 'Someone'} wants to match
                    </Text>
                    {!!req.compatibility_score && (
                      <Text style={{ marginTop: 4, color: COLORS.SECONDARY_TEXT }}>Compatibility: {Math.round(req.compatibility_score)}%</Text>
                    )}
                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleAcceptInvite(req.id)}
                        disabled={loadingAccept === req.id}
                        style={{ flex: 1, backgroundColor: '#000', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
                        accessibilityLabel={`Accept match invite from ${p?.display_name || 'user'}`}
                      >
                        <Text style={{ color: '#fff', fontFamily: 'Geist-Regular' }}>{loadingAccept === req.id ? 'Accepting...' : 'Accept'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeclineInvite(req.id)}
                        disabled={loadingAccept === req.id}
                        style={{ flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' }}
                        accessibilityLabel={`Decline match invite from ${p?.display_name || 'user'}`}
                      >
                        <Text style={{ color: COLORS.DARK_TEXT, fontFamily: 'Geist-Regular' }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.paywallContainer}>
            <View style={styles.heroBlock}>
              <View style={styles.heroInner}>
                <Text style={styles.heroTitle}>UNLIMITED ACCESS</Text>
                <Text style={styles.heroSubtitle}>Accept invites and send requests</Text>
                <View style={styles.heroStars}><Text style={styles.heroStarsText}>★★★★★</Text></View>
              </View>
            </View>

            <View style={styles.cardsRow}>
              {(packagesLoading ? [] : packages).map((pkg) => {
                const isSelected = selectedPackage?.identifier === pkg.identifier;
                const price = pkg.product.priceString;
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[styles.priceCard, isSelected ? styles.priceCardSelected : styles.priceCardUnselected]}
                    onPress={() => setSelectedPackage(pkg)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                      {pkg.product.title}
                    </Text>
                    <Text style={[styles.cardMonths, isSelected && styles.cardSelectedText]}>
                      {pkg.product.description || pkg.product.title}
                    </Text>
                    <Text style={[styles.cardMonthly, isSelected && styles.cardSelectedText]}>{price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.termsBox}>
              <Text style={styles.termsText}>
                By selecting Subscribe, you will be charged, your subscription will auto-renew for the same price and package length until you cancel via settings, and you agree to our Terms. You also acknowledge the right to withdraw within 14 days for a pro-rated refund, with no refund available after 14 days.
              </Text>
            </View>

            <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9} onPress={handlePurchaseThenAccept}>
              <Text style={styles.ctaButtonText}>
                {selectedPackage
                  ? `Subscribe • ${selectedPackage.product.priceString}`
                  : 'Subscribe'}
              </Text>
            </TouchableOpacity>

            {/* Restore Purchases Button - Required for RevenueCat compliance */}
            <TouchableOpacity style={styles.restoreWrap} onPress={handleRestorePurchases}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>
          </View>
        )}
      </PopUpTray>
    </View>
  );
};

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    height: screenHeight * 0.5, // Double height to 50%
    maxHeight: 480, // Double max height
    minHeight: 360, // Double min height
    paddingTop: 80, // Significant padding to push content down and show black SafeArea
    paddingHorizontal: 20,
    paddingBottom: 30, // Increase bottom padding
    marginHorizontal: 0, // Remove side margins for full width
    marginBottom: 0, // Remove bottom margin for seamless stacking
    justifyContent: 'flex-start',
  },
  noShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  topCardRounding: {
    borderTopLeftRadius: 0, // Square top corners for full width
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20, // Keep bottom corners rounded
    borderBottomRightRadius: 20,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center', // Center grouped content vertically
    marginTop: -8, // Fine-tune vertical position
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 60, // Significant space above Hello Wade header to push content down
    marginBottom: 20, // More space for taller card
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start', // Left-align all header content
  },
  greeting: {
    fontSize: 32, // Larger for taller card
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18, // Larger subtitle
    fontFamily: 'Geist-Regular',
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 16, // Space before zodiac info
  },
  bannerMargin: {
    marginBottom: 16, // Same spacing as subtitle
  },
  zodiacInfo: {
    alignItems: 'flex-start', // Left-align zodiac info
  },
  shareButton: {
    minWidth: 36, // Keep size for touch target
    minHeight: 36,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteIconWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
    minHeight: 20,
  },
  inviteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.CORAL,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  inviteBadgeText: {
    fontFamily: 'Geist-Regular',
    fontSize: 10,
    color: '#FFFFFF',
    lineHeight: 12,
  },
  chevronButton: {
    position: 'absolute',
    width: 40, // Keep size for touch target
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronLeft: {
    bottom: 15,
    left: 15,
  },
  chevronRight: {
    bottom: 15,
    right: 15,
  },
  zodiacName: {
    fontSize: 28, // Larger for taller card
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginBottom: 6,
  },
  zodiacElement: {
    fontSize: 16, // Larger element text
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
    marginBottom: 8,
  },
  // Subscription tray styles (1:1 black-themed rendition)
  paywallContainer: {
    paddingHorizontal: 0,
  },
  heroBlock: {
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 16,
    backgroundColor: 'white',
    marginHorizontal: 4,
    marginBottom: 12,
    padding: 8,
  },
  heroInner: {
    backgroundColor: '#D1D5DB',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  heroTitle: {
    fontFamily: 'Geist-Black',
    fontSize: 22,
    color: '#111827',
    letterSpacing: 1,
  },
  heroSubtitle: {
    marginTop: 6,
    fontFamily: 'Geist-Regular',
    fontSize: 14,
    color: '#111827',
  },
  heroStars: { marginTop: 8 },
  heroStarsText: { fontFamily: 'Geist-Regular', fontSize: 16, color: '#111827' },
  // segmented toggle removed per spec
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  priceCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  priceCardSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  priceCardUnselected: {},
  cardLabel: {
    width: '100%',
    textAlign: 'center',
    backgroundColor: '#D1D5DB',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
    paddingVertical: 6,
    fontFamily: 'Geist-Medium',
    color: '#111827',
    fontSize: 14,
  },
  cardLabelSelected: {
    backgroundColor: '#000',
    color: '#FFF',
    borderBottomColor: '#FFF',
  },
  cardMonths: {
    marginTop: 8,
    fontFamily: 'Geist-Regular',
    color: '#111827',
    fontSize: 16,
  },
  cardMonthly: {
    marginTop: 2,
    fontFamily: 'Geist-Medium',
    color: '#111827',
    fontSize: 14,
  },
  cardSelectedText: {
    color: '#FFFFFF',
  },
  // ticket option removed per spec
  termsBox: {
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 12,
    marginHorizontal: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  termsText: {
    fontFamily: 'Geist-Regular',
    color: '#111827',
    fontSize: 12,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: 12,
    marginHorizontal: 8,
    backgroundColor: '#000000', // Black instead of green
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'black',
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontFamily: 'Geist-Regular',
    color: '#FFFFFF',
    fontSize: 16,
  },
  restoreWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  restoreText: {
    fontFamily: 'Geist-Regular',
    color: '#1F2937',
    textDecorationLine: 'underline',
  },
});

export default RotatingZodiacCard;
