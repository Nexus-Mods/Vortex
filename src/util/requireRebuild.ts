import { log } from './log';

import { spawnSync, SpawnSyncOptions } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import {} from 'module';
import * as os from 'os';
import * as path from 'path';
import * as reqResolve from 'resolve';
import getVortexPath from './getVortexPath';

// tslint:disable-next-line:no-var-requires
const Module = require('module');

const loggingHandler = {
  get: (obj, prop) => {
    if (typeof(obj[prop]) === 'function') {
      // tslint:disable-next-line:only-arrow-functions
      return function(...args) {
        // tslint:disable-next-line:no-console
        console.log(prop, args);
        return obj[prop](...args);
      };
    } else {
      return obj[prop];
    }
  },
};

// add module names here to get a console message for every call to a function of
// that module (in development runs only) including arguments.
// e.g. const modulesToLog = new Set(['https']);
const modulesToLog = new Set([]);

const cachePath = path.join(getVortexPath('temp'), 'native_cache');
fs.ensureDirSync(cachePath);

// whitelist of native libraries that we know should load correctly.
// If one of these doesn't load correctly, rebuild it
const nativeLibs = [
  'crash-dump',
  'diskusage',
  'drivelist',
  'leveldown',
  'msgpack',
  'native-errors',
  'permissions',
  'vortexmt',
  'winapi-bindings',
  'icon-extract',
  'windump',
];

// const headerURL = 'https://atom.io/download/electron';
const headerURL = 'https://www.electronjs.org/headers';

// based on https://github.com/juliangruber/require-rebuild
function makeRebuildFunc(orig) {
  const processed = new Set();

  return (parent: typeof Module, request: string) => {
    // don't go into endless loops
    if (processed.has(request)) {
      log('info', 'already processed', request);
      return true;
    }
    processed.add(request);

    const resolved = reqResolve.sync(request, {
      basedir: path.dirname(parent.id),
      extensions: ['.js', '.json', '.node'],
    });

    const segments = resolved.split(path.sep);
    const modulesIdx = segments.indexOf('node_modules');
    if (modulesIdx === -1) {
      return false;
    }

    const nodeModules = segments.slice(0, modulesIdx + 1).join(path.sep);
    const moduleName = segments[modulesIdx + 1];
    const modulePath = path.join(nodeModules, moduleName);
    const versionString = `${process.platform}-${process.arch}-${process.versions.modules}`;
    const abiPath = path.resolve(modulePath, 'bin', versionString);
    const buildPath = path.join(modulePath, 'build', 'Release');
    fs.ensureDirSync(buildPath);
    let nodeFile = fs.readdirSync(buildPath).find(fileName => fileName.endsWith('.node'));
    const fileCachePath = path.join(cachePath, versionString, moduleName + '.node');
    const fileABIPath = path.join(abiPath, moduleName + '.node');

    const hash = nodeFile !== undefined
      ? createHash('md5').update(fs.readFileSync(path.join(buildPath, nodeFile))).digest('hex')
      : undefined;

    fs.ensureDirSync(abiPath);
    if (fs.existsSync(fileCachePath) && (nodeFile !== undefined)) {
      const cacheHash = fs.readFileSync(fileCachePath + '.hash').toString();
      if (cacheHash === hash) {
        log('info', 'using cache', moduleName);
        fs.copySync(fileCachePath, fileABIPath);
        fs.copySync(fileCachePath, path.join(buildPath, nodeFile));

        return true;
      }
    }

    log('info', 'rebuilding ', { moduleName, process: process.type });

    const gypArgs: string[] = [
      /*
      'rebuild',
      '--target=' + (process.versions as any).electron,
      '--arch=' + process.arch,
      `--dist-url=${headerURL}`,
      '--build-from-source',
      */
     'install',
    ];
    const spawnOptions: SpawnSyncOptions = {
      cwd: modulePath,
      env: {
        ...process.env,
        HOME: path.resolve(os.homedir(), '.electron-gyp'),
        USERPROFILE: path.resolve(os.homedir(), '.electron-gyp'),
        npm_config_disturl: headerURL,
        npm_config_runtime: 'electron',
        npm_config_arch: process.arch,
        npm_config_target_arch: process.arch,
        npm_config_build_from_source: 'true',
      },
    };

    // let nodeGyp = path.join(nodeModules, '.bin', 'node-gyp');
    let nodeGyp = 'yarn';
    if (process.platform === 'win32') {
      nodeGyp = nodeGyp + '.cmd';
    }

    const proc = spawnSync(nodeGyp, gypArgs, spawnOptions);
    log('info', 'stdout', proc.stdout.toString());
    log('error', 'stderr', proc.stderr.toString());

    if (proc.error) {
      throw proc.error;
    }

    if (nodeFile === undefined) {
      try {
        nodeFile = fs.readdirSync(buildPath).find(fileName => fileName.endsWith('.node'));
      } catch (err) {
        log('warn', 'not found', { buildPath });
      }
    }
    if (nodeFile === undefined) {
      return false;
    }
    const fileBuildPath = path.join(buildPath, nodeFile);

    fs.copySync(fileBuildPath, fileABIPath);
    if (hash !== undefined) {
      fs.copySync(fileBuildPath, fileCachePath);
      fs.writeFileSync(fileCachePath + '.hash', hash);
    }
    log('info', 'rebuild done');
    return true;
  };
}

function patchedLoad(orig) {
  const rebuildLib = makeRebuildFunc(orig);
  // tslint:disable-next-line:only-arrow-functions
  return function(request: string, parent: typeof Module) {
    try {
      const res = orig.apply(this, arguments);
      if (modulesToLog.has(request)) {
        return new Proxy(res, loggingHandler);
      } else {
        return res;
      }
    } catch (err) {
      const reqName = path.basename(request);
      if (nativeLibs.includes(reqName)) {
        if (rebuildLib(parent, request)) {
          return orig.apply(this, arguments);
        } else {
          throw err;
        }
      }
      throw err;
    }
  };
}

export default function() {
  const orig = (Module as any)._load;
  (Module as any)._load = patchedLoad(orig);
}
