/**
 * Helpers for creating fake game installations during e2e tests.
 * Ported from the root playwright/src/game-setup-helpers.ts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  fixturePathToNative,
  mockTreePlatformFromNodePlatform,
  normaliseFixturePath,
  readMockTreeFixture,
  validateFixturePath,
  writeMockTree,
  type MockTreeEntry,
  type MockTreeFixture,
  type MockTreePlatform,
} from "./mock-tree";

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

type PlatformStringMap = Partial<Record<MockTreePlatform, string>>;
type PlatformStringArrayMap = Partial<Record<MockTreePlatform, string[]>> & {
  common?: string[];
};

interface GameConfigManifest {
  gameName: string;
  executable: string | PlatformStringMap;
  requiredFiles: string[] | PlatformStringArrayMap;
  externalTrees?: Array<{ base: ExternalFixtureBase; path: string }>;
  modFolderPath?: string;
}

export interface SetupFakeGameOptions {
  /** Root temp directory created by prepareVortexInstance(). */
  vortexUserDataDir?: string;
}

const TREES_ROOT = path.join(import.meta.dirname, "trees");

function treeFixture(rootDir: string): MockTreeFixture {
  return { rootDir };
}

function readManifest(filePath: string): GameConfigManifest {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as GameConfigManifest;
}

function isPlatformStringMap(value: string | PlatformStringMap): value is PlatformStringMap {
  return typeof value !== "string";
}

function isPlatformStringArrayMap(
  value: string[] | PlatformStringArrayMap,
): value is PlatformStringArrayMap {
  return !Array.isArray(value);
}

function validateRelativePath(value: string, location: string): string {
  const normalised = normaliseFixturePath(value);
  try {
    validateFixturePath(normalised);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${location}: ${message}`, { cause: err });
  }
  return normalised;
}

function resolveExecutable(
  manifest: GameConfigManifest,
  platform: MockTreePlatform,
  manifestPath: string,
): string {
  const rawExecutable = manifest.executable;
  const executable = isPlatformStringMap(rawExecutable) ? rawExecutable[platform] : rawExecutable;
  if (executable === undefined) {
    throw new Error(`Game config manifest missing executable for ${platform}: ${manifestPath}`);
  }
  return validateRelativePath(executable, `${manifestPath} executable`);
}

function resolveRequiredFiles(
  manifest: GameConfigManifest,
  platform: MockTreePlatform,
  manifestPath: string,
): string[] {
  const rawRequiredFiles = manifest.requiredFiles;
  const requiredFiles = isPlatformStringArrayMap(rawRequiredFiles)
    ? [...(rawRequiredFiles.common ?? []), ...(rawRequiredFiles[platform] ?? [])]
    : rawRequiredFiles;

  return [...new Set(requiredFiles)].map((filePath) =>
    validateRelativePath(filePath, `${manifestPath} requiredFiles`),
  );
}

function loadGameConfig(gameId: string, rootDir: string, platform: MockTreePlatform): GameConfig {
  const manifestPath = path.join(rootDir, "config.json");
  const manifest = readManifest(manifestPath);
  const externalTrees = manifest.externalTrees?.map((tree) => ({
    base: tree.base,
    tree: treeFixture(
      path.join(rootDir, validateRelativePath(tree.path, `${manifestPath} externalTrees`)),
    ),
  }));

  return {
    gameId,
    gameName: manifest.gameName,
    executable: resolveExecutable(manifest, platform, manifestPath),
    requiredFiles: resolveRequiredFiles(manifest, platform, manifestPath),
    tree: treeFixture(rootDir),
    ...(externalTrees === undefined ? {} : { externalTrees }),
    ...(manifest.modFolderPath === undefined
      ? {}
      : {
          modFolderPath: validateRelativePath(
            manifest.modFolderPath,
            `${manifestPath} modFolderPath`,
          ),
        }),
  };
}

function loadGameConfigs(
  platform: MockTreePlatform = mockTreePlatformFromNodePlatform(),
): Record<string, GameConfig> {
  const configs: Record<string, GameConfig> = {};
  const fixtureDirs = fs
    .readdirSync(TREES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((lhs, rhs) => lhs.localeCompare(rhs));

  for (const fixtureDir of fixtureDirs) {
    const rootDir = path.join(TREES_ROOT, fixtureDir);
    if (!fs.existsSync(path.join(rootDir, "config.json"))) continue;
    configs[fixtureDir] = loadGameConfig(fixtureDir, rootDir, platform);
  }

  return configs;
}

export const GAME_CONFIGS: Readonly<Record<string, GameConfig>> = loadGameConfigs();

export function getGameConfig(configKey: string): GameConfig {
  const config = GAME_CONFIGS[configKey];
  if (config === undefined) throw new Error(`Unknown game config: ${configKey}`);
  return config;
}

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
      writeFakeExecutable(fixturePathToNative(gamePath, entry.path));
    }
  }
}

function assertRequiredFiles(gamePath: string, gameConfig: GameConfig): void {
  const missing = gameConfig.requiredFiles.filter(
    (filePath) => !fs.existsSync(fixturePathToNative(gamePath, filePath)),
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

  const { entries, filesDirs } = readMockTreeFixture(gameConfig.tree);
  writeMockTree(gamePath, entries, { filesDirs });
  postProcessTreeExecutables(gamePath, entries);
  assertRequiredFiles(gamePath, gameConfig);

  if (gameConfig.externalTrees) {
    for (const tree of gameConfig.externalTrees) {
      const externalTree = readMockTreeFixture(tree.tree);
      writeMockTree(resolveExternalBase(tree.base, options), externalTree.entries, {
        filesDirs: externalTree.filesDirs,
      });
    }
  }

  return gamePath;
}

/** Creates a temp directory with a fake game installation. Returns both paths for cleanup. */
export function setupFakeGame(configKey: string): {
  basePath: string;
  gamePath: string;
};
export function setupFakeGame(
  configKey: string,
  options: SetupFakeGameOptions,
): {
  basePath: string;
  gamePath: string;
};
export function setupFakeGame(
  configKey: string,
  options: SetupFakeGameOptions = {},
): {
  basePath: string;
  gamePath: string;
} {
  const config = getGameConfig(configKey);

  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-games-"));
  const gamePath = createFakeGameInstallation(config, basePath, options);
  return { basePath, gamePath };
}

/** Removes a fake game installation directory. */
export function cleanupFakeGame(basePath: string): void {
  fs.rmSync(basePath, { recursive: true, force: true });
}
