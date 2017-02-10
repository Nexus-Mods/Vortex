import {IExtensionContext} from '../../types/IExtensionContext';

import { setInstallerDataPath } from './actions/installerUI';
import Core from './delegates/core';
import { installerUIReducer } from './reducers/installerUI';
import InstallerDialog from './views/InstallerDialog';

import * as edge from 'electron-edge';
import * as path from 'path';

import * as util from 'util';

import {log} from '../../util/log';

const testSupportedLib = edge.func({
  assemblyFile: path.resolve(__dirname, '..', '..', 'lib', 'ModInstaller',
                             'ModInstaller.dll'),
  typeName: 'Components.ModInstaller.InstallerProxy',
  methodName: 'TestSupported',
});

const installLib = edge.func({
  assemblyFile: path.resolve(__dirname, '..', '..', 'lib', 'ModInstaller',
                             'ModInstaller.dll'),
  typeName: 'Components.ModInstaller.InstallerProxy',
  methodName: 'Install',
});

interface IProgressDelegate {
  (perc: number): void;
}

let coreDelegates: Core;

function testSupported(files: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    testSupportedLib({files}, (err: Error, result: boolean) => {
      if ((err !== null) && (err !== undefined)) {
        log('info', 'got err', util.inspect(err));
        // TODO: hack while the c# installer doesn't work correctly
        // reject(err);
        resolve({ supported: true, requiredFiles: [] });
      } else {
        log('info', 'got result', util.inspect(result));
        resolve(result);
      }
    });
  });
}

function install(files: string[], scriptPath: string,
                 progressDelegate: IProgressDelegate): Promise<any> {
  return new Promise((resolve, reject) => {
    installLib({files, scriptPath, progressDelegate, coreDelegates},
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
    (files, scriptPath, progressDelegate) => {
      context.api.store.dispatch(setInstallerDataPath(scriptPath));
      return install(files, scriptPath, progressDelegate);
    });
  }

  context.registerDialog('fomod-installer', InstallerDialog);

  context.registerReducer(['session', 'fomod', 'installer', 'dialog'], installerUIReducer);

  context.once(() => {
    coreDelegates = new Core(context.api);
  });

  return true;
}

export default init;
