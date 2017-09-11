import findInstances from './util/findInstances';
import ImportDialog from './views/ImportDialog';

import * as path from 'path';
import { actions, selectors, types } from 'vortex-api';

function init(context: types.IExtensionContext): boolean {
  if (process.platform !== 'win32') {
    // not going to work on other platforms because some of the path resolution
    // assumes windows.
    return false;
  }

  context.registerDialog('mo-import', ImportDialog);

  context.registerAction('mod-icons', 120, 'import', {}, 'Import from MO', () => {
    context.api.store.dispatch(actions.setDialogVisible('mo-import'));
  });

  context.once(() => {
    const store = context.api.store;
    context.api.setStylesheet('mo-import', path.join(__dirname, 'mo-import.scss'));
  });

  return true;
}

export default init;
