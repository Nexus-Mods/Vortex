import { MissingInterpreter } from './CustomErrors';
import { log } from './log';

import Bluebird from 'bluebird';
import * as winapiT from 'winapi-bindings';

import {ipcMain, ipcRenderer, shell} from 'electron';

let winapi: typeof winapiT;
try {
  // tslint:disable-next-line:no-var-requires
  winapi = require('winapi-bindings');
} catch (err) {
  // nop
}

// apparently the browser process is treated as the foreground process and only it
// can bring a window to the foreground
if (ipcMain !== undefined && (winapi?.ShellExecuteEx !== undefined)) {
  ipcMain.on('__opn_win32', (evt, target) => {
    try {
      winapi.ShellExecuteEx({ verb: 'open', show: 'foreground' as any, file: target, mask: ['flag_no_ui'] });
    } catch (err) {
      log('warn', 'failed to run', { target, error: err.message });
    }
  });
}

function open(target: string, wait?: boolean): Bluebird<void> {
  // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
  if ((winapi?.ShellExecuteEx !== undefined) && !wait) {
    try {
      if (ipcRenderer !== undefined) {
        ipcRenderer.send('__opn_win32', target);
        return Bluebird.resolve();
      } else {
        try {
          winapi.ShellExecuteEx({ verb: 'open', show: 'foreground' as any, file: target, mask: ['flag_no_ui'] });
          return Bluebird.resolve();
        } catch (err) {
          return Bluebird.reject(err);
        }
      }
    } catch (err) {
      if (err.systemCode === 1155) {
        return Bluebird.reject(
          new MissingInterpreter('No default application set up for file type.', err.path));
      } else if (err.systemCode === 1223) {
        // Operation was canceled by the user.
        //  https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes--1000-1299-
        return Bluebird.resolve();
      } else {
        return Bluebird.reject(err);
      }
    }
  } else {
    if (wait) {
      return Bluebird.resolve(shell.openExternal(target, { activate: true }));
    } else {
      shell.openExternal(target, { activate: true });
      return Bluebird.resolve();
    }
  }
}

export default open;
