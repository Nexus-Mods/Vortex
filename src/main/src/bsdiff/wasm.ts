/**
 * Runs HDiffPatch's hdiffz (hdiffpatch/hdiffz.wasm, built by
 * scripts/build-hdiffpatch-wasm.mjs) as a WASI command. No worker and no IPC, so
 * it runs in any context: the patch worker thread, a direct caller, or a test.
 * Each run gets a fresh instance, so its memory is released when the run ends.
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { WASI } from "node:wasi";

export function loadWasm(wasmBytes: BufferSource): WebAssembly.Module {
  return new WebAssembly.Module(wasmBytes);
}

// the last lines hdiffz printed, which name what went wrong
function failureText(log: string): string {
  return log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(-3)
    .join("; ");
}

/**
 * Run hdiffz with options followed by filePaths. Each file's folder is opened
 * to the command under a guest folder of its own. Throws if hdiffz exits
 * with an error.
 */
export function runHdiffz(
  wasmModule: WebAssembly.Module,
  options: string[],
  filePaths: string[],
): void {
  // guest folders the command sees, keyed by the host folder each stands for
  const guestFolders = new Map<string, string>();
  const guestPaths = filePaths.map((filePath) => {
    const hostFolder = path.dirname(path.resolve(filePath));
    let guestFolder = guestFolders.get(hostFolder);
    if (guestFolder === undefined) {
      guestFolder = `/${guestFolders.size}`;
      guestFolders.set(hostFolder, guestFolder);
    }
    return `${guestFolder}/${path.basename(filePath)}`;
  });
  // host folders, keyed by guest folder, as WASI takes them
  const preopens = Object.fromEntries(
    [...guestFolders].map(([hostFolder, guestFolder]) => [guestFolder, hostFolder]),
  );

  const logPath = path.join(os.tmpdir(), `vortex-hdiffz-${randomUUID()}.log`);
  const logFd = fs.openSync(logPath, "w+");
  try {
    const wasi = new WASI({
      version: "preview1",
      args: ["hdiffz", ...options, ...guestPaths],
      env: {},
      preopens,
      stdout: logFd,
      stderr: logFd,
      returnOnExit: true,
    });
    const instance = new WebAssembly.Instance(wasmModule, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    const exitCode = wasi.start(instance);
    if (exitCode !== 0) {
      throw new Error(
        `hdiffz failed with exit code ${exitCode}: ${failureText(fs.readFileSync(logPath, "utf8"))}`,
      );
    }
  } finally {
    fs.closeSync(logFd);
    fs.rmSync(logPath, { force: true });
  }
}
