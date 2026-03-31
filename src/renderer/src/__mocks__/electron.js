'use strict';

const { vi } = require('vitest');
const os = require('os');

const dialog = {
  showMessageBoxSync: vi.fn(),
  showMessageBox: vi.fn(),
  showErrorBox: vi.fn(),
  getWindow: vi.fn(() => null),
};

const app = {
  exit: vi.fn(),
  getAppPath: vi.fn(() => os.tmpdir()),
  getPath: vi.fn(() => os.tmpdir()),
  getName: vi.fn(() => 'Vortex'),
  getVersion: vi.fn(() => '1.0.0-test'),
};

module.exports = {
  require: vi.fn(),
  match: vi.fn(),
  app,
  dialog
};
