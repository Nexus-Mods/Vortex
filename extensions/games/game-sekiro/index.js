const Promise = require('bluebird');
const path = require('path');
const { actions, fs, util } = require('vortex-api');

const GAME_ID = 'sekiro';
const STEAM_ID = 814380;
const DINPUT = 'dinput8.dll';
const PARTS_DCX_EXT = '.partsbnd.dcx';

function findGame() {
  return util.steam.findByAppId(STEAM_ID.toString())
    .then(game => game.gamePath);
}

function prepareForModding(api, discovery) {
  const modEngineDInput = path.join(discovery.path, DINPUT);
  const showModEngineDialog = () => new Promise((resolve, reject) => {
    api.store.dispatch(actions.showDialog('question', 'Action required',
      {
        message: 'Sekiro requires "Sekiro Mod Engine" for mods to install and function correctly.\n' 
               + 'Vortex is able to install Mod Engine automatically (as a mod) but please ensure it is enabled\n'
               + 'and deployed at all times.'
      },
      [
        { label: 'Continue', action: () => resolve() },
        { label: 'Go to Mod Engine Page', action: () => {
            util.opn('https://www.nexusmods.com/sekiro/mods/6').catch(err => undefined);
            resolve();
        }},
      ]));
  });

  // Check whether mod engine is installed.
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'mods', 'parts'), () => Promise.resolve())
    .then(() => fs.statAsync(modEngineDInput)
      .catch(err => (err.code === 'ENOENT')
        ? showModEngineDialog()
        : Promise.reject(err)));
}

function hasLooseParts(files) {
  const dcxFiles = files.filter(file => file.endsWith(PARTS_DCX_EXT));
  return (dcxFiles.length > 0)
    ? dcxFiles[0].indexOf(path.sep + 'parts' + path.sep) === -1
    : false;
}

function installLooseMod(files, destinationPath) {
  const dcxFiles = files.filter(file => file.endsWith(PARTS_DCX_EXT));
  const instructions = dcxFiles.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join('parts', path.basename(file)),
    };
  });

  return Promise.resolve({ instructions });
}

function testLooseMod(files, gameId) {
  return Promise.resolve({
    supported: ((gameId === GAME_ID) && (hasLooseParts(files))),
    requiredFiles: [],
  });
}

function installRootMod(files, destinationPath) {
  const dcxFile = files.find(file => file.endsWith(PARTS_DCX_EXT));
  const idx = dcxFile.toLowerCase().split(path.sep).indexOf('parts');
  const instructions = files.reduce((accum, file) => {
    if (path.extname(file) !== '') {
      accum.push({
        type: 'copy',
        source: file,
        destination: file.split(path.sep).slice(idx).join(path.sep),
      });
    }
    return accum;
  }, []);
  return Promise.resolve({ instructions });
}

function testRootMod(files, gameId) {
  const isSekiro = gameId === GAME_ID;
  const loose = hasLooseParts(files);
  let hasOtherRootFolders = false;
  if (loose) {
    const dcxFile = files.find(file => file.endsWith(PARTS_DCX_EXT));
    if (dcxFile !== undefined) {
      const segments = dcxFile.toLowerCase().split(path.sep);
      const idx = segments.findIndex(seg => seg === 'parts');
      if (idx !== -1) {
        hasOtherRootFolders = files.filter(f => {
          const segs = f.toLowerCase().split(path.sep);
          return (segs.length > (idx + 1) && segs[idx] !== 'parts');
        }).length > 0;
      }
    }
  }

  return Promise.resolve({
    supported: isSekiro && loose && hasOtherRootFolders,
    requiredFiles: [],
  })
}

function main(context) {
  const gameExec = 'sekiro.exe';
  context.registerGame({
    id: GAME_ID,
    name: 'Sekiro',
    logo: 'gameart.jpg',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'mods',
    executable: () => gameExec,
    requiredFiles: [gameExec],
    environment: {
      SteamAPPId: STEAM_ID.toString(),
    },
    details: {
      steamAppId: STEAM_ID,
    },
    setup: (discovery) => prepareForModding(context.api, discovery),
  });

  context.registerInstaller('sek-loose-files', 25, testLooseMod, installLooseMod);
  context.registerInstaller('sek-root-mod', 20, testRootMod, installRootMod);
}

module.exports = {
  default: main
};
