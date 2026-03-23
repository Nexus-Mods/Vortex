import {
  test as base,
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Package root (packages/e2e/) — used for resolving node_modules. */
const PACKAGE_ROOT = path.resolve(__dirname, '..');

/** Repo root directory. */
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

// createRequire from the package root so pnpm-linked electron resolves correctly
const require = createRequire(path.join(PACKAGE_ROOT, 'package.json'));

function resolveMainDir(): string {
  return path.resolve(REPO_ROOT, 'src', 'main');
}

function resolveElectronBinary(): string {
  return require('electron') as unknown as string;
}

/**
 * Build a clean env for the Electron process.
 * Removes ELECTRON_RUN_AS_NODE (set by pnpm) and isolates user data.
 */
function buildElectronEnv(userDataDir: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined) {
      env[key] = value;
    }
  }
  env.NODE_ENV = 'development';
  env.ELECTRON_USERDATA = userDataDir;
  env.ELECTRON_APPDATA = path.dirname(userDataDir);
  // Hide windows unless debugging with PWDEBUG
  if (!process.env.PWDEBUG) {
    env.VORTEX_E2E_HEADLESS = '1';
  }
  return env;
}

/**
 * Wait for the main window (index.html) to appear, skipping the splash screen.
 */
async function waitForMainWindow(vortexApp: ElectronApplication): Promise<Page> {
  const isMainWindow = (win: Page): boolean => {
    try {
      return win.url().includes('index.html');
    } catch {
      return false;
    }
  };

  // Check existing windows first
  for (const win of vortexApp.windows()) {
    if (isMainWindow(win)) {
      await win.waitForLoadState('domcontentloaded');
      return win;
    }
  }

  // Wait for the main window via event + polling
  return new Promise<Page>((resolve) => {
    const onWindow = (page: Page) => {
      if (isMainWindow(page)) {
        vortexApp.off('window', onWindow);
        clearInterval(interval);
        resolve(page);
      }
    };
    vortexApp.on('window', onWindow);

    const interval = setInterval(() => {
      for (const win of vortexApp.windows()) {
        if (isMainWindow(win)) {
          clearInterval(interval);
          vortexApp.off('window', onWindow);
          resolve(win);
          return;
        }
      }
    }, 500);

    // CI runners can be slow — allow up to 2 minutes for the main window
    setTimeout(() => {
      clearInterval(interval);
      vortexApp.off('window', onWindow);
      const windows = vortexApp.windows();
      resolve(windows[windows.length - 1]);
    }, 120_000);
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
  sharedUserDataDir: [async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vortex-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }, { scope: 'worker' }],

  sharedVortexApp: [async ({ sharedUserDataDir }, use) => {
    const mainDir = resolveMainDir();
    const electronBinary = resolveElectronBinary();

    const app = await electron.launch({
      executablePath: electronBinary,
      args: [
        mainDir,
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
      env: buildElectronEnv(sharedUserDataDir),
      cwd: mainDir,
      // CI runners are slower — allow up to 2 minutes for cold start
      timeout: 120_000,
    });

    await use(app);
    await app.close().catch(() => {});
  }, { scope: 'worker', timeout: 180_000 }],

  sharedVortexWindow: [async ({ sharedVortexApp }, use) => {
    const mainWindow = await waitForMainWindow(sharedVortexApp);
    await mainWindow.waitForLoadState('domcontentloaded');
    await use(mainWindow);
  }, { scope: 'worker', timeout: 180_000 }],

  // Test-scoped aliases that reference the shared worker fixtures
  vortexApp: async ({ sharedVortexApp }, use) => {
    await use(sharedVortexApp);
  },

  vortexWindow: async ({ sharedVortexWindow }, use) => {
    await use(sharedVortexWindow);
  },
});

export { expect };
