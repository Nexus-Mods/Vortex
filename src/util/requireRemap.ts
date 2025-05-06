// tslint:disable-next-line:no-var-requires
const Module = require('module');

import * as path from 'path';
import * as electron from './electron';
import {} from './libxmljs';

if (process.type === 'browser') {
  // on the main (node) process, this only sets up the ipc listeners as a side effect
  require('./libxmljs');
}

// when spawning a binary, the code doing the spawning will be baked by webpack
// in release builds and thus reside in the app.asar file.
// The binaries being spawned however have to be unpacked, so if the path being spawned
// includes something like __dirname we have to update that path to work.
class ChildProcessProxy {
  public get(target, key: PropertyKey): any {
    if (key === '__isProxied') {
      return true;
    } else if (key === 'spawn') {
      return (command: string, ...args) => {
        const appAsar = `${path.sep}app.asar${path.sep}`;
        command = command.replace(appAsar, `${path.sep}app.asar.unpacked${path.sep}`);
        return target.spawn(command, ...args);
      };
    } else {
      return target[key];
    }
  }
}

function patchedLoad(orig) {
  // tslint:disable-next-line:only-arrow-functions
  return function(request: string, parent, ...rest) {
    if ((request === 'fs')
        && ((parent.filename.indexOf('graceful-fs') !== -1)
            || (parent.filename.indexOf('rimraf') !== -1))) {
      request = 'original-fs';
    } else if (request === 'electron') {
      return electron;
    } else if ((request === '@electron/remote') && (process.type !== 'renderer')) {
      return undefined;
    } else if ((request === 'libxmljs') && (process.type === 'renderer')) {
      // the renderer process can not load libxmljs correctly any more so in that case this
      // returns a proxy object that will forward all calls to the main process
      return require('./libxmljs');
    }

    let res = orig.apply(this, [request, parent, ...rest]);

    if ((request === 'child_process') && !res.__isProxied) {
      res = new Proxy(res, new ChildProcessProxy());
    }

    return res;
  };
}

export default function() {
  const orig = (Module as any)._load;
  (Module as any)._load = patchedLoad(orig);
  return () => {
    (Module as any)._load = orig;
  };
}
