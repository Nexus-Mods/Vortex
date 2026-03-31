const Promise = require('bluebird');
const path = require('path');
const { util } = require('vortex-api');
const winapi = require('winapi-bindings');

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\Wow6432Node\\Bethesda Softworks\\skyrim',
      'Installed Path');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName('The Elder Scrolls V: Skyrim')
      .then(game => game.gamePath);
  }
}

let tools = [
  {
    id: 'TES5Edit',
    name: 'TES5Edit',
    logo: 'tes5edit.png',
    executable: () => 'TES5Edit.exe',
    requiredFiles: [
      'TES5Edit.exe',
    ],
  },
  {
    id: 'WryeBash',
    name: 'Wrye Bash',
    logo: 'wrye.png',
    executable: () => 'Wrye Bash.exe',
    requiredFiles: [
      'Wrye Bash.exe',
    ],
  },
  {
    id: 'FNIS',
    name: 'Fores New Idles in Skyrim',
    shortName: 'FNIS',
    logo: 'fnis.png',
    executable: () => 'GenerateFNISForUsers.exe',
    requiredFiles: [
      'GenerateFNISForUsers.exe',
    ],
    relative: true,
  },
  {
    id: 'skse',
    name: 'Skyrim Script Extender',
    shortName: 'SKSE',
    executable: () => 'skse_loader.exe',
    requiredFiles: [
      'skse_loader.exe',
      'TESV.exe',
    ],
    relative: true,
    exclusive: true,
    defaultPrimary: true,
  },
  {
    id: 'bodyslide',
    name: 'BodySlide',
    executable: () => path.join('Data', 'CalienteTools', 'BodySlide', 'BodySlide x64.exe'),
    requiredFiles: [
      path.join('Data', 'CalienteTools', 'BodySlide', 'BodySlide x64.exe'),
    ],
    relative: true,
    logo: 'auto',
  },
];

function main(context) {
  context.registerGame({
    id: 'skyrim',
    name: 'Skyrim',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'Data',
    logo: 'gameart.jpg',
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
