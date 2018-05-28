'use strict';

const dialog = {
  showMessageBox: jest.genMockFunction()
}

const app = {
  exit: jest.genMockFunction()
}

const remote = {
  getCurrentWindow: jest.genMockFunction()
}

module.exports = {
  require: jest.genMockFunction(),
  match: jest.genMockFunction(),
  app,
  remote,
  dialog
};
