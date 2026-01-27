import { log } from "./log";

import PromiseBB from "bluebird";
import * as path from "path";
import type * as winapiT from "winapi-bindings";

import { ipcMain, ipcRenderer, shell } from "electron";
import { getErrorMessageOrDefault } from "../shared/errors";

let winapi: typeof winapiT | undefined;
try {
  winapi = require("winapi-bindings");
} catch {
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

function openExternal(target: string): PromiseBB<void> {
  return PromiseBB.resolve(shell.openExternal(target, { activate: true }));
}

function openLocalPath(target: string): PromiseBB<void> {
  const resolvedTarget = isAbsolutePath(target) ? target : path.resolve(target);

  if (process.platform === "win32") {
    return openExternal(resolvedTarget);
  }

  return PromiseBB.resolve(shell.openPath(resolvedTarget)).then((error) => {
    if (error) {
      throw new Error(error);
    }
  });
}

// apparently the browser process is treated as the foreground process and only it
// can bring a window to the foreground
if (ipcMain !== undefined && winapi?.ShellExecuteEx !== undefined) {
  ipcMain.on("__opn_win32", (_evt, target) => {
    try {
      winapi.ShellExecuteEx({
        verb: "open",
        show: "foreground",
        file: target,
        mask: ["flag_no_ui"],
      });
    } catch (err) {
      log("warn", "failed to run", {
        target,
        error: getErrorMessageOrDefault(err),
      });
    }
  });
}

function open(target: string, wait?: boolean): PromiseBB<void> {
  // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
  if (winapi?.ShellExecuteEx !== undefined && !wait) {
    if (ipcRenderer !== undefined) {
      ipcRenderer.send("__opn_win32", target);
      return PromiseBB.resolve();
    } else {
      try {
        winapi.ShellExecuteEx({
          verb: "open",
          show: "foreground",
          file: target,
          mask: ["flag_no_ui"],
        });
        return PromiseBB.resolve();
      } catch (err) {
        return PromiseBB.reject(err);
      }
    }
  } else {
    const openPromise = isUrlTarget(target)
      ? openExternal(target)
      : openLocalPath(target);

    openPromise.catch((err) => {
      const error = getErrorMessageOrDefault(err);
      log("warn", "failed to open", { target, error });
    });

    if (wait) {
      return openPromise;
    }

    return PromiseBB.resolve();
  }
}

export default open;
