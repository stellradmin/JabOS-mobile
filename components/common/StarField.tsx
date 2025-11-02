import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

const STAR_DEFINITIONS = {
  top: [
    { type: 'dot' as const, x: 8, y: 22, size: 1.1, opacity: 0.85 },
    { type: 'dot' as const, x: 22, y: 12, size: 1.4, opacity: 0.9 },
    { type: 'twinkle' as const, x: 34, y: 34, size: 1.1, opacity: 0.75 },
    { type: 'dot' as const, x: 46, y: 18, size: 1.2, opacity: 0.85 },
    { type: 'twinkle' as const, x: 58, y: 9, size: 1.4, opacity: 0.8 },
    { type: 'dot' as const, x: 64, y: 28, size: 1.1, opacity: 0.75 },
    { type: 'twinkle' as const, x: 74, y: 16, size: 1.2, opacity: 0.8 },
    { type: 'dot' as const, x: 82, y: 26, size: 1, opacity: 0.7 },
    { type: 'dot' as const, x: 12, y: 40, size: 0.9, opacity: 0.7 },
    { type: 'twinkle' as const, x: 88, y: 12, size: 1.5, opacity: 0.85 },
    { type: 'dot' as const, x: 30, y: 6, size: 0.8, opacity: 0.6 },
    { type: 'dot' as const, x: 68, y: 38, size: 1, opacity: 0.7 },
  ],
  bottom: [
    { type: 'dot' as const, x: 18, y: 30, size: 1.1, opacity: 0.8 },
    { type: 'twinkle' as const, x: 30, y: 12, size: 1.3, opacity: 0.8 },
    { type: 'dot' as const, x: 40, y: 26, size: 1, opacity: 0.75 },
    { type: 'dot' as const, x: 52, y: 36, size: 1.1, opacity: 0.7 },
    { type: 'twinkle' as const, x: 64, y: 18, size: 1.2, opacity: 0.8 },
    { type: 'dot' as const, x: 78, y: 32, size: 0.9, opacity: 0.65 },
    { type: 'dot' as const, x: 14, y: 48, size: 1, opacity: 0.7 },
    { type: 'twinkle' as const, x: 46, y: 8, size: 1.4, opacity: 0.85 },
    { type: 'dot' as const, x: 60, y: 44, size: 0.9, opacity: 0.7 },
    { type: 'dot' as const, x: 72, y: 50, size: 0.8, opacity: 0.6 },
    { type: 'twinkle' as const, x: 86, y: 14, size: 1.3, opacity: 0.75 },
  ],
};

const StarField = ({ style, variant = 'top' }: { style?: StyleProp<ViewStyle>; variant?: 'top' | 'bottom' }) => {
  const stars = STAR_DEFINITIONS[variant];

  return (
    <Svg
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid slice"
      style={style}
    >
      {stars.map((star, index) => {
        if (star.type === 'dot') {
          return (
            <Circle
              key={`star-dot-${variant}-${index}`}
              cx={star.x}
              cy={star.y}
              r={star.size}
              fill="rgba(242, 240, 255, 0.75)"
              opacity={star.opacity}
            />
          );
        }

        return (
          <G
            key={`star-twinkle-${variant}-${index}`}
            transform={`translate(${star.x} ${star.y}) scale(${star.size})`}
            opacity={star.opacity}
          >
            <Path
              d="M0 -2 L0.35 -0.35 L2 0 L0.35 0.35 L0 2 L-0.35 0.35 L-2 0 L-0.35 -0.35 Z"
              fill="rgba(242, 240, 255, 0.75)"
            />
          </G>
        );
      })}
    </Svg>
  );
};

export default StarField;
