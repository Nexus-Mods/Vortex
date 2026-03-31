const Promise = require('bluebird');
const { remote } = require('electron');
const path = require('path');
const { fs, log, selectors, util } = require('vortex-api');

const extension =  process.platform == 'linux'
    ? '.x86_64'
    : '_x64.exe';

function findGame() {
  return util.steam.findByAppId('220200')
      .then(game => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: 'kerbalspaceprogram',
    name: 'Kerbal Space Program',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'GameData',
    logo: 'gameart.jpg',
    executable: () => 'KSP' + extension,
    requiredFiles: [
      'KSP' + extension,
    ],
    environment: {
      SteamAPPId: '220200',
    },
    details: {
      steamAppId: 220200,
      hashFiles: ['KSP_x64_Data/Managed/Assembly-CSharp.dll'],
    },
  });

  return true;
}

module.exports = {
  default: main,
};
