// Mock Supabase client for testing

const mockFrom = jest.fn(() => mockQueryBuilder);
const mockRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));
const mockAuth = {
  getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  signInWithPassword: jest.fn(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  ),
  signUp: jest.fn(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  ),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
  signInWithIdToken: jest.fn(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  ),
  resetPasswordForEmail: jest.fn(() => Promise.resolve({ error: null })),
  updateUser: jest.fn(() =>
    Promise.resolve({ data: { user: null }, error: null })
  ),
};

const mockStorage = {
  from: jest.fn(() => ({
    upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
    download: jest.fn(() => Promise.resolve({ data: null, error: null })),
    remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test.url/image.jpg' } })),
    createSignedUrl: jest.fn(() =>
      Promise.resolve({ data: { signedUrl: 'https://test.url/signed' }, error: null })
    ),
  })),
};

const mockChannel = {
  on: jest.fn(function (this: any) {
    return this;
  }),
  subscribe: jest.fn((callback?: () => void) => {
    if (callback) callback();
    return { unsubscribe: jest.fn() };
  }),
  unsubscribe: jest.fn(),
};

const mockRealtimeClient = {
  channel: jest.fn(() => mockChannel),
  removeChannel: jest.fn(),
  removeAllChannels: jest.fn(),
  getChannels: jest.fn(() => []),
};

const mockQueryBuilder = {
  select: jest.fn(function (this: any) {
    return this;
  }),
  insert: jest.fn(function (this: any) {
    return this;
  }),
  update: jest.fn(function (this: any) {
    return this;
  }),
  delete: jest.fn(function (this: any) {
    return this;
  }),
  upsert: jest.fn(function (this: any) {
    return this;
  }),
  eq: jest.fn(function (this: any) {
    return this;
  }),
  neq: jest.fn(function (this: any) {
    return this;
  }),
  gt: jest.fn(function (this: any) {
    return this;
  }),
  gte: jest.fn(function (this: any) {
    return this;
  }),
  lt: jest.fn(function (this: any) {
    return this;
  }),
  lte: jest.fn(function (this: any) {
    return this;
  }),
  like: jest.fn(function (this: any) {
    return this;
  }),
  ilike: jest.fn(function (this: any) {
    return this;
  }),
  in: jest.fn(function (this: any) {
    return this;
  }),
  is: jest.fn(function (this: any) {
    return this;
  }),
  not: jest.fn(function (this: any) {
    return this;
  }),
  or: jest.fn(function (this: any) {
    return this;
  }),
  filter: jest.fn(function (this: any) {
    return this;
  }),
  match: jest.fn(function (this: any) {
    return this;
  }),
  order: jest.fn(function (this: any) {
    return this;
  }),
  limit: jest.fn(function (this: any) {
    return this;
  }),
  range: jest.fn(function (this: any) {
    return this;
  }),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: jest.fn((resolve) => resolve({ data: null, error: null })),
};

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc,
  auth: mockAuth,
  storage: mockStorage,
  channel: mockRealtimeClient.channel,
  removeChannel: mockRealtimeClient.removeChannel,
  removeAllChannels: mockRealtimeClient.removeAllChannels,
  getChannels: mockRealtimeClient.getChannels,
};

export const createClient = jest.fn(() => mockSupabaseClient);

// Export mock instances for test assertions
export const mockSupabase = mockSupabaseClient;
export const mockSupabaseAuth = mockAuth;
export const mockSupabaseStorage = mockStorage;
export const mockSupabaseFrom = mockFrom;
export const mockSupabaseRpc = mockRpc;
export const mockSupabaseQueryBuilder = mockQueryBuilder;
export const mockSupabaseChannel = mockChannel;

// Helper to reset all mocks
export const resetSupabaseMocks = () => {
  jest.clearAllMocks();
};
