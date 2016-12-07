var nbind = require('nbind');

function savegameBinding () {
  return nbind.init(__dirname).lib;
}
module.exports.savegameBinding = savegameBinding;
