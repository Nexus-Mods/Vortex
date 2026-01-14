import { MissingInterpreter } from "./CustomErrors";
import { log } from "./log";

import Promise from "bluebird";
import * as path from "path";
import * as winapiT from "winapi-bindings";

import { ipcMain, ipcRenderer, shell } from "electron";

let winapi: typeof winapiT;
try {
  // tslint:disable-next-line:no-var-requires
  winapi = require("winapi-bindings");
} catch (err) {
  // nop
}

function isWindowsPath(target: string): boolean {
  return path.win32.isAbsolute(target);
}

function isAbsolutePath(target: string): boolean {
  return path.isAbsolute(target) || isWindowsPath(target);
}

function isUrlTarget(target: string): boolean {
  if (isWindowsPath(target)) {
    return false;
  }

  try {
    const parsed = new URL(target);
    return parsed.protocol.length > 1;
  } catch (err) {
    return false;
  }
}

function openExternal(target: string): Promise<void> {
  return Promise.resolve(shell.openExternal(target, { activate: true }));
}

function openLocalPath(target: string): Promise<void> {
  const resolvedTarget = isAbsolutePath(target) ? target : path.resolve(target);

  if (process.platform === "win32") {
    return openExternal(resolvedTarget);
  }

  return Promise.resolve(shell.openPath(resolvedTarget)).then((error) => {
    if (error) {
      throw new Error(error);
    }
  });
}

// apparently the browser process is treated as the foreground process and only it
// can bring a window to the foreground
if (ipcMain !== undefined && winapi?.ShellExecuteEx !== undefined) {
  ipcMain.on("__opn_win32", (evt, target) => {
    try {
      winapi.ShellExecuteEx({
        verb: "open",
        show: "foreground" as any,
        file: target,
        mask: ["flag_no_ui"],
      });
    } catch (err) {
      log("warn", "failed to run", { target, error: err.message });
    }
  });
}

function open(target: string, wait?: boolean): Promise<void> {
  // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
  if (winapi?.ShellExecuteEx !== undefined && !wait) {
    try {
      if (ipcRenderer !== undefined) {
        ipcRenderer.send("__opn_win32", target);
        return Promise.resolve();
      } else {
        try {
          winapi.ShellExecuteEx({
            verb: "open",
            show: "foreground" as any,
            file: target,
            mask: ["flag_no_ui"],
          });
          return Promise.resolve();
        } catch (err) {
          return Promise.reject(err);
        }
      }
    } catch (err) {
      if (err.systemCode === 1155) {
        return Promise.reject(
          new MissingInterpreter(
            "No default application set up for file type.",
            err.path,
          ),
        );
      } else if (err.systemCode === 1223) {
        // Operation was canceled by the user.
        //  https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes--1000-1299-
        return Promise.resolve();
      } else {
        return Promise.reject(err);
      }
    }
  } else {
    const openPromise = isUrlTarget(target)
      ? openExternal(target)
      : openLocalPath(target);

    openPromise.catch((err) => {
      const error = (err as any)?.message ?? err;
      log("warn", "failed to open", { target, error });
    });

    if (wait) {
      return openPromise;
    }

    return Promise.resolve();
  }
}

export default open;
