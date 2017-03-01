let fs = require('fs');
let checker = require('license-checker');
let path = require('path');

let basePath = path.join(__dirname, 'app');

checker.init(
    {
      start: basePath,
      customPath: 'licenseFormat.json',
      relativeLicensePath: basePath
    },
    function(err, json) {
      if (err) {
        return console.error('error', err);
      }
      delete json['nmm-api'];
      delete json.nmm2;
      fs.writeFile(path.join('assets', 'modules.json'), JSON.stringify(json, undefined, 2));
    });
