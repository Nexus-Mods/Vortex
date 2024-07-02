/*
  libxmljs has been deprecated on the 28th of May 2024
*/
// import { ipcMain, ipcRenderer } from 'electron';
// import * as libxmljsT from 'libxmljs';
// import * as _ from 'lodash';
// import { generate as shortid } from 'shortid';
// import { isFunction } from './util';

// /// Proxy all calls to libxmljs from the renderer process to the main (aka browser) process, every
// /// result that isn't a plain old datatype will be Proxy-ed so that all access to their
// /// properties are also forwarded.

// function isPlain(input: any) {
//   return ['string', 'number', 'boolean'].includes(typeof input);
// }

// const knownObjects: { [id: string]: any } = {};

// interface IProxyRef {
//   proxy: string;
//   props?: string[];
// }

// const finReg = (process.type === 'renderer') ? new FinalizationRegistry(heldValue => {
//   ipcRenderer.send('__libxmljs_del', heldValue);
// }) : null;

// /**
//  * proxy handler around libxmljs objects that forwards all access to the main process
//  */
// class XMLProxy implements ProxyHandler<IProxyRef> {
//   public get(target: IProxyRef, p: string | symbol, receiver: any): any {
//     if (p === 'then') {
//       // hack: we're certainly not a promise...
//       return undefined;
//     }
//     if (p === '__target') {
//       return target;
//     }
//     if ((target.proxy === undefined)
//         || ((typeof p === 'string') && !target.props.includes(p))) {
//       return (...args) => {
//         const effectiveArgs = args.map(arg => arg?.__target ?? arg);
//         return this.deserializeResult(
//           ipcRenderer.sendSync('__libxmljs_invoke', p, target?.['proxy'], effectiveArgs));
//       };
//     } else {
//       return this.deserializeResult(
//         ipcRenderer.sendSync('__libxmljs_get', p, target?.['proxy']));
//     }
//   }

//   private deserializeResult(res) {
//     if (res.error !== undefined) {
//       throw new Error(res.error);
//     } else if (res.results !== undefined) {
//       return res.results.map(i => this.unpackProxy(i));
//     } else {
//       return this.unpackProxy(res);
//     }
//   }

//   private unpackProxy(input) {
//     if (input.result !== undefined) {
//       return input.result;
//     } else {
//       const prox = new Proxy(input, new XMLProxy());
//       finReg.register(prox, input.proxy);
//       return prox;
//     }
//   }
// }

// /**
//  * for plain data types, pack the data, otherwise pack just an object id for the proxy
//  */
// function packProperty(res) {
//   if (isPlain(res)) {
//     return { result: res };
//   }
//   const id = shortid();
//   knownObjects[id] = res;

//   return {
//     proxy: id,
//     props: Object.getOwnPropertyNames(res).filter(key => !isFunction(res[key])),
//   };
// }

// function serializeResult(res) {
//   if ((res === undefined) || (res === null)) {
//     return { result: res };
//   }
//   return (Array.isArray(res))
//     ? { results: res.map(i => packProperty(i)) }
//     : packProperty(res);
// }

// if (process['type'] === 'renderer') {
//   module.exports = new Proxy({ proxy: undefined }, new XMLProxy());
// } else {
//   // function invocation to a libxmljs object
//   ipcMain.on('__libxmljs_invoke', (event, func: string, obj: string, args) => {
//     try {
//       // tslint:disable-next-line:no-var-requires
//       const libxmljs = require('libxmljs');
//       if ((obj !== undefined) && (knownObjects[obj][func] === undefined)) {
//         const type = knownObjects[obj].type?.() ?? 'custom';
//         event.returnValue = {
//           error: `Element of type ${type} has no property ${func}` };
//         return;
//       }

//       const effectiveArgs = args.map(arg => (arg.proxy !== undefined)
//         ? knownObjects[arg.proxy]
//         : arg);

//       const res = (obj === undefined)
//         ? libxmljs[func](...effectiveArgs)
//         : knownObjects[obj][func](...effectiveArgs);

//       event.returnValue = serializeResult(res);
//     } catch (err) {
//       event.returnValue = { error: err.message };
//     }
//   });

//   // data access to a libxmljs object
//   ipcMain.on('__libxmljs_get', (event, prop: string, obj: string) => {
//     // tslint:disable-next-line:no-var-requires
//     const libxmljs = require('libxmljs');
//     const res = (obj === undefined)
//       ? libxmljs[prop]
//       : knownObjects[obj][prop];
//     event.returnValue = serializeResult(res);
//   });

//   ipcMain.on('__libxmljs_del', (event, objId) => {
//     delete knownObjects[objId];
//   });
// }
