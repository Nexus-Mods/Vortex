/**
 * Platform detection utilities for consistent cross-platform behavior
 */

export type Platform = 'win32' | 'darwin' | 'linux';

/**
 * Get the current platform
 */
export function getCurrentPlatform(): Platform {
  return process.platform as Platform;
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return process.platform === 'linux';
}

/**
 * Check if running on a Unix-like system (macOS or Linux)
 */
export function isUnix(): boolean {
  return isMacOS() || isLinux();
}

/**
 * Get platform-specific executable extension
 */
export function getExecutableExtension(): string {
  return isWindows() ? '.exe' : '';
}

/**
 * Get platform-specific path separator
 */
export function getPathSeparator(): string {
  return isWindows() ? '\\' : '/';
}

/**
 * Get platform-specific line ending
 */
export function getLineEnding(): string {
  return isWindows() ? '\r\n' : '\n';
}

/**
 * Execute platform-specific logic
 */
export function platformSwitch<T>(options: {
  win32?: () => T;
  darwin?: () => T;
  linux?: () => T;
  default?: () => T;
}): T {
  const platform = getCurrentPlatform();
  
  if (options[platform]) {
    return options[platform]!();
  }
  
  if (options.default) {
    return options.default();
  }
  
  throw new Error(`No handler defined for platform: ${platform}`);
}

/**
 * Get platform-specific application data directory
 */
export function getAppDataPath(): string {
  return platformSwitch({
    win32: () => process.env.APPDATA || '',
    darwin: () => process.env.HOME ? `${process.env.HOME}/Library/Application Support` : '',
    linux: () => process.env.XDG_CONFIG_HOME || (process.env.HOME ? `${process.env.HOME}/.config` : ''),
    default: () => ''
  });
}

/**
 * Get platform-specific user home directory
 */
export function getHomeDirectory(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Get platform-specific documents directory
 */
export function getDocumentsPath(): string {
  return platformSwitch({
    win32: () => process.env.USERPROFILE ? `${process.env.USERPROFILE}\\Documents` : '',
    darwin: () => process.env.HOME ? `${process.env.HOME}/Documents` : '',
    linux: () => process.env.HOME ? `${process.env.HOME}/Documents` : '',
    default: () => ''
  });
}

/**
 * Check if a path is case-sensitive on the current platform
 */
export function isPathCaseSensitive(): boolean {
  return !isWindows();
}

/**
 * Normalize path separators for the current platform
 */
export function normalizePath(inputPath: string): string {
  if (isWindows()) {
    return inputPath.replace(/\//g, '\\');
  } else {
    return inputPath.replace(/\\/g, '/');
  }
}

/**
 * Get platform-specific Wine prefix path for Linux
 */
export function getWinePrefixPath(): string {
  if (!isLinux()) {
    return '';
  }
  
  return process.env.WINEPREFIX || 
         (process.env.HOME ? `${process.env.HOME}/.wine` : '');
}

/**
 * Get Wine drive C path for Linux
 */
export function getWineDriveCPath(): string {
  if (!isLinux()) {
    return '';
  }
  
  const winePrefix = getWinePrefixPath();
  return winePrefix ? `${winePrefix}/drive_c` : '';
}

/**
 * Check if Wine is available on Linux
 */
export function isWineAvailable(): boolean {
  return isLinux() && !!getWinePrefixPath();
}

/**
 * Check if running on macOS with virtualization support
 * This is always true on macOS as we can detect Crossover/Parallels
 */
export function isMacOSWithVirtualization(): boolean {
  return isMacOS();
}