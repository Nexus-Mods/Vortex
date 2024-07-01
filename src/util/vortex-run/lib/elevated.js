"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_1 = __importDefault(require("bluebird"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tmp = __importStar(require("tmp"));
const winapi = __importStar(require("winapi-bindings"));
function elevatedMain(moduleRoot, ipcPath, main) {
    let client;
    const syntaxErrors = ['ReferenceError'];
    const handleError = (error) => {
        const testIfScriptInvalid = () => {
            syntaxErrors.forEach(errType => {
                if (error.stack.startsWith(errType)) {
                    error = 'InvalidScriptError: ' + error.stack;
                    client.sendEndError(error);
                }
            });
        };
        // tslint:disable-next-line:no-console
        console.error('Elevated code failed', error.stack);
        if (client !== undefined) {
            testIfScriptInvalid();
        }
    };
    process.on('uncaughtException', handleError);
    process.on('unhandledRejection', handleError);
    // tslint:disable-next-line:no-shadowed-variable
    module.paths.push(moduleRoot);
    // tslint:disable-next-line:no-shadowed-variable
    const net = require('net');
    const JsonSocket = require('json-socket');
    // tslint:disable-next-line:no-shadowed-variable
    const path = require('path');
    client = new JsonSocket(new net.Socket());
    client.connect(path.join('\\\\?\\pipe', ipcPath));
    client.on('connect', () => {
        Promise.resolve(main(client, require))
            .catch(error => {
            client.sendError(error);
        })
            .finally(() => {
            client.end();
            // process.exit(0);
        });
    })
        .on('close', () => {
        process.exit(0);
    })
        .on('error', err => {
        if (err.code !== 'EPIPE') {
            // will anyone ever see this?
            // tslint:disable-next-line:no-console
            console.error('Connection failed', err.message);
        }
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
 * @returns {Bluebird<string>} a promise that will be resolved as soon as the process is started
 *                             (which happens after the user confirmed elevation). It resolves to
 *                             the path of the tmpFile we had to create. If the caller can figure
 *                             out when the process is done (using ipc) it should delete it
 */
function runElevated(ipcPath, func, args) {
    return new bluebird_1.default((resolve, reject) => {
        tmp.file({ postfix: '.js' }, (err, tmpPath, fd, cleanup) => {
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
                    try {
                        cleanup();
                    }
                    catch (cleanupErr) {
                        // tslint:disable-next-line:no-console
                        console.error('failed to clean up temporary script', cleanupErr.message);
                    }
                    return reject(writeErr);
                }
                try {
                    fs.closeSync(fd);
                }
                catch (err) {
                    if (err.code !== 'EBADF') {
                        return reject(err);
                    }
                    // not sure what causes EBADF, don't want to return now if there is a chance this
                    // will actually work
                }
                try {
                    winapi.ShellExecuteEx({
                        verb: 'runas',
                        file: process.execPath,
                        parameters: `--run ${tmpPath}`,
                        directory: path.dirname(process.execPath),
                        show: 'shownormal',
                    });
                    return resolve(tmpPath);
                }
                catch (err) {
                    return reject(err);
                }
            });
        });
    });
}
exports.default = runElevated;
