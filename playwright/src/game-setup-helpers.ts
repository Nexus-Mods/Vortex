import fs from 'fs';
import path from 'path';

/**
 * Configuration for setting up a fake game installation
 */
export interface GameConfig {
  gameId: string;
  gameName: string;
  /** Main game executable name */
  executable: string;
  /** Additional required files for game detection */
  requiredFiles: string[];
  /** Directories that should exist in the game folder */
  directories: string[];
  /** Optional files to create (with optional content) */
  optionalFiles?: Array<{ path: string; content?: string }>;
  /** Mod folder relative path */
  modFolderPath?: string;
}

/**
 * Pre-configured game setups for common games
 */
export const GAME_CONFIGS: Record<string, GameConfig> = {
  'stardewvalley': {
    gameId: 'stardewvalley',
    gameName: 'Stardew Valley',
    executable: process.platform === 'win32' ? 'Stardew Valley.exe' : 'StardewValley',
    requiredFiles: [
      process.platform === 'win32' ? 'Stardew Valley.exe' : 'StardewValley',
      'Stardew Valley.deps.json',
      'Stardew Valley.dll',
      'Stardew Valley.pdb',
      'Stardew Valley.runtimeconfig.json',
    ],
    directories: [
      'Content',
      'Content/Characters',
      'Content/Data',
      'Content/Maps',
      'Mods',  // Default mod folder
    ],
    optionalFiles: [
      { path: 'steam_appid.txt', content: '413150' },
      {
        path: 'Content/XACT/FarmerSounds.xwb',
        content: 'FAKE_AUDIO_FILE'  // Placeholder
      },
    ],
    modFolderPath: 'Mods',
  },

  'skyrimse': {
    gameId: 'skyrimse',
    gameName: 'Skyrim Special Edition',
    executable: 'SkyrimSE.exe',
    requiredFiles: [
      'SkyrimSE.exe',
      'SkyrimSELauncher.exe',
      'binkw64.dll',
      'steam_api64.dll',
    ],
    directories: [
      'Data',
      'Data/Scripts',
      'Data/Meshes',
      'Data/Textures',
    ],
    optionalFiles: [
      { path: 'steam_appid.txt', content: '489830' },
      { path: 'Data/Skyrim.esm', content: 'TES4\x00\x00\x00\x00' }, // ESM header
    ],
    modFolderPath: 'Data',
  },
};

/**
 * Creates a fake game installation directory structure
 *
 * @param gameConfig - Configuration for the game to set up
 * @param basePath - Base path where the game folder should be created
 * @returns The full path to the created game directory
 */
export function createFakeGameInstallation(
  gameConfig: GameConfig,
  basePath: string
): string {
  const gamePath = path.join(basePath, gameConfig.gameName);

  // Create base game directory
  if (!fs.existsSync(gamePath)) {
    fs.mkdirSync(gamePath, { recursive: true });
  }

  // Create required directories
  for (const dir of gameConfig.directories) {
    const dirPath = path.join(gamePath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create required files (empty or minimal content)
  for (const file of gameConfig.requiredFiles) {
    const filePath = path.join(gamePath, file);
    if (!fs.existsSync(filePath)) {
      // Create fake executable with minimal PE header for .exe files
      if (file.endsWith('.exe')) {
        const fakeExe = createFakeExecutable();
        fs.writeFileSync(filePath, fakeExe);
      } else {
        // Just create empty files for others
        fs.writeFileSync(filePath, '');
      }
    }
  }

  // Create optional files
  if (gameConfig.optionalFiles) {
    for (const optFile of gameConfig.optionalFiles) {
      const filePath = path.join(gamePath, optFile.path);
      const fileDir = path.dirname(filePath);

      // Ensure directory exists
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, optFile.content || '');
      }
    }
  }

  console.log(`Created fake game installation at: ${gamePath}`);
  return gamePath;
}

/**
 * Creates a minimal fake PE executable that Windows will recognize
 * This is just enough to pass file type checks
 */
function createFakeExecutable(): Buffer {
  // Minimal DOS header + PE header
  const buffer = Buffer.alloc(512);

  // DOS header magic number
  buffer.write('MZ', 0);

  // Offset to PE header (at 0x40)
  buffer.writeUInt32LE(0x40, 0x3C);

  // PE signature
  buffer.write('PE\0\0', 0x40);

  // Machine type (x64)
  buffer.writeUInt16LE(0x8664, 0x44);

  return buffer;
}

/**
 * Cleans up a fake game installation
 *
 * @param gamePath - Path to the game directory to remove
 */
export function cleanupFakeGameInstallation(gamePath: string): void {
  if (fs.existsSync(gamePath)) {
    fs.rmSync(gamePath, { recursive: true, force: true });
    console.log(`Cleaned up fake game installation at: ${gamePath}`);
  }
}
