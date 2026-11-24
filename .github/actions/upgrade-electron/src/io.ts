import { execFile, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { abiKnown } from "./abi";
import { type ApplyIo } from "./apply";

const execFileAsync = promisify(execFile);

/** Runs `pnpm install` in `cwd`, streaming its output to the log. */
const pnpmInstall = (cwd: string, frozen: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    // Explicit both ways: with CI=true pnpm freezes the lockfile by default, which would make
    // the installs that are meant to update it fail.
    const args = ["install", frozen ? "--frozen-lockfile" : "--no-frozen-lockfile"];
    console.log(`> pnpm ${args.join(" ")}`);
    const child = spawn("pnpm", args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pnpm ${args.join(" ")} exited with ${String(code)}`));
      }
    });
  });

/** The real side effects, operating on the repository checked out at `root`. */
export const realIo = (root: string): ApplyIo => ({
  readText: (file) => readFileSync(join(root, file), "utf8"),
  writeText: (file, text) => {
    writeFileSync(join(root, file), text);
  },
  install: ({ frozen }) => pnpmInstall(root, frozen),
  changedFiles: async () => {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: root });
    return stdout
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => line.slice(3));
  },
  abiKnown: (electronVersion) => abiKnown(electronVersion, root),
});
