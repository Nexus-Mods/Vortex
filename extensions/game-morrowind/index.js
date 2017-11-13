const Promise = require('bluebird');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\Morrowind',
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
];

function main(context) {
  context.registerGame({
    id: 'morrowind',
    name: 'Morrowind',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.png',
    executable: () => 'morrowind.exe',
    requiredFiles: [
      'morrowind.exe',
    ],
    details: {
      steamAppId: 22320,
    },
  });
  return true;
}

module.exports = {
  default: main
};
