import * as Promise from 'bluebird';
import {} from 'ffi';
import opn = require('opn');
import * as refT from 'ref';
import { log } from './log';
import { NotFound } from './CustomErrors';

let shell32;

export class Win32Error extends Error {
  private mCode: number;
  constructor(message: string, code: number) {
    super(`${message} (${code})`);
    this.name = this.constructor.name;
    this.mCode = code;
  }

  public get code(): number {
    return this.mCode;
  }
}

function initTypes() {
  if ((shell32 !== undefined) || (process.platform !== 'win32')) {
    return;
  }

  try {
    if (shell32 === undefined) {
      const ffi = require('ffi');
      const ref = require('ref');
      const voidPtr: refT.Type = ref.refType(ref.types.void);

      shell32 = new ffi.Library('Shell32', {
        ShellExecuteA: [ref.types.int32, [voidPtr, ref.types.CString, ref.types.CString,
          ref.types.CString, ref.types.CString, ref.types.int32]],
      });
    }
  } catch (err) {
    log('warn', 'failed to set up native shellexecute call', err.message);
    shell32 = undefined;
  }
}

function open(target: string, wait?: boolean): Promise<void> {
  initTypes();

  // TODO: can't implement wait behaviour with ShellExecute, would require ShellExecuteEx
  //   and then we can't get at error codes because GetLastError doesn't work with ffi...
  if ((shell32 !== undefined) && !wait) {
    return new Promise<void>((resolve, reject) => {
      shell32.ShellExecuteA.async(null, 'open', target, null,
        null, 5, (execErr: any, res: any) => {
          if (execErr !== null) {
            return reject(execErr);
          }
          if (res <= 32) {
            if (res === 2) {
              return reject(new NotFound(target));
            } else {
              return reject(new Win32Error('ShellExecute failed', res));
            }
          }
          return resolve();
        });
    });
  } else {
    return Promise.resolve(opn(target, {
      wait,
    })).then(() => null);
  }
}

export default open;
