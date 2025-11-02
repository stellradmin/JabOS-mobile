// Central place to silence known, non-actionable warnings in dev
import { LogBox } from 'react-native';

// Ignore deprecation noise that comes from transitive deps during development
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated and will be removed in a future release.',
]);
