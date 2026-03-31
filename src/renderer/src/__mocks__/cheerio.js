// Mock for cheerio to avoid ES module issues in vitest
const { vi } = require('vitest');

module.exports = {
  load: vi.fn(() => ({
    find: vi.fn(() => ({
      each: vi.fn(),
      text: vi.fn(),
      attr: vi.fn(),
      length: 0
    })),
    text: vi.fn(),
    html: vi.fn(),
    attr: vi.fn()
  })),
  contains: vi.fn(),
  merge: vi.fn()
};