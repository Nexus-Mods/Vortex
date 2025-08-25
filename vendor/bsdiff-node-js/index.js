"use strict";

const fs = require("fs");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Node-style callback helper: if cb provided, use it; otherwise return a Promise.
 */
function nodeify(promise, cb) {
    if (typeof cb === "function") {
        promise.then((res) => cb(null, res)).catch((err) => cb(err));
        return undefined;
    }
    return promise;
}

/**
 * Create a "patch" that is simply the full contents of dstFile.
 * @param {string} srcFile
 * @param {string} dstFile
 * @param {string} patchFile
 * @param {(err?:Error)=>void} [cb]
 */
function diff(srcFile, dstFile, patchFile, cb) {
    const work = (async () => {
        // Read new file and store as patch
        const data = await readFile(dstFile);
        await writeFile(patchFile, data);
    })();
    return nodeify(work, cb);
}

/**
 * Apply a "patch" by copying patchFile to dstFile. Ignores srcFile.
 * @param {string} srcFile
 * @param {string} patchFile
 * @param {string} dstFile
 * @param {(err?:Error)=>void} [cb]
 */
function patch(srcFile, patchFile, dstFile, cb) {
    const work = (async () => {
        const data = await readFile(patchFile);
        await writeFile(dstFile, data);
    })();
    return nodeify(work, cb);
}

module.exports = { diff, patch };