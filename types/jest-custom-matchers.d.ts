// Adds typings for custom jest-native matchers used in our tests
import '@testing-library/jest-native/extend-expect';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAccessible(): R;
      toMeetTouchTargetSize(): R;
    }
  }
}

