import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock providers wrapper for tests
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
};

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Re-export everything from React Native Testing Library
export * from '@testing-library/react-native';

// Override render method with our custom version
export { customRender as render };

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: 'test-profile-id',
  user_id: 'test-user-id',
  full_name: 'Test User',
  birth_date: '1990-01-01',
  gender: 'non-binary',
  looking_for: ['women', 'men'],
  location: 'San Francisco, CA',
  bio: 'Test bio',
  photos: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() + 3600000,
  token_type: 'bearer',
  user: createMockUser(),
  ...overrides,
});

export const createMockInviteStatus = (overrides = {}) => ({
  user_id: 'test-user-id',
  invites_remaining: 5,
  invites_total: 5,
  is_premium: false,
  reset_at: new Date(Date.now() + 86400000).toISOString(),
  last_reset: new Date().toISOString(),
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockCustomerInfo = (overrides = {}) => ({
  originalAppUserId: 'test-user-id',
  originalApplicationVersion: '1.0',
  originalPurchaseDate: '2024-01-01T00:00:00Z',
  firstSeen: '2024-01-01T00:00:00Z',
  requestDate: new Date().toISOString(),
  latestExpirationDate: null,
  activeSubscriptions: [],
  allExpirationDates: {},
  allPurchaseDates: {},
  allPurchasedProductIdentifiers: [],
  entitlements: {
    all: {},
    active: {},
  },
  nonSubscriptionTransactions: [],
  managementURL: null,
  ...overrides,
});

export const createMockMatch = (overrides = {}) => ({
  id: 'test-match-id',
  user1_id: 'test-user-1',
  user2_id: 'test-user-2',
  status: 'active',
  matched_at: new Date().toISOString(),
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockInvite = (overrides = {}) => ({
  id: 'test-invite-id',
  from_user_id: 'test-user-1',
  to_user_id: 'test-user-2',
  status: 'pending',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Async utilities
export const waitForAsync = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const flushPromises = () =>
  new Promise((resolve) => setImmediate(resolve));

// Mock timers utilities
export const advanceTimersByTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
};

export const runAllTimers = () => {
  jest.runAllTimers();
};

export const runOnlyPendingTimers = () => {
  jest.runOnlyPendingTimers();
};

// Navigation test helpers
export const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getState: jest.fn(() => ({ routes: [] })),
};

export const mockRoute = {
  key: 'test-route',
  name: 'TestScreen',
  params: {},
};

// Supabase test helpers
export const createSupabaseError = (message: string, code?: string) => ({
  message,
  details: 'Test error details',
  hint: 'Test error hint',
  code: code || 'TEST_ERROR',
});

// RevenueCat test helpers
export const createPurchasesError = (
  code: number,
  message: string,
  underlyingErrorMessage?: string
) => ({
  code,
  message,
  readableErrorCode: 'TEST_ERROR',
  userCancelled: code === 1,
  underlyingErrorMessage,
});

// Assertion helpers
export const expectToBeVisible = (element: any) => {
  expect(element).toBeTruthy();
  expect(element).not.toBeNull();
};

export const expectToHaveText = (element: any, text: string) => {
  expect(element).toHaveTextContent(text);
};

// Date utilities for testing
export const createDateInFuture = (hours: number) =>
  new Date(Date.now() + hours * 3600000).toISOString();

export const createDateInPast = (hours: number) =>
  new Date(Date.now() - hours * 3600000).toISOString();

// Storage mock helpers
export const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
};
