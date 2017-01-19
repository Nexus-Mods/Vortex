let nbind = require('nbind');
let path = require('path');
let esptk = nbind.init(path.join(__dirname, 'esptk')).lib;

module.exports.default = esptk.ESPFile;
