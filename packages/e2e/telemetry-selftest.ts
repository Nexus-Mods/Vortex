/**
 * Manual end-to-end check that Vortex error reporting reaches the collector.
 *
 * Run:  pnpm exec tsx ./telemetry-selftest.ts     (from packages/e2e)
 *
 * Phase 1 launches an isolated instance and turns the analytics opt-in on
 * (persisted), because export is gated on it in both processes.
 * Phase 2 relaunches that instance and provokes, in order:
 *   1. a renderer unhandled exception  -> "error.report" span (process.type=renderer)
 *      and, via the terminal dialog, a crash report subprocess
 *      -> "crash.report" span (crash.sourceProcess=renderer)
 *   2. a main-process unhandled exception -> in-process reportCrash()
 *      -> "crash.report" span (crash.sourceProcess=unknown)
 * Phase 3 relaunches again and provokes errors that cross the IPC boundary, so
 * they go through toWireError -> SerializedVortexError -> deserializeVortexError,
 * which phases 1-2 never touch.
 *
 * Native dialogs are auto-answered with "Report and Quit" and app.exit/quit
 * are neutralised so one run can exercise both processes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { _electron as electron, type ElectronApplication, type Page } from "playwright";

import { neutralizeOsProtocolRegistration } from "./src/helpers/protocolClient";
import {
  cleanupVortexInstance,
  prepareVortexInstance,
  resolveElectronBinary,
  resolveMainDir,
} from "./src/vortex-instance";

const MARKER = process.env.SELFTEST_MARKER ?? `VORTEXSELFTEST${Date.now().toString(36)}`;
const LAUNCH_TIMEOUT = 180_000;
/** Budget for reporting to settle. Measured latency is under a second. */
const SETTLE_MS = 8_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function log(msg: string): void {
  console.log(`[selftest] ${msg}`);
}

async function launch(dir: string): Promise<ElectronApplication> {
  const { env } = prepareVortexInstance(dir);
  const mainDir = resolveMainDir();
  const app = await electron.launch({
    executablePath: resolveElectronBinary(),
    args: ["--disable-gpu", mainDir],
    env,
    cwd: mainDir,
    timeout: LAUNCH_TIMEOUT,
  });
  await neutralizeOsProtocolRegistration(app);
  return app;
}

function isMainWindow(win: Page): boolean {
  try {
    return win.url().includes("index.html");
  } catch {
    return false;
  }
}

async function waitForMainWindow(app: ElectronApplication): Promise<Page> {
  for (const win of app.windows()) {
    if (isMainWindow(win)) return win;
  }
  return new Promise<Page>((resolve, reject) => {
    const timer = setTimeout(() => {
      app.off("window", onWindow);
      reject(new Error("timed out waiting for the main window"));
    }, LAUNCH_TIMEOUT);
    const onWindow = (page: Page): void => {
      if (!isMainWindow(page)) return;
      clearTimeout(timer);
      app.off("window", onWindow);
      resolve(page);
    };
    app.on("window", onWindow);
  });
}

/** Wait until the renderer is past startup, so its global error handler is armed. */
async function waitForUi(win: Page): Promise<void> {
  await win.waitForSelector("#loading-screen", { timeout: LAUNCH_TIMEOUT });
  await win
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .waitFor({ state: "visible", timeout: LAUNCH_TIMEOUT });
}

/**
 * Auto-answer main-process dialogs with "Report and Quit" and stop the app from
 * exiting, so a single run can trigger errors in both processes.
 */
async function stubDialogsAndExit(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app: electronApp, dialog }) => {
    const answered: string[] = [];
    (globalThis as Record<string, unknown>).__selftestDialogs = answered;

    dialog.showMessageBox = ((...args: unknown[]) => {
      const options = (args.length > 1 ? args[1] : args[0]) as Electron.MessageBoxOptions;
      const buttons = options.buttons ?? [];
      // Report when offered, otherwise quit. Never "Show Details" or "Ignore",
      // which would re-show the dialog and skew the count the steps poll on.
      const choice = ["Report and Quit", "Quit"].find((b) => buttons.includes(b));
      const idx = choice === undefined ? 0 : buttons.indexOf(choice);
      // The full button set is the record of whether reporting was offered.
      answered.push(`${options.title ?? "?"} [${buttons.join(" | ")}] -> ${buttons[idx] ?? "?"}`);
      return Promise.resolve({ response: idx, checkboxChecked: false });
    }) as typeof dialog.showMessageBox;

    dialog.showErrorBox = () => undefined;

    const exits: number[] = [];
    (globalThis as Record<string, unknown>).__selftestExits = exits;
    electronApp.exit = ((code?: number) => {
      exits.push(code ?? 0);
    }) as typeof electronApp.exit;
    electronApp.quit = (() => {
      exits.push(-1);
    }) as typeof electronApp.quit;
  });
}

/** The `SerializedVortexError` wire form from src/shared/src/errors/serialization.ts. */
interface WireError {
  message: string;
  data: Record<string, unknown>;
  isTransient: boolean;
}

/**
 * Replace the "example:ping" handler with a raw one returning the IPC error
 * envelope, so the renderer receives whatever `deserializeVortexError` makes of
 * it. Bypasses main's `toWireError` only — the rehydration side is untouched.
 */
async function stubPingWire(app: ElectronApplication, wire: WireError): Promise<void> {
  await app.evaluate(({ ipcMain }, payload) => {
    ipcMain.removeHandler("example:ping");
    ipcMain.handle("example:ping", () => ({ error: payload }));
  }, wire);
}

/** What the renderer actually catches, so stack loss is visible without ClickStack. */
const PROBE = `async (invoke) => {
  try {
    await invoke();
    return { threw: false };
  } catch (e) {
    return {
      threw: true,
      ctor: e?.constructor?.name,
      name: e?.name,
      message: e?.message,
      kind: e?.data?.kind,
      stack: e?.stack,
    };
  }
}`;

async function probePing(win: Page): Promise<unknown> {
  return win.evaluate(`(${PROBE})(() => window.api.example.ping())`) as unknown as Promise<unknown>;
}

/**
 * app:extractFileIcon writes the icon with fs.writeFile, so an icon path under a
 * directory that doesn't exist makes the main-side handler throw a real ENOENT.
 * That exercises main's `toWireError` rather than a hand-crafted envelope.
 */
async function probeExtractIcon(win: Page, iconPath: string): Promise<unknown> {
  return win.evaluate(
    `(${PROBE})(() => window.api.app.extractFileIcon(${JSON.stringify(process.execPath)}, ${JSON.stringify(iconPath)}))`,
  ) as unknown as Promise<unknown>;
}

/**
 * Poll until `probe` holds. Reporting settles in well under a second, so a
 * fixed sleep long enough to be safe wastes most of the run; proving a negative
 * (a case that must NOT terminate) is the only thing that costs the full window.
 *
 * @returns ms waited, or null if it never held.
 */
async function waitFor(probe: () => Promise<boolean>, timeoutMs: number): Promise<number | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probe()) {
      return Date.now() - started;
    }
    await sleep(250);
  }
  return null;
}

/**
 * How many times the app has logged a terminal error. Read from the app's own
 * vortex.log rather than from main's globals: a terminate tears down main's
 * execution context, so any evaluate racing it throws, and the signal we want
 * is already on disk.
 */
function terminateCount(dir: string): number {
  try {
    const text = fs.readFileSync(path.join(dir, "userData", "vortex.log"), "utf8");
    return text.split("unrecoverable error").length - 1;
  } catch {
    return 0;
  }
}

/** Fire the call with no rejection handler, so it reaches the global error handler. */
async function fireUncaught(win: Page, expression: string): Promise<void> {
  await win.evaluate(`setTimeout(() => { ${expression}; }, 0)`);
}

interface StubState {
  dialogs: string[];
  exits: number[];
}

/** Last good snapshot per app, so a transient read can fall back to it. */
const lastStubState = new WeakMap<ElectronApplication, StubState>();

/**
 * Main's execution context is briefly unavailable while a terminate runs, which
 * makes a bare evaluate throw mid-poll. Fall back to the last good snapshot so
 * polling rides through it rather than aborting the run.
 */
async function readStubState(app: ElectronApplication): Promise<StubState> {
  try {
    const state = await app.evaluate(() => ({
      dialogs: ((globalThis as Record<string, unknown>).__selftestDialogs as string[]) ?? [],
      exits: ((globalThis as Record<string, unknown>).__selftestExits as number[]) ?? [],
    }));
    lastStubState.set(app, state);
    return state;
  } catch {
    return lastStubState.get(app) ?? { dialogs: [], exits: [] };
  }
}

/** Electron command lines currently running, so we can see the report subprocess. */
function electronProcesses(): string[] {
  if (process.platform !== "win32") return [];
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='electron.exe'\" | ForEach-Object { $_.CommandLine }",
      ],
      { encoding: "utf8" },
    );
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch (err) {
    return [`<failed to list: ${String(err)}>`];
  }
}

async function main(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-telemetry-selftest-"));
  const dir3 = `${dir}-ipc`;
  log(`marker      : ${MARKER}`);
  log(`instance dir: ${dir}`);
  log(
    `collector   : ${process.env.VORTEX_COLLECTOR_URL ?? "https://vortex-collector.nexusmods.com"}`,
  );

  try {
    // ---- Phase 1: persist the analytics opt-in --------------------------------
    log("phase 1: enabling the analytics opt-in");
    {
      const app = await launch(dir);
      const win = await waitForMainWindow(app);
      await waitForUi(win);
      await win.evaluate(() => {
        (
          window as unknown as {
            api: {
              persist: {
                sendDiff: (
                  hive: string,
                  ops: { type: string; path: string[]; value?: unknown }[],
                ) => void;
              };
            };
          }
        ).api.persist.sendDiff("settings", [
          { type: "set", path: ["analytics", "enabled"], value: true },
        ]);
      });
      await sleep(2_000);
      await app.close().catch(() => undefined);
      log("phase 1: done (state flushed)");
    }

    // Phase 2 ends on SIGKILL, which leaves the state DB locked, so phase 3 gets
    // its own copy of the clean snapshot rather than reusing phase 2's instance.
    fs.cpSync(dir, dir3, { recursive: true });

    // ---- Phase 2: provoke the errors -----------------------------------------
    log("phase 2: relaunching with analytics on");
    const app = await launch(dir);
    await stubDialogsAndExit(app);
    const win = await waitForMainWindow(app);
    await waitForUi(win);

    log("triggering renderer unhandled exception");
    await win.evaluate((marker) => {
      setTimeout(() => {
        throw new Error(`${marker} renderer unhandled exception`);
      }, 0);
    }, MARKER);

    const rendererTerminated = await waitFor(async () => terminateCount(dir) > 0, SETTLE_MS);
    log(`renderer error: terminate logged after ${rendererTerminated ?? "never"}ms`);

    // crashinfo.json is written before the reporter subprocess is spawned and
    // deleted once it has sent, so its disappearance is the delivery signal.
    const crashInfoPath = path.join(dir, "userData", "crashinfo.json");
    const written = await waitFor(async () => fs.existsSync(crashInfoPath), SETTLE_MS);
    const consumed =
      written === null ? null : await waitFor(async () => !fs.existsSync(crashInfoPath), SETTLE_MS);
    log(
      `crash report subprocess: written after ${written ?? "never"}ms, ` +
        `consumed after ${consumed ?? "never"}ms ` +
        `(stragglers: ${JSON.stringify(electronProcesses().filter((c) => c.includes("--report")))})`,
    );

    log("triggering main-process unhandled exception");
    const beforeMain = terminateCount(dir);
    await app.evaluate((_electron, marker) => {
      setTimeout(() => {
        throw new Error(`${marker} main unhandled exception`);
      }, 0);
    }, MARKER);

    const mainTerminated = await waitFor(async () => terminateCount(dir) > beforeMain, SETTLE_MS);
    log(`main error: terminate logged after ${mainTerminated ?? "never"}ms`);
    // The in-process reportCrash awaits forceFlush before returning, but the
    // dialog is answered first, so leave a beat for the export to complete.
    await sleep(2_000);
    log(`after main error: ${JSON.stringify(await readStubState(app))}`);

    app.process().kill("SIGKILL");
    await sleep(2_000);
    log("phase 2: done");

    // ---- Phase 3: errors that cross the IPC boundary --------------------------
    // These go through toWireError -> SerializedVortexError -> deserializeVortexError,
    // the rework that phase 2 never touches (it throws inside each process).
    log("phase 3: relaunching for IPC-crossing errors");
    const app3 = await launch(dir3);
    await stubDialogsAndExit(app3);
    const win3 = await waitForMainWindow(app3);
    await waitForUi(win3);

    const genericWire: WireError = {
      message: `${MARKER} ipc-generic`,
      data: { kind: "data-invalid", field: "selftest" },
      isTransient: false,
    };
    const canceledWire: WireError = {
      message: `${MARKER} ipc-usercanceled`,
      data: { kind: "user-canceled", skipped: false },
      isTransient: false,
    };

    // Probes: catch the error and report its shape. No reporting involved.
    const bogusIconPath = path.join(dir3, "no-such-dir", `${MARKER}.png`);
    // A write into System32 fails with EPERM/EACCES, i.e. an environmental error
    // that isEnvironmentalError must still recognise after the IPC round-trip.
    const protectedIconPath = path.join("C:/Windows/System32", `${MARKER}.png`);
    log(`probe real main throw: ${JSON.stringify(await probeExtractIcon(win3, bogusIconPath))}`);
    log(
      `probe environmental throw: ${JSON.stringify(await probeExtractIcon(win3, protectedIconPath))}`,
    );
    await stubPingWire(app3, genericWire);
    log(`probe wire generic: ${JSON.stringify(await probePing(win3))}`);
    await stubPingWire(app3, canceledWire);
    log(`probe wire user-canceled: ${JSON.stringify(await probePing(win3))}`);

    // Uncaught: reaches renderer.tsx errorHandler -> recordErrorSpan / terminate.
    /**
     * Fire an uncaught IPC-crossing error and check whether it terminated the
     * app. `expectTerminate: false` has to wait out the full window, since the
     * only proof that nothing happened is that nothing happened.
     */
    const step = async (
      label: string,
      expression: string,
      expectTerminate: boolean,
    ): Promise<void> => {
      const before = terminateCount(dir3);
      await fireUncaught(win3, expression);

      const waited = await waitFor(async () => terminateCount(dir3) > before, SETTLE_MS);
      const terminated = waited !== null;
      log(
        `uncaught ${label}: terminated=${terminated} expected=${expectTerminate} ` +
          `${terminated === expectTerminate ? "OK" : "UNEXPECTED"}` +
          (terminated ? ` (after ${waited}ms)` : ""),
      );
      if (terminated) {
        // Let the reporter subprocess deliver before the next case fires.
        await sleep(2_000);
      }
    };

    await stubPingWire(app3, genericWire);
    await step("ipc-generic", "window.api.example.ping()", true);

    await stubPingWire(app3, canceledWire);
    // A cancellation must not be treated as a crash, even after the round-trip.
    await step("ipc-usercanceled", "window.api.example.ping()", false);

    await step(
      "real-main-throw",
      `window.api.app.extractFileIcon(${JSON.stringify(process.execPath)}, ${JSON.stringify(bogusIconPath)})`,
      true,
    );

    // Still terminates (state is unknown after an unhandled throw) but must not
    // offer to report — assert on the button set rather than on the dialog count.
    await step(
      "environmental-throw",
      `window.api.app.extractFileIcon(${JSON.stringify(process.execPath)}, ${JSON.stringify(protectedIconPath)})`,
      true,
    );
    const dialogs = (await readStubState(app3)).dialogs;
    log(`environmental dialog answered with: ${JSON.stringify(dialogs.at(-1))}`);

    app3.process().kill("SIGKILL");
    await sleep(2_000);
    log("phase 3: done");
  } finally {
    for (const d of [dir, dir3]) {
      try {
        cleanupVortexInstance(d);
      } catch (err) {
        log(`cleanup of ${d} failed (harmless): ${String(err)}`);
      }
    }
  }

  log(`MARKER=${MARKER}`);
}

main().catch((err: unknown) => {
  console.error("[selftest] failed", err);
  process.exit(1);
});
