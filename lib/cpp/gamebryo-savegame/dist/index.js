/*let nbind = require('nbind');
let path = require('path');

function init(subdir) {
  let modulePath = subdir !== undefined ? path.join(__dirname, subdir) : __dirname;
  return nbind.init(modulePath).lib;
}

module.exports.default = init;
*/

let nbind = require('nbind');
let path = require('path');

let proxy;

function init(subdir) {
  let baseDir = __dirname.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  let modulePath = subdir !== undefined ? path.join(baseDir, subdir) : baseDir;
  return nbind.init(modulePath).lib;
}

module.exports.default = init;
