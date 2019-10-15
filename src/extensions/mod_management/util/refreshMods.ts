import { IExtensionApi } from '../../../types/IExtensionContext';
import * as fs from '../../../util/fs';

import {IMod} from '../types/IMod';

import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = remote !== undefined ? remote.app : appIn;

/**
 * reads the installation dir and adds mods missing in our database
 *
 * @param {string} installPath
 * @param {(mod: IMod) => void} onAddMod
 */
function refreshMods(api: IExtensionApi, installPath: string, knownMods: string[],
                     onAddMod: (mod: IMod) => void, onRemoveMods: (names: string[]) => void) {
  return fs.ensureDirAsync(installPath)
    .then(() => fs.readdirAsync(installPath))
    .filter(modName => fs.statAsync(path.join(installPath, modName))
      .then(stats => stats.isDirectory())
      .catch(() => Promise.resolve(false)))
    .then((modNames: string[]) => {
      const filtered = modNames
        .filter(name => !name.startsWith('__'))
        .map(name => name.replace(/.installing$/, ''));
      const addedMods =
          filtered.filter((name: string) => knownMods.indexOf(name) === -1);
      const removedMods =
          knownMods.filter((name: string) => filtered.indexOf(name) === -1);

  
      if ((addedMods.length === 0) && (removedMods.length === 0)) {
        return Promise.resolve();
      }

      const renderMod = modId => `  - "${modId}"`;

      let message: string[] = [];
      if (removedMods.length > 0) {
        message = message.concat([api.translate('Removed:')], removedMods.map(renderMod));
      }
      if (addedMods.length > 0) {
        message = message.concat([api.translate('Added:')], addedMods.map(renderMod));
      }

      return api.showDialog('question', 'Mods changed on disk', {
        bbcode: 'Mods have been changed on disk. This means that mods that were managed by Vortex '
            + 'disappeared and/or mods that Vortex previously didn\'t know about '
            + 'appeared in the staging folder since the last time it checked.<br/>'
            + 'It is highly discouraged to modify the staging folder outside Vortex in any '
            + 'way!<br/>'
            + 'If you continue now, Vortex will lose all meta information about the deleted '
            + 'mods [b]irreversibly[/b] and the added mods are added with minimal meta information.',
        message: message.join('\n'),
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
                        + 'got interrupted before. You should delete it now and then install it again.'
                  }, [
                    { label: 'Ignore' },
                    { label: 'Delete' },
                  ])
                  .then(res => {
                    if (res.action === 'Delete') {
                      return fs.removeAsync(fullPath + '.installing');
                    }
                  })));
          })
            .then(() => onRemoveMods(removedMods));
        } else {
          app.quit();
        }
      });
    });
}

export default refreshMods;
