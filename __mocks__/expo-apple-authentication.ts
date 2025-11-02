// Mock expo-apple-authentication for testing

export const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1,
};

export const AppleAuthenticationUserDetectionStatus = {
  UNSUPPORTED: 0,
  UNKNOWN: 1,
  LIKELY_REAL: 2,
};

export const AppleAuthenticationCredentialState = {
  REVOKED: 0,
  AUTHORIZED: 1,
  NOT_FOUND: 2,
  TRANSFERRED: 3,
};

const mockCredential = {
  user: 'mock-apple-user-id',
  email: 'test@privaterelay.appleid.com',
  fullName: {
    givenName: 'Test',
    familyName: 'User',
    middleName: null,
    namePrefix: null,
    nameSuffix: null,
    nickname: null,
  },
  realUserStatus: AppleAuthenticationUserDetectionStatus.LIKELY_REAL,
  state: null,
  identityToken: 'mock-identity-token',
  authorizationCode: 'mock-authorization-code',
};

export const isAvailableAsync = jest.fn(() => Promise.resolve(true));

export const signInAsync = jest.fn(() => Promise.resolve(mockCredential));

export const getCredentialStateAsync = jest.fn(() =>
  Promise.resolve(AppleAuthenticationCredentialState.AUTHORIZED)
);

export const signOutAsync = jest.fn(() => Promise.resolve());

export const AppleAuthenticationButton = jest.fn(({ onPress }) => null);

// Export mock credential for test assertions
export const mockAppleCredential = mockCredential;

// Helper to reset mocks
export const resetAppleAuthMocks = () => {
  jest.clearAllMocks();
};
