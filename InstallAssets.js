'use strict';

const Promise = require('bluebird');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const replace = require('replace-in-file');

const data = require('./InstallAssets.json');

fs.ensureDirSync('out')
const globOptions = { matchBase: true, globstar: true };

let copies = -1;

// Write modified package.json
const pkgJson = Object.assign(require('./package.json'), {
  productName: 'vortex_devel',
  private: true,
});
fs.writeJSON(path.join('out', 'package.json'), pkgJson)
  .then(() => console.log('Wrote package.json file'))
  .catch(e => console.warn('Failed to write package.json: ', e));

// copy files
Promise.mapSeries(data.copy, file => {
  file.outPath = path.join('out', file.outPath || '');
  if (file.replace) {
    const from = file.replace.from;
    file.replace.from = (Array.isArray(from) ? from : [from]).map(p => new RegExp(p, 'g'));
  }

  return new Promise((resolve, reject) => {
    glob(file.srcPath, globOptions, (globErr, files) => {
      copies = copies === -1 ? files.length : copies += files.length;
      if (globErr !== null) {
        reject(new Error('glob failed: ' + globErr));
      }
      resolve(files);
    });
  })
    .then(files => Promise.map(files, (globResult) => {
      let globTarget = path.join(...globResult.split(/[\/\\]/).slice(file.skipPaths));
      if (file.rename) {
        globTarget = path.join(path.dirname(globTarget), file.rename);
      }
      const targetFile = path.join(file.outPath, globTarget);

      return fs.ensureDir(path.dirname(targetFile))
        .then(() => fs.copy(globResult, targetFile))
        .then(() => console.log('copied', globResult, targetFile))
        .then(() => {
          if (file.replace) {
            const files = (fs.statSync(targetFile).isFile() ? targetFile : `${targetFile}/**/*`);
            return replace({ ...file.replace, files: files, countMatches: true })
              .then(results => results.filter(r => r.hasChanged && delete r.hasChanged).forEach(r => console.log({ ...r, ...file.replace })))
              .catch(console.warn);
          }
        })
        .catch((copyErr) => console.warn('failed to copy', globResult, targetFile, copyErr))
        .finally(() => --copies);
    }))
    .then(() => {
      if (file.runAfter) {
        const scopedEval = (function (arg) { return eval(`\`${arg}\``); }).bind(file);
        const cmd = file.runAfter[0];
        const args = file.runAfter.slice(1).map(scopedEval);

        console.log('Executing runAfter command: ', cmd, ...args);
        return new Promise((resolve, reject) =>{
          const child = require('child_process').spawnSync(cmd, args, {
            stdio: 'inherit',
            shell: true,
          });
          if (child.error)
            reject(error);
          else
            resolve();
        });
      }
    });
});
