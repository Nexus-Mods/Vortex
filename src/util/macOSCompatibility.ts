/**
 * macOS Compatibility Layer for Community Extensions
 * Provides shims and utilities to help extensions work seamlessly on macOS
 */

import * as path from 'path';
import { isMacOS, isWindows, isLinux, getCurrentPlatform } from './platform';

/**
 * Normalize path for macOS compatibility
 * Handles case sensitivity and path separator issues
 */
export function normalizeForMacOS(inputPath: string): string {
  if (!isMacOS()) {
    return inputPath;
  }
  
  // Convert Windows path separators to Unix
  let normalized = inputPath.replace(/\\/g, '/');
  
  // Handle case sensitivity - macOS is case-preserving but case-insensitive
  // We'll preserve the original case but provide case-insensitive access
  return normalized;
}

/**
 * Check if a path exists with case-insensitive matching on macOS
 */
export async function pathExistsCaseInsensitive(
  fs: any,
  checkPath: string
): Promise<boolean> {
  if (!isMacOS()) {
    return fs.existsAsync(checkPath);
  }

  try {
    // First try exact match
    if (await fs.existsAsync(checkPath)) {
      return true;
    }

    // If not found, try case-insensitive search in parent directory
    const dir = path.dirname(checkPath);
    const base = path.basename(checkPath);
    
    if (await fs.existsAsync(dir)) {
      const files = await fs.readdirAsync(dir);
      const lowerBase = base.toLowerCase();
      
      for (const file of files) {
        if (file.toLowerCase() === lowerBase) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Resolve executable path with macOS compatibility
 * Handles .exe extension removal and case sensitivity
 */
export function resolveExecutable(executablePath: string): string {
  if (!isMacOS()) {
    return executablePath;
  }

  let resolved = executablePath;
  
  // Remove .exe extension on macOS
  if (resolved.toLowerCase().endsWith('.exe')) {
    resolved = resolved.slice(0, -4);
  }
  
  // Handle common Windows executable patterns
  const exePatterns = [
    /\\.exe$/i,
    /_windows(\.\w+)?$/i,
    /_win32(\.\w+)?$/i,
    /_win64(\.\w+)?$/i
  ];

  for (const pattern of exePatterns) {
    resolved = resolved.replace(pattern, '');
  }

  return resolved;
}

/**
 * Get platform-appropriate executable name
 */
export function getPlatformExecutable(baseName: string): string {
  if (isWindows()) {
    return baseName + '.exe';
  }
  return baseName;
}

/**
 * Safe require for platform-specific modules
 * Returns null instead of throwing on macOS when Windows modules are requested
 */
export function safeRequire(moduleName: string): any {
  if (!isMacOS()) {
    try {
      return require(moduleName);
    } catch (err) {
      return null;
    }
  }

  // Handle Windows-specific modules on macOS
  const windowsModules = [
    'winapi-bindings',
    'windows-shortcuts',
    'winreg',
    'edge-paths',
    'windows.node'
  ];

  if (windowsModules.includes(moduleName)) {
    console.warn(`Windows module '${moduleName}' requested on macOS - returning null`);
    return null;
  }

  try {
    return require(moduleName);
  } catch (err) {
    return null;
  }
}

/**
 * Check if a module is available
 */
export function isModuleAvailable(moduleName: string): boolean {
  try {
    require.resolve(moduleName);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Filter out macOS-specific hidden files and directories
 */
export function filterMacOSArtifacts(files: string[]): string[] {
  return files.filter(file => 
    !file.startsWith('.') && 
    !file.includes('__MACOSX') &&
    file !== '.DS_Store' &&
    file !== 'Thumbs.db'
  );
}

/**
 * Check if a file is a macOS artifact
 */
export function isMacOSArtifact(filename: string): boolean {
  return filename.startsWith('.') || 
         filename.includes('__MACOSX') ||
         filename === '.DS_Store' ||
         filename === 'Thumbs.db';
}

/**
 * Platform-aware path join that handles macOS case sensitivity
 */
export function joinPaths(...paths: string[]): string {
  const joined = path.join(...paths);
  
  if (isMacOS()) {
    // On macOS, ensure we use forward slashes and handle case sensitivity
    return joined.replace(/\\/g, '/');
  }
  
  return joined;
}

/**
 * Platform-aware path resolution
 */
export function resolvePath(...paths: string[]): string {
  const resolved = path.resolve(...paths);
  
  if (isMacOS()) {
    // Convert to Unix-style path on macOS
    return resolved.replace(/\\/g, '/');
  }
  
  return resolved;
}

/**
 * Get platform-specific application data directory with fallbacks
 */
export function getAppDataDir(appName: string): string {
  if (isWindows()) {
    return path.join(process.env.APPDATA || '', appName);
  } else if (isMacOS()) {
    return path.join(process.env.HOME || '', 'Library', 'Application Support', appName);
  } else {
    return path.join(process.env.HOME || '', '.config', appName);
  }
}

/**
 * Platform-aware executable detection
 */
export function findExecutable(
  fs: any,
  baseDir: string,
  executableName: string
): Promise<string | null> {
  const platformExecutable = getPlatformExecutable(executableName);
  
  return new Promise(async (resolve) => {
    try {
      // Try exact match first
      const exactPath = path.join(baseDir, platformExecutable);
      if (await fs.existsAsync(exactPath)) {
        return resolve(exactPath);
      }

      // On macOS, try case-insensitive search
      if (isMacOS()) {
        const files = await fs.readdirAsync(baseDir);
        const lowerTarget = platformExecutable.toLowerCase();
        
        for (const file of files) {
          if (file.toLowerCase() === lowerTarget) {
            return resolve(path.join(baseDir, file));
          }
        }
      }

      resolve(null);
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * macOS compatibility layer for community extensions
 * Provides drop-in replacements for common platform-specific patterns
 */
export const macCompatibility = {
  // Path utilities
  path: {
    join: CompatibilityShims.joinPaths,
    resolve: CompatibilityShims.resolvePath,
    normalize: macOSPath.normalizeForMacOS,
    existsCaseInsensitive: macOSPath.pathExistsCaseInsensitive
  },

  // Module utilities
  modules: {
    safeRequire: macOSModules.safeRequire,
    isAvailable: macOSModules.isModuleAvailable
  },

  // File system utilities
  fs: {
    filterArtifacts: macOSFS.filterMacOSArtifacts,
    isArtifact: macOSFS.isMacOSArtifact
  },

  // Platform detection
  platform: {
    isWindows,
    isMacOS,
    isLinux,
    current: getCurrentPlatform
  },

  // Application directories
  directories: {
    getAppData: CompatibilityShims.getAppDataDir
  },

  // Executable utilities
  executable: {
    resolve: macOSPath.resolveExecutable,
    find: CompatibilityShims.findExecutable,
    getPlatformName: macOSPath.getPlatformExecutable
  }
};

export default macCompatibility;