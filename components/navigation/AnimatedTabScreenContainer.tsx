import React from 'react';
import { View } from 'react-native';

// Navigation transitions disabled: render content without animations
const AnimatedTabScreenContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <View style={{ flex: 1 }}>{children}</View>;
};

export default AnimatedTabScreenContainer;
