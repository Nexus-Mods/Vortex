import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = remote !== undefined ? remote.app : appIn;

export type CachedPath = 'userData' | 'temp' | 'appData' | 'home' | 'documents'
export type AppPath = 'base' | 'assets' | 'assets_unpacked' | 'modules' | 'modules_unpacked'
                    | 'bundledPlugins' | 'locales' | 'package' | 'resources'
                    | CachedPath;

/**
 * app.getAppPath() returns the path to the app.asar,
 * development: node_modules\electron\dist\resources\default_app.asar
 * production (with asar): Vortex\resources\app.asar
 * production (without asar): Vortex\resources\app
 *
 * when running from unit tests, app may not be defined at all, in that case we use __dirname
 * after all
 */
const appPath = app !== undefined ? app.getAppPath() : path.resolve(__dirname, '..', '..');
const isDevelopment = path.basename(appPath, '.asar') !== 'app';
const resourcePath =  isDevelopment ? path.resolve(appPath, '..') : process.resourcesPath;

// appPath is the path to the dir containing main.js, index.html, etc.
// resourcePath is the path to the dir containing unpacked resources: assets, bundledPlugins, locales, etc.

function getModulesPath(unpacked: boolean): string {
  if (isDevelopment) {
    return path.join(resourcePath, 'node_modules');
  }
  const asarPath = unpacked ? appPath + '.unpacked' : appPath;
  return path.join(asarPath, 'node_modules');
}

function getAssets(unpacked: boolean): string {
  // In development, [un]packed locations are inverted. XOR to flip when both true
  const base = (+unpacked ^ +isDevelopment) ? resourcePath : appPath;
  return path.join(base, 'assets');
}

function getBundledPluginsPath(): string {
  return path.join(isDevelopment ? appPath : resourcePath, 'bundledPlugins');
}

function getLocalesPath(): string {
  return path.resolve(resourcePath, 'locales');
}

const { get: cachedAppPath, set: setCachedAppPath } = (() => {
  const cache: { [id: string]: string } = {};
  return {
    get: (id: CachedPath) => {
      if (cache[id] === undefined) {
        cache[id] = app.getPath(id as any);
      }
      return cache[id];
    },
    set: (id: CachedPath, val: string) => {
      app.setPath(id, val);
      return cache[id] = val;
    }
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
export function getVortexPath(id: AppPath): string {
  switch (id) {
    case 'userData': return cachedAppPath('userData');
    case 'temp': return cachedAppPath('temp');
    case 'appData': return cachedAppPath('appData');
    case 'home': return cachedAppPath('home');
    case 'documents': return cachedAppPath('documents');
    case 'base': return appPath;
    case 'package': return appPath;
    case 'assets': return getAssets(false);
    case 'assets_unpacked': return getAssets(true);
    case 'modules': return getModulesPath(false);
    case 'modules_unpacked': return getModulesPath(true);
    case 'bundledPlugins': return getBundledPluginsPath();
    case 'locales': return getLocalesPath();
    case 'resources': return resourcePath;
  }
}

export {setCachedAppPath as setVortexPath};

export default getVortexPath;
