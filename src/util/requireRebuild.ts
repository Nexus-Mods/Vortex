import { log } from './log';

import { spawnSync, SpawnSyncOptions } from 'child_process';
import { createHash } from 'crypto';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra';
import {} from 'module';
import * as os from 'os';
import * as path from 'path';
import * as reqResolve from 'resolve';

const app = appIn || remote.app;

// tslint:disable-next-line:no-var-requires
const Module = require('module');

const loggingHandler = {
  get: (obj, prop) => {
    if (typeof(obj[prop]) === 'function') {
      return function(...args) {
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

const cachePath = path.join(app.getPath('temp'), 'native_cache');
fs.ensureDirSync(cachePath);

// based on https://github.com/juliangruber/require-rebuild
const mismatchExp = /Module version mismatch/;
const differentVersionExp = /was compiled against a different Node\.js version/;
const winExp = /A dynamic link library \(DLL\) initialization routine failed./;
const noBindingsExp = /Could not locate the bindings file/;
const noModuleExp = /Cannot find module/;
const fckingNodeSassExp = /Node Sass does not yet support your current environment/;
const edgeExp = /The edge module has not been pre-compiled/;

// modules that we will build even if they haven't been build yet
const initBuild = [
  'turbowalk',
  'icon-extract',
];

const headerURL = 'https://atom.io/download/electron';

function patchedLoad(orig) {
  const processed = new Set<string>();
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
      if (!mismatchExp.test(err.message)
          && !differentVersionExp.test(err.message)
          && !winExp.test(err.message)
          && !noBindingsExp.test(err.message)
          && !fckingNodeSassExp.test(err.message)
          && !edgeExp.test(err.message)
          && (!noModuleExp.test(err.message) || (initBuild.indexOf(request) === -1))) {
        throw err;
      }

      // don't go into endless loops
      if (processed.has(request)) {
        log('info', 'already processed', request);
        throw err;
      }
      processed.add(request);

      const resolved = reqResolve.sync(request, {
        basedir: path.dirname(parent.id),
        extensions: ['.js', '.json', '.node'],
      });

      const segments = resolved.split(path.sep);
      const modulesIdx = segments.indexOf('node_modules');
      if (modulesIdx === -1) {
        throw err;
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

          return orig.apply(this, arguments);
        }
      }

      log('info', 'rebuilding ', moduleName);

      const gypArgs: string[] = [
        'rebuild',
        '--target=' + (process.versions as any).electron,
        '--arch=' + process.arch,
        `--dist-url=${headerURL}`,
        '--build-from-source',
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

      let nodeGyp = path.join(nodeModules, '.bin', 'node-gyp');
      if (process.platform === 'win32') {
        nodeGyp = nodeGyp + '.cmd';
      }

      const proc = spawnSync(nodeGyp, gypArgs, spawnOptions);
      if (proc.error) {
        log('info', 'stdout', proc.stdout);
        log('error', 'stderr', proc.stderr);
        throw proc.error;
      }

      if (nodeFile === undefined) {
        nodeFile = fs.readdirSync(buildPath).find(fileName => fileName.endsWith('.node'));
      }
      const fileBuildPath = path.join(buildPath, nodeFile);

      fs.copySync(fileBuildPath, fileABIPath);
      if (hash !== undefined) {
        fs.copySync(fileBuildPath, fileCachePath);
        fs.writeFileSync(fileCachePath + '.hash', hash);
      }
      log('info', 'rebuild done');
      return orig.apply(this, arguments);
    }
  };
}

export default function() {
  const orig = (Module as any)._load;
  (Module as any)._load = patchedLoad(orig);
}
