import { ISavegame } from '../types/ISavegame';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { types } from 'nmm-api';
import * as path from 'path';

/**
 * Apply the plugin list as used when a save game was created.
 *
 * @param {[id: string]: types.IDiscoveryResult} discoveredGames
 * @param {string} gameMode
 * @param {[saveId: string]: ISavegame} saves
 * @param {string} savesPath
 * @param {string} instanceId
 * @param {I18next.TranslationFunction} t
 * @param {(type,title,content,actions) => Promise<types.IDialogResult>} onShowDialog
 */
function restoreSavegamePlugins(
  discoveredGames: { [id: string]: types.IDiscoveryResult },
  gameMode: string,
  saves: { [saveId: string]: ISavegame },
  savesPath: string,
  instanceId: string,
  t: I18next.TranslationFunction,
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions) => Promise<types.IDialogResult>,
  api: types.IExtensionApi,
) {

  const discovery = discoveredGames[gameMode];

  let plugins: string[] = [];
  const missingPlugins: string[] = [];
  fs.readdirAsync(discovery.modPath)
    .then((files: string[]) => {
      plugins = files.filter((fileName: string) => {
        const ext = path.extname(fileName).toLowerCase();
        return ['.esp', '.esm'].indexOf(ext) !== -1;
      }).map((fileName) => fileName.toLowerCase());
    })
    .then(() => {
      saves[instanceId].attributes.plugins.forEach(plugin => {
        if (plugins.indexOf(plugin.toLowerCase()) === -1) {
          missingPlugins.push(plugin);
        }
      });

      if (missingPlugins.length > 0) {
        onShowDialog('error', t('Restore savegame\'s plugins'), {
          message: t('An error occurred restoring the savegame\'s plugins.\n' +
            'These files are missing, the restore will be canceled.\n\n{{plugins}}',
            { replace: { plugins: missingPlugins.join('\n') } }),
          options: {
            translated: true,
          },
        }, {
            OK: null,
          }).then((result: types.IDialogResult) => {
            return Promise.resolve();
          });
      } else {
        api.events.emit('restore-savegame-plugins',
          saves[instanceId].attributes.plugins);
      }
    });
}

export default restoreSavegamePlugins;
