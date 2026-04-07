import { getErrorCode, getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";

import { getIPCPath } from "./ipc";
import * as winapi from "winapi-bindings";
import { UserCanceled } from "./CustomErrors";
import type { INotification } from "../types/INotification";

import { getRealNodeModulePaths } from "./webpack-hacks";

type SpawnerFn = (cmd: string, args: string[]) => ChildProcess;
let _spawner: SpawnerFn = spawn;

/** @internal Override the spawn function for testing. Do not call in production. */
export function _setSpawner(fn: SpawnerFn): void {
  _spawner = fn;
}

function getSpawner(): SpawnerFn {
  return _spawner;
}

type NotifierFn = (notification: INotification) => void;
let _notifier: NotifierFn | undefined;

/** @internal Register a notification handler for elevation failures. Do not call in production test code. */
export function _setNotifier(fn: NotifierFn | undefined): void {
  _notifier = fn;
}

let _isSteamOS: boolean | undefined;

/**
 * Detect SteamOS via /etc/os-release.
 * Returns true when ID=steamos or ID_LIKE contains steamos.
 * Result is cached after the first call.
 */
export function isSteamOS(): boolean {
  if (_isSteamOS !== undefined) {
    return _isSteamOS;
  }
  try {
    const content = fs.readFileSync("/etc/os-release", "utf8");
    _isSteamOS =
      /^ID=steamos$/im.test(content) ||
      /^ID_LIKE=.*steamos.*$/im.test(content);
  } catch {
    _isSteamOS = false;
  }
  return _isSteamOS;
}

/** @internal Reset the cached SteamOS detection result. Do not call in production. */
export function _resetSteamOSCache(): void {
  _isSteamOS = undefined;
}

function rejectWithSteamOSNotification(reject: (err: UserCanceled) => void): void {
  const err = new UserCanceled();
  (err as any).message =
    "Elevation is not available in Steam Game Mode. " +
    "Switch to Desktop Mode to perform this operation.";
  _notifier?.({
    type: "error",
    title: "Elevation unavailable",
    message: (err as any).message,
  });
  reject(err);
}

declare const __non_webpack_require__: NodeJS.Require;

export interface IElevatedIpc {
  sendMessage(data: unknown): void;
  sendError(error: unknown): void;
  sendEndError(error: unknown): void;
  end(): void;
}

/* eslint-disable -- elevatedMain is serialized as text into a temp file and executed
   in a separate elevated Node process. All require() calls must use
   __non_webpack_require__ so webpack doesn't transform them into
   __webpack_require__ with internal module IDs. Similarly, imported bindings
   (like unknownToError) can't be used here because webpack mangles their
   references. */
function elevatedMain(
  moduleRoot: string[],
  ipcPath: string,
  main: (ipc: IElevatedIpc, req: NodeJS.Require) => void | PromiseLike<void>,
) {
  let client;
  const syntaxErrors = ["ReferenceError"];
  const handleError = (error: any) => {
    const testIfScriptInvalid = () => {
      syntaxErrors.forEach((errType) => {
        if (error.stack.startsWith(errType)) {
          error = "InvalidScriptError: " + error.stack;
          client.sendEndError(error);
        }
      });
    };
    console.error("Elevated code failed", error.stack);
    if (client !== undefined) {
      testIfScriptInvalid();
    }
  };

  process.on("uncaughtException", handleError);
  process.on("unhandledRejection", handleError);
  (module as NodeJS.Module).paths.push(...moduleRoot);
  const JsonSocket = __non_webpack_require__("json-socket");
  const net = __non_webpack_require__("net");
  const path = __non_webpack_require__("path");

  client = new JsonSocket(new net.Socket());
  client.connect(ipcPath);

  client
    .on("connect", () => {
      Promise.resolve(main(client, __non_webpack_require__))
        .catch((error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          client.sendError(err);
        })
        .finally(() => {
          client.end();
        });
    })
    .on("close", () => {
      process.exit(0);
    })
    .on("error", (err) => {
      if (err.code !== "EPIPE") {
        console.error("Connection failed", err.message);
      }
    });
}
/* eslint-enable */

/**
 * run a function as an elevated process (windows only!).
 * This is quite a hack because obviously windows doesn't allow us to elevate a
 * running process so instead we have to store the function code into a file and start a
 * new node process elevated to execute that script.
 *
 * IMPORTANT As a consequence the function can not bind any parameters
 *
 * @param {string} ipcPath a unique identifier for a local ipc channel that can be used to
 *                 communicate with the elevated process (as stdin/stdout can not be)
 *                 redirected
 * @param {Function} func The closure to run in the elevated process. Try to avoid
 *                        'fancy' code. This function receives two parameters, one is an ipc stream,
 *                        connected to the path specified in the first parameter.
 *                        The second function is a require function which you need to use instead of
 *                        the global require. Regular require calls will not work in production
 *                        builds
 * @param {Object} args arguments to be passed into the elevated process
 * @returns {Bluebird<string>} a promise that will be resolved as soon as the process is started
 *                             (which happens after the user confirmed elevation). It resolves to
 *                             the path of the tmpFile we had to create. If the caller can figure
 *                             out when the process is done (using ipc) it should delete it
 */
export function runElevated(
  ipcPath: string,
  func: (ipc: IElevatedIpc, req: NodeJS.Require) => void | PromiseLike<void>,
  args?: Record<string, unknown>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    tmp.file(
      { postfix: ".js" },
      (err: Error, tmpPath: string, fd: number, cleanup: () => void) => {
        if (err) {
          return reject(err);
        }

        const modulePaths = getRealNodeModulePaths(process.cwd())
          .map((p) => p.split("\\").join("/"));

        let mainBody = elevatedMain.toString();
        mainBody = mainBody.slice(
          mainBody.indexOf("{") + 1,
          mainBody.lastIndexOf("}"),
        );

        // The elevatedMain function body is serialized via .toString() and executed
        // in a separate Node process. We use __non_webpack_require__ in the function
        // so webpack doesn't transform the calls, but that global doesn't exist in
        // plain Node — so we alias it here. __webpack_require__ is also aliased in
        // case the caller's serialized func callback contains webpack-transformed requires.
        let prog = `
        const __non_webpack_require__ = require;\n
        const __webpack_require__ = require;\n
        let moduleRoot = ${JSON.stringify(modulePaths)};\n
        let ipcPath = '${getIPCPath(ipcPath)}';\n
      `;

        if (args !== undefined) {
          for (const argKey of Object.keys(args)) {
            if (Object.prototype.hasOwnProperty.call(args, argKey)) {
              prog += `let ${argKey} = ${JSON.stringify(args[argKey])};\n`;
            }
          }
        }

        prog += `
        let main = ${func.toString()};\n
        ${mainBody}\n
      `;

        fs.write(fd, prog, (writeErr: Error, _written: number, _str: string) => {
          if (writeErr) {
            try {
              cleanup();
            } catch (cleanupErr) {
              const errorMessage = getErrorMessageOrDefault(cleanupErr);
              console.error(
                "failed to clean up temporary script",
                errorMessage,
              );
            }
            return reject(writeErr);
          }

          try {
            fs.closeSync(fd);
          } catch (closeErr) {
            const err = unknownToError(closeErr);
            const errCode = getErrorCode(err);
            if (errCode !== "EBADF") {
              return reject(err);
            }
          }

          if (process.platform === "linux") {
            if (isSteamOS()) {
              // SteamOS: pkexec hangs without polkit agent in Game Mode.
              // Attempt sudo -n (non-interactive) instead.
              const proc = getSpawner()("sudo", [
                "-n",
                process.execPath,
                "--run",
                tmpPath,
              ]);
              proc.on("close", (code: number | null) => {
                if (code !== null && code !== 0) {
                  // sudo -n failed (password required or ENOENT)
                  rejectWithSteamOSNotification(reject);
                }
                // code 0 or null: normal exit; IPC handles results
              });
              proc.on("error", (_spawnErr: Error) => {
                // sudo not found on PATH
                rejectWithSteamOSNotification(reject);
              });
            } else {
              // Standard desktop Linux: use pkexec (unchanged from Phase 9)
              const proc = getSpawner()("pkexec", [
                process.execPath,
                "--run",
                tmpPath,
              ]);
              proc.on("close", (code: number | null) => {
                if (code === 126) {
                  reject(new UserCanceled());
                } else if (code !== null && code !== 0) {
                  reject(
                    new Error(`pkexec exited with code ${code}`),
                  );
                }
                // code 0 or null: normal exit; IPC handles results
              });
              proc.on("error", (spawnErr: Error) => {
                reject(spawnErr);
              });
            }
            return resolve(tmpPath);
          }

          try {
            winapi.ShellExecuteEx({
              verb: "runas",
              file: process.execPath,
              parameters: `--run ${tmpPath}`,
              directory: path.dirname(process.execPath),
              show: "shownormal",
            });
            return resolve(tmpPath);
          } catch (shellErr) {
            return reject(unknownToError(shellErr));
          }
        });
      },
    );
  });
}

