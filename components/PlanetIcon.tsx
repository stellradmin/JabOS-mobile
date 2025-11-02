import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

interface PlanetIconProps {
  planetName: string;
  size?: number;
}

// Append U+FE0E (text presentation selector) to avoid emoji rendering
const txt = (s: string) => `${s}\uFE0E`;
const PLANET_GLYPHS: Record<string, string> = {
  sun: txt('☉'),
  moon: txt('☽'),
  mercury: txt('☿'),
  venus: txt('♀'),
  earth: txt('♁'),
  mars: txt('♂'),
  jupiter: txt('♃'),
  saturn: txt('♄'),
  uranus: txt('♅'),
  neptune: txt('♆'),
  pluto: txt('♇'),
  ascendant: txt('↑'),
};

const PlanetIcon: React.FC<PlanetIconProps> = ({ planetName, size = 20 }) => {
  const normalizedName = planetName?.toLowerCase?.() || '';

  // First try to use a bundled asset from assets/images/planets if you add them later
  // We keep this static mapping to enable packager to include files when present.
  const imageMap: Record<string, any> = {
    // Example expected locations (not required to exist):
    // sun: require('../assets/images/planets/sun.png'),
    // moon: require('../assets/images/planets/moon.png'),
  };

  let imageSource: any | null = null;
  try {
    imageSource = imageMap[normalizedName] ?? null;
  } catch (error) {
    logWarn(`Failed to load planet image for ${planetName}`, 'Warning', error);
  }

  const glyph = PLANET_GLYPHS[normalizedName];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={[styles.icon, { width: size - 4, height: size - 4 }]}
          resizeMode="contain"
        />
      ) : glyph ? (
        <View style={[styles.placeholderIcon, { width: size - 4, height: size - 4 }] }>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: 'Geist-Regular',
              color: 'black',
              fontSize: Math.round((size - 6) * 0.9),
              lineHeight: Math.round((size - 6) * 0.95),
              textAlign: 'center',
              includeFontPadding: false as any,
            }}
          >
            {glyph}
          </Text>
        </View>
      ) : (
        <View style={[
          styles.placeholderIcon,
          { width: size - 4, height: size - 4, backgroundColor: 'lightgray' },
        ]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "black",
  },
  icon: {
    borderRadius: 6,
  },
  placeholderIcon: {
    borderRadius: 6,
    borderWidth: 0, // Avoid double outline (outer container already has border)
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PlanetIcon;
