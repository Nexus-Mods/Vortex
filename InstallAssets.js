'use strict';

const Promise = require('bluebird');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

const data = require('./InstallAssets.json');

const globOptions = { matchBase: true, globstar: true };

let copies = -1;

// Write modified package.json
const pkgJson = Object.assign(require('./package.json'), {
  productName: 'vortex_devel',
  private: true,
});
fs.ensureDir('out')
  .then(() => fs.writeJSON(path.join('out', 'package.json'), pkgJson) )
  .then(() => console.log('Wrote package.json file'))
  .catch(e => console.warn('Failed to write package.json: ', e));

// copy files
Promise.mapSeries(data.copy, file => {
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
      const targetFile = path.join('out', file.outPath || '', globTarget);

      return fs.ensureDir(path.dirname(targetFile))
        .then(() => fs.copy(globResult, targetFile))
        .then(() => console.log('copied', globResult, targetFile))
        .catch((copyErr) => console.warn('failed to copy', globResult, targetFile, copyErr))
        .finally(() => --copies);
    }));
});
