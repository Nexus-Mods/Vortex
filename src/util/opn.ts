import * as Promise from 'bluebird';
import * as winapi from 'winapi-bindings';
import { MissingInterpreter } from './api';
import opn = require('opn');

function open(target: string, wait?: boolean): Promise<void> {
  if ((winapi !== undefined) && !wait) {
    try {
      // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
      winapi.ShellExecuteEx({ verb: 'open', show: 'restore', file: target, mask: ['flag_no_ui'] });
      return Promise.resolve();
    } catch (err) {
      if (err.errno === 1155) {
        return Promise.reject(new MissingInterpreter('No default application set up for file type.', err.path));
      } else {
        return Promise.reject(err);
      }
    }
  } else {
    return Promise.resolve(opn(target, {
      wait,
    })).then(() => null);
  }
}

export default open;
