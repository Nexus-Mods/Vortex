import Bluebird from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import reqResolve = require('resolve');

// tslint:disable-next-line
const Module = require('module');

/**
 * require a module asynchronously.
 * This makes only the file read asynchronous, compilation is still
 * synchronous (node is single threaded after all)
 * Use with care: does not add the module to the cache so using it
 * only makes sense if you know the module is required only once.
 *
 * @export
 * @param {string} id
 * @param {string} [basedir]
 * @returns {Bluebird<any>}
 */
export default function(id: string, basedir?: string): Bluebird<any> {
  return new Bluebird((resolve, reject) => {
    const options = basedir !== undefined ? { basedir } : undefined;
    reqResolve(id, options, (resErr, filePath) => {
      if (resErr) {
        return reject(resErr);
      }

      fs.readFile(filePath, (err, data) => {
        if (err !== null) {
          return reject(new Error(`failed to read ${filePath}: ${err.message}`));
        }
        const paths = Module._nodeModulePaths(path.dirname(filePath));
        const mod = new Module(filePath, module.parent);
        mod.filename = filePath;
        mod.paths = paths;
        mod._compile(data.toString('utf-8'), filePath);
        resolve(mod.exports);
      });
    });
  });
}

export class Placeholder extends React.Component<any, {}> {
  public render() {
    return null;
  }
}
