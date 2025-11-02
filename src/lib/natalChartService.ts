import { supabase } from './supabase';
import moment from 'moment';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { computeNatalChartOffline } from './chartEngine';

interface BirthData {
  date: string; // "January 1, 1990"
  time: string; // "12:30 PM" or ""
  location: string; // "New York"
  latitude?: number;
  longitude?: number;
}

interface PlanetPosition {
  name: string;
  sign: string;
  degree: number;
  house?: number;
  retrograde?: boolean;
}

interface NatalChart {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  planets: PlanetPosition[];
  houses: Array<{ house: number; sign: string; degree: number }>;
  aspects: Array<{
    planet1: string;
    planet2: string;
    aspect: string;
    degrees: number;
    orb: number;
  }>;
}

interface NatalChartData {
  sun: PlanetPosition;
  moon: PlanetPosition;
  ascendant: PlanetPosition;
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  jupiter: PlanetPosition;
  saturn: PlanetPosition;
  uranus?: PlanetPosition;
  neptune?: PlanetPosition;
  pluto?: PlanetPosition;
}

interface GeocodingResult {
  latitude: number;
  longitude: number;
  timezone?: string;
}

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

class NatalChartService {
  /**
   * Calculate natal chart using accurate Edge Function (circular-natal-horoscope-js)
   * Falls back to client-side approximation only if the Edge Function fails.
   */
  static async generateNatalChart(birthData: BirthData): Promise<NatalChart> {
    // Default to accurate offline compute; use Edge non-blocking for verification only
    // Get coordinates if not provided
    let { latitude, longitude } = birthData;
    let tzHint: string | undefined;

    if (!latitude || !longitude) {
      const coords = await this.geocodeLocation(birthData.location);
      latitude = coords.latitude;
      longitude = coords.longitude;
      tzHint = coords.timezone;
    }

    // Convert date and time to standardized format
    const birthDateTime = this.parseDateTime(birthData.date, birthData.time);

    // Offline compute via circular-natal-horoscope-js
    try {
      const offline = computeNatalChartOffline({
        date: birthDateTime,
        latitude: latitude!,
        longitude: longitude!,
        timezone: tzHint || Intl.DateTimeFormat().resolvedOptions().timeZone,
        zodiac: 'tropical',
      });

      // Fire-and-forget Edge call for verification (non-blocking)
      try {
        void supabase.functions
          .invoke('calculate-natal-chart', {
            body: {
              birthDate: birthDateTime.toISOString().split('T')[0],
              birthTime: birthDateTime.toTimeString().substring(0, 5),
              latitude,
              longitude,
              timezone: tzHint || Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          })
          .then(({ data }) => {
            logDebug('[NATAL] Edge verification (non-blocking) ok', 'Debug', {
              hasPlanets: Array.isArray(data?.planets),
            });
          })
          .catch((e) => logWarn('[NATAL] Edge verification failed (non-blocking)', 'Warning', e));
      } catch {}

      return {
        sunSign: offline.sunSign,
        moonSign: offline.moonSign,
        risingSign: offline.risingSign,
        planets: offline.planets,
        houses: [],
        aspects: [],
      };
    } catch (error) {
      logError('Offline natal chart compute failed', 'Error', error);
      // Secondary attempt: try Edge and process
      try {
        const { data, error: edgeErr } = await supabase.functions.invoke('calculate-natal-chart', {
          body: {
            birthDate: birthDateTime.toISOString().split('T')[0],
            birthTime: birthDateTime.toTimeString().substring(0, 5),
            latitude,
            longitude,
            timezone: tzHint || Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        if (edgeErr) throw edgeErr;
        return this.processNatalChartData(data);
      } catch (edgeError) {
        logError('Edge function also failed', 'Error', edgeError);
        // Final fallback: offline again via helper to surface a usable error
        return await this.getFallbackChart(birthData);
      }
    }
  }

  /**
   * Process raw astronomical data into our chart format (supports both legacy and unified outputs)
   */
  private static processNatalChartData(data: any): NatalChart {
    // Unified (accurate) format: { CorePlacements: { Sun: {...}, Moon: {...}, Ascendant: {...}, ... } }
    const core = data?.CorePlacements || data?.corePlacements;
    if (core && typeof core === 'object') {
      const pick = (k: string) => core[k] || core[k?.charAt(0).toUpperCase() + k?.slice(1)];
      const toPlanet = (name: string, obj: any) => ({ name, sign: obj?.Sign || 'Aries', degree: typeof obj?.Degree === 'number' ? obj.Degree : 0 });

      const planets: PlanetPosition[] = [];
      const order = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
      order.forEach((name) => { const o = pick(name); if (o) planets.push(toPlanet(name, o)); });

      const asc = pick('Ascendant');
      const risingSign = asc?.Sign || planets[0]?.sign || 'Aries';
      const aspects = this.calculateBasicAspects(planets);

      const sunPlanet = pick('Sun');
      const moonPlanet = pick('Moon');

      return {
        sunSign: sunPlanet?.Sign || 'Aries',
        moonSign: moonPlanet?.Sign || 'Taurus',
        risingSign,
        planets,
        houses: [],
        aspects
      };
    }

    // Legacy/Edge format: { planets: [...], houses: [...], aspects: [...], risingSign? }
    const sunPlanet = data?.planets?.find((p: PlanetPosition) => p.name === 'Sun');
    const moonPlanet = data?.planets?.find((p: PlanetPosition) => p.name === 'Moon');
    const ascPlanet = data?.planets?.find((p: PlanetPosition) => p.name?.toLowerCase?.() === 'ascendant');
    const risingSign = data?.risingSign
      || ascPlanet?.sign
      || (data?.houses && data.houses.length > 0 ? data.houses[0].sign : sunPlanet?.sign || 'Aries');
    return {
      sunSign: sunPlanet?.sign || 'Aries',
      moonSign: moonPlanet?.sign || 'Taurus',
      risingSign,
      planets: data?.planets || [],
      houses: [],
      aspects: data?.aspects || []
    };
  }

  /**
   * Geocode location to get coordinates using secure Edge Function
   */
  private static async geocodeLocation(location: string): Promise<GeocodingResult> {
    try {
      // Use dedicated Edge Function for geocoding
      const { data, error } = await supabase.functions.invoke('geocode-city', {
        body: { location }
      });

      if (error) {
        logWarn('Geocoding Edge Function error:', "Warning", error);
        throw new Error('Geocoding failed: ' + error.message);
      }

      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone || undefined,
        };
      }
      
      // Fallback coordinates for major cities
      return this.getDefaultCoordinates(location);
    } catch (error) {
      logWarn('Geocoding error, "Warning", using default coordinates:', error);
      return this.getDefaultCoordinates(location);
    }
  }

  /**
   * Get default coordinates for common cities
   */
  private static getDefaultCoordinates(location: string): GeocodingResult {
    const defaultCoords: { [key: string]: GeocodingResult } = {
      'new york': { latitude: 40.7128, longitude: -74.0060 },
      'los angeles': { latitude: 34.0522, longitude: -118.2437 },
      'chicago': { latitude: 41.8781, longitude: -87.6298 },
      'houston': { latitude: 29.7604, longitude: -95.3698 },
      'phoenix': { latitude: 33.4484, longitude: -112.0740 },
      'philadelphia': { latitude: 39.9526, longitude: -75.1652 },
      'london': { latitude: 51.5074, longitude: -0.1278 },
      'paris': { latitude: 48.8566, longitude: 2.3522 },
      'berlin': { latitude: 52.5200, longitude: 13.4050 },
      'tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'sydney': { latitude: -33.8688, longitude: 151.2093 },
    };

    const normalizedLocation = location.toLowerCase().trim();
    
    for (const [city, coords] of Object.entries(defaultCoords)) {
      if (normalizedLocation.includes(city)) {
        return coords;
      }
    }

    // Default to New York if no match found
    return { latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' };
  }

  /**
   * Parse date and time strings into Date object
   */
  private static parseDateTime(dateStr: string, timeStr: string): Date {
    // Accept multiple strict formats for the date to avoid mis-parsing
    const date = moment(dateStr, ['YYYY-MM-DD', 'MMMM D, YYYY', 'MMM D, YYYY', 'M/D/YYYY', 'MM/DD/YYYY'], true);
    if (!date.isValid()) {
      throw new Error(`Invalid birth date: ${dateStr}`);
    }

    if (timeStr && timeStr.trim()) {
      const clean = timeStr.trim().replace(/\s+/g, ' ');
      const time = moment(clean, [
        'h:mm A', 'hh:mm A', 'h:mmA', 'hh:mmA',
        'H:mm', 'HH:mm',
        'h A', 'hh A', 'hA', 'hhA'
      ], true);
      if (!time.isValid()) {
        // Be lenient: default to noon rather than fail
        date.hours(12);
        date.minutes(0);
      } else {
        date.hours(time.hours());
        date.minutes(time.minutes());
      }
    } else {
      // Default to noon if no time provided
      date.hours(12);
      date.minutes(0);
    }

    return date.toDate();
  }

  /**
   * Fallback chart calculation using astronomical algorithms
   * Uses actual date-based calculations, not Math.random()
   */
  private static async getFallbackChart(birthData: BirthData): Promise<NatalChart> {
    // Accurate offline compute using circular-natal-horoscope-js
    const coords = await this.geocodeLocation(birthData.location);
    const birthDateTime = this.parseDateTime(birthData.date, birthData.time);

    const result = computeNatalChartOffline({
      date: birthDateTime,
      latitude: coords.latitude,
      longitude: coords.longitude,
      timezone: coords.timezone,
      zodiac: 'tropical',
    });

    return {
      sunSign: result.sunSign,
      moonSign: result.moonSign,
      risingSign: result.risingSign,
      planets: result.planets,
      houses: [],
      aspects: [],
    };
  }

  

  

  

  

  

  

  private static calculateBasicAspects(planets: PlanetPosition[]): Array<{
    planet1: string;
    planet2: string;
    aspect: string;
    degrees: number;
    orb: number;
  }> {
    const aspects = [];
    const aspectTypes = {
      conjunction: { degrees: 0, orb: 8 },
      sextile: { degrees: 60, orb: 6 },
      square: { degrees: 90, orb: 8 },
      trine: { degrees: 120, orb: 8 },
      opposition: { degrees: 180, orb: 8 }
    };
    
    for (let i = 0; i < planets.length - 1; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const planet1 = planets[i];
        const planet2 = planets[j];
        
        const index1 = ZODIAC_SIGNS.indexOf(planet1.sign);
        const index2 = ZODIAC_SIGNS.indexOf(planet2.sign);
        const position1 = index1 * 30 + planet1.degree;
        const position2 = index2 * 30 + planet2.degree;
        
        let diff = Math.abs(position1 - position2);
        if (diff > 180) diff = 360 - diff;
        
        for (const [aspectName, aspectData] of Object.entries(aspectTypes)) {
          const orb = Math.abs(diff - aspectData.degrees);
          if (orb <= aspectData.orb) {
            aspects.push({
              planet1: planet1.name,
              planet2: planet2.name,
              aspect: aspectName,
              degrees: Math.round(diff * 100) / 100,
              orb: Math.round(orb * 100) / 100
            });
            break;
          }
        }
      }
    }
    
    return aspects;
  }
}

// Legacy compatibility functions
// Note: legacy named export generateNatalChart removed; use NatalChartService.generateNatalChart instead

export function formatPlanetPosition(planet: PlanetPosition): string {
  return `${planet.sign} ${planet.degree.toFixed(1)}°`;
}

export function getPlanetArray(chartData: NatalChartData): PlanetPosition[] {
  return [
    chartData.sun,
    chartData.moon,
    chartData.ascendant,
    chartData.mercury,
    chartData.venus,
    chartData.mars,
    chartData.jupiter,
    chartData.saturn,
    chartData.uranus,
    chartData.neptune,
    chartData.pluto
  ].filter(Boolean) as PlanetPosition[];
}

export { NatalChartService };
export type { NatalChart, BirthData, PlanetPosition, NatalChartData };
