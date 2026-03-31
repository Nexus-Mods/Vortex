// Mock for cheerio/lib/utils
const { vi } = require('vitest');

module.exports = {
  isTag: vi.fn(),
  isHtml: vi.fn(),
  isCheerio: vi.fn(),
  camelCase: vi.fn(),
  cssCase: vi.fn(),
  domEach: vi.fn(),
  cloneDom: vi.fn(),
  isSubset: vi.fn()
};