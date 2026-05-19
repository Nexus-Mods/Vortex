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
  registerGame: (game: IHarnessGame) => void;
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: HarnessTestSupported,
    install: HarnessInstall,
  ) => void;
  once: (cb: () => void) => void;
  api: Record<string, unknown>;
  [hook: string]: unknown;
}

export async function loadExtension(extensionDir: string): Promise<ILoadedExtension> {
  const stubContext = makeStubContext();
  const indexPath = path.join(extensionDir, "src", "index.ts");
  const mod = await import(indexPath);
  const init = mod.default ?? mod.init;
  if (typeof init !== "function") {
    throw new Error(`Extension ${extensionDir} has no default export`);
  }
  init(stubContext);

  if (stubContext._installers.length === 0) {
    // No custom installer registered. Provide a default copy-all installer
    // that mirrors Vortex's built-in behavior: accept everything, copy every
    // non-directory entry to its relative path. This covers game extensions
    // that rely on external mod-type extensions (e.g. modtype-umm) for
    // installation, which the harness cannot load as co-dependencies.
    stubContext._installers.push({
      id: "default-copy",
      priority: 1000,
      testSupported: (_files, _gameId) => Promise.resolve({ supported: true, requiredFiles: [] }),
      install: (files) => {
        const instructions = files
          .filter((f) => !f.endsWith("/") && !f.endsWith("\\") && !f.endsWith(path.sep))
          .map((f) => ({ type: "copy" as const, source: f, destination: f }));
        return Promise.resolve({ instructions });
      },
    });
  }
  if (!stubContext._game) {
    throw new Error(`Extension ${extensionDir} did not call registerGame`);
  }

  const descriptorMod = (await import(path.join(extensionDir, "src", "test-descriptor.ts"))) as {
    testDescriptor?: IGameExtensionTestDescriptor;
  };

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

  if (!descriptorMod.testDescriptor) {
    throw new Error(
      `Extension ${extensionDir} does not export a testDescriptor ` +
        `(expected at src/test-descriptor.ts: export const testDescriptor = ...). ` +
        `The harness can't drive fixtures without one.`,
    );
  }

  const healthChecks = resolveHealthChecks(diagnosticMod);
  if (healthChecks.length === 0) {
    throw new Error(
      `Extension ${extensionDir} exports testDescriptor but has no health checks ` +
        `(expected at src/diagnostic.ts: export const healthChecks = [...] ` +
        `with at least one IModHealthCheck). ` +
        `Without a healthcheck the harness would silently pass every fixture.`,
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
    registerGame(game) {
      base._game = game;
    },
    registerInstaller(id, priority, testSupported, install) {
      base._installers.push({ id, priority, testSupported, install });
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
      if (typeof prop === "string" && (prop.startsWith("register") || prop.startsWith("require"))) {
        return () => {
          /* unknown register/require hook — silently accepted */
        };
      }
      return undefined;
    },
  });
}
