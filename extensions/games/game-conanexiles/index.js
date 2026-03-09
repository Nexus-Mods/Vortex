const Promise = require('bluebird');
const path = require('path');
const { fs, selectors, util } = require('vortex-api');

const GAME_ID = 'conanexiles';
const STEAMAPP_ID = 440900;
const STOP_PATTERNS = ['[^/]*\\.pak$'];

function toWordExp(input) {
  return '(^|/)' + input + '(/|$)';
}

function queryPath() {
  return util.GameStoreHelper.findByAppId([STEAMAPP_ID.toString()])
    .then(game => game.gamePath);
}

function modlistPath(gamePath) {
  return path.join(gamePath, 'ConanSandbox', 'Mods', 'modlist.txt');
}

function queryModPath() {
  return path.join('ConanSandbox', 'Mods');
}

async function setup(discovery) {
  await fs.ensureDirWritableAsync(path.join(discovery.path, queryModPath()));
}

async function writeLoadOrder(api, order) {
  try {
    const state = api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    if (discovery.path === undefined) {
      return;
    }
    const stagingPath = selectors.installPathForGame(state, GAME_ID);
    const paths = [];
    await Promise.all(Object.keys(order)
      .sort((lhs, rhs) => order[lhs].pos - order[rhs].pos)
      .map(async modId => {
        const files = await fs.readdirAsync(path.join(stagingPath, modId));
        files
          .filter(name => path.extname(name).toLowerCase() === '.pak')
          .forEach(name => paths.push(path.join(stagingPath, modId, name)));
      }));
    await util.writeFileAtomic(modlistPath(discovery.path), paths.join('\n'));
  } catch (err) {
    api.showErrorNotification('Failed to write mod list', err);
  }
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Conan Exiles',
    logo: 'gameart.jpg',
    mergeMods: true,
    queryPath,
    queryModPath,
    executable: () => path.join('ConanSandbox', 'Binaries', 'Win64', 'ConanSandbox.exe'),
    requiredFiles: ['ConanSandbox.exe'],
    setup,
    environment: {
      SteamAPPId: STEAMAPP_ID.toString(),
    },
    details: {
      steamAppId: STEAMAPP_ID,
      stopPattern: STOP_PATTERNS.map(toWordExp),
      hashFiles: [
        'ConanSandbox.exe',
        'Manifest_UFSFiles_Win64.txt',
        'ConanSandbox/AssetRegistry.bin'
      ]
    },
    compatible: {
      nulldeployment: true
    }
  });

  context.registerLoadOrderPage({
    gameId: GAME_ID,
    createInfoPanel: (props) =>
      context.api.translate('Please refer to mod descriptions from mod authors to determine the right order. '
        + 'If you can\'t find any suggestions for a mod, it probably doesn\'t matter.'),
    gameArtURL: `${__dirname}/gameart.jpg`,
    callback: (loadOrder) => writeLoadOrder(context.api, loadOrder),
  });

  return true;
}

module.exports = {
  default: main
};

