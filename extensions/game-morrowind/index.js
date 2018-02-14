const Promise = require('bluebird');
const { util } = require('vortex-api');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    // Morrowind, being an old application, has its registry accesses
    // redirected post Vista (?)
    key: '\\Software\\Classes\\VirtualStore\\MACHINE\\SOFTWARE\\Wow6432Node\\bethesda softworks\\Morrowind',
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
  .catch(err => util.steam.findByName('The Elder Scrolls III: Morrowind')
        .then(game => game.gamePath));
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
    queryModPath: () => 'Data Files',
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
