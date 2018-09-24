import * as Bluebird from 'bluebird';
import * as ffi from 'ffi';
import * as fs from 'fs';
import * as path from 'path';
import * as ref from 'ref';
import * as struct from 'ref-struct';
import * as uniontype from 'ref-union';

import * as tmp from 'tmp';

let DUMMYUNIONNAME: uniontype;
let SHELLEXECUTEINFO: struct;
let voidPtr: ref.Type;
let SHELLEXECUTEINFOPtr: ref.Type;
let shell32;

export class Win32Error extends Error {
  private mCode: number;
  constructor(message: string, code: number) {
    super(`${message} (${code})`);
    this.name = this.constructor.name;
    this.mCode = code;
  }

  public get code(): number {
    return this.mCode;
  }
}

function initTypes() {
  if (DUMMYUNIONNAME !== undefined) {
    return;
  }

  voidPtr = ref.refType(ref.types.void);

  DUMMYUNIONNAME = uniontype({
    hIcon: voidPtr,
    hMonitor: voidPtr,
  });

  SHELLEXECUTEINFO = struct({
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
    dwHotKey: ref.types.uint32, DUMMYUNIONNAME,
    hProcess: voidPtr,
  });

  SHELLEXECUTEINFOPtr = ref.refType(SHELLEXECUTEINFO);
}

function elevatedMain(moduleRoot: string, ipcPath: string,
                      main: (ipc, req: NodeRequireFunction) =>
                        void | Promise<void> | Bluebird<void>) {
  const handleError = (error: any) => {
    // tslint:disable-next-line:no-console
    console.error('Elevated code failed', error.stack);
  };
  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);
  // tslint:disable-next-line:no-shadowed-variable
  (module as any).paths.push(moduleRoot);
  // tslint:disable-next-line:no-shadowed-variable
  const ipc = require('node-ipc');
  ipc.config.maxRetries = 5;
  ipc.config.stopRetrying = 5;
  ipc.connectTo(ipcPath, ipcPath, () => {
    ipc.of[ipcPath].on('quit', () => {
      process.exit(0);
    });
    Promise.resolve()
      .then(() => Promise.resolve(main(ipc.of[ipcPath], require)))
      .catch(error => {
        ipc.of[ipcPath].emit('error', error.message);
        return new Promise((resolve) => setTimeout(resolve, 200));
      })
      .then(() => {
        ipc.disconnect(ipcPath);
        process.exit(0);
      });
  });
}

/**
 * run a function as an elevated process (windows only!).
 * This is quite a hack because obviously windows doesn't allow us to elevate a
 * running process so instead we have to store the function code into a file and start a
 * new node process elevated to execute that script.
 *
 * IMPORTANT As a consequence the function can not bind any parameters
 *
 * @param {string} ipcPath a unique identifier for a local ipc channel that can be used to
 *                 communicate with the elevated process (as stdin/stdout can not be)
 *                 redirected
 * @param {Function} func The closure to run in the elevated process. Try to avoid
 *                        'fancy' code. This function receives two parameters, one is an ipc stream,
 *                        connected to the path specified in the first parameter.
 *                        The second function is a require function which you need to use instead of
 *                        the global require. Regular require calls will not work in production
 *                        builds
 * @param {Object} args arguments to be passed into the elevated process
 * @returns {Bluebird<any>} a promise that will be resolved as soon as the process is started
 *                          (which happens after the user confirmed elevation)
 */
function runElevated(ipcPath: string, func: (ipc: any, req: NodeRequireFunction) =>
                        void | Promise<void> | Bluebird<void>,
                     args?: any): Bluebird<any> {
  initTypes();
  if (shell32 === undefined) {
    if (process.platform === 'win32') {
      shell32 = new ffi.Library('Shell32', {
        ShellExecuteA: [ref.types.int32, [voidPtr, ref.types.CString, ref.types.CString,
                                ref.types.CString, ref.types.CString, ref.types.int32]],
        ShellExecuteExA: ['bool', [SHELLEXECUTEINFOPtr]],
      });
    }
  }
  return new Bluebird((resolve, reject) => {
    tmp.file((err: Error, tmpPath: string, fd: number, cleanup: () => void) => {
      if (err) {
        return reject(err);
      }

      const projectRoot = path.resolve(__dirname, '../..').split('\\').join('/');

      let mainBody = elevatedMain.toString();
      mainBody = mainBody.slice(mainBody.indexOf('{') + 1, mainBody.lastIndexOf('}'));

      let prog: string = `
        let moduleRoot = '${projectRoot}';\n
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

      fs.write(fd, prog, (writeErr: Error, written: number, str: string) => {
        if (writeErr) {
          cleanup();
          return reject(writeErr);
        }

        // we can't call GetLastError through node-ffi so when using ShellExecuteExA we won't be
        // able to get an error code. With ShellExecuteA we can
        shell32.ShellExecuteA.async(null, 'runas', process.execPath, `--run ${tmpPath}`,
                                    path.dirname(process.execPath), 5, (execErr: any, res: any) => {
          setTimeout(cleanup, 5000);
          if (execErr) {
            reject(execErr);
          } else {
            if (res > 32) {
              resolve(res);
            } else {
              reject(new Win32Error('ShellExecute failed', res));
            }
          }
        });
      });
    });
  });
}

export default runElevated;
