const fs = require('fs');
const checker = require('license-checker');
const path = require('path');

const packageDeps = Object.keys(require('./package.json').dependencies);

const basePath = __dirname;
const modulesPath = path.join(basePath, 'node_modules');

checker.init(
  {
    start: basePath,
    customPath: './licenseFormat.json',
    production: true,
    direct: true, // Doesn't work currently: https://github.com/davglass/license-checker/issues/191
  },
  function (err, json) {
    if (err) {
      return console.error('error', err);
    }

    ['vortex-api', 'vortex'].forEach(key => delete json[key]);

    for (const [key, val] of Object.entries(json)) {
      if (key.startsWith('@types')
          || ((val.publisher !== undefined) && val.publisher.startsWith('Black Tree Gaming'))
          || !packageDeps.includes(val.name)) {
        delete json[key];
        continue;
      }

      // make the license path relative. license-checker has an option
      // to do that for us but that causes errors.
      // Make path relative to node_modules so it's easier to use in code later
      if (val.licenseFile) {
        val.licenseFile = path.relative(modulesPath, val.licenseFile);

        // Delete nested deps
        if (val.licenseFile.includes('node_modules')) {
          delete json[key];
          continue;
        }
      }
      delete val.path;
    }

    fs.writeFile(path.join('assets', 'modules.json'), JSON.stringify(json, undefined, 2), { encoding: 'utf-8' }, () => null);
  });
