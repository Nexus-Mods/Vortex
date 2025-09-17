/**
 * Platform-aware executable resolution utilities for game discovery
 * Handles different executable formats (.exe, .app, native binaries) across platforms
 */

import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { isMacOS, isWindows, isLinux } from './platform';
import { log } from './log';

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
    // Priority 1: Native macOS executable
    if (options.macExecutable) {
      const nativeCandidate = await findNativeExecutable(options.basePath, options.macExecutable);
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
      const windowsCandidate = await findWindowsExecutable(options.basePath, options.windowsExecutable);
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
      const windowsCandidate = await findWindowsExecutable(options.basePath, options.windowsExecutable);
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
      const linuxCandidate = await findNativeExecutable(options.basePath, options.linuxExecutable);
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
      const wineCandidate = await findWindowsExecutable(options.basePath, options.windowsExecutable);
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
 */
async function findNativeExecutable(basePath: string, executableName: string): Promise<string | null> {
  try {
    const candidates = [
      path.join(basePath, executableName),
      path.join(basePath, 'bin', executableName),
      path.join(basePath, 'Contents', 'MacOS', executableName), // For app bundles
    ];
    
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
 */
async function findWindowsExecutable(basePath: string, executableName: string): Promise<string | null> {
  try {
    const exeName = executableName.endsWith('.exe') ? executableName : `${executableName}.exe`;
    const candidates = [
      path.join(basePath, exeName),
      path.join(basePath, 'bin', exeName),
      path.join(basePath, 'Binaries', exeName),
      path.join(basePath, 'Game', exeName),
    ];
    
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