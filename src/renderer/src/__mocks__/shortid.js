// Mock for shortid
const { vi } = require('vitest');

module.exports = {
  generate: vi.fn(() => 'mock-short-id-' + Math.random().toString(36).substr(2, 9))
};