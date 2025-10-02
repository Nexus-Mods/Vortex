import EpicGamesLauncher from '../../src/util/EpicGamesLauncher';
import * as path from 'path';
import * as fs from '../../src/util/fs';
import getVortexPath from '../../src/util/getVortexPath';

// Mock fs
jest.mock('../../src/util/fs', () => {
  const statAsync = jest.fn(() => Promise.reject(new Error('not found')));
  return {
    statAsync,
    statSilentAsync: statAsync,
    readdirAsync: jest.fn(),
    readFileAsync: jest.fn()
  };
});

// Mock getVortexPath
jest.mock('../../src/util/getVortexPath', () => ({
  __esModule: true,
  default: (type: string) => (type === 'home' ? '/home/test' : '/')
}));

// Mock platform detection for Linux
jest.mock('../../src/util/platform', () => ({
  isWindows: () => false,
  isMacOS: () => false,
  isLinux: () => true
}));

// Mock lazyRequire
jest.mock('../../src/util/lazyRequire', () => ({
  __esModule: true,
  default: () => undefined,
}));

// Mock opn
jest.mock('../../src/util/opn', () => ({
  default: jest.fn()
}));

describe('EpicGamesLauncher on Linux', () => {
  beforeEach(() => {
    // Reset mocks
    (fs.statAsync as jest.Mock).mockReset();
    (fs.readdirAsync as jest.Mock).mockReset();
    (fs.readFileAsync as jest.Mock).mockReset();
    // Reset singleton state between tests to avoid cross-test contamination
    (EpicGamesLauncher as any).mLauncherExecPath = undefined;
    (EpicGamesLauncher as any).mCache = undefined;
  });

  describe('getEpicDataPath on Linux', () => {
    it('should find Heroic data path in standard location', async () => {
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/home/test/.config/heroic') {
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await (EpicGamesLauncher as any).getEpicDataPath();
      expect(result).toBe('/home/test/.config/heroic');
    });

    it('should return undefined if Heroic data path is not found', async () => {
      (fs.statAsync as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await (EpicGamesLauncher as any).getEpicDataPath();
      expect(result).toBeUndefined();
    });
  });

  describe('getGameStorePath on Linux', () => {
    it('should find Heroic binary in /usr/bin/heroic', async () => {
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/usr/bin/heroic') {
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await EpicGamesLauncher.getGameStorePath();
      expect(result).toBe('/usr/bin/heroic');
    });

    it('should fallback to flatpak path when /usr/bin/heroic is missing', async () => {
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/usr/bin/heroic') {
          return Promise.reject(new Error('File not found'));
        }
        if (filePath === '/var/lib/flatpak/exports/bin/com.heroicgameslauncher.hgl') {
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await EpicGamesLauncher.getGameStorePath();
      expect(result).toBe('/var/lib/flatpak/exports/bin/com.heroicgameslauncher.hgl');
    });
  });

  describe('parseManifests on Linux (Heroic)', () => {
    it('should return game entries when legendary_library.json is found', async () => {
      // Mock the data path
      (EpicGamesLauncher as any).mDataPath = Promise.resolve('/home/test/.config/heroic');

      const manifestPath = '/home/test/.config/heroic/store_cache/legendary_library.json';

      // Mock readFile to return Heroic library data
      (fs.readFileAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === manifestPath) {
          return Promise.resolve(JSON.stringify([
            { app_name: 'game1', title: 'Game 1', install_path: '/Games/Game1' },
            { app_name: 'game2', title: 'Game 2', install_path: '/Games/Game2' }
          ]));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await EpicGamesLauncher.allGames();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        appid: 'game1',
        name: 'Game 1',
        gamePath: '/Games/Game1',
        gameStoreId: 'epic'
      });
      expect(result[1]).toEqual({
        appid: 'game2',
        name: 'Game 2',
        gamePath: '/Games/Game2',
        gameStoreId: 'epic'
      });
    });

    it('should return empty list when legendary_library.json is missing', async () => {
      (EpicGamesLauncher as any).mDataPath = Promise.resolve('/home/test/.config/heroic');
      (fs.readFileAsync as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await EpicGamesLauncher.allGames();
      expect(result).toHaveLength(0);
    });
  });
});