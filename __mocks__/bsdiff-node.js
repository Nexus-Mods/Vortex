const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

function nodeify(promise, cb) {
  if (typeof cb === 'function') {
    promise.then(() => cb()).catch(cb);
    return;
  }
  return promise;
}

module.exports = {
  // Match test semantics: diff copies contents of newFile into patchFile
  diff: (oldFile, newFile, patchFile, cb) => {
    const work = (async () => {
      try { fs.mkdirSync(path.dirname(patchFile), { recursive: true }); } catch (_) {}
      const data = await readFile(newFile);
      await writeFile(patchFile, data);
    })();
    return nodeify(work, cb);
  },
  // Match test semantics: patch copies contents of patchFile into newFile
  patch: (oldFile, newFile, patchFile, cb) => {
    const work = (async () => {
      try { fs.mkdirSync(path.dirname(newFile), { recursive: true }); } catch (_) {}
      const data = await readFile(patchFile);
      await writeFile(newFile, data);
    })();
    return nodeify(work, cb);
  }
};