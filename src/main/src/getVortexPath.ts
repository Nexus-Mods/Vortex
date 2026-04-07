import type { VortexPaths } from "@vortex/shared/ipc";

import { XDG } from "@vortex/fs";
import { app, type App } from "electron";
import * as os from "node:os";
import * as path from "node:path";

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
        base_unpacked: process.env.ELECTRON_BASE_UNPACKED,
        application: process.env.ELECTRON_APPLICATION,
        package: process.env.ELECTRON_PACKAGE,
        package_unpacked: process.env.ELECTRON_PACKAGE_UNPACKED,
      }
    : {};

/**
 * app.getAppPath() returns the path to the app.asar,
 * development: node_modules\electron\dist\resources\default_app.asar
 * production (with asar): Vortex\resources\app.asar
 * production (without asar): Vortex\resources\app
 *
 * when running from unit tests, app may not be defined at all, in that case we use __dirname
 * after all
 */
let basePath =
  app !== undefined ? app.getAppPath() : path.resolve(__dirname, "..", "..");
const isDevelopment = path.basename(basePath, ".asar") !== "app";
const isAsar = !isDevelopment && path.extname(basePath) === ".asar";
const applicationPath = isDevelopment
  ? basePath
  : path.resolve(path.dirname(basePath), "..");

if (isDevelopment) {
  // In Electron 37, app.getAppPath() may already point to the 'out' directory
  // Check if basePath already ends with 'out' to avoid double 'out/out'
  if (path.basename(basePath) === "out") {
    // basePath is already correct (points to out directory)
    // Don't modify it
  } else {
    basePath = path.join(applicationPath, "out");
  }
}

// basePath is now the path that contains assets, bundledPlugins, index.html, main.js and so on
// applicationPath is still different between development and production

function getModulesPath(unpacked: boolean): string {
  if (isDevelopment) {
    return path.join(applicationPath, "node_modules");
  }
  const asarPath = unpacked && isAsar ? basePath + ".unpacked" : basePath;
  return path.join(asarPath, "node_modules");
}

function getAssets(unpacked: boolean): string {
  const asarPath = unpacked && isAsar ? basePath + ".unpacked" : basePath;
  return path.join(asarPath, "assets");
}

function getBundledPluginsPath(): string {
  // bundled plugins are never packed in the asar
  return isAsar
    ? path.join(basePath + ".unpacked", "bundledPlugins")
    : path.join(basePath, "bundledPlugins");
}

function getLocalesPath(): string {
  // in production builds the locales are not inside the app(.asar) directory but alongside it
  return isDevelopment
    ? path.join(basePath, "locales")
    : path.resolve(basePath, "..", "locales");
}

/**
 * path to the directory containing package.json file
 */
function getPackagePath(unpacked: boolean): string {
  if (isDevelopment) {
    return basePath;
  }

  let res = basePath;
  if (unpacked && path.basename(res) === "app.asar") {
    res = path.join(path.dirname(res), "app.asar.unpacked");
  }

  return res;
}

const cache: Partial<VortexPaths> = {};

type ElectronPathId = Parameters<App["getPath"]>["0"] & keyof VortexPaths;

function cachedAppPath(id: ElectronPathId) {
  let value = cache[id];
  if (value) {
    return value;
  }

  // Normalize to fix mixed separators from scoped package names
  // (e.g. "@vortex/main" produces a forward slash in userData path)
  value = path.normalize(app.getPath(id));

  cache[id] = value;
  return value;
}

function localAppData(): string {
  if (process.platform === "linux") {
    // NOTE: BG3 and Bethesda game extensions use localAppData for config paths.
    // On Linux these resolve to XDG_DATA_HOME. Proton-prefix resolution
    // for these games will be handled in Phase 2.
    return (
      process.env[XDG.data] ?? path.join(os.homedir(), ".local", "share")
    );
  }
  return (
    process.env.LOCALAPPDATA ||
    path.resolve(cachedAppPath("appData"), "..", "Local")
  );
}

export function setVortexPath(id: ElectronPathId, value: string) {
  cache[id] = value;
  app.setPath(id, value);
}

/**
 * Main process version of getVortexPath.
 * This function provides paths to application data independent
 * of build configuration (development/production, asar/no-asar, portable/not).
 *
 * This version is designed to run ONLY in the main process where electron.app is available.
 */
export function getVortexPath(id: keyof VortexPaths): string {
  if (electronAppInfoEnv && Object.keys(electronAppInfoEnv).length > 0) {
    if (id in electronAppInfoEnv && electronAppInfoEnv[id]) {
      return electronAppInfoEnv[id];
    }
    // If not found, fall through to next logic (do not throw)
  }
  switch (id) {
    case "userData":
      return cachedAppPath("userData");
    case "temp":
      return cachedAppPath("temp");
    case "appData":
      return cachedAppPath("appData");
    case "localAppData":
      return localAppData();
    case "home":
      return cachedAppPath("home");
    case "documents":
      return cachedAppPath("documents");
    case "exe":
      return cachedAppPath("exe");
    case "desktop":
      return cachedAppPath("desktop");
    case "base":
      return basePath;
    case "base_unpacked":
      return isAsar ? basePath + ".unpacked" : basePath;
    case "application":
      return applicationPath;
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
