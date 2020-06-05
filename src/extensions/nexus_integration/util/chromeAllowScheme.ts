import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { getSafe, setSafe } from '../../../util/storeHelper';
import { deBOM } from '../../../util/util';

import chromePath from './chromePath';

import Promise from 'bluebird';

/**
 * changes the chrome config file to allow for handling of the specified url scheme.
 * This has no effect if chrome is running
 */
function chromeAllowScheme(scheme: string): Promise<boolean> {
  let changed = false;

  return chromePath()
  .then((statePath) => fs.readFileAsync(statePath, { encoding: 'utf8' })
    .then((content: string) => {
      let state = JSON.parse(deBOM(content));
      log('info', 'protocol handler', state.protocol_handler);
      const currentState = getSafe(state, ['protocol_handler', 'excluded_schemes', scheme], true);
      log('info', 'current state', currentState);
      if (currentState) {
        state = setSafe(state, ['protocol_handler', 'excluded_schemes', scheme], false);
        changed = true;
        return fs.writeFileAsync(statePath + '.temp', JSON.stringify(state))
        .then(() => fs.unlinkAsync(statePath))
        .then(() => fs.renameAsync(statePath + '.temp', statePath));
      } else {
        return Promise.resolve();
      }
    }))
  .then(() => Promise.resolve(changed));
}

export default chromeAllowScheme;
