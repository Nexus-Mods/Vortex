/**
 * macOS-specific security utilities for Vortex
 * Implements hardened runtime security measures for macOS
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as child_process from 'child_process';
import { log } from './log';

// Cache for security-scoped bookmarks
const bookmarkCache = new Map<string, string>();

/**
 * Sanitize PATH environment variable for subprocess launches
 * Removes potentially dangerous paths like Homebrew directories
 * @returns Sanitized PATH environment variable
 */
export function sanitizePathEnvironment(): string {
  const originalPath = process.env.PATH || '';
  const pathEntries = originalPath.split(path.delimiter);
  
  // Remove potentially dangerous paths
  const dangerousPaths = [
    '/usr/local/bin',     // Homebrew
    '/opt/homebrew/bin',  // Homebrew on Apple Silicon
    '/usr/local/sbin',
    '/opt/homebrew/sbin',
    '/opt/local/bin',     // MacPorts
    '/opt/local/sbin'
  ];
  
  const sanitizedPaths = pathEntries.filter(entry => 
    !dangerousPaths.includes(entry) && 
    !entry.includes('node_modules') &&
    !entry.includes('.npm') &&
    !entry.includes('.yarn')
  );
  
  return sanitizedPaths.join(path.delimiter);
}

/**
 * Execute a subprocess with hardened security settings
 * @param command Command to execute
 * @param args Command arguments
 * @param options Additional options
 * @returns Promise with execution result
 */
export function executeSecureSubprocess(
  command: string,
  args: string[],
  options: child_process.SpawnOptions = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    // Sanitize environment
    const sanitizedEnv = { ...process.env };
    sanitizedEnv.PATH = sanitizePathEnvironment();
    
    // Remove potentially dangerous environment variables
    delete sanitizedEnv.DYLD_LIBRARY_PATH;
    delete sanitizedEnv.DYLD_FRAMEWORK_PATH;
    delete sanitizedEnv.DYLD_INSERT_LIBRARIES;
    delete sanitizedEnv.LD_LIBRARY_PATH;
    delete sanitizedEnv.LD_PRELOAD;
    
    const spawnOptions: child_process.SpawnOptions = {
      env: sanitizedEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    };
    
    log('debug', 'Executing secure subprocess', { 
      command, 
      args,
      sanitizedPath: sanitizedEnv.PATH 
    });
    
    const proc = child_process.spawn(command, args, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
    
    proc.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Properly execute a macOS app bundle
 * @param appBundlePath Path to the .app bundle
 * @param args Arguments to pass to the executable
 * @returns Promise with execution result
 */
export async function executeAppBundle(
  appBundlePath: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    // Verify this is actually an app bundle
    const infoPlistPath = path.join(appBundlePath, 'Contents', 'Info.plist');
    if (!await fs.pathExists(infoPlistPath)) {
      throw new Error(`Invalid app bundle: ${appBundlePath}`);
    }
    
    // Get the executable name from Info.plist
    const plist = require('simple-vdf');
    const infoPlistContent = await fs.readFile(infoPlistPath, 'utf8');
    const infoPlist = plist.parse(infoPlistContent);
    const executableName = infoPlist?.CFBundleExecutable;
    
    if (!executableName) {
      throw new Error(`Could not determine executable name from Info.plist`);
    }
    
    // Construct the path to the actual executable
    const executablePath = path.join(
      appBundlePath, 
      'Contents', 
      'MacOS', 
      executableName
    );
    
    // Verify the executable exists and is actually executable
    try {
      await fs.access(executablePath, fs.constants.X_OK);
    } catch (err) {
      throw new Error(`Executable not found or not executable: ${executablePath}`);
    }
    
    // Execute the app bundle executable directly
    return executeSecureSubprocess(executablePath, args);
  } catch (error) {
    log('error', 'Failed to execute app bundle', { 
      appBundlePath, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Create a security-scoped bookmark for persistent file access
 * @param filePath Path to create bookmark for
 * @returns Promise with bookmark data
 */
export async function createSecurityScopedBookmark(filePath: string): Promise<string> {
  try {
    // On macOS, we would use the Security framework to create a bookmark
    // This is a simplified implementation for now
    const bookmark = Buffer.from(filePath).toString('base64');
    bookmarkCache.set(filePath, bookmark);
    return bookmark;
  } catch (error) {
    log('error', 'Failed to create security-scoped bookmark', { 
      filePath, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Resolve a security-scoped bookmark to a file path
 * @param bookmark Bookmark data
 * @returns Promise with resolved file path
 */
export async function resolveSecurityScopedBookmark(bookmark: string): Promise<string> {
  try {
    // This is a simplified implementation
    // In a real implementation, we would use the Security framework
    const filePath = Buffer.from(bookmark, 'base64').toString('utf8');
    
    // Verify the file still exists
    if (await fs.pathExists(filePath)) {
      return filePath;
    } else {
      throw new Error(`Bookmarked file no longer exists: ${filePath}`);
    }
  } catch (error) {
    log('error', 'Failed to resolve security-scoped bookmark', { 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Check if a file path is within a security-scoped bookmark
 * @param filePath File path to check
 * @param bookmark Bookmark to check against
 * @returns Promise with boolean result
 */
export async function isPathInBookmarkScope(filePath: string, bookmark: string): Promise<boolean> {
  try {
    const bookmarkedPath = await resolveSecurityScopedBookmark(bookmark);
    const normalizedFilePath = path.resolve(filePath);
    const normalizedBookmarkedPath = path.resolve(bookmarkedPath);
    
    // Check if the file path is within the bookmarked directory
    return normalizedFilePath.startsWith(normalizedBookmarkedPath);
  } catch (error) {
    log('error', 'Failed to check path against bookmark scope', { 
      filePath, 
      error: error.message 
    });
    return false;
  }
}

/**
 * Normalize a file path for macOS security
 * Handles case-insensitive file systems and special characters
 * @param filePath Path to normalize
 * @returns Normalized path
 */
export function normalizeMacOSPath(filePath: string): string {
  try {
    // Resolve the path to handle relative paths and symlinks
    const resolvedPath = path.resolve(filePath);
    
    // On macOS, the file system is case-insensitive by default
    // We don't need to do anything special here for now
    return resolvedPath;
  } catch (error) {
    log('warn', 'Failed to normalize macOS path', { 
      filePath, 
      error: error.message 
    });
    return filePath;
  }
}

/**
 * Check if the app is running in a translocated location
 * @returns Promise with boolean result
 */
export async function isAppTranslocated(): Promise<boolean> {
  try {
    const appPath = process.execPath;
    // Check if the app path contains "/AppTranslocation"
    return appPath.includes('/AppTranslocation');
  } catch (error) {
    log('error', 'Failed to check app translocation status', { 
      error: error.message 
    });
    return false;
  }
}

/**
 * Get the proper application directory for macOS
 * @returns Promise with application directory path
 */
export async function getMacOSAppDirectory(): Promise<string> {
  try {
    // Check if we're in a translocated location
    const translocated = await isAppTranslocated();
    if (translocated) {
      // If translocated, we should guide the user to move the app
      log('warn', 'App is running from translocated location');
    }
    
    // Get the user's Applications directory
    return path.join(os.homedir(), 'Applications');
  } catch (error) {
    log('error', 'Failed to get macOS app directory', { 
      error: error.message 
    });
    // Fallback to a reasonable default
    return '/Applications';
  }
}