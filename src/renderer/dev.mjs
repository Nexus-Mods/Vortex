import { spawn } from "node:child_process";
import { glob, rm } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import webpack from "webpack";

const require = createRequire(import.meta.url);
const config = require("./webpack.config.cjs")({ WEBPACK_WATCH: true });

const ROOT_DIR = path.resolve(import.meta.dirname, "..", "..");
const BUILD_DIR = path.join(ROOT_DIR, "src", "main", "build");

glob("*.hot-update.*", { cwd: BUILD_DIR }, (err, matches) => {
  if (err) return; // ignored

  for (const match of matches) {
    const toDelete = path.join(BUILD_DIR, match);
    rm(toDelete, () => {
      /** ignored */
    });
  }
});

let startedElectron = false;

const abortController = new AbortController();

process.on("SIGINT", () => abortController.abort());
process.on("SIGTERM", () => abortController.abort());

const compiler = webpack(config);
compiler.watch({}, (err, stats) => {
  if (err || stats.hasErrors()) {
    console.error(`[vortex-hmr] error: ${err}`);
  } else {
    console.log(`[vortex-hmr] finished after ${stats.endTime - stats.startTime}ms: ${stats.hash}`);
    if (!startedElectron) {
      startedElectron = true;

      spawn("pnpm", ["-F", "@vortex/main", "run", "start"], {
        cwd: ROOT_DIR,
        stdio: "inherit",
        shell: process.platform === "win32",
        signal: abortController.signal,
      });
    }
  }
});
