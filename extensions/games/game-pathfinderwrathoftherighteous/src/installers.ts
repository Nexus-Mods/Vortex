import path from "node:path";

import { util } from "vortex-api";
import type { types } from "vortex-api";

export const WOTR_GAME_ID = "pathfinderwrathoftherighteous";

export const WOTR_MOD_TYPES = {
  ummTool: "wotr-umm-tool",
  ummMod: "wotr-umm-mod",
  portrait: "wotr-portrait",
  owlcatMod: "wotr-owlcat-mod",
} as const;

/**
 * Priority slots. Vortex dispatches lowest number first.
 *
 *   ummTool    (20) — archives containing UnityModManager.exe. Must beat UMM
 *                      mod check because UMM ships its own Info.json.
 *   ummMod     (30) — standard UMM mod: has Info.json.
 *   portrait   (40) — character portrait packs (Small/Medium/Fulllength images).
 *   owlcatMod  (50) — Owlcat template mods (Blueprints/Content/Scripts dirs or
 *                      OwlcatModificationManifest.json).
 *   content    (80) — catch-all for anything else.
 */
const PRIORITIES = {
  ummTool: 20,
  ummMod: 30,
  portrait: 40,
  owlcatMod: 50,
  content: 80,
} as const;

const UMM_EXE = "UnityModManager.exe";

function owlcatAppDataDir(): string {
  return path.resolve(
    util.getVortexPath("appData"),
    "..",
    "LocalLow",
    "Owlcat Games",
    "Pathfinder Wrath Of The Righteous",
  );
}

/** Portrait images accepted by the game engine. */
const PORTRAIT_RE = /(?:^|[\\/])(Small|Medium|Fulllength)\.(png|jpg|jpeg|bmp|gif)$/i;

/** Owlcat template mod markers: directories or manifest file. */
const OWLCAT_MARKERS = /(^|[\\/])(Blueprints|Content|Scripts)([\\/]|$)/i;
const OWLCAT_MANIFEST = "owlcatmodificationmanifest.json";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isDir(f: string): boolean {
  return f.endsWith("/") || f.endsWith("\\");
}

function dataFiles(files: string[]): string[] {
  return files.filter((f) => !isDir(f));
}

function findCommonRoot(files: string[]): string | undefined {
  if (files.length === 0) return undefined;
  const firstSeg = (p: string): string => p.split(/[\\/]/)[0]!;
  const root = firstSeg(files[0]!);
  if (!root || root === files[0]) return undefined;
  for (const f of files) {
    if (firstSeg(f) !== root) return undefined;
  }
  return root;
}

function buildCopy(
  files: string[],
  opts: { stripCommonRoot: boolean; modType?: string },
): types.IInstallResult {
  const data = dataFiles(files);
  const prefix = opts.stripCommonRoot ? findCommonRoot(data) : undefined;
  const instructions: types.IInstruction[] = data.map((file) => ({
    type: "copy" as const,
    source: file,
    destination: prefix ? file.substring(prefix.length + 1) : file,
  }));
  if (opts.modType !== undefined) {
    instructions.push({ type: "setmodtype" as const, value: opts.modType });
  }
  return { instructions };
}

function notThisGame(gameId: string): Promise<types.ISupportedResult> {
  return Promise.resolve({ supported: false, requiredFiles: [] });
}

// ---------------------------------------------------------------------------
// UMM Tool installer (priority 20)
// ---------------------------------------------------------------------------

export function testUmmTool(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== WOTR_GAME_ID) return notThisGame(gameId);
  const supported = files.some((f) => path.basename(f).toLowerCase() === UMM_EXE.toLowerCase());
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installUmmTool(files: string[]): Promise<types.IInstallResult> {
  return Promise.resolve(
    buildCopy(files, { stripCommonRoot: true, modType: WOTR_MOD_TYPES.ummTool }),
  );
}

// ---------------------------------------------------------------------------
// UMM Mod installer (priority 30)
// ---------------------------------------------------------------------------

export function testUmmMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== WOTR_GAME_ID) return notThisGame(gameId);
  const supported = dataFiles(files).some((f) => path.basename(f).toLowerCase() === "info.json");
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installUmmMod(files: string[]): Promise<types.IInstallResult> {
  return Promise.resolve(
    buildCopy(files, { stripCommonRoot: true, modType: WOTR_MOD_TYPES.ummMod }),
  );
}

// ---------------------------------------------------------------------------
// Portrait installer (priority 40)
// ---------------------------------------------------------------------------

export function testPortrait(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== WOTR_GAME_ID) return notThisGame(gameId);
  const supported = dataFiles(files).some((f) => PORTRAIT_RE.test(f));
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installPortrait(files: string[]): Promise<types.IInstallResult> {
  return Promise.resolve(
    buildCopy(files, { stripCommonRoot: true, modType: WOTR_MOD_TYPES.portrait }),
  );
}

// ---------------------------------------------------------------------------
// Owlcat template mod installer (priority 50)
// ---------------------------------------------------------------------------

export function testOwlcatMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== WOTR_GAME_ID) return notThisGame(gameId);
  const supported =
    files.some((f) => OWLCAT_MARKERS.test(f)) ||
    dataFiles(files).some((f) => path.basename(f).toLowerCase() === OWLCAT_MANIFEST);
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installOwlcatMod(files: string[]): Promise<types.IInstallResult> {
  return Promise.resolve(
    buildCopy(files, { stripCommonRoot: true, modType: WOTR_MOD_TYPES.owlcatMod }),
  );
}

// ---------------------------------------------------------------------------
// Mod type path resolvers (for registerModType)
// ---------------------------------------------------------------------------

export function getPortraitPath(): string {
  return path.join(owlcatAppDataDir(), "Portraits");
}

export function getOwlcatModPath(): string {
  return path.join(owlcatAppDataDir(), "Modifications");
}

// ---------------------------------------------------------------------------
// Content catch-all (priority 80) — via declareInstallers
// ---------------------------------------------------------------------------

export const WOTR_INSTALLER_SPECS: types.IInstallerSpec[] = [
  {
    id: "content",
    priority: PRIORITIES.content,
    match: { kind: "custom", predicate: () => true },
    install: { stripCommonRoot: true },
  },
];
