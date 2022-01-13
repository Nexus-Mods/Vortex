'use strict';

const os = require('os');

const dialog = {
  showMessageBoxSync: jest.fn(),
  showMessageBox: jest.fn(),
  showErrorBox: jest.fn(),
  getWindow: jest.fn(() => null),
};

const app = {
  exit: jest.fn(),
  getAppPath: jest.fn(() => os.tmpdir()),
  getPath: jest.fn(() => os.tmpdir()),
};

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app,
  dialog
};
