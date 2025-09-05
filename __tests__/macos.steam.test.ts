/* eslint-env jest */
import type { IGameStore } from '../src/types/api';

// We will dynamically mock modules per test and import the Steam instance in an isolated module context

describe('Steam macOS getGameStorePath', () => {
  const ENOENT = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function mockPlatformMac() {
    jest.doMock('../src/util/platform', () => ({
      isWindows: () => false,
      isMacOS: () => true,
    }));
  }

  function mockGetVortexPathHome(homePath: string) {
    jest.doMock('../src/util/getVortexPath', () => ({
      __esModule: true,
      default: (name: string) => (name === 'home' ? homePath : ''),
    }));
  }

  function mockFsStatAsync(impl: (p: string) => Promise<any>) {
    jest.doMock('../src/util/fs', () => ({
      __esModule: true,
      statAsync: (p: string) => impl(p),
      readFileAsync: jest.fn(),
    }));
  }

  test('returns /Applications/Steam.app when present', async () => {
    mockPlatformMac();
    mockGetVortexPathHome('/Users/test');

    const preferredBase = '/Users/test/Library/Application Support/Steam';
    const fallbackBase = '/Users/test/.steam/steam';

    mockFsStatAsync((p: string) => {
      // Constructor checks preferred first, then fallback
      if (p === preferredBase) return Promise.resolve({});
      if (p === fallbackBase) return Promise.reject(ENOENT);
      // getGameStorePath checks /Applications/Steam.app
      if (p === '/Applications/Steam.app') return Promise.resolve({});
      return Promise.reject(ENOENT);
    });

    const steam: IGameStore = await new Promise((resolve) => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const inst = require('../src/util/Steam').default as IGameStore;
        resolve(inst);
      });
    });

    const res = await (steam as any).getGameStorePath();
    expect(res).toBe('/Applications/Steam.app');
  });

  test('falls back to baseFolder/Steam.app when /Applications missing', async () => {
    mockPlatformMac();
    mockGetVortexPathHome('/Users/test');

    const preferredBase = '/Users/test/Library/Application Support/Steam';

    mockFsStatAsync((p: string) => {
      // preferred base exists
      if (p === preferredBase) return Promise.resolve({});
      // /Applications/Steam.app missing
      if (p === '/Applications/Steam.app') return Promise.reject(ENOENT);
      return Promise.reject(ENOENT);
    });

    const steam: IGameStore = await new Promise((resolve) => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const inst = require('../src/util/Steam').default as IGameStore;
        resolve(inst);
      });
    });

    const res = await (steam as any).getGameStorePath();
    expect(res).toBe('/Users/test/Library/Application Support/Steam/Steam.app');
  });

  test('uses fallback baseFolder when preferred missing', async () => {
    mockPlatformMac();
    mockGetVortexPathHome('/Users/test');

    const preferredBase = '/Users/test/Library/Application Support/Steam';
    const fallbackBase = '/Users/test/.steam/steam';

    mockFsStatAsync((p: string) => {
      if (p === preferredBase) return Promise.reject(ENOENT);
      if (p === fallbackBase) return Promise.resolve({});
      if (p === '/Applications/Steam.app') return Promise.reject(ENOENT);
      return Promise.reject(ENOENT);
    });

    const steam: IGameStore = await new Promise((resolve) => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const inst = require('../src/util/Steam').default as IGameStore;
        resolve(inst);
      });
    });

    const res = await (steam as any).getGameStorePath();
    expect(res).toBe('/Users/test/.steam/steam/Steam.app');
  });

  test('returns undefined when no base folder found', async () => {
    mockPlatformMac();
    mockGetVortexPathHome('/Users/test');

    const preferredBase = '/Users/test/Library/Application Support/Steam';
    const fallbackBase = '/Users/test/.steam/steam';

    mockFsStatAsync((p: string) => {
      if (p === preferredBase) return Promise.reject(ENOENT);
      if (p === fallbackBase) return Promise.reject(ENOENT);
      // Should not be checking /Applications when baseFolder is undefined, but make it fail anyway
      return Promise.reject(ENOENT);
    });

    const steam: IGameStore = await new Promise((resolve) => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const inst = require('../src/util/Steam').default as IGameStore;
        resolve(inst);
      });
    });

    const res = await (steam as any).getGameStorePath();
    expect(res).toBeUndefined();
  });
});