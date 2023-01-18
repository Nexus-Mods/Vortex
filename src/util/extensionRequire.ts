import * as reactSelect from '../controls/ReactSelectWrap';

import ExtensionManager, { IRegisteredExtension } from './ExtensionManager';

import {} from 'module';
import * as reduxAct from 'redux-act';
import { dynreq } from 'vortex-run';

// tslint:disable-next-line:no-var-requires
const Module = require('module');

import * as api from '../index';
import { LogLevel } from './log';

const identity = input => input;

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

class ExtProxyHandlerReduxAct implements ProxyHandler<typeof reduxAct> {
  private mExt: IRegisteredExtension;
  constructor(ext: IRegisteredExtension) {
    this.mExt = ext;
  }

  public get(target: typeof reduxAct, p: PropertyKey, receiver: any): any {
    if (p === 'createAction') {
      return (description, payloadReducer, metaReducer) => {
        // add information about the extension emitting an action, unfortunately
        // createAction has a ton of signatures:
        // export function createAction(): EmptyActionCreator;
        // export function createAction(description: string): EmptyActionCreator;
        // export function createAction<P, M={}>(): SimpleActionCreator<P, M>;
        // export function createAction<P, M={}>(description: string): SimpleActionCreator<P, M>;
        // 
        // export function createAction<Arg1, P, M={}>(description: string, payloadReducer: PayloadReducer1<Arg1, P>, metaReducer?: MetaReducer<M>): ComplexActionCreator1<Arg1, P, M>;
        // export function createAction<Arg1, Arg2, P, M={}>(description: string, payloadReducer: PayloadReducer2<Arg1, Arg2, P>, metaReducer?: MetaReducer<M>): ComplexActionCreator2<Arg1, Arg2, P, M>;
        // export function createAction<Arg1, Arg2, Arg3, P, M={}>(description: string, payloadReducer: PayloadReducer3<Arg1, Arg2, Arg3, P>, metaReducer?: MetaReducer<M>): ComplexActionCreator3<Arg1, Arg2, Arg3, P, M>;
        // export function createAction<Arg1, Arg2, Arg3, Arg4, P, M={}>(description: string, payloadReducer: PayloadReducer4<Arg1, Arg2, Arg3, Arg4, P>, metaReducer?: MetaReducer<M>): ComplexActionCreator4<Arg1, Arg2, Arg3, Arg4, P, M>;
        // export function createAction<Arg1, Arg2, Arg3, Arg4, Arg5, P, M={}>(description: string, payloadReducer: PayloadReducer5<Arg1, Arg2, Arg3, Arg4, Arg5, P>, metaReducer?: MetaReducer<M>): ComplexActionCreator5<Arg1, Arg2, Arg3, Arg4, Arg5, P, M>;
        // export function createAction<Arg1, Arg2, Arg3, Arg4, Arg5, Arg6, P, M={}>(description: string, payloadReducer: PayloadReducer6<Arg1, Arg2, Arg3, Arg4, Arg5, Arg6, P>, metaReducer?: MetaReducer<M>): ComplexActionCreator6<Arg1, Arg2, Arg3, Arg4, Arg5, Arg6, P, M>;
        //
        // export function createAction<P, M={}>(description: string, payloadReducer:PayloadReducer<P>): ComplexActionCreator<P, M>;
        // export function createAction<P, M={}>(description: string, payloadReducer: PayloadReducer<P>, metaReducer?: MetaReducer<M>): ComplexActionCreator<P, M>;
        // export function createAction<P, M={}>(payloadReducer: PayloadReducer<P>, metaReducer?: MetaReducer<M>): ComplexActionCreator<P, M>;

        if (typeof description === 'function') {
          metaReducer = payloadReducer;
          payloadReducer = description;
          description = undefined;
        }

        if (typeof payloadReducer !== 'function') {
          payloadReducer = identity;
        }

        if (typeof metaReducer !== 'function') {
          metaReducer = undefined;
        }

        if (metaReducer === undefined) {
          metaReducer = () => ({ extension: this.mExt.name });
        } else {
          const oldMetaReducer = metaReducer;
          metaReducer = () => ({ ...oldMetaReducer(), extension: this.mExt.name });
        }

        if (description === undefined) {
          return reduxAct.createAction(payloadReducer, metaReducer);
        } else {
          return reduxAct.createAction(description, payloadReducer, metaReducer);
        }
      };
    } else {
      return target[p];
    }
  }
}

const handlerMapAPI: { [extId: string]: typeof api } = {};
const handlerMapReactAct: { [extId: string]: typeof reduxAct } = {};

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
        if (handlerMapAPI[ext.name] === undefined) {
          handlerMapAPI[ext.name] = new Proxy(api, new ExtProxyHandler(ext));
        }
        return handlerMapAPI[ext.name];
      } else {
        // this happens in harmony-patcher which is treated as a separate module
        // but which is 100% dependent of vortex
        return api;
      }
    } else if (id === 'react-select') {
      return reactSelect;
    } else if (id === 'redux-act') {
      const ext = getExtensions().find(iter => this.filename.startsWith(iter.path));
      if (ext !== undefined) {
        if (handlerMapReactAct[ext.name] === undefined) {
          handlerMapReactAct[ext.name] = new Proxy(reduxAct, new ExtProxyHandlerReduxAct(ext));
        }
        return handlerMapReactAct[ext.name];
      }
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
