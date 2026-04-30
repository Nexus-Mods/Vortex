import {
  test as base,
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

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

function safeRemoveDir(dir: string): void {
  try {
    fs.rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch {
    // Best-effort cleanup: Windows can keep file handles briefly.
  }
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
  const appDataDir = path.join(userDataDir, "appData");
  const userDataSubDir = path.join(userDataDir, "userData");
  const appNameDir = path.join(appDataDir, "@vortex", "main");
  fs.mkdirSync(appNameDir, { recursive: true });
  fs.mkdirSync(userDataSubDir, { recursive: true });
  env.ELECTRON_USERDATA = userDataSubDir;
  env.ELECTRON_APPDATA = appDataDir;
  env.VORTEX_E2E = "1";
  if (!process.env.PWDEBUG) {
    env.VORTEX_E2E_HEADLESS = "1";
  }
  return env;
}

/**
 * Wait for the main window (index.html) to appear, skipping the splash screen.
 */
async function waitForMainWindow(
  vortexApp: ElectronApplication,
): Promise<Page> {
  const isMainWindow = (win: Page): boolean => {
    try {
      return win.url().includes("index.html");
    } catch {
      return false;
    }
  };

  for (const win of vortexApp.windows()) {
    if (isMainWindow(win)) {
      await win.waitForLoadState("domcontentloaded");
      return win;
    }
  }

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
        reject(
          new Error("Timed out waiting for the Vortex main window to appear."),
        );
      }
    }, 120_000);
  });
}

export type VortexTestFixtures = {
  /** Fresh Electron app instance per test. */
  vortexApp: ElectronApplication;
  /** Main Vortex window for that test instance. */
  vortexWindow: Page;
};

/**
 * Playwright test with isolated Vortex fixtures.
 *
 * Launches a fresh Electron app + user data directory for every test,
 * ensuring no state leaks between tests.
 */
export const test = base.extend<VortexTestFixtures>({
  vortexApp: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-"));
    const mainDir = resolveMainDir();
    const electronBinary = resolveElectronBinary();

    const app = await electron.launch({
      executablePath: electronBinary,
      args: [mainDir, "--disable-gpu", "--disable-software-rasterizer"],
      env: buildElectronEnv(userDataDir),
      cwd: mainDir,
      timeout: 120_000,
    });

    try {
      await use(app);
    } finally {
      await app.close().catch(() => {});
      safeRemoveDir(userDataDir);
    }
  },

  vortexWindow: async ({ vortexApp }, use) => {
    const mainWindow = await waitForMainWindow(vortexApp);
    await mainWindow.waitForLoadState("domcontentloaded");

    try {
      await mainWindow.locator("body").first().waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await use(mainWindow);
      return;
    } catch (error) {
      if (!mainWindow.isClosed()) {
        throw error;
      }
    }

    const recoveredWindow = await waitForMainWindow(vortexApp);
    await recoveredWindow.waitForLoadState("domcontentloaded");
    await recoveredWindow.locator("body").first().waitFor({
      state: "visible",
      timeout: 60_000,
    });

    await use(recoveredWindow);
  },
});

export { expect };
