let fs = require('fs');
let checker = require('license-checker');
let path = require('path');

let basePath = path.join(__dirname, 'app');

checker.init(
  {
    start: basePath,
    customPath: './licenseFormat.json',
  },
  function (err, json) {
    if (err) {
      return console.error('error', err);
    }

    const deleteKeys = ['vortex-api', 'vortex'];
    Object.keys(json).forEach(key => {
      // make the license path relative. license-checker has an option
      // to do that for us but that causes errors
      if (json[key].licenseFile) {
        json[key].licenseFile = path.relative(basePath, json[key].licenseFile);
      }
      delete json[key].path;
      if (key.startsWith('@types')) {
        deleteKeys.push(key);
      }
    });

    deleteKeys.forEach(key => delete json[key]);

    fs.writeFile(path.join('assets', 'modules.json'), JSON.stringify(json, undefined, 2));
  });
