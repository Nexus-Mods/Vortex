import { log } from "./log";

import Promise from "bluebird";
import type * as winapiT from "winapi-bindings";

import { ipcMain, ipcRenderer, shell } from "electron";
import { getErrorMessage } from "../shared/errors";

let winapi: typeof winapiT;
try {
  winapi = require("winapi-bindings");
} catch {
  // nop
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
        error: getErrorMessage(err) ?? "unknown error",
      });
    }
  });
}

function open(target: string, wait?: boolean): Promise<void> {
  // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
  if (winapi?.ShellExecuteEx !== undefined && !wait) {
    if (ipcRenderer !== undefined) {
      ipcRenderer.send("__opn_win32", target);
      return Promise.resolve();
    } else {
      try {
        winapi.ShellExecuteEx({
          verb: "open",
          show: "foreground",
          file: target,
          mask: ["flag_no_ui"],
        });
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    }
  } else {
    if (wait) {
      return Promise.resolve(shell.openExternal(target, { activate: true }));
    } else {
      shell.openExternal(target, { activate: true });
      return Promise.resolve();
    }
  }
}

export default open;
