import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));

export interface VortexInstanceSetup {
  /** Root temp directory containing appData/ and userData/ subdirs. */
  userDataDir: string;
  /** Full environment to pass to the Electron process. */
  env: Record<string, string>;
}

export function resolveMainDir(): string {
  return path.resolve(REPO_ROOT, "src", "main");
}

export function resolveElectronBinary(): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return require("electron");
}

/**
 * Prepares an isolated Vortex instance: creates a temp directory (or uses the
 * provided one), sets up the subdirectory structure Vortex expects on startup,
 * and builds the environment variables needed to point Electron at those dirs.
 *
 * Call cleanupVortexInstance() with the returned userDataDir when done.
 */
export function prepareVortexInstance(rootDir?: string): VortexInstanceSetup {
  const userDataDir = rootDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "vortex-e2e-"));

  const appDataDir = path.join(userDataDir, "appData");
  const userDataSubDir = path.join(userDataDir, "userData");
  // Pre-create the app name subdirectory that Vortex expects for startup.json.
  // The app name comes from src/main/package.json ('@vortex/main').
  const appNameDir = path.join(appDataDir, "@vortex", "main");
  fs.mkdirSync(appNameDir, { recursive: true });
  fs.mkdirSync(userDataSubDir, { recursive: true });

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key !== "ELECTRON_RUN_AS_NODE" && value !== undefined) {
      env[key] = value;
    }
  }
  env.NODE_ENV = "development";
  // Fully isolate each instance — separate userData and appData so parallel
  // instances share no data at all.
  env.ELECTRON_USERDATA = userDataSubDir;
  env.ELECTRON_APPDATA = appDataDir;
  // Always set — disables single-instance lock so parallel instances can run.
  env.VORTEX_E2E = "1";
  // Hide window unless debugging.
  if (!process.env.PWDEBUG && !process.env.VORTEX_E2E_HEADED) {
    env.VORTEX_E2E_HEADLESS = "1";
  }

  return { userDataDir, env };
}

/**
 * Removes the isolated instance directory created by prepareVortexInstance().
 *
 * On Windows, file handles (e.g. DuckDB WAL) may still be open briefly after
 * the Electron process exits, causing EPERM on rmSync. Retry with backoff so
 * transient handle release doesn't fail the test.
 */
export function cleanupVortexInstance(userDataDir: string): void {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      return;
    } catch (e: unknown) {
      if (attempt === maxAttempts) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 200);
    }
  }
}

// Script mode: launch a Vortex instance and wait for it to exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const debug = process.argv.includes("--debug");
  const { userDataDir, env } = prepareVortexInstance();
  const mainDir = resolveMainDir();
  const electronBinary = resolveElectronBinary();

  const electronArgs = [
    ...(debug ? ["--inspect=9229", "--remote-debugging-port=9222"] : []),
    mainDir,
  ];

  console.log(
    `Starting Vortex (userDataDir: ${userDataDir}${debug ? ", debug ports: Node 9229, CDP 9222" : ""})`,
  );

  const child = spawn(electronBinary, electronArgs, {
    env,
    cwd: mainDir,
    stdio: "inherit",
  });

  const cleanup = (): void => cleanupVortexInstance(userDataDir);

  process.on("SIGINT", () => {
    child.kill("SIGKILL");
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    child.kill("SIGKILL");
    cleanup();
    process.exit(143);
  });

  child.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}
