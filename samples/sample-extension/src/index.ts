import { remote } from 'electron';
import { log, types } from 'vortex-api';

function main(context: types.IExtensionContext) {
  context.registerAction('global-icons', 100, 'menu', {}, 'Sample', () => {
    remote.dialog.showMessageBox(remote.getCurrentWindow(), {
      message: 'Hello World',
    });
  });
  return true;
}

export default main;
