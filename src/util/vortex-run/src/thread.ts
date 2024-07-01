import Promise from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

function trampoline(baseDir: string, moduleRoot: string,
                    main: (...args: any[]) => any) {
  const innerPath = require('path');
  const requireOrig = require;
  const newRequire: any = (id: string): any => {
    if (id.startsWith('.')) {
      return requireOrig(innerPath.join(baseDir, id));
    } else {
      return requireOrig(id);
    }
  };
  newRequire.requireActual = newRequire;
  require = newRequire;
  (module as any).paths.push(moduleRoot);
}

function writeProgram(func: (...args: any[]) => any, moduleBase: string, args?: any[]): string {
  const projectRoot = path.resolve(__dirname, '../../node_modules').split('\\').join('/');

  let mainBody = trampoline.toString();
  mainBody = mainBody.slice(mainBody.indexOf('{') + 1, mainBody.lastIndexOf('}'));

  let prog: string = `
        let moduleRoot = '${projectRoot}';\n
        let baseDir = '${moduleBase.replace(/\\/g, '/')}';\n
      `;
  args.forEach(arg => {
    if (arg instanceof Function) {
      prog += arg.toString() + '\n';
    }
  });

  prog += `
        let main = ${func.toString()};\n
        ${mainBody}\n
        const res = main(${args !== undefined
          ? args.filter(arg => !(arg instanceof Function))
                .map(arg => JSON.stringify(arg))
                .join(', ') + ', require'
          : 'require'});\n
        if ((res !== undefined) && (res.then !== undefined)) {
          res.then(result => {
            postMessage(result, undefined);
            close();
          });
        } else {
          postMessage(res, undefined);\n
          close();
        }\n
      `;

  return prog;
}

function runThreaded(func: (...args: any[]) => any,
                     moduleBase: string, ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    tmp.file({ postfix: '.js' }, (err: any, tmpPath: string, fd: number, cleanup: () => void) => {
      if (err) {
        return reject(err);
      }

      const program = writeProgram(func, moduleBase, args);

      fs.write(fd, program, (writeErr: any, written: number, str: string) => {
        if (writeErr) {
          try {
            cleanup();
          } catch (cleanupErr) {
            // tslint:disable-next-line:no-console
            console.error('failed to clean up temporary script', cleanupErr.message);
          }
          return reject(writeErr);
        }
        fs.close(fd, () => {
          const worker = new Worker(tmpPath);
          worker.onmessage = evt => {
            return resolve(evt.data);
          };
        });
      });
    });
  });
}

export default runThreaded;
