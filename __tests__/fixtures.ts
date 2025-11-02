// Test fixtures with realistic data for comprehensive testing

export const TEST_USERS = {
  freeUser: {
    id: 'free-user-123',
    email: 'free@test.com',
    created_at: '2024-01-01T00:00:00Z',
    is_premium: false,
    subscription_status: null,
  },
  premiumUser: {
    id: 'premium-user-456',
    email: 'premium@test.com',
    created_at: '2024-01-01T00:00:00Z',
    is_premium: true,
    subscription_status: 'active',
    subscription_expires_at: '2025-01-01T00:00:00Z',
  },
  newUser: {
    id: 'new-user-789',
    email: 'new@test.com',
    created_at: new Date().toISOString(),
    is_premium: false,
    subscription_status: null,
  },
};

export const TEST_PROFILES = {
  complete: {
    id: 'profile-complete-123',
    user_id: TEST_USERS.freeUser.id,
    full_name: 'Alex Johnson',
    birth_date: '1995-03-15',
    gender: 'non-binary',
    looking_for: ['women', 'men', 'non-binary'],
    location: 'San Francisco, CA',
    latitude: 37.7749,
    longitude: -122.4194,
    bio: 'Adventure seeker, coffee enthusiast, and stargazer. Looking for meaningful connections.',
    photos: [
      { url: 'https://example.com/photo1.jpg', order: 0 },
      { url: 'https://example.com/photo2.jpg', order: 1 },
    ],
    height: 170,
    education: 'Graduate Degree',
    occupation: 'Software Engineer',
    zodiac_sign: 'Pisces',
    birth_chart_data: {
      sun: 'Pisces',
      moon: 'Leo',
      rising: 'Scorpio',
    },
    interests: ['hiking', 'photography', 'astrology', 'yoga'],
    persona_verification_status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  incomplete: {
    id: 'profile-incomplete-456',
    user_id: TEST_USERS.newUser.id,
    full_name: 'Jordan Smith',
    birth_date: '1998-07-20',
    gender: 'woman',
    looking_for: ['men'],
    location: null,
    latitude: null,
    longitude: null,
    bio: null,
    photos: [],
    height: null,
    education: null,
    occupation: null,
    zodiac_sign: 'Cancer',
    birth_chart_data: null,
    interests: [],
    persona_verification_status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

export const TEST_INVITE_STATUSES = {
  freeWithInvites: {
    user_id: TEST_USERS.freeUser.id,
    invites_remaining: 3,
    invites_total: 5,
    is_premium: false,
    reset_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
    last_reset: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  freeExhausted: {
    user_id: TEST_USERS.freeUser.id,
    invites_remaining: 0,
    invites_total: 5,
    is_premium: false,
    reset_at: new Date(Date.now() + 86400000).toISOString(),
    last_reset: new Date(Date.now() - 3600000).toISOString(),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  premiumUnlimited: {
    user_id: TEST_USERS.premiumUser.id,
    invites_remaining: 20,
    invites_total: 20,
    is_premium: true,
    reset_at: new Date(Date.now() + 86400000).toISOString(),
    last_reset: new Date(Date.now() - 3600000).toISOString(),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  needsReset: {
    user_id: TEST_USERS.freeUser.id,
    invites_remaining: 2,
    invites_total: 5,
    is_premium: false,
    reset_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (needs reset)
    last_reset: new Date(Date.now() - 90000000).toISOString(), // More than 24 hours ago
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date(Date.now() - 90000000).toISOString(),
  },
};

export const TEST_MATCHES = {
  active: {
    id: 'match-active-123',
    user1_id: TEST_USERS.freeUser.id,
    user2_id: 'other-user-123',
    status: 'active',
    matched_at: new Date(Date.now() - 3600000).toISOString(),
    last_message_at: new Date(Date.now() - 600000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 600000).toISOString(),
  },
  recent: {
    id: 'match-recent-456',
    user1_id: TEST_USERS.premiumUser.id,
    user2_id: 'other-user-456',
    status: 'active',
    matched_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    last_message_at: null,
    created_at: new Date(Date.now() - 60000).toISOString(),
    updated_at: new Date(Date.now() - 60000).toISOString(),
  },
};

export const TEST_INVITES = {
  pending: {
    id: 'invite-pending-123',
    from_user_id: TEST_USERS.freeUser.id,
    to_user_id: 'other-user-789',
    status: 'pending',
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
  },
  accepted: {
    id: 'invite-accepted-456',
    from_user_id: TEST_USERS.freeUser.id,
    to_user_id: 'other-user-101',
    status: 'accepted',
    created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    accepted_at: new Date(Date.now() - 3600000).toISOString(),
    expires_at: new Date(Date.now() + 82800000).toISOString(),
  },
  declined: {
    id: 'invite-declined-789',
    from_user_id: TEST_USERS.freeUser.id,
    to_user_id: 'other-user-202',
    status: 'declined',
    created_at: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
    updated_at: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
    declined_at: new Date(Date.now() - 10800000).toISOString(),
    expires_at: new Date(Date.now() + 72000000).toISOString(),
  },
};

export const TEST_PACKAGES = {
  monthly: {
    identifier: 'monthly_subscription',
    packageType: 'MONTHLY',
    product: {
      identifier: 'stellr_monthly_9_99',
      description: 'Monthly Premium Subscription',
      title: 'Stellr Premium Monthly',
      price: 9.99,
      priceString: '$9.99',
      currencyCode: 'USD',
      productCategory: 'SUBSCRIPTION',
      productType: 'SUBS',
      subscriptionPeriod: 'P1M',
    },
    offeringIdentifier: 'default',
  },
  annual: {
    identifier: 'annual_subscription',
    packageType: 'ANNUAL',
    product: {
      identifier: 'stellr_annual_79_99',
      description: 'Annual Premium Subscription',
      title: 'Stellr Premium Annual',
      price: 79.99,
      priceString: '$79.99',
      currencyCode: 'USD',
      productCategory: 'SUBSCRIPTION',
      productType: 'SUBS',
      subscriptionPeriod: 'P1Y',
    },
    offeringIdentifier: 'default',
  },
};

export const TEST_CUSTOMER_INFO = {
  free: {
    originalAppUserId: TEST_USERS.freeUser.id,
    originalApplicationVersion: '1.0.0',
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
  },
  premium: {
    originalAppUserId: TEST_USERS.premiumUser.id,
    originalApplicationVersion: '1.0.0',
    originalPurchaseDate: '2024-01-01T00:00:00Z',
    firstSeen: '2024-01-01T00:00:00Z',
    requestDate: new Date().toISOString(),
    latestExpirationDate: '2025-01-01T00:00:00Z',
    activeSubscriptions: ['stellr_monthly_9_99'],
    allExpirationDates: {
      stellr_monthly_9_99: '2025-01-01T00:00:00Z',
    },
    allPurchaseDates: {
      stellr_monthly_9_99: '2024-01-01T00:00:00Z',
    },
    allPurchasedProductIdentifiers: ['stellr_monthly_9_99'],
    entitlements: {
      all: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: true,
          productIdentifier: 'stellr_monthly_9_99',
          expirationDate: '2025-01-01T00:00:00Z',
        },
      },
      active: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: true,
          productIdentifier: 'stellr_monthly_9_99',
          expirationDate: '2025-01-01T00:00:00Z',
        },
      },
    },
    nonSubscriptionTransactions: [],
    managementURL: 'https://apps.apple.com/account/subscriptions',
  },
};

export const TEST_MESSAGES = {
  text: {
    id: 'message-text-123',
    match_id: TEST_MATCHES.active.id,
    sender_id: TEST_USERS.freeUser.id,
    content: 'Hey! How are you?',
    type: 'text',
    created_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    read_at: null,
  },
  read: {
    id: 'message-read-456',
    match_id: TEST_MATCHES.active.id,
    sender_id: 'other-user-123',
    content: 'I am great, thanks for asking!',
    type: 'text',
    created_at: new Date(Date.now() - 240000).toISOString(), // 4 minutes ago
    read_at: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago (read)
  },
};

// Consolidated test data export
export const TEST_DATA = {
  users: TEST_USERS,
  profiles: TEST_PROFILES,
  inviteStatuses: TEST_INVITE_STATUSES,
  matches: TEST_MATCHES,
  invites: TEST_INVITES,
  packages: TEST_PACKAGES,
  customerInfo: TEST_CUSTOMER_INFO,
  messages: TEST_MESSAGES,
};
