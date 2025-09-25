/**
 * macOS Game Compatibility Layer
 * 
 * This module provides compatibility fixes for community game extensions on macOS.
 * It handles URL interception for downloads, executable path resolution, and other
 * macOS-specific adjustments needed for game extensions to work properly.
 * 
 * COMMUNITY EXTENSION DEVELOPERS:
 * ===============================
 * 
 * This layer provides several utilities to help your extensions work seamlessly on macOS:
 * 
 * 1. URL INTERCEPTION FOR DOWNLOADS:
 *    - Automatically converts Windows-specific download URLs to macOS equivalents
 *    - Handles architecture detection (Intel vs Apple Silicon)
 *    - Supports custom URL mappings for your specific tools/mods
 * 
 * 2. REGISTERING CUSTOM URL MAPPINGS:
 *    Use registerCustomURLMapping() to add your own URL conversion rules:
 * 
 *    ```typescript
 *    import { registerCustomURLMapping, validateURLMapping } from '../util/macOSGameCompatibility';
 * 
 *    // Example: Convert MyTool Windows downloads to macOS
 *    const myToolMapping = {
 *      description: 'MyTool for MyGame',
 *      windowsPattern: /https:\/\/github\.com\/myuser\/mytool\/releases\/.*windows.*\.zip/i,
 *      getMacOSUrl: (url: string) => {
 *        return url.replace(/windows/i, 'macos').replace(/\.zip$/, '.tar.gz');
 *      }
 *    };
 * 
 *    // Validate before registering (optional but recommended)
 *    const validation = validateURLMapping(myToolMapping, [
 *      'https://github.com/myuser/mytool/releases/download/v1.0/mytool-windows.zip'
 *    ]);
 * 
 *    if (validation.success) {
 *      registerCustomURLMapping(myToolMapping);
 *    } else {
 *      console.error('URL mapping validation failed:', validation.errors);
 *    }
 *    ```
 * 
 * 3. ARCHITECTURE DETECTION:
 *    Use getMacOSArchitecture() to detect the current macOS architecture:
 *    - Returns 'arm64' for Apple Silicon Macs
 *    - Returns 'x64' for Intel Macs
 * 
 * 4. GAME COMPATIBILITY FIXES:
 *    The layer includes built-in fixes for common games and tools,
 *    handling platform-specific paths and executable locations.
 * 
 * 5. BEST PRACTICES:
 *    - Always validate your URL mappings with test URLs
 *    - Handle both Intel and Apple Silicon architectures when relevant
 *    - Use descriptive names for your mappings
 *    - Test your extensions on both architectures if possible
 *    - Log important compatibility actions for debugging
 * 
 * For more examples, see the existing mappings in STATIC_DOWNLOAD_URL_MAPPINGS below.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { log } from './log';

// Cache for executable path results to avoid redundant file system checks
interface ExecutablePathCacheEntry {
  result: string | null;
  timestamp: number;
}

const executablePathCache = new Map<string, ExecutablePathCacheEntry>();
const CACHE_TTL_MS = 30000; // 30 seconds cache TTL

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
    macOSAppBundle: 'Cyberpunk2077.app',
    alternativeFiles: [
      'REDprelauncher.app', 
      'Cyberpunk 2077.app',
      'Cyberpunk2077.exe',  // Sometimes in root
      'bin/Cyberpunk2077.exe'  // Alternative location
    ]
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
  },
  // The Elder Scrolls V: Skyrim Special Edition
  {
    gameId: 'skyrimse',
    windowsExecutable: 'SkyrimSE.exe',
    macOSAppBundle: 'The Elder Scrolls V Skyrim Special Edition.app',
    alternativeFiles: ['SkyrimSE', 'Skyrim Special Edition.app']
  },
  // Fallout 4
  {
    gameId: 'fallout4',
    windowsExecutable: 'Fallout4.exe',
    macOSAppBundle: 'Fallout 4.app',
    alternativeFiles: ['Fallout4', 'Fallout4Launcher.exe']
  }
];

// Storage for custom URL mappings registered by community extensions
const customURLMappings: DownloadURLMapping[] = [];

/**
 * Get custom URL mappings registered by community extensions
 */
function getCustomURLMappings(): DownloadURLMapping[] {
  return [...customURLMappings];
}

/**
 * Get all URL mappings (both static and custom)
 */
function getAllURLMappings(): DownloadURLMapping[] {
  return [...customURLMappings, ...STATIC_DOWNLOAD_URL_MAPPINGS];
}

/**
 * Validate a URL mapping before registration
 * @param mapping The URL mapping to validate
 * @param testUrls Optional array of test URLs to validate against
 * @returns Validation result with success status and any errors
 */
export function validateURLMapping(mapping: DownloadURLMapping, testUrls?: string[]): {
  success: boolean;
  errors: string[];
  testResults?: Array<{ url: string; matches: boolean; convertedUrl?: string; error?: string }>;
} {
  const errors: string[] = [];
  const testResults: Array<{ url: string; matches: boolean; convertedUrl?: string; error?: string }> = [];

  try {
    // Basic validation
    if (!mapping.windowsPattern) {
      errors.push('windowsPattern is required');
    }
    if (!mapping.getMacOSUrl || typeof mapping.getMacOSUrl !== 'function') {
      errors.push('getMacOSUrl must be a function');
    }
    if (!mapping.description) {
      errors.push('description is required');
    }

    // Test with provided URLs if any
    if (testUrls && testUrls.length > 0 && mapping.windowsPattern && mapping.getMacOSUrl) {
      for (const testUrl of testUrls) {
        try {
          const matches = mapping.windowsPattern.test(testUrl);
          const result: any = { url: testUrl, matches };
          
          if (matches) {
            result.convertedUrl = mapping.getMacOSUrl(testUrl);
          }
          
          testResults.push(result);
        } catch (error) {
          testResults.push({
            url: testUrl,
            matches: false,
            error: error.message
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      testResults: testUrls ? testResults : undefined
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Validation failed: ${error.message}`]
    };
  }
}

/**
 * Register a custom URL mapping for community extensions
 * @param mapping The URL mapping to register
 * @param validate Whether to validate the mapping before registration (default: true)
 */
export function registerCustomURLMapping(mapping: DownloadURLMapping, validate: boolean = true): boolean {
  try {
    // Validate mapping if requested
    if (validate) {
      const validation = validateURLMapping(mapping);
      if (!validation.success) {
        log('error', 'URL mapping validation failed', {
          description: mapping.description,
          errors: validation.errors
        });
        return false;
      }
    }

    log('info', 'Registering custom URL mapping for community extension', {
      description: mapping.description,
      pattern: mapping.windowsPattern.toString()
    });
    
    // Check if mapping already exists
    const existingIndex = customURLMappings.findIndex(
      existing => existing.windowsPattern.toString() === mapping.windowsPattern.toString()
    );
    
    if (existingIndex >= 0) {
      log('warn', 'Overriding existing URL mapping', {
        description: mapping.description,
        previousDescription: customURLMappings[existingIndex].description
      });
      customURLMappings[existingIndex] = mapping;
    } else {
      customURLMappings.push(mapping);
    }
    
    return true;
  } catch (error) {
    log('error', 'Failed to register custom URL mapping', {
      error: error.message,
      description: mapping.description
    });
    return false;
  }
}

/**
 * Static download URL mappings for macOS compatibility
 */
const STATIC_DOWNLOAD_URL_MAPPINGS: DownloadURLMapping[] = [
  {
    // redscript for Cyberpunk 2077 - Windows to macOS URL mapping
    windowsPattern: /https:\/\/github\.com\/jac3km4\/redscript\/releases\/(?:download\/v[\d.]+([-\w]*)?\/|latest\/download\/)redscript-v[\d.]+([-\w]*)?-windows\.zip/,
    getMacOSUrl: (windowsUrl: string) => {
      // Extract version from Windows URL
      const versionMatch = windowsUrl.match(/redscript-v([\d.]+([-\w]*)?)-windows\.zip/);
      const version = versionMatch ? versionMatch[1] : 'latest';
      
      // Handle both versioned and latest URLs
      if (windowsUrl.includes('/latest/download/')) {
        return `https://github.com/jac3km4/redscript/releases/latest/download/redscript-v${version}-macos.zip`;
      } else {
        return `https://github.com/jac3km4/redscript/releases/download/v${version}/redscript-v${version}-macos.zip`;
      }
    },
    description: 'redscript for Cyberpunk 2077 - Windows to macOS conversion'
  },
  {
    // Lovely injector for Balatro - Windows to macOS URL mapping
    windowsPattern: /https:\/\/github\.com\/ethangreen-dev\/lovely-injector\/releases\/(?:download\/v[\d.]+([-\w]*)?\/|latest\/download\/)lovely-(?:windows\.zip|x86_64-pc-windows-msvc\.zip)/,
    getMacOSUrl: (windowsUrl: string) => {
      try {
        // Extract version from Windows URL (including beta versions)
        const versionMatch = windowsUrl.match(/\/v([\d.]+([-\w]*)?)\//); 
        const version = versionMatch ? versionMatch[1] : 'latest';
        
        // Detect architecture and select appropriate macOS binary
        const arch = getMacOSArchitecture();
        const macOSFileName = arch === 'arm64' ? 'lovely-aarch64-apple-darwin.tar.gz' : 'lovely-x86_64-apple-darwin.tar.gz';
        
        log('debug', 'Converting Lovely injector URL for macOS', {
          originalUrl: windowsUrl,
          version: version,
          architecture: arch,
          targetFileName: macOSFileName
        });
        
        // Handle both versioned and latest URLs
        if (windowsUrl.includes('/latest/download/')) {
          const macUrl = `https://github.com/ethangreen-dev/lovely-injector/releases/latest/download/${macOSFileName}`;
          log('debug', 'Generated latest download URL for Lovely injector', { macUrl });
          return macUrl;
        } else {
          const macUrl = `https://github.com/ethangreen-dev/lovely-injector/releases/download/v${version}/${macOSFileName}`;
          log('debug', 'Generated versioned download URL for Lovely injector', { macUrl });
          return macUrl;
        }
      } catch (error) {
        log('warn', 'Error converting Lovely injector URL, returning original', {
          url: windowsUrl,
          error: error.message
        });
        return windowsUrl;
      }
    },
    description: 'Lovely injector for Balatro - Windows to macOS conversion with architecture detection'
  },
  {
    // Steammodded for Balatro - Source code downloads are platform-independent
    windowsPattern: /https:\/\/github\.com\/[^\/]+\/[Ss]teamodded[^\/]*\/releases\/(?:download\/[^\/]+\/|latest\/download\/).*\.zip$/,
    getMacOSUrl: (windowsUrl: string) => {
      try {
        // Source code downloads are platform-independent, just return the same URL
        log('debug', 'Processing Steammodded URL for Balatro', { 
          originalUrl: windowsUrl,
          action: 'platform-independent-passthrough'
        });
        return windowsUrl;
      } catch (error) {
        log('warn', 'Error processing Steammodded URL, returning original', { 
          url: windowsUrl, 
          error: error.message 
        });
        return windowsUrl;
      }
    },
    description: 'Steammodded for Balatro - Source code downloads (platform independent)'
  },
  // Enhanced generic pattern for common Windows to macOS conversions
  {
    windowsPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+\/releases\/(?:download\/[^\/]+\/|latest\/download\/).*\.(exe|msi|zip|tar\.gz|7z)$/,
    getMacOSUrl: (windowsUrl: string) => {
      try {
        log('debug', 'Applying generic Windows to macOS URL conversion', {
          originalUrl: windowsUrl,
          architecture: getMacOSArchitecture()
        });

        // Enhanced conversion patterns for better community extension support
        let macUrl = windowsUrl
          // Handle executable extensions
          .replace(/\.(exe|msi)$/, '.app')
          // Handle platform identifiers
          .replace(/windows/gi, 'macos')
          .replace(/win32/gi, 'macos')
          .replace(/win64/gi, 'macos')
          .replace(/win/gi, 'mac')
          .replace(/pc/gi, 'mac')
          // Handle architecture-specific patterns
          .replace(/x86_64-pc-windows-msvc/g, `${getMacOSArchitecture()}-apple-darwin`)
          .replace(/x64-pc-windows-msvc/g, `${getMacOSArchitecture()}-apple-darwin`)
          .replace(/x86_64-windows/g, `${getMacOSArchitecture()}-macos`)
          .replace(/x64-windows/g, `${getMacOSArchitecture()}-macos`)
          // Handle common Windows-specific naming patterns
          .replace(/-windows-/g, '-macos-')
          .replace(/_windows_/g, '_macos_')
          .replace(/\.windows\./g, '.macos.')
          // Handle MSVC patterns
          .replace(/msvc/gi, 'darwin');

        // If no changes were made, try alternative patterns
        if (macUrl === windowsUrl) {
          // Look for version patterns and try to construct macOS equivalent
          const versionMatch = windowsUrl.match(/\/v?([\d.]+(?:[-\w]*)?)\//);
          if (versionMatch) {
            const version = versionMatch[1];
            const arch = getMacOSArchitecture();
            
            // Try common macOS naming patterns
            if (windowsUrl.includes('.zip')) {
              macUrl = windowsUrl.replace(/[^\/]*\.zip$/, `macos-${arch}.zip`);
            } else if (windowsUrl.includes('.tar.gz')) {
              macUrl = windowsUrl.replace(/[^\/]*\.tar\.gz$/, `${arch}-apple-darwin.tar.gz`);
            }
          }
        }

        log('debug', 'Generic URL conversion result', {
          originalUrl: windowsUrl,
          convertedUrl: macUrl,
          changed: macUrl !== windowsUrl
        });

        return macUrl;
      } catch (error) {
        log('warn', 'Error in generic Windows to macOS URL conversion, returning original', {
          url: windowsUrl,
          error: error.message
        });
        return windowsUrl;
      }
    },
    description: 'Enhanced generic Windows to macOS URL conversion with better community extension support'
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
 * Export the macOS game fixes array for use in other modules
 */
export { MACOS_GAME_FIXES };

/**
 * Get macOS compatibility fix for a game
 */
export function getMacOSGameFix(gameId: string): MacOSGameFix | undefined {
  return MACOS_GAME_FIXES.find(fix => fix.gameId === gameId);
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
 * Synchronous version of findMacOSAppBundle for use in StarterInfo constructor
 */
function findMacOSAppBundleSync(basePath: string, appBundleName: string): string | null {
  try {
    const fullPath = path.join(basePath, appBundleName);
    if (fs.existsSync(fullPath)) {
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
      try {
        if (fs.existsSync(variationPath)) {
          return variationPath;
        }
      } catch (err) {
        // Continue to next variation
      }
    }
    
    return null;
  } catch (err) {
    log('debug', 'Error finding macOS app bundle (sync)', { basePath, appBundleName, error: err.message });
    return null;
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
  
  if (!windowsExecutable) {
    return null;
  }

  // Create cache key from parameters
  const cacheKey = `${basePath}|${gameId}|${windowsExecutable}`;
  const now = Date.now();
  
  // Check cache first
  const cached = executablePathCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.result;
  }
  
  // Check if we have a specific fix for this game
  const fix = getMacOSGameFix(gameId);
  if (fix && windowsExecutable === fix.windowsExecutable) {
    // Try to find the macOS app bundle using synchronous calls
    const appBundlePath = findMacOSAppBundleSync(basePath, fix.macOSAppBundle);
    if (appBundlePath) {
      // Cache the result
      executablePathCache.set(cacheKey, {
        result: appBundlePath,
        timestamp: now
      });
      
      log('debug', 'Found macOS app bundle for game', { 
        gameId, 
        windowsExecutable, 
        macOSPath: appBundlePath 
      });
      return appBundlePath;
    }
    
    // Check alternative files if available
    if (fix.alternativeFiles) {
      for (const altFile of fix.alternativeFiles) {
        const altPath = path.join(basePath, altFile);
        try {
          if (fs.existsSync(altPath)) {
            // Cache the result
            executablePathCache.set(cacheKey, {
              result: altPath,
              timestamp: now
            });
            
            log('debug', 'Found alternative executable for game', { 
              gameId, 
              windowsExecutable, 
              alternativePath: altPath 
            });
            return altPath;
          }
        } catch (err) {
          // Continue to next alternative
        }
      }
    }
  }
  
  // Try the direct path first
  const directPath = path.join(basePath, windowsExecutable);
  try {
    if (fs.existsSync(directPath)) {
      // Cache the result
      executablePathCache.set(cacheKey, {
        result: directPath,
        timestamp: now
      });
      return directPath;
    }
  } catch (err) {
    // Continue with fallback logic
  }
  
  // Try common macOS patterns for .exe files
  if (windowsExecutable.endsWith('.exe')) {
    const baseName = path.basename(windowsExecutable, '.exe');
    const appBundleName = `${baseName}.app`;
    const appBundlePath = findMacOSAppBundleSync(basePath, appBundleName);
    if (appBundlePath) {
      // Cache the result
      executablePathCache.set(cacheKey, {
        result: appBundlePath,
        timestamp: now
      });
      
      log('debug', 'Found macOS app bundle using pattern matching', { 
        gameId, 
        windowsExecutable, 
        macOSPath: appBundlePath 
      });
      return appBundlePath;
    }
    
    // Try just the base name as an executable
    const baseNamePath = path.join(basePath, baseName);
    try {
      if (fs.existsSync(baseNamePath)) {
        // Cache the result
        executablePathCache.set(cacheKey, {
          result: baseNamePath,
          timestamp: now
        });
        
        log('debug', 'Found executable using base name', { 
          gameId, 
          windowsExecutable, 
          executablePath: baseNamePath 
        });
        return baseNamePath;
      }
    } catch (err) {
      // Continue
    }
  }
  
  // Return the original path as fallback
  const result = directPath;
  
  // Cache the result
  executablePathCache.set(cacheKey, {
    result,
    timestamp: now
  });
  
  log('debug', 'No macOS alternative found, using original path', { 
    gameId, 
    windowsExecutable, 
    fallbackPath: result 
  });
  return result;
}

/**
 * Detects the current macOS architecture (ARM64 or Intel x64)
 * @returns 'arm64' for Apple Silicon Macs, 'x64' for Intel Macs
 */
export function getMacOSArchitecture(): 'arm64' | 'x64' {
  try {
    const arch = os.arch();
    
    // Enhanced architecture detection with logging
    log('debug', 'Detecting macOS architecture', {
      osArch: arch,
      platform: os.platform(),
      release: os.release()
    });
    
    // Handle various architecture identifiers
    if (arch === 'arm64' || arch === 'aarch64') {
      log('debug', 'Detected Apple Silicon (ARM64) architecture');
      return 'arm64';
    } else if (arch === 'x64' || arch === 'x86_64' || arch === 'amd64') {
      log('debug', 'Detected Intel (x64) architecture');
      return 'x64';
    } else {
      // Fallback for unknown architectures
      log('warn', 'Unknown architecture detected, defaulting to x64', { arch });
      return 'x64';
    }
  } catch (error) {
    log('error', 'Error detecting macOS architecture, defaulting to x64', {
      error: error.message
    });
    return 'x64';
  }
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

  for (const mapping of getAllURLMappings()) {
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

/**
 * Enhanced Cyberpunk 2077 redscript support
 * Ported from the dedicated Cyberpunk 2077 extension
 */

/**
 * Helper function to check if a file exists using fs.statSync
 */
function fileExists(filePath: string): boolean {
  try {
    const fs = require('fs');
    fs.statSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Check if redscript is installed and available for Cyberpunk 2077
 */
function hasRedscript(gamePath: string): boolean {
  if (process.platform !== 'darwin') {
    return false; // Only support redscript on macOS for now
  }
  
  const path = require('path');
  const launchScriptPath = path.join(gamePath, 'launch_modded.sh');
  try {
    return fileExists(launchScriptPath);
  } catch (err) {
    console.log('Debug: Error checking for redscript installation', { error: err.message });
    return false;
  }
}

/**
 * Setup Steam executable renaming for redscript (Cyberpunk 2077)
 */
async function setupSteamRedscript(gamePath: string): Promise<boolean> {
  try {
    const path = require('path');
    const fs = require('fs').promises;
    
    const appBundlePath = path.join(gamePath, 'Cyberpunk2077.app');
    const executablePath = path.join(appBundlePath, 'Contents/MacOS/Cyberpunk2077');
    const realExecutablePath = path.join(appBundlePath, 'Contents/MacOS/Cyberpunk2077_real');
    const launchScriptPath = path.join(gamePath, 'launch_modded.sh');
    const newExecutablePath = path.join(gamePath, 'Cyberpunk2077');

    // Check if already set up
    if (fileExists(realExecutablePath) && fileExists(newExecutablePath)) {
      console.log('Info: Steam redscript setup already exists');
      return true;
    }

    // Step 1: Rename original executable
    if (fileExists(executablePath) && !fileExists(realExecutablePath)) {
      await fs.rename(executablePath, realExecutablePath);
      console.log('Info: Renamed original Cyberpunk2077 executable to Cyberpunk2077_real');
    }

    // Step 2: Read and modify launch script
    if (fileExists(launchScriptPath)) {
      let scriptContent = await fs.readFile(launchScriptPath, 'utf8');
      
      // Replace the executable path in the script
      scriptContent = scriptContent.replace(
        /"\$game_dir\/Cyberpunk2077\.app\/Contents\/MacOS\/Cyberpunk2077"/g,
        '"$game_dir/Cyberpunk2077.app/Contents/MacOS/Cyberpunk2077_real"'
      );
      
      // Step 3: Copy modified script as new executable
      await fs.writeFile(newExecutablePath, scriptContent);
      
      // Step 4: Make it executable
      await fs.chmod(newExecutablePath, 0o755);
      
      console.log('Info: Successfully set up Steam redscript integration');
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('Error: Failed to setup Steam redscript integration', { error: err.message });
    return false;
  }
}

/**
 * Get the appropriate executable path for Cyberpunk 2077 based on redscript availability and platform
 */
/**
 * Generic game process manager for safe profile switching
 */
export class GameProcessManager {
  private gameProcesses: Set<string> = new Set();
  private profileSwitchQueue: Array<() => void> = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private gameExecutableNames: string[];
  private api: any;

  constructor(api: any, gameExecutableNames: string[]) {
    this.api = api;
    this.gameExecutableNames = gameExecutableNames;
  }

  /**
   * Check if the game is currently running
   */
  async isGameRunning(): Promise<boolean> {
    try {
      const processes = await this.getRunningProcesses();
      return processes.some(proc => 
        this.gameExecutableNames.some(gameName => 
          proc.toLowerCase().includes(gameName.toLowerCase())
        )
      );
    } catch (error) {
      console.warn('Failed to check game processes', error);
      return false;
    }
  }

  /**
   * Get list of running processes based on platform
   */
  private getRunningProcesses(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      let command: string;
      let args: string[];
      
      if (process.platform === 'win32') {
        command = 'tasklist';
        args = ['/fo', 'csv', '/nh'];
      } else if (process.platform === 'darwin') {
        command = 'ps';
        args = ['-eo', 'comm'];
      } else {
        command = 'ps';
        args = ['-eo', 'comm'];
      }

      const proc = spawn(command, args);
      let output = '';

      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('close', (code: number) => {
        if (code === 0) {
          const processes = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          resolve(processes);
        } else {
          reject(new Error(`Process listing failed with code ${code}`));
        }
      });

      proc.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Start monitoring game processes
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.updateGameState();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop monitoring game processes
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Update game state and process queued profile switches
   */
  private async updateGameState(): Promise<void> {
    const isRunning = await this.isGameRunning();
    
    if (!isRunning && this.profileSwitchQueue.length > 0) {
      // Process queued profile switches when game is not running
      const queuedSwitch = this.profileSwitchQueue.shift();
      if (queuedSwitch) {
        queuedSwitch();
      }
    }
  }

  /**
   * Queue a profile switch to execute when the game is not running
   */
  queueProfileSwitch(switchFunction: () => void): void {
    this.profileSwitchQueue.push(switchFunction);
  }

  /**
   * Check if there are queued profile switches
   */
  hasQueuedSwitches(): boolean {
    return this.profileSwitchQueue.length > 0;
  }

  /**
   * Clear all queued profile switches
   */
  clearQueue(): void {
    this.profileSwitchQueue = [];
  }
}

export function getCyberpunkRedscriptAwareExecutable(discoveredPath: string): string {
  if (process.platform !== 'darwin') {
    // Windows/Linux logic remains unchanged
    if (!discoveredPath || typeof discoveredPath !== 'string' || discoveredPath.trim() === '') {
      return 'bin/x64/Cyberpunk2077.exe';
    }

    const path = require('path');
    const fs = require('fs');
    const possibleExecutables = [
      'bin/x64/Cyberpunk2077.exe',
      'Cyberpunk2077.exe',
      'bin/Cyberpunk2077.exe',
    ];

    for (const exe of possibleExecutables) {
      const fullPath = path.join(discoveredPath, exe);
      try {
        if (fs.statSync(fullPath).isFile()) {
          return exe;
        }
      } catch (err) {
        // Continue to next possibility
      }
    }
    
    return 'bin/x64/Cyberpunk2077.exe';
  }

  // macOS logic with redscript support
  if (hasRedscript(discoveredPath)) {
    console.log('Info: Redscript detected, checking launch method');
    
    // Check if this is a Steam installation
    if (discoveredPath && discoveredPath.includes('steamapps')) {
      // For Steam, try to set up the executable renaming
      setupSteamRedscript(discoveredPath).then(success => {
        if (success) {
          console.log('Info: Steam redscript setup completed');
        } else {
          console.log('Warn: Steam redscript setup failed, falling back to manual launch');
        }
      }).catch(err => {
        console.error('Error: Error during Steam redscript setup', { error: err.message });
      });
      
      // Return the renamed executable path for Steam
      return 'Cyberpunk2077';
    } else {
      // For GOG/App Store, we'll handle this differently
      console.log('Info: Non-Steam installation detected with redscript');
      return 'Cyberpunk2077';
    }
  }
  
  // Default macOS executable logic (no redscript)
  if (discoveredPath && discoveredPath.includes('steamapps')) {
    return 'Cyberpunk2077.app/Contents/MacOS/Cyberpunk2077';
  }
  return 'Cyberpunk2077';
}

// ===== CYBERPUNK 2077 MACOS COMPATIBILITY VALIDATION =====

// List of Windows-only frameworks that are incompatible with macOS redmac
const INCOMPATIBLE_FRAMEWORKS = [
  'RED4ext',
  'CET',
  'TweakXL',
  'ArchiveXL',
  'Codeware',
  'RED4Script',
];

// List of Windows-only file extensions that are incompatible
const INCOMPATIBLE_EXTENSIONS = [
  '.dll',
  '.asi',
  '.lua',
];

// List of Windows-only directories that are incompatible
const INCOMPATIBLE_DIRECTORIES = [
  'bin',
  'engine',
  'plugins',
  'red4ext',
  'cet',
];

/**
 * Interface for compatibility validation results
 */
export interface CompatibilityValidationResult {
  isCompatible: boolean;
  incompatibleItems: string[];
  errorMessage?: string;
}

/**
 * Validates if a Cyberpunk 2077 mod is compatible with macOS
 * @param modPath - Path to the mod directory or archive
 * @param modFiles - Array of file paths within the mod
 * @returns Promise<CompatibilityValidationResult> - Validation result with compatibility status and details
 */
export async function validateCyberpunkMacOSCompatibility(
  modPath: string,
  modFiles: string[]
): Promise<CompatibilityValidationResult> {
  const incompatibleItems: string[] = [];

  try {
    // Check for incompatible file extensions
    for (const file of modFiles) {
      const extension = path.extname(file).toLowerCase();
      if (INCOMPATIBLE_EXTENSIONS.includes(extension)) {
        incompatibleItems.push(`File: ${file} (${extension} files are Windows-only)`);
      }
    }

    // Check for incompatible directories
    for (const file of modFiles) {
      const pathParts = file.split('/').filter(part => part.length > 0);
      for (const part of pathParts) {
        if (INCOMPATIBLE_DIRECTORIES.includes(part.toLowerCase())) {
          incompatibleItems.push(`Directory: ${part}/ (Windows-only directory)`);
          break; // Only report once per file
        }
      }
    }

    // Check for incompatible frameworks in file names and paths
    for (const file of modFiles) {
      const fileName = path.basename(file).toLowerCase();
      const filePath = file.toLowerCase();
      
      for (const framework of INCOMPATIBLE_FRAMEWORKS) {
        const frameworkLower = framework.toLowerCase();
        if (fileName.includes(frameworkLower) || filePath.includes(frameworkLower)) {
          incompatibleItems.push(`Framework: ${framework} (Windows-only framework detected in ${file})`);
        }
      }
    }

    // Remove duplicates
    const uniqueIncompatibleItems = [...new Set(incompatibleItems)];

    if (uniqueIncompatibleItems.length > 0) {
      const errorMessage = createMacOSCompatibilityErrorMessage(uniqueIncompatibleItems);
      return {
        isCompatible: false,
        incompatibleItems: uniqueIncompatibleItems,
        errorMessage
      };
    }

    return {
      isCompatible: true,
      incompatibleItems: []
    };

  } catch (error) {
    console.error('Error during macOS compatibility validation:', error);
    return {
      isCompatible: false,
      incompatibleItems: ['Validation error occurred'],
      errorMessage: 'Unable to validate mod compatibility. Please check the mod manually.'
    };
  }
}

/**
 * Creates a user-friendly error message for incompatible mods
 * @param incompatibleItems - Array of incompatible items found
 * @returns string - Formatted error message
 */
export function createMacOSCompatibilityErrorMessage(incompatibleItems: string[]): string {
  const message = [
    '🚫 This Cyberpunk 2077 mod is not compatible with macOS',
    '',
    'This mod contains Windows-only components that cannot run on macOS:',
    '',
    ...incompatibleItems.map(item => `• ${item}`),
    '',
    '💡 For macOS Cyberpunk 2077 modding:',
    '• Use mods that support redscript (.reds files)',
    '• Look for mods with .archive files only',
    '• Avoid mods requiring RED4ext, CET, or other Windows frameworks',
    '',
    '🔍 Try searching for "macOS compatible" or "redscript only" versions of this mod.'
  ];

  return message.join('\n');
}

/**
 * Quick check if a mod contains any Windows-only file extensions
 * @param modFiles - Array of file paths within the mod
 * @returns boolean - True if Windows-only files are detected
 */
export function hasWindowsOnlyFiles(modFiles: string[]): boolean {
  return modFiles.some(file => {
    const extension = path.extname(file).toLowerCase();
    return INCOMPATIBLE_EXTENSIONS.includes(extension);
  });
}

/**
 * Quick check if a mod contains any Windows-only directories
 * @param modFiles - Array of file paths within the mod
 * @returns boolean - True if Windows-only directories are detected
 */
export function hasWindowsOnlyDirectories(modFiles: string[]): boolean {
  return modFiles.some(file => {
    const pathParts = file.split('/').filter(part => part.length > 0);
    return pathParts.some(part => INCOMPATIBLE_DIRECTORIES.includes(part.toLowerCase()));
  });
}

/**
 * Quick check if a mod contains any Windows-only frameworks
 * @param modFiles - Array of file paths within the mod
 * @returns boolean - True if Windows-only frameworks are detected
 */
export function hasWindowsOnlyFrameworks(modFiles: string[]): boolean {
  return modFiles.some(file => {
    const fileName = path.basename(file).toLowerCase();
    const filePath = file.toLowerCase();
    
    return INCOMPATIBLE_FRAMEWORKS.some(framework => {
      const frameworkLower = framework.toLowerCase();
      return fileName.includes(frameworkLower) || filePath.includes(frameworkLower);
    });
  });
}