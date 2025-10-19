import { MissingInterpreter } from './CustomErrors';
import { log } from './log';

// TODO: Remove Bluebird import - using native Promise;
import {ipcMain, ipcRenderer, shell} from 'electron';

import { isWindows } from './platform';
import * as winapiT from 'winapi-bindings';
const winapi: typeof winapiT = isWindows() ? require('winapi-bindings') : null;

// Platform detection utilities

try {
  // tslint:disable-next-line:no-var-requires
  // Platform-specific initialization
} catch (err) {
  // nop
}

// apparently the browser process is treated as the foreground process and only it
// can bring a window to the foreground
if (ipcMain !== undefined && winapi?.ShellExecuteEx) {
  ipcMain.on('__opn_win32', (evt, target) => {
    try {
      winapi?.ShellExecuteEx({ verb: 'open', show: 'foreground' as any, file: target, mask: ['flag_no_ui'] });
    } catch (err) {
      log('warn', 'failed to run', { target, error: err.message });
    }
  });
}

function open(target: string, wait?: boolean): Promise<void> {
  // TODO: technically with ShellExecuteEx we should be able to reproduce the wait behaviour
  if ((winapi?.ShellExecuteEx !== undefined) && !wait) {
    try {
      if (ipcRenderer !== undefined) {
        ipcRenderer.send('__opn_win32', target);
        return Promise.resolve();
      } else {
        try {
          winapi?.ShellExecuteEx({ verb: 'open', show: 'foreground' as any, file: target, mask: ['flag_no_ui'] });
          return Promise.resolve();
        } catch (err) {
          return Promise.reject(err);
        }
      }
    } catch (err) {
      if (err.systemCode === 1155) {
        return Promise.reject(
          new MissingInterpreter('No default application set up for file type.', err.path));
      } else if (err.systemCode === 1223) {
        // Operation was canceled by the user.
        //  https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes--1000-1299-
        return Promise.resolve();
      } else {
        return Promise.reject(err);
      }
    }
  } else {
    // On non-Windows platforms Electron's shell.openExternal expects a valid URL and
    // will throw "Invalid URL" for filesystem paths. Detect URLs by scheme; otherwise
    // open local files/folders using shell.openPath instead.
    const isURL = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || target.startsWith('www.');
    if (wait) {
      if (isURL) {
        return Promise.resolve(shell.openExternal(target, { activate: true }));
      } else {
        return new Promise<void>((resolve, reject) => {
          shell.openPath(target)
            .then((msg) => {
              if (msg) {
                reject(new Error(msg));
              } else {
                resolve();
              }
            })
            .catch(reject);
        });
      }
    } else {
      if (isURL) {
        shell.openExternal(target, { activate: true });
      } else {
        // Fire and forget, but log potential error string
        shell.openPath(target).then((msg) => {
          if (msg) {
            log('warn', 'openPath failed', { target, error: msg });
          }
        }).catch((err) => log('warn', 'openPath threw', { target, error: err?.message || err }));
      }
      return Promise.resolve();
    }
  }
}

export default open;
