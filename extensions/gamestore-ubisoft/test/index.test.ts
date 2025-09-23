import { UbisoftLauncher } from '../src/index';
import * as path from 'path';
import * as fs from 'fs-extra';
import { types } from 'vortex-api';

// Mock the vortex-api
jest.mock('vortex-api', () => ({
  log: jest.fn(),
  types: {
    IGameStore: jest.fn(),
    IGameStoreEntry: jest.fn(),
    GameEntryNotFound: jest.fn()
  },
  util: {
    opn: jest.fn()
  }
}));

// Mock fs-extra
jest.mock('fs-extra', () => ({
  stat: jest.fn(),
  readdir: jest.fn(),
  readFile: jest.fn()
}));

describe('UbisoftLauncher', () => {
  let ubisoftLauncher: UbisoftLauncher;
  
  beforeEach(() => {
    // Mock process.platform to test macOS functionality
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    
    // Reset mocks
    (fs.stat as jest.Mock).mockReset();
    (fs.readdir as jest.Mock).mockReset();
    (fs.readFile as jest.Mock).mockReset();
    
    ubisoftLauncher = new UbisoftLauncher();
  });
  
  describe('findMacOSUbisoftPath', () => {
    it('should find Ubisoft Connect in standard Applications directory', async () => {
      (fs.stat as jest.Mock).mockImplementation((filePath) => {
        if (filePath === '/Applications/Ubisoft Connect.app') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await (ubisoftLauncher as any).findMacOSUbisoftPath();
      expect(result).toBe('/Applications/Ubisoft Connect.app');
    });
    
    it('should find Ubisoft Connect in user Applications directory', async () => {
      (fs.stat as jest.Mock).mockImplementation((filePath) => {
        if (filePath === path.join(process.env.HOME || '', 'Applications', 'Ubisoft Connect.app')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await (ubisoftLauncher as any).findMacOSUbisoftPath();
      expect(result).toBe(path.join(process.env.HOME || '', 'Applications', 'Ubisoft Connect.app'));
    });
    
    it('should reject if Ubisoft Connect is not found', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      await expect((ubisoftLauncher as any).findMacOSUbisoftPath()).rejects.toThrow('Ubisoft Connect not found on macOS');
    });
  });
  
  describe('launchGame', () => {
    it('should launch a game using the ubisoft:// protocol', async () => {
      const { util } = require('vortex-api');
      (util.opn as jest.Mock).mockResolvedValue(undefined);
      
      await ubisoftLauncher.launchGame('12345');
      
      expect(util.opn).toHaveBeenCalledWith('ubisoft://launch/12345/0');
    });
  });
  
  describe('getGameEntriesMacOS', () => {
    it('should return empty array if Ubisoft data directory does not exist', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const result = await (ubisoftLauncher as any).getGameEntriesMacOS();
      expect(result).toEqual([]);
    });
    
    it('should return game entries when games are found', async () => {
      // Mock the data directory exists
      (fs.stat as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('Library/Application Support/Ubisoft/Ubisoft Game Launcher')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Mock readdir to return game directories
      (fs.readdir as jest.Mock).mockResolvedValue(['42', '57']);
      
      // Mock findGameInstallationPath to return game paths
      (ubisoftLauncher as any).findGameInstallationPath = jest.fn()
        .mockImplementation((gameId) => {
          if (gameId === '42') {
            return Promise.resolve('/Games/Assassins Creed Origins');
          } else if (gameId === '57') {
            return Promise.resolve('/Games/Far Cry 5');
          }
          return Promise.resolve(null);
        });
      
      const result = await (ubisoftLauncher as any).getGameEntriesMacOS();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        appid: '42',
        name: 'Assassin\'s Creed Origins',
        gamePath: '/Games/Assassins Creed Origins',
        gameStoreId: 'ubisoft'
      });
      expect(result[1]).toEqual({
        appid: '57',
        name: 'Far Cry 5',
        gamePath: '/Games/Far Cry 5',
        gameStoreId: 'ubisoft'
      });
    });
  });
  
  describe('findGameInstallationPath', () => {
    it('should find game installation in common paths', async () => {
      (fs.stat as jest.Mock).mockImplementation((filePath) => {
        if (filePath === path.join(process.env.HOME || '', 'Applications', 'Ubisoft', 'Ubisoft Game Launcher', 'games', '12345')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await (ubisoftLauncher as any).findGameInstallationPath('12345');
      expect(result).toBe(path.join(process.env.HOME || '', 'Applications', 'Ubisoft', 'Ubisoft Game Launcher', 'games', '12345'));
    });
    
    it('should return null if game installation is not found', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const result = await (ubisoftLauncher as any).findGameInstallationPath('12345');
      expect(result).toBeNull();
    });
  });
});