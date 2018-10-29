"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
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
            .join(', ')
        : ''});\n
        postMessage(res, undefined);\n
        close();\n
      `;
    return prog;
}
function runThreaded(func, moduleBase, ...args) {
    return new Promise((resolve, reject) => {
        tmp.file((err, tmpPath, fd, cleanup) => {
            if (err) {
                return reject(err);
            }
            const program = writeProgram(func, moduleBase, args);
            fs.write(fd, program, (writeErr, written, str) => {
                if (writeErr) {
                    cleanup();
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
