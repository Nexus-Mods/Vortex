import { existsSync } from "node:fs";
import * as path from "node:path";

import type { IGameExtensionTestDescriptor, IModCheckContext } from "./types";

/**
 * Subset of Vortex's `TestSupported` signature relevant to the harness — we
 * only ever call it with `(files, gameId)`. The renderer's full type accepts
 * an optional `details` arg that no test driver passes.
 */
export type HarnessTestSupported = (
  files: string[],
  gameId: string,
) => Promise<{ supported: boolean; requiredFiles: string[] }>;

/**
 * Subset of Vortex's `InstallFunc` signature relevant to the harness. The
 * production type takes 8 positional args (destination, gameId, progress, etc.)
 * — we forward them all but only consume `{ instructions }` from the result.
 */
export type HarnessInstall = (
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: (perc: number) => void,
  choices: unknown,
  unattended: boolean,
  archivePath: string | undefined,
  archiveOptions: Record<string, unknown>,
) => Promise<{ instructions: Array<{ type: string; [key: string]: unknown }> }>;

export interface IInstallerEntry {
  id: string;
  priority: number;
  testSupported: HarnessTestSupported;
  install: HarnessInstall;
}

/**
 * Per-mod healthcheck shape consumed by `runFixture`. Structural — kept local
 * so the harness doesn't need a runtime dep on `vortex-api`. Mirrors
 * `IModHealthCheck` from `src/renderer/src/types/IHealthCheck.ts`.
 */
export interface IHarnessModHealthCheck {
  id: string;
  checkMod: (
    api: unknown,
    modCtx: IModCheckContext,
  ) => Promise<{
    status: "passed" | "failed" | "warning" | "error";
    severity: string;
    message: string;
    details?: string;
  }>;
}

/** Minimal shape of the `IGame` object the extension passes to `registerGame`. */
export interface IHarnessGame {
  id: string;
  name?: string;
  details?: { stopPatterns?: readonly string[]; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Result of loading an extension. `installers` is sorted by ascending priority
 * to mirror Vortex's `InstallManager.getInstaller` dispatch order (lower
 * priority number wins).
 */
export interface ILoadedExtension {
  installers: IInstallerEntry[];
  testDescriptor: IGameExtensionTestDescriptor;
  /** Each IModHealthCheck the extension exports from src/diagnostic.ts. */
  healthChecks: IHarnessModHealthCheck[];
  gameId: string;
  game: IHarnessGame;
}

/**
 * Subset of the renderer's IExtensionContext the harness honors. Everything
 * else is captured by a Proxy as a no-op so an extension calling, say,
 * `context.registerReducer(...)` during init() doesn't crash the loader.
 */
interface IStubContext {
  _installers: IInstallerEntry[];
  _game: IHarnessGame | undefined;
  _healthChecks: IHarnessModHealthCheck[];
  registerGame: (game: IHarnessGame) => void;
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: HarnessTestSupported,
    install: HarnessInstall,
  ) => void;
  registerHealthCheck: (check: IHarnessModHealthCheck) => void;
  once: (cb: () => void) => void;
  api: Record<string, unknown>;
  [hook: string]: unknown;
}

export async function loadExtension(extensionDir: string): Promise<ILoadedExtension> {
  const stubContext = makeStubContext();

  // GDL extensions (those with a game.yaml) have no hand-written src/index.ts;
  // their entry is the bundle produced by `gdl build` (dist/index.js), which
  // registers the game, installers, and health checks against the context.
  // Legacy hand-written extensions load src/index.ts directly.
  const isGdl = existsSync(path.join(extensionDir, "game.yaml"));
  // For GDL extensions, load the generated TS entry (not the webpack bundle):
  // it runs through the harness's module aliases (@nexusmods/vortex-api -> mock,
  // @gdl/runtime -> submodule runtime), whereas the bundled CJS would bypass
  // them and fail to resolve the types-only @nexusmods/vortex-api package.
  const indexPath = isGdl
    ? path.join(extensionDir, ".gdl-out", "extension.ts")
    : path.join(extensionDir, "src", "index.ts");

  if (isGdl && !existsSync(indexPath)) {
    throw new Error(
      `GDL extension ${extensionDir} has a game.yaml but no generated entry at ` +
        `.gdl-out/extension.ts. Run \`gdl build\` (the extension's build script) first.`,
    );
  }

  const mod = await import(indexPath);
  // Resolve the init function across module shapes: ESM default, CommonJS
  // module.exports = fn, and webpack commonjs2's nested { default: fn }.
  const candidates = [mod.default, mod.init, mod, (mod.default as { default?: unknown })?.default];
  const init = candidates.find((c) => typeof c === "function") as
    | ((ctx: unknown) => void)
    | undefined;
  if (typeof init !== "function") {
    throw new Error(`Extension ${extensionDir} has no default export`);
  }
  init(stubContext);

  if (stubContext._installers.length === 0) {
    throw new Error(`Extension ${extensionDir} did not call registerInstaller`);
  }
  if (!stubContext._game) {
    throw new Error(`Extension ${extensionDir} did not call registerGame`);
  }

  const descriptorMod = (await import(path.join(extensionDir, "src", "test-descriptor.ts"))) as {
    testDescriptor?: IGameExtensionTestDescriptor;
  };

  if (!descriptorMod.testDescriptor) {
    throw new Error(
      `Extension ${extensionDir} does not export a testDescriptor ` +
        `(expected at src/test-descriptor.ts: export const testDescriptor = ...). ` +
        `The harness can't drive fixtures without one.`,
    );
  }

  // GDL extensions register their health checks at init() time; legacy
  // extensions export them from src/diagnostic.ts.
  let healthChecks: IHarnessModHealthCheck[];
  if (isGdl) {
    healthChecks = stubContext._healthChecks;
  } else {
    // Tolerate a missing diagnostic.ts (extension hasn't added one yet), but
    // surface any other error so syntax mistakes don't silently become
    // "no health checks registered."
    const diagnosticPath = path.join(extensionDir, "src", "diagnostic.ts");
    let diagnosticMod: { healthChecks?: unknown } = {};
    try {
      diagnosticMod = (await import(diagnosticPath)) as { healthChecks?: unknown };
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") {
        throw err;
      }
    }
    healthChecks = resolveHealthChecks(diagnosticMod);
  }

  if (healthChecks.length === 0) {
    throw new Error(
      `Extension ${extensionDir} exports testDescriptor but has no health checks ` +
        `(GDL: none registered via registerHealthCheck; legacy: none exported from ` +
        `src/diagnostic.ts). Without a healthcheck the harness would silently pass ` +
        `every fixture.`,
    );
  }

  const installers: IInstallerEntry[] = [...stubContext._installers].sort(
    (a, b) => a.priority - b.priority,
  );

  return {
    installers,
    testDescriptor: descriptorMod.testDescriptor,
    healthChecks,
    gameId: stubContext._game.id,
    game: stubContext._game,
  };
}

function resolveHealthChecks(diagnosticMod: { healthChecks?: unknown }): IHarnessModHealthCheck[] {
  if (Array.isArray(diagnosticMod.healthChecks)) {
    return diagnosticMod.healthChecks as IHarnessModHealthCheck[];
  }
  return [];
}

function makeStubContext(): IStubContext {
  const base: IStubContext = {
    _installers: [],
    _game: undefined,
    _healthChecks: [],
    registerGame(game) {
      base._game = game;
    },
    registerInstaller(id, priority, testSupported, install) {
      base._installers.push({ id, priority, testSupported, install });
    },
    registerHealthCheck(check) {
      // GDL extensions register health checks at init() time (rather than
      // exporting them from diagnostic.ts); capture them here.
      base._healthChecks.push(check);
    },
    once(_cb) {
      /* deferred init not exercised in tests */
    },
    api: {},
  };
  return new Proxy(base, {
    get(target, prop, receiver) {
      const known = Reflect.get(target, prop, receiver);
      if (known !== undefined) return known;
      if (typeof prop === "string" && prop.startsWith("register")) {
        return () => {
          /* unknown register hook — silently accepted */
        };
      }
      return undefined;
    },
  });
}
