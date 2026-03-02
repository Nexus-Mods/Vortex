// Mock for cheerio/lib/utils
module.exports = {
  isTag: jest.fn(),
  isHtml: jest.fn(),
  isCheerio: jest.fn(),
  camelCase: jest.fn(),
  cssCase: jest.fn(),
  domEach: jest.fn(),
  cloneDom: jest.fn(),
  isSubset: jest.fn()
};