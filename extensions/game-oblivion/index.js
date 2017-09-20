const Promise = require('bluebird');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\oblivion',
  });

  return new Promise((resolve, reject) => {
    regKey.get('Installed Path', (err, result) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}

let tools = [
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=oblivion',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
];

function main(context) {
  context.registerGame({
    id: 'oblivion',
    name: 'Oblivion',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.png',
    executable: () => 'oblivion.exe',
    requiredFiles: [
      'oblivion.exe',
    ],
    details: {
      steamAppId: 22330,
    },
  });
  return true;
}

module.exports = {
  default: main
};
