/**
 * Helpers for creating fake game installations during e2e tests.
 * Ported from the root playwright/src/game-setup-helpers.ts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readMockTree, writeMockTree, type MockTreeEntry, type MockTreeFixture } from "./mock-tree";

export interface GameConfig {
  gameId: string;
  gameName: string;
  executable: string;
  requiredFiles: string[];
  tree: MockTreeFixture;
  externalTrees?: ExternalFixtureTree[];
  modFolderPath?: string;
}

type ExternalFixtureBase = "localAppData";

interface ExternalFixtureTree {
  base: ExternalFixtureBase;
  tree: MockTreeFixture;
}

export interface SetupFakeGameOptions {
  /** Root temp directory created by prepareVortexInstance(). */
  vortexUserDataDir?: string;
}

const treeFixture = (...segments: string[]): MockTreeFixture => {
  const root = path.join(import.meta.dirname, "trees", ...segments);
  return {
    treeFile: path.join(root, "tree.txt"),
    filesDir: path.join(root, "files"),
  };
};

export const GAME_CONFIGS = {
  stardewvalley: {
    gameId: "stardewvalley",
    gameName: "Stardew Valley",
    executable: process.platform === "win32" ? "Stardew Valley.exe" : "StardewValley",
    requiredFiles: [
      process.platform === "win32" ? "Stardew Valley.exe" : "StardewValley",
      "Stardew Valley.deps.json",
      "Stardew Valley.dll",
      "Stardew Valley.pdb",
      "Stardew Valley.runtimeconfig.json",
    ],
    tree: treeFixture("stardewvalley"),
    modFolderPath: "Mods",
  } satisfies GameConfig,
  skyrimse: {
    gameId: "skyrimse",
    gameName: "Skyrim Special Edition",
    executable: "SkyrimSE.exe",
    requiredFiles: ["SkyrimSE.exe", "SkyrimSELauncher.exe", "binkw64.dll", "steam_api64.dll"],
    tree: treeFixture("skyrimse"),
    modFolderPath: "Data",
  } satisfies GameConfig,
  baldursgate3: {
    gameId: "baldursgate3",
    gameName: "Baldur's Gate 3",
    executable: "bin/bg3_dx11.exe",
    // Vortex only requires bg3_dx11.exe for manual path verification, but BG3's
    // version branch reads bin/bg3.exe, so the fixture provides both.
    requiredFiles: ["bin/bg3_dx11.exe", "bin/bg3.exe"],
    tree: treeFixture("baldursgate3"),
    // BG3 consults both PlayerProfiles/<profile>/modsettings.lsx and legacy
    // top-level profile paths depending on version/profile branches. Seed all
    // tiny XML files so fake executables that report 0.0.0 still activate.
    externalTrees: [{ base: "localAppData", tree: treeFixture("baldursgate3", "localAppData") }],
    modFolderPath: "Mods",
  } satisfies GameConfig,
} as const;

/** Creates a minimal fake PE executable header that passes file type checks. */
function createFakeExecutable(): Buffer {
  const buffer = Buffer.alloc(512);
  buffer.write("MZ", 0);
  buffer.writeUInt32LE(0x40, 0x3c);
  buffer.write("PE\0\0", 0x40);
  buffer.writeUInt16LE(0x8664, 0x44);
  return buffer;
}

function writeFakeExecutable(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, createFakeExecutable());
}

function postProcessTreeExecutables(gamePath: string, entries: MockTreeEntry[]): void {
  for (const entry of entries) {
    if (entry.type === "file" && entry.path.toLowerCase().endsWith(".exe")) {
      writeFakeExecutable(path.join(gamePath, ...entry.path.split("/")));
    }
  }
}

function assertRequiredFiles(gamePath: string, gameConfig: GameConfig): void {
  const missing = gameConfig.requiredFiles.filter(
    (filePath) => !fs.existsSync(path.join(gamePath, ...filePath.split("/"))),
  );
  if (missing.length > 0) {
    throw new Error(`Tree fixture for ${gameConfig.gameId} is missing: ${missing.join(", ")}`);
  }
}

function resolveExternalBase(base: ExternalFixtureBase, options: SetupFakeGameOptions): string {
  switch (base) {
    case "localAppData":
      if (options.vortexUserDataDir === undefined) {
        throw new Error("localAppData fixture files require options.vortexUserDataDir");
      }
      // prepareVortexInstance() sets ELECTRON_APPDATA to <root>/appData;
      // Vortex localAppData falls back to sibling <root>/Local on non-Windows.
      return path.join(options.vortexUserDataDir, "Local");
  }
}

/** Creates a fake game installation directory with all required files. */
export function createFakeGameInstallation(
  gameConfig: GameConfig,
  basePath: string,
  options: SetupFakeGameOptions = {},
): string {
  const gamePath = path.join(basePath, gameConfig.gameName);
  fs.mkdirSync(gamePath, { recursive: true });

  const entries = readMockTree(gameConfig.tree.treeFile);
  writeMockTree(gamePath, entries, { filesDir: gameConfig.tree.filesDir });
  postProcessTreeExecutables(gamePath, entries);
  assertRequiredFiles(gamePath, gameConfig);

  if (gameConfig.externalTrees) {
    for (const tree of gameConfig.externalTrees) {
      writeMockTree(resolveExternalBase(tree.base, options), readMockTree(tree.tree.treeFile), {
        filesDir: tree.tree.filesDir,
      });
    }
  }

  return gamePath;
}

/** Creates a temp directory with a fake game installation. Returns both paths for cleanup. */
export function setupFakeGame(configKey: keyof typeof GAME_CONFIGS): {
  basePath: string;
  gamePath: string;
};
export function setupFakeGame(
  configKey: keyof typeof GAME_CONFIGS,
  options: SetupFakeGameOptions,
): {
  basePath: string;
  gamePath: string;
};
export function setupFakeGame(
  configKey: keyof typeof GAME_CONFIGS,
  options: SetupFakeGameOptions = {},
): {
  basePath: string;
  gamePath: string;
} {
  const config = GAME_CONFIGS[configKey];
  if (!config) throw new Error(`Unknown game config: ${configKey}`);

  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-games-"));
  const gamePath = createFakeGameInstallation(config, basePath, options);
  return { basePath, gamePath };
}

/** Removes a fake game installation directory. */
export function cleanupFakeGame(basePath: string): void {
  fs.rmSync(basePath, { recursive: true, force: true });
}
