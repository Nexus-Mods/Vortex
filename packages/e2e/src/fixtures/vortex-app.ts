import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  test as base,
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { cleanupFakeGame } from "../fixtures/game-setup/fake-game";
import {
  type DiagnosticsTeardown,
  instrumentNexusPage,
  instrumentVortexWindow,
} from "../helpers/diagnostics";
import { manageGame, type ManagedGame } from "../helpers/games";
import { stubRemoteImages } from "../helpers/imageStub";
import { loginToNexus } from "../helpers/login";
import { launchNexusBrowser } from "../helpers/nexusBrowser";
import { Timeouts } from "../helpers/timeouts";
import type { NexusUser } from "../helpers/users";
import {
  cleanupVortexInstance,
  prepareVortexInstance,
  resolveElectronBinary,
  resolveMainDir,
} from "../vortex-instance";

/** Close Electron app; kill process if normal teardown hangs too long. */
async function closeElectronApp(app: ElectronApplication, timeoutMs = 15_000): Promise<void> {
  const proc = app.process();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const closePromise = app
    .close()
    .then(() => true)
    .catch(() => true);
  const timeoutPromise = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  const closed = await Promise.race([closePromise, timeoutPromise]);
  if (timer !== undefined) clearTimeout(timer);
  // Hard-kill works cross-platform via Node ChildProcess.kill().
  if (!closed) proc.kill("SIGKILL");
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
      clearTimeout(timeout);
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

    const interval = setInterval(() => {
      for (const win of vortexApp.windows()) {
        if (isMainWindow(win)) {
          cleanup();
          resolve(win);
          return;
        }
      }
    }, 500);

    const timeout = setTimeout(() => {
      cleanup();
      const windows = vortexApp.windows();
      const lastWindow = windows[windows.length - 1];
      if (lastWindow) {
        resolve(lastWindow);
      } else {
        reject(new Error("Timed out waiting for the Vortex main window to appear."));
      }
    }, Timeouts.LIFECYCLE);

    vortexApp.on("window", onWindow);
    vortexApp.process().on("exit", onExit);
  });
}

/**
 * Wait for the main window to be fully ready: show-window IPC fired, DOM
 * content loaded, YouTube routes blocked, shell.openExternal stubbed.
 *
 * The show-window listener must be registered before waitForMainWindow so it
 * is in place before React mounts the LoadingScreen (which fires the event).
 * Both the snapshot build and the vortexWindow fixture use this sequence.
 */
async function setupMainWindow(app: ElectronApplication, timeoutMs: number): Promise<Page> {
  const showWindowPromise = app.evaluate(
    ({ ipcMain }, ms) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for show-window")), ms);
        ipcMain.once("show-window", () => {
          clearTimeout(timer);
          resolve();
        });
      }),
    timeoutMs,
  );

  const mainWindow = await waitForMainWindow(app);

  await mainWindow.route(/youtube(-nocookie)?\.com|youtu\.be/, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );

  // Serve a single cached empty image instead of fetching mod thumbnails and
  // other remote images from the server (e.g. staticdelivery.nexusmods.com).
  await stubRemoteImages(mainWindow);

  await mainWindow.waitForLoadState("domcontentloaded");
  await showWindowPromise;

  await app.evaluate(({ shell }) => {
    shell.openExternal = () => Promise.resolve();
  });

  return mainWindow;
}

// ---------------------------------------------------------------------------
// Worker-scoped auth snapshot interface
// ---------------------------------------------------------------------------

interface AuthSnapshot {
  /** Path to the read-only Vortex user-data snapshot. Callers must copy before use. */
  snapshotDir: string;
  /**
   * Path to a Playwright storage-state JSON file (Nexus website cookies).
   * Pass to launchNexusBrowser({ storageStatePath }) to get a logged-in browser.
   * Undefined when the OAuth login did not produce a reusable browser context.
   */
  storageStatePath: string | undefined;
}

interface WorkerAuthSnapshots {
  /**
   * Returns the auth snapshot for the given user.
   * Authenticates once per worker per user; subsequent calls return the cached result.
   * testInfo is the triggering test, used to attach diagnostics if the build fails.
   */
  get(user: NexusUser, testInfo: TestInfo): Promise<AuthSnapshot>;
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
  /**
   * Path to a Playwright storage-state JSON file with Nexus website cookies,
   * or undefined when nexusUser is null. Used internally by the nexusPage fixture.
   */
  nexusStorageState: string | undefined;
  /**
   * A logged-in Chromium page pointed at nexusmods.com. Requires nexusUser to be set —
   * the test is skipped automatically when no user is configured.
   * Tracing is started on setup and attached to the test report on teardown.
   */
  nexusPage: Page;
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

/** Launch a Vortex Electron app against the given user-data dir. */
async function launchVortexApp(
  userDataDir: string,
  opts: { timeout: number; inspect?: boolean },
): Promise<ElectronApplication> {
  const { env } = prepareVortexInstance(userDataDir);
  const mainDir = resolveMainDir();
  // When inspecting, open a fixed CDP endpoint so Chrome DevTools MCP can attach
  // on 127.0.0.1:9222 alongside Playwright's own connection. Only one process can
  // own the port, so inspect runs must use --workers=1.
  return electron.launch({
    executablePath: resolveElectronBinary(),
    args: [...(opts.inspect ? ["--remote-debugging-port=9222"] : []), mainDir],
    env,
    cwd: mainDir,
    timeout: opts.timeout,
  });
}

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
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const snapshots = new Map<string, AuthSnapshot>();
      const pending = new Map<string, Promise<AuthSnapshot>>();
      const snapshotDirs: string[] = [];

      const instance: WorkerAuthSnapshots = {
        get(user: NexusUser, testInfo: TestInfo): Promise<AuthSnapshot> {
          const key = user.username;

          const cached = snapshots.get(key);
          if (cached !== undefined) return Promise.resolve(cached);

          const inflight = pending.get(key);
          if (inflight !== undefined) return inflight;

          const buildPromise = (async (): Promise<AuthSnapshot> => {
            const snapshotBase = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-snap-"));
            snapshotDirs.push(snapshotBase);

            const app = await launchVortexApp(snapshotBase, { timeout: Timeouts.SNAPSHOT });
            let teardown: DiagnosticsTeardown | undefined;
            let storageStatePath: string | undefined;
            let failed = false;

            try {
              const window = await setupMainWindow(app, Timeouts.SNAPSHOT);
              teardown = await instrumentVortexWindow(app, window, snapshotBase, "snapshot");
              const loginResult = await loginToNexus(window, user, {
                skipSteps: true,
                keepBrowser: true,
                nexusDiagnostics: { testInfo, prefix: "snapshot-nexus" },
              });
              if (loginResult !== null) {
                // Save the Nexus website session cookies so mods tests can reuse
                // a logged-in browser without repeating the OAuth flow.
                const stateFile = path.join(snapshotBase, "nexus-auth.json");
                await loginResult.page.context().storageState({ path: stateFile });
                await loginResult.browser.close();
                storageStatePath = stateFile;
              }
            } catch (e) {
              // At fixture-setup time testInfo.status is not yet recorded, so the
              // teardown can't infer failure on its own — signal it explicitly.
              failed = true;
              throw e;
            } finally {
              if (teardown !== undefined) await teardown(testInfo, failed);
              // Clean close flushes DuckDB WAL so state.v2 is consistent on disk.
              await closeElectronApp(app);
            }

            const snapshot: AuthSnapshot = { snapshotDir: snapshotBase, storageStatePath };
            snapshots.set(key, snapshot);
            return snapshot;
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
        cleanupVortexInstance(dir);
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

  vortexUserDataDir: async ({ workerAuthSnapshots, nexusUser }, use, testInfo) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-"));

    if (nexusUser !== null) {
      // Copy the snapshot (produced by a clean Electron close, so DuckDB is
      // fully flushed) into the fresh test dir. prepareVortexInstance will then
      // point ELECTRON_USERDATA/ELECTRON_APPDATA at the copied subdirs.
      const { snapshotDir } = await workerAuthSnapshots.get(nexusUser, testInfo);
      fs.cpSync(snapshotDir, dir, { recursive: true });
    }

    await use(dir);
    cleanupVortexInstance(dir);
  },

  vortexApp: async ({ vortexUserDataDir }, use) => {
    const app = await launchVortexApp(vortexUserDataDir, {
      timeout: Timeouts.LIFECYCLE,
      inspect: !!process.env.VORTEX_E2E_INSPECT,
    });
    await use(app);
    await closeElectronApp(app);
  },

  vortexWindow: async ({ vortexApp, vortexUserDataDir }, use, testInfo) => {
    const mainWindow = await setupMainWindow(vortexApp, Timeouts.LIFECYCLE);
    const teardown = await instrumentVortexWindow(vortexApp, mainWindow, vortexUserDataDir, "main");
    await use(mainWindow);
    await teardown(testInfo);
  },

  nexusStorageState: async ({ workerAuthSnapshots, nexusUser }, use, testInfo) => {
    if (nexusUser === null) {
      await use(undefined);
      return;
    }
    const { storageStatePath } = await workerAuthSnapshots.get(nexusUser, testInfo);
    await use(storageStatePath);
  },

  nexusPage: async ({ nexusStorageState }, use, testInfo) => {
    if (nexusStorageState === undefined) {
      testInfo.skip(true, "nexusPage requires a logged-in user — set nexusUser in test.use()");
      return;
    }
    const { page, close } = await launchNexusBrowser({ storageStatePath: nexusStorageState });
    const teardown = await instrumentNexusPage(page, "nexus");
    await use(page);
    await teardown(testInfo);
    await close().catch(() => undefined);
  },

  managedGame: async (
    { vortexWindow, vortexApp }: { vortexWindow: Page; vortexApp: ElectronApplication },
    use: (game: ManagedGame) => Promise<void>,
  ) => {
    const game = await manageGame(vortexWindow, vortexApp, "stardewvalley");
    await use(game);
    cleanupFakeGame(game.basePath);
  },
});

export { expect };
export type { ManagedGame } from "../helpers/games";
export type { NexusUser } from "../helpers/users";
