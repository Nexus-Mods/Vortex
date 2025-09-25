/**
 * macOS-specific game discovery utilities
 * Implements priority order: native > app store > steam > other mac stores > windows games
 */

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import Bluebird from 'bluebird';
import { isMacOS } from './platform';
import { log } from './log';
import { resolveGameExecutable, GameExecutableOptions, ExecutableCandidate } from './executableResolver';
import { getMacOSGameFix, findMacOSAppBundle, normalizeGamePathForMacOS } from './macOSGameCompatibility';
import { IGame } from '../types/IGame';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IDiscoveredTool } from '../types/IDiscoveredTool';

// Cache for discovery results to avoid redundant operations
interface DiscoveryCache {
  [key: string]: {
    candidates: MacOSGameCandidate[];
    timestamp: number;
    checksum: string;
  };
}

const discoveryCache: DiscoveryCache = {};

// Cache management functions
function getCacheKey(options: MacOSGameDiscoveryOptions): string {
  return `${options.gameId}-${options.gameName}-${options.windowsExecutable || ''}-${options.macExecutable || ''}`;
}

function generateChecksum(options: MacOSGameDiscoveryOptions): string {
  // Simple checksum based on options and current time (for cache invalidation)
  const data = JSON.stringify(options) + Date.now().toString().slice(0, -6); // Truncate to minutes
  return Buffer.from(data).toString('base64').slice(0, 16);
}

function getCachedResult(options: MacOSGameDiscoveryOptions): MacOSGameCandidate[] | null {
  const key = getCacheKey(options);
  const cached = discoveryCache[key];
  
  if (!cached) {
    return null;
  }
  
  // Cache expires after 5 minutes or if checksum doesn't match
  const now = Date.now();
  const cacheAge = now - cached.timestamp;
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  if (cacheAge > maxAge) {
    delete discoveryCache[key];
    return null;
  }
  
  const currentChecksum = generateChecksum(options);
  if (cached.checksum !== currentChecksum) {
    delete discoveryCache[key];
    return null;
  }
  
  log('debug', 'Using cached macOS discovery result', { gameId: options.gameId, cacheAge });
  return cached.candidates;
}

function setCachedResult(options: MacOSGameDiscoveryOptions, candidates: MacOSGameCandidate[]): void {
  const key = getCacheKey(options);
  discoveryCache[key] = {
    candidates: [...candidates], // Deep copy to avoid mutations
    timestamp: Date.now(),
    checksum: generateChecksum(options)
  };
}

type DiscoveredCB = (gameId: string, result: IDiscoveryResult) => void;
type DiscoveredToolCB = (gameId: string, result: IDiscoveredTool) => void;

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface MacOSGameDiscoveryOptions {
  gameName: string;
  gameId: string;
  windowsExecutable?: string;
  macExecutable?: string;
  appBundleName?: string;
  searchPaths?: string[];
}

export interface MacOSGameCandidate {
  path: string;
  executable: string;
  type: 'native' | 'app' | 'steam' | 'epic' | 'gog' | 'windows';
  priority: number;
  store?: string;
  manifestData?: {
    appId: string;
    name: string;
    installDir: string;
    manifestPath: string;
  };
}

/**
 * macOS game discovery priority levels
 * Lower numbers = higher priority
 */
export const MACOS_DISCOVERY_PRIORITIES = {
  STEAM: 5,           // Highest priority - using manifest files for accurate detection
  NATIVE_APP: 10,
  APP_STORE: 20,
  EPIC: 40,
  GOG: 50,
  OTHER_MAC_STORES: 60,
  CROSSOVER: 70,
  PARALLELS: 80,
  VMWARE: 90,
  OTHER_WINDOWS: 100
};

/**
 * Common macOS application directories
 * Note: Excluding ~/Applications and /Applications/Utilities as they typically contain Steam shortcuts
 */
const MACOS_APP_DIRECTORIES = [
  '/Applications', // Main applications directory (but we'll filter out Steam shortcuts)
  '/System/Applications',
  '/System/Applications/Utilities'
];

/**
 * Directories to ignore during game discovery (contain Steam shortcuts, not actual games)
 */
const IGNORED_DISCOVERY_DIRECTORIES = [
  '~/Applications', // User applications folder - typically Steam shortcuts
  '/Applications/Utilities' // System utilities - never contains games
];

/**
 * Check if a path should be ignored during discovery
 */
function shouldIgnoreDiscoveryPath(targetPath: string): boolean {
  const expandedIgnoredPaths = IGNORED_DISCOVERY_DIRECTORIES.map(dir => 
    dir.replace('~', process.env.HOME || '')
  );
  
  return expandedIgnoredPaths.some(ignoredPath => 
    targetPath.startsWith(ignoredPath)
  );
}

/**
 * Check if an app bundle is likely a Steam shortcut
 */
async function isSteamShortcut(appPath: string): Promise<boolean> {
  try {
    const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
    const stats = await stat(infoPlistPath);
    
    if (!stats.isFile()) {
      return false;
    }
    
    // Read the Info.plist file to check for Steam-specific identifiers
    const plistContent = await fs.promises.readFile(infoPlistPath, 'utf8');
    
    // Steam shortcuts typically have specific bundle identifiers or executable names
    const steamIndicators = [
      'com.valvesoftware.steam',
      'steam_osx',
      'SteamLaunch',
      'steam://rungameid'
    ];
    
    return steamIndicators.some(indicator => 
      plistContent.toLowerCase().includes(indicator.toLowerCase())
    );
  } catch (err) {
    // If we can't read the plist, assume it's not a Steam shortcut
    return false;
  }
}

/**
 * Steam library paths on macOS
 */
const MACOS_STEAM_PATHS = [
  '~/Library/Application Support/Steam/steamapps/common',
  '/Applications/Steam.app/Contents/MacOS/steamapps/common'
];

/**
 * Epic Games Store paths on macOS
 */
const MACOS_EPIC_PATHS = [
  '~/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests'
];

/**
 * GOG Galaxy paths on macOS
 */
const MACOS_GOG_PATHS = [
  '~/Library/Application Support/GOG.com/Galaxy/Applications'
];

/**
 * CrossOver bottle paths
 */
const CROSSOVER_PATHS = [
  '~/Library/Application Support/CrossOver/Bottles',
  '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/Bottles'
];

/**
 * Parallels Desktop paths
 */
const PARALLELS_PATHS = [
  '~/Parallels',
  '~/Documents/Parallels'
];

/**
 * Discover games on macOS with proper priority order and progress feedback
 */
export function discoverMacOSGames(knownGames: IGame[],
                                   discoveredGames: {[id: string]: IDiscoveryResult},
                                   onDiscoveredGame: DiscoveredCB,
                                   onDiscoveredTool: DiscoveredToolCB,
                                   onProgress?: (gameId: string, step: string, percent: number) => void): Bluebird<string[]> {
  if (!isMacOS()) {
    return Bluebird.resolve([]);
  }

  const discoveredGameIds: string[] = [];
  
  return Bluebird.map(knownGames, async (game, gameIndex) => {
    try {
      const options: MacOSGameDiscoveryOptions = {
        gameName: game.name,
        gameId: game.id,
        windowsExecutable: game.executable?.(),
        macExecutable: game.executable?.(),
        appBundleName: game.name
      };
      
      // Create progress callback for this specific game
      const gameProgressCallback = (step: string, percent: number) => {
        onProgress?.(game.id, step, percent);
        log('debug', 'macOS discovery progress', { 
          gameId: game.id, 
          step, 
          percent,
          gameIndex: gameIndex + 1,
          totalGames: knownGames.length
        });
      };
      
      const candidates = await discoverMacOSGamesInternal(options, gameProgressCallback);
      
      if (candidates.length > 0) {
        const bestCandidate = getBestMacOSGameCandidate(candidates);
        if (bestCandidate) {
          const discoveryResult: IDiscoveryResult = {
             path: bestCandidate.path,
             tools: {},
             hidden: false,
             environment: {},
             executable: bestCandidate.executable,
             store: bestCandidate.store
           };
          
          onDiscoveredGame(game.id, discoveryResult);
          discoveredGameIds.push(game.id);
          
          log('info', 'macOS game discovered', {
            gameId: game.id,
            store: bestCandidate.store,
            type: bestCandidate.type,
            path: bestCandidate.path
          });
        }
      }
    } catch (err) {
      log('warn', 'Error discovering macOS game', { gameId: game.id, error: err.message });
    }
    
    return game.id;
  }, { concurrency: 3 }) // Reduced concurrency to avoid overwhelming the system
  .then(() => discoveredGameIds);
}

/**
 * Internal function for discovering games with progress feedback and parallelization
 */
export async function discoverMacOSGamesInternal(
  options: MacOSGameDiscoveryOptions, 
  onProgress?: (step: string, percent: number) => void
): Promise<MacOSGameCandidate[]> {
  if (!isMacOS()) {
    return [];
  }

  // Check cache first
  const cachedResult = getCachedResult(options);
  if (cachedResult) {
    onProgress?.('Using cached results', 100);
    return cachedResult;
  }

  const candidates: MacOSGameCandidate[] = [];
  
  try {
    // Define discovery methods with their names for progress tracking
    const discoveryMethods = [
      { name: 'Native Apps', method: () => discoverNativeApps(options) },
      { name: 'App Store', method: () => discoverAppStoreApps(options) },
      { name: 'Steam', method: () => discoverSteamGames(options) },
      { name: 'Epic Games', method: () => discoverEpicGames(options) },
      { name: 'GOG Galaxy', method: () => discoverGOGGames(options) },
      { name: 'CrossOver', method: () => discoverCrossOverGames(options) },
      { name: 'Parallels', method: () => discoverParallelsGames(options) }
    ];

    // Run discovery methods in parallel with progress tracking
    const results = await Promise.allSettled(
      discoveryMethods.map(async (discovery, index) => {
        try {
          onProgress?.(discovery.name, Math.floor((index / discoveryMethods.length) * 100));
          log('debug', `Starting ${discovery.name} discovery for ${options.gameId}`);
          
          const startTime = Date.now();
          const result = await discovery.method();
          const duration = Date.now() - startTime;
          
          log('debug', `Completed ${discovery.name} discovery for ${options.gameId}`, {
            duration: `${duration}ms`,
            found: result.length
          });
          
          onProgress?.(discovery.name, Math.floor(((index + 1) / discoveryMethods.length) * 100));
          return result;
        } catch (err) {
          log('warn', `Error in ${discovery.name} discovery`, { 
            gameId: options.gameId, 
            error: err.message 
          });
          return [];
        }
      })
    );

    // Collect all successful results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        candidates.push(...result.value);
      }
    });

    onProgress?.('Complete', 100);
    
    // Cache the results
    setCachedResult(options, candidates);
    
  } catch (err) {
    log('warn', 'Error during macOS game discovery', { error: err.message, options });
  }
  
  // Sort by priority (lower number = higher priority)
  return candidates.sort((a, b) => a.priority - b.priority);
}

/**
 * Discover native macOS applications
 */
async function discoverNativeApps(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  // Check if we have a compatibility fix for this game
  const gameFix = getMacOSGameFix(options.gameId);
  
  for (const appDir of MACOS_APP_DIRECTORIES) {
    const expandedPath = appDir.replace('~', process.env.HOME || '');
    
    // Skip ignored directories
    if (shouldIgnoreDiscoveryPath(expandedPath)) {
      log('debug', 'Skipping ignored discovery directory', {
        gameId: options.gameId,
        directory: expandedPath
      });
      continue;
    }
    
    try {
      // Look for app bundle using compatibility system first
      if (gameFix) {
        const appBundlePath = await findMacOSAppBundle(expandedPath, gameFix.macOSAppBundle);
        if (appBundlePath) {
          candidates.push({
            path: path.dirname(appBundlePath),
            executable: appBundlePath,
            type: 'app',
            priority: MACOS_DISCOVERY_PRIORITIES.NATIVE_APP,
            store: 'native'
          });
          
          log('debug', 'Found native macOS app bundle via compatibility system', {
            gameId: options.gameId,
            appPath: appBundlePath,
            directory: expandedPath
          });
        }
        
        // Also check alternative files
        if (gameFix.alternativeFiles) {
          for (const altFile of gameFix.alternativeFiles) {
            const altPath = path.join(expandedPath, altFile);
            try {
              const stats = await stat(altPath);
              if (stats.isFile() || (stats.isDirectory() && altFile.endsWith('.app'))) {
                candidates.push({
                  path: path.dirname(altPath),
                  executable: altPath,
                  type: altFile.endsWith('.app') ? 'app' : 'native',
                  priority: MACOS_DISCOVERY_PRIORITIES.NATIVE_APP,
                  store: 'native'
                });
                
                log('debug', 'Found alternative file via compatibility system', {
                  gameId: options.gameId,
                  altPath,
                  directory: expandedPath
                });
              }
            } catch (err) {
              // Alternative file not found, continue
            }
          }
        }
      }
      
      // Look for app bundle using original method as fallback
      if (options.appBundleName) {
        const appName = options.appBundleName.endsWith('.app') ? options.appBundleName : `${options.appBundleName}.app`;
        const appPath = path.join(expandedPath, appName);
        
        try {
          const stats = await stat(appPath);
          if (stats.isDirectory()) {
            // Verify it's a valid app bundle
            const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
            await stat(infoPlistPath);
            
            // Check if this is a Steam shortcut and skip it
            if (await isSteamShortcut(appPath)) {
              log('debug', 'Skipping Steam shortcut app bundle', {
                gameId: options.gameId,
                appPath,
                directory: expandedPath
              });
              continue;
            }
            
            candidates.push({
              path: path.dirname(appPath),
              executable: appPath,
              type: 'app',
              priority: MACOS_DISCOVERY_PRIORITIES.NATIVE_APP,
              store: 'native'
            });
            
            log('debug', 'Found native macOS app bundle', {
              gameId: options.gameId,
              appPath,
              directory: expandedPath
            });
          }
        } catch (err) {
          log('debug', 'App bundle not found in directory', {
            gameId: options.gameId,
            appName,
            directory: expandedPath,
            error: err.message
          });
        }
      }
      
      // Look for native executable
      if (options.macExecutable) {
        const execPath = path.join(expandedPath, options.macExecutable);
        
        try {
          const stats = await stat(execPath);
          if (stats.isFile() && (stats.mode & parseInt('111', 8))) {
            candidates.push({
              path: path.dirname(execPath),
              executable: execPath,
              type: 'native',
              priority: MACOS_DISCOVERY_PRIORITIES.NATIVE_APP,
              store: 'native'
            });
            
            log('debug', 'Found native macOS executable', {
              gameId: options.gameId,
              execPath,
              directory: expandedPath
            });
          }
        } catch (err) {
          log('debug', 'Native executable not found in directory', {
            gameId: options.gameId,
            executable: options.macExecutable,
            directory: expandedPath,
            error: err.message
          });
        }
      }
    } catch (err) {
      log('debug', 'Could not access native app directory', {
        gameId: options.gameId,
        directory: expandedPath,
        error: err.message
      });
    }
  }
  
  return candidates;
}

/**
 * Discover Mac App Store applications
 */
async function discoverAppStoreApps(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  // App Store apps are typically in /Applications with specific bundle identifiers
  // This is a simplified implementation - a full implementation would check bundle IDs
  const appStoreDir = '/Applications';
  
  if (options.appBundleName) {
    const appName = options.appBundleName.endsWith('.app') ? options.appBundleName : `${options.appBundleName}.app`;
    const appPath = path.join(appStoreDir, appName);
    
    try {
      const stats = await stat(appPath);
      if (stats.isDirectory()) {
        // Check if it's an App Store app by looking for receipt
        const receiptPath = path.join(appPath, 'Contents', '_MASReceipt', 'receipt');
        try {
          await stat(receiptPath);
          candidates.push({
            path: path.dirname(appPath),
            executable: appPath,
            type: 'app',
            priority: MACOS_DISCOVERY_PRIORITIES.APP_STORE,
            store: 'appstore'
          });
          
          log('debug', 'Found App Store game', {
            gameId: options.gameId,
            appPath,
            receiptPath
          });
        } catch (err) {
          log('debug', 'App does not have App Store receipt', {
            gameId: options.gameId,
            appPath,
            receiptPath,
            error: err.message
          });
        }
      }
    } catch (err) {
      log('debug', 'App Store app not found', {
        gameId: options.gameId,
        appName,
        appPath,
        error: err.message
      });
    }
  }
  
  return candidates;
}

/**
 * Discover Steam games on macOS using manifest files for better detection
 */
async function discoverSteamGames(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  // First try manifest-based discovery (highest priority)
  try {
    const manifestCandidates = await discoverSteamGamesFromManifests(options);
    candidates.push(...manifestCandidates);
    
    if (manifestCandidates.length > 0) {
      log('debug', 'Found Steam games via manifest discovery', {
        gameId: options.gameId,
        count: manifestCandidates.length
      });
    }
  } catch (err) {
    log('debug', 'Steam manifest discovery failed, falling back to directory search', {
      gameId: options.gameId,
      error: err.message
    });
  }
  
  // Fallback to directory-based discovery if manifest discovery didn't find anything
  if (candidates.length === 0) {
    const dirCandidates = await discoverSteamGamesFromDirectories(options);
    candidates.push(...dirCandidates);
  }
  
  return candidates;
}

/**
 * Discover Steam games using Steam manifest files (appmanifest_*.acf)
 */
async function discoverSteamGamesFromManifests(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  for (const steamPath of MACOS_STEAM_PATHS) {
    const expandedPath = steamPath.replace('~', process.env.HOME || '');
    
    try {
      const steamAppsPath = path.join(expandedPath, 'steamapps');
      const manifestFiles = await readdir(steamAppsPath);
      
      const appManifests = manifestFiles.filter(name => 
        name.startsWith('appmanifest_') && name.endsWith('.acf')
      );
      
      for (const manifestFile of appManifests) {
        try {
          const manifestPath = path.join(steamAppsPath, manifestFile);
          const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
          
          // Parse Steam VDF format
          const { parse } = await import('simple-vdf');
          const manifestData = parse(manifestContent) as any;
          
          if (!manifestData?.AppState) {
            continue;
          }
          
          const appState = manifestData.AppState as any;
          const gameName = appState.name?.toLowerCase() || '';
          const installDir = appState.installdir;
          
          // Check if this manifest matches our target game
          const targetGameName = options.gameName.toLowerCase();
          if (gameName.includes(targetGameName) || targetGameName.includes(gameName)) {
            const gameDir = path.join(steamAppsPath, 'common', installDir);
            
            // Verify the game directory exists
            try {
              const stats = await stat(gameDir);
              if (stats.isDirectory()) {
                // Try to find the executable
                const execCandidates = await resolveGameExecutableWithRetry(options, gameDir);
                const bestExec = execCandidates.find(c => c.type === 'native' || c.type === 'app');
                
                if (bestExec) {
                  candidates.push({
                    path: gameDir,
                    executable: bestExec.path,
                    type: 'steam',
                    priority: MACOS_DISCOVERY_PRIORITIES.STEAM,
                    store: 'steam',
                    manifestData: {
                      appId: appState.appid,
                      name: appState.name,
                      installDir: installDir,
                      manifestPath: manifestPath
                    }
                  });
                  
                  log('debug', 'Found Steam game via manifest', {
                    gameId: options.gameId,
                    appId: appState.appid,
                    gameName: appState.name,
                    gameDir,
                    executable: bestExec.path,
                    manifestFile
                  });
                }
              }
            } catch (dirErr) {
              log('debug', 'Steam game directory not accessible', {
                gameId: options.gameId,
                gameDir,
                error: dirErr.message
              });
            }
          }
        } catch (manifestErr) {
          log('debug', 'Failed to parse Steam manifest', {
            gameId: options.gameId,
            manifestFile,
            error: manifestErr.message
          });
        }
      }
    } catch (err) {
      log('debug', 'Steam library not accessible for manifest discovery', {
        gameId: options.gameId,
        steamPath: expandedPath,
        error: err.message
      });
    }
  }
  
  return candidates;
}

/**
 * Fallback Steam discovery using directory search (legacy method)
 */
async function discoverSteamGamesFromDirectories(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  for (const steamPath of MACOS_STEAM_PATHS) {
    const expandedPath = steamPath.replace('~', process.env.HOME || '');
    
    try {
      const gameDir = path.join(expandedPath, 'steamapps', 'common', options.gameName);
      const stats = await stat(gameDir);
      
      if (stats.isDirectory()) {
        const execCandidates = await resolveGameExecutableWithRetry(options, gameDir);
        const bestExec = execCandidates.find(c => c.type === 'native' || c.type === 'app');
        
        if (bestExec) {
          candidates.push({
            path: gameDir,
            executable: bestExec.path,
            type: 'steam',
            priority: MACOS_DISCOVERY_PRIORITIES.STEAM,
            store: 'steam'
          });
          
          log('debug', 'Found Steam game via directory search', {
            gameId: options.gameId,
            gameDir,
            executable: bestExec.path,
            steamPath: expandedPath
          });
        }
      }
    } catch (err) {
      log('debug', 'Steam game not found via directory search', {
        gameId: options.gameId,
        steamPath: expandedPath,
        error: err.message
      });
    }
  }
  
  return candidates;
}

/**
 * Helper function to resolve game executable with retry logic
 */
async function resolveGameExecutableWithRetry(options: MacOSGameDiscoveryOptions, gameDir: string): Promise<ExecutableCandidate[]> {
  let execCandidates: ExecutableCandidate[] = [];
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      const execOptions: GameExecutableOptions = {
        gameName: options.gameName,
        gameId: options.gameId,
        basePath: gameDir,
        windowsExecutable: options.windowsExecutable,
        macExecutable: options.macExecutable,
        appBundleName: options.appBundleName
      };
      
      execCandidates = await resolveGameExecutable(execOptions);
      if (execCandidates.length > 0) {
        break; // Success, exit retry loop
      }
    } catch (execErr) {
      retryCount++;
      if (retryCount >= maxRetries) {
        throw execErr; // Re-throw on final attempt
      }
      // Wait briefly before retry to allow file system operations to complete
      await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
    }
  }
  
  return execCandidates;
}

/**
 * Discover Epic Games Store games
 */
async function discoverEpicGames(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  for (const epicPath of MACOS_EPIC_PATHS) {
    const expandedPath = epicPath.replace('~', process.env.HOME || '');
    
    try {
      const manifests = await readdir(expandedPath);
      
      for (const manifest of manifests) {
        if (manifest.endsWith('.item')) {
          try {
              const manifestPath = path.join(expandedPath, manifest);
              const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
              const manifestData = JSON.parse(manifestContent);
              
              // Check if this manifest matches our game
              if (manifestData.DisplayName && 
                  manifestData.DisplayName.toLowerCase().includes(options.gameName.toLowerCase())) {
                const installLocation = manifestData.InstallLocation;
                
                if (installLocation) {
                  // Try to find the executable
                  try {
                    const execOptions: GameExecutableOptions = {
                      gameName: options.gameName,
                      gameId: options.gameId,
                      basePath: installLocation,
                      windowsExecutable: options.windowsExecutable,
                      macExecutable: options.macExecutable,
                      appBundleName: options.appBundleName
                    };
                    
                    const execCandidates = await resolveGameExecutable(execOptions);
                    const bestExec = execCandidates.find(c => c.type === 'native' || c.type === 'app');
                    
                    if (bestExec) {
                      candidates.push({
                        path: installLocation,
                        executable: bestExec.path,
                        type: 'epic',
                        priority: MACOS_DISCOVERY_PRIORITIES.EPIC,
                        store: 'epic'
                      });
                      
                      log('debug', 'Found Epic Games Store game', {
                        gameId: options.gameId,
                        displayName: manifestData.DisplayName,
                        installLocation,
                        executable: bestExec.path
                      });
                    }
                  } catch (execErr) {
                    log('warn', 'Failed to resolve executable for Epic game', {
                      gameId: options.gameId,
                      installLocation,
                      error: execErr.message
                    });
                  }
                }
              }
            } catch (err) {
              log('debug', 'Failed to parse Epic manifest', {
                gameId: options.gameId,
                manifestPath: path.join(expandedPath, manifest),
                error: err.message
              });
            }
        }
      }
    } catch (err) {
      // Epic path doesn't exist
    }
  }
  
  return candidates;
}

/**
 * Discover GOG Galaxy games
 */
async function discoverGOGGames(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  for (const gogPath of MACOS_GOG_PATHS) {
    const expandedPath = gogPath.replace('~', process.env.HOME || '');
    
    try {
      const games = await readdir(expandedPath);
      
      for (const gameDir of games) {
        const gamePath = path.join(expandedPath, gameDir);
        const stats = await stat(gamePath);
        
        if (stats.isDirectory() && 
            gameDir.toLowerCase().includes(options.gameName.toLowerCase())) {
          
          // Try to find the executable
          const execOptions: GameExecutableOptions = {
            gameName: options.gameName,
            gameId: options.gameId,
            basePath: gamePath,
            windowsExecutable: options.windowsExecutable,
            macExecutable: options.macExecutable,
            appBundleName: options.appBundleName
          };
          
          const execCandidates = await resolveGameExecutable(execOptions);
          const bestExec = execCandidates.find(c => c.type === 'native' || c.type === 'app');
          
          if (bestExec) {
            candidates.push({
              path: gamePath,
              executable: bestExec.path,
              type: 'gog',
              priority: MACOS_DISCOVERY_PRIORITIES.GOG,
              store: 'gog'
            });
          }
        }
      }
    } catch (err) {
      // GOG path doesn't exist
    }
  }
  
  return candidates;
}

/**
 * Discover CrossOver Windows games
 */
async function discoverCrossOverGames(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  for (const crossoverPath of CROSSOVER_PATHS) {
    const expandedPath = crossoverPath.replace('~', process.env.HOME || '');
    
    try {
      const bottles = await readdir(expandedPath);
      
      for (const bottle of bottles) {
        const bottlePath = path.join(expandedPath, bottle);
        const driveC = path.join(bottlePath, 'drive_c');
        
        try {
          await stat(driveC);
          
          // Look for the Windows executable in common game directories
          const commonDirs = [
            'Program Files',
            'Program Files (x86)',
            'Games'
          ];
          
          for (const dir of commonDirs) {
            const searchPath = path.join(driveC, dir);
            const gameCandidate = await findWindowsGameInPath(searchPath, options);
            
            if (gameCandidate) {
              candidates.push({
                path: gameCandidate.path,
                executable: gameCandidate.executable,
                type: 'windows',
                priority: MACOS_DISCOVERY_PRIORITIES.CROSSOVER,
                store: 'crossover'
              });
            }
          }
        } catch (err) {
          // Bottle doesn't exist or can't be accessed
        }
      }
    } catch (err) {
      // CrossOver path doesn't exist
    }
  }
  
  return candidates;
}

/**
 * Discover Parallels Windows games
 */
async function discoverParallelsGames(options: MacOSGameDiscoveryOptions): Promise<MacOSGameCandidate[]> {
  const candidates: MacOSGameCandidate[] = [];
  
  // Parallels discovery would require parsing VM configurations
  // This is a simplified implementation
  
  return candidates;
}

/**
 * Helper function to find Windows games in a specific path
 */
async function findWindowsGameInPath(searchPath: string, options: MacOSGameDiscoveryOptions): Promise<{ path: string; executable: string } | null> {
  if (!options.windowsExecutable) {
    return null;
  }
  
  try {
    const entries = await readdir(searchPath);
    
    for (const entry of entries) {
      const entryPath = path.join(searchPath, entry);
      const stats = await stat(entryPath);
      
      if (stats.isDirectory()) {
        // Check if this directory contains our game
        const execPath = path.join(entryPath, options.windowsExecutable);
        
        try {
          await stat(execPath);
          return {
            path: entryPath,
            executable: execPath
          };
        } catch (err) {
          // Executable not found, continue searching
        }
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be accessed
  }
  
  return null;
}

/**
 * Get the best game candidate from discovery results
 */
export function getBestMacOSGameCandidate(candidates: MacOSGameCandidate[]): MacOSGameCandidate | null {
  if (candidates.length === 0) {
    return null;
  }
  
  // Return the highest priority candidate (lowest priority number)
  return candidates[0];
}