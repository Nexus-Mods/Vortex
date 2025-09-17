/**
 * macOS Game Compatibility Layer
 * 
 * This module provides compatibility fixes for community game extensions
 * that may not properly handle macOS-specific executable formats.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { log } from './log';
import Promise from 'bluebird';

export interface MacOSGameFix {
  /** Game ID to apply the fix to */
  gameId: string;
  /** Windows executable name that the extension expects */
  windowsExecutable: string;
  /** macOS app bundle name to look for instead */
  macOSAppBundle: string;
  /** Alternative files to check for validation */
  alternativeFiles?: string[];
}

/**
 * Known macOS compatibility fixes for popular games
 */
const MACOS_GAME_FIXES: MacOSGameFix[] = [
  {
    gameId: 'balatro',
    windowsExecutable: 'Balatro.exe',
    macOSAppBundle: 'Balatro.app',
    alternativeFiles: ['Balatro.app', 'liblovely.dylib', 'run_lovely_macos.sh']
  },
  // Add more games as needed
];

/**
 * Get macOS compatibility fix for a game
 */
export function getMacOSGameFix(gameId: string): MacOSGameFix | undefined {
  return MACOS_GAME_FIXES.find(fix => fix.gameId.toLowerCase() === gameId.toLowerCase());
}

/**
 * Check if a file exists, with macOS-specific fallbacks
 */
export function checkFileWithMacOSFallback(
  basePath: string,
  fileName: string,
  gameId: string
): Promise<boolean> {
  const filePath = path.join(basePath, fileName);
  
  return Promise.resolve(fs.pathExists(filePath))
    .then((exists) => {
      if (exists) {
        return true;
      }
      
      // Check for macOS-specific alternatives
      const fix = getMacOSGameFix(gameId);
      if (fix && fileName === fix.windowsExecutable) {
        return Promise.resolve(fs.pathExists(path.join(basePath, fix.macOSAppBundle)))
          .then((macExists) => {
            if (macExists) {
              return true;
            }
            
            // Check alternative files if available
            if (fix.alternativeFiles) {
              return Promise.map(fix.alternativeFiles, (altFile) => 
                Promise.resolve(fs.pathExists(path.join(basePath, altFile)))
              ).then((results) => results.some(result => result));
            }
            
            return false;
          });
      }
      
      return false;
    })
    .catch((err) => {
      log('debug', 'Error checking file existence', { filePath, error: err.message });
      return false;
    });
}

/**
 * Validate required files with macOS compatibility
 */
export function validateRequiredFilesWithMacOSCompat(
  basePath: string,
  requiredFiles: string[],
  gameId: string
): Promise<void> {
  if (!requiredFiles || requiredFiles.length === 0) {
    return Promise.resolve();
  }
  
  return Promise.map(requiredFiles, (file) => 
    checkFileWithMacOSFallback(basePath, file, gameId)
      .then((exists) => ({ file, exists }))
  ).then((results) => {
    const missingFiles = results
      .filter(result => !result.exists)
      .map(result => result.file);
    
    if (missingFiles.length > 0) {
      const error = new Error(`Missing required files: ${missingFiles.join(', ')}`);
      (error as any).code = 'ENOENT';
      throw error;
    }
  });
}

/**
 * Get the appropriate executable path for the current platform
 */
export function getExecutablePathForPlatform(
  basePath: string,
  gameId: string,
  windowsExecutable?: string
): string | null {
  if (process.platform !== 'darwin') {
    return windowsExecutable ? path.join(basePath, windowsExecutable) : null;
  }
  
  const fix = getMacOSGameFix(gameId);
  if (fix && windowsExecutable === fix.windowsExecutable) {
    return path.join(basePath, fix.macOSAppBundle);
  }
  
  return windowsExecutable ? path.join(basePath, windowsExecutable) : null;
}