const Promise = require('bluebird');
const Registry = require('winreg');
const { util } = require('vortex-api');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\falloutnv',
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
    util.Steam.findByName('Fallout: New Vegas')
      .then(game => game.gamePath)
  );
}

let tools = [
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=falloutnv',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
  {
    id: 'nvse',
    name: 'NVSE',
    executable: () => 'nvse_loader.exe',
    requiredFiles: [
      'nvse_loader.exe',
    ],
    relative: true,
  }
];

function main(context) {
  context.registerGame({
    id: 'falloutnv',
    name: 'Fallout: New Vegas',
    shortName: 'New Vegas',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.png',
    executable: () => 'FalloutNV.exe',
    requiredFiles: [
      'FalloutNV.exe',
    ],
    details: {
      steamAppId: 22380,
    }
  });
  return true;
}

module.exports = {
  default: main,
};
