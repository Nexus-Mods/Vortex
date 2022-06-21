import Promise from 'bluebird';
import path from 'path';
import { fs } from '../..';

import { IExtensionApi, IExtensionContext, ITestResult } from '../../types/api';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { setPrimaryTool } from './actions';
import settingsReducer from './reducers';
import Tools from './Tools';

function testPrimaryTool(api: IExtensionApi): Promise<ITestResult> {
  const state = api.store.getState();
  const notifyInvalid = () => {
    api.sendNotification({
      id: 'invalid-primary-tool',
      type: 'warning',
      message: 'Invalid primary tool',
      actions: [
        { title: 'More', action: (dismiss) =>
          api.showDialog('info', 'Invalid primary tool', {
            text: api.translate('The primary tool for {{game}} is no longer available.'
                              + ' Quick launch has reverted to the game\'s executable.',
                                  { replace: { game: gameMode } }),
          }, [ { label: 'Close', action: () => dismiss() } ]),
        },
      ],
    });
  };

  const gameMode = activeGameId(state);
  if (gameMode === undefined) {
    return Promise.resolve(undefined);
  }
  const primaryToolId = getSafe(state,
    ['settings', 'interface', 'primaryTool', gameMode], undefined);

  if (truthy(primaryToolId)) {
    // We have a primary tool defined - ensure it's still valid.
    const primaryTool = getSafe(state,
      [ 'settings', 'gameMode', 'discovered', gameMode, 'tools', primaryToolId ], undefined);
    if ((primaryTool === undefined) || (!truthy(primaryTool.path))) {
      notifyInvalid();
      api.store.dispatch(setPrimaryTool(gameMode, undefined));
    } else {
      const workingDir = (primaryTool.workingDirectory !== undefined)
        ? primaryTool.workingDirectory
        : path.dirname(primaryTool.path);

      // Make sure all the required files are still present.
      const requiredFiles = primaryTool.requiredFiles.map(file => path.join(workingDir, file));
      return Promise.each(requiredFiles, (file: string) => fs.statAsync(file))
        .then(() => Promise.resolve(undefined))
        .catch(err => {
          notifyInvalid();
          api.store.dispatch(setPrimaryTool(gameMode, undefined));
          return Promise.resolve(undefined);
        });
    }
  }

  return Promise.resolve(undefined);
}

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'interface'], settingsReducer);

  context.registerDashlet('Tools', 2, 2, 100, Tools,
                          undefined, undefined, {
                            closable: false,
                          });

  context.registerTest('primary-tool', 'gamemode-activated',
    () => testPrimaryTool(context.api));
  return true;
}

export default init;
