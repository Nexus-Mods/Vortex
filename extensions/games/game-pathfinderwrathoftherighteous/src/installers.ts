import path from "node:path";

import type { types } from "vortex-api";

export const WOTR_GAME_ID = "pathfinderwrathoftherighteous";

export const WOTR_MOD_TYPES = {
  ummTool: "wotr-umm-tool",
  ummMod: "wotr-umm-mod",
} as const;

/**
 * Priority slots. Vortex dispatches lowest number first.
 *
 *   ummTool (20) — archives containing UnityModManager.exe (the tool itself).
 *                   Must beat the UMM mod check because UMM ships its own
 *                   Info.json alongside the exe.
 *   ummMod  (30) — standard UMM mod shape: Info.json at the root (after
 *                   stripping a possible single wrapping directory).
 *   content (80) — catch-all for everything else (portraits, docs, loose
 *                   files). Copies files as-is.
 */
const PRIORITIES = {
  ummTool: 20,
  ummMod: 30,
  content: 80,
} as const;

const UMM_EXE = "UnityModManager.exe";

function isDir(f: string): boolean {
  return f.endsWith("/") || f.endsWith("\\");
}

function dataFiles(files: string[]): string[] {
  return files.filter((f) => !isDir(f));
}

/**
 * Find the single top-level directory wrapping all entries, or undefined if
 * files sit at the root or under multiple top-level directories.
 */
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

// ---------------------------------------------------------------------------
// UMM Tool installer — detects UnityModManager.exe
// ---------------------------------------------------------------------------

function hasUmmExe(files: string[]): boolean {
  return files.some((f) => path.basename(f).toLowerCase() === UMM_EXE.toLowerCase());
}

export function testUmmTool(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== WOTR_GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const supported = hasUmmExe(files);
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installUmmTool(files: string[]): Promise<types.IInstallResult> {
  return Promise.resolve(
    buildCopy(files, { stripCommonRoot: true, modType: WOTR_MOD_TYPES.ummTool }),
  );
}

// ---------------------------------------------------------------------------
// UMM Mod installer — detects Info.json (standard UMM mod descriptor)
// ---------------------------------------------------------------------------

function hasInfoJson(files: string[]): boolean {
  return dataFiles(files).some((f) => path.basename(f).toLowerCase() === "info.json");
}

export function testUmmMod(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== WOTR_GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const supported = hasInfoJson(files);
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installUmmMod(files: string[]): Promise<types.IInstallResult> {
  return Promise.resolve(
    buildCopy(files, { stripCommonRoot: true, modType: WOTR_MOD_TYPES.ummMod }),
  );
}

// ---------------------------------------------------------------------------
// Content installer — catch-all for everything else
// ---------------------------------------------------------------------------

export const WOTR_INSTALLER_SPECS: types.IInstallerSpec[] = [
  {
    id: "content",
    priority: PRIORITIES.content,
    match: {
      kind: "custom",
      predicate: () => true,
    },
    install: { stripCommonRoot: true },
  },
];
