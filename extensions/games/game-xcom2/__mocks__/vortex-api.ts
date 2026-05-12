import * as path from "node:path";

import { vi } from "vitest";

export const fs = {
  ensureDirWritableAsync: vi.fn(() => Promise.resolve()),
  ensureDirAsync: vi.fn(() => Promise.resolve()),
  readdirAsync: vi.fn(() => Promise.resolve([])),
  statAsync: vi.fn(() => Promise.resolve({ isDirectory: () => true })),
  readFileAsync: vi.fn(() => Promise.resolve("")),
  writeFileAsync: vi.fn(() => Promise.resolve()),
};

export const log = vi.fn();

export class ProcessCanceled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessCanceled";
  }
}

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataInvalid";
  }
}

// Hand-mirrored from src/renderer/src/types/IHealthCheck.ts. Kept here so the
// diagnostic.ts file can construct health-check objects in tests without
// dragging the renderer's type graph into the mock.
const HealthCheckCategory = {
  Mods: "mods",
  Game: "game",
  Vortex: "vortex",
  Other: "other",
} as const;

const HealthCheckSeverity = {
  Info: "info",
  Warning: "warning",
  Error: "error",
  Critical: "critical",
} as const;

const HealthCheckTrigger = {
  ModsChanged: "mods-changed",
  GameLaunched: "game-launched",
  Manual: "manual",
  Startup: "startup",
} as const;

// Hand-mirror of buildCopyInstructions / declareInstallers from
// src/renderer/src/extensions/mod_management/util/installerHelpers.ts. Kept
// inline (rather than importing vortex-api/testing) so the XCOM 2 mock stays
// self-contained alongside the game-specific fs/util shims that the
// extension's tests need (getSafe, GameStoreHelper.findByAppId, getManifest).
type InstallerFilter =
  | { kind: "extensions"; list: readonly string[] }
  | { kind: "regex"; patterns: readonly RegExp[] }
  | { kind: "filename"; names: readonly string[] }
  | { kind: "custom"; predicate: (file: string) => boolean };

function matchesFilter(file: string, filter: InstallerFilter): boolean {
  switch (filter.kind) {
    case "extensions": {
      const lower = file.toLowerCase();
      return filter.list.some((ext) => lower.endsWith(ext.toLowerCase()));
    }
    case "regex":
      return filter.patterns.some((re) => re.test(file));
    case "filename": {
      const names = new Set(filter.names.map((n) => n.toLowerCase()));
      return names.has(path.basename(file).toLowerCase());
    }
    case "custom":
      return filter.predicate(file);
  }
}

function findCommonRootDir(files: readonly string[]): string | undefined {
  if (files.length === 0) return undefined;
  const firstSeg = (p: string): string => p.split(/[\\/]/)[0]!;
  const root = firstSeg(files[0]!);
  if (!root || root === files[0]) return undefined;
  for (const f of files) {
    if (firstSeg(f) !== root) return undefined;
  }
  return root;
}

interface InstallerMatch {
  kind: "extensions" | "regex" | "filename" | "stopPatterns" | "custom";
  list?: readonly string[];
  patterns?: readonly RegExp[];
  names?: readonly string[];
  mode?: "any" | "all";
  predicate?: (files: string[]) => boolean;
}

interface InstallerSpec {
  id: string;
  priority: number;
  modType?: string;
  match: InstallerMatch;
  install: {
    stripCommonRoot: boolean;
    filter?: InstallerFilter;
    flatten?: boolean;
  };
}

function evaluateMatch(match: InstallerMatch, files: readonly string[]): boolean {
  const dataFiles = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
  if (dataFiles.length === 0 && match.kind !== "custom") return false;
  switch (match.kind) {
    case "extensions": {
      const lowerExts = (match.list ?? []).map((e) => e.toLowerCase());
      const test = (f: string) => lowerExts.some((ext) => f.toLowerCase().endsWith(ext));
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "regex": {
      const test = (f: string) => (match.patterns ?? []).some((re) => re.test(f));
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "filename": {
      const names = new Set((match.names ?? []).map((n) => n.toLowerCase()));
      const test = (f: string) => names.has(path.basename(f).toLowerCase());
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "stopPatterns":
      return false; // XCOM 2 tests don't exercise this
    case "custom":
      return match.predicate ? match.predicate([...files]) : false;
  }
}

function buildCopyInstructions(
  files: readonly string[],
  opts: {
    stripCommonRoot: boolean;
    modType?: string;
    filter?: InstallerFilter;
    flatten?: boolean;
  },
) {
  let dataFiles = files.filter((f) => !f.endsWith(path.sep));
  if (opts.filter !== undefined) {
    const filter = opts.filter;
    dataFiles = dataFiles.filter((f) => matchesFilter(f, filter));
  }
  const commonPrefix =
    !opts.flatten && opts.stripCommonRoot ? findCommonRootDir(dataFiles) : undefined;
  const instructions: Array<{ type: string; [key: string]: unknown }> = dataFiles.map((file) => {
    let destination: string;
    if (opts.flatten) destination = path.basename(file);
    else if (commonPrefix) destination = file.substring(commonPrefix.length + 1);
    else destination = file;
    return { type: "copy", source: file, destination };
  });
  if (opts.modType !== undefined) {
    instructions.push({ type: "setmodtype", value: opts.modType });
  }
  return { instructions };
}

interface ContextWithRegister {
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: (
      files: string[],
      gameId: string,
    ) => Promise<{ supported: boolean; requiredFiles: string[] }>,
    install: (files: string[]) => Promise<{
      instructions: Array<{ type: string; [key: string]: unknown }>;
    }>,
  ) => void;
}

function declareInstallers(
  context: ContextWithRegister,
  gameId: string,
  specs: readonly InstallerSpec[],
): void {
  for (const spec of specs) {
    const testSupported = async (files: string[], callerGameId: string) => {
      if (callerGameId !== gameId) return { supported: false, requiredFiles: [] };
      const supported = evaluateMatch(spec.match, files);
      return { supported, requiredFiles: [] };
    };
    const install = async (files: string[]) =>
      buildCopyInstructions(files, {
        stripCommonRoot: spec.install.stripCommonRoot,
        modType: spec.modType,
        filter: spec.install.filter,
        flatten: spec.install.flatten,
      });
    const registrationId = spec.modType ?? `${gameId}-${spec.id}`;
    context.registerInstaller(registrationId, spec.priority, testSupported, install);
  }
}

export const util = {
  getSafe: vi.fn((_state: unknown, _path: string[], fallback: unknown) => fallback),
  GameStoreHelper: {
    findByAppId: vi.fn(() => Promise.resolve({ gamePath: "C:\\Games\\XCOM2" })),
  },
  ProcessCanceled,
  DataInvalid,
  getManifest: vi.fn(() => Promise.resolve({ files: [] })),
  declareInstallers,
  buildCopyInstructions,
};

export const types = {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
};
