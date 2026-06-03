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
// Test-scoped fixtures: each test gets its own Electron instance and isolated
// user-data directory. Full isolation — no state leaks between tests.
// ---------------------------------------------------------------------------

export type VortexTestFixtures = {
  /** Path to the isolated temp user-data directory for this test. */
  vortexUserDataDir: string;
  /** Electron app instance — one per test. */
  vortexApp: ElectronApplication;
  /** Main Vortex window, past the splash screen — one per test. */
  vortexWindow: Page;
};

/**
 * Playwright test with Vortex fixtures.
 *
 * Each test gets its own Electron process and isolated user-data directory.
 * This guarantees full state isolation — no login state, Redux store, or
 * on-disk data leaks between tests, regardless of worker count.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/vortex-app';
 *   test('my test', async ({ vortexWindow }) => { ... });
 */
export const test = base.extend<VortexTestFixtures>({
  vortexUserDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-"));
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
});

export { expect };
