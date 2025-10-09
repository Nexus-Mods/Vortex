# Game Setup Helpers for Vortex Testing

This document explains how to create fake game installations for testing Vortex functionality.

## Overview

The game setup helpers allow you to:
1. **Create fake game installations** with the correct file structure
2. **Clean up test installations** after tests complete

## Quick Start

```typescript
import { GAME_CONFIGS, createFakeGameInstallation, cleanupFakeGameInstallation } from '../src/game-setup-helpers';

// Create a fake Stardew Valley installation
const gamePath = createFakeGameInstallation(
  GAME_CONFIGS.stardewvalley,
  '/tmp/fake-games'
);

// Clean up when done
cleanupFakeGameInstallation(gamePath);
```

## Available Game Configurations

### Stardew Valley
- **Config Key**: `'stardewvalley'`
- **Executable**: `Stardew Valley.exe` (Windows) or `StardewValley` (Linux/Mac)
- **Required Files**: Main executable, DLLs, config files
- **Directories**: Content folder with subfolders, Mods folder

### Skyrim Special Edition
- **Config Key**: `'skyrimse'`
- **Executable**: `SkyrimSE.exe`
- **Required Files**: Game executable, launcher, DLLs
- **Directories**: Data folder with Scripts, Meshes, Textures

## Core Functions

### `createFakeGameInstallation(gameConfig, basePath)`
Creates the physical game folder structure on disk.

**Parameters:**
- `gameConfig`: GameConfig object (from GAME_CONFIGS or custom)
- `basePath`: Directory where game folder will be created

**Returns:** Full path to the created game directory

**What it creates:**
- Game folder with the correct name
- All required directories
- All required files (with fake .exe having minimal PE headers)
- Optional files (steam_appid.txt, etc.)

**Example:**
```typescript
import { GAME_CONFIGS, createFakeGameInstallation } from '../src/game-setup-helpers';

const gamePath = createFakeGameInstallation(
  GAME_CONFIGS.stardewvalley,
  '/tmp/fake-games'
);
// Creates: /tmp/fake-games/Stardew Valley/
// With: Stardew Valley.exe, Content/, Mods/, etc.
```

### `cleanupFakeGameInstallation(gamePath)`
Removes a fake game installation from disk.

**Parameters:**
- `gamePath`: Full path to the game directory to remove

**Example:**
```typescript
try {
  const gamePath = createFakeGameInstallation(...);
  // ... run tests ...
} finally {
  cleanupFakeGameInstallation(gamePath);
}
```

## Complete Test Example

```typescript
import { test, Browser } from '@playwright/test';
import { launchVortex, closeVortex } from '../src/vortex-helpers';
import { loginToNexusMods } from '../src/nexusmods-auth-helpers';
import { GAME_CONFIGS, createFakeGameInstallation, cleanupFakeGameInstallation } from '../src/game-setup-helpers';
import path from 'path';
import os from 'os';

test('test with fake game', async ({ browser }: { browser: Browser }) => {
  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } =
    await launchVortex('test-fake-game');

  const fakeGamesPath = path.join(os.tmpdir(), 'vortex-test-games', `test-${Date.now()}`);
  let gamePath: string | undefined;

  try {
    // 1. Login
    await loginToNexusMods(browser, mainWindow);

    // 2. Create fake game files
    const gameConfig = GAME_CONFIGS.stardewvalley;
    gamePath = createFakeGameInstallation(gameConfig, fakeGamesPath);

    // 3. Verify files exist
    const fs = await import('fs');
    const executablePath = path.join(gamePath, gameConfig.executable);
    const executableExists = fs.existsSync(executablePath);

    if (!executableExists) {
      throw new Error(`Expected executable not found: ${executablePath}`);
    }

    // 4. Run your tests...
    console.log('Game created successfully!');

  } finally {
    if (gamePath) cleanupFakeGameInstallation(gamePath);
    await closeVortex(app, appProcess, pid, userDataDir);
  }
});
```

## Adding New Games

To add support for a new game, add an entry to `GAME_CONFIGS` in `game-setup-helpers.ts`:

```typescript
export const GAME_CONFIGS: Record<string, GameConfig> = {
  // ... existing games ...

  'fallout4': {
    gameId: 'fallout4',
    gameName: 'Fallout 4',
    executable: 'Fallout4.exe',
    requiredFiles: [
      'Fallout4.exe',
      'Fallout4Launcher.exe',
      'steam_api64.dll',
    ],
    directories: [
      'Data',
      'Data/Scripts',
      'Data/Meshes',
    ],
    optionalFiles: [
      { path: 'steam_appid.txt', content: '377160' },
      { path: 'Data/Fallout4.esm', content: 'TES4\x00\x00\x00\x00' },
    ],
    modFolderPath: 'Data',
  },
};
```

### GameConfig Interface

```typescript
interface GameConfig {
  gameId: string;                // Unique identifier (lowercase, no spaces)
  gameName: string;              // Display name (used for folder name)
  executable: string;            // Main executable filename
  requiredFiles: string[];       // Files needed for game detection
  directories: string[];         // Folders to create in game directory
  optionalFiles?: Array<{        // Additional files to create
    path: string;                // Relative path from game root
    content?: string;            // File content (optional)
  }>;
  modFolderPath?: string;        // Where mods go (relative to game root)
}
```

## Tips

1. **Always cleanup**: Use try/finally to ensure fake game installations are removed
2. **Use unique paths**: Use timestamps in path names to avoid conflicts between test runs
3. **Check file existence**: After creation, verify critical files exist
4. **Platform-specific executables**: Use `process.platform` to set the correct executable name

## File Structure

```
playwright/
├── src/
│   ├── game-setup-helpers.ts          # Game setup functions
│   ├── nexusmods-auth-helpers.ts      # Login functions
│   └── vortex-helpers.ts              # Launch/close functions
├── tests/
│   ├── game-setup-stardew.spec.ts     # Example test
│   └── your-test.spec.ts              # Your tests here
└── GAME_SETUP_README.md               # This file
```

## What Gets Created

When you call `createFakeGameInstallation()`, the following is created on disk:

```
/tmp/fake-games/Stardew Valley/
├── Stardew Valley.exe          # Fake PE executable (512 bytes with headers)
├── Stardew Valley.deps.json    # Empty file
├── Stardew Valley.dll          # Empty file
├── Stardew Valley.pdb          # Empty file
├── Stardew Valley.runtimeconfig.json  # Empty file
├── steam_appid.txt             # Contains "413150"
├── Content/
│   ├── Characters/
│   ├── Data/
│   ├── Maps/
│   └── XACT/
│       └── FarmerSounds.xwb    # Contains "FAKE_AUDIO_FILE"
└── Mods/                       # Empty directory
```

## Fake Executables

For `.exe` files, the helper creates a minimal PE (Portable Executable) file with:
- DOS header with "MZ" magic number
- PE header signature
- x64 machine type

This is sufficient for basic file type detection but the executables cannot actually run.

## Troubleshooting

### Files not created
- Check that basePath directory exists or is writable
- Verify no permission issues on Windows
- Check console output for error messages

### Path too long errors (Windows)
- Use shorter base paths (e.g., `C:\temp\vortex-tests`)
- Keep test names short
- Use path.join() for cross-platform compatibility

### Cleanup fails
- Ensure no processes have files open
- Check that file handles are released
- Run cleanup in test finally block
- The test runner automatically waits 1 second before cleanup

## Implementation Notes

- **Fake executables**: Created with minimal PE headers (512 bytes)
- **Empty files**: Most non-executable files are created empty
- **Optional files**: Can have content specified in the config
- **Directory structure**: Created recursively with proper error handling
- **Cleanup**: Uses `fs.rmSync()` with `force: true` for reliable removal

## Future Enhancements

Possible additions to the game setup helpers:

- [ ] Save game file generation
- [ ] Plugin/Load order file creation
- [ ] INI configuration file templates
- [ ] Mod archive (zip/7z) creation
- [ ] Integration with Vortex Redux for game discovery
- [ ] Mod creation helpers (SMAPI, SKSE, etc.)
