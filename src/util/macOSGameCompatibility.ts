/**
 * macOS Game Compatibility Layer
 * 
 * This module provides compatibility fixes for community game extensions
 * that may not properly handle macOS-specific executable formats.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
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

interface DownloadURLMapping {
  windowsPattern: RegExp;
  getMacOSUrl: (windowsUrl: string) => string;
  description: string;
}

/**
 * Known macOS compatibility fixes for popular games
 */
const MACOS_GAME_FIXES: MacOSGameFix[] = [
  {
    gameId: 'balatro',
    windowsExecutable: 'Balatro.exe',
    macOSAppBundle: 'Balatro.app',
    alternativeFiles: ['liblovely.dylib', 'run_lovely_macos.sh']
  },
  // Add more games as needed
  {
    gameId: 'cyberpunk2077',
    windowsExecutable: 'bin/x64/Cyberpunk2077.exe',
    macOSAppBundle: 'Cyberpunk 2077.app',
    alternativeFiles: ['REDprelauncher.app']
  }
];

/**
 * Download URL mappings for macOS compatibility
 */
const DOWNLOAD_URL_MAPPINGS: DownloadURLMapping[] = [
  {
    // Lovely injector for Balatro - Windows to macOS URL mapping
    windowsPattern: /https:\/\/github\.com\/ethangreen-dev\/lovely-injector\/releases\/(?:download\/v[\d.]+([-\w]*)?\/|latest\/download\/)lovely-(?:windows\.zip|x86_64-pc-windows-msvc\.zip)/,
    getMacOSUrl: (windowsUrl: string) => {
      // Extract version from Windows URL (including beta versions)
      const versionMatch = windowsUrl.match(/\/v([\d.]+([-\w]*)?)\//); 
      const version = versionMatch ? versionMatch[1] : 'latest';
      
      // Detect architecture and select appropriate macOS binary
      const arch = getMacOSArchitecture();
      const macOSFileName = arch === 'arm64' ? 'lovely-macos-arm64.zip' : 'lovely-macos-x64.zip';
      
      // Handle both versioned and latest URLs
      if (windowsUrl.includes('/latest/download/')) {
        return `https://github.com/ethangreen-dev/lovely-injector/releases/latest/download/${macOSFileName}`;
      } else {
        return `https://github.com/ethangreen-dev/lovely-injector/releases/download/v${version}/${macOSFileName}`;
      }
    },
    description: 'Lovely injector for Balatro - Windows to macOS conversion with architecture detection'
  }
  // Add more URL mappings as needed
  ,
  {
    // Generic pattern for common Windows to macOS conversions
    windowsPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+\/releases\/(?:download\/[^\/]+\/|latest\/download\/).*\.(exe|msi|zip)$/,
    getMacOSUrl: (windowsUrl: string) => {
      // Try to convert common Windows file patterns to macOS equivalents
      return windowsUrl
        .replace(/\.(exe|msi)$/, '.app')
        .replace(/windows/gi, 'macos')
        .replace(/win/gi, 'mac')
        .replace(/pc/gi, 'mac')
        .replace(/x86_64-pc-windows-msvc/g, `macos-${getMacOSArchitecture()}`)
        .replace(/x64-pc-windows-msvc/g, `macos-${getMacOSArchitecture()}`);
    },
    description: 'Generic Windows to macOS URL conversion'
  }
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

/**
 * Detects the current macOS architecture (ARM64 or Intel x64)
 * @returns 'arm64' for Apple Silicon Macs, 'x64' for Intel Macs
 */
export function getMacOSArchitecture(): 'arm64' | 'x64' {
  const arch = os.arch();
  return arch === 'arm64' ? 'arm64' : 'x64';
}

/**
 * Intercept and modify download URLs for macOS compatibility
 */
export function interceptDownloadURLForMacOS(url: string): string {
  // Always log URL interception attempts for debugging
  log('debug', 'URL interception called', {
    url: url,
    platform: os.platform(),
    architecture: getMacOSArchitecture()
  });

  if (os.platform() !== 'darwin') {
    log('debug', 'Not on macOS, returning original URL', { url });
    return url;
  }

  for (const mapping of DOWNLOAD_URL_MAPPINGS) {
    log('debug', 'Testing URL against pattern', {
      url: url,
      pattern: mapping.windowsPattern.toString(),
      matches: mapping.windowsPattern.test(url)
    });
    
    if (mapping.windowsPattern.test(url)) {
      const macUrl = mapping.getMacOSUrl(url);
      log('info', 'Intercepted Windows download URL for macOS compatibility', {
        originalUrl: url,
        macUrl: macUrl,
        description: mapping.description,
        architecture: getMacOSArchitecture()
      });
      return macUrl;
    }
  }

  log('debug', 'No URL mapping found, returning original URL', { url });
  return url;
}