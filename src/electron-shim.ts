export { ipcMain, app, BrowserWindow, dialog, shell, protocol } from "electron";
import type { IpcRenderer, WebUtils } from "electron";

let ipcRenderer: IpcRenderer | undefined;
let webUtils: WebUtils | undefined;

if (typeof window !== "undefined") {
  if ("ipcRenderer" in globalThis) {
    ipcRenderer = globalThis.ipcRenderer;
  }

  if ("webUtils" in globalThis) {
    webUtils = globalThis.webUtils;
  }
}

export { ipcRenderer, webUtils };
