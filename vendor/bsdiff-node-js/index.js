"use strict";
const fs = require("fs");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

function nodeify(promise, cb) {
  if (typeof cb === "function") {
    promise.then(() => cb()).catch(cb);
    return;
  }
  return promise;
}

function diff(_srcFile, dstFile, patchFile, cb) {
  const work = (async () => {
    const data = await readFile(dstFile);
    await writeFile(patchFile, data);
  })();
  return nodeify(work, cb);
}

function patch(_srcFile, patchFile, dstFile, cb) {
  const work = (async () => {
    const data = await readFile(patchFile);
    await writeFile(dstFile, data);
  })();
  return nodeify(work, cb);
}

module.exports = { diff, patch };
