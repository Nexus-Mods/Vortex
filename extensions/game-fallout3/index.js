const Promise = require('bluebird');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\Fallout3',
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
    util.Steam.findByName('Fallout 3')
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
      '--game=fallout3',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
  {
    id: 'fose',
    name: 'FOSE',
    executable: () => 'fose_loader.exe',
    requiredFiles: [
      'fose_loader.exe',
    ],
    relative: true,
  }
];

function main(context) {
  context.registerGame({
    id: 'fallout3',
    name: 'Fallout 3',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.png',
    executable: () => 'fallout3.exe',
    requiredFiles: [
      'fallout3.exe',
    ],
    details: {
      steamAppId: 22300,
    }
  });

  return true;
}

module.exports = {
  default: main,
};
