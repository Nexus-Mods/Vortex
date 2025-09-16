/* eslint-env jest */
import path from 'path';

// Silence/neutralize logging during tests
jest.mock('../src/util/log', () => ({
  log: jest.fn(),
}));

// Mock actions index used by ExtensionManager imports (setDownloadHashByFile)
jest.mock('../src/actions', () => ({
  setDownloadHashByFile: jest.fn(),
}));

// Mock external hashing module used by ExtensionManager
jest.mock('vortexmt', () => ({
  fileMD5: jest.fn(),
}));

// Mock electron ipcMain to avoid Electron dependency in tests
jest.mock('electron', () => ({
  ipcMain: { on: jest.fn() },
  ipcRenderer: { on: jest.fn(), send: jest.fn() },
}));

// Provide fs-extra mocks without referencing outer variables
jest.mock('fs-extra', () => {
  const api = {
    existsSync: jest.fn(),
    removeSync: jest.fn(),
    readdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    // include async stubs to satisfy wrappers if imported indirectly
    chmod: jest.fn(() => Promise.resolve()),
    close: jest.fn(() => Promise.resolve()),
    fsync: jest.fn(() => Promise.resolve()),
    lstat: jest.fn(() => Promise.resolve({})),
    mkdir: jest.fn(() => Promise.resolve()),
    mkdirs: jest.fn(() => Promise.resolve()),
    move: jest.fn(() => Promise.resolve()),
    open: jest.fn(() => Promise.resolve(1)),
    readdir: jest.fn(() => Promise.resolve([])),
    readFile: jest.fn(() => Promise.resolve('')),
    stat: jest.fn(() => Promise.resolve({})),
    symlink: jest.fn(() => Promise.resolve()),
    utimes: jest.fn(() => Promise.resolve()),
    write: jest.fn((...args) => Promise.resolve({ bytesWritten: 0, buffer: args[1] })),
    read: jest.fn((...args) => Promise.resolve({ bytesRead: 0, buffer: args[1] })),
    writeFile: jest.fn(() => Promise.resolve()),
    appendFile: jest.fn(() => Promise.resolve()),
  };
  return api;
});

// Mock getVortexPath to fixed temp paths
jest.mock('../src/util/getVortexPath', () => ({
  __esModule: true,
  default: (key) => {
    if (key === 'userData') return '/tmp/vortex';
    if (key === 'bundledPlugins') return '/tmp/vortex/bundled';
    if (key === 'temp') return '/tmp/vortex/temp';
    return '/tmp/vortex';
  },
}));

// Mock actions so we can assert forgetExtension dispatches
jest.mock('../src/actions/app', () => ({
  forgetExtension: jest.fn((extId) => ({ type: 'FORGET_EXTENSION_TEST', payload: extId })),
  setExtensionEnabled: jest.fn((extId, enabled) => ({ type: 'SET_EXTENSION_ENABLED_TEST', payload: { extId, enabled } })),
  removeExtension: jest.fn((extId) => ({ type: 'REMOVE_EXTENSION_TEST', payload: extId })),
  setExtensionVersion: jest.fn((extId, version) => ({ type: 'SET_EXTENSION_VERSION_TEST', payload: { extId, version } })),
}));

// Utility to create a mock store with desired extension state
function makeStore(extState) {
  return {
    dispatch: jest.fn(),
    getState: jest.fn(() => ({ app: { extensions: extState } })),
  };
}

describe('ExtensionManager removal behavior', () => {
  const EXT_ID = 'test-ext';
  const PLUGINS_DIR = path.join('/tmp/vortex', 'plugins');
  const EXT_PATH = path.join(PLUGINS_DIR, EXT_ID);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    const fs = require('fs-extra');
    // default: behave as if disabled-extensions.json is missing
    fs.readdirSync.mockImplementation(() => {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    });
    fs.existsSync.mockReset();
    fs.removeSync.mockReset();
  });

  it('dispatches forgetExtension only when the extension directory was removed (or absent)', () => {
    const fs = require('fs-extra');
    // Arrange exists/remove behavior to simulate successful deletion
    let removed = false;
    fs.existsSync.mockImplementation((p) => {
      if (p === EXT_PATH) {
        return !removed; // first true, then false after removeSync
      }
      // For any other path, behave as non-existent by default
      return false;
    });
    fs.removeSync.mockImplementation((p) => {
      if (p === EXT_PATH) removed = true;
    });

    const store = makeStore({ [EXT_ID]: { remove: true } });

    // Act: require after mocks and construct with initStore to trigger constructor removal logic
    const ExtensionManager = require('../src/util/ExtensionManager').default;
    // Constructor should process removal synchronously
    // eslint-disable-next-line no-new
    new ExtensionManager(store);

    // Assert: one dispatch with our mocked forgetExtension action for EXT_ID
    expect(store.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FORGET_EXTENSION_TEST', payload: EXT_ID })
    );
  });

  it('does NOT dispatch forgetExtension if deletion failed and directory still exists afterward', () => {
    const fs = require('fs-extra');
    // Arrange: simulate deletion failure (existsSync always true)
    fs.existsSync.mockImplementation((p) => {
      if (p === EXT_PATH) return true;
      return false;
    });
    fs.removeSync.mockImplementation(() => {
      // simulate an error thrown by fs.removeSync
      const err = new Error('Permission denied');
      err.code = 'EPERM';
      throw err;
    });

    const store = makeStore({ [EXT_ID]: { remove: true } });

    const ExtensionManager = require('../src/util/ExtensionManager').default;
    // eslint-disable-next-line no-new
    new ExtensionManager(store);

    // Assert: forgetExtension should not be dispatched
    expect(store.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FORGET_EXTENSION_TEST', payload: EXT_ID })
    );
  });

  it('dispatches forgetExtension when the extension directory is already absent', () => {
    const fs = require('fs-extra');
    // Arrange: simulate that the extension dir never existed
    fs.existsSync.mockImplementation((p) => {
      if (p === EXT_PATH) return false;
      return false;
    });
    fs.removeSync.mockImplementation(() => {
      throw new Error('remove should not be called for absent dir');
    });

    const store = makeStore({ [EXT_ID]: { remove: true } });

    const ExtensionManager = require('../src/util/ExtensionManager').default;
    // eslint-disable-next-line no-new
    new ExtensionManager(store);

    // Assert: forgetExtension dispatched
    expect(store.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FORGET_EXTENSION_TEST', payload: EXT_ID })
    );
    // remove should not have been called
    expect(fs.removeSync).not.toHaveBeenCalled();
  });
});