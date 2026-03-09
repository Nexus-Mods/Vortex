import Bluebird from 'bluebird';
import path from 'path';
import { fs, log, types, util } from 'vortex-api';

import { migrate020 } from './migrations';
import { EPIC_APP_ID, GAME_ID } from './statics';
import { toBlue } from './util';

const BIX_CONFIG = 'BepInEx.cfg';
function ensureBIXConfig(discovery: types.IDiscoveryResult): Bluebird<void> {
  const src = path.join(__dirname, BIX_CONFIG);
  const dest = path.join(discovery.path, 'BepInEx', 'config', BIX_CONFIG);
  return fs.ensureDirWritableAsync(path.dirname(dest))
    .then(() => fs.copyAsync(src, dest))
    .catch(err => {
      if (err.code !== 'EEXIST') {
        log('warn', 'failed to write BIX config', err);
      }
      // nop - this is a nice to have, not a must.
      return Bluebird.resolve();
    });
}

function requiresLauncher() {
  return util.epicGamesLauncher.isGameInstalled(EPIC_APP_ID)
    .then(epic => epic
      ? { launcher: 'epic', addInfo: EPIC_APP_ID }
      : undefined);
}

function findGame() {
  return util.epicGamesLauncher.findByAppId(EPIC_APP_ID)
    .then(epicEntry => epicEntry.gamePath);
}

function modPath() {
  return path.join('BepInEx', 'plugins');
}

function prepareForModding(discovery: types.IDiscoveryResult) {
  if (discovery?.path === undefined) {
    return Bluebird.reject(new util.ProcessCanceled('Game not discovered'));
  }

  return ensureBIXConfig(discovery)
    .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, 'BepInEx', 'plugins')));
}

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
    name: 'Untitled Goose Game',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    requiresLauncher,
    logo: 'gameart.jpg',
    executable: () => 'Untitled.exe',
    requiredFiles: [
      'Untitled.exe',
      'UnityPlayer.dll',
    ],
    setup: prepareForModding,
  });

  // context.registerMigration(toBlue(old => migrate010(context, old) as any));
  context.registerMigration(toBlue(old => migrate020(context, old)));

  context.once(() => {
    if (context.api.ext.bepinexAddGame !== undefined) {
      context.api.ext.bepinexAddGame({
        gameId: GAME_ID,
        autoDownloadBepInEx: true,
        doorstopConfig: {
          doorstopType: 'default',
          ignoreDisableSwitch: true,
        },
      });
    }
  });

  return true;
}

module.exports = {
  default: main,
};
