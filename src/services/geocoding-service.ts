import { supabase } from '../lib/supabase';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export class FrontendGeocodingService {
  static async geocodeLocation(location: string): Promise<GeocodeResult | null> {
    try {
      const { data, error } = await supabase.functions.invoke('geocode-city', {
        body: { location },
      });
      if (error) return null;
      if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
        return { latitude: data.latitude, longitude: data.longitude };
      }
      return null;
    } catch {
      return null;
    }
  }

  static validateCoordinates(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  }
}

export default FrontendGeocodingService;
