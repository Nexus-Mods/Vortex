import { MacAppStore } from '../src/index';
import * as path from 'path';
import * as fs from 'fs-extra';
import { promisify } from 'util';
import { exec } from 'child_process';

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
  pathExists: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

describe('MacAppStore', () => {
  let macAppStore: MacAppStore;
  
  beforeEach(() => {
    // Reset mocks
    (fs.pathExists as jest.Mock).mockReset();
    (fs.readdir as jest.Mock).mockReset();
    (fs.stat as jest.Mock).mockReset();
    (exec as unknown as jest.Mock).mockReset();
    
    // Set up environment
    process.env.HOME = '/Users/test';
    
    macAppStore = new MacAppStore();
  });
  
  describe('launchGame', () => {
    it('should launch a game using the macappstore:// protocol', async () => {
      const { util } = require('vortex-api');
      (util.opn as jest.Mock).mockResolvedValue(undefined);
      
      await macAppStore.launchGame('12345');
      
      expect(util.opn).toHaveBeenCalledWith('macappstore://itunes.apple.com/app/id12345');
    });
  });
  
  describe('getGameStorePath', () => {
    it('should return the App Store path', async () => {
      const result = await macAppStore.getGameStorePath();
      expect(result).toBe('/Applications/App Store.app');
    });
  });
  
  describe('isLikelyGame', () => {
    it('should identify games based on name patterns', () => {
      // Test games that should be identified as games
      expect((macAppStore as any).isLikelyGame('Civilization VI', 'Application')).toBe(true);
      expect((macAppStore as any).isLikelyGame('World of Warcraft', 'Application')).toBe(true);
      expect((macAppStore as any).isLikelyGame('The Witcher 3', 'Application')).toBe(true);
      expect((macAppStore as any).isLikelyGame('Halo 2', 'Application')).toBe(true);
      expect((macAppStore as any).isLikelyGame('Grand Theft Auto', 'Game')).toBe(true);
      
      // Test non-games that should not be identified as games
      expect((macAppStore as any).isLikelyGame('TextEdit', 'Application')).toBe(false);
      expect((macAppStore as any).isLikelyGame('Safari', 'Application')).toBe(false);
      expect((macAppStore as any).isLikelyGame('Calculator', 'Application')).toBe(false);
    });
  });
  
  describe('getGameEntries', () => {
    it('should return game entries when apps are found', async () => {
      // Mock pathExists to return true for app directories
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      
      // Mock readdir to return app files
      (fs.readdir as jest.Mock).mockImplementation((dirPath) => {
        if (dirPath === '/Applications') {
          return Promise.resolve(['Civilization VI.app', 'TextEdit.app', 'World of Warcraft.app']);
        } else if (dirPath === '/Users/test/Applications') {
          return Promise.resolve(['Halo 2.app']);
        }
        return Promise.resolve([]);
      });
      
      // Mock stat to return file stats
      (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      
      // Mock exec to return metadata
      (exec as unknown as jest.Mock).mockImplementation((command, callback) => {
        if (command.includes('Civilization VI.app')) {
          callback(null, { stdout: 'Civilization VI\ncom.aspyr.civ6\nGame\n' });
        } else if (command.includes('World of Warcraft.app')) {
          callback(null, { stdout: 'World of Warcraft\ncom.blizzard.worldofwarcraft\nGame\n' });
        } else if (command.includes('Halo 2.app')) {
          callback(null, { stdout: 'Halo 2\ncom.microsoft.halo2\nGame\n' });
        } else if (command.includes('TextEdit.app')) {
          callback(null, { stdout: 'TextEdit\ncom.apple.TextEdit\nApplication\n' });
        }
      });
      
      const result = await (macAppStore as any).getGameEntries();
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        appid: 'com.aspyr.civ6',
        name: 'Civilization VI',
        gamePath: '/Applications/Civilization VI.app',
        gameStoreId: 'macappstore'
      });
      expect(result[1]).toEqual({
        appid: 'com.blizzard.worldofwarcraft',
        name: 'World of Warcraft',
        gamePath: '/Applications/World of Warcraft.app',
        gameStoreId: 'macappstore'
      });
      expect(result[2]).toEqual({
        appid: 'com.microsoft.halo2',
        name: 'Halo 2',
        gamePath: '/Users/test/Applications/Halo 2.app',
        gameStoreId: 'macappstore'
      });
    });
  });
});