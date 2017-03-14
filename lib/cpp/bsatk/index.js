let nbind = require('nbind');
let path = require('path');
let bsatk = nbind.init(path.join(__dirname, 'bsatk')).lib;

module.exports.default = bsatk.loadBSA;
