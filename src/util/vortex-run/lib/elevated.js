"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Bluebird = require("bluebird");
const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
let DUMMYUNIONNAME;
let SHELLEXECUTEINFO;
let voidPtr;
let SHELLEXECUTEINFOPtr;
let shell32;
class Win32Error extends Error {
    constructor(message, code) {
        super(message);
        this.name = this.constructor.name;
        this.mCode = code;
    }
    get code() {
        return this.mCode;
    }
}
exports.Win32Error = Win32Error;
function initTypes() {
    if (DUMMYUNIONNAME !== undefined) {
        return;
    }
    const ref = require('ref');
    const struct = require('ref-struct');
    const uniontype = require('ref-union');
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
function execInfo(scriptPath) {
    const ref = require('ref');
    const instApp = ref.alloc(voidPtr);
    return new SHELLEXECUTEINFO({
        cbSize: SHELLEXECUTEINFO.size,
        fMask: 0,
        hwnd: null,
        lpVerb: 'runas',
        lpFile: process.execPath,
        lpParameters: `--run ${scriptPath}`,
        lpDirectory: path.dirname(process.execPath),
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
function elevatedMain(moduleRoot, ipcPath, main) {
    const handleError = (error) => {
        // tslint:disable-next-line:no-console
        console.error('Elevated code failed', error.stack);
    };
    process.on('uncaughtException', handleError);
    process.on('unhandledRejection', handleError);
    // tslint:disable-next-line:no-shadowed-variable
    const path = require('path');
    const requireOrig = require;
    module.paths.push(moduleRoot);
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
function runElevated(ipcPath, func, args) {
    initTypes();
    if (shell32 === undefined) {
        if (process.platform === 'win32') {
            const ffi = require('ffi');
            const ref = require('ref');
            shell32 = new ffi.Library('Shell32', {
                ShellExecuteA: [ref.types.int32, [voidPtr, ref.types.CString, ref.types.CString,
                        ref.types.CString, ref.types.CString, ref.types.int32]],
                ShellExecuteExA: ['bool', [SHELLEXECUTEINFOPtr]],
            });
        }
    }
    return new Bluebird((resolve, reject) => {
        tmp.file((err, tmpPath, fd, cleanup) => {
            if (err) {
                return reject(err);
            }
            const projectRoot = path.resolve(__dirname, '../..').split('\\').join('/');
            let mainBody = elevatedMain.toString();
            mainBody = mainBody.slice(mainBody.indexOf('{') + 1, mainBody.lastIndexOf('}'));
            let prog = `
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
            fs.write(fd, prog, (writeErr, written, str) => {
                if (writeErr) {
                    cleanup();
                    return reject(writeErr);
                }
                const runInfo = execInfo(tmpPath);
                // we can't call GetLastError through node-ffi so when using ShellExecuteExA we won't be
                // able to get an error code. With ShellExecuteA we can
                shell32.ShellExecuteA.async(null, 'runas', process.execPath, `--run ${tmpPath}`, path.dirname(process.execPath), 5, (execErr, res) => {
                    setTimeout(cleanup, 5000);
                    if (execErr) {
                        reject(execErr);
                    }
                    else {
                        if (res > 32) {
                            resolve(res);
                        }
                        else {
                            reject(new Win32Error('ShellExecute failed', res));
                        }
                    }
                });
                /* TODO: remove this code if there is no problem with ShellExecuteA
                shell32.ShellExecuteExA.async(runInfo.ref(), (execErr: any, res: any) => {
                  // this is reached after the user confirmed the UAC dialog but before node
                  // has read the script source so we have to give a little time for that to
                  // happen before we can remove the tmp file
                  setTimeout(cleanup, 5000);
                  if (execErr) {
                    reject(execErr);
                  } else {
                    if (res) {
                      resolve(res);
                    } else {
                      reject(new Error(`ShellExecute failed, errorcode ${res}`));
                    }
                  }
                });
                */
            });
        });
    });
}
exports.default = runElevated;
