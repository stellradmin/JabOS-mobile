// Minimal Expo-friendly wrapper around circular-natal-horoscope-js
// Returns placements-only data (no houses) suitable for Stellr UI

import { Origin, Horoscope } from 'circular-natal-horoscope-js';

export type PlanetPlacement = {
  name: string; // 'Sun', 'Moon', 'Mercury', ...
  sign: string; // 'Aries'..'Pisces'
  degree: number; // 0..29.99 within sign
};

export type NatalChartLite = {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  planets: PlanetPlacement[];
};

const SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];

export function computeNatalChartOffline(input: {
  date: Date; // Local birth date/time
  latitude: number;
  longitude: number;
  timezone?: string; // IANA TZ, optional
  zodiac?: 'tropical' | 'sidereal';
}): NatalChartLite {
  const year = input.date.getFullYear();
  const month0 = input.date.getMonth(); // 0-11
  const day = input.date.getDate();
  const hour = input.date.getHours();
  const minute = input.date.getMinutes();

  const origin = new Origin({
    year,
    month: month0,
    date: day,
    hour,
    minute,
    latitude: input.latitude,
    longitude: input.longitude,
    ...(input.timezone ? { timezone: input.timezone } : {}),
  });

  const horoscope = new Horoscope({
    origin,
    houseSystem: 'whole-sign', // ignored by our UI
    zodiac: input.zodiac ?? 'tropical',
    aspectPoints: ['bodies','points','angles'],
    aspectWithPoints: ['bodies','points','angles'],
    aspectTypes: ['major'],
    customOrbs: {},
    language: 'en'
  });

  const desiredBodies = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  const planets = desiredBodies.map((key) => {
    const item = (horoscope as any).CelestialBodies?.[key];
    const deg = item?.ChartPosition?.Ecliptic?.DecimalDegrees as number | undefined;
    if (typeof deg !== 'number') return null as any;
    const signIdx = Math.floor(deg / 30) % 12;
    const degree = deg % 30;
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    return { name, sign: SIGNS[signIdx], degree: Math.round(degree * 100) / 100 };
  }).filter(Boolean);

  const sunSign = planets.find(p => p.name === 'Sun')?.sign || 'Aries';
  const moonSign = planets.find(p => p.name === 'Moon')?.sign || 'Taurus';

  const ascDeg = (horoscope as any).Ascendant?.ChartPosition?.Ecliptic?.DecimalDegrees as number | undefined;
  const risingSign = typeof ascDeg === 'number' ? SIGNS[Math.floor(ascDeg / 30) % 12] : sunSign;

  return {
    sunSign,
    moonSign,
    risingSign,
    planets,
  };
}

