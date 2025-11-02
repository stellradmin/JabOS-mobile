// Mock react-native-purchases for testing

const PURCHASE_TYPE = {
  SUBS: 'subs',
  INAPP: 'inapp',
};

const PACKAGE_TYPE = {
  UNKNOWN: 'UNKNOWN',
  CUSTOM: 'CUSTOM',
  LIFETIME: 'LIFETIME',
  ANNUAL: 'ANNUAL',
  SIX_MONTH: 'SIX_MONTH',
  THREE_MONTH: 'THREE_MONTH',
  TWO_MONTH: 'TWO_MONTH',
  MONTHLY: 'MONTHLY',
  WEEKLY: 'WEEKLY',
};

const ENTITLEMENT_VERIFICATION_MODE = {
  DISABLED: 'DISABLED',
  INFORMATIONAL: 'INFORMATIONAL',
  ENFORCED: 'ENFORCED',
};

const IN_APP_MESSAGE_TYPE = {
  BILLING_ISSUE: 'BILLING_ISSUE',
};

// Mock CustomerInfo
const mockCustomerInfo = {
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
};

// Mock Package
const mockPackage = {
  identifier: 'test_package',
  packageType: PACKAGE_TYPE.MONTHLY,
  product: {
    identifier: 'test_product',
    description: 'Test Product',
    title: 'Test Product Title',
    price: 9.99,
    priceString: '$9.99',
    currencyCode: 'USD',
    introPrice: null,
    discounts: null,
    productCategory: 'SUBSCRIPTION',
    productType: PURCHASE_TYPE.SUBS,
    subscriptionPeriod: 'P1M',
  },
  offeringIdentifier: 'default',
};

// Mock Offering
const mockOffering = {
  identifier: 'default',
  serverDescription: 'Default offering',
  metadata: null,
  availablePackages: [mockPackage],
  lifetime: null,
  annual: null,
  sixMonth: null,
  threeMonth: null,
  twoMonth: null,
  monthly: mockPackage,
  weekly: null,
};

// Mock Purchases class
class MockPurchases {
  static configure = jest.fn();
  static setLogLevel = jest.fn();
  static getOfferings = jest.fn(() =>
    Promise.resolve({
      all: { default: mockOffering },
      current: mockOffering,
    })
  );
  static getCustomerInfo = jest.fn(() => Promise.resolve(mockCustomerInfo));
  static purchasePackage = jest.fn(() =>
    Promise.resolve({
      customerInfo: mockCustomerInfo,
      productIdentifier: 'test_product',
    })
  );
  static restorePurchases = jest.fn(() => Promise.resolve(mockCustomerInfo));
  static syncPurchases = jest.fn(() => Promise.resolve(mockCustomerInfo));
  static logIn = jest.fn(() =>
    Promise.resolve({
      customerInfo: mockCustomerInfo,
      created: false,
    })
  );
  static logOut = jest.fn(() => Promise.resolve(mockCustomerInfo));
  static setAttributes = jest.fn(() => Promise.resolve());
  static setEmail = jest.fn(() => Promise.resolve());
  static setPhoneNumber = jest.fn(() => Promise.resolve());
  static setDisplayName = jest.fn(() => Promise.resolve());
  static setPushToken = jest.fn(() => Promise.resolve());
  static addCustomerInfoUpdateListener = jest.fn(() => jest.fn());
  static removeCustomerInfoUpdateListener = jest.fn();
  static isAnonymous = jest.fn(() => Promise.resolve(false));
  static checkTrialOrIntroductoryPriceEligibility = jest.fn(() =>
    Promise.resolve({})
  );
  static invalidateCustomerInfoCache = jest.fn(() => Promise.resolve());
  static presentCodeRedemptionSheet = jest.fn(() => Promise.resolve());
  static setSimulatesAskToBuyInSandbox = jest.fn();
  static canMakePayments = jest.fn(() => Promise.resolve(true));
  static beginRefundRequestForActiveEntitlement = jest.fn(() => Promise.resolve());
  static beginRefundRequestForEntitlement = jest.fn(() => Promise.resolve());
  static beginRefundRequestForProduct = jest.fn(() => Promise.resolve());
  static showInAppMessages = jest.fn(() => Promise.resolve());
  static isConfigured = jest.fn(() => Promise.resolve(true));
}

export default MockPurchases;

export const PURCHASES_ERROR_CODE = {
  UNKNOWN_ERROR: 0,
  PURCHASE_CANCELLED_ERROR: 1,
  STORE_PROBLEM_ERROR: 2,
  PURCHASE_NOT_ALLOWED_ERROR: 3,
  PURCHASE_INVALID_ERROR: 4,
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: 5,
  PRODUCT_ALREADY_PURCHASED_ERROR: 6,
  RECEIPT_ALREADY_IN_USE_ERROR: 7,
  INVALID_RECEIPT_ERROR: 8,
  MISSING_RECEIPT_FILE_ERROR: 9,
  NETWORK_ERROR: 10,
  INVALID_CREDENTIALS_ERROR: 11,
  UNEXPECTED_BACKEND_RESPONSE_ERROR: 12,
  RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR: 13,
  INVALID_APP_USER_ID_ERROR: 14,
  OPERATION_ALREADY_IN_PROGRESS_ERROR: 15,
  UNKNOWN_BACKEND_ERROR: 16,
  INVALID_APPLE_SUBSCRIPTION_KEY_ERROR: 17,
  INELIGIBLE_ERROR: 18,
  INSUFFICIENT_PERMISSIONS_ERROR: 19,
  PAYMENT_PENDING_ERROR: 20,
  INVALID_SUBSCRIBER_ATTRIBUTES_ERROR: 21,
  LOG_OUT_WITH_ANONYMOUS_USER_ERROR: 22,
  CONFIGURATION_ERROR: 23,
  UNSUPPORTED_ERROR: 24,
  EMPTY_SUBSCRIBER_ATTRIBUTES_ERROR: 25,
  PRODUCT_DISCOUNT_MISSING_IDENTIFIER_ERROR: 26,
  MISSING_APP_USER_ID_ERROR: 27,
  PRODUCT_DISCOUNT_MISSING_SUBSCRIPTION_GROUP_IDENTIFIER_ERROR: 28,
  CUSTOMER_INFO_ERROR: 29,
  SYSTEM_INFO_ERROR: 30,
  BEGIN_REFUND_REQUEST_ERROR: 31,
  PRODUCT_REQUEST_TIMED_OUT: 32,
  API_ENDPOINT_BLOCKED: 33,
  INVALID_PROMOTIONAL_OFFER_ERROR: 34,
  OFFLINE_CONNECTION_ERROR: 35,
};

export const LOG_LEVEL = {
  VERBOSE: 'VERBOSE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

export {
  PURCHASE_TYPE,
  PACKAGE_TYPE,
  ENTITLEMENT_VERIFICATION_MODE,
  IN_APP_MESSAGE_TYPE,
};

// Export mock instances for assertions
export const mockPurchasesInstance = MockPurchases;
export { mockCustomerInfo, mockPackage, mockOffering };

// Helper to reset mocks
export const resetPurchasesMocks = () => {
  jest.clearAllMocks();
};
