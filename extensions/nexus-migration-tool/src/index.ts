import { selectImportFolder } from './actions/session';
import { sessionReducer } from './reducers/session';
import ModMigrationPanel from './views/ModMigrationPanel';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

function init(context): boolean {

  context.registerAction('mod-import-icons', 200, 'download', {}, 'Import NMM Virtual Install',
    () => {
      context.api.store.dispatch(selectImportFolder(true));
  });

  context.registerMainPage('outdent', 'NMM Migration Tool', ModMigrationPanel, {
    hotkey: 'M',
    group: 'per-game',
    visible: () => true,
  });

  context.registerReducer(['session', 'modmigration'], sessionReducer);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;
  });

  return true;
}

export default init;
