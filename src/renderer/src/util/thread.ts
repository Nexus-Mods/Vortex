import * as fs from "fs";

import PromiseBB from "bluebird";
import * as tmp from "tmp";

import { getRealNodeModulePaths } from "./webpack-hacks";

declare let __non_webpack_require__: NodeJS.Require;

function getErrorMessage(err: any): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return String(err);
}

// trampoline is serialized via .toString() and executed in a Worker thread.
// All require() calls use __non_webpack_require__ so webpack doesn't transform them.
function trampoline(baseDir: string, moduleRoot: string, main: (...args: any[]) => any) {
  const innerPath = __non_webpack_require__("path");
  const requireOrig = __non_webpack_require__;
  const newRequire: any = (id: string): any => {
    if (id.startsWith(".")) {
      return requireOrig(innerPath.join(baseDir, id));
    } else {
      return requireOrig(id);
    }
  };
  newRequire.requireActual = newRequire;
  __non_webpack_require__ = newRequire;
  (module as any).paths.push(moduleRoot);
}

function writeProgram(func: (...args: any[]) => any, moduleBase: string, args?: any[]): string {
  const projectRoot = getRealNodeModulePaths(process.cwd())[0]?.split("\\").join("/");

  let mainBody = trampoline.toString();
  mainBody = mainBody.slice(mainBody.indexOf("{") + 1, mainBody.lastIndexOf("}"));

  // We use __non_webpack_require__ in the trampoline so webpack doesn't transform
  // the calls, but that global doesn't exist in plain Node/Worker — alias it here.
  // __webpack_require__ is also aliased in case the caller's serialized func
  // contains webpack-transformed requires.
  let prog: string = `
        let __non_webpack_require__ = require;\n
        const __webpack_require__ = require;\n
        let moduleRoot = '${projectRoot}';\n
        let baseDir = '${moduleBase.replace(/\\/g, "/")}';\n
      `;
  args.forEach((arg) => {
    if (arg instanceof Function) {
      prog += arg.toString() + "\n";
    }
  });

  prog += `
        let main = ${func.toString()};\n
        ${mainBody}\n
        const res = main(${
          args !== undefined
            ? args
                .filter((arg) => !(arg instanceof Function))
                .map((arg) => JSON.stringify(arg))
                .join(", ") + ", require"
            : "require"
        });\n
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

export function runThreaded(
  func: (...args: any[]) => any,
  moduleBase: string,
  ...args: any[]
): PromiseBB<any> {
  return new PromiseBB((resolve, reject) => {
    tmp.file({ postfix: ".js" }, (err: any, tmpPath: string, fd: number, cleanup: () => void) => {
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
            console.error("failed to clean up temporary script", getErrorMessage(cleanupErr));
          }
          return reject(writeErr);
        }
        fs.close(fd, () => {
          const worker = new Worker(tmpPath);
          worker.onmessage = (evt) => {
            return resolve(evt.data);
          };
        });
      });
    });
  });
}
