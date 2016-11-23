import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';


const app = appIn || remote.app;

/**
 * changes the chrome config file to allow for handling of the specified url scheme.
 * This has no effect if chrome is running
 */
function chromeAllowScheme(scheme: string): Promise<boolean> {
  let statePath: string;
  if (process.platform === 'win32') {
    statePath = path.resolve(app.getPath('appData'), '..', 'Local', 'Google',
                             'Chrome', 'User Data', 'Local State');
  } else if (process.platform === 'linux') {
    statePath = path.resolve(app.getPath('appData'), 'google-chrome', 'Local State');
  } else { // mac os
    statePath = path.resolve(app.getPath('appData'), 'Google', 'Chrome', 'Local State');
  }

  let changed = false;

  return fs.readFileAsync(statePath)
  .then((content: NodeBuffer) => {
    let state = JSON.parse(content.toString());
    log('info', 'protocol handler', state.protocol_handler);
    const currentState = getSafe(state, ['protocol_handler', 'excluded_schemes', scheme], false);
    log('info', 'current state', currentState);
    if (currentState) {
      state.protocol_handler.excluded_schemes[scheme] = false;
      changed = true;
      return fs.writeFileAsync(statePath + '.temp', JSON.stringify(state))
      .then(() => {
        return fs.unlinkAsync(statePath);
      })
      .then(() => {
        return fs.renameAsync(statePath + '.temp', statePath);
      });
    } else {
      return Promise.resolve();
    }
  })
  .then(() => {
    return Promise.resolve(changed);
  })
  ;
}

export default chromeAllowScheme;
