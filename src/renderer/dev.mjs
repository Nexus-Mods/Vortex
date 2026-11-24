// Dev loop for the renderer: rebuild on change, reload the window, and report
// type errors alongside. Started by the nx `watch` target (`pnpm run dev`).
//
// - rolldown watches and rebuilds renderer.js / splash.js into src/main/build
// - after each successful renderer build, touches renderer.reload, which
//   src/dev-reload-client.ts (prepended to the renderer entry here, never in
//   production builds) watches to reload the window
// - tsc --watch type-checks in a separate process; its errors are printed but
//   never block a rebuild
// - Electron starts once the first build has finished

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

import { watch } from "rolldown";

import { mainOutputDirectory } from "../../rolldown.base.mjs";
import { rendererConfig } from "./build.mjs";

const ROOT_DIR = path.resolve(import.meta.dirname, "..", "..");
const RENDERER_ENTRY = path.resolve(import.meta.dirname, "src", "renderer.tsx");
const RELOAD_MARKER = path.join(mainOutputDirectory, "renderer.reload");
const LOG_PREFIX = "[vortex-dev]";

/** @returns {import("rolldown").Plugin} */
function prependDevReloadClient() {
  return {
    name: "vortex:dev-reload-client",
    transform(code, id) {
      if (path.resolve(id) !== RENDERER_ENTRY) return null;
      return { code: `import "./dev-reload-client";\n${code}`, map: null };
    },
  };
}

const abortController = new AbortController();
process.on("SIGINT", () => abortController.abort());
process.on("SIGTERM", () => abortController.abort());

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

const configs = [
  rendererConfig("renderer", "renderer.tsx", [prependDevReloadClient()]),
  rendererConfig("splash", "splash.ts"),
];

const watcher = watch(configs);
abortController.signal.addEventListener("abort", () => void watcher.close());

let startedElectron = false;
let roundFailed = false;

watcher.on("event", (event) => {
  switch (event.code) {
    case "START":
      roundFailed = false;
      break;
    case "BUNDLE_END": {
      const outputs = event.output.map((file) => path.basename(file)).join(", ");
      console.log(`${LOG_PREFIX} built ${outputs} in ${event.duration}ms`);
      void event.result.close();

      if (event.output.some((file) => path.basename(file) === "renderer.js")) {
        writeFileSync(RELOAD_MARKER, String(Date.now()));
      }
      break;
    }
    case "ERROR":
      roundFailed = true;
      console.error(`${LOG_PREFIX} build failed`, event.error);
      void event.result.close();
      break;
    case "END":
      if (!startedElectron && !roundFailed) {
        startedElectron = true;
        spawn("pnpm", ["-F", "@vortex/main", "run", "start"], {
          cwd: ROOT_DIR,
          stdio: "inherit",
          shell: process.platform === "win32",
          signal: abortController.signal,
        });
      }
      break;
  }
});
