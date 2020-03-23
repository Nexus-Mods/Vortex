// features to help restore vortex to a working state

import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';

import { createFullStateBackup } from '../../util/store';

import Workarounds from './Workarounds';

const ONE_HOUR = 60 * 60 * 1000;

function createBackup(api: IExtensionApi, name: string) {
  return createFullStateBackup(name, api.store)
    .catch(() => {
      api.sendNotification({
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

function init(context: IExtensionContext): boolean {
  context.registerSettings('Workarounds', Workarounds, () => ({
    onCreateManualBackup: () => {
      createBackup(context.api, 'manual')
        .then(() => context.api.sendNotification({
          type: 'success',
          message: 'Backup created',
        }));
    },
  }));

  context.onceMain(() => {
    setInterval(() => createBackup(context.api, 'hourly'), ONE_HOUR);
  });

  return true;
}

export default init;
