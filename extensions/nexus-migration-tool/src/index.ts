import { selectImportFolder } from './actions/session';
import { sessionReducer } from './reducers/session';
import ModMigrationPanel from './views/ModMigrationPanel';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

function init(context): boolean {

  context.registerMainPage('import', 'NMM Migration Tool', ModMigrationPanel, {
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
