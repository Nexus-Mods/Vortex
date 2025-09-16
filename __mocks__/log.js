// Your code calls a *named* function: log('warn', 'message', meta)
const fn = jest.fn();
module.exports = {
  __esModule: true,
  log: fn,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn()
  }
};