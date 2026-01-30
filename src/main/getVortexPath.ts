import { app } from "electron";
import * as os from "os";
import * as path from "path";

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
    return applicationPath;
  }

  let res = basePath;
  if (unpacked && path.basename(res) === "app.asar") {
    res = path.join(path.dirname(res), "app.asar.unpacked");
  }

  return res;
}

const cache: { [id: string]: string | (() => string) } = {};

const cachedAppPath = (id: string) => {
  if (cache[id] === undefined) {
    if (app !== undefined) {
      if (id === "__app") {
        cache[id] = app.getAppPath();
      } else {
        cache[id] = app.getPath(id as any);
      }
    } else {
      // Fallback for non-Electron processes (tests)
      if (id === "__app") {
        cache[id] = path.resolve(__dirname, "..", "..");
      } else {
        cache[id] = os.tmpdir();
      }
    }
  }
  const value = cache[id];
  if (typeof value === "string") {
    return value;
  } else {
    return value();
  }
};

const localAppData = (() => {
  let cached;
  return () => {
    if (cached === undefined) {
      cached =
        process.env.LOCALAPPDATA ||
        path.resolve(cachedAppPath("appData"), "..", "Local");
    }
    return cached;
  };
})();

export function setVortexPath(id: AppPath, value: string | (() => string)) {
  cache[id] = value;
  if (app !== undefined) {
    if (typeof value === "string") {
      app.setPath(id as any, value);
    } else {
      app.setPath(id as any, value());
    }
  }
}

/**
 * Main process version of getVortexPath.
 * This function provides paths to application data independent
 * of build configuration (development/production, asar/no-asar, portable/not).
 *
 * This version is designed to run ONLY in the main process where electron.app is available.
 */
function getVortexPath(id: AppPath): string {
  if (electronAppInfoEnv && Object.keys(electronAppInfoEnv).length > 0) {
    if (id in electronAppInfoEnv && electronAppInfoEnv[id]) {
      return electronAppInfoEnv[id]!;
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

export default getVortexPath;
