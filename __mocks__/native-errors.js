'use strict';

// Mock implementation of native-errors for macOS
module.exports = {
  // Mock the getLastNativeError function to return a default error code
  getLastNativeError: () => 0,

  // Mock the getErrorMessage function to return a generic message
  getErrorMessage: (code) => 'Mock Error Message',

  // Mock the getSystemErrorMessage function
  getSystemErrorMessage: (code) => 'Mock System Error Message',

  // Mock the translateSystemError function
  translateSystemError: (code) => ({
    code: 'MOCK_ERROR',
    message: 'Mock Translated Error Message',
    systemCode: code,
  }),
};