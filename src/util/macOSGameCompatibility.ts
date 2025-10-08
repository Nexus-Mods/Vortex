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
import * as child_process from 'child_process';
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
  // Balatro - Enhanced with comprehensive mod support detection
  {
    gameId: 'balatro',
    windowsExecutable: 'Balatro.exe',
    macOSAppBundle: 'Balatro.app',
    alternativeFiles: [
      // Lovely injector files
      'liblovely.dylib',
      'run_lovely_macos.sh',
      'lovely',
      'lovely.exe',
      // SteamModded files
      'steammodded.lua',
      'steammodded',
      // Alternative app bundle names
      'balatro.app',
      'BALATRO.app',
      // Steam/platform specific
      'Balatro.x86_64',
      'Balatro.app/Contents/MacOS/Balatro'
    ]
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
  },
  // Valheim
  {
    gameId: 'valheim',
    windowsExecutable: 'valheim.exe',
    macOSAppBundle: 'Valheim.app',
    alternativeFiles: ['valheim', 'valheim.x86_64']
  },
  // Among Us
  {
    gameId: 'amongus',
    windowsExecutable: 'Among Us.exe',
    macOSAppBundle: 'Among Us.app',
    alternativeFiles: ['Among Us']
  },
  // Hollow Knight
  {
    gameId: 'hollowknight',
    windowsExecutable: 'hollow_knight.exe',
    macOSAppBundle: 'Hollow Knight.app',
    alternativeFiles: ['hollow_knight']
  },
  // Celeste
  {
    gameId: 'celeste',
    windowsExecutable: 'Celeste.exe',
    macOSAppBundle: 'Celeste.app',
    alternativeFiles: ['Celeste']
  },
  // Hades II
  {
    gameId: 'hades2',
    windowsExecutable: 'Hades2.exe',
    macOSAppBundle: 'Hades II.app',
    alternativeFiles: ['Hades2', 'Hades2.x86_64']
  },
  // Disco Elysium
  {
    gameId: 'discoelysium',
    windowsExecutable: 'Disco Elysium.exe',
    macOSAppBundle: 'Disco Elysium.app',
    alternativeFiles: ['Disco Elysium']
  },
  // Outer Wilds
  {
    gameId: 'outerwilds',
    windowsExecutable: 'Outer Wilds.exe',
    macOSAppBundle: 'Outer Wilds.app',
    alternativeFiles: ['OuterWilds']
  },
  // Return of the Obra Dinn
  {
    gameId: 'returnoftheobradinn',
    windowsExecutable: 'Obra Dinn.exe',
    macOSAppBundle: 'Return of the Obra Dinn.app',
    alternativeFiles: ['obra_dinn']
  },
  // Papers, Please
  {
    gameId: 'papersplease',
    windowsExecutable: 'PapersPlease.exe',
    macOSAppBundle: 'PapersPlease.app',
    alternativeFiles: ['PapersPlease']
  },
  // Into the Breach
  {
    gameId: 'intothebreach',
    windowsExecutable: 'ITB.exe',
    macOSAppBundle: 'Into the Breach.app',
    alternativeFiles: ['ITB']
  },
  // FTL: Faster Than Light
  {
    gameId: 'ftl',
    windowsExecutable: 'FTL.exe',
    macOSAppBundle: 'FTL.app',
    alternativeFiles: ['FTL']
  },
  // Don't Starve
  {
    gameId: 'dontstarve',
    windowsExecutable: 'dontstarve.exe',
    macOSAppBundle: "Don't Starve.app",
    alternativeFiles: ['dontstarve']
  },
  // Don't Starve Together
  {
    gameId: 'dontstarvetogether',
    windowsExecutable: 'dontstarve_steam.exe',
    macOSAppBundle: "Don't Starve Together.app",
    alternativeFiles: ['dontstarve_steam']
  },
  // The Stanley Parable
  {
    gameId: 'thestanleyparable',
    windowsExecutable: 'The Stanley Parable.exe',
    macOSAppBundle: 'The Stanley Parable.app',
    alternativeFiles: ['The Stanley Parable']
  },
  // The Binding of Isaac: Rebirth
  {
    gameId: 'bindingofisaacrebirth',
    windowsExecutable: 'isaac-ng.exe',
    macOSAppBundle: 'The Binding of Isaac.app',
    alternativeFiles: ['isaac-ng']
  },
  // Stardew Valley (GOG version)
  {
    gameId: 'stardewvalleygog',
    windowsExecutable: 'Stardew Valley.exe',
    macOSAppBundle: 'StardewValley.app',
    alternativeFiles: ['Stardew Valley']
  },
  // Terraria (GOG version)
  {
    gameId: 'terrariagog',
    windowsExecutable: 'Terraria.exe',
    macOSAppBundle: 'Terraria.app',
    alternativeFiles: ['Terraria']
  },
  // Risk of Rain 2
  {
    gameId: 'riskofrain2',
    windowsExecutable: 'Risk of Rain 2.exe',
    macOSAppBundle: 'Risk of Rain 2.app',
    alternativeFiles: ['Risk of Rain 2']
  },
  // Dead Cells
  {
    gameId: 'deadcells',
    windowsExecutable: 'deadcells.exe',
    macOSAppBundle: 'Dead Cells.app',
    alternativeFiles: ['deadcells']
  },
  // Katana ZERO
  {
    gameId: 'katanazero',
    windowsExecutable: 'Katana ZERO.exe',
    macOSAppBundle: 'Katana ZERO.app',
    alternativeFiles: ['Katana ZERO']
  },
  // A Hat in Time
  {
    gameId: 'ahatintime',
    windowsExecutable: 'HatinTimeGame.exe',
    macOSAppBundle: 'A Hat in Time.app',
    alternativeFiles: ['HatinTimeGame']
  },
  // Owlboy
  {
    gameId: 'owlboy',
    windowsExecutable: 'Owlboy.exe',
    macOSAppBundle: 'Owlboy.app',
    alternativeFiles: ['Owlboy']
  },
  // A Short Hike
  {
    gameId: 'ashorthike',
    windowsExecutable: 'AShortHike.exe',
    macOSAppBundle: 'A Short Hike.app',
    alternativeFiles: ['AShortHike']
  },
  // Sid Meier's Civilization VI
  {
    gameId: 'sidmeierscivilizationvi',
    windowsExecutable: 'CivilizationVI.exe',
    macOSAppBundle: 'Civilization VI.app',
    alternativeFiles: ['CivilizationVI', 'CivilizationVI.app/Contents/MacOS/CivilizationVI']
  },
  // Sid Meier's Civilization VII
  {
    gameId: 'sidmeierscivilizationvii',
    windowsExecutable: 'CivilizationVII.exe',
    macOSAppBundle: 'Civilization VII.app',
    alternativeFiles: ['CivilizationVII', 'CivilizationVII.app/Contents/MacOS/CivilizationVII']
  },
  // Europa Universalis IV
  {
    gameId: 'europauniversalisiv',
    windowsExecutable: 'eu4.exe',
    macOSAppBundle: 'Europa Universalis IV.app',
    alternativeFiles: ['eu4', 'eu4.app/Contents/MacOS/eu4']
  },
  // Crusader Kings III
  {
    gameId: 'crusaderkingsiii',
    windowsExecutable: 'CK3.exe',
    macOSAppBundle: 'Crusader Kings III.app',
    alternativeFiles: ['CK3', 'CK3.app/Contents/MacOS/CK3']
  },
  // Stellaris
  {
    gameId: 'stellaris',
    windowsExecutable: 'stellaris.exe',
    macOSAppBundle: 'Stellaris.app',
    alternativeFiles: ['stellaris', 'stellaris.app/Contents/MacOS/stellaris']
  },
  // Hearts of Iron IV
  {
    gameId: 'heartsofironiv',
    windowsExecutable: 'hoi4.exe',
    macOSAppBundle: 'Hearts of Iron IV.app',
    alternativeFiles: ['hoi4', 'hoi4.app/Contents/MacOS/hoi4']
  },
  // Total War: WARHAMMER III
  {
    gameId: 'totalwarwarhammer3',
    windowsExecutable: 'Warhammer3.exe',
    macOSAppBundle: 'Total War WARHAMMER III.app',
    alternativeFiles: ['Warhammer3', 'Warhammer3.app/Contents/MacOS/Warhammer3']
  },
  // Age of Empires II: Definitive Edition
  {
    gameId: 'ageofempires2definitiveedition',
    windowsExecutable: 'AoE2DE_s.exe',
    macOSAppBundle: 'Age of Empires II Definitive Edition.app',
    alternativeFiles: ['AoE2DE', 'AoE2DE.app/Contents/MacOS/AoE2DE']
  },
  // Age of Empires IV
  {
    gameId: 'ageofempires4',
    windowsExecutable: 'AoE4.exe',
    macOSAppBundle: 'Age of Empires IV.app',
    alternativeFiles: ['AoE4', 'AoE4.app/Contents/MacOS/AoE4']
  },
  // Company of Heroes 2
  {
    gameId: 'companyofheroes2',
    windowsExecutable: 'RelicCoH2.exe',
    macOSAppBundle: 'Company of Heroes 2.app',
    alternativeFiles: ['RelicCoH2', 'RelicCoH2.app/Contents/MacOS/RelicCoH2']
  },
  // War Thunder
  {
    gameId: 'warthunder',
    windowsExecutable: 'win64.exe',
    macOSAppBundle: 'War Thunder.app',
    alternativeFiles: ['win64', 'win64.app/Contents/MacOS/win64']
  },
  // World of Warships
  {
    gameId: 'worldofwarships',
    windowsExecutable: 'WorldOfWarships.exe',
    macOSAppBundle: 'World of Warships.app',
    alternativeFiles: ['WorldOfWarships', 'WorldOfWarships.app/Contents/MacOS/WorldOfWarships']
  },
  // World of Tanks
  {
    gameId: 'worldoftanks',
    windowsExecutable: 'WorldOfTanks.exe',
    macOSAppBundle: 'World of Tanks.app',
    alternativeFiles: ['WorldOfTanks', 'WorldOfTanks.app/Contents/MacOS/WorldOfTanks']
  },
  // The Sims 4
  {
    gameId: 'thesims4',
    windowsExecutable: 'TS4.exe',
    macOSAppBundle: 'The Sims 4.app',
    alternativeFiles: ['TS4', 'TS4.app/Contents/MacOS/TS4']
  },
  // Cities: Skylines II
  {
    gameId: 'citiesskylinesii',
    windowsExecutable: 'Cities2.exe',
    macOSAppBundle: 'Cities Skylines II.app',
    alternativeFiles: ['Cities2', 'Cities2.app/Contents/MacOS/Cities2']
  },
  // Palworld
  {
    gameId: 'palworld',
    windowsExecutable: 'Palworld.exe',
    macOSAppBundle: 'Palworld.app',
    alternativeFiles: ['Palworld', 'Palworld.app/Contents/MacOS/Palworld']
  },
  // Hogwarts Legacy
  {
    gameId: 'hogwartslegacy',
    windowsExecutable: 'HogwartsLegacy.exe',
    macOSAppBundle: 'Hogwarts Legacy.app',
    alternativeFiles: ['HogwartsLegacy', 'HogwartsLegacy.app/Contents/MacOS/HogwartsLegacy']
  },
  // Elden Ring
  {
    gameId: 'eldenring',
    windowsExecutable: 'eldenring.exe',
    macOSAppBundle: 'Elden Ring.app',
    alternativeFiles: ['eldenring', 'eldenring.app/Contents/MacOS/eldenring']
  },
  // God of War
  {
    gameId: 'godoFWar',
    windowsExecutable: 'GoW.exe',
    macOSAppBundle: 'God of War.app',
    alternativeFiles: ['GoW', 'GoW.app/Contents/MacOS/GoW']
  },
  // Horizon Zero Dawn
  {
    gameId: 'horizonzerodawn',
    windowsExecutable: 'HorizonZeroDawn.exe',
    macOSAppBundle: 'Horizon Zero Dawn.app',
    alternativeFiles: ['HorizonZeroDawn', 'HorizonZeroDawn.app/Contents/MacOS/HorizonZeroDawn']
  },
  // Ghost of Tsushima
  {
    gameId: 'ghostoftsushima',
    windowsExecutable: 'GhostOfTsushima.exe',
    macOSAppBundle: 'Ghost of Tsushima.app',
    alternativeFiles: ['GhostOfTsushima', 'GhostOfTsushima.app/Contents/MacOS/GhostOfTsushima']
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
    // Lovely injector for Balatro - Enhanced Windows to macOS URL mapping
    // Matches patterns used by Balatro extension: lovely-x86_64-pc-windows-msvc.zip, lovely-windows.zip
    windowsPattern: /https:\/\/github\.com\/ethangreen-dev\/lovely-injector\/releases\/(?:download\/v[\d.]+([-\w]*)?\/|latest\/download\/)lovely-(?:x86_64-pc-windows-msvc\.zip|windows\.zip|win.*\.zip)/i,
    getMacOSUrl: (windowsUrl: string) => {
      try {
        // Extract version from Windows URL (including beta versions)
        const versionMatch = windowsUrl.match(/\/v([\d.]+([-\w]*)?)\//); 
        const version = versionMatch ? versionMatch[1] : 'latest';
        
        // Detect architecture and select appropriate macOS binary
        const arch = getMacOSArchitecture();
        const macOSFileName = arch === 'arm64' ? 'lovely-aarch64-apple-darwin.tar.gz' : 'lovely-x86_64-apple-darwin.tar.gz';
        
        log('info', 'Converting Lovely injector URL for Balatro macOS compatibility', {
          originalUrl: windowsUrl,
          version: version,
          architecture: arch,
          targetFileName: macOSFileName,
          extensionContext: 'Balatro'
        });
        
        // Handle both versioned and latest URLs
        if (windowsUrl.includes('/latest/download/')) {
          const macUrl = `https://github.com/ethangreen-dev/lovely-injector/releases/latest/download/${macOSFileName}`;
          log('info', 'Generated latest download URL for Lovely injector (Balatro)', { 
            macUrl,
            architecture: arch,
            originalUrl: windowsUrl
          });
          return macUrl;
        } else {
          const macUrl = `https://github.com/ethangreen-dev/lovely-injector/releases/download/v${version}/${macOSFileName}`;
          log('info', 'Generated versioned download URL for Lovely injector (Balatro)', { 
            macUrl,
            version,
            architecture: arch,
            originalUrl: windowsUrl
          });
          return macUrl;
        }
      } catch (error) {
        log('error', 'Error converting Lovely injector URL for Balatro, returning original', {
          url: windowsUrl,
          error: error.message,
          stack: error.stack
        });
        return windowsUrl;
      }
    },
    description: 'Lovely injector for Balatro - Enhanced Windows to macOS conversion with architecture detection and Balatro-specific patterns'
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
  },
  // Unity Mod Manager
  {
    windowsPattern: /https:\/\/github\.com\/newman55\/unity-mod-manager\/releases\/download\/v[\d.]+\/UnityModManager\.zip/,  
    getMacOSUrl: (windowsUrl: string) => {
      // Unity Mod Manager is platform-independent
      return windowsUrl;
    },
    description: 'Unity Mod Manager download URLs (platform independent)'
  },
  // MelonLoader
  {
    windowsPattern: /https:\/\/github\.com\/LavaGang\/MelonLoader\/releases\/download\/v[\d.]+\/MelonLoader\.(?:x86_64|arm64)\.zip/,  
    getMacOSUrl: (windowsUrl: string) => {
      // MelonLoader has macOS versions
      return windowsUrl.replace(/MelonLoader\.(x86_64|arm64)\.zip/, 'MelonLoader.$1.zip');
    },
    description: 'MelonLoader download URLs for macOS'
  },
  // BepInEx
  {
    windowsPattern: /https:\/\/github\.com\/BepInEx\/BepInEx\/releases\/download\/v[\d.]+\/BepInEx_(?:x64|arm64)_[\d.]+\.zip/,  
    getMacOSUrl: (windowsUrl: string) => {
      // BepInEx has macOS versions
      return windowsUrl.replace(/BepInEx_(x64|arm64)_([\d.]+)\.zip/, 'BepInEx_$1_$2.zip');
    },
    description: 'BepInEx download URLs for macOS'
  },
  // xEdit (TES5Edit, FO4Edit, etc.)
  {
    windowsPattern: /https:\/\/github\.com\/TES5Edit\/TES5Edit\/releases\/download\/v[\d.]+\/TES5Edit\.exe/,  
    getMacOSUrl: (windowsUrl: string) => {
      // xEdit is Windows-only, no macOS equivalent
      return windowsUrl;
    },
    description: 'xEdit download URLs (Windows-only tool)'
  },
  // Mod Organizer 2
  {
    windowsPattern: /https:\/\/github\.com\/ModOrganizer2\/modorganizer\/releases\/download\/v[\d.]+\/Mod.Organizer-[^-]+-installer\.exe/,  
    getMacOSUrl: (windowsUrl: string) => {
      // Mod Organizer 2 is Windows-only, no macOS equivalent
      return windowsUrl;
    },
    description: 'Mod Organizer 2 download URLs (Windows-only tool)'
  },
  // Reshade
  {
    windowsPattern: /https:\/\/github\.com\/crosire\/reshade\/releases\/download\/v[\d.]+\/ReShade_Setup_[\d.]+\.exe/,  
    getMacOSUrl: (windowsUrl: string) => {
      // Reshade is Windows-only, no macOS equivalent
      return windowsUrl;
    },
    description: 'Reshade download URLs (Windows-only tool)'
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
      const error = err as Error;
      log('debug', 'Error checking file existence', { basePath, fileName, gameId, error: error.message });
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
      const error = err as Error;
      log('debug', 'Error finding macOS app bundle (sync)', { basePath, appBundleName, error: error.message });
    return null;
  }
}

/**
 * Get the appropriate executable path for the current platform
 * Enhanced with integration to the path normalization system
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
  
  // Try to use the enhanced path normalization system first
  try {
    const pathNormalization = require('./macOSPathNormalization');
    if (pathNormalization && typeof pathNormalization.normalizePathForCompatibility === 'function') {
      const normalizedPath = pathNormalization.normalizePathForCompatibility(
        path.join(basePath, windowsExecutable), 
        { gameId, targetPlatform: 'darwin' }
      );
      
      // Check if the normalized path exists
      if (fs.existsSync(normalizedPath)) {
        // Cache the result
        executablePathCache.set(cacheKey, {
          result: normalizedPath,
          timestamp: now
        });
        
        log('debug', 'Found executable using enhanced path normalization', { 
          gameId, 
          windowsExecutable, 
          normalizedPath 
        });
        return normalizedPath;
      }
    }
  } catch (err) {
    log('debug', 'Could not use enhanced path normalization for executable, falling back to basic implementation', { 
      error: err.message,
      basePath,
      windowsExecutable,
      gameId
    });
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
      // Additional check for M4 Pro and other Apple Silicon Macs
      // that might report x64 due to Rosetta or x64 Node.js
      try {
        // Use system command to check actual hardware architecture
        // Try sysctl first as it's more reliable than arch command
        let result = child_process.spawnSync('sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8' });
        if (result.stdout && result.stdout.trim() === '1') {
          log('debug', 'System reports ARM64 hardware via sysctl, overriding process architecture');
          return 'arm64';
        }
        
        // Fallback to arch command
        result = child_process.spawnSync('arch', [], { encoding: 'utf8' });
        if (result.stdout && result.stdout.trim() === 'arm64') {
          log('debug', 'System reports ARM64, overriding process architecture');
          return 'arm64';
        }
        
        // Additional check using system_profiler for Apple Silicon detection
        result = child_process.spawnSync('system_profiler', ['SPHardwareDataType'], { encoding: 'utf8' });
        if (result.stdout && (result.stdout.includes('Apple M') || result.stdout.includes('Apple Silicon'))) {
          log('debug', 'System reports Apple Silicon via system_profiler, overriding process architecture');
          return 'arm64';
        }
      } catch (sysError) {
        log('debug', 'Could not determine system architecture via command', { 
          error: sysError.message 
        });
      }
      
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
    architecture: getMacOSArchitecture() // Use enhanced detection
  });

  if (os.platform() !== 'darwin') {
    log('debug', 'Not on macOS, returning original URL', { url });
    return url;
  }

  // Ensure all URLs pass through interception, not just pattern-matched ones
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
        architecture: getMacOSArchitecture() // Enhanced detection
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
      const error = err as Error;
      log('debug', 'Error finding macOS app bundle', { basePath, appBundleName, error: error.message });
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
      const error = err as Error;
      log('debug', 'Error getting executable from app bundle', { appBundlePath, error: error.message });
    return null;
  }
}

/**
 * Normalize a game path for macOS
 * This handles cases where the game might be in different locations
 * Enhanced with integration to the path normalization system
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
  
  // Try to use the enhanced path normalization system first
  try {
    const pathNormalization = require('./macOSPathNormalization');
    if (pathNormalization && typeof pathNormalization.normalizePathForCompatibility === 'function') {
      // Normalize the base path using the enhanced system
      const normalizedBasePath = pathNormalization.normalizePathForCompatibility(basePath, { 
        gameId,
        targetPlatform: 'darwin'
      });
      
      // If we have an expected executable, normalize that too
      if (expectedExecutable) {
        const normalizedExecutable = pathNormalization.normalizePathForCompatibility(
          path.join(basePath, expectedExecutable), 
          { gameId, targetPlatform: 'darwin' }
        );
        
        // Check if the normalized executable path exists
        if (await fs.pathExists(normalizedExecutable)) {
          return normalizedExecutable;
        }
        
        // If not, try to extract just the executable name and join with normalized base path
        const executableName = path.basename(normalizedExecutable);
        const joinedPath = path.join(normalizedBasePath, executableName);
        if (await fs.pathExists(joinedPath)) {
          return joinedPath;
        }
      }
      
      // If we only have a base path, return the normalized version
      if (await fs.pathExists(normalizedBasePath)) {
        return normalizedBasePath;
      }
    }
  } catch (err) {
    log('debug', 'Could not use enhanced path normalization, falling back to basic implementation', { 
      error: err.message,
      basePath,
      gameId
    });
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
      const error = err as Error;
      console.log('Debug: Error checking for redscript installation', { error: error.message });
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
      const error = err as Error;
      console.error('Error: Failed to setup Steam redscript integration', { error: error.message });
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
        const error = err as Error;
        console.error('Error: Error during Steam redscript setup', { error: error.message });
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
    const uniqueIncompatibleItems = Array.from(new Set(incompatibleItems));

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

/**
 * Balatro-specific helper functions for enhanced macOS compatibility
 */

/**
 * Detect if Lovely injector is properly installed for Balatro on macOS
 * @param gamePath - Path to the Balatro game installation
 * @returns Promise<boolean> - True if Lovely injector is detected
 */
export async function detectLovelyInjectorForBalatro(gamePath: string): Promise<boolean> {
  try {
    const lovelyFiles = [
      'liblovely.dylib',
      'run_lovely_macos.sh',
      'lovely',
      'lovely.exe'
    ];
    
    log('debug', 'Checking for Lovely injector in Balatro installation', {
      gamePath,
      checkingFiles: lovelyFiles
    });
    
    for (const file of lovelyFiles) {
      const filePath = path.join(gamePath, file);
      if (await fs.pathExists(filePath)) {
        log('info', 'Lovely injector detected for Balatro', {
          gamePath,
          detectedFile: file,
          filePath
        });
        return true;
      }
    }
    
    log('debug', 'Lovely injector not detected in Balatro installation', { gamePath });
    return false;
  } catch (error) {
     log('error', 'Error detecting Lovely injector for Balatro', {
       gamePath,
       error: error instanceof Error ? error.message : String(error),
       stack: error instanceof Error ? error.stack : undefined
     });
     return false;
   }
}

/**
 * Detect if SteamModded is properly installed for Balatro on macOS
 * @param gamePath - Path to the Balatro game installation
 * @returns Promise<boolean> - True if SteamModded is detected
 */
export async function detectSteamModdedForBalatro(gamePath: string): Promise<boolean> {
  try {
    const steamModdedFiles = [
      'steammodded.lua',
      'steammodded',
      'Mods/steammodded.lua'
    ];
    
    log('debug', 'Checking for SteamModded in Balatro installation', {
      gamePath,
      checkingFiles: steamModdedFiles
    });
    
    for (const file of steamModdedFiles) {
      const filePath = path.join(gamePath, file);
      if (await fs.pathExists(filePath)) {
        log('info', 'SteamModded detected for Balatro', {
          gamePath,
          detectedFile: file,
          filePath
        });
        return true;
      }
    }
    
    log('debug', 'SteamModded not detected in Balatro installation', { gamePath });
    return false;
  } catch (error) {
     log('error', 'Error detecting SteamModded for Balatro', {
       gamePath,
       error: error instanceof Error ? error.message : String(error),
       stack: error instanceof Error ? error.stack : undefined
     });
     return false;
   }
}

/**
 * Validate Balatro installation and provide detailed compatibility information
 * @param gamePath - Path to the Balatro game installation
 * @returns Promise<object> - Detailed compatibility information
 */
// Interface for executable name mapping
export interface ExecutableNameMapping {
  windowsExecutable: string;
  macOSExecutable: string;
  description: string;
  gameId?: string; // Optional game-specific mapping
}

// Common executable name mappings for Windows to macOS
const EXECUTABLE_NAME_MAPPINGS: ExecutableNameMapping[] = [
  // Generic mappings
  {
    windowsExecutable: 'game.exe',
    macOSExecutable: 'game',
    description: 'Generic game executable mapping'
  },
  {
    windowsExecutable: 'launcher.exe',
    macOSExecutable: 'launcher',
    description: 'Generic launcher executable mapping'
  },
  // Specific game mappings
  {
    windowsExecutable: 'Cyberpunk2077.exe',
    macOSExecutable: 'Cyberpunk2077',
    description: 'Cyberpunk 2077 executable mapping',
    gameId: 'cyberpunk2077'
  },
  {
    windowsExecutable: 'Balatro.exe',
    macOSExecutable: 'run_lovely_macos.sh',
    description: 'Balatro executable mapping (prefer Lovely launcher on macOS)',
    gameId: 'balatro'
  },
  {
    windowsExecutable: 'StardewValley.exe',
    macOSExecutable: 'StardewValley',
    description: 'Stardew Valley executable mapping',
    gameId: 'stardewvalley'
  },
  {
    windowsExecutable: 'RimWorldWin64.exe',
    macOSExecutable: 'RimWorld',
    description: 'RimWorld executable mapping',
    gameId: 'rimworld'
  },
  {
    windowsExecutable: 'factorio.exe',
    macOSExecutable: 'factorio',
    description: 'Factorio executable mapping',
    gameId: 'factorio'
  },
  {
    windowsExecutable: 'valheim.exe',
    macOSExecutable: 'valheim',
    description: 'Valheim executable mapping',
    gameId: 'valheim'
  },
  {
    windowsExecutable: 'Among Us.exe',
    macOSExecutable: 'Among Us',
    description: 'Among Us executable mapping',
    gameId: 'amongus'
  },
  {
    windowsExecutable: 'hollow_knight.exe',
    macOSExecutable: 'hollow_knight',
    description: 'Hollow Knight executable mapping',
    gameId: 'hollowknight'
  },
  {
    windowsExecutable: 'Celeste.exe',
    macOSExecutable: 'Celeste',
    description: 'Celeste executable mapping',
    gameId: 'celeste'
  },
  {
    windowsExecutable: 'Hades2.exe',
    macOSExecutable: 'Hades2',
    description: 'Hades II executable mapping',
    gameId: 'hades2'
  },
  {
    windowsExecutable: 'Disco Elysium.exe',
    macOSExecutable: 'Disco Elysium',
    description: 'Disco Elysium executable mapping',
    gameId: 'discoelysium'
  },
  {
    windowsExecutable: 'Outer Wilds.exe',
    macOSExecutable: 'Outer Wilds',
    description: 'Outer Wilds executable mapping',
    gameId: 'outerwilds'
  },
  {
    windowsExecutable: 'Obra Dinn.exe',
    macOSExecutable: 'obra_dinn',
    description: 'Return of the Obra Dinn executable mapping',
    gameId: 'returnoftheobradinn'
  },
  {
    windowsExecutable: 'PapersPlease.exe',
    macOSExecutable: 'PapersPlease',
    description: 'Papers, Please executable mapping',
    gameId: 'papersplease'
  },
  {
    windowsExecutable: 'ITB.exe',
    macOSExecutable: 'ITB',
    description: 'Into the Breach executable mapping',
    gameId: 'intothebreach'
  },
  {
    windowsExecutable: 'FTL.exe',
    macOSExecutable: 'FTL',
    description: 'FTL: Faster Than Light executable mapping',
    gameId: 'ftl'
  },
  {
    windowsExecutable: 'dontstarve.exe',
    macOSExecutable: 'dontstarve',
    description: 'Don\'t Starve executable mapping',
    gameId: 'dontstarve'
  },
  {
    windowsExecutable: 'dontstarve_steam.exe',
    macOSExecutable: 'dontstarve_steam',
    description: 'Don\'t Starve Together executable mapping',
    gameId: 'dontstarvetogether'
  },
  {
    windowsExecutable: 'The Stanley Parable.exe',
    macOSExecutable: 'The Stanley Parable',
    description: 'The Stanley Parable executable mapping',
    gameId: 'thestanleyparable'
  },
  {
    windowsExecutable: 'isaac-ng.exe',
    macOSExecutable: 'isaac-ng',
    description: 'The Binding of Isaac: Rebirth executable mapping',
    gameId: 'bindingofisaacrebirth'
  },
  {
    windowsExecutable: 'Stardew Valley.exe',
    macOSExecutable: 'Stardew Valley',
    description: 'Stardew Valley (GOG) executable mapping',
    gameId: 'stardewvalleygog'
  },
  {
    windowsExecutable: 'Terraria.exe',
    macOSExecutable: 'Terraria',
    description: 'Terraria (GOG) executable mapping',
    gameId: 'terrariagog'
  },
  {
    windowsExecutable: 'Risk of Rain 2.exe',
    macOSExecutable: 'Risk of Rain 2',
    description: 'Risk of Rain 2 executable mapping',
    gameId: 'riskofrain2'
  },
  {
    windowsExecutable: 'deadcells.exe',
    macOSExecutable: 'deadcells',
    description: 'Dead Cells executable mapping',
    gameId: 'deadcells'
  },
  {
    windowsExecutable: 'Katana ZERO.exe',
    macOSExecutable: 'Katana ZERO',
    description: 'Katana ZERO executable mapping',
    gameId: 'katanazero'
  },
  {
    windowsExecutable: 'HatinTimeGame.exe',
    macOSExecutable: 'HatinTimeGame',
    description: 'A Hat in Time executable mapping',
    gameId: 'ahatintime'
  },
  {
    windowsExecutable: 'Owlboy.exe',
    macOSExecutable: 'Owlboy',
    description: 'Owlboy executable mapping',
    gameId: 'owlboy'
  },
  {
    windowsExecutable: 'AShortHike.exe',
    macOSExecutable: 'AShortHike',
    description: 'A Short Hike executable mapping',
    gameId: 'ashorthike'
  }
];

// Storage for custom executable name mappings registered by community extensions
const customExecutableNameMappings: ExecutableNameMapping[] = [];

/**
 * Register a custom executable name mapping for community extensions
 * @param mapping The executable name mapping to register
 */
export function registerCustomExecutableNameMapping(mapping: ExecutableNameMapping): void {
  log('info', 'Registering custom executable name mapping for community extension', {
    description: mapping.description,
    windowsExecutable: mapping.windowsExecutable,
    macOSExecutable: mapping.macOSExecutable
  });
  
  // Check if mapping already exists
  const existingIndex = customExecutableNameMappings.findIndex(
    existing => existing.windowsExecutable === mapping.windowsExecutable && 
                existing.gameId === mapping.gameId
  );
  
  if (existingIndex >= 0) {
    log('warn', 'Overriding existing executable name mapping', {
      description: mapping.description,
      previousDescription: customExecutableNameMappings[existingIndex].description
    });
    customExecutableNameMappings[existingIndex] = mapping;
  } else {
    customExecutableNameMappings.push(mapping);
  }
}

/**
 * Get all executable name mappings (both static and custom)
 * @param gameId Optional game ID to filter mappings
 * @returns Array of executable name mappings
 */
export function getExecutableNameMappings(gameId?: string): ExecutableNameMapping[] {
  let mappings = [...customExecutableNameMappings, ...EXECUTABLE_NAME_MAPPINGS];
  
  if (gameId) {
    mappings = mappings.filter(mapping => !mapping.gameId || mapping.gameId === gameId);
  }
  
  return mappings;
}

/**
 * Map a Windows executable name to its macOS equivalent
 * @param windowsExecutable The Windows executable name
 * @param gameId Optional game ID for game-specific mappings
 * @returns The macOS executable name, or the original name if no mapping exists
 */
export function mapWindowsExecutableToMacOS(windowsExecutable: string, gameId?: string): string {
  if (!windowsExecutable) {
    return windowsExecutable;
  }
  
  // Remove .exe extension if present
  const baseName = windowsExecutable.toLowerCase().endsWith('.exe') 
    ? windowsExecutable.slice(0, -4)
    : windowsExecutable;
  
  // Get relevant mappings
  const mappings = getExecutableNameMappings(gameId);
  
  // Look for an exact match
  const exactMatch = mappings.find(mapping => 
    mapping.windowsExecutable.toLowerCase() === windowsExecutable.toLowerCase() ||
    mapping.windowsExecutable.toLowerCase() === baseName.toLowerCase()
  );
  
  if (exactMatch) {
    log('debug', 'Found executable name mapping', {
      windowsExecutable,
      macOSExecutable: exactMatch.macOSExecutable,
      description: exactMatch.description,
      gameId
    });
    return exactMatch.macOSExecutable;
  }
  
  // If no exact match, try to remove .exe extension and match base name
  if (windowsExecutable.toLowerCase().endsWith('.exe')) {
    const genericMatch = mappings.find(mapping => 
      mapping.windowsExecutable.toLowerCase() === baseName.toLowerCase()
    );
    
    if (genericMatch) {
      log('debug', 'Found generic executable name mapping', {
        windowsExecutable,
        macOSExecutable: genericMatch.macOSExecutable,
        description: genericMatch.description,
        gameId
      });
      return genericMatch.macOSExecutable;
    }
  }
  
  // If still no match, return the original executable name (with .exe removed for macOS)
  return baseName;
}

/**
 * Validate an executable name mapping
 * @param mapping The mapping to validate
 * @returns Validation result with success status and any errors
 */
export function validateExecutableNameMapping(mapping: ExecutableNameMapping): {
  success: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic validation
  if (!mapping.windowsExecutable) {
    errors.push('windowsExecutable is required');
  }
  if (!mapping.macOSExecutable) {
    errors.push('macOSExecutable is required');
  }
  if (!mapping.description) {
    errors.push('description is required');
  }

  return {
    success: errors.length === 0,
    errors
  };
}

export async function validateBalatroPlatformCompatibility(gamePath: string): Promise<{
  isValid: boolean;
  hasLovelyInjector: boolean;
  hasSteamModded: boolean;
  appBundleFound: boolean;
  executablePath: string | null;
  recommendations: string[];
  errors: string[];
}> {
  const result = {
    isValid: false,
    hasLovelyInjector: false,
    hasSteamModded: false,
    appBundleFound: false,
    executablePath: null as string | null,
    recommendations: [] as string[],
    errors: [] as string[]
  };
  
  try {
    log('info', 'Validating Balatro installation for macOS compatibility', { gamePath });
    
    // Check if game path exists
    if (!await fs.pathExists(gamePath)) {
      result.errors.push('Game path does not exist');
      return result;
    }
    
    // Check for app bundle
    const appBundlePath = await findMacOSAppBundle(gamePath, 'Balatro.app');
    if (appBundlePath) {
      result.appBundleFound = true;
      result.executablePath = await getExecutableFromAppBundle(appBundlePath);
      log('info', 'Balatro app bundle found', { appBundlePath, executablePath: result.executablePath });
    } else {
      result.recommendations.push('Balatro.app bundle not found - game may not launch properly on macOS');
    }
    
    // Check for mod loaders
    result.hasLovelyInjector = await detectLovelyInjectorForBalatro(gamePath);
    result.hasSteamModded = await detectSteamModdedForBalatro(gamePath);
    
    // Provide recommendations
    if (!result.hasLovelyInjector && !result.hasSteamModded) {
      result.recommendations.push('No mod loaders detected - install Lovely injector or SteamModded for mod support');
    }
    
    if (result.hasLovelyInjector) {
      result.recommendations.push('Lovely injector detected - mods should work properly');
    }
    
    if (result.hasSteamModded) {
      result.recommendations.push('SteamModded detected - Steam Workshop mods should work properly');
    }
    
    // Determine overall validity
    result.isValid = result.appBundleFound || result.executablePath !== null;
    
    log('info', 'Balatro compatibility validation completed', {
      gamePath,
      result: {
        isValid: result.isValid,
        hasLovelyInjector: result.hasLovelyInjector,
        hasSteamModded: result.hasSteamModded,
        appBundleFound: result.appBundleFound,
        recommendationCount: result.recommendations.length,
        errorCount: result.errors.length
      }
    });
    
    return result;
  } catch (error) {
     result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
     log('error', 'Error validating Balatro installation', {
       gamePath,
       error: error instanceof Error ? error.message : String(error),
       stack: error instanceof Error ? error.stack : undefined
     });
     return result;
   }
}