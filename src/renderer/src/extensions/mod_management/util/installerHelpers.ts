import * as path from "path";

import type { IExtensionContext } from "../../../types/IExtensionContext";
import { getGame } from "../../gamemode_management/util/getGame";
import type { IInstallerFilter, IInstallerMatch, IInstallerSpec } from "../types/IInstallerSpec";
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
 * True if `file` matches the per-file `filter`. Each kind uses the same
 * comparison as the matching `IInstallerMatch` kind but operates on a single
 * file (no `any`/`all` mode), since filtering selects files, not archives.
 */
function matchesFilter(file: string, filter: IInstallerFilter): boolean {
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

/**
 * Build a `copy` instruction for every non-directory entry that survives the
 * optional `filter`. Destination paths are chosen in this order of precedence:
 *
 *   1. `flatten: true` → `destination = basename(source)`. Targets that read
 *      a directory non-recursively (importable folders) want flat output.
 *   2. `stripCommonRoot: true` → if every (post-filter) file shares a single
 *      top-level dir, that wrapper is stripped from destinations so the mod
 *      stages at game root.
 *   3. Otherwise → `destination = source`.
 *
 * `setmodtype` is appended when `modType` is provided, even if the filter
 * removed every file (consumers detect the empty-files case via health
 * checks).
 */
export function buildCopyInstructions(
  files: readonly string[],
  opts: {
    stripCommonRoot: boolean;
    modType?: string;
    filter?: IInstallerFilter;
    flatten?: boolean;
  },
): IInstallResult {
  let dataFiles = files.filter((f) => !f.endsWith(path.sep));
  if (opts.filter !== undefined) {
    const filter = opts.filter;
    dataFiles = dataFiles.filter((f) => matchesFilter(f, filter));
  }
  const commonPrefix =
    !opts.flatten && opts.stripCommonRoot ? findCommonRootDir(dataFiles) : undefined;

  const instructions: IInstruction[] = dataFiles.map((file) => {
    let destination: string;
    if (opts.flatten) {
      destination = path.basename(file);
    } else if (commonPrefix) {
      destination = file.substring(commonPrefix.length + 1);
    } else {
      destination = file;
    }
    return { type: "copy" as const, source: file, destination };
  });
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
        filter: spec.install.filter,
        flatten: spec.install.flatten,
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
