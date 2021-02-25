// features to help restore vortex to a working state

import { IDialogResult } from '../../types/IDialog';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { activeProfile, currentGameDiscovery } from '../../util/selectors';

import { getGame } from '../gamemode_management/util/getGame';

import { createFullStateBackup } from '../../util/store';

import { setModEnabled } from '../../actions';
import { IDeploymentManifest } from '../../types/api';
import { UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import { getManifest } from '../mod_management/util/activationStore';
import Workarounds from './Workarounds';

import Bluebird from 'bluebird';

const ONE_HOUR = 60 * 60 * 1000;

function createBackup(api: IExtensionApi, name: string): Bluebird<string> {
  return createFullStateBackup(name, api.store)
    .catch(err => {
      log('error', 'failed to create state backup', { error: err.message });
      return api.sendNotification({
        type: 'error',
        message: 'Failed to create state backup.',
        actions: [
          {
            title: 'More', action: () => {
              api.showDialog('error', 'Failed to create state backup', {
                text: 'Please report this as a bug through our feedback system '
                  + 'and be sure to include the log (via "Attach Special File"). '
                  + 'Then restart Vortex. If this problem continues you may want to go '
                  + 'settings->workarounds and restore the last valid state. '
                  + 'If you can narrow down what\'s causing this, please make sure to '
                  + 'let us know.',
              }, [
                { label: 'Close', default: true },
              ]);
            },
          },
        ],
      });
    });
}

async function resetToManifest(api: IExtensionApi) {
  try {
    const state = api.getState();
    const profile = activeProfile(state);
    const game = getGame(profile.gameId);
    const discovery = currentGameDiscovery(state);

    const modPaths = game.getModPaths(discovery.path);
    const modTypes = Object.keys(modPaths);

    const enabledMods = new Set<string>();

    await Promise.all(modTypes.map(async modType => {
      const manifest: IDeploymentManifest = await getManifest(api, modType, profile.gameId);
      manifest.files.forEach(file => {
        enabledMods.add(file.source);
        (file.merged || []).forEach(merged => enabledMods.add(merged));
      });
    }));

    if (enabledMods.size === 0) {
      api.sendNotification({
        type: 'info',
        message: 'No mods currently deployed',
      });
    }

    const dialogResult: IDialogResult = await api.showDialog(
      'question', 'Reset to last deployment', {
      text: 'This will enable all mods that were enabled for '
        + 'the last deployment and disable all that weren\'t. '
        + 'It doesn\'t revert anything else like mod order rules.',
    }, [
      { label: 'Cancel' },
      { label: 'Continue', default: true },
    ]);

    if (dialogResult.action === 'Cancel') {
      return;
    }

    const mods = getSafe(state, ['persistent', 'mods', profile.gameId], {});
    const isEnabled = modId => getSafe(profile, ['modState', modId, 'enabled'], false);
    Object.keys(mods)
      .forEach(modId => {
        if (isEnabled(modId) !== enabledMods.has(modId)) {
          api.store.dispatch(setModEnabled(profile.id, modId, enabledMods.has(modId)));
        }
      });
  } catch (err) {
    if (!(err instanceof UserCanceled)) {
      api.showErrorNotification('Failed to reset mod', err);
    }
  }
}

function init(context: IExtensionContext): boolean {
  context.registerSettings('Workarounds', Workarounds, () => ({
    onCreateManualBackup: () => {
      createBackup(context.api, 'manual')
        .then(backupPath => context.api.sendNotification({
          type: 'success',
          message: 'Backup created',
          displayMS: 4000,
          actions: [
            {
              title: 'Save copy', action: () => {
                context.api.selectFile({
                  create: true,
                  filters: [{ extensions: ['json'], name: 'State backup' }],
                  title: 'Select file location',
                })
                  .then(filePath => (filePath !== undefined)
                    ? fs.copyAsync(backupPath, filePath)
                    : Promise.resolve())
                  .catch(err => {
                    context.api.showErrorNotification('Failed to copy state backup', err, {
                      allowReport: false,
                    });
                  });
              },
            },
          ],
        }));
    },
  }), undefined, 5000);

  context.registerAction('mod-icons', 115, 'undo', {}, 'Reset to manifest', () => {
    resetToManifest(context.api);
  });

  context.onceMain(() => {
    setInterval(() => createBackup(context.api, 'hourly'), ONE_HOUR);
  });

  return true;
}

export default init;
