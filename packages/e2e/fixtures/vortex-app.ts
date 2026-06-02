import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  test as base,
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

import { cleanupFakeGame } from "../fixtures/game-setup/fake-game";
import { manageGame, type ManagedGame } from "../helpers/games";
import { loginToNexus } from "../helpers/login";
import { Timeouts } from "../helpers/timeouts";
import type { NexusUser } from "../helpers/users";

/** Package root (packages/e2e/) — used for resolving node_modules. */
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");

/** Repo root directory. */
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");

// createRequire from the package root so pnpm-linked electron resolves correctly
const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));

function resolveMainDir(): string {
  return path.resolve(REPO_ROOT, "src", "main");
}

function resolveElectronBinary(): string {
  return require("electron") as unknown as string;
}

/**
 * Build a clean env for the Electron process.
 * Removes ELECTRON_RUN_AS_NODE (set by pnpm) and isolates user data.
 */
function buildElectronEnv(userDataDir: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key !== "ELECTRON_RUN_AS_NODE" && value !== undefined) {
      env[key] = value;
    }
  }
  env.NODE_ENV = "development";
  // Fully isolate each test — separate userData and appData so parallel
  // instances share no data at all.
  const appDataDir = path.join(userDataDir, "appData");
  const userDataSubDir = path.join(userDataDir, "userData");
  // Pre-create the app name subdirectory that Vortex expects for startup.json.
  // The app name comes from src/main/package.json ('@vortex/main').
  const appNameDir = path.join(appDataDir, "@vortex", "main");
  fs.mkdirSync(appNameDir, { recursive: true });
  fs.mkdirSync(userDataSubDir, { recursive: true });
  env.ELECTRON_USERDATA = userDataSubDir;
  env.ELECTRON_APPDATA = appDataDir;
  // Always set — disables single-instance lock so parallel workers can run
  env.VORTEX_E2E = "1";
  // Hide windows unless debugging with PWDEBUG
  if (!process.env.PWDEBUG) {
    env.VORTEX_E2E_HEADLESS = "1";
  }
  return env;
}

/**
 * Wait for the main window (index.html) to appear, skipping the splash screen.
 */
async function waitForMainWindow(vortexApp: ElectronApplication): Promise<Page> {
  const isMainWindow = (win: Page): boolean => {
    try {
      return win.url().includes("index.html");
    } catch {
      return false;
    }
  };

  // Check existing windows first
  for (const win of vortexApp.windows()) {
    if (isMainWindow(win)) {
      await win.waitForLoadState("domcontentloaded");
      return win;
    }
  }

  // Wait for the main window via event + polling
  return new Promise<Page>((resolve, reject) => {
    const cleanup = () => {
      clearInterval(interval);
      vortexApp.off("window", onWindow);
      vortexApp.process().off("exit", onExit);
    };

    const onWindow = (page: Page) => {
      if (isMainWindow(page)) {
        cleanup();
        resolve(page);
      }
    };

    // If the Electron process crashes/exits before the main window appears,
    // fail fast instead of waiting for the full timeout.
    const onExit = (code: number | null) => {
      cleanup();
      reject(
        new Error(
          `Vortex process exited unexpectedly with code ${code} before the main window appeared. ` +
            `Check the app logs for 'App threw an error during load' or similar startup errors.`,
        ),
      );
    };

    vortexApp.on("window", onWindow);
    vortexApp.process().on("exit", onExit);

    const interval = setInterval(() => {
      for (const win of vortexApp.windows()) {
        if (isMainWindow(win)) {
          cleanup();
          resolve(win);
          return;
        }
      }
    }, 500);

    setTimeout(() => {
      cleanup();
      const windows = vortexApp.windows();
      const lastWindow = windows[windows.length - 1];
      if (lastWindow) {
        resolve(lastWindow);
      } else {
        reject(new Error("Timed out waiting for the Vortex main window to appear."));
      }
    }, Timeouts.LIFECYCLE);
  });
}

// ---------------------------------------------------------------------------
// Worker-scoped auth snapshot interface
// ---------------------------------------------------------------------------

interface WorkerAuthSnapshots {
  /**
   * Returns the path to a snapshot directory for the given user.
   * Authenticates once per worker per user; subsequent calls return the
   * cached path. The directory is read-only — callers must copy it before use.
   */
  get(user: NexusUser): Promise<string>;
}

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------

export type VortexTestFixtures = {
  /** Path to the isolated temp user-data directory for this test. */
  vortexUserDataDir: string;
  /** Electron app instance — one per test. */
  vortexApp: ElectronApplication;
  /** Main Vortex window, past the splash screen — one per test. */
  vortexWindow: Page;
  /** Managed fake game installation — set up before the test, cleaned up after. */
  managedGame: ManagedGame;
};

export type VortexWorkerFixtures = {
  /** Lazily builds and caches per-role auth snapshots for the lifetime of a worker. */
  workerAuthSnapshots: WorkerAuthSnapshots;
};

export type VortexOptions = {
  /**
   * The Nexus user to authenticate as. When set, vortexUserDataDir is
   * pre-seeded from a worker-scoped snapshot so the app starts logged in.
   * Defaults to null (no login, fresh empty state).
   *
   * Set via test.use({ nexusUser: freeUser }) or test.use({ nexusUser: premiumUser }).
   */
  nexusUser: NexusUser | null;
};

/**
 * Playwright test with Vortex fixtures.
 *
 * Each test gets its own Electron process and isolated user-data directory.
 * This guarantees full state isolation — no login state, Redux store, or
 * on-disk data leaks between tests, regardless of worker count.
 *
 * Role-based login:
 *   import { test, expect } from '../fixtures/vortex-app';
 *   import { freeUser } from '../helpers/users';
 *   test.use({ nexusUser: freeUser });
 *   test('my test', async ({ vortexWindow }) => { ... });
 *
 * Login + managed game:
 *   test.use({ nexusUser: freeUser });
 *   test('my test', async ({ vortexWindow, managedGame }) => { ... });
 *
 * No login (default):
 *   test('my test', async ({ vortexWindow }) => { ... });
 */
export const test = base.extend<VortexTestFixtures & VortexOptions, VortexWorkerFixtures>({
  // ---------------------------------------------------------------------------
  // Worker-scoped: auth snapshot cache
  // ---------------------------------------------------------------------------

  workerAuthSnapshots: [
    async ({}, use) => {
      const snapshots = new Map<string, string>();
      const pending = new Map<string, Promise<string>>();
      const snapshotDirs: string[] = [];

      const instance: WorkerAuthSnapshots = {
        get(user: NexusUser): Promise<string> {
          const key = user.username;

          const cached = snapshots.get(key);
          if (cached !== undefined) return Promise.resolve(cached);

          const inflight = pending.get(key);
          if (inflight !== undefined) return inflight;

          const buildPromise = (async (): Promise<string> => {
            const snapshotBase = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-snap-"));
            snapshotDirs.push(snapshotBase);

            const mainDir = resolveMainDir();
            const electronBinary = resolveElectronBinary();

            const app = await electron.launch({
              executablePath: electronBinary,
              args: [mainDir],
              env: buildElectronEnv(snapshotBase),
              cwd: mainDir,
              timeout: Timeouts.SNAPSHOT,
            });

            try {
              const window = await waitForMainWindow(app);
              await app.evaluate(({ shell }) => {
                shell.openExternal = async () => undefined;
              });
              await loginToNexus(app, window, user, { skipSteps: true });
            } finally {
              // Clean close flushes DuckDB WAL so state.v2 is consistent on disk.
              await app.close().catch(() => {});
            }

            snapshots.set(key, snapshotBase);
            return snapshotBase;
          })();

          // Register before awaiting so concurrent callers share the same promise.
          pending.set(key, buildPromise);

          return buildPromise.finally(() => {
            pending.delete(key);
          });
        },
      };

      await use(instance);

      for (const dir of snapshotDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    { scope: "worker", timeout: Timeouts.SNAPSHOT },
  ],

  // ---------------------------------------------------------------------------
  // Test option: which user role to authenticate as (default: no login)
  // ---------------------------------------------------------------------------

  nexusUser: [null, { option: true }],

  // ---------------------------------------------------------------------------
  // Test-scoped fixtures
  // ---------------------------------------------------------------------------

  vortexUserDataDir: async ({ workerAuthSnapshots, nexusUser }, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-"));

    if (nexusUser !== null) {
      // Copy the snapshot (produced by a clean Electron close, so DuckDB is
      // fully flushed) into the fresh test dir. buildElectronEnv will then
      // point ELECTRON_USERDATA/ELECTRON_APPDATA at the copied subdirs.
      const snapshotBase = await workerAuthSnapshots.get(nexusUser);
      fs.cpSync(snapshotBase, dir, { recursive: true });
    }

    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },

  vortexApp: async ({ vortexUserDataDir }, use) => {
    const mainDir = resolveMainDir();
    const electronBinary = resolveElectronBinary();

    const app = await electron.launch({
      executablePath: electronBinary,
      args: [mainDir],
      env: buildElectronEnv(vortexUserDataDir),
      cwd: mainDir,
      timeout: Timeouts.LIFECYCLE,
    });

    await use(app);
    await app.close().catch(() => {});
  },

  vortexWindow: async ({ vortexApp, vortexUserDataDir }, use, testInfo) => {
    // Register before domcontentloaded — show-window fires after React mounts
    // LoadingScreen, which is after dcl, so this listener is always set up first.
    const showWindowPromise = vortexApp.evaluate(
      ({ ipcMain }, timeoutMs) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Timed out waiting for show-window")),
            timeoutMs,
          );
          ipcMain.once("show-window", () => {
            clearTimeout(timer);
            resolve();
          });
        }),
      Timeouts.LIFECYCLE,
    );

    const mainWindow = await waitForMainWindow(vortexApp);

    // Block unwanted connections that slow down tests:
    await mainWindow.route(/youtube(-nocookie)?\.com|youtu\.be/, (route) =>
      route.fulfill({ status: 204, body: "" }),
    );

    await mainWindow.waitForLoadState("domcontentloaded");
    await showWindowPromise;

    // Prevent Vortex from handing OAuth (and other external) URLs to the OS
    // default browser. Tests read the OAuth URL from Vortex's in-app field
    // and drive login in their own Playwright Chromium context.
    await vortexApp.evaluate(({ shell }) => {
      shell.openExternal = async () => undefined;
    });

    await use(mainWindow);

    if (testInfo.status !== testInfo.expectedStatus) {
      const logPath = path.join(vortexUserDataDir, "userData", "vortex.log");
      await testInfo.attach("vortex.log", { path: logPath }).catch(() => {});

      // Use Electron's webContents.capturePage() instead of page.screenshot().
      // The e2e build runs with VORTEX_E2E_HEADLESS=1, which prevents the
      // BrowserWindow from being shown — hidden windows don't produce
      // compositor frames, so page.screenshot() hangs waiting for one.
      // capturePage() reads directly from the renderer and works while hidden.
      await vortexApp
        .evaluate(async ({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes("index.html"),
          );
          if (!win) return null;
          const image = await win.webContents.capturePage();
          return image.toPNG().toBase64();
        })
        .then((base64) => {
          if (!base64) {
            return Promise.resolve();
          }
          return testInfo.attach("screenshot", {
            body: Buffer.from(base64, "base64"),
            contentType: "image/png",
          });
        })
        .catch((e) => console.error(`Failed to capture screenshot: ${e}`));
    }
  },

  managedGame: async (
    { vortexWindow }: { vortexWindow: Page },
    use: (game: ManagedGame) => Promise<void>,
  ) => {
    const game = await manageGame(vortexWindow, "stardewvalley");
    await use(game);
    cleanupFakeGame(game.basePath);
  },
});

export { expect };
export type { ManagedGame } from "../helpers/games";
export type { NexusUser } from "../helpers/users";
