// Mock for payments-service

export const getOfferings = jest.fn(() => Promise.resolve({
  success: true,
  offerings: {
    identifier: 'default',
    availablePackages: []
  }
}));

export const purchasePackage = jest.fn(() => Promise.resolve({
  success: true,
  hasPremium: true
}));

export const isMockMode = jest.fn(() => false);
