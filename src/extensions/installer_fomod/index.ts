import {IExtensionContext} from '../../types/IExtensionContext';
import * as edge from 'electron-edge';
import * as path from 'path';

import {log} from '../../util/log';

const testSupported = edge.func({
  assemblyFile: path.resolve(__dirname, '..', '..', 'lib', 'ModInstaller', 'ModInstaller.dll'),
  typeName: 'Components.ModInstaller.InstallerProxy',
  methodName: 'TestSupported',
});

const install = edge.func({
  assemblyFile: path.resolve(__dirname, '..', '..', 'lib', 'ModInstaller', 'ModInstaller.dll'),
  typeName: 'Components.ModInstaller.InstallerProxy',
  methodName: 'Install',
});

function init(context: IExtensionContext): boolean {
  context.once(() => {
    testSupported({ files: ['dummy.esp', 'textures/dummy.dds'] }, (err, result) => {
      log('info', 'supported', { err, result });
    });
    install(
        {
          files: ['dummy.esp', 'textures/dummy.dds'],
          destinationPath: 'c:\\do\\we\\need\\this',
          progressDelegate: (perc: number) => log('info', 'installer progress', perc),
        },
        (err, result) => {
          log('info', 'install', {err, result});
        });
  });

  return true;
}

export default init;
