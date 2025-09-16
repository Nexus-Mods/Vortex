import * as electron from 'electron';
import * as os from 'os';
import * as path from 'path';
import { makeRemoteCallSync } from './electronRemote';

// If running as a forked child process, read Electron app info from environment variables
const electronAppInfoEnv: { [key: string]: string | undefined } = (typeof process.send === 'function') ? {
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
} : {};


const getElectronPath = (() => {
  if (electron && electron.app) {
    return makeRemoteCallSync('get-electron-path',
      (electronIn, webContents, id: string) => {
        if (!electronIn.app) {
          throw new Error('Electron app is not available. This code must run in the Electron main process.');
        }
        if (id === '__app') {
          return electronIn.app.getAppPath();
        }
        return electronIn.app.getPath(id as any);
      });
  }
  // Try to use @electron/remote or electron.remote in renderer
  try {
    // Prefer @electron/remote if available
    const electronRemote = require('@electron/remote');
    if (electronRemote && electronRemote.app) {
      return (id: string) => {
        if (id === '__app') return electronRemote.app.getAppPath();
        return electronRemote.app.getPath(id);
      };
    }
  } catch {}
  try {
    // Fallback to electron.remote if available
    if (electron && (electron as any).remote && (electron as any).remote.app) {
      return (id: string) => {
        if (id === '__app') return (electron as any).remote.app.getAppPath();
        return (electron as any).remote.app.getPath(id);
      };
    }
  } catch {}
  // Fallback for non-Electron processes
  return (id: string) => {
    if (id === '__app') {
      return path.resolve(__dirname, '..', '..');
    }
    return os.tmpdir();
  };
})();

const setElectronPath = makeRemoteCallSync('set-electron-path',
  (electronIn, webContents, id: string, value: string) => {
    electronIn.app.setPath(id as any, value);
});

export type AppPath = 'base' | 'assets' | 'assets_unpacked' | 'modules' | 'modules_unpacked'
                    | 'bundledPlugins' | 'locales' | 'package' | 'package_unpacked' | 'application'
                    | 'userData' | 'appData' | 'localAppData' | 'temp' | 'home' | 'documents'
                    | 'exe' | 'desktop';

/**
 * app.getAppPath() returns the path to the app.asar,
 * development: node_modules\electron\dist\resources\default_app.asar
 * production (with asar): Vortex\resources\app.asar
 * production (without asar): Vortex\resources\app
 *
 * when running from unit tests, app may not be defined at all, in that case we use __dirname
 * after all
 */
// let basePath = app !== undefined ? app.getAppPath() : path.resolve(__dirname, '..', '..');
let basePath = electron !== undefined ? getElectronPath('__app') : path.resolve(__dirname, '..', '..');
const isDevelopment = path.basename(basePath, '.asar') !== 'app';
const isAsar = !isDevelopment && (path.extname(basePath) === '.asar');
const applicationPath = isDevelopment
  ? basePath
  : path.resolve(path.dirname(basePath), '..');

if (isDevelopment) {
  // In Electron 37, app.getAppPath() may already point to the 'out' directory
  // Check if basePath already ends with 'out' to avoid double 'out/out'
  if (path.basename(basePath) === 'out') {
    // basePath is already correct (points to out directory)
    // Don't modify it
  } else {
    basePath = path.join(applicationPath, 'out');
  }
}

// basePath is now the path that contains assets, bundledPlugins, index.html, main.js and so on
// applicationPath is still different between development and production

function getModulesPath(unpacked: boolean): string {
  if (isDevelopment) {
    return path.join(applicationPath, 'node_modules');
  }
  const asarPath = unpacked && isAsar ? basePath + '.unpacked' : basePath;
  return path.join(asarPath, 'node_modules');
}

function getAssets(unpacked: boolean): string {
  const asarPath = unpacked && isAsar ? basePath + '.unpacked' : basePath;
  return path.join(asarPath, 'assets');
}

function getBundledPluginsPath(): string {
  // bundled plugins are never packed in the asar
  return isAsar
    ? path.join(basePath + '.unpacked', 'bundledPlugins')
    : path.join(basePath, 'bundledPlugins');
}

function getLocalesPath(): string {
  // in production builds the locales are not inside the app(.asar) directory but alongside it
  return isDevelopment
    ? path.join(basePath, 'locales')
    : path.resolve(basePath, '..', 'locales');
}

/**
 * path to the directory containing package.json file
 */
function getPackagePath(unpacked: boolean): string {
  if (isDevelopment) {
    return applicationPath;
  }

  let res = basePath;
  if (unpacked && (path.basename(res) === 'app.asar')) {
    res = path.join(path.dirname(res), 'app.asar.unpacked');
  }

  return res;
}

const cache: { [id: string]: string | (() => string) } = {};

const cachedAppPath = (id: string) => {
  if (cache[id] === undefined) {
    cache[id] = getElectronPath(id as any);
  }
  const value = cache[id];
  if (typeof value === 'string') {
    return value;
  } else {
    return value();
  }
};

const localAppData = (() => {
  let cached;
  return () => {
    if (cached === undefined) {
      cached = process.env.LOCALAPPDATA
        || path.resolve(cachedAppPath('appData'), '..', 'Local');
    }
    return cached;
  };
})();

export function setVortexPath(id: AppPath, value: string | (() => string)) {
  cache[id] = value;
  if (typeof value === 'string') {
    setElectronPath(id, value);
  } else {
    setElectronPath(id, value());
  }
}

/**
 * the electron getAppPath function and globals like __dirname
 * or process.resourcesPath don't do a great job of abstracting away
 * how the application is being built, e.g. development or not, asar or not,
 * webpack or not, portable or not.
 * This function aims to provide reasonable paths to application data independent
 * of any of that.
 */


function getVortexPath(id: AppPath): string {
  if (electronAppInfoEnv && Object.keys(electronAppInfoEnv).length > 0) {
    if (id in electronAppInfoEnv && electronAppInfoEnv[id]) {
      return electronAppInfoEnv[id]!;
    }
    // If not found, fall through to next logic (do not throw)
  }
  switch (id) {
    case 'userData': return cachedAppPath('userData');
    case 'temp': return cachedAppPath('temp');
    case 'appData': return cachedAppPath('appData');
    case 'localAppData': return localAppData();
    case 'home': return cachedAppPath('home');
    case 'documents': return cachedAppPath('documents');
    case 'exe': return cachedAppPath('exe');
    case 'desktop': return cachedAppPath('desktop');
    case 'base': return basePath;
    case 'application': return applicationPath;
    case 'package': return getPackagePath(false);
    case 'package_unpacked': return getPackagePath(true);
    case 'assets': return getAssets(false);
    case 'assets_unpacked': return getAssets(true);
    case 'modules': return getModulesPath(false);
    case 'modules_unpacked': return getModulesPath(true);
    case 'bundledPlugins': return getBundledPluginsPath();
    case 'locales': return getLocalesPath();
  }
}

export async function getVortexPathAsync(id: AppPath): Promise<string> {
  // 1. Forked child process: use env vars for all supported paths
  if (electronAppInfoEnv && Object.keys(electronAppInfoEnv).length > 0) {
    if (id in electronAppInfoEnv && electronAppInfoEnv[id]) {
      return electronAppInfoEnv[id]!;
    }
    // If not found, fall through to next logic (do not throw)
  }
  // 2. Main/renderer process: use electronRemote IPC if available
  try {
    const { makeRemoteCallSync: makeRemoteCall } = require('./electronRemote');
    const getElectronPathRemote = makeRemoteCall('get-electron-path',
      (electronIn, webContents, id: string) => {
        if (!electronIn.app) throw new Error('Electron app is not available.');
        if (id === '__app') return electronIn.app.getAppPath();
        return electronIn.app.getPath(id as any);
      });
    if (typeof getElectronPathRemote === 'function') {
      if (id === 'base') {
        return await Promise.resolve(getElectronPathRemote('__app'));
      }
      return await Promise.resolve(getElectronPathRemote(id));
    }
  } catch (e) {
    // ignore, fallback to sync logic
  }
  // 3. Fallback to sync logic
  switch (id) {
    // c:\users\<username>\appdata\roaming\vortex
    case 'userData': return cachedAppPath('userData');
    // c:\users\<username>\appdata\roaming\vortex\temp
    case 'temp': return cachedAppPath('temp');
    // c:\users\<username>\appdata\roaming
    case 'appData': return cachedAppPath('appData');
    // c:\users\<username>\appdata\local
    case 'localAppData': return localAppData();
    // C:\Users\Tannin
    case 'home': return cachedAppPath('home');
    // C:\Users\Tannin\Documents
    case 'documents': return cachedAppPath('documents');
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\Vortex.exe
    case 'exe': return cachedAppPath('exe');
    // C:\Users\Tannin\Desktop
    case 'desktop': return cachedAppPath('desktop');
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar
    case 'base': return basePath;
    // C:\Program Files\Black Tree Gaming Ltd\Vortex
    case 'application': return applicationPath;
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar
    case 'package': return getPackagePath(false);
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar.unpacked
    case 'package_unpacked': return getPackagePath(true);
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar\assets
    case 'assets': return getAssets(false);
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar.unpacked\assets
    case 'assets_unpacked': return getAssets(true);
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar\node_modules
    case 'modules': return getModulesPath(false);
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar.unpacked\node_modules
    case 'modules_unpacked': return getModulesPath(true);
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\app.asar.unpacked\bundledPlugins
    case 'bundledPlugins': return getBundledPluginsPath();
    // C:\Program Files\Black Tree Gaming Ltd\Vortex\resources\locales
    case 'locales': return getLocalesPath();
  }
}

export default getVortexPath;
