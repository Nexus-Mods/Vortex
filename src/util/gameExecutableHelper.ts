/**
 * Game Executable Helper for Platform-Aware Resolution
 * 
 * This utility provides game extensions with easy access to the new
 * platform-aware executable resolution system for macOS compatibility.
 */

import * as path from 'path';
import { resolveGameExecutable, ExecutableCandidate, GameExecutableOptions as ResolverOptions, getBestExecutableCandidate } from './executableResolver';
import { log } from './log';

export interface GameExecutableOptions {
  /** Preferred executable paths for different platforms */
  preferredPaths?: {
    win32?: string[];
    darwin?: string[];
    linux?: string[];
  };
  /** Whether to include Windows executables via virtualization on macOS */
  includeVirtualization?: boolean;
  /** Game-specific identifier for logging */
  gameId?: string;
}

/**
 * Resolve the best executable for a game using platform-aware logic
 * 
 * @param discoveryPath The discovered game installation path
 * @param options Configuration options for executable resolution
 * @returns The relative path to the best executable, or null if none found
 */
export async function resolveGameExecutableForExtension(
  discoveryPath: string,
  options: GameExecutableOptions = {}
): Promise<string | null> {
  const { gameId = 'unknown' } = options;
  
  try {
    log('debug', `Resolving executable for game: ${gameId}`, { discoveryPath });
    
    // Build resolver options
    const resolverOptions: ResolverOptions = {
      gameName: gameId,
      gameId,
      basePath: discoveryPath,
      windowsExecutable: options.preferredPaths?.win32?.[0],
      macExecutable: options.preferredPaths?.darwin?.[0],
      linuxExecutable: options.preferredPaths?.linux?.[0]
    };
    
    const candidates = await resolveGameExecutable(resolverOptions);
    const bestCandidate = getBestExecutableCandidate(candidates);
    
    if (bestCandidate) {
      // Return relative path from discovery path
      const relativePath = path.relative(discoveryPath, bestCandidate.path);
      log('debug', `Resolved executable for ${gameId}`, {
        executable: relativePath,
        type: bestCandidate.type,
        priority: bestCandidate.priority
      });
      return relativePath;
    }
    
    log('warn', `No executable found for game: ${gameId}`, { discoveryPath });
    return null;
    
  } catch (error) {
    log('error', `Failed to resolve executable for game: ${gameId}`, {
      discoveryPath,
      error: error.message
    });
    return null;
  }
}

/**
 * Legacy compatibility function that mimics the old gameExecutable pattern
 * but uses the new platform-aware resolution under the hood
 * 
 * @param discoveryPath The discovered game installation path
 * @param fallbackPaths Platform-specific fallback paths
 * @param gameId Game identifier for logging
 * @returns The executable path (relative to discovery path)
 */
export async function legacyGameExecutable(
  discoveryPath: string | undefined,
  fallbackPaths: {
    win32?: string;
    darwin?: string;
    linux?: string;
  },
  gameId: string
): Promise<string> {
  // If no discovery path, return platform-specific fallback
  if (!discoveryPath) {
    const fallback = fallbackPaths[process.platform as keyof typeof fallbackPaths];
    if (fallback) {
      log('debug', `Using fallback executable for ${gameId}`, { fallback, platform: process.platform });
      return fallback;
    }
  }
  
  // Try platform-aware resolution
  if (discoveryPath) {
    const preferredPaths = {
      win32: fallbackPaths.win32 ? [fallbackPaths.win32] : undefined,
      darwin: fallbackPaths.darwin ? [fallbackPaths.darwin] : undefined,
      linux: fallbackPaths.linux ? [fallbackPaths.linux] : undefined
    };
    
    const resolved = await resolveGameExecutableForExtension(discoveryPath, {
      preferredPaths,
      gameId
    });
    
    if (resolved) {
      return resolved;
    }
  }
  
  // Final fallback to current platform
  const platformFallback = fallbackPaths[process.platform as keyof typeof fallbackPaths];
  if (platformFallback) {
    log('debug', `Using final platform fallback for ${gameId}`, { fallback: platformFallback });
    return platformFallback;
  }
  
  // Ultimate fallback - try Windows executable (most common)
  if (fallbackPaths.win32) {
    log('debug', `Using Windows fallback for ${gameId}`, { fallback: fallbackPaths.win32 });
    return fallbackPaths.win32;
  }
  
  throw new Error(`No executable found for game: ${gameId}`);
}

/**
 * Simple helper for games that just need basic platform detection
 * with the new resolution system as a fallback
 * 
 * @param discoveryPath The discovered game installation path
 * @param executablePaths Platform-specific executable paths
 * @param gameId Game identifier
 * @returns Promise resolving to the executable path
 */
export async function simpleGameExecutable(
  discoveryPath: string | undefined,
  executablePaths: {
    win32: string;
    darwin?: string;
    linux?: string;
  },
  gameId: string
): Promise<string> {
  return legacyGameExecutable(discoveryPath, executablePaths, gameId);
}

/**
 * Helper for games that need to check multiple possible executable locations
 * 
 * @param discoveryPath The discovered game installation path
 * @param possiblePaths Array of possible executable paths to check
 * @param gameId Game identifier
 * @returns Promise resolving to the first found executable path
 */
export async function multiPathGameExecutable(
  discoveryPath: string,
  possiblePaths: string[],
  gameId: string
): Promise<string | null> {
  const preferredPaths = {
    [process.platform]: possiblePaths
  };
  
  return resolveGameExecutableForExtension(discoveryPath, {
    preferredPaths,
    gameId
  });
}