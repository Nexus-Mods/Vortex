import { IExtensionContext } from '../../types/IExtensionContext';
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
interface IProgressDelegate {
  (perc: number): void;
}

function testSupported(files: string[]): Promise<ISupportedResult> {
  if (testSupportedLib === undefined) {
    testSupportedLib = edge.func({
      assemblyFile: path.resolve(__dirname, '..', '..', 'lib', 'ModInstaller',
                                 'ModInstaller.dll'),
      typeName: 'Components.ModInstaller.InstallerProxy',
      methodName: 'TestSupported',
    });
  }

  return new Promise<ISupportedResult>((resolve, reject) => {
    testSupportedLib({files}, (err: Error, result: ISupportedResult) => {
      if ((err !== null) && (err !== undefined)) {
        log('info', 'got err', util.inspect(err));
        reject(err);
      } else {
        log('info', 'got result', util.inspect(result));
        resolve(result);
      }
    });
  });
}

function install(files: string[], scriptPath: string,
                 progressDelegate: IProgressDelegate,
                 coreDelegates: Core): Promise<any> {
  if (installLib === undefined) {
    installLib = edge.func({
      assemblyFile: path.resolve(__dirname, '..', '..', 'lib', 'ModInstaller',
                                 'ModInstaller.dll'),
      typeName: 'Components.ModInstaller.InstallerProxy',
      methodName: 'Install',
    });
  }

  return new Promise((resolve, reject) => {
    installLib({ files, scriptPath, progressDelegate, coreDelegates },
      (err: Error, result: any) => {
        if ((err !== null) && (err !== undefined)) {
          log('info', 'got err', util.inspect(err));
          reject(err);
        } else {
          log('info', 'result', util.inspect(result));
          resolve(result);
        }
      });
  });
}

export interface IExtensionContextExt extends IExtensionContext {
  registerInstaller: (priority, testSupported, install) => void;
}

function init(context: IExtensionContextExt): boolean {
  if (context.registerInstaller) {
    context.registerInstaller(100, testSupported,
    (files, scriptPath, gameId, progressDelegate) => {
      context.api.store.dispatch(setInstallerDataPath(scriptPath));
      let coreDelegates = new Core(context.api, gameId);
      return install(files, scriptPath, progressDelegate, coreDelegates)
      .catch((err) => {
        context.api.store.dispatch(endDialog());
        return Promise.reject(err);
      })
      .finally(() => coreDelegates.detach())
      ;
    });
  }

  context.registerDialog('fomod-installer', InstallerDialog);

  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

  return true;
}

export default init;
