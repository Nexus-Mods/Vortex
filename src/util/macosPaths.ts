/**
 * macOS-specific path utilities
 */

import * as path from 'path';
import getVortexPath from './getVortexPath';

/**
 * Get macOS-specific application support directory
 * ~/Library/Application Support/Vortex
 */
export function getMacOSAppSupportPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Application Support', 'Vortex');
}

/**
 * Get macOS-specific caches directory
 * ~/Library/Caches/Vortex
 */
export function getMacOSCachesPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Caches', 'Vortex');
}

/**
 * Get macOS-specific preferences directory
 * ~/Library/Preferences/Vortex
 */
export function getMacOSPreferencesPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Preferences', 'Vortex');
}

/**
 * Get macOS-specific logs directory
 * ~/Library/Logs/Vortex
 */
export function getMacOSLogsPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Logs', 'Vortex');
}

/**
 * Get macOS-specific application directory
 * /Applications/Vortex.app
 */
export function getMacOSApplicationPath(): string {
  return '/Applications/Vortex.app';
}

/**
 * Get macOS-specific Steam directory
 * ~/Library/Application Support/Steam
 */
export function getMacOSSteamPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Application Support', 'Steam');
}

/**
 * Get macOS-specific GOG Galaxy directory
 * ~/Library/Application Support/GOG.com/Galaxy
 */
export function getMacOSGOGPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Application Support', 'GOG.com', 'Galaxy');
}

/**
 * Get macOS-specific Origin directory
 * ~/Library/Application Support/Origin
 */
export function getMacOSOriginPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Application Support', 'Origin');
}

/**
 * Get macOS-specific Epic Games directory
 * ~/Library/Application Support/Epic
 */
export function getMacOSEpicPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Application Support', 'Epic');
}

/**
 * Get macOS-specific Ubisoft Connect directory
 * ~/Library/Application Support/Ubisoft/Ubisoft Game Launcher
 */
export function getMacOSUbisoftPath(): string {
  const homeDir = getVortexPath('home');
  if (!homeDir) {
    return '';
  }
  return path.join(homeDir, 'Library', 'Application Support', 'Ubisoft', 'Ubisoft Game Launcher');
}

/**
 * Override Vortex paths for macOS
 */
export function setupMacOSPaths(): void {
  // Override userData path to use ~/Library/Application Support/Vortex
  const appSupportPath = getMacOSAppSupportPath();
  if (appSupportPath) {
    // Set userData to ~/Library/Application Support/Vortex
    process.env.VORTEX_USER_DATA = appSupportPath;
  }
  
  // Override temp path to use ~/Library/Caches/Vortex
  const cachesPath = getMacOSCachesPath();
  if (cachesPath) {
    // Set temp to ~/Library/Caches/Vortex
    process.env.VORTEX_TEMP = path.join(cachesPath, 'temp');
  }
}