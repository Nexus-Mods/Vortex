import {IExtensionContext} from '../../types/IExtensionContext';
import Core from './delegates/core';
import * as edge from 'electron-edge';
import * as path from 'path';

import {log} from '../../util/log';

import * as util from 'util';

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

let coreDelegates;

function testSupported(files: string[]): Promise<boolean> {
  log('info', 'testsupported called', util.inspect(files));
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

function install(files: string[], destinationPath: string,
                 progressDelegate: IProgressDelegate): Promise<any> {
  return new Promise((resolve, reject) => {
    installLib({files, destinationPath, progressDelegate, coreDelegates},
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
    context.registerInstaller(100, testSupported, install);
  }

  this.coreDelegates = new Core(context.api);

  return true;
}

export default init;
