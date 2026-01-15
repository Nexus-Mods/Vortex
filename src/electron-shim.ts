export { ipcMain, app, BrowserWindow, dialog, shell, protocol } from "electron";
import type { IpcRenderer } from "electron";

let ipcRenderer: IpcRenderer | undefined;

if (typeof window !== "undefined" && "ipcRenderer" in globalThis) {
  ipcRenderer = globalThis.ipcRenderer;
}

export { ipcRenderer };
