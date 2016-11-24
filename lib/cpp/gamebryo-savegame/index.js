var loader = require('./build/Release/gamebryo-savegame');

function loadSavegame(callback, filename) {
  loader.loadSavegame(callback, filename);
}

module.exports.loadSavegame = loadSavegame;
