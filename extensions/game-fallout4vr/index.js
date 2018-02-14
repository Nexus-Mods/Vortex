const Promise = require('bluebird');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\Fallout 4 VR',
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
    util.Steam.findByName('Fallout 4 VR')
      .then(game => game.gamePath)
  );
}

let tools = [
  {
    id: 'FO4Edit',
    name: 'FO4Edit',
    logo: 'tes5edit.png',
    executable: () => 'xedit.exe',
    requiredFiles: [
      'tes5edit.exe',
    ],
  },
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=fallout4',
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
  },
];

function main(context) {
  context.registerGame({
    id: 'fallout4vr',
    name: 'Fallout 4 VR',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.png',
    executable: () => 'Fallout4VR.exe',
    requiredFiles: [
      'Fallout4VR.exe',
    ],
    details: {
      steamAppId: 611660,
    }
  });

  return true;
}

module.exports = {
  default: main,
};
