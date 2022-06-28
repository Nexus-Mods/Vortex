import Promise from 'bluebird';
import path from 'path';
import { fs } from '../..';

import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext'
import { ITestResult } from '../../types/ITestResult';
import { IStarterInfo } from '../../util/StarterInfo'
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { setPrimaryTool } from './actions';
import settingsReducer from './reducers';
import Tools from './Tools';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';

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

  context.registerDashlet('Tools', 2, 2, 100, Tools, undefined,
    () => ({
      onGetValidTools: (starters: IStarterInfo[], gameMode: string) =>
        validateTools(context.api, starters, gameMode),
    }), {
      closable: false,
    });

  context.registerTest('primary-tool', 'gamemode-activated',
    () => testPrimaryTool(context.api));
  return true;
}

function validateTools(api: IExtensionApi, starters: IStarterInfo[], gameMode: string) {
  const state = api.getState();
  const discovery: IDiscoveryResult = getSafe(state, ['settings', 'gameMode', 'discovered', gameMode], {});
  if (discovery?.path === undefined) {
    return Promise.resolve([]);
  }

  return Promise.reduce(starters, (accum, iter) => {
    if (iter?.exePath === undefined) {
      return Promise.resolve(accum);
    }
    const exePath = path.isAbsolute(iter.exePath)
      ? iter.exePath
      : path.join(discovery.path, iter.exePath);
    return fs.statAsync(exePath)
      .then(() => accum.push(iter.id))
      .catch(() => Promise.resolve())
      .then(() => Promise.resolve(accum));
  }, []);
}

export default init;
