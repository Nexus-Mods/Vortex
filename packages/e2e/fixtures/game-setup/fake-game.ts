/**
 * Helpers for creating fake game installations during e2e tests.
 * Ported from the root playwright/src/game-setup-helpers.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface GameConfig {
  gameId: string;
  gameName: string;
  executable: string;
  requiredFiles: string[];
  directories: string[];
  optionalFiles?: Array<{ path: string; content?: string }>;
  modFolderPath?: string;
}

export const GAME_CONFIGS: Record<string, GameConfig> = {
  stardewvalley: {
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
    directories: ['Content', 'Content/Characters', 'Content/Data', 'Content/Maps', 'Mods'],
    optionalFiles: [
      { path: 'steam_appid.txt', content: '413150' },
      { path: 'Content/XACT/FarmerSounds.xwb', content: 'FAKE_AUDIO_FILE' },
    ],
    modFolderPath: 'Mods',
  },
  skyrimse: {
    gameId: 'skyrimse',
    gameName: 'Skyrim Special Edition',
    executable: 'SkyrimSE.exe',
    requiredFiles: ['SkyrimSE.exe', 'SkyrimSELauncher.exe', 'binkw64.dll', 'steam_api64.dll'],
    directories: ['Data', 'Data/Scripts', 'Data/Meshes', 'Data/Textures'],
    optionalFiles: [
      { path: 'steam_appid.txt', content: '489830' },
      { path: 'Data/Skyrim.esm', content: 'TES4\x00\x00\x00\x00' },
    ],
    modFolderPath: 'Data',
  },
};

/** Creates a minimal fake PE executable header that passes file type checks. */
function createFakeExecutable(): Buffer {
  const buffer = Buffer.alloc(512);
  buffer.write('MZ', 0);
  buffer.writeUInt32LE(0x40, 0x3c);
  buffer.write('PE\0\0', 0x40);
  buffer.writeUInt16LE(0x8664, 0x44);
  return buffer;
}

/** Creates a fake game installation directory with all required files. */
export function createFakeGameInstallation(gameConfig: GameConfig, basePath: string): string {
  const gamePath = path.join(basePath, gameConfig.gameName);
  fs.mkdirSync(gamePath, { recursive: true });

  for (const dir of gameConfig.directories) {
    fs.mkdirSync(path.join(gamePath, dir), { recursive: true });
  }

  for (const file of gameConfig.requiredFiles) {
    const filePath = path.join(gamePath, file);
    if (file.endsWith('.exe')) {
      fs.writeFileSync(filePath, createFakeExecutable());
    } else {
      fs.writeFileSync(filePath, '');
    }
  }

  if (gameConfig.optionalFiles) {
    for (const optFile of gameConfig.optionalFiles) {
      const filePath = path.join(gamePath, optFile.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, optFile.content || '');
    }
  }

  return gamePath;
}

/** Creates a temp directory with a fake game installation. Returns both paths for cleanup. */
export function setupFakeGame(configKey: string): { basePath: string; gamePath: string } {
  const config = GAME_CONFIGS[configKey];
  if (!config) throw new Error(`Unknown game config: ${configKey}`);

  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'vortex-e2e-games-'));
  const gamePath = createFakeGameInstallation(config, basePath);
  return { basePath, gamePath };
}

/** Removes a fake game installation directory. */
export function cleanupFakeGame(basePath: string): void {
  fs.rmSync(basePath, { recursive: true, force: true });
}
