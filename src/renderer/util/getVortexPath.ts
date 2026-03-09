import * as electron from "electron";
import * as os from "os";
import * as path from "path";

import { ApplicationData } from "@vortex/shared";
import { getPreloadApi } from "./preloadAccess";

// If running as a forked child process, read Electron app info from environment variables
const electronAppInfoEnv: { [key: string]: string | undefined } =
  typeof process.send === "function"
    ? {
        userData: process.env.ELECTRON_USERDATA,
        temp: process.env.ELECTRON_TEMP,
        appData: process.env.ELECTRON_APPDATA,
        home: process.env.ELECTRON_HOME,
        documents: process.env.ELECTRON_DOCUMENTS,
        exe: process.env.ELECTRON_EXE,
        desktop: process.env.ELECTRON_DESKTOP,
        appPath: process.env.ELECTRON_APP_PATH,
        assets: process.env.ELECTRON_ASSETS,
        assets_unpacked: process.env.ELECTRON_ASSETS_UNPACKED,
        modules: process.env.ELECTRON_MODULES,
        modules_unpacked: process.env.ELECTRON_MODULES_UNPACKED,
        bundledPlugins: process.env.ELECTRON_BUNDLEDPLUGINS,
        locales: process.env.ELECTRON_LOCALES,
        base: process.env.ELECTRON_BASE,
        application: process.env.ELECTRON_APPLICATION,
        package: process.env.ELECTRON_PACKAGE,
        package_unpacked: process.env.ELECTRON_PACKAGE_UNPACKED,
      }
    : {};

export type AppPath =
  | "base"
  | "assets"
  | "assets_unpacked"
  | "modules"
  | "modules_unpacked"
  | "bundledPlugins"
  | "locales"
  | "package"
  | "package_unpacked"
  | "application"
  | "userData"
  | "appData"
  | "localAppData"
  | "temp"
  | "home"
  | "documents"
  | "exe"
  | "desktop";

// Check process type once at module load
const isMainProcess = electron?.app !== undefined;
const isForkedChild =
  typeof process.send === "function" &&
  Object.keys(electronAppInfoEnv).length > 0;

// For renderer process, we'll use window.vortexPaths which is set by preload
// For main process, we delegate to main/getVortexPath.ts
// For forked child, we use env vars

// Cache for paths (used in main process)
const cache: { [id: string]: string | (() => string) } = {};

// Main process helpers (only used when running in main process)
const getAppPath = (id: string): string => {
  if (!isMainProcess) {
    throw new Error("getAppPath called outside main process");
  }
  if (cache[id] === undefined) {
    if (id === "__app") {
      cache[id] = electron.app.getAppPath();
    } else {
      cache[id] = electron.app.getPath(id as any);
    }
  }
  const value = cache[id];
  return typeof value === "string" ? value : value();
};

// Compute paths for main process (lazy initialization)
let mainProcessPaths: {
  basePath: string;
  applicationPath: string;
  isDevelopment: boolean;
  isAsar: boolean;
} | null = null;

function initMainProcessPaths() {
  if (mainProcessPaths !== null) return mainProcessPaths;

  let basePath = electron.app.getAppPath();
  const isDevelopment = path.basename(basePath, ".asar") !== "app";
  const isAsar = !isDevelopment && path.extname(basePath) === ".asar";
  const applicationPath = isDevelopment
    ? basePath
    : path.resolve(path.dirname(basePath), "..");

  if (isDevelopment) {
    if (path.basename(basePath) !== "out") {
      basePath = path.join(applicationPath, "out");
    }
  }

  mainProcessPaths = { basePath, applicationPath, isDevelopment, isAsar };
  return mainProcessPaths;
}

function getModulesPath(unpacked: boolean): string {
  const { basePath, applicationPath, isDevelopment, isAsar } =
    initMainProcessPaths();
  if (isDevelopment) {
    return path.join(applicationPath, "node_modules");
  }
  const asarPath = unpacked && isAsar ? basePath + ".unpacked" : basePath;
  return path.join(asarPath, "node_modules");
}

function getAssets(unpacked: boolean): string {
  const { basePath, isAsar } = initMainProcessPaths();
  const asarPath = unpacked && isAsar ? basePath + ".unpacked" : basePath;
  return path.join(asarPath, "assets");
}

function getBundledPluginsPath(): string {
  const { basePath, isAsar } = initMainProcessPaths();
  return isAsar
    ? path.join(basePath + ".unpacked", "bundledPlugins")
    : path.join(basePath, "bundledPlugins");
}

function getLocalesPath(): string {
  const { basePath, isDevelopment } = initMainProcessPaths();
  return isDevelopment
    ? path.join(basePath, "locales")
    : path.resolve(basePath, "..", "locales");
}

function getPackagePath(unpacked: boolean): string {
  const { basePath, applicationPath, isDevelopment } = initMainProcessPaths();
  if (isDevelopment) {
    return applicationPath;
  }
  let res = basePath;
  if (unpacked && path.basename(res) === "app.asar") {
    res = path.join(path.dirname(res), "app.asar.unpacked");
  }
  return res;
}

const localAppData = (() => {
  let cached: string | undefined;
  return () => {
    if (cached === undefined) {
      cached =
        process.env.LOCALAPPDATA ||
        path.resolve(getAppPath("appData"), "..", "Local");
    }
    return cached;
  };
})();

export function setVortexPath(id: AppPath, value: string | (() => string)) {
  cache[id] = value;
  if (isMainProcess) {
    const strValue = typeof value === "string" ? value : value();
    electron.app.setPath(id as any, strValue);
  } else if (typeof window !== "undefined") {
    // In renderer, update via IPC (async)
    try {
      const strValue = typeof value === "string" ? value : value();
      void getPreloadApi().app.setPath(id, strValue);
    } catch {
      // Preload API not available yet
    }
  }
}

/**
 * Get Vortex application path.
 *
 * This function provides paths to application data independent
 * of build configuration (development/production, asar/no-asar, portable/not).
 *
 * - Main process: Uses electron.app directly
 * - Renderer process: Uses window.vortexPaths from preload
 * - Forked child process: Uses environment variables
 */
function getVortexPath(id: AppPath): string {
  // 1. Forked child process: use env vars
  if (isForkedChild && id in electronAppInfoEnv && electronAppInfoEnv[id]) {
    return electronAppInfoEnv[id]!;
  }

  // 2. Renderer process: use ApplicationData cache (populated by ApplicationData.init())
  if (!isMainProcess && typeof window !== "undefined") {
    const vortexPaths = ApplicationData.vortexPaths;
    if (vortexPaths !== undefined) {
      // Check cache first (for setVortexPath overrides)
      if (cache[id] !== undefined) {
        const value = cache[id];
        return typeof value === "string" ? value : value();
      }
      return vortexPaths[id];
    }
  }

  // 3. Main process: compute paths directly
  if (isMainProcess) {
    // Check cache first (for setVortexPath overrides)
    if (cache[id] !== undefined) {
      const value = cache[id];
      return typeof value === "string" ? value : value();
    }

    switch (id) {
      case "userData":
        return getAppPath("userData");
      case "temp":
        return getAppPath("temp");
      case "appData":
        return getAppPath("appData");
      case "localAppData":
        return localAppData();
      case "home":
        return getAppPath("home");
      case "documents":
        return getAppPath("documents");
      case "exe":
        return getAppPath("exe");
      case "desktop":
        return getAppPath("desktop");
      case "base":
        return initMainProcessPaths().basePath;
      case "application":
        return initMainProcessPaths().applicationPath;
      case "package":
        return getPackagePath(false);
      case "package_unpacked":
        return getPackagePath(true);
      case "assets":
        return getAssets(false);
      case "assets_unpacked":
        return getAssets(true);
      case "modules":
        return getModulesPath(false);
      case "modules_unpacked":
        return getModulesPath(true);
      case "bundledPlugins":
        return getBundledPluginsPath();
      case "locales":
        return getLocalesPath();
    }
  }

  // 4. Fallback for non-Electron environments (tests)
  if (id === "temp") {
    return os.tmpdir();
  }
  return path.resolve(__dirname, "..", "..");
}

export default getVortexPath;
