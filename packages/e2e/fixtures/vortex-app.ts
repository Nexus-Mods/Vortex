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

import { Timeouts } from "../helpers/timeouts";

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
  // Fully isolate each worker — separate userData and appData so parallel
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
// Worker-scoped fixtures: app launches once per worker (shared across tests
// in the same file). This is the fast path for CI.
// ---------------------------------------------------------------------------

type VortexWorkerFixtures = {
  /** Shared Electron app instance — one per worker. */
  sharedVortexApp: ElectronApplication;
  /** Shared main window — one per worker. */
  sharedVortexWindow: Page;
  /** Path to the isolated temp user-data directory. */
  sharedUserDataDir: string;
};

export type VortexTestFixtures = {
  /** Electron app instance (shared per worker for speed). */
  vortexApp: ElectronApplication;
  /** Main Vortex window, past the splash screen (shared per worker). */
  vortexWindow: Page;
};

/**
 * Playwright test with Vortex fixtures.
 *
 * The Electron app is launched once per worker (i.e. once per test file)
 * and reused across all tests in that file. Each worker gets its own
 * isolated temp user-data directory.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/vortex-app';
 *   test('my test', async ({ vortexWindow }) => { ... });
 */
export const test = base.extend<VortexTestFixtures, VortexWorkerFixtures>({
  // Worker-scoped: launches once, shared across all tests in the file
  sharedUserDataDir: [
    async ({}, use) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-"));
      await use(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    },
    { scope: "worker" },
  ],

  sharedVortexApp: [
    async ({ sharedUserDataDir }, use) => {
      const mainDir = resolveMainDir();
      const electronBinary = resolveElectronBinary();

      const app = await electron.launch({
        executablePath: electronBinary,
        args: [mainDir],
        env: buildElectronEnv(sharedUserDataDir),
        cwd: mainDir,
        timeout: Timeouts.LIFECYCLE,
      });

      await use(app);
      await app.close().catch(() => {});
    },
    { scope: "worker", timeout: Timeouts.LIFECYCLE },
  ],

  sharedVortexWindow: [
    async ({ sharedVortexApp }, use) => {
      const mainWindow = await waitForMainWindow(sharedVortexApp);

      // Register before domcontentloaded — show-window fires after React mounts
      // LoadingScreen, which is after dcl, so this listener is always set up first.
      const showWindowPromise = sharedVortexApp.evaluate(
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

      // Block unwanted connections that slow down tests:
      await mainWindow.route(/youtube(-nocookie)?\.com|youtu\.be/, (route) =>
        route.fulfill({ status: 204, body: "" }),
      );

      await mainWindow.waitForLoadState("domcontentloaded");
      await showWindowPromise;

      // Prevent Vortex from handing OAuth (and other external) URLs to the OS
      // default browser. Tests read the OAuth URL from Vortex's in-app field
      // and drive login in their own Playwright Chromium context.
      await sharedVortexApp.evaluate(({ shell }) => {
        shell.openExternal = async () => undefined;
      });

      await use(mainWindow);
    },
    { scope: "worker", timeout: Timeouts.LIFECYCLE },
  ],

  // Test-scoped aliases that reference the shared worker fixtures
  vortexApp: async ({ sharedVortexApp }, use) => {
    await use(sharedVortexApp);
  },

  vortexWindow: async (
    { sharedVortexApp, sharedVortexWindow, sharedUserDataDir },
    use,
    testInfo,
  ) => {
    await use(sharedVortexWindow);
    if (testInfo.status !== testInfo.expectedStatus) {
      const logPath = path.join(sharedUserDataDir, "userData", "vortex.log");
      await testInfo.attach("vortex.log", { path: logPath }).catch(() => {});

      // Use Electron's webContents.capturePage() instead of page.screenshot().
      // The e2e build runs with VORTEX_E2E_HEADLESS=1, which prevents the
      // BrowserWindow from being shown — hidden windows don't produce
      // compositor frames, so page.screenshot() hangs waiting for one.
      // capturePage() reads directly from the renderer and works while hidden.
      await sharedVortexApp
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
});

export { expect };
