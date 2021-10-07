import * as path from 'path';
import { getApplication } from './application';

import { IParameters } from './commandLine';
import Debouncer from './Debouncer';
import * as fs from './fs';
import { writeFileAtomic } from './fsAtomic';
import getVortexPath from './getVortexPath';
import { log } from './log';

const startupPath = () =>
  path.join(getVortexPath('appData'), getApplication().name, 'startup.json');

function read(): IParameters {
  try {
    return JSON.parse(fs.readFileSync(startupPath(), { encoding: 'utf-8' }));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log('warn', 'failed to parse startup.json', { error: err.message });
    }
    return {};
  }
}

const updateDebouncer = new Debouncer(() => {
  return writeFileAtomic(startupPath(), JSON.stringify(settings))
    .catch(err => {
      log('error', 'failed to write startup.json', { error: err.message });
    });
}, 100);

const settings: IParameters = read();

const proxy = new Proxy<IParameters>(settings, {
  set: (target: IParameters, key: string, value: any) => {
    target[key] = value;
    updateDebouncer.schedule();
    return true;
  },
});

export default proxy;
