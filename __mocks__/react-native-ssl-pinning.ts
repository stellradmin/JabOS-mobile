// Mock react-native-ssl-pinning for testing

export const fetch = jest.fn((url: string, options?: any) => {
  return Promise.resolve({
    status: 200,
    statusText: 'OK',
    ok: true,
    headers: {},
    url,
    bodyString: JSON.stringify({ success: true }),
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('{"success": true}'),
  });
});

export const getCookies = jest.fn((domain: string) => {
  return Promise.resolve([]);
});

export const removeCookieByName = jest.fn((name: string) => {
  return Promise.resolve();
});

// Helper to reset mocks
export const resetSSLPinningMocks = () => {
  jest.clearAllMocks();
};
