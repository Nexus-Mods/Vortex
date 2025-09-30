/**
 * macOS Path Normalization Utilities
 * 
 * This module provides utilities for normalizing Windows-style paths to macOS equivalents,
 * handling common path patterns and conventions used in game modding and extension development.
 */

import * as path from 'path';
import { log } from './log';

/**
 * Interface for path conversion rules
 */
export interface PathConversionRule {
  windowsPattern: RegExp;
  macOSReplacement: string | ((match: RegExpMatchArray) => string);
  description: string;
}

/**
 * Common path conversion rules for Windows to macOS paths
 */
const PATH_CONVERSION_RULES: PathConversionRule[] = [
  // Vortex-specific paths
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\AppData\\Roaming\\Vortex/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Library/Application Support/Vortex`;
    },
    description: 'Vortex user data directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\AppData\\Local\\Vortex/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Library/Application Support/Vortex`;
    },
    description: 'Vortex local data directory'
  },
  {
    windowsPattern: /C:\\Program Files\\Vortex/,
    macOSReplacement: '/Applications/Vortex.app/Contents',
    description: 'Vortex application directory'
  },
  // User directories
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Documents\\My Games/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Library/Application Support`;
    },
    description: 'My Games directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\AppData\\Local\\Temp/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Library/Caches`;
    },
    description: 'Temporary files directory'
  },
  {
    windowsPattern: /C:\\ProgramData/,
    macOSReplacement: '/Library/Application Support',
    description: 'ProgramData directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Desktop/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Desktop`;
    },
    description: 'Desktop directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Documents/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Documents`;
    },
    description: 'Documents directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Downloads/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Downloads`;
    },
    description: 'Downloads directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Pictures/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Pictures`;
    },
    description: 'Pictures directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Music/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Music`;
    },
    description: 'Music directory'
  },
  {
    windowsPattern: /C:\\Users\\([^\\]+)\\Videos/,
    macOSReplacement: (match) => {
      const username = match[1];
      return `/Users/${username}/Movies`;
    },
    description: 'Videos directory (mapped to Movies on macOS)'
  },
  // Game store paths
  {
    windowsPattern: /C:\\Steam\\steamapps\\common/,
    macOSReplacement: (match) => {
      // Try common Steam paths on macOS
      return '~/Library/Application Support/Steam/steamapps/common';
    },
    description: 'Steam common games directory'
  },
  {
    windowsPattern: /C:\\Program Files \\(x86\\)Steam/,
    macOSReplacement: '/Applications/Steam.app',
    description: 'Steam application directory'
  },
  {
    windowsPattern: /C:\\Program Files\\Steam/,
    macOSReplacement: '/Applications/Steam.app',
    description: 'Steam application directory'
  },
  {
    windowsPattern: /C:\\Program Files\\Epic Games/,
    macOSReplacement: (match) => {
      return '~/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests';
    },
    description: 'Epic Games directory'
  },
  {
    windowsPattern: /C:\\Program Files\\GOG Galaxy/,
    macOSReplacement: (match) => {
      return '~/Library/Application Support/GOG.com/Galaxy';
    },
    description: 'GOG Galaxy directory'
  },
  {
    windowsPattern: /C:\\Program Files\\Origin/,
    macOSReplacement: (match) => {
      return '~/Library/Application Support/Origin';
    },
    description: 'Origin (EA App) directory'
  },
  {
    windowsPattern: /C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher/,
    macOSReplacement: (match) => {
      return '~/Library/Application Support/Uplay';
    },
    description: 'Ubisoft Connect directory'
  },
  // CrossOver/Parallels paths
  {
    windowsPattern: /C:\\Program Files\\CrossOver/,
    macOSReplacement: (match) => {
      return '~/Library/Application Support/CrossOver';
    },
    description: 'CrossOver directory'
  },
  {
    windowsPattern: /C:\\Program Files\\Parallels/,
    macOSReplacement: (match) => {
      return '~/Applications/Parallels';
    },
    description: 'Parallels directory'
  },
  // Generic drive letter mapping
  {
    windowsPattern: /([A-Z]):\\/,
    macOSReplacement: (match) => {
      // Generic drive letter conversion - map to /Volumes/DriveName
      const driveLetter = match[1];
      return `/Volumes/${driveLetter}`;
    },
    description: 'Generic drive letter mapping'
  }
];

/**
 * Normalize a Windows-style path to its macOS equivalent
 * 
 * @param windowsPath - The Windows-style path to normalize
 * @param username - Optional username for user-specific path conversion (defaults to current user)
 * @returns The macOS equivalent path, or the original path if no conversion rule matches
 */
export function normalizeWindowsPathToMacOS(windowsPath: string, username?: string): string {
  if (!windowsPath) {
    return windowsPath;
  }

  // Normalize backslashes to forward slashes for consistent processing
  let normalizedPath = windowsPath.replace(/\\/g, '/');

  // Apply conversion rules
  for (const rule of PATH_CONVERSION_RULES) {
    const match = normalizedPath.match(rule.windowsPattern);
    if (match) {
      try {
        if (typeof rule.macOSReplacement === 'function') {
          normalizedPath = normalizedPath.replace(rule.windowsPattern, rule.macOSReplacement(match));
        } else {
          normalizedPath = normalizedPath.replace(rule.windowsPattern, rule.macOSReplacement);
        }
        
        log('debug', 'Applied path conversion rule', {
          rule: rule.description,
          originalPath: windowsPath,
          convertedPath: normalizedPath
        });
        
        // Continue to apply additional rules for more comprehensive conversion
        // Don't break after first match to allow for more specific rules to override generic ones
      } catch (error) {
        log('warn', 'Error applying path conversion rule', {
          rule: rule.description,
          error: error.message,
          path: windowsPath
        });
      }
    }
  }

  // Handle special cases that weren't covered by rules
  // Convert Windows environment variables to macOS equivalents
  const envVarMappings: { [key: string]: string } = {
    '%USERPROFILE%': process.env.HOME || `/Users/${username || 'unknown'}`,
    '%APPDATA%': `${process.env.HOME || `/Users/${username || 'unknown'}`}/Library/Application Support`,
    '%LOCALAPPDATA%': `${process.env.HOME || `/Users/${username || 'unknown'}`}/Library/Application Support`,
    '%TEMP%': `${process.env.HOME || `/Users/${username || 'unknown'}`}/Library/Caches/TemporaryItems`,
    '%PROGRAMFILES%': '/Applications',
    '%PROGRAMFILES(X86)%': '/Applications',
    '%PROGRAMDATA%': '/Library/Application Support',
    '%PUBLIC%': '/Users/Shared',
    '%SYSTEMDRIVE%': '',
    '%HOMEPATH%': process.env.HOME || `/Users/${username || 'unknown'}`,
    '%HOMEDRIVE%': ''
  };

  for (const [winVar, macPath] of Object.entries(envVarMappings)) {
    normalizedPath = normalizedPath.replace(new RegExp(winVar.replace(/[()]/g, '\\$&'), 'gi'), macPath);
  }

  // Expand tilde to home directory if needed
  if (normalizedPath.startsWith('~')) {
    const homeDir = process.env.HOME || `/Users/${username || 'unknown'}`;
    normalizedPath = normalizedPath.replace('~', homeDir);
  }

  // Handle case sensitivity - macOS is case-preserving but case-insensitive
  // We'll preserve the original case but provide case-insensitive access
  return normalizedPath;
}

/**
 * Batch normalize multiple Windows paths to macOS equivalents
 * 
 * @param windowsPaths - Array of Windows-style paths to normalize
 * @param username - Optional username for user-specific path conversion
 * @returns Array of macOS equivalent paths
 */
export function normalizeWindowsPathsToMacOS(windowsPaths: string[], username?: string): string[] {
  return windowsPaths.map(path => normalizeWindowsPathToMacOS(path, username));
}

/**
 * Check if a path appears to be a Windows-style path
 * 
 * @param pathToCheck - The path to check
 * @returns True if the path appears to be Windows-style, false otherwise
 */
export function isWindowsStylePath(pathToCheck: string): boolean {
  if (!pathToCheck) {
    return false;
  }
  
  // Check for common Windows path indicators
  return (
    pathToCheck.includes('\\') || // Backslashes
    /^[A-Z]:[/\\]/.test(pathToCheck) || // Drive letters (C:\, D:\, etc.)
    pathToCheck.includes('C:\\Users\\') || // User profile paths
    pathToCheck.includes('C:\\Program Files') || // Program files
    pathToCheck.includes('C:\\ProgramData') || // ProgramData
    pathToCheck.includes('AppData') || // AppData directory
    pathToCheck.includes('%USERPROFILE%') || // Environment variables
    pathToCheck.includes('%APPDATA%') ||
    pathToCheck.includes('%LOCALAPPDATA%') ||
    pathToCheck.includes('%TEMP%') ||
    pathToCheck.includes('%PROGRAMFILES%') ||
    pathToCheck.includes('%PROGRAMDATA%') ||
    /%[A-Z_]+%/.test(pathToCheck) // Generic environment variable pattern
  );
}

/**
 * Convert a path to the appropriate platform format
 * 
 * @param inputPath - The path to convert
 * @param targetPlatform - The target platform ('win32', 'darwin', 'linux')
 * @returns The path in the appropriate format for the target platform
 */
export function convertPathForPlatform(inputPath: string, targetPlatform: string = process.platform): string {
  if (!inputPath) {
    return inputPath;
  }

  // If we're on macOS and the input path is Windows-style, normalize it
  if (targetPlatform === 'darwin' && isWindowsStylePath(inputPath)) {
    return normalizeWindowsPathToMacOS(inputPath);
  }

  // If we're on Windows and the input path is Unix-style, convert it
  if (targetPlatform === 'win32' && inputPath.startsWith('/')) {
    // This is a simplified conversion - in practice, this would need more sophisticated handling
    if (inputPath.startsWith('/Users/')) {
      const parts = inputPath.split('/');
      if (parts.length >= 3) {
        const username = parts[2];
        return `C:\\Users\\${username}\\${parts.slice(3).join('\\')}`;
      }
    }
    // Default to C:\ for other Unix paths
    return `C:\\${inputPath.substring(1).replace(/\//g, '\\')}`;
  }

  // If we're on Linux and the input path is Windows-style, normalize it
  if (targetPlatform === 'linux' && isWindowsStylePath(inputPath)) {
    // Basic conversion for Linux - replace drive letters with /mnt/ and backslashes with forward slashes
    let linuxPath = inputPath.replace(/([A-Z]):\\/gi, '/mnt/$1/')
                            .replace(/\\/g, '/')
                            .replace(/\/\/+/g, '/'); // Remove duplicate slashes
    
    // Handle common Windows paths
    linuxPath = linuxPath.replace(/\/Users\/([^\/]+)\/AppData\/Roaming/gi, '/home/$1/.config')
                        .replace(/\/Users\/([^\/]+)\/AppData\/Local/gi, '/home/$1/.local/share')
                        .replace(/\/Users\/([^\/]+)\/Documents/gi, '/home/$1/Documents')
                        .replace(/\/Users\/([^\/]+)\/Desktop/gi, '/home/$1/Desktop')
                        .replace(/\/Program Files/gi, '/opt')
                        .replace(/\/ProgramData/gi, '/usr/share');
    
    return linuxPath;
  }

  // For other cases, return the path as-is
  return inputPath;
}

/**
 * Register a custom path conversion rule
 * 
 * @param rule - The conversion rule to register
 */
export function registerCustomPathConversionRule(rule: PathConversionRule): void {
  // Add to the beginning of the array to give custom rules higher priority
  PATH_CONVERSION_RULES.unshift(rule);
  
  log('info', 'Registered custom path conversion rule', {
    description: rule.description,
    pattern: rule.windowsPattern.toString()
  });
}

/**
 * Get all registered path conversion rules
 * 
 * @returns Array of all registered path conversion rules
 */
export function getPathConversionRules(): PathConversionRule[] {
  return [...PATH_CONVERSION_RULES];
}

/**
 * Validate a path conversion rule
 * 
 * @param rule - The rule to validate
 * @param testPaths - Optional array of test paths to validate against
 * @returns Validation result with success status and any errors
 */
export function validatePathConversionRule(rule: PathConversionRule, testPaths?: string[]): {
  success: boolean;
  errors: string[];
  testResults?: Array<{ path: string; matches: boolean; convertedPath?: string; error?: string }>;
} {
  const errors: string[] = [];
  const testResults: Array<{ path: string; matches: boolean; convertedPath?: string; error?: string }> = [];

  try {
    // Basic validation
    if (!rule.windowsPattern) {
      errors.push('windowsPattern is required');
    }
    if (!rule.macOSReplacement) {
      errors.push('macOSReplacement is required');
    }
    if (!rule.description) {
      errors.push('description is required');
    }

    // Test with provided paths if any
    if (testPaths && testPaths.length > 0 && rule.windowsPattern) {
      for (const testPath of testPaths) {
        try {
          const matches = rule.windowsPattern.test(testPath);
          const result: any = { path: testPath, matches };
          
          if (matches) {
            try {
              let convertedPath: string;
              const match = testPath.match(rule.windowsPattern);
              if (typeof rule.macOSReplacement === 'function' && match) {
                convertedPath = rule.macOSReplacement(match);
              } else if (typeof rule.macOSReplacement === 'string') {
                convertedPath = testPath.replace(rule.windowsPattern, rule.macOSReplacement);
              } else {
                convertedPath = testPath; // fallback
              }
              result.convertedPath = convertedPath;
            } catch (conversionError) {
              result.error = conversionError.message;
            }
          }
          
          testResults.push(result);
        } catch (error) {
          testResults.push({
            path: testPath,
            matches: false,
            error: error.message
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      testResults: testPaths ? testResults : undefined
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Validation failed: ${error.message}`]
    };
  }
}

/**
 * Integrate with the macOS compatibility layer for community extensions
 * This function provides a unified interface for path normalization in the compatibility system
 * 
 * @param windowsPath - The Windows-style path to normalize
 * @param options - Options for normalization
 * @returns The normalized path for the current platform
 */
export function normalizePathForCompatibility(windowsPath: string, options?: { 
  username?: string; 
  targetPlatform?: string;
  gameId?: string;
  preserveCase?: boolean;
}): string {
  if (!windowsPath) {
    return windowsPath;
  }

  const targetPlatform = options?.targetPlatform || process.platform;
  
  // If we're on macOS and the input path is Windows-style, normalize it
  if (targetPlatform === 'darwin' && isWindowsStylePath(windowsPath)) {
    const normalizedPath = normalizeWindowsPathToMacOS(windowsPath, options?.username);
    
    // If we have a game ID, try to use game-specific normalization
    if (options?.gameId) {
      try {
        // Try to import the game compatibility module
        const gameCompatibility = require('./macOSGameCompatibility');
        if (gameCompatibility && typeof gameCompatibility.normalizeGamePathForMacOS === 'function') {
          // This would be an async operation, but we'll return the basic normalization for now
          // In a real implementation, this would be handled differently
          return normalizedPath;
        }
      } catch (err) {
        // If we can't import the game compatibility module, fall back to basic normalization
        log('debug', 'Could not load game compatibility module for path normalization', { 
          error: err.message,
          gameId: options.gameId 
        });
      }
    }
    
    return normalizedPath;
  }
  
  // For other platforms, use the standard conversion
  return convertPathForPlatform(windowsPath, targetPlatform);
}

/**
 * Batch normalize paths for compatibility with community extensions
 * 
 * @param windowsPaths - Array of Windows-style paths to normalize
 * @param options - Options for normalization
 * @returns Array of normalized paths for the current platform
 */
export function normalizePathsForCompatibility(windowsPaths: string[], options?: { 
  username?: string; 
  targetPlatform?: string;
  gameId?: string;
}): string[] {
  return windowsPaths.map(path => normalizePathForCompatibility(path, options));
}

export default {
  normalizeWindowsPathToMacOS,
  normalizeWindowsPathsToMacOS,
  isWindowsStylePath,
  convertPathForPlatform,
  normalizePathForCompatibility,
  normalizePathsForCompatibility,
  registerCustomPathConversionRule,
  getPathConversionRules,
  validatePathConversionRule
};