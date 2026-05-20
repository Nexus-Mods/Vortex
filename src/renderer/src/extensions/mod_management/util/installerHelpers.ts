import * as path from "path";

import type { IExtensionContext } from "../../../types/IExtensionContext";
import { getGame } from "../../gamemode_management/util/getGame";
import type { IInstallerMatch, IInstallerSpec } from "../types/IInstallerSpec";
import type { IInstallResult, IInstruction } from "../types/IInstallResult";
import type { TestSupported } from "../types/TestSupported";

/**
 * Returns the single top-level directory that contains every entry in `files`,
 * or `undefined` if files live at the root or under different top-level dirs.
 * Entries may use either `/` or `\` separators; both are recognised.
 */
export function findCommonRootDir(files: readonly string[]): string | undefined {
  if (files.length === 0) return undefined;
  const firstSeg = (p: string): string => p.split(/[\\/]/)[0]!;
  const root = firstSeg(files[0]!);
  // A bare filename has no separator → no wrapping dir to strip.
  if (!root || root === files[0]) return undefined;
  for (const f of files) {
    if (firstSeg(f) !== root) return undefined;
  }
  return root;
}

/**
 * Build a `copy` instruction for every non-directory entry. When
 * `stripCommonRoot` is true and the archive wraps everything in a single
 * top-level dir, that dir is stripped from destination paths so the mod stages
 * at game root rather than inside the wrapper. Appends a `setmodtype`
 * instruction when `modType` is provided.
 */
export function buildCopyInstructions(
  files: readonly string[],
  opts: { stripCommonRoot: boolean; modType?: string },
): IInstallResult {
  const dataFiles = files.filter((f) => !f.endsWith(path.sep));
  const commonPrefix = opts.stripCommonRoot ? findCommonRootDir(dataFiles) : undefined;

  const instructions: IInstruction[] = dataFiles.map((file) => ({
    type: "copy" as const,
    source: file,
    destination: commonPrefix ? file.substring(commonPrefix.length + 1) : file,
  }));
  if (opts.modType !== undefined) {
    instructions.push({ type: "setmodtype" as const, value: opts.modType });
  }
  return { instructions };
}

/**
 * Compile string stopPatterns (typically taken from `IGame.details.stopPatterns`)
 * to case-insensitive RegExp objects.
 */
export function compileStopPatterns(patterns: readonly string[]): RegExp[] {
  return patterns.map((p) => new RegExp(p, "i"));
}

/**
 * True if any entry in `files` matches any of the active game's
 * `details.stopPatterns`. Looks up the game via `getGame(gameId)`; returns
 * false if the game has no stopPatterns or isn't registered.
 */
export function matchesAnyStopPattern(files: readonly string[], gameId: string): boolean {
  let patterns: readonly string[] | undefined;
  try {
    patterns = getGame(gameId)?.details?.stopPatterns;
  } catch {
    return false;
  }
  if (patterns === undefined || patterns.length === 0) return false;
  const compiled = compileStopPatterns(patterns);
  return files.some((f) => compiled.some((re) => re.test(f)));
}

function evaluateMatch(match: IInstallerMatch, files: readonly string[], gameId: string): boolean {
  const dataFiles = files.filter((f) => !f.endsWith(path.sep));
  if (dataFiles.length === 0 && match.kind !== "custom") return false;

  switch (match.kind) {
    case "extensions": {
      const lower = (f: string): string => f.toLowerCase();
      const lowerExts = match.list.map((e) => e.toLowerCase());
      const test = (f: string): boolean => lowerExts.some((ext) => lower(f).endsWith(ext));
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
    case "stopPatterns":
      return matchesAnyStopPattern(dataFiles, gameId);
    case "custom":
      // Custom predicates receive the raw file list (directory entries
      // included) so they can inspect archive shape if needed. Other match
      // kinds operate on `dataFiles` because they only meaningfully apply to
      // non-directory paths.
      return match.predicate([...files]);
  }
}

function pickRequiredFile(match: IInstallerMatch, files: readonly string[]): string | undefined {
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

/**
 * Build a `(testSupported, install)` pair from a spec. Exposed primarily so
 * callers can wire the pair into `context.registerInstaller` directly without
 * the loop in `declareInstallers` — useful when a game wants to mix
 * spec-driven installers with hand-written ones at custom priorities.
 */
export function makeInstallerFromSpec(
  spec: IInstallerSpec,
  gameId: string,
): { testSupported: TestSupported; install: (files: string[]) => Promise<IInstallResult> } {
  const testSupported: TestSupported = (files, callerGameId) => {
    if (callerGameId !== gameId) {
      return Promise.resolve({ supported: false, requiredFiles: [] });
    }
    const supported = evaluateMatch(spec.match, files, gameId);
    if (!supported) {
      return Promise.resolve({ supported: false, requiredFiles: [] });
    }
    const required = pickRequiredFile(spec.match, files);
    return Promise.resolve({
      supported: true,
      requiredFiles: required !== undefined ? [required] : [],
    });
  };

  const install = (files: string[]): Promise<IInstallResult> =>
    Promise.resolve(
      buildCopyInstructions(files, {
        stripCommonRoot: spec.install.stripCommonRoot,
        modType: spec.modType,
      }),
    );

  return { testSupported, install };
}

/**
 * Register a data-driven installer table for one game. For each spec, builds a
 * `testSupported`/`install` pair from the match + install config and calls
 * `context.registerInstaller`. Registration id defaults to `${gameId}-${spec.id}`
 * when no `modType` is provided.
 */
export function declareInstallers(
  context: IExtensionContext,
  gameId: string,
  specs: readonly IInstallerSpec[],
): void {
  for (const spec of specs) {
    const { testSupported, install } = makeInstallerFromSpec(spec, gameId);
    const registrationId = spec.modType ?? `${gameId}-${spec.id}`;
    context.registerInstaller(registrationId, spec.priority, testSupported, install);
  }
}
