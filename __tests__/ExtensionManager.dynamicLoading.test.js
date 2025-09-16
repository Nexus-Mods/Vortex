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
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    sendSync: jest.fn((channel, payload) => {
      try {
        const { id } = JSON.parse(payload || '{}');
        if (id === 'get-application-name') {
          return { error: null, result: 'Vortex' };
        }
      } catch (e) {
        // ignore parse errors, provide default response
      }
      return { error: null, result: undefined };
    }),
  },
  remote: {
    dialog: {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    },
  },
}));

// Mock vortex-run used for dynamic requiring of extensions
jest.mock('vortex-run', () => ({
  dynreq: jest.fn(() => ({ default: jest.fn(() => ({})) })),
}));

// Provide fs-extra mocks without referencing outer-scope variables
jest.mock('fs-extra', () => {
  const api = {
    // sync
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    readFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    removeSync: jest.fn(),
    // async (promise-based) used by fs.ts wrappers
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

// Utility to create a mock store with desired extension state
function makeStore(extState) {
  return {
    dispatch: jest.fn(),
    getState: jest.fn(() => ({ app: { extensions: extState } })),
  };
}

describe('ExtensionManager dynamic loading', () => {
  const PLUGINS_DIR = path.join('/tmp/vortex', 'plugins');
  const BUNDLED_DIR = path.join('/tmp/vortex', 'bundled');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    const fs = require('fs-extra');

    // Default fs behavior for this suite
    fs.existsSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR || p === BUNDLED_DIR) return true;
      if (String(p).endsWith(path.join('extA', 'index.js'))) return true;
      if (String(p).endsWith(path.join('extB', 'index.js'))) return true;
      if (String(p).endsWith(path.join('extDisabled', 'index.js'))) return true;
      return false;
    });

    fs.mkdirSync.mockImplementation(() => {});

    fs.readdirSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR) return ['extA', 'extDisabled'];
      if (p === BUNDLED_DIR) return ['extB'];
      return [];
    });

    fs.statSync.mockImplementation((p) => ({
      isDirectory: () => {
        const isExtDir = [
          path.join(PLUGINS_DIR, 'extA'),
          path.join(PLUGINS_DIR, 'extDisabled'),
          path.join(BUNDLED_DIR, 'extB'),
        ].includes(p);
        return isExtDir;
      },
    }));

    fs.readFileSync.mockImplementation((p, opts) => {
      if (String(p).endsWith(path.join('extA', 'info.json'))) {
        return JSON.stringify({ name: 'Extension A', version: '1.0.0', id: 'extA' });
      }
      if (String(p).endsWith(path.join('extB', 'info.json'))) {
        return JSON.stringify({ name: 'Extension B', version: '1.0.0', id: 'extB' });
      }
      if (String(p).endsWith(path.join('extDisabled', 'info.json'))) {
        return JSON.stringify({ name: 'Disabled', version: '1.0.0', id: 'extDisabled' });
      }
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    });

    require('vortex-run').dynreq.mockImplementation(() => ({ default: jest.fn(() => ({})) }));
  });

  it('loads dynamic extensions from user and bundled paths and skips disabled ones', () => {
    const store = makeStore({
      // Only extDisabled is disabled; others are enabled by default
      extDisabled: { enabled: false },
    });

    const ExtensionManager = require('../src/util/ExtensionManager').default;
    const mgr = new ExtensionManager(store);

    // Trigger loading via public API
    mgr.getReducers();

    const names = mgr.extensions.map(e => e.name);

    expect(names).toEqual(expect.arrayContaining(['extA', 'extB']));
    expect(names).not.toContain('extDisabled');

    // Verify metadata of loaded items
    const extA = mgr.extensions.find(e => e.name === 'extA');
    const extB = mgr.extensions.find(e => e.name === 'extB');

    expect(extA).toBeTruthy();
    expect(extA.dynamic).toBe(true);
    expect(extA.path).toBe(path.join(PLUGINS_DIR, 'extA'));

    expect(extB).toBeTruthy();
    expect(extB.dynamic).toBe(true);
    expect(extB.path).toBe(path.join(BUNDLED_DIR, 'extB'));
  });

  it('prefers user extension over bundled duplicate but flags outdated when bundled is newer or equal', () => {
    const fs = require('fs-extra');
    // Setup duplicates across directories with same id/name
    fs.existsSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR || p === BUNDLED_DIR) return true;
      if (String(p).endsWith(path.join('same', 'index.js'))) return true;
      return false;
    });

    fs.readdirSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR) return ['same'];
      if (p === BUNDLED_DIR) return ['same'];
      return [];
    });

    fs.statSync.mockImplementation((p) => ({
      isDirectory: () => [
        path.join(PLUGINS_DIR, 'same'),
        path.join(BUNDLED_DIR, 'same'),
      ].includes(p),
    }));

    fs.readFileSync.mockImplementation((p) => {
      if (String(p).endsWith(path.join('plugins', 'same', 'info.json'))) {
        return JSON.stringify({ name: 'Same', id: 'same', version: '1.0.0' });
      }
      if (String(p).endsWith(path.join('bundled', 'same', 'info.json'))) {
        // newer or equal triggers outdated flag for the user copy
        return JSON.stringify({ name: 'Same', id: 'same', version: '1.1.0' });
      }
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    });

    const store = makeStore({});
    const ExtensionManager = require('../src/util/ExtensionManager').default;
    const mgr = new ExtensionManager(store);
    mgr.getReducers();

    const entries = mgr.extensions.filter(e => e.name === 'same');
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe(path.join(PLUGINS_DIR, 'same'));
    // bundled is newer -> user copy is marked outdated internally
    expect(mgr.hasOutdatedExtensions).toBe(true);
  });

  it('deduplicates within the same directory by keeping the newer version and marking the older outdated', () => {
    const fs = require('fs-extra');
    // Two folders inside plugins with same id "dup" but different versions
    fs.existsSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR || p === BUNDLED_DIR) return true;
      if (String(p).endsWith(path.join('dupOld', 'index.js'))) return true;
      if (String(p).endsWith(path.join('dupNew', 'index.js'))) return true;
      return false;
    });

    fs.readdirSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR) return ['dupOld', 'dupNew'];
      if (p === BUNDLED_DIR) return [];
      return [];
    });

    fs.statSync.mockImplementation((p) => ({
      isDirectory: () => [
        path.join(PLUGINS_DIR, 'dupOld'),
        path.join(PLUGINS_DIR, 'dupNew'),
      ].includes(p),
    }));

    fs.readFileSync.mockImplementation((p) => {
      if (String(p).endsWith(path.join('dupOld', 'info.json'))) {
        return JSON.stringify({ name: 'Duplicate', id: 'dup', version: '1.0.0' });
      }
      if (String(p).endsWith(path.join('dupNew', 'info.json'))) {
        return JSON.stringify({ name: 'Duplicate', id: 'dup', version: '1.2.0' });
      }
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    });

    const store = makeStore({});
    const ExtensionManager = require('../src/util/ExtensionManager').default;
    const mgr = new ExtensionManager(store);
    mgr.getReducers();

    const entries = mgr.extensions.filter(e => e.name === 'dup');
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe(path.join(PLUGINS_DIR, 'dupNew'));
    expect(mgr.hasOutdatedExtensions).toBe(true);
  });

  it('loads extension without info.json using the folder name as id', () => {
    const fs = require('fs-extra');
    fs.existsSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR || p === BUNDLED_DIR) return true;
      if (String(p).endsWith(path.join('extNoInfo', 'index.js'))) return true;
      return false;
    });

    fs.readdirSync.mockImplementation((p) => {
      if (p === PLUGINS_DIR) return ['extNoInfo'];
      if (p === BUNDLED_DIR) return [];
      return [];
    });

    fs.statSync.mockImplementation((p) => ({
      isDirectory: () => [path.join(PLUGINS_DIR, 'extNoInfo')].includes(p),
    }));

    fs.readFileSync.mockImplementation((p) => {
      if (String(p).endsWith(path.join('extNoInfo', 'info.json'))) {
        // Simulate missing file
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      }
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    });

    const store = makeStore({});
    const ExtensionManager = require('../src/util/ExtensionManager').default;
    const mgr = new ExtensionManager(store);
    mgr.getReducers();

    const entry = mgr.extensions.find(e => e.path === path.join(PLUGINS_DIR, 'extNoInfo'));
    expect(entry).toBeTruthy();
    expect(entry.name).toBe('extNoInfo');
  });
});