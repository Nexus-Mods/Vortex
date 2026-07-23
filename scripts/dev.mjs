/* `pnpm dev` — development workflow with renderer HMR.
 *
 * Flow:
 *  1. one-shot `nx run @vortex/main:build` (main/preload/assets/extensions,
 *     mostly cache hits) so src/main/build is fully populated
 *  2. `webpack --watch` with VORTEX_HMR=1 overwrites renderer.js with the
 *     HMR-enabled bundle and keeps emitting *.hot-update.* files on change
 *  3. tailwind --watch rebuilds build/assets/css/tailwind-v4.css on change
 *  4. electron launches once the first HMR bundle is on disk
 *
 * The renderer polls for hot updates itself (src/renderer/tools/hmr-client.cjs);
 * there is no dev server. Main/preload changes still need a restart of this
 * script. Not run through an nx target on purpose: the HMR bundle must never
 * end up in the nx cache, and nx has no readiness protocol for continuous tasks.
 */

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const RENDERER_DIR = path.join(ROOT_DIR, "src", "renderer");
const MAIN_DIR = path.join(ROOT_DIR, "src", "main");
const STYLESHEETS_DIR = path.join(ROOT_DIR, "src", "stylesheets");
const BUILD_DIR = path.join(MAIN_DIR, "build");
const isWindows = process.platform === "win32";

// mirror nx's dotenv handling so START_DEVTOOLS etc. keep working here
for (const envFile of [".env", ".local.env"]) {
  try {
    process.loadEnvFile(path.join(ROOT_DIR, envFile));
  } catch {
    // file is optional
  }
}
const env = { ...process.env, NODE_ENV: "development", VORTEX_HMR: "1" };

const log = (msg) => console.log(`[dev] ${msg}`);

const cleanHotUpdates = () => {
  let files = [];
  try {
    files = readdirSync(BUILD_DIR);
  } catch {
    return; // no build dir yet
  }
  for (const file of files) {
    if (file.includes(".hot-update.")) {
      rmSync(path.join(BUILD_DIR, file), { force: true });
    }
  }
};

const children = new Set();
const track = (child) => {
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
};

const killTree = (child) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (isWindows) {
    // .cmd shims and nested node processes need a tree kill on windows
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
};

let shuttingDown = false;
const shutdown = (code) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    killTree(child);
  }
  // keep packaging inputs clean: `pnpm -F @vortex/main deploy` copies ./build wholesale
  cleanHotUpdates();
  process.exit(code);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// .bin shims live next to whichever package declares the dependency
const bin = (baseDir, name) =>
  path.join(baseDir, "node_modules", ".bin", isWindows ? `${name}.cmd` : name);

cleanHotUpdates();

// 1. populate src/main/build (main.cjs, preload.cjs, assets, bundledPlugins, splash.js)
log("building workspace (nx, cached) ...");
const build = spawnSync("pnpm", ["nx", "run", "@vortex/main:build"], {
  cwd: ROOT_DIR,
  env,
  stdio: "inherit",
  shell: isWindows,
});
if (build.status !== 0) {
  log("initial build failed, aborting");
  process.exit(build.status ?? 1);
}

// 2. renderer webpack watch with HMR (cwd matters: webpack-node-externals
// scans <cwd>/node_modules)
log("starting renderer webpack watch (HMR) ...");
const webpack = track(
  spawn(bin(ROOT_DIR, "webpack"), ["--watch", "--config", "webpack.config.cjs"], {
    cwd: RENDERER_DIR,
    env,
    stdio: ["ignore", "pipe", "inherit"],
    shell: isWindows,
  }),
);
webpack.once("exit", (code) => {
  if (!shuttingDown) {
    log(`webpack watch exited unexpectedly (code ${code})`);
    shutdown(code ?? 1);
  }
});

// 3. tailwind watch, writing straight into the build dir; the renderer's
// hmr client swaps the <link> when this file changes (no page reload).
// --watch=always: plain --watch exits when stdin closes under spawn
log("starting tailwind watch ...");
const tailwind = track(
  spawn(
    bin(STYLESHEETS_DIR, "tailwindcss"),
    ["-i", "./tailwind-v4.css", "-o", "../main/build/assets/css/tailwind-v4.css", "--watch=always"],
    { cwd: STYLESHEETS_DIR, env, stdio: ["ignore", "ignore", "inherit"], shell: isWindows },
  ),
);

// 4. electron, once the first HMR bundle is on disk (the webpack config
// prints the sentinel below from its `done` hook on successful compiles)
log("waiting for first webpack compile ...");
let electronStarted = false;
webpack.stdout.setEncoding("utf8");
webpack.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (electronStarted || !chunk.includes("[vortex-hmr] compiled")) {
    return;
  }
  electronStarted = true;
  log("starting electron ...");
  const electron = track(
    spawn(bin(MAIN_DIR, "electron"), [".", ...process.argv.slice(2)], {
      cwd: MAIN_DIR,
      env,
      stdio: "inherit",
      shell: isWindows,
    }),
  );
  electron.once("exit", (code) => {
    log(`electron exited (code ${code})`);
    shutdown(code ?? 0);
  });
});
