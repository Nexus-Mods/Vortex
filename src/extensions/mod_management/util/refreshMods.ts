import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { getApplication } from '../../../util/application';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { setModArchiveId } from '../actions/mods';
import {IMod} from '../types/IMod';

import Promise from 'bluebird';
import * as path from 'path';

/**
 * reads the installation dir and adds mods missing in our database
 *
 * @param {string} installPath
 * @param {(mod: IMod) => void} onAddMod
 */
function refreshMods(api: IExtensionApi, gameId: string,
                     installPath: string, knownMods: {[modId: string]: IMod},
                     onAddMod: (mod: IMod) => void, onRemoveMods: (names: string[]) => void) {
  const knownModNames: string[] = Object.keys(knownMods);
  return fs.ensureDirAsync(installPath)
    .then(() => fs.readdirAsync(installPath))
    .filter((modName: string) => fs.statAsync(path.join(installPath, modName))
      .then(stats => stats.isDirectory())
      .catch(() => Promise.resolve(false)))
    .then((modNames: string[]) => {
      const filtered = modNames
        .filter(name => !name.toLowerCase().startsWith('__vortex'))
        .map(name => name.replace(/.installing$/, ''));
      const addedMods =
          filtered.filter((name: string) => knownModNames.indexOf(name) === -1);
      const removedMods =
          knownModNames.filter((name: string) => filtered.indexOf(name) === -1);

      if ((addedMods.length === 0) && (removedMods.length === 0)) {
        return Promise.resolve();
      }

      log('warn', 'manual mod changed', {
        stagingFolder: installPath,
        addedMods,
        removedMods,
      });

      const renderMod = modId => `  - "${modId}"`;

      const t = api.translate;

      let message: string[] = [];
      if (removedMods.length > 0) {
        message = message.concat([t('Removed:')], removedMods.map(renderMod));
      }
      if (addedMods.length > 0) {
        message = message.concat([t('Added:')], addedMods.map(renderMod));
      }

      let bbcode = t('Mods have been changed on disk. This means that mods that were managed by Vortex '
            + 'disappeared and/or mods that Vortex previously didn\'t know about '
            + 'appeared in the staging folder since the last time it checked.<br/>'
            + 'It is highly discouraged to modify the staging folder outside Vortex in any '
            + 'way!<br/>');

      if (removedMods.length > 0) {
        bbcode += t('If you continue now, Vortex will lose all meta information about the deleted '
            + 'mods [b]irreversibly[/b]');
      }

      return api.showDialog('question', t('Mods changed on disk'), {
        bbcode,
        message: message.join('\n'),
        options: {
          translated : true,
        },
      }, [
        { label: 'Quit Vortex' },
        { label: 'Apply Changes' },
      ]).then(res => {
        if (res.action === 'Apply Changes') {
          return Promise.map(addedMods, (modName: string) => {
            const fullPath: string = path.join(installPath, modName);
            return fs.statAsync(fullPath)
              .then((stat: fs.Stats) => {
                if (stat.isDirectory()) {
                  onAddMod({
                    id: modName,
                    type: '',
                    installationPath: modName,
                    state: 'installed',
                    attributes: {
                      name: modName,
                      installTime: stat.ctime,
                    },
                  });
                }
              })
              .catch({ code: 'ENOENT' }, () => fs.statAsync(fullPath + '.installing')
                .then(() =>
                  // since we're removing the '.installing' extension above we might be discovering
                  // a mod here that was not installed successfully but doesn't have an entry in the
                  // mods database so it wouldn't get cleaned up eiather
                  api.showDialog('error', modName, {
                    text: 'This mod was not installed completely, most likely the installation '
                        + 'got interrupted before. You should delete it now and then install '
                        + 'it again.',
                  }, [
                    { label: 'Ignore' },
                    { label: 'Delete' },
                  ])
                  .then(deleteRes => {
                    if (deleteRes.action === 'Delete') {
                      return fs.removeAsync(fullPath + '.installing');
                    }
                  })));
          })
            .then(() => onRemoveMods(removedMods));
        } else {
          getApplication().quit();
        }
      });
    })
    .then(() => {
      const state: IState = api.store.getState();
      const downloads = state.persistent.downloads.files;
      knownModNames.forEach(modId => {
        if ((!!knownMods[modId].archiveId)
            && (downloads[knownMods[modId].archiveId] === undefined)) {
          const fileName = getSafe(knownMods, [modId, 'attributes', 'fileName'], undefined);
          log('info', 'archive referenced in mod doesn\'t exist',
              { modId, archiveId: knownMods[modId].archiveId, fileName });
          if (fileName !== undefined) {
            const archiveId = Object.keys(downloads)
              .find(iter => downloads[iter].localPath === fileName);
            if (archiveId !== undefined) {
              log('debug', 'reassigning to archive', { modId, archiveId });
              api.store.dispatch(setModArchiveId(gameId, modId, archiveId));
            }
          }
        }
      });
    });
}

export default refreshMods;
