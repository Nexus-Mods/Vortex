let nbind = require('nbind');
let path = require('path');
let ba2tk = nbind.init(path.join(__dirname, 'ba2tk')).lib;

module.exports.default = ba2tk.loadBA2;
