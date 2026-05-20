/**
 * Content-type installers for Pathfinder: Kingmaker.
 *
 * Priority order (lower number = checked first):
 *   15 — UMM tool installer (from @vortex/game-extension-helpers)
 *   25 — Portrait installer (detects Small/Medium/Fulllength.png)
 *   30 — Save game installer (detects .zks files)
 *  200 — Default copy-all (catch-all for regular UMM mods)
 */
import * as path from "path";

import type { types } from "vortex-api";

/** Canonical portrait filenames the game expects in each portrait subfolder. */
const PORTRAIT_FILES = new Set(["small.png", "medium.png", "fulllength.png"]);

/** Save file extension used by Pathfinder: Kingmaker. */
const SAVE_EXT = ".zks";

/** Owlcat LocalLow subdirectory for this game. */
const OWLCAT_GAME_DIR = "Pathfinder Kingmaker";

export const MOD_TYPES = {
  portrait: "pfk-portrait",
  save: "pfk-save",
} as const;

// ── Portrait installer ───────────────────────────────────────────────

function isPortraitFile(filePath: string): boolean {
  return PORTRAIT_FILES.has(path.basename(filePath).toLowerCase());
}

export function testPortrait(
  files: string[],
  gameId: string,
  supportedIds: ReadonlySet<string>,
): Promise<types.ISupportedResult> {
  if (!supportedIds.has(gameId)) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const dataFiles = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
  const supported = dataFiles.some(isPortraitFile);
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installPortrait(files: string[]): Promise<types.IInstallResult> {
  // Only canonical portrait images are copied; non-portrait files (readmes, etc.) are
  // intentionally dropped so the game's Portraits directory stays clean.
  const portraits = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\") && isPortraitFile(f));
  const instructions: types.IInstruction[] = portraits.map((f) => ({
    type: "copy" as const,
    source: f,
    destination: f,
  }));
  instructions.push({ type: "setmodtype", value: MOD_TYPES.portrait });
  return Promise.resolve({ instructions });
}

// ── Save game installer ──────────────────────────────────────────────

function isSaveFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === SAVE_EXT;
}

export function testSave(
  files: string[],
  gameId: string,
  supportedIds: ReadonlySet<string>,
): Promise<types.ISupportedResult> {
  if (!supportedIds.has(gameId)) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const dataFiles = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
  const supported = dataFiles.some(isSaveFile);
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installSave(files: string[]): Promise<types.IInstallResult> {
  const saves = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\") && isSaveFile(f));
  const instructions: types.IInstruction[] = saves.map((f) => ({
    type: "copy" as const,
    source: f,
    destination: path.basename(f),
  }));
  instructions.push({ type: "setmodtype", value: MOD_TYPES.save });
  return Promise.resolve({ instructions });
}

// ── Mod type path resolvers ──────────────────────────────────────────

/**
 * Resolve the Portraits directory under the game's LocalLow data folder.
 * Path: `%LOCALAPPDATA%Low/Owlcat Games/Pathfinder Kingmaker/Portraits`
 */
export function getPortraitPath(getVortexPath: (key: string) => string): string {
  // Construct LocalLow from appData (Roaming) by going up one level.
  const appData = getVortexPath("appData");
  const localLow = path.resolve(appData, "..", "LocalLow");
  return path.join(localLow, "Owlcat Games", OWLCAT_GAME_DIR, "Portraits");
}

/**
 * Resolve the Saved Games directory under the game's LocalLow data folder.
 * Path: `%LOCALAPPDATA%Low/Owlcat Games/Pathfinder Kingmaker/Saved Games`
 */
export function getSavePath(getVortexPath: (key: string) => string): string {
  // Construct LocalLow from appData (Roaming) by going up one level.
  const appData = getVortexPath("appData");
  const localLow = path.resolve(appData, "..", "LocalLow");
  return path.join(localLow, "Owlcat Games", OWLCAT_GAME_DIR, "Saved Games");
}
