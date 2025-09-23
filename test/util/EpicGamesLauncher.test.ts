import EpicGamesLauncher from '../../src/util/EpicGamesLauncher';
import * as path from 'path';
import * as fs from '../../src/util/fs';
import { getVortexPath } from '../../src/util/getVortexPath';

// Mock fs
jest.mock('../../src/util/fs', () => ({
  statAsync: jest.fn(),
  readdirAsync: jest.fn(),
  readFileAsync: jest.fn()
}));

// Mock getVortexPath
jest.mock('../../src/util/getVortexPath', () => ({
  default: jest.fn(),
  __esModule: true
}));

// Mock platform detection
jest.mock('../../src/util/platform', () => ({
  isWindows: () => false,
  isMacOS: () => true,
  isLinux: () => false
}));

// Mock lazyRequire
jest.mock('../../src/util/lazyRequire', () => ({
  default: () => undefined
}));

// Mock opn
jest.mock('../../src/util/opn', () => ({
  default: jest.fn()
}));

describe('EpicGamesLauncher', () => {
  beforeEach(() => {
    // Reset mocks
    (fs.statAsync as jest.Mock).mockReset();
    (fs.readdirAsync as jest.Mock).mockReset();
    (fs.readFileAsync as jest.Mock).mockReset();
    (getVortexPath as jest.Mock).mockReset();
    
    // Mock getVortexPath to return test paths
    (getVortexPath as jest.Mock).mockImplementation((type) => {
      if (type === 'home') {
        return '/Users/test';
      }
      return '/';
    });
  });
  
  describe('getEpicDataPath on macOS', () => {
    it('should find Epic data path in standard location', async () => {
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/Users/test/Library/Application Support/Epic') {
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await (EpicGamesLauncher as any).getEpicDataPath();
      expect(result).toBe('/Users/test/Library/Application Support/Epic');
    });
    
    it('should return undefined if Epic data path is not found', async () => {
      (fs.statAsync as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const result = await (EpicGamesLauncher as any).getEpicDataPath();
      expect(result).toBeUndefined();
    });
  });
  
  describe('findMacOSEpicDataPath', () => {
    it('should find Epic data path in standard location', async () => {
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/Users/test/Library/Application Support/Epic') {
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await (EpicGamesLauncher as any).findMacOSEpicDataPath();
      expect(result).toBe('/Users/test/Library/Application Support/Epic');
    });
  });
  
  describe('getGameStorePath on macOS', () => {
    it('should find Epic Games Launcher app in standard location', async () => {
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/Applications/Epic Games Launcher.app') {
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await EpicGamesLauncher.getGameStorePath();
      expect(result).toBe('/Applications/Epic Games Launcher.app');
    });
  });
  
  describe('parseManifests on macOS', () => {
    it('should return game entries when manifests are found', async () => {
      // Mock the data path
      (EpicGamesLauncher as any).mDataPath = Promise.resolve('/Users/test/Library/Application Support/Epic');
      
      // Mock readdir to return manifest files
      (fs.readdirAsync as jest.Mock).mockResolvedValue(['game1.item', 'game2.item']);
      
      // Mock readFile to return manifest data
      (fs.readFileAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('game1.item')) {
          return Promise.resolve(JSON.stringify({
            LaunchExecutable: 'Game1.exe',
            InstallLocation: '/Games/Game1',
            DisplayName: 'Game 1',
            AppName: 'game1'
          }));
        } else if (filePath.includes('game2.item')) {
          return Promise.resolve(JSON.stringify({
            LaunchExecutable: 'Game2.exe',
            InstallLocation: '/Games/Game2',
            DisplayName: 'Game 2',
            AppName: 'game2'
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Mock statSilentAsync to verify game executables exist
      (fs.statAsync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('Game1.exe') || filePath.includes('Game2.exe')) {
          return Promise.resolve(true);
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
  });
});