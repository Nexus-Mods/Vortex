import * as Promise from 'bluebird';
import opn = require('opn');
import * as winapi from 'winapi-bindings';

function open(target: string, wait?: boolean): Promise<void> {
  if ((winapi !== undefined) && !wait) {
    try {
      // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
      winapi.ShellExecuteEx({ verb: 'open', show: 'restore', file: target });
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    return Promise.resolve(opn(target, {
      wait,
    })).then(() => null);
  }
}

export default open;
