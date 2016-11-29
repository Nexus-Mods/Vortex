let nbind = require('nbind');
let esptk = nbind.init(__dirname).lib;

module.exports.default = esptk.ESPFile;
