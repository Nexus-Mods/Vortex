import { selectImportFolder, setImportStep } from './actions/session';
import { sessionReducer } from './reducers/session';
import ImportDialog from './views/ImportDialog';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { selectors, types, util } from 'vortex-api';

function init(context: types.IExtensionContext): boolean {
  if (process.platform !== 'win32') {
    // not going to work on other platforms because some of the path resolution
    // assumes windows.
    return false;
  }

  context.registerDialog('nmm-import', ImportDialog);

  context.registerReducer(['session', 'modimport'], sessionReducer);
  context.registerAction('mod-icons', 115, 'import', {}, 'Import from NMM', () => {
    context.api.store.dispatch(setImportStep('start'));
  });

  context.once(() => {
    context.api.setStylesheet('nmm-import-tool', path.join(__dirname, 'import-tool.scss'));
  });

  return true;
}

export default init;
