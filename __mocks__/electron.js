'use strict';

const dialog = {
  showMessageBox: jest.genMockFunction()
}

const app = {
  exit: jest.genMockFunction()
}

module.exports = {
  require: jest.genMockFunction(),
  match: jest.genMockFunction(),
  app,
  remote: jest.genMockFunction(),
  dialog
};
