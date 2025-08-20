'use strict';

// Mock implementation of node-addon-api with comprehensive exception handling
module.exports = {
  Error: {
    New: (env, message) => new Error(message || 'Mocked node-addon-api error')
  },
  handleScope: {
    Escape: () => null
  },
  // Mock NAPI macros
  NAPI_THROW_IF_FAILED: (env, status) => {
    if (status !== 'napi_ok') {
      throw new Error('NAPI_THROW_IF_FAILED mock error');
    }
    return true;
  },
  NAPI_RETURN_OR_THROW_IF_FAILED: (env, status, type) => {
    if (status !== 'napi_ok') {
      throw new Error('NAPI_RETURN_OR_THROW_IF_FAILED mock error');
    }
    return type ? new type() : null;
  },
  // Mock status codes
  napi_ok: 'napi_ok',
  napi_pending_exception: 'napi_pending_exception',
  // Add other necessary mock implementations
  Napi: {
    Error: {
      New: (env, message) => new Error(message || 'Mocked Napi.Error')
    }
  }
};