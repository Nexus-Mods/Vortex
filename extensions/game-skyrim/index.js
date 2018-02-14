const Promise = require('bluebird');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\skyrim',
  });

  return new Promise((resolve, reject) => {
    regKey.get('Installed Path', (err, result) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  })
  .catch(err =>
    util.Steam.findByName('The Elder Scrolls V: Skyrim')
      .then(game => game.gamePath)
  );
}

let tools = [
  {
    id: 'TES5Edit',
    name: 'TES5Edit',
    logo: 'tes5edit.png',
    executable: () => 'tes5edit.exe',
    requiredFiles: [
      'tes5edit.exe',
    ],
  },
   {
    id: 'WryeBash',
    name: 'WryeBash',
    logo: 'wrye.png',
    executable: () => 'wryebash.exe',
    requiredFiles: [
      'wryebash.exe',
    ],
  },
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=skyrim',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
  {
    id: 'FNIS',
    name: 'FNIS',
    logo: 'fnis.png',
    executable: () => 'GenerateFNISForUsers.exe',
    requiredFiles: [
      'GenerateFNISForUsers.exe',
    ],
    relative: true,
  },
  {
    id: 'skse',
    name: 'SKSE',
    executable: () => 'skse_loader.exe',
    requiredFiles: [
      'skse_loader.exe',
    ],
    relative: true,
  },
];

function main(context) {
  context.registerGame({
    id: 'skyrim',
    name: 'Skyrim',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.png',
    executable: () => 'TESV.exe',
    requiredFiles: [
      'TESV.exe',
    ],
    environment: {
      SteamAPPId: '72850',
    },
    details: {
      steamAppId: 72850,
    }
  });

  return true;
}

module.exports = {
  default: main
};
