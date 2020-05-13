import { MissingInterpreter } from './CustomErrors';

import Promise from 'bluebird';
import opn = require('opn');
import * as winapi from 'winapi-bindings';

import {ipcMain, ipcRenderer} from 'electron';

// apparently the browser process is treated as the foreground process and only it
// can bring a window to the foreground
if (ipcMain !== undefined && (winapi?.ShellExecuteEx !== undefined)) {
  ipcMain.on('__opn_win32', (evt, target) => {
    winapi.ShellExecuteEx({ verb: 'open', show: 'foreground' as any, file: target, mask: ['flag_no_ui'] });
  });
}

function open(target: string, wait?: boolean): Promise<void> {
  // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
  if ((winapi?.ShellExecuteEx !== undefined) && !wait) {
    try {
      if (ipcRenderer !== undefined) {
        ipcRenderer.send('__opn_win32', target);
      } else {
        winapi.ShellExecuteEx({ verb: 'open', show: 'foreground' as any, file: target, mask: ['flag_no_ui'] });
      }
      return Promise.resolve();
    } catch (err) {
      if (err.errno === 1155) {
        return Promise.reject(
          new MissingInterpreter('No default application set up for file type.', err.path));
      } else if (err.errno === 1223) {
        // Operation was canceled by the user.
        //  https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes--1000-1299-
        return Promise.resolve();
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
