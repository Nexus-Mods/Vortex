const Promise = require('bluebird');
const winapi = require('winapi-bindings');
const { fs, log, util } = require('vortex-api');
const path = require('path');
const MOD_FILE_EXT = ".vpk";
const STEAM_ID = 440;
const GAME_ID = 'teamfortress2';

const INFO_FILE = path.join('tf', 'steam.inf');

function findGame() {
  return util.steam.findByAppId(STEAM_ID.toString())
    .then(game => game.gamePath);
}

let tools = [
  {
    id: 'hammer',
    name: 'Hammer',
    logo: 'hammer.png',
    executable: () => 'hammer.exe',
    requiredFiles: [
      'hammer.exe',
    ],
  },
];
function installContent(files) {

  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  
 
  const filtered = files.filter(file => 
    ((file.indexOf(rootPath) !== -1) 
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}
function testSupportedContent(files, gameId) {
 
  let supported = (gameId === GAME_ID ) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);

  if (supported && files.find(file =>
      (path.basename(file).toLowerCase() === 'moduleconfig.xml')
      && (path.basename(path.dirname(file)).toLowerCase() === 'fomod'))) {
    supported = false;
  }
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function getGameVersion(discoveryPath) {
  return fs.readFileAsync(path.join(discoveryPath, INFO_FILE), { encoding: 'utf8' })
    .then((data) => {
      const match = data.match(/^ClientVersion=[0-9]*$/gm);
      return (match?.[0] !== undefined)
        ? Promise.resolve(match[0].replace('ClientVersion=', ''))
        : Promise.reject(new util.DataInvalid('Failed to retrieve version'));
    })
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Team Fortress 2',
    shortName: 'TF2',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => path.join('tf', 'custom'),
    getGameVersion,
    logo: 'gameart.jpg',
    executable: () => 'tf_win64.exe',
    requiredFiles: [
      'tf_win64.exe',
      path.join('tf', 'gameinfo.txt'),
    ],
    environment: {
      SteamAPPId: STEAM_ID.toString(),
    },
    details: {
      steamAppId: STEAM_ID,
      nexusPageId: GAME_ID,
    }
  });
  
  context.registerInstaller('teamfortress2-mod', 25, testSupportedContent, installContent);
  
  return true;
}

module.exports = {
  default: main,
};
