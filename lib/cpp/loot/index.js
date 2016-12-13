let nbind = require('nbind');
let path = require('path');

const lib = nbind.init(path.join(__dirname, 'loot')).lib;

module.exports = lib;
