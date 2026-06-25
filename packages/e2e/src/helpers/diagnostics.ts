import path from "node:path";

import type { BrowserContext, ElectronApplication, Page, TestInfo } from "@playwright/test";

// A BrowserContext supports only one active trace; tracing.start() throws if a
// trace is already running. Track the contexts we have started so re-instrumenting
// the same context (worker reuse, overlapping helpers) is a safe no-op rather than
// a crash, and a failed stop can't leave a context wedged as "started".
const tracedContexts = new WeakSet<BrowserContext>();

/**
 * Teardown returned by the instrument* helpers. Attaches the trace always, and
 * failure diagnostics (screenshot, logs) when `failed` is true or the test's
 * recorded status already diverges from its expected status.
 *
 * Pass `failed` explicitly from fixture-setup callers (e.g. the worker auth
 * snapshot build): at setup time Playwright has not recorded the failure yet,
 * so testInfo.status is not reliable there.
 */
export type DiagnosticsTeardown = (testInfo: TestInfo, failed?: boolean) => Promise<void>;

/** Stops + attaches the trace zip started by startTracing. */
type StopTracing = (testInfo: TestInfo, traceName: string) => Promise<void>;

const shouldDiagnose = (testInfo: TestInfo, failed: boolean): boolean =>
  failed || testInfo.status !== testInfo.expectedStatus;

/**
 * Start tracing on a page's context; returns a fn that stops + attaches the
 * trace zip, or undefined if the context is already being traced (in which case
 * the owner of the original trace is responsible for stopping it).
 */
export async function startTracing(page: Page): Promise<StopTracing | undefined> {
  const context = page.context();
  if (tracedContexts.has(context)) return;
  tracedContexts.add(context);

  // The test runner already starts a base trace on contexts created via
  // @playwright/test's launchers, so record a named chunk within it rather than
  // calling start() (which throws "already started"). Fall back to starting our
  // own trace for contexts the runner does not manage.
  try {
    await context.tracing.startChunk();
  } catch {
    await context.tracing.start({
      snapshots: true,
      screenshots: !!process.env.VORTEX_E2E_HEADED,
      sources: true,
    });
    await context.tracing.startChunk();
  }
  return async (testInfo, traceName) => {
    const tracePath = testInfo.outputPath(traceName);
    await context.tracing.stopChunk({ path: tracePath });
    await testInfo.attach(traceName, { path: tracePath, contentType: "application/zip" });
    tracedContexts.delete(context);
  };
}

/**
 * Instrument a Vortex instance before a window is available: returns a teardown
 * that attaches vortex.log from disk on failure. Requires only the userDataDir,
 * so it is safe to register before launching the Electron process and will still
 * fire if setupMainWindow (or even app launch) throws.
 *
 * All attachment names are prefixed so a single test can hold artifacts from
 * multiple instrumented surfaces without name collisions.
 */
export function instrumentVortexInstance(userDataDir: string, prefix: string): DiagnosticsTeardown {
  return async (testInfo, failed = false) => {
    if (shouldDiagnose(testInfo, failed)) {
      const logPath = path.join(userDataDir, "userData", "vortex.log");
      await testInfo.attach(`${prefix}-vortex.log`, { path: logPath }).catch(() => {});
    }
  };
}

/**
 * Instrument a Vortex Electron window: start tracing immediately and return a
 * teardown that attaches the trace and, on failure, a screenshot. Log attachment
 * is handled separately by instrumentVortexInstance, which must always be called
 * alongside this one.
 *
 * All attachment names are prefixed so a single test can hold artifacts from
 * multiple instrumented surfaces (snapshot build, its own window, the nexus
 * browser) without name collisions.
 */
export async function instrumentVortexWindow(
  app: ElectronApplication,
  window: Page,
  prefix: string,
): Promise<DiagnosticsTeardown> {
  const stopTracing = await startTracing(window);
  return async (testInfo, failed = false) => {
    await stopTracing?.(testInfo, `${prefix}-trace.zip`).catch((e) =>
      console.error("Failed to stop tracing:", e),
    );
    if (shouldDiagnose(testInfo, failed)) {
      // capturePage() reads directly from the renderer and works while the window is
      // hidden (VORTEX_E2E_HEADLESS=1); page.screenshot() would hang waiting for a
      // compositor frame that a hidden BrowserWindow never produces.
      const base64 = await app
        .evaluate(async ({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes("index.html"),
          );
          if (!win) return null;
          return (await win.webContents.capturePage()).toPNG().toBase64();
        })
        .catch(() => null);
      if (base64 !== null) {
        await testInfo
          .attach(`${prefix}-screenshot.png`, {
            body: Buffer.from(base64, "base64"),
            contentType: "image/png",
          })
          .catch(() => {});
      }
    }
  };
}

/**
 * Instrument a Chromium page (e.g. the nexusmods.com login/browser surface):
 * start tracing immediately and return a teardown that attaches the trace and,
 * on failure, a screenshot. Names are prefixed (see instrumentVortexWindow).
 */
export async function instrumentNexusPage(
  page: Page,
  prefix: string,
): Promise<DiagnosticsTeardown> {
  const stopTracing = await startTracing(page);
  return async (testInfo, failed = false) => {
    await stopTracing?.(testInfo, `${prefix}-trace.zip`).catch((e) =>
      console.error("Failed to stop tracing:", e),
    );
    if (shouldDiagnose(testInfo, failed)) {
      const buffer = await page.screenshot({ fullPage: true }).catch(() => null);
      if (buffer !== null) {
        await testInfo
          .attach(`${prefix}-screenshot.png`, { body: buffer, contentType: "image/png" })
          .catch(() => {});
      }
    }
  };
}
