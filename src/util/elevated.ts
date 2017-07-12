import * as Promise from 'bluebird';
import * as ffi from 'ffi';
import * as fs from 'fs';
import * as path from 'path';
import * as ref from 'ref';
import * as struct from 'ref-struct';
import * as uniontype from 'ref-union';

import * as tmp from 'tmp';

const DUMMYUNIONNAME = uniontype({
  hIcon: ref.refType(ref.types.void),
  hMonitor: ref.refType(ref.types.void),
});

const voidPtr = ref.refType(ref.types.void);

const SHELLEXECUTEINFO = struct({
  cbSize: ref.types.uint32,
  fMask: ref.types.uint32,
  hwnd: voidPtr,
  lpVerb: ref.types.CString,
  lpFile: ref.types.CString,
  lpParameters: ref.types.CString,
  lpDirectory: ref.types.CString,
  nShow: ref.types.int32,
  hInstApp: voidPtr,
  lpIDList: voidPtr,
  lpClass: ref.types.CString,
  hkeyClass: voidPtr,
  dwHotKey: ref.types.uint32,
  DUMMYUNIONNAME,
  hProcess: voidPtr,
});

const SHELLEXECUTEINFOPtr = ref.refType(SHELLEXECUTEINFO);
let shell32;

function execInfo(scriptPath: string, parameters?: string[]) {
  const instApp = ref.alloc(voidPtr);

  const paramStr = parameters !== undefined ? ' ' + parameters.join(' ') : '';

  return new SHELLEXECUTEINFO({
    cbSize: SHELLEXECUTEINFO.size,
    fMask: 0,
    hwnd: null,
    lpVerb: 'runas',
    lpFile: process.execPath,
    //    lpFile: 'node.exe',
    lpParameters: scriptPath + paramStr,
    lpDirectory: __dirname,
    nShow: 0x01,
    hInstApp: instApp,
    lpIDList: null,
    lpCLass: null,
    hkeyClass: null,
    dwHotKey: null,
    DUMMYUNIONNAME: {
      hIcon: null,
      hMonitor: null,
    },
    hProcess: ref.alloc(voidPtr),
  });
}

function elevatedMain(baseDir: string, moduleRoot: string, ipcPath: string, main: (ipc) => void) {
  const path = require('path');
  const requireOrig = require;
  const newRequire: any = (id: string): any => {
    if (id.startsWith('.')) {
      return requireOrig(path.join(baseDir, id));
    } else {
      return requireOrig(id);
    }
  };
  newRequire.requireActual = newRequire;
  require = newRequire;
  (module as any).paths.push(moduleRoot);
  const ipc = require('node-ipc');
  ipc.connectTo(ipcPath, ipcPath, () => {
    ipc.of[ipcPath].on('quit', () => {
      process.exit(0);
    });
    main(ipc.of[ipcPath]);
  });
}

/**
 * run a function as an elevated process (windows only!).
 * This is quite a hack because obviously windows doesn't allow us to elevate a
 * running process so instead we have to store the function code into a file and start a
 * new node process elevated to execute that script.
 * Through some hackery the base path for relative requires can be set.
 *
 * IMPORTANT As a consequence the function can not bind any parameters
 *
 * @param {string} ipcPath a unique identifier for a local ipc channel that can be used to
 *                 communicate with the elevated process (as stdin/stdout can not be)
 *                 redirected
 * @param {Function} func The closure to run in the elevated process. Try to avoid
 *                        'fancy' code.
 * @param {Object} args arguments to be passed into the elevated process
 * @param {string} moduleBase base directory for all relative require call. If undefined,
 *                 the directory of this very file (elevated.js) will be used.
 * @returns {Promise<any>} a promise that will be resolved as soon as the process is started
 *                         (which happens after the user confirmed elevation)
 */
function runElevated(ipcPath: string, func: (ipc: any) => void,
                     args?: any, moduleBase?: string): Promise<any> {
  if (shell32 === undefined) {
    if (process.platform === 'win32') {
      shell32 = new ffi.Library('Shell32', {
        ShellExecuteExA: ['bool', [SHELLEXECUTEINFOPtr]],
      });
    }
  }
  return new Promise((resolve, reject) => {
    tmp.file((err: any, tmpPath: string, fd: number, cleanup: () => void) => {
      if (err) {
        return reject(err);
      }

      const projectRoot = path.resolve(__dirname, '../../node_modules').split('\\').join('/');
      if (moduleBase === undefined) {
        moduleBase = __dirname;
      }
      moduleBase = moduleBase.split('\\').join('/');

      let mainBody = elevatedMain.toString();
      mainBody = mainBody.slice(mainBody.indexOf('{') + 1, mainBody.lastIndexOf('}'));

      let prog: string = `
        let moduleRoot = '${projectRoot}';\n
        let baseDir = '${moduleBase}';\n
        let ipcPath = '${ipcPath}';\n
      `;

      if (args !== undefined) {
        for (const argKey of Object.keys(args)) {
          if (args.hasOwnProperty(argKey)) {
            prog += `let ${argKey} = ${JSON.stringify(args[argKey])};\n`;
          }
        }
      }

      prog += `
        let main = ${func.toString()};\n
        ${mainBody}\n
      `;

      fs.write(fd, prog, (writeErr: any, written: number, str: string) => {
        if (writeErr) {
          cleanup();
          return reject(writeErr);
        }

        const runInfo = execInfo(tmpPath);

        shell32.ShellExecuteExA.async(runInfo.ref(), (execErr: any, res: any) => {
          // this is reached after the user confirmed the UAC dialog but before node
          // has read the script source so we have to give a little time for that to
          // happen before we can remove the tmp file
          // setTimeout(cleanup, 1000);
          if (execErr) {
            reject(execErr);
          } else {
            resolve(res);
          }
        });
      });
    });
  });
}

export default runElevated;
