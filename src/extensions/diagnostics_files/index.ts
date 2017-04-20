import { IExtensionContext } from '../../types/IExtensionContext';

import { exec } from 'child_process';
import { app as appIn, remote } from 'electron';

function init(context: IExtensionContext): boolean {
  context.registerAction('help-icons', 100, 'bug', {}, 'Diagnostics Files', () => {
    exec('start ' + logPath(context.api.store));
  });

  return true;
}

function logPath(store: Redux.Store<any>): string {
  let app = appIn || remote.app;
  return app.getPath('userData');
}

export default init;
