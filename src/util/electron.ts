// This module provides a shimmed electron module for the renderer process.
// Extensions that use `require('electron')` will get this shimmed version,
// which provides app.getPath() using the preload API.
import * as electron from "electron";

import type { AppPath } from "./getVortexPath";

import getVortexPath from "./getVortexPath";

// In the renderer process, electron.app is undefined.
// We provide a shim that supports the most commonly used methods.
const appShim = {
  getPath: (name: string): string => {
    // Map Electron path names to VortexPath names
    const pathMap: { [key: string]: AppPath } = {
      userData: "userData",
      appData: "appData",
      temp: "temp",
      home: "home",
      documents: "documents",
      exe: "exe",
      desktop: "desktop",
    };
    const vortexPathName = pathMap[name];
    if (vortexPathName) {
      return getVortexPath(vortexPathName);
    }
    throw new Error(`Unknown path name: ${name}`);
  },
  getVersion: (): string => {
    return (
      (window as unknown as { appVersion: string }).appVersion ??
      electron.app?.getVersion?.() ??
      "0.0.0"
    );
  },
  getName: (): string => {
    return (
      (window as unknown as { appName: string }).appName ??
      electron.app?.getName?.() ??
      "Vortex"
    );
  },
};

// Create shimmed electron export
const shimmedElectron = {
  ...electron,
  // Provide app shim in renderer, real app in main
  app: electron.app ?? appShim,
  // remote is no longer available - provide undefined to fail gracefully
  remote: undefined,
};

export = shimmedElectron;
