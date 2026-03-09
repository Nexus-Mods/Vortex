const { util } = require('vortex-api');
const GAMEID = 'nehrim';
const STEAMAPPID = '1014940';
const OBLIVION_STEAMID = '22330';

function findGame() {
    try {
        return util.GameStoreHelper.findByAppId([STEAMAPPID])
        .then(() => {
            return util.GameStoreHelper.findByAppId([OBLIVION_STEAMID])
            .then((oblivion) => oblivion.gamePath);
        })
    }
    catch(err) {
        throw new Error('Game not found')
    }
}

let tools = [
  {
    id: 'nehrim-launcher',
    name: 'Nehrim Launcher',
    logo: 'nehrim.png',
    executable: () => 'NehrimLauncher.exe',
    requiredFiles: [
      'NehrimLauncher.exe',
    ],
    relative: true,
    exclusive: true,
  },
];

function main(context) {
  context.registerGame({
    id: GAMEID,
    name: 'Nehrim: At Fate\'s Edge',
    shortName: 'Nehrim',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.jpg',
    executable: () => 'Oblivion.exe',
    requiredFiles: [
      'NehrimLauncher.exe',
      'Oblivion.exe',
    ],
    environment: {
      SteamAPPId: OBLIVION_STEAMID,
    },
    details: {
      steamAppId: parseInt(STEAMAPPID, 10),
      supportsSymlinks: false,
    }
  });

  return true;
}

module.exports = {
  default: main
};