// Dev loop for the renderer, with hot module replacement. Started by the nx
// `watch` target (`pnpm run dev`).
//
// - The renderer builds with rolldown's dev engine (rolldown/experimental) into
//   renderer.mjs. The engine only supports ESM output, so the dev renderer is
//   an ES module; production builds (build.mjs) stay CommonJS. renderer.js
//   becomes a loader that adds renderer.mjs as a module script, so index.html
//   is the same in dev and production.
// - Each change produces a patch. It's written to src/main/build/hmr/ and the
//   HMR client (hmr-client.js, built into renderer.mjs) imports and applies it.
//   See hmr-client.js for the file protocol and the update rules.
// - React components refresh in place through react-refresh: the JSX refresh
//   transform plus reactRefreshWrapper() below.
// - splash.js rebuilds with plain rolldown watch; it has no HMR.
// - tsc --watch type-checks in a separate process; its errors are printed but
//   never block a rebuild.
// - Electron starts once the first renderer build has finished.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import { watch } from "rolldown";
import { dev } from "rolldown/experimental";

import { mainOutputDirectory } from "../../rolldown.base.mjs";
import { rendererConfig } from "./build.mjs";

const ROOT_DIR = path.resolve(import.meta.dirname, "..", "..");
const SRC_DIR = path.resolve(import.meta.dirname, "src");
const HMR_DIR = path.join(mainOutputDirectory, "hmr");
const LOG_PREFIX = "[vortex-dev]";

const require = createRequire(import.meta.url);

/**
 * The client runtime for the dev engine: rolldown's DevRuntime, then our client
 * (which subclasses it). The runtime ships as an ES module; its export line goes
 * since the engine inlines this code into the bundle.
 */
function hmrImplementation() {
  const runtime = fs
    .readFileSync(require.resolve("rolldown/experimental/runtime"), "utf8")
    .replace(/^export \{[^}]*\};?\s*$/m, "");
  const client = fs.readFileSync(path.join(import.meta.dirname, "hmr-client.js"), "utf8");
  return `${runtime}\n${client}`;
}

/**
 * Lets react-refresh swap components in place. The JSX refresh transform makes
 * every component call the $RefreshReg$ / $RefreshSig$ globals at the end of
 * its module; this points them at the module about to run, so the HMR client
 * knows which components each module registered (see hmr-client.js). Every
 * renderer module gets it, so registrations never land on the previous
 * module. The prefix goes on the first line, so line numbers (and the source
 * map) are unchanged.
 * @returns {import("rolldown").Plugin}
 */
function reactRefreshWrapper() {
  return {
    name: "vortex:react-refresh",
    transform: {
      filter: { id: /\.tsx?$/ },
      handler(code, id) {
        if (!path.resolve(id).startsWith(SRC_DIR)) return null;
        return {
          code: `if (import.meta.hot) import.meta.hot.beginRefreshRegistration();${code}`,
          map: null,
        };
      },
    },
  };
}

const abortController = new AbortController();
process.on("SIGINT", () => abortController.abort());
process.on("SIGTERM", () => abortController.abort());

// --- type checking ---

const tsc = spawn(
  "pnpm",
  ["exec", "tsc", "-p", "tsconfig.json", "--noEmit", "--watch", "--preserveWatchOutput"],
  {
    cwd: import.meta.dirname,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    signal: abortController.signal,
  },
);
const prefixLines = (stream, out) =>
  stream.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim() !== "") out.write(`[tsc] ${line}\n`);
    }
  });
prefixLines(tsc.stdout, process.stdout);
prefixLines(tsc.stderr, process.stderr);
tsc.on("error", (err) => {
  if (err.name !== "AbortError") console.error(`${LOG_PREFIX} tsc failed to start`, err);
});

// --- splash: plain watch ---

const splashWatcher = watch([rendererConfig("splash", "splash.ts")]);
abortController.signal.addEventListener("abort", () => void splashWatcher.close());
splashWatcher.on("event", (event) => {
  if (event.code === "BUNDLE_END") {
    console.log(`${LOG_PREFIX} built splash.js in ${event.duration}ms`);
    void event.result.close();
  } else if (event.code === "ERROR") {
    console.error(`${LOG_PREFIX} splash build failed`, event.error);
    void event.result.close();
  }
});

// --- renderer: dev engine with HMR ---

fs.rmSync(HMR_DIR, { recursive: true, force: true });
fs.mkdirSync(HMR_DIR, { recursive: true });
fs.writeFileSync(
  path.join(mainOutputDirectory, "renderer.js"),
  [
    "// Dev build: the renderer is an ES module (see src/renderer/dev.mjs).",
    'const script = document.createElement("script");',
    'script.type = "module";',
    'script.src = "./renderer.mjs";',
    "document.body.appendChild(script);",
    "",
  ].join("\n"),
);

const { output, ...input } = rendererConfig("renderer", "renderer.tsx", [reactRefreshWrapper()]);
let startedElectron = false;
let buildStarted = Date.now();
/** @type {string | undefined} */
let clientId;

const engine = await dev(
  {
    ...input,
    // The renderer can't import packages or node: built-ins as ES modules
    // (Chromium's loader, CSP); the browser platform keeps every external a
    // require() call, which Node integration provides.
    platform: "browser",
    transform: { ...input.transform, jsx: { runtime: "classic", refresh: true } },
    experimental: { ...input.experimental, devMode: { implement: hmrImplementation() } },
  },
  {
    ...output,
    file: path.join(mainOutputDirectory, "renderer.mjs"),
    format: "esm",
    minify: false,
    strictExecutionOrder: undefined,
  },
  {
    // Keep renderer.mjs on disk current, so a reload gets the latest code.
    rebuildStrategy: "always",
    onOutput(result) {
      if (result instanceof Error) {
        // The same error already came through onHmrUpdates, after the first build.
        if (!startedElectron)
          console.error(`${LOG_PREFIX} renderer build failed\n${result.message}`);
        return;
      }
      console.log(`${LOG_PREFIX} built renderer.mjs in ${Date.now() - buildStarted}ms`);
      if (!startedElectron) {
        startedElectron = true;
        spawn("pnpm", ["-F", "@vortex/main", "run", "start"], {
          cwd: ROOT_DIR,
          stdio: "inherit",
          shell: process.platform === "win32",
          signal: abortController.signal,
        });
      }
    },
    onHmrUpdates(result) {
      buildStarted = Date.now();
      if (result instanceof Error) {
        console.error(
          `${LOG_PREFIX} build failed, the window keeps the last good code\n${result.message}`,
        );
        return;
      }
      for (const { clientId: target, update } of result.updates) {
        if (target !== clientId) continue; // a window that has gone
        const dir = path.join(HMR_DIR, target);
        if (update.type === "Patch") {
          const seq = noticeSeq++;
          const file = `${seq}.mjs`;
          fs.writeFileSync(path.join(dir, file), update.code);
          if (update.sourcemap !== undefined && update.sourcemapFilename !== undefined) {
            fs.writeFileSync(path.join(dir, update.sourcemapFilename), update.sourcemap);
          }
          writeNotice(dir, seq, {
            type: "patch",
            file,
            filename: update.filename,
            changedIds: update.changedIds,
          });
          console.log(`${LOG_PREFIX} hot update: ${update.changedIds.join(", ")}`);
        } else if (update.type === "FullReload") {
          writeNotice(dir, noticeSeq++, { type: "reload", reason: update.reason });
          console.log(`${LOG_PREFIX} full reload${update.reason ? `: ${update.reason}` : ""}`);
        }
      }
    },
  },
);
abortController.signal.addEventListener("abort", () => void engine.close());

/** Writes the notice in one rename, so the client never reads half of it. */
function writeNotice(dir, seq, notice) {
  const target = path.join(dir, `${seq}.json`);
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(notice));
  fs.renameSync(`${target}.tmp`, target);
}

// A window announces itself in hmr/client.json on every load; the engine then
// produces patches for it. The engine only leaves out of a patch the modules it
// knows the window already has, so the bundle the window loaded, and every
// patch it reports as run, go back to the engine as delivered. Notices are
// numbered per window from 0, in the order the client must apply them.
let deliveredOffset = 0;
let noticeSeq = 0;
function onClientAnnounced() {
  let announced;
  try {
    announced = JSON.parse(fs.readFileSync(path.join(HMR_DIR, "client.json"), "utf8")).clientId;
  } catch {
    return; // mid-write
  }
  if (announced === clientId) return;
  const previous = clientId;
  clientId = announced;
  deliveredOffset = 0;
  noticeSeq = 0;
  if (previous !== undefined) {
    void engine.removeClient(previous);
    fs.rmSync(path.join(HMR_DIR, previous), { recursive: true, force: true });
  }
  void engine
    .registerClient(announced)
    .then(() => engine.notifyPayloadDelivered("renderer.mjs"))
    .then(() => console.log(`${LOG_PREFIX} window connected (${announced})`));
}

function onDelivered() {
  if (clientId === undefined) return;
  const log = path.join(HMR_DIR, clientId, "delivered.log");
  let text;
  try {
    text = fs.readFileSync(log, "utf8");
  } catch {
    return;
  }
  const lines = text.slice(deliveredOffset).split("\n");
  const complete = lines.slice(0, -1);
  deliveredOffset += complete.reduce((sum, line) => sum + line.length + 1, 0);
  for (const filename of complete) {
    if (filename !== "") void engine.notifyPayloadDelivered(filename);
  }
}

const hmrWatcher = fs.watch(HMR_DIR, { recursive: true }, (_, file) => {
  if (file === "client.json") onClientAnnounced();
  else if (file != null && file.endsWith("delivered.log")) onDelivered();
});
abortController.signal.addEventListener("abort", () => hmrWatcher.close());

await engine.run();
