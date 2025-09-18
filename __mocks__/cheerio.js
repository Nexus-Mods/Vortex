// Mock for cheerio to avoid ES module issues in Jest
module.exports = {
  load: jest.fn(() => ({
    find: jest.fn(() => ({
      each: jest.fn(),
      text: jest.fn(),
      attr: jest.fn(),
      length: 0
    })),
    text: jest.fn(),
    html: jest.fn(),
    attr: jest.fn()
  })),
  contains: jest.fn(),
  merge: jest.fn()
};