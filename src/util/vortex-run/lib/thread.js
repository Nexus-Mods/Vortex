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
function trampoline(baseDir, moduleRoot, main) {
    const innerPath = require('path');
    const requireOrig = require;
    const newRequire = (id) => {
        if (id.startsWith('.')) {
            return requireOrig(innerPath.join(baseDir, id));
        }
        else {
            return requireOrig(id);
        }
    };
    newRequire.requireActual = newRequire;
    require = newRequire;
    module.paths.push(moduleRoot);
}
function writeProgram(func, moduleBase, args) {
    const projectRoot = path.resolve(__dirname, '../../node_modules').split('\\').join('/');
    let mainBody = trampoline.toString();
    mainBody = mainBody.slice(mainBody.indexOf('{') + 1, mainBody.lastIndexOf('}'));
    let prog = `
        let moduleRoot = '${projectRoot}';\n
        let baseDir = '${moduleBase.replace(/\\/g, '/')}';\n
      `;
    args.forEach(arg => {
        if (arg instanceof Function) {
            prog += arg.toString() + '\n';
        }
    });
    prog += `
        let main = ${func.toString()};\n
        ${mainBody}\n
        const res = main(${args !== undefined
        ? args.filter(arg => !(arg instanceof Function))
            .map(arg => JSON.stringify(arg))
            .join(', ') + ', require'
        : 'require'});\n
        if ((res !== undefined) && (res.then !== undefined)) {
          res.then(result => {
            postMessage(result, undefined);
            close();
          });
        } else {
          postMessage(res, undefined);\n
          close();
        }\n
      `;
    return prog;
}
function runThreaded(func, moduleBase, ...args) {
    return new bluebird_1.default((resolve, reject) => {
        tmp.file({ postfix: '.js' }, (err, tmpPath, fd, cleanup) => {
            if (err) {
                return reject(err);
            }
            const program = writeProgram(func, moduleBase, args);
            fs.write(fd, program, (writeErr, written, str) => {
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
                fs.close(fd, () => {
                    const worker = new Worker(tmpPath);
                    worker.onmessage = evt => {
                        return resolve(evt.data);
                    };
                });
            });
        });
    });
}
exports.default = runThreaded;
