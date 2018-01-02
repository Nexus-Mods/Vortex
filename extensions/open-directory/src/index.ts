import * as fs from 'fs-extra-promise';
import * as opn from 'opn';
import * as path from 'path';
import { selectors, types } from 'vortex-api';

function init(context: types.IExtensionContext) {
  context.registerAction('mod-icons', 300, 'open-ext', {},
                         'Open in File Manager', () => {
    const store = context.api.store;
    opn(selectors.installPath(store.getState()));
  });

  context.registerAction('mods-action-icons', 100, 'open-ext', {},
                         'Open in File Manager', (instanceIds: string[]) => {
    const store = context.api.store;
    const installPath = selectors.installPath(store.getState());
    const modPath = path.join(installPath, instanceIds[0]);
    return fs.statAsync(modPath)
      .then(() => opn(modPath))
      .catch(err => opn(installPath));
  }, instanceIds => {
    const state: types.IState = context.api.store.getState();
    const gameMode = selectors.activeGameId(state);
    return state.persistent.mods[gameMode][instanceIds[0]] !== undefined;
  });

  context.registerAction('download-icons', 300, 'open-ext', {},
                         'Open in file manager', () => {
    const store = context.api.store;
    opn(selectors.downloadPath(store.getState()));
  });

  return true;
}

export default init;
