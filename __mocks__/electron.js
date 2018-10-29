'use strict';

const dialog = {
  showMessageBox: jest.fn()
}

const app = {
  exit: jest.fn()
}

const remote = {
  getCurrentWindow: jest.fn()
}

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app,
  remote,
  dialog
};
