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
  // Balatro
  {
    gameId: 'balatro',
    windowsExecutable: 'Balatro.exe',
    macOSAppBundle: 'Balatro.app',
    alternativeFiles: ['liblovely.dylib', 'run_lovely_macos.sh']
  },
  // Cyberpunk 2077
  {
    gameId: 'cyberpunk2077',
    windowsExecutable: 'bin/x64/Cyberpunk2077.exe',
    macOSAppBundle: 'Cyberpunk 2077.app',
    alternativeFiles: ['REDprelauncher.app']
  },
  // Stardew Valley
  {
    gameId: 'stardewvalley',
    windowsExecutable: 'StardewValley.exe',
    macOSAppBundle: 'StardewValley.app',
    alternativeFiles: ['Stardew Valley.app']
  },
  // RimWorld
  {
    gameId: 'rimworld',
    windowsExecutable: 'RimWorldWin64.exe',
    macOSAppBundle: 'RimWorld.app',
    alternativeFiles: ['RimWorldMac.app']
  },
  // Factorio
  {
    gameId: 'factorio',
    windowsExecutable: 'bin/x64/factorio.exe',
    macOSAppBundle: 'Factorio.app',
    alternativeFiles: ['factorio']
  },
  // Kenshi
  {
    gameId: 'kenshi',
    windowsExecutable: 'kenshi.exe',
    macOSAppBundle: 'Kenshi.app',
    alternativeFiles: ['kenshi.x86_64']
  },
  // Mount & Blade II: Bannerlord
  {
    gameId: 'mountandblade2bannerlord',
    windowsExecutable: 'bin/Win64_Shipping_Client/Bannerlord.exe',
    macOSAppBundle: 'Mount & Blade II Bannerlord.app',
    alternativeFiles: ['Bannerlord']
  },
  // The Witcher 3: Wild Hunt
  {
    gameId: 'witcher3',
    windowsExecutable: 'bin/x64/witcher3.exe',
    macOSAppBundle: 'The Witcher 3 Wild Hunt.app',
    alternativeFiles: ['witcher3']
  },
  // Subnautica
  {
    gameId: 'subnautica',
    windowsExecutable: 'Subnautica.exe',
    macOSAppBundle: 'Subnautica.app',
    alternativeFiles: ['Subnautica.x86_64']
  },
  // Subnautica: Below Zero
  {
    gameId: 'subnauticabelowzero',
    windowsExecutable: 'SubnauticaZero.exe',
    macOSAppBundle: 'Subnautica Below Zero.app',
    alternativeFiles: ['SubnauticaZero.x86_64']
  },
  // No Man's Sky
  {
    gameId: 'nomanssky',
    windowsExecutable: 'Binaries/NMS.exe',
    macOSAppBundle: 'No Mans Sky.app',
    alternativeFiles: ['NMS']
  },
  // Hades
  {
    gameId: 'hades',
    windowsExecutable: 'Hades.exe',
    macOSAppBundle: 'Hades.app',
    alternativeFiles: ['Hades.x86_64']
  },
  // Darkest Dungeon
  {
    gameId: 'darkestdungeon',
    windowsExecutable: 'Darkest.exe',
    macOSAppBundle: 'Darkest Dungeon.app',
    alternativeFiles: ['Darkest.x86_64']
  },
  // Slay the Spire
  {
    gameId: 'slaythespire',
    windowsExecutable: 'desktop-1.0.jar',
    macOSAppBundle: 'SlayTheSpire.app',
    alternativeFiles: ['SlayTheSpire']
  },
  // Terraria
  {
    gameId: 'terraria',
    windowsExecutable: 'Terraria.exe',
    macOSAppBundle: 'Terraria.app',
    alternativeFiles: ['Terraria.bin.x86_64']
  },
  // Oxygen Not Included
  {
    gameId: 'oxygennotincluded',
    windowsExecutable: 'OxygenNotIncluded.exe',
    macOSAppBundle: 'Oxygen Not Included.app',
    alternativeFiles: ['OxygenNotIncluded.x86_64']
  },
  // Cities: Skylines
  {
    gameId: 'cities-skylines',
    windowsExecutable: 'Cities.exe',
    macOSAppBundle: 'Cities Skylines.app',
    alternativeFiles: ['Cities.x86_64']
  },
  // Surviving Mars
  {
    gameId: 'survivingmars',
    windowsExecutable: 'Surviving Mars.exe',
    macOSAppBundle: 'Surviving Mars.app',
    alternativeFiles: ['Surviving Mars.x86_64']
  },
  // Frostpunk
  {
    gameId: 'frostpunk',
    windowsExecutable: 'Frostpunk.exe',
    macOSAppBundle: 'Frostpunk.app',
    alternativeFiles: ['Frostpunk.x86_64']
  },
  // Conan Exiles
  {
    gameId: 'conanexiles',
    windowsExecutable: 'ConanSandbox.exe',
    macOSAppBundle: 'Conan Exiles.app',
    alternativeFiles: ['ConanSandbox']
  },
  // 7 Days to Die
  {
    gameId: '7daystodie',
    windowsExecutable: '7DaysToDie.exe',
    macOSAppBundle: '7 Days To Die.app',
    alternativeFiles: ['7DaysToDie.x86_64']
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
      const macOSFileName = arch === 'arm64' ? 'lovely-aarch64-apple-darwin.tar.gz' : 'lovely-x86_64-apple-darwin.tar.gz';
      
      // Handle both versioned and latest URLs
      if (windowsUrl.includes('/latest/download/')) {
        return `https://github.com/ethangreen-dev/lovely-injector/releases/latest/download/${macOSFileName}`;
      } else {
        return `https://github.com/ethangreen-dev/lovely-injector/releases/download/v${version}/${macOSFileName}`;
      }
    },
    description: 'Lovely injector for Balatro - Windows to macOS conversion with architecture detection'
  },
  {
    // Steammodded for Balatro - Source code downloads are platform-independent
    windowsPattern: /https:\/\/github\.com\/[^\/]+\/[Ss]teamodded\/releases\/(?:download\/[^\/]+\/|latest\/download\/).*\.zip$/,
    getMacOSUrl: (windowsUrl: string) => {
      // Source code downloads are platform-independent, just return the same URL
      return windowsUrl;
    },
    description: 'Steammodded for Balatro - Source code downloads (platform independent)'
  },
  // Generic pattern for common Windows to macOS conversions
  {
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
  },
  // Steam Workshop download patterns
  {
    windowsPattern: /https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=\d+/,  
    getMacOSUrl: (windowsUrl: string) => {
      // Steam Workshop URLs are platform-independent
      return windowsUrl;
    },
    description: 'Steam Workshop download URLs (platform independent)'
  },
  // Nexus Mods download patterns
  {
    windowsPattern: /https:\/\/.*nexusmods\.com\/.*\/mods\/\d+/,  
    getMacOSUrl: (windowsUrl: string) => {
      // Nexus Mods URLs are platform-independent but may need manual selection
      return windowsUrl;
    },
    description: 'Nexus Mods download URLs (platform independent)'
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
export async function checkFileWithMacOSFallback(
  basePath: string,
  fileName: string,
  gameId: string
) {
  try {
    const filePath = path.join(basePath, fileName);
    
    // Check if the file exists directly
    if (await fs.pathExists(filePath)) {
      return true;
    }
    
    // Use our new normalization function for better macOS compatibility
    const normalizedPath = await normalizeGamePathForMacOS(basePath, gameId, fileName);
    if (normalizedPath && normalizedPath !== basePath) {
      return await fs.pathExists(normalizedPath);
    }
    
    // Check for macOS-specific alternatives
    const fix = getMacOSGameFix(gameId);
    if (fix && fileName === fix.windowsExecutable) {
      // Try to find the macOS app bundle using our enhanced function
      const appBundlePath = await findMacOSAppBundle(basePath, fix.macOSAppBundle);
      if (appBundlePath) {
        return true;
      }
      
      // Check alternative files if available
      if (fix.alternativeFiles) {
        for (const altFile of fix.alternativeFiles) {
          if (await fs.pathExists(path.join(basePath, altFile))) {
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (err) {
    log('debug', 'Error checking file existence', { basePath, fileName, gameId, error: err.message });
    return false;
  }
}

/**
 * Validate required files with macOS compatibility
 */
export async function validateRequiredFilesWithMacOSCompat(
  basePath: string,
  requiredFiles: string[],
  gameId: string
) {
  if (!requiredFiles || requiredFiles.length === 0) {
    return;
  }
  
  const results = [];
  for (const file of requiredFiles) {
    const exists = await checkFileWithMacOSFallback(basePath, file, gameId);
    results.push({ file, exists });
  }
  
  const missingFiles = results
    .filter(result => !result.exists)
    .map(result => result.file);
  
  if (missingFiles.length > 0) {
    const error = new Error(`Missing required files: ${missingFiles.join(', ')}`);
    (error as any).code = 'ENOENT';
    throw error;
  }
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
  
  // For now, use the simpler approach to avoid async complexity
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

/**
 * Find macOS app bundle in a directory
 * @param basePath Base directory to search in
 * @param appBundleName Expected app bundle name
 * @returns Full path to app bundle or null if not found
 */
export async function findMacOSAppBundle(basePath: string, appBundleName: string) {
  try {
    const fullPath = path.join(basePath, appBundleName);
    const exists = await fs.pathExists(fullPath);
    if (exists) {
      return fullPath;
    }
    
    // Try common variations
    const variations = [
      appBundleName,
      appBundleName.replace(/\.app$/, ''),
      appBundleName.replace(/ /g, ''),
      appBundleName.replace(/ /g, '-'),
    ];
    
    for (const variation of variations) {
      const variationPath = path.join(basePath, `${variation}.app`);
      if (await fs.pathExists(variationPath)) {
        return variationPath;
      }
    }
    
    return null;
  } catch (err) {
    log('debug', 'Error finding macOS app bundle', { basePath, appBundleName, error: err.message });
    return null;
  }
}

/**
 * Get the actual executable path inside a macOS app bundle
 * @param appBundlePath Path to the .app bundle
 * @returns Path to the actual executable inside the bundle
 */
export async function getExecutableFromAppBundle(appBundlePath: string) {
  try {
    // Standard location for macOS app executables
    const executablePath = path.join(appBundlePath, 'Contents', 'MacOS');
    const exists = await fs.pathExists(executablePath);
    
    if (exists) {
      // Get the first executable file in the MacOS directory
      const files = await fs.readdir(executablePath);
      const executableFiles = files.filter(file => !file.endsWith('.plist') && !file.startsWith('.'));
      
      if (executableFiles.length > 0) {
        return path.join(executablePath, executableFiles[0]);
      }
    }
    
    return null;
  } catch (err) {
    log('debug', 'Error getting executable from app bundle', { appBundlePath, error: err.message });
    return null;
  }
}

/**
 * Normalize a game path for macOS
 * This handles cases where the game might be in different locations
 * @param basePath Base path where the game is expected to be
 * @param gameId Game ID for specific handling
 * @param expectedExecutable Expected executable name
 * @returns Normalized path or null if not found
 */
export async function normalizeGamePathForMacOS(
  basePath: string, 
  gameId: string, 
  expectedExecutable?: string
) {
  if (process.platform !== 'darwin') {
    return expectedExecutable ? path.join(basePath, expectedExecutable) : basePath;
  }
  
  // Check if we have a specific fix for this game
  const fix = getMacOSGameFix(gameId);
  if (fix && expectedExecutable === fix.windowsExecutable) {
    // Try to find the macOS app bundle
    const appBundlePath = await findMacOSAppBundle(basePath, fix.macOSAppBundle);
    if (appBundlePath) {
      return appBundlePath;
    }
  }
  
  // If we have an expected executable, try to find it
  if (expectedExecutable) {
    // Try the direct path first
    let fullPath = path.join(basePath, expectedExecutable);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
    
    // Try common macOS patterns
    if (expectedExecutable.endsWith('.exe')) {
      const baseName = path.basename(expectedExecutable, '.exe');
      const appBundleName = `${baseName}.app`;
      const appBundlePath = await findMacOSAppBundle(basePath, appBundleName);
      if (appBundlePath) {
        return appBundlePath;
      }
      
      // Try just the base name as an executable
      fullPath = path.join(basePath, baseName);
      if (await fs.pathExists(fullPath)) {
        return fullPath;
      }
    }
  }
  
  // Return the base path if nothing else is found
  return basePath;
}