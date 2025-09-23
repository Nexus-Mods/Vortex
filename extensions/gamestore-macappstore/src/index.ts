import Promise from 'bluebird';

import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

import { log, types, util } from 'vortex-api';

const execAsync = promisify(exec);

interface IAppBundleInfo {
  name: string;
  bundleId: string;
  version: string;
  isGame: boolean;
}

const STORE_ID = 'macappstore';
const STORE_NAME = 'Mac App Store';
const STORE_PRIORITY = 70;

/**
 * base class to interact with Mac App Store games.
 * @class MacAppStore
 */
class MacAppStore implements types.IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mCache: Promise<types.IGameStoreEntry[]>;
  private mHomeDir: string;

  constructor() {
    this.mHomeDir = process.env.HOME || '';
  }

  public launchGame(appInfo: any, api?: types.IExtensionApi): Promise<void> {
    const appId = ((typeof(appInfo) === 'object') && ('appId' in appInfo))
      ? appInfo.appId : appInfo.toString();

    // Mac App Store games are launched through the App Store or directly if installed
    const launchCommand = `macappstore://itunes.apple.com/app/id${appId}`;
    return util.opn(launchCommand).catch((err: any) => Promise.resolve());
  }

  public allGames(): Promise<types.IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.getGameEntries();
    }
    return this.mCache;
  }

  public reloadGames(): Promise<void> {
    return Promise.resolve().then(() => {
      this.mCache = this.getGameEntries();
    });
  }

  public findByName(appName: string): Promise<types.IGameStoreEntry> {
    const re = new RegExp('^' + appName + '$');
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => (entry === undefined)
        ? Promise.reject(new types.GameEntryNotFound(appName, STORE_ID))
        : Promise.resolve(entry));
  }

  public findByAppId(appId: string | string[]): Promise<types.IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: types.IGameStoreEntry) => (appId.includes(entry.appid))
      : (entry: types.IGameStoreEntry) => (appId === entry.appid);

    return this.allGames()
      .then(entries => {
        const gameEntry = entries.find(matcher);
        if (gameEntry === undefined) {
          return Promise.reject(
            new types.GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID));
        } else {
          return Promise.resolve(gameEntry);
        }
      });
  }

  public getGameStorePath(): Promise<string> {
    // Mac App Store doesn't have a specific executable path
    return Promise.resolve('/Applications/App Store.app');
  }

  /**
   * Use macOS metadata utilities to get app information
   */
  private async getAppMetadata(appPath: string): globalThis.Promise<{ name: string; bundleId: string; isGame: boolean } | null> {
    try {
      // Use mdls to get metadata from the app bundle
      const { stdout } = await execAsync(`mdls -name kMDItemDisplayName -name kMDItemCFBundleIdentifier -name kMDItemKind -raw "${appPath}"`);
      
      const lines = stdout.trim().split('\n');
      if (lines.length >= 3) {
        const displayName = lines[0] || path.basename(appPath, '.app');
        const bundleId = lines[1] || '';
        const kind = lines[2] || '';
        
        // Simple heuristic to identify likely games
        // This could be enhanced with more sophisticated checks
        const isGame = this.isLikelyGame(displayName, kind);
        
        return {
          name: displayName,
          bundleId: bundleId,
          isGame: isGame
        };
      }
    } catch (err: any) {
      log('debug', 'Failed to get app metadata', { path: appPath, error: err?.message });
    }
    
    // Fallback to basic info
    const appName = path.basename(appPath, '.app');
    return {
      name: appName,
      bundleId: '',
      isGame: this.isLikelyGame(appName, '')
    };
  }

  /**
   * Enhanced heuristic to identify likely games using more criteria
   */
  private isLikelyGame(appName: string, kind: string): boolean {
    // Check if the kind indicates it's a game
    if (kind.toLowerCase().includes('game')) {
      return true;
    }
    
    // Use the existing game indicators
    const gameIndicators = [
      'game', 'Game', 'Gaming', 'Adventure', 'RPG', 'Strategy', 'Simulation',
      'Puzzle', 'Arcade', 'Action', 'Shooter', 'Racing', 'Sports'
    ];
    
    // Check for common game categories in the app name
    const gameCategories = [
      'rpg', 'mmo', 'mmorpg', 'fps', 'tps', 'rts', 'jrpg', 'roguelike',
      'platformer', 'metroidvania', 'stealth', 'survival', 'sandbox',
      'open world', 'singleplayer', 'multiplayer', 'co-op', 'vr'
    ];
    
    const lowerAppName = appName.toLowerCase();
    
    // Check for game indicators in the name
    const hasGameIndicator = gameIndicators.some(indicator => 
      appName.includes(indicator) || lowerAppName.includes(indicator.toLowerCase())
    );
    
    if (hasGameIndicator) {
      return true;
    }
    
    // Check for game categories in the name
    const hasGameCategory = gameCategories.some(category => 
      lowerAppName.includes(category)
    );
    
    if (hasGameCategory) {
      return true;
    }
    
    // Check for common game name patterns
    const gameNamePatterns = [
      /\d$/, // Names ending with a number (sequels)
      /[^a-z]ii[^a-z]/i, // Roman numerals II, III, etc.
      /edition/i, // Special editions
      /remaster/i, // Remastered versions
      /definitive/i // Definitive editions
    ];
    
    const matchesPattern = gameNamePatterns.some(pattern => 
      pattern.test(appName)
    );
    
    return matchesPattern;
  }

  /**
   * Get additional metadata from the app bundle's Info.plist
   */
  private async getAppBundleInfo(appPath: string) {
    try {
      // Use plutil to parse the Info.plist file
      const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
      const { stdout } = await execAsync(`plutil -extract CFBundleName raw "${infoPlistPath}" 2>/dev/null || echo ""`);
      const name = stdout.trim() || path.basename(appPath, '.app');
      
      const bundleIdResult = await execAsync(`plutil -extract CFBundleIdentifier raw "${infoPlistPath}" 2>/dev/null || echo ""`);
      const bundleId = bundleIdResult.stdout.trim();
      
      const versionResult = await execAsync(`plutil -extract CFBundleShortVersionString raw "${infoPlistPath}" 2>/dev/null || echo ""`);
      const version = versionResult.stdout.trim();
      
      // Check if it's likely a game by examining the bundle information
      const isGame = this.isLikelyGame(name, '');
      
      return {
        name,
        bundleId,
        version,
        isGame
      };
    } catch (err) {
      log('debug', 'Failed to get app bundle info', { path: appPath, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private getGameEntries(): Promise<types.IGameStoreEntry[]> {
    if (!this.mHomeDir) {
      return Promise.resolve([]);
    }

    return Promise.resolve().then(async () => {
      const gameEntries: types.IGameStoreEntry[] = [];
      
      try {
        // Mac App Store games are typically installed in /Applications or ~/Applications
        const appPaths = [
          '/Applications',
          path.join(this.mHomeDir, 'Applications')
        ];

        for (const appPath of appPaths) {
          try {
            if (await fs.pathExists(appPath)) {
              const files = await fs.readdir(appPath);
              for (const file of files) {
                if (file.endsWith('.app')) {
                  const fullPath = path.join(appPath, file);
                  const stat = await fs.stat(fullPath);
                  
                  // Get metadata for the app
                  const bundleInfo = await this.getAppBundleInfo(fullPath);
                  const metadata = await this.getAppMetadata(fullPath);
                  
                  // Use bundle info if available, otherwise fall back to metadata
                  let appName = file.replace('.app', '');
                  let bundleId = '';
                  let isGame = false;
                  
                  if (bundleInfo) {
                    appName = bundleInfo.name || appName;
                    bundleId = bundleInfo.bundleId || bundleId;
                    isGame = bundleInfo.isGame;
                  } else if (metadata) {
                    appName = metadata.name || appName;
                    bundleId = metadata.bundleId || bundleId;
                    isGame = metadata.isGame;
                  }
                  
                  // Only include apps that are likely games
                  if (isGame) {
                    gameEntries.push({
                      appid: bundleId || file.replace('.app', ''),
                      name: appName,
                      gamePath: fullPath,
                      gameStoreId: STORE_ID
                    });
                  }
                }
              }
            }
          } catch (err: any) {
            log('debug', 'Failed to scan app directory', { path: appPath, error: err?.message });
          }
        }
      } catch (err: any) {
        log('warn', 'Failed to get Mac App Store game entries', err);
      }

      return gameEntries;
    });
  }
}

function main(context: types.IExtensionContext) {
  const instance: types.IGameStore = new MacAppStore();

  if (instance !== undefined) {
    context.registerGameStore(instance);
  }

  return true;
}

export default main;