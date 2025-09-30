/**
 * Platform-aware executable resolution utilities for game discovery
 * Handles different executable formats (.exe, .app, native binaries) across platforms
 */

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { isMacOS, isWindows, isLinux } from './platform';
import { log } from './log';
import { getMacOSGameFix, findMacOSAppBundle, normalizeGamePathForMacOS } from './macOSGameCompatibility';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export interface ExecutableCandidate {
  path: string;
  type: 'native' | 'app' | 'windows' | 'wine';
  priority: number;
  platform: 'darwin' | 'win32' | 'linux';
}

export interface GameExecutableOptions {
  gameName: string;
  gameId: string;
  basePath: string;
  windowsExecutable?: string;
  macExecutable?: string;
  linuxExecutable?: string;
  appBundleName?: string;
}

/**
 * Resolve platform-appropriate executable for a game
 * Implements macOS priority order: native > app store > steam > other mac stores > windows games
 */
export async function resolveGameExecutable(options: GameExecutableOptions): Promise<ExecutableCandidate[]> {
  const candidates: ExecutableCandidate[] = [];
  
  if (isMacOS()) {
    // Check if we have a compatibility fix for this game
    const gameFix = getMacOSGameFix(options.gameId);
    
    if (gameFix) {
      // Priority 0: Use compatibility system for known games
      const appBundlePath = await findMacOSAppBundle(options.basePath, gameFix.macOSAppBundle);
      if (appBundlePath) {
        candidates.push({
          path: appBundlePath,
          type: 'app',
          priority: 0,
          platform: 'darwin'
        });
        
        log('debug', 'Found game via compatibility system', {
          gameId: options.gameId,
          appBundlePath,
          basePath: options.basePath
        });
      }
      
      // Check alternative files
      if (gameFix.alternativeFiles) {
        for (const altFile of gameFix.alternativeFiles) {
          const altPath = path.join(options.basePath, altFile);
          try {
            const stats = await stat(altPath);
            if (stats.isFile() || (stats.isDirectory() && altFile.endsWith('.app'))) {
              candidates.push({
                path: altPath,
                type: altFile.endsWith('.app') ? 'app' : 'native',
                priority: 0,
                platform: 'darwin'
              });
              
              log('debug', 'Found alternative file via compatibility system', {
                gameId: options.gameId,
                altPath,
                basePath: options.basePath
              });
            }
          } catch (err) {
            // Alternative file not found, continue
          }
        }
      }
    }
    
    // Priority 1: Native macOS executable
    if (options.macExecutable) {
      const nativeCandidate = await findNativeExecutable(options.basePath, options.macExecutable, options.gameId);
      if (nativeCandidate) {
        candidates.push({
          path: nativeCandidate,
          type: 'native',
          priority: 1,
          platform: 'darwin'
        });
      }
    }
    
    // Priority 2: macOS App Bundle
    if (options.appBundleName) {
      const appCandidate = await findAppBundle(options.basePath, options.appBundleName);
      if (appCandidate) {
        candidates.push({
          path: appCandidate,
          type: 'app',
          priority: 2,
          platform: 'darwin'
        });
      }
    }
    
    // Priority 3: Windows executable via virtualization (CrossOver, Parallels, etc.)
    if (options.windowsExecutable) {
      const windowsCandidate = await findWindowsExecutable(options.basePath, options.windowsExecutable, options.gameId);
      if (windowsCandidate) {
        candidates.push({
          path: windowsCandidate,
          type: 'windows',
          priority: 3,
          platform: 'darwin'
        });
      }
    }
  } else if (isWindows()) {
    // Windows: prioritize native Windows executable
    if (options.windowsExecutable) {
      const windowsCandidate = await findWindowsExecutable(options.basePath, options.windowsExecutable, options.gameId);
      if (windowsCandidate) {
        candidates.push({
          path: windowsCandidate,
          type: 'native',
          priority: 1,
          platform: 'win32'
        });
      }
    }
  } else if (isLinux()) {
    // Linux: prioritize native Linux executable, then Wine
    if (options.linuxExecutable) {
      const linuxCandidate = await findNativeExecutable(options.basePath, options.linuxExecutable, options.gameId);
      if (linuxCandidate) {
        candidates.push({
          path: linuxCandidate,
          type: 'native',
          priority: 1,
          platform: 'linux'
        });
      }
    }
    
    if (options.windowsExecutable) {
      const wineCandidate = await findWindowsExecutable(options.basePath, options.windowsExecutable, options.gameId);
      if (wineCandidate) {
        candidates.push({
          path: wineCandidate,
          type: 'wine',
          priority: 2,
          platform: 'linux'
        });
      }
    }
  }
  
  // Sort by priority (lower number = higher priority)
  return candidates.sort((a, b) => a.priority - b.priority);
}

/**
 * Find native executable (macOS/Linux binary)
 * Enhanced with executable name mapping for better cross-platform compatibility
 */
async function findNativeExecutable(basePath: string, executableName: string, gameId?: string): Promise<string | null> {
  try {
    // Try to map the Windows executable name to macOS equivalent
    let mappedExecutableName = executableName;
    
    // Only try mapping if we're on macOS and the executable name looks like a Windows executable
    if (process.platform === 'darwin' && executableName.toLowerCase().endsWith('.exe')) {
      try {
        const macOSGameCompatibility = require('./macOSGameCompatibility');
        if (macOSGameCompatibility && typeof macOSGameCompatibility.mapWindowsExecutableToMacOS === 'function') {
          mappedExecutableName = macOSGameCompatibility.mapWindowsExecutableToMacOS(executableName, gameId);
          log('debug', 'Mapped Windows executable to macOS equivalent', { 
            windowsExecutable: executableName, 
            macOSExecutable: mappedExecutableName,
            gameId
          });
        }
      } catch (err) {
        log('debug', 'Could not use executable name mapping, using original name', { 
          executableName, 
          error: err.message 
        });
      }
    }
    
    const candidates = [
      path.join(basePath, mappedExecutableName),
      path.join(basePath, executableName), // Original name as fallback
      path.join(basePath, 'bin', mappedExecutableName),
      path.join(basePath, 'bin', executableName), // Original name as fallback
      path.join(basePath, 'Contents', 'MacOS', mappedExecutableName), // For app bundles
      path.join(basePath, 'Contents', 'MacOS', executableName), // Original name as fallback
    ];
    
    // Add candidates with .exe extension removed for macOS
    if (mappedExecutableName.toLowerCase().endsWith('.exe')) {
      const baseName = mappedExecutableName.slice(0, -4);
      candidates.push(
        path.join(basePath, baseName),
        path.join(basePath, 'bin', baseName),
        path.join(basePath, 'Contents', 'MacOS', baseName)
      );
    }
    
    for (const candidate of candidates) {
      try {
        const stats = await stat(candidate);
        if (stats.isFile() && (stats.mode & parseInt('111', 8))) { // Check if executable
          return candidate;
        }
      } catch (err) {
        // File doesn't exist, continue
      }
    }
  } catch (err) {
    log('warn', 'Error finding native executable', { basePath, executableName, error: err.message });
  }
  
  return null;
}

/**
 * Find macOS App Bundle
 */
async function findAppBundle(basePath: string, appBundleName: string): Promise<string | null> {
  try {
    const appName = appBundleName.endsWith('.app') ? appBundleName : `${appBundleName}.app`;
    const candidates = [
      path.join(basePath, appName),
      path.join(basePath, '..', appName), // Sometimes apps are in parent directory
      path.join('/Applications', appName), // System-wide installation
    ];
    
    for (const candidate of candidates) {
      try {
        const stats = await stat(candidate);
        if (stats.isDirectory()) {
          // Check if it's a valid app bundle
          const infoPlistPath = path.join(candidate, 'Contents', 'Info.plist');
          try {
            await stat(infoPlistPath);
            return candidate;
          } catch (err) {
            // Not a valid app bundle
          }
        }
      } catch (err) {
        // Directory doesn't exist, continue
      }
    }
  } catch (err) {
    log('warn', 'Error finding app bundle', { basePath, appBundleName, error: err.message });
  }
  
  return null;
}

/**
 * Find Windows executable (native on Windows, or via virtualization on macOS/Linux)
 * Enhanced with executable name mapping for better cross-platform compatibility
 */
async function findWindowsExecutable(basePath: string, executableName: string, gameId?: string): Promise<string | null> {
  try {
    // Try to map the Windows executable name to a more appropriate name
    let mappedExecutableName = executableName;
    
    // On macOS, try to map to a native equivalent when looking for Windows executables
    if (process.platform === 'darwin') {
      try {
        const macOSGameCompatibility = require('./macOSGameCompatibility');
        if (macOSGameCompatibility && typeof macOSGameCompatibility.mapWindowsExecutableToMacOS === 'function') {
          mappedExecutableName = macOSGameCompatibility.mapWindowsExecutableToMacOS(executableName, gameId);
          log('debug', 'Mapped Windows executable to potential macOS equivalent for CrossOver/Parallels', { 
            windowsExecutable: executableName, 
            mappedExecutable: mappedExecutableName,
            gameId
          });
        }
      } catch (err) {
        log('debug', 'Could not use executable name mapping for Windows executable, using original name', { 
          executableName, 
          error: err.message 
        });
      }
    }
    
    const exeName = executableName.endsWith('.exe') ? executableName : `${executableName}.exe`;
    const mappedExeName = mappedExecutableName.endsWith('.exe') ? mappedExecutableName : `${mappedExecutableName}.exe`;
    
    const candidates = [
      path.join(basePath, mappedExeName),
      path.join(basePath, exeName), // Original name as fallback
      path.join(basePath, 'bin', mappedExeName),
      path.join(basePath, 'bin', exeName), // Original name as fallback
      path.join(basePath, 'Binaries', mappedExeName),
      path.join(basePath, 'Binaries', exeName), // Original name as fallback
      path.join(basePath, 'Game', mappedExeName),
      path.join(basePath, 'Game', exeName), // Original name as fallback
    ];
    
    // On macOS, also add candidates for native executables
    if (process.platform === 'darwin') {
      candidates.push(
        path.join(basePath, mappedExecutableName),
        path.join(basePath, executableName), // Original name as fallback
        path.join(basePath, 'bin', mappedExecutableName),
        path.join(basePath, 'bin', executableName), // Original name as fallback
        path.join(basePath, 'Binaries', mappedExecutableName),
        path.join(basePath, 'Binaries', executableName) // Original name as fallback
      );
      
      // Add candidates with .exe extension removed for macOS
      if (mappedExecutableName.toLowerCase().endsWith('.exe')) {
        const baseName = mappedExecutableName.slice(0, -4);
        candidates.push(
          path.join(basePath, baseName),
          path.join(basePath, 'bin', baseName),
          path.join(basePath, 'Binaries', baseName)
        );
      }
    }
    
    for (const candidate of candidates) {
      try {
        const stats = await stat(candidate);
        if (stats.isFile()) {
          return candidate;
        }
      } catch (err) {
        // File doesn't exist, continue
      }
    }
  } catch (err) {
    log('warn', 'Error finding Windows executable', { basePath, executableName, error: err.message });
  }
  
  return null;
}

/**
 * Get the best executable candidate from a list
 */
export function getBestExecutableCandidate(candidates: ExecutableCandidate[]): ExecutableCandidate | null {
  if (candidates.length === 0) {
    return null;
  }
  
  // Return the highest priority candidate (lowest priority number)
  return candidates[0];
}

/**
 * Legacy function wrapper for backward compatibility
 * Returns the path of the best executable candidate
 */
export async function getGameExecutablePath(options: GameExecutableOptions): Promise<string | null> {
  const candidates = await resolveGameExecutable(options);
  const best = getBestExecutableCandidate(candidates);
  return best ? best.path : null;
}

/**
 * Check if a path points to a macOS app bundle
 */
export function isAppBundle(executablePath: string): boolean {
  return isMacOS() && executablePath.endsWith('.app');
}

/**
 * Check if a path points to a Windows executable
 */
export function isWindowsExecutable(executablePath: string): boolean {
  return executablePath.toLowerCase().endsWith('.exe');
}

/**
 * Get executable type from path
 */
export function getExecutableType(executablePath: string): 'native' | 'app' | 'windows' | 'unknown' {
  if (isAppBundle(executablePath)) {
    return 'app';
  }
  
  if (isWindowsExecutable(executablePath)) {
    return 'windows';
  }
  
  if (isMacOS() || isLinux()) {
    return 'native';
  }
  
  return 'unknown';
}