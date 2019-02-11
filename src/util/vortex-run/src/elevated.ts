import * as Bluebird from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import * as winapi from 'winapi-bindings';

function elevatedMain(moduleRoot: string, ipcPath: string,
                      main: (ipc, req: NodeRequireFunction) =>
                        void | Promise<void> | Bluebird<void>) {
  const handleError = (error: any) => {
    // tslint:disable-next-line:no-console
    console.error('Elevated code failed', error.stack);
  };
  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);
  // tslint:disable-next-line:no-shadowed-variable
  (module as any).paths.push(moduleRoot);
  // tslint:disable-next-line:no-shadowed-variable
  const ipc = require('node-ipc');
  ipc.config.maxRetries = 5;
  ipc.config.stopRetrying = 5;
  ipc.connectTo(ipcPath, ipcPath, () => {
    ipc.of[ipcPath].on('quit', () => {
      process.exit(0);
    });
    Promise.resolve()
      .then(() => Promise.resolve(main(ipc.of[ipcPath], require)))
      .catch(error => {
        ipc.of[ipcPath].emit('error', error.message);
        return new Promise((resolve) => setTimeout(resolve, 200));
      })
      .then(() => {
        ipc.disconnect(ipcPath);
        process.exit(0);
      });
  });
}

/**
 * run a function as an elevated process (windows only!).
 * This is quite a hack because obviously windows doesn't allow us to elevate a
 * running process so instead we have to store the function code into a file and start a
 * new node process elevated to execute that script.
 *
 * IMPORTANT As a consequence the function can not bind any parameters
 *
 * @param {string} ipcPath a unique identifier for a local ipc channel that can be used to
 *                 communicate with the elevated process (as stdin/stdout can not be)
 *                 redirected
 * @param {Function} func The closure to run in the elevated process. Try to avoid
 *                        'fancy' code. This function receives two parameters, one is an ipc stream,
 *                        connected to the path specified in the first parameter.
 *                        The second function is a require function which you need to use instead of
 *                        the global require. Regular require calls will not work in production
 *                        builds
 * @param {Object} args arguments to be passed into the elevated process
 * @returns {Bluebird<any>} a promise that will be resolved as soon as the process is started
 *                          (which happens after the user confirmed elevation)
 */
function runElevated(ipcPath: string, func: (ipc: any, req: NodeRequireFunction) =>
                        void | Promise<void> | Bluebird<void>,
                     args?: any): Bluebird<any> {
  return new Bluebird((resolve, reject) => {
    tmp.file((err: Error, tmpPath: string, fd: number, cleanup: () => void) => {
      if (err) {
        return reject(err);
      }

      const projectRoot = path.resolve(__dirname, '../..').split('\\').join('/');

      let mainBody = elevatedMain.toString();
      mainBody = mainBody.slice(mainBody.indexOf('{') + 1, mainBody.lastIndexOf('}'));

      let prog: string = `
        let moduleRoot = '${projectRoot}';\n
        let ipcPath = '${ipcPath}';\n
      `;

      if (args !== undefined) {
        for (const argKey of Object.keys(args)) {
          if (args.hasOwnProperty(argKey)) {
            prog += `let ${argKey} = ${JSON.stringify(args[argKey])};\n`;
          }
        }
      }

      prog += `
        let main = ${func.toString()};\n
        ${mainBody}\n
      `;

      fs.write(fd, prog, (writeErr: Error, written: number, str: string) => {
        if (writeErr) {
          cleanup();
          return reject(writeErr);
        }

        try {
          winapi.ShellExecuteEx({
            verb: 'runas',
            file: process.execPath,
            parameters: `--run ${tmpPath}`,
            directory: path.dirname(process.execPath),
            show: 'shownormal',
          });
          return resolve();
        } catch (err) {
          return reject(err);
        }
      });
    });
  });
}

export default runElevated;
