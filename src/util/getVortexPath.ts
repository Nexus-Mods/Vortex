import { app as appIn } from 'electron';
import * as path from 'path';

const app = process.type === 'browser'
  ? appIn
  // tslint:disable-next-line:no-var-requires
  : require('@electron/remote').app;

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
let basePath = app !== undefined ? app.getAppPath() : path.resolve(__dirname, '..', '..');
const isDevelopment = path.basename(basePath, '.asar') !== 'app';
const isAsar = !isDevelopment && (path.extname(basePath) === '.asar');
const applicationPath = isDevelopment
  ? basePath
  : path.resolve(path.dirname(basePath), '..');

if (isDevelopment) {
  basePath = path.join(applicationPath, 'out');
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

const cachedAppPath = (() => {
  const cache: { [id: string]: string } = {};
  return (id: string) => {
    if (cache[id] === undefined) {
      cache[id] = app.getPath(id as any);
    }
    return cache[id];
  };
})();

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

/**
 * the electron getAppPath function and globals like __dirname
 * or process.resourcesPath don't do a great job of abstracting away
 * how the application is being built, e.g. development or not, asar or not,
 * webpack or not, portable or not.
 * This function aims to provide paths to application data independent
 * of any of that.
 */
function getVortexPath(id: AppPath): string {
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
