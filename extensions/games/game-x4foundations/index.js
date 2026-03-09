/* eslint-disable */
const { app, remote } = require('electron');
const Big = require('big.js');
const Promise = require('bluebird');
const { parseStringPromise } = require('xml2js');
const path = require('path');
const { fs, log, selectors, util } = require('vortex-api');
const winapi = require('winapi-bindings');

const semver = require('semver');

const APPUNI = app || remote.app;
const GAME_ID = 'x4foundations';
const I18N_NAMESPACE = `game-${GAME_ID}`;
const STEAM_ID = 392160;
const GOG_ID = '1395669635';

let _STEAM_USER_ID = '';
let _STEAM_ENTRY;

function findGame() {
  return util.steam.findByAppId(STEAM_ID.toString())
    .then(game => {
      _STEAM_ENTRY = game;
      return Promise.resolve(game.gamePath);
    })
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${GOG_ID}`,
      'PATH'))
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\GOG.com\\Games\\${GOG_ID}`,
      'PATH'));
}

function readRegistryKey(hive, key, name) {
  try {
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.resolve(undefined);
  }
}

function testSupportedContent(files, gameId) {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false });
  }

  const contentPath = files.find(file => path.basename(file) === 'content.xml');
  return Promise.resolve({
    supported: contentPath !== undefined,
    requiredFiles: [ contentPath ],
  });
}

async function parseIndexFiles(indexPath) {
  return fs.readdirAsync(indexPath).then(files => {
    const xmlFiles = files.filter(file => path.extname(file) === '.xml');
    return Promise.reduce(xmlFiles, (modName, file) => {
      return fs.readFileAsync(path.join(indexPath, file))
      .then(async data => {
        if (modName !== '') {
          return Promise.resolve(modName);
        }

        let parsed;
        try {
          parsed = await parseStringPromise(data);
          const entries = parsed?.diff?.add?.[0]?.entry;
          const entryValue = entries[0]?.$?.value;
          if (entryValue !== undefined && entryValue.startsWith('extensions')) {
            const segments = entryValue.split(path.sep);
            return Promise.resolve(segments[1]);
          }

          return Promise.resolve(modName);
        } catch (err) {
          // This is arguably not an error as there is
          //  no way for us to know whether the file is actually
          //  valid for our usage.
          log('debug', 'X4: parser error', err);
          return Promise.resolve(modName);
        }
      })
      .catch(err => {
        log('debug', 'X4: cannot read xml file', err);
        return Promise.resolve(modName)
      })
    }, '');
  })
  .catch(err => {
    log('debug', 'X4: cannot read mod index path', err.code);
    return Promise.resolve(modName)
  });
}

async function installContent(files,
                              destinationPath,
                              gameId,
                              progressDelegate) {
  const contentPath = files.find(file => path.basename(file) === 'content.xml');
  const basePath = path.dirname(contentPath);

  const hasIndexFolder = await fs.statAsync(path.join(destinationPath, basePath, 'index'))
                                  .then(() => Promise.resolve(true))
                                  .catch(() => Promise.resolve(false));

  let outputPath = basePath;

  const contentFile = path.join(destinationPath, contentPath);
  return fs.readFileAsync(contentFile, { encoding: 'utf8' }).then(async data => {
    let parsed;
    try {
      parsed = await parseStringPromise(data);
    } catch (err) {
      return Promise.reject(new util.DataInvalid('content.xml invalid: ' + err.message));
    }
    const attrInstructions = [];

    const getAttr = key => {
      try {
        return parsed?.content?.$?.[key];
      } catch (err) {
        log('info', 'attribute missing in content.xml',  { key });
        return undefined;
      }
    }

    const contentModId = getAttr('id');
    if (contentModId === undefined) {
      return Promise.reject(
          new util.DataInvalid('invalid or unsupported content.xml'));
    }

    // We prefer using the mod folder name included in the archive structure.
    //  Alternatively, if the mod files are placed loosely at the archive's
    //  root folder - there's no way for us to ascertain what the mod folder
    //  is actually supposed to be named, in which case we _try_ to find this
    //  using any xml files we can pinpoint in the mod's index files (if they exist)
    //  As a final resort we just use the content.xml id attribute;
    outputPath = (contentPath.indexOf('content.xml') > 0)
      ? path.basename(path.dirname(contentPath))
      : hasIndexFolder
        ? parseIndexFiles(path.join(destinationPath, basePath, 'index'))
            .then(res => !!res ? res : contentModId)
        : contentModId; // Last resort.

    const name = getAttr('name') || contentModId;
    attrInstructions.push({
      type: 'attribute',
      key: 'customFileName',
      value: name.trim(),
    });

    // Avoid setting the description for the mod on installation as the content
    //  file is probably less... descriptive than what we have on the site.
    // attrInstructions.push({
    //   type: 'attribute',
    //   key: 'description',
    //   value: getAttr('description'),
    // });
    attrInstructions.push({
      type: 'attribute',
      key: 'sticky',
      value: getAttr('save') === 'true',
    });

    attrInstructions.push({
      type: 'attribute',
      key: 'author',
      value: getAttr('author'),
    });
    // Setting the version attribute manually during installation will
    //  override the version we get from the website. This will cause the mod
    //  to report that there is an update available even when the user is on
    //  the latest version.
    // attrInstructions.push({
    //   type: 'attribute',
    //   key: 'version',
    //   value: getAttr('version'),
    // });
    return Promise.resolve(attrInstructions);
  })
  .then(attrInstructions => {
    let instructions = attrInstructions.concat(files.filter(file =>
      file.startsWith(basePath + path.sep) && !file.endsWith(path.sep))
    .map(file => ({
      type: 'copy',
      source: file,
      destination: path.join(outputPath, file.substring(basePath.length + 1))
    })));
    return { instructions };
  });
}

function steamUserId32Bit() {
  if (_STEAM_USER_ID !== '') {
    return _STEAM_USER_ID;
  }

  if ((_STEAM_ENTRY !== undefined) && (_STEAM_ENTRY.lastUser !== undefined)) {
    const id64Bit = new Big(_STEAM_ENTRY.lastUser);
    const id32Bit = id64Bit.mod(Big(2).pow(32));
    _STEAM_USER_ID = id32Bit.toFixed();
  }

  return _STEAM_USER_ID;
}

function getDocumentsModPath() {
  return (_STEAM_ENTRY !== undefined)
    ? path.join(APPUNI.getPath('documents'), 'Egosoft', 'X4', steamUserId32Bit(), 'extensions')
    : path.join(APPUNI.getPath('documents'), 'Egosoft', 'X4', 'extensions');
}

function migrate101(api, oldVersion) {
  if (semver.gte(oldVersion, '1.0.1')) {
    return Promise.resolve();
  }

  const state = api.store.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modIds = Object.keys(mods);
  if (modIds.length === 0) {
    // No mods, no problem.
    return Promise.resolve();
  }

  const reinstallNotif = (modIds) => new Promise((resolve) => {
    const affectedMods = modIds.join('\n');
    return api.sendNotification({
      id: 'x4-reinstall',
      type: 'warning',
      message: api.translate('Mods for X4 need to be reinstalled',
        { ns: I18N_NAMESPACE }),
      noDismiss: true,
      actions: [
        {
          title: 'Explain',
          action: () => {
            api.showDialog('info', 'X4: Foundations', {
              text: 'Due to a bug in our X4 mod installer, some of your mods have been '
                  + 'extracted into a potentially invalid mod folder, and may be causing your game '
                  + 'to behave unexpectedly. To resolve this - please re-install the following mods:\n\n'
                  + `${affectedMods}\n\n`
                  + 'We are sorry for the inconvenience.',
            }, [
              { label: 'Close' },
            ]);
          },
        },
        {
          title: 'Understood',
          action: dismiss => {
            dismiss();
            resolve();
          }
        }
      ],
    });
  });

  const gameInstallationPath = selectors.installPathForGame(state, GAME_ID);
  return Promise.reduce(modIds, (accum, modId) => {
    const mod = mods[modId];
    const modStagingPath = path.join(gameInstallationPath, mod.installationPath);
    return fs.readdirAsync(modStagingPath)
      .then(entries => {
        const hasInvalidModName = entries.find(entry => entry.startsWith('ws_')) !== undefined;
        if (hasInvalidModName) {
          accum.push(modId);
        }
        return Promise.resolve(accum);
      }).catch(err => Promise.resolve(accum))
  }, [])
  .then(invalidMods => (invalidMods.length > 0)
    ? reinstallNotif(invalidMods)
    : Promise.resolve());
}

async function prepareForModding(discovery) {
  try {
    const documentsPath = await getDocumentsModPath();
    const extensionsPath = path.join(discovery.path, 'extensions');
    return fs.ensureDirWritableAsync(documentsPath, () => Promise.resolve())
      .then(() => fs.ensureDirWritableAsync(extensionsPath, () => Promise.resolve()))
  } catch (err) {
    Promise.reject(err);
  }
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'X4: Foundations',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'extensions',
    logo: 'gameart.jpg',
    executable: () => 'X4.exe',
    setup: prepareForModding,
    requiredFiles: [
      'X4.exe',
    ],
    environment: {
      SteamAPPId: STEAM_ID.toString(),
    },
    details: {
      steamAppId: STEAM_ID,
    },
  });

  context.registerInstaller('x4foundations', 50, testSupportedContent, installContent);
  context.registerModType('x4-documents-modtype', 15, (gameId) => (gameId === GAME_ID),
    () => getDocumentsModPath(), () => Promise.resolve(false));

  context.registerMigration(old => migrate101(context.api, old));

  return true;
}

module.exports = {
  default: main,
};
