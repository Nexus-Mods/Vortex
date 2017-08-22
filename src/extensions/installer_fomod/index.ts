import { IExtensionContext } from '../../types/IExtensionContext';
import { UserCanceled } from '../../util/CustomErrors';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';

import { ISupportedResult } from '../mod_management/types/ITestSupported';

import { endDialog, setInstallerDataPath } from './actions/installerUI';
import Core from './delegates/core';
import { installerUIReducer } from './reducers/installerUI';
import InstallerDialog from './views/InstallerDialog';

import * as Promise from 'bluebird';
import * as edgeT from 'edge';
const edge = lazyRequire<typeof edgeT>('edge');
import * as path from 'path';

import * as util from 'util';

let testSupportedLib;
let installLib;
type ProgressDelegate = (perc: number) => void;

function dirname() {
  return __dirname.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
}

function transformError(err: any): Error {
  if (typeof(err) === 'string') {
    // I hope these errors aren't localised or something...
    if (err === 'The operation was cancelled.') {
      // weeell, we don't actually know if it was the user who cancelled...
      return new UserCanceled();
    } else {
      return new Error(err);
    }
  } else {
    return new Error('unknown error: ' + util.inspect(err));
  }
}

function testSupported(files: string[]): Promise<ISupportedResult> {
  if (testSupportedLib === undefined) {
    testSupportedLib = edge.func({
      assemblyFile: path.resolve(dirname(), '..', '..', 'lib', 'ModInstaller',
                                 'ModInstaller.dll'),
      typeName: 'FomodInstaller.ModInstaller.InstallerProxy',
      methodName: 'TestSupported',
    });
  }

  return new Promise<ISupportedResult>((resolve, reject) => {
    testSupportedLib({files}, (err: Error, result: ISupportedResult) => {
      if ((err !== null) && (err !== undefined)) {
        log('info', 'got err', util.inspect(err));
        reject(transformError(err));
      } else {
        log('info', 'got result', util.inspect(result));
        resolve(result);
      }
    });
  });
}

let currentInstallPromise: Promise<any> = Promise.resolve();

function install(files: string[], scriptPath: string,
                 progressDelegate: ProgressDelegate,
                 coreDelegates: Core): Promise<any> {
  if (installLib === undefined) {
    installLib = edge.func({
      assemblyFile: path.resolve(dirname(), '..', '..', 'lib', 'ModInstaller',
                                 'ModInstaller.dll'),
      typeName: 'FomodInstaller.ModInstaller.InstallerProxy',
      methodName: 'Install',
    });
  }

  currentInstallPromise = new Promise((resolve, reject) => {
    installLib({ files, scriptPath, progressDelegate, coreDelegates },
      (err: Error, result: any) => {
        if ((err !== null) && (err !== undefined)) {
          log('info', 'got err', util.inspect(err));
          reject(transformError(err));
        } else {
          log('info', 'result', util.inspect(result));
          resolve(result);
        }
      });
  }).finally(() => {
    currentInstallPromise = Promise.resolve();
  });
  return currentInstallPromise;
}

export interface IExtensionContextExt extends IExtensionContext {
  registerInstaller: (priority, testSupported, install) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerInstaller(
    100, testSupported, (files, scriptPath, gameId, progressDelegate) => {
      const coreDelegates = new Core(context.api, gameId);
      return currentInstallPromise
        .then(() => {
          context.api.store.dispatch(setInstallerDataPath(scriptPath));
          return install(files, scriptPath, progressDelegate, coreDelegates);
        })
        .catch((err) => {
          context.api.store.dispatch(endDialog());
          return Promise.reject(err);
        })
        .finally(() => coreDelegates.detach());
      });

  context.registerDialog('fomod-installer', InstallerDialog);
  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

  return true;
}

export default init;
