// Mock @react-native-google-signin/google-signin for testing

const mockUser = {
  idToken: 'mock-id-token',
  serverAuthCode: 'mock-server-auth-code',
  scopes: [],
  user: {
    email: 'test@example.com',
    id: 'mock-google-user-id',
    givenName: 'Test',
    familyName: 'User',
    photo: 'https://example.com/photo.jpg',
    name: 'Test User',
  },
};

export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(() => Promise.resolve(true)),
  signIn: jest.fn(() => Promise.resolve({ type: 'success', data: mockUser })),
  signInSilently: jest.fn(() => Promise.resolve(mockUser)),
  signOut: jest.fn(() => Promise.resolve()),
  revokeAccess: jest.fn(() => Promise.resolve()),
  isSignedIn: jest.fn(() => Promise.resolve(false)),
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
  getTokens: jest.fn(() =>
    Promise.resolve({
      idToken: 'mock-id-token',
      accessToken: 'mock-access-token',
    })
  ),
  clearCachedAccessToken: jest.fn(() => Promise.resolve()),
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

// Export mock user for test assertions
export const mockGoogleUser = mockUser;

// Helper to reset mocks
export const resetGoogleSignInMocks = () => {
  jest.clearAllMocks();
};
