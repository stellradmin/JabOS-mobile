import { supabase } from '../../src/lib/supabase';
import {
  createStellerError,
  createNetworkError,
  createValidationError,
  convertToStellerError
} from '../../src/utils/error-factory';
import { PotentialMatch } from './PotentialMatchPopupTray';
import { trackUserJourney } from '../../src/lib/posthog-enhanced';
import { logError, logDebug } from "../../src/utils/logger";

interface MatchFilters {
  zodiacSign?: string;
  dateActivity?: string;
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  limit?: number;
  cursor?: string | null;
  page?: number;
  pageSize?: number;
  refresh?: boolean;
}

interface SwipeResult {
  swipe: any;
  match: {
    match_created: boolean;
    match_details: any | null;
  };
}

/**
 * MatchStackManager - Efficient management of potential matches
 * 
 * Responsibilities:
 * - Load and cache potential matches from backend
 * - Handle pagination and batch loading
 * - Record swipe actions and detect matches
 * - Manage memory and performance optimization
 * - Background preloading for smooth UX
 * 
 * Following Golden Code Principles:
 * 1. Single Responsibility: Manages only match data and swipe actions
 * 2. Performance First: Optimized caching and batch loading
 * 3. Defensive Programming: Error handling and validation
 * 4. Memory Management: Proper cleanup and resource management
 * 5. Separation of Concerns: Pure data layer, no UI logic
 */
export class MatchStackManager {
  private userId: string;
  private matchCache: Map<string, PotentialMatch> = new Map();
  private viewedMatchIds: Set<string> = new Set();
  private currentFilters: MatchFilters | null = null;
  private isLoading: boolean = false;
  private lastLoadTime: number = 0;
  private preloadPromise: Promise<PotentialMatch[]> | null = null;
  private nextCursor: string | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Load initial batch of matches based on filters
   */
  async loadInitialMatches(filters: MatchFilters = {}): Promise<PotentialMatch[]> {
    if (this.isLoading) {
      throw createStellerError('NETWORK_RATE_LIMITED', 'Match loading already in progress');
    }

    this.isLoading = true;
    this.currentFilters = { ...filters, cursor: null };
    this.lastLoadTime = Date.now();
    this.nextCursor = null;
    this.matchCache.clear();
    this.viewedMatchIds.clear();

    try {
      const { matches, nextCursor } = await this.fetchMatches(filters);
      
      // Cache all matches
      matches.forEach(match => {
        this.matchCache.set(match.id, match);
      });

      this.nextCursor = nextCursor ?? null;

      return matches;
    } catch (error) {
      throw convertToStellerError(error, { message: 'Failed to load initial matches' });
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get next batch of matches (pagination)
   */
  async getNextMatches(limit: number = 5): Promise<PotentialMatch[]> {
    if (!this.currentFilters) {
      return [];
    }

    if (!this.nextCursor) {
      return [];
    }

    try {
      const filters = {
        ...this.currentFilters,
        limit,
        cursor: this.nextCursor,
        pageSize: limit,
      };

      // Exclude already viewed matches
      const excludeIds = Array.from(this.viewedMatchIds);
      if (!filters.cursor && this.nextCursor) {
        filters.cursor = this.nextCursor;
      }

      const { matches, nextCursor } = await this.fetchMatches(filters, excludeIds);

      this.nextCursor = nextCursor ?? null;

      // Cache new matches
      matches.forEach(match => {
        this.matchCache.set(match.id, match);
      });

      if (matches.length === 0) {
        this.nextCursor = null;
      }

      return matches;
    } catch (error) {
      logError('Error fetching next matches:', "Error", error);
      return [];
    }
  }

  /**
   * Preload next batch in background for smooth UX
   */
  async preloadNextBatch(): Promise<void> {
    if (this.preloadPromise || !this.nextCursor) {
      return; // Already preloading
    }

    this.preloadPromise = this.getNextMatches(3);
    
    try {
      await this.preloadPromise;
    } catch (error) {
      logError('Error preloading matches:', "Error", error);
    } finally {
      this.preloadPromise = null;
    }
  }

  /**
   * Record swipe action and handle match detection
   */
  async recordSwipe(swipedUserId: string, swipeType: 'like' | 'pass'): Promise<SwipeResult> {
    try {
      // Mark as viewed
      this.viewedMatchIds.add(swipedUserId);

      // Validate input
      if (!swipedUserId || !['like', 'pass'].includes(swipeType)) {
        throw createValidationError(
          'VALIDATION_INVALID_FORMAT',
          { fields: { swipe: ['Invalid parameters'] } },
          'Invalid swipe parameters'
        );
      }

      // Call backend swipe endpoint
      const { data, error } = await supabase.functions.invoke('record-swipe', {
        body: {
          swiped_id: swipedUserId,
          swipe_type: swipeType,
        },
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0',
        }
      });

      if (error) {
        throw createNetworkError('NETWORK_FAILED', { url: 'record-swipe' }, `Swipe recording failed: ${error.message}`);
      }

      // Return structured result
      const result: SwipeResult = {
        swipe: data.swipe,
        match: {
          match_created: data.match?.match_created || false,
          match_details: data.match?.match_details || null,
        }
      };

      // Log swipe action for analytics
      this.logSwipeAction(swipedUserId, swipeType, result.match.match_created);

      return result;
    } catch (error) {
      throw convertToStellerError(error, { message: 'Failed to record swipe' });
    }
  }

  /**
   * Get match from cache
   */
  getMatchFromCache(matchId: string): PotentialMatch | null {
    return this.matchCache.get(matchId) || null;
  }

  /**
   * Check if match has been viewed
   */
  hasBeenViewed(matchId: string): boolean {
    return this.viewedMatchIds.has(matchId);
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { cacheSize: number; viewedCount: number; isLoading: boolean } {
    return {
      cacheSize: this.matchCache.size,
      viewedCount: this.viewedMatchIds.size,
      isLoading: this.isLoading,
    };
  }

  /**
   * Clear cache and reset state
   */
  clearCache(): void {
    this.matchCache.clear();
    this.viewedMatchIds.clear();
    this.currentFilters = null;
    this.preloadPromise = null;
    this.isLoading = false;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearCache();
  }

  /**
   * Fetch matches from backend
   * @private
   */
  private async fetchMatches(
    filters: MatchFilters,
    excludeIds: string[] = []
  ): Promise<{ matches: PotentialMatch[]; nextCursor: string | null }> {
    try {
      // Build request payload expected by the edge function
      const payload: Record<string, unknown> = {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? filters.limit ?? 5,
      };

      if (filters.cursor) {
        payload.cursor = filters.cursor;
      }

      if (filters.zodiacSign) {
        payload.zodiac_sign = filters.zodiacSign;
      }

      if (filters.dateActivity) {
        payload.activity_type = filters.dateActivity;
      }

      if (typeof filters.minAge === 'number') {
        payload.min_age = filters.minAge;
      }

      if (typeof filters.maxAge === 'number') {
        payload.max_age = filters.maxAge;
      }

      if (typeof filters.maxDistance === 'number') {
        payload.max_distance_km = filters.maxDistance;
      }

      if (filters.refresh) {
        payload.refresh = true;
      }

      if (excludeIds.length > 0) {
        payload.exclude_user_ids = excludeIds;
      }

      // Call optimized matching endpoint with filters
      const { data, error } = await supabase.functions.invoke('get-potential-matches-optimized', {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (error) {
        throw createNetworkError('NETWORK_FAILED', { url: 'get-potential-matches-optimized' }, `Failed to fetch matches: ${error.message}`);
      }

      // Log API response structure for debugging
      logDebug('API Response:', "Debug", {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        dataLength: Array.isArray(data?.data) ? data.data.length : 0
      });

      if (!data?.data) {
        logDebug('No matches returned from API', "Debug");
        return { matches: [], nextCursor: null };
      }

      // Transform backend data to frontend format
      const matches: PotentialMatch[] = data.data.map((match: any) => ({
        id: match.id,
        display_name: match.display_name,
        avatar_url: match.avatar_url,
        bio: match.bio,
        age: match.age,
        interests: match.interests || [],
        traits: match.traits || [],
        zodiac_sign: match.zodiac_sign,
        compatibility_score: match.compatibility_score,
        distance: typeof match.distance === 'number' ? match.distance : match.distance_km,
        distance_km: typeof match.distance_km === 'number' ? match.distance_km : undefined,
        date_activity: match.date_activity,
        is_match_recommended: match.is_match_recommended,
      }));

      const nextCursor = data.pagination?.nextCursor ?? null;

      return { matches, nextCursor };
    } catch (error: any) {
      throw convertToStellerError(error, { message: 'Network error while fetching matches' });
    }
  }

  /**
   * Log swipe action for analytics
   * @private
   */
  private logSwipeAction(swipedUserId: string, swipeType: 'like' | 'pass', isMatch: boolean): void {
    try {
      // Log to analytics service (PostHog, etc.)
      const eventData = {
        swiper_id: this.userId,
        swiped_id: swipedUserId,
        swipe_type: swipeType,
        is_match: isMatch,
        timestamp: new Date().toISOString(),
        filters: this.currentFilters,
      };

      logDebug('Swipe action logged:', "Debug", eventData);
      
      // Track swipe action with PostHog analytics
      if (swipeType === 'like') {
        trackUserJourney.userApproved(swipedUserId, 'swipe', 'discover');
      } else if (swipeType === 'pass') {
        trackUserJourney.userRejected(swipedUserId, 'swipe', 'discover');
      }
    } catch (error) {
      logError('Failed to log swipe action:', "Error", error);
      // Don't throw - analytics failures shouldn't break core functionality
    }
  }
}
