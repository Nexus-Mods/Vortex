// Mock for shortid
module.exports = {
  generate: jest.fn(() => 'mock-short-id-' + Math.random().toString(36).substr(2, 9))
};