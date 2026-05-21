/**
 * Shared `vortex-api` substitute for test runs. Game extensions and the
 * game-extension-test harness alias `"@nexusmods/vortex-api"` to this module via their
 * vitest configs (`resolve.alias`), giving every extension a consistent stub
 * surface without each one shipping its own `__mocks__/vortex-api.ts`.
 *
 * Drift note: `util.declareInstallers` (and the helpers it relies on) is a
 * hand-mirror of `src/renderer/src/extensions/mod_management/util/installerHelpers.ts`.
 * We can't import the canonical implementation because it transitively pulls
 * in `getGame`, which requires the renderer's redux-singleton initialisation.
 * If you change the canonical helpers, mirror the change here — the nightly
 * game-extension-test run will catch divergence the next time a fixture
 * exercises a code path that drifted.
 */
import * as path from "node:path";

import { vi, type Mock } from "vitest";

// Hand-mirror of the enums in src/renderer/src/types/IHealthCheck.ts. We don't
// import the real ones because cross-package imports drag the renderer's
// tsconfig graph (currently un-clean) into the consumer's typecheck. Drift
// risk is bounded: string values change rarely, and a fixture run against a
// real extension immediately catches a mismatch.
const HealthCheckCategory = {
  System: "system",
  Game: "game",
  Mods: "mods",
  Requirements: "requirements",
  Tools: "tools",
  Performance: "performance",
  Legacy: "legacy",
} as const;
const HealthCheckSeverity = {
  Info: "info",
  Warning: "warning",
  Error: "error",
  Critical: "critical",
} as const;
const HealthCheckTrigger = {
  Manual: "manual",
  Startup: "startup",
  GameChanged: "game-changed",
  ProfileChanged: "profile-changed",
  ModsChanged: "mods-changed",
  ResultsChanged: "health-check-results-changed",
  SettingsChanged: "settings-changed",
  PluginsChanged: "plugins-changed",
  LootUpdated: "loot-updated",
  Scheduled: "scheduled",
} as const;
function isModHealthCheck(hc: { checkMod?: unknown }): boolean {
  return typeof hc.checkMod === "function";
}

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataInvalid";
  }
}

export class ProcessCanceled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessCanceled";
  }
}

/**
 * Module-level mutable resolver. Test runners are sequential per game, so the
 * resolver is safe to mutate between fixtures. If a runner ever parallelises
 * fixtures, replace this with a context-keyed lookup — concurrent fixtures
 * would otherwise read each other's synthetic content.
 */
let readFileResolver: (absPath: string) => Promise<Buffer | string> = async () => Buffer.alloc(0);

export function setReadFileResolver(resolver: (absPath: string) => Promise<Buffer | string>): void {
  readFileResolver = resolver;
}

export const fs: { readFileAsync: Mock } = {
  readFileAsync: vi.fn(
    async (absPath: string, _opts?: unknown): Promise<Buffer | string> => readFileResolver(absPath),
  ),
};

// Minimal mirror of src/renderer/src/util/installerHelpers.ts. See the
// drift-note in the header.
type InstallerMatchMode = "any" | "all";
type InstallerMatch =
  | { kind: "extensions"; list: readonly string[]; mode: InstallerMatchMode }
  | { kind: "regex"; patterns: readonly RegExp[]; mode: InstallerMatchMode }
  | { kind: "filename"; names: readonly string[]; mode: InstallerMatchMode }
  | { kind: "stopPatterns" }
  | { kind: "custom"; predicate: (files: string[]) => boolean };
interface InstallerSpec {
  id: string;
  priority: number;
  modType?: string;
  match: InstallerMatch;
  install: { stripCommonRoot: boolean };
}

function compileStopPatterns(patterns: readonly string[]): RegExp[] {
  return patterns.map((p) => new RegExp(p, "i"));
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

function buildCopyInstructions(
  files: readonly string[],
  opts: { stripCommonRoot: boolean; modType?: string },
): { instructions: Array<{ type: string; [key: string]: unknown }> } {
  const dataFiles = files.filter((f) => !f.endsWith(path.sep));
  const commonPrefix = opts.stripCommonRoot ? findCommonRootDir(dataFiles) : undefined;
  const instructions: Array<{ type: string; [key: string]: unknown }> = dataFiles.map((file) => ({
    type: "copy",
    source: file,
    destination: commonPrefix ? file.substring(commonPrefix.length + 1) : file,
  }));
  if (opts.modType !== undefined) {
    instructions.push({ type: "setmodtype", value: opts.modType });
  }
  return { instructions };
}

function evaluateMatch(
  match: InstallerMatch,
  files: readonly string[],
  stopPatterns: readonly string[] | undefined,
): boolean {
  const dataFiles = files.filter((f) => !f.endsWith(path.sep));
  if (dataFiles.length === 0 && match.kind !== "custom") return false;
  switch (match.kind) {
    case "extensions": {
      const lowerExts = match.list.map((e) => e.toLowerCase());
      const test = (f: string): boolean => lowerExts.some((ext) => f.toLowerCase().endsWith(ext));
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "regex": {
      const test = (f: string): boolean => match.patterns.some((re) => re.test(f));
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "filename": {
      const names = new Set(match.names.map((n) => n.toLowerCase()));
      const test = (f: string): boolean => names.has(path.basename(f).toLowerCase());
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "stopPatterns": {
      if (!stopPatterns?.length) return false;
      const compiled = stopPatterns.map((p) => new RegExp(p, "i"));
      return dataFiles.some((f) => compiled.some((re) => re.test(f)));
    }
    case "custom":
      return match.predicate([...files]);
  }
}

function pickRequiredFile(match: InstallerMatch, files: readonly string[]): string | undefined {
  const dataFiles = files.filter((f) => !f.endsWith(path.sep));
  switch (match.kind) {
    case "extensions": {
      const lowerExts = match.list.map((e) => e.toLowerCase());
      return dataFiles.find((f) => lowerExts.some((ext) => f.toLowerCase().endsWith(ext)));
    }
    case "regex":
      return dataFiles.find((f) => match.patterns.some((re) => re.test(f)));
    case "filename": {
      const names = new Set(match.names.map((n) => n.toLowerCase()));
      return dataFiles.find((f) => names.has(path.basename(f).toLowerCase()));
    }
    case "stopPatterns":
    case "custom":
      return dataFiles[0];
  }
}

interface StubContextWithGame {
  _game?: { details?: { stopPatterns?: readonly string[] } };
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: (
      files: string[],
      gameId: string,
    ) => Promise<{ supported: boolean; requiredFiles: string[] }>,
    install: (
      files: string[],
    ) => Promise<{ instructions: Array<{ type: string; [key: string]: unknown }> }>,
  ) => void;
}

function declareInstallers(
  context: StubContextWithGame,
  gameId: string,
  specs: readonly InstallerSpec[],
): void {
  // The real impl resolves stopPatterns via `getGame(gameId)`; the stub keeps
  // the game on `context._game` (set by the consumer's stub `registerGame`,
  // which is called before `declareInstallers` in any well-formed extension).
  const stopPatterns: readonly string[] | undefined = context._game?.details?.stopPatterns;
  for (const spec of specs) {
    const testSupported = (
      files: string[],
      callerGameId: string,
    ): Promise<{ supported: boolean; requiredFiles: string[] }> => {
      if (callerGameId !== gameId) {
        return Promise.resolve({ supported: false, requiredFiles: [] });
      }
      if (!evaluateMatch(spec.match, files, stopPatterns)) {
        return Promise.resolve({ supported: false, requiredFiles: [] });
      }
      const required = pickRequiredFile(spec.match, files);
      return Promise.resolve({
        supported: true,
        requiredFiles: required !== undefined ? [required] : [],
      });
    };
    const install = (files: string[]) =>
      Promise.resolve(
        buildCopyInstructions(files, {
          stripCommonRoot: spec.install.stripCommonRoot,
          modType: spec.modType,
        }),
      );
    const registrationId = spec.modType ?? `${gameId}-${spec.id}`;
    context.registerInstaller(registrationId, spec.priority, testSupported, install);
  }
}

export const util: {
  DataInvalid: typeof DataInvalid;
  ProcessCanceled: typeof ProcessCanceled;
  SevenZip: new () => object;
  walk: Mock;
  declareInstallers: typeof declareInstallers;
  buildCopyInstructions: typeof buildCopyInstructions;
  compileStopPatterns: typeof compileStopPatterns;
  findCommonRootDir: typeof findCommonRootDir;
} = {
  DataInvalid: DataInvalid,
  ProcessCanceled: ProcessCanceled,
  SevenZip: class {},
  walk: vi.fn(),
  declareInstallers: declareInstallers,
  buildCopyInstructions: buildCopyInstructions,
  compileStopPatterns: compileStopPatterns,
  findCommonRootDir: findCommonRootDir,
};

export const log: Mock = vi.fn();

export const types: {
  HealthCheckCategory: typeof HealthCheckCategory;
  HealthCheckSeverity: typeof HealthCheckSeverity;
  HealthCheckTrigger: typeof HealthCheckTrigger;
  isModHealthCheck: typeof isModHealthCheck;
} = {
  HealthCheckCategory: HealthCheckCategory,
  HealthCheckSeverity: HealthCheckSeverity,
  HealthCheckTrigger: HealthCheckTrigger,
  isModHealthCheck: isModHealthCheck,
};
