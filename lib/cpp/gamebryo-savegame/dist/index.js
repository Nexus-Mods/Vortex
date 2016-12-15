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
  let modulePath = subdir !== undefined ? path.join(__dirname, subdir) : __dirname;
  let lib = nbind.init(modulePath).lib;
  proxy.GamebryoSavegame = lib.GamebryoSavegame;
}

//module.exports.default = init;

proxy = {
  GamebryoSavegame: null,
  default: init,
}

module.exports = proxy;
