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
  getName: jest.fn(() => 'Vortex'),
  getVersion: jest.fn(() => '1.0.0-test'),
};

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app,
  dialog
};
