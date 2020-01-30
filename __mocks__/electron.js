'use strict';

const dialog = {
  showMessageBoxSync: jest.fn(),
  showMessageBox: jest.fn(),
  showErrorBox: jest.fn(),
  getWindow: jest.fn(() => null),
};

const app = {
  exit: jest.fn()
};

const remote = {
  getCurrentWindow: jest.fn(() => null),
};

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app,
  remote,
  dialog
};
