import * as reactSelect from '../controls/ReactSelectWrap';

import ExtensionManager, { IRegisteredExtension } from './ExtensionManager';

import {} from 'module';
import { dynreq } from 'vortex-run';

// tslint:disable-next-line:no-var-requires
const Module = require('module');

import * as api from '../index';
import { LogLevel } from './log';

class ExtProxyHandler implements ProxyHandler<typeof api> {
  private mExt: IRegisteredExtension;
  constructor(ext: IRegisteredExtension) {
    this.mExt = ext;
  }

  public get(target: typeof api, p: PropertyKey, receiver: any): any {
    if (p === 'log') {
      return (level: LogLevel, message: string, metadata: any) => {
        target.log(level, `[${this.mExt.namespace}] ${message}`, metadata);
      };
    } else {
      return target[p];
    }
  }
}

const handlerMap: { [extId: string]: typeof api } = {};

/**
 * require wrapper to allow extensions to load modules from
 * the context of the main application
 * @param {any} orig
 * @returns
 */
function extensionRequire(orig, getExtensions: () => IRegisteredExtension[]) {
  const extensionPaths = ExtensionManager.getExtensionPaths();
  return function(id) {
    if (id === 'vortex-api') {
      const ext = getExtensions().find(iter => this.filename.startsWith(iter.path));
      if (ext !== undefined) {
        if (handlerMap[ext.name] === undefined) {
          handlerMap[ext.name] = new Proxy(api, new ExtProxyHandler(ext));
        }
        return handlerMap[ext.name];
      } else {
        // this happens in harmony-patcher which is treated as a separate module
        // but which is 100% dependent of vortex
        return api;
      }
    } else if (id === 'react-select') {
      return reactSelect;
    }
    if (extensionPaths.find(iter => this.filename.startsWith(iter.path)) !== undefined) {
      let res;
      try {
        res = dynreq(id);
      } catch (err) {
        // nop, leave res undefined so orig gets tried
      }
      if (res === undefined) {
        res = orig.apply(this, arguments);
      }
      return res;
    } else {
      return orig.apply(this, arguments);
    }
  };
}

export default function(getExtensions: () => IRegisteredExtension[]) {
  const orig = (Module as any).prototype.require;
  (Module as any).prototype.require = extensionRequire(orig, getExtensions);
}
