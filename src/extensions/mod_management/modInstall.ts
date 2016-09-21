import { IExtensionApi } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { addMod, setModAttribute, setModState } from './actions/mods';
import { IMod } from './types/IMod';
import resolvePath from './util/resolvePath';

import * as fs from 'fs';
import * as path from 'path';

// import { ElementSpec, FileSpec, extract7z, list7z } from 'node-7z';
import Zip = require('node-7z');

export function startInstallFile(api: IExtensionApi) {
  let destination: string;
  let fileName: string;

  let task = new Zip();

  let extract7z = task.extract;

  api.selectFile({})
    .then((selectedFile: string) => {
      if (selectedFile === undefined) {
        return;
      }
      fileName = selectedFile;
      const baseName = path.basename(fileName, path.extname(fileName));
      destination = path.join(resolvePath('install', api.getState()),
        baseName);

      log('info', 'installing archive', { fileName, destination });

      api.sendNotification({
        id: 'install_' + baseName,
        message: 'Installing ' + baseName,
        type: 'info',
      });

      const mod: IMod = {
        id: baseName,
        archivePath: fileName,
        installationPath: destination,
        state: 'installing',
        attributes: {
          name: baseName,
          installTime: 'ongoing',
        },
      };

      api.dispatch(addMod(mod));

      extract7z(fileName, destination + '.installing', {})
        .then((args) => {
          fs.rename(destination + '.installing', destination, (err) => {
            api.dismissNotification('install_' + baseName);
            if (err !== null) {
              api.showErrorNotification(`failed to rename ${destination}`, err.message);
            } else {
              api.sendNotification({
                message: `Installation of ${baseName} completed`,
                type: 'success',
                displayMS: 5000,
              });
              api.dispatch(setModState(baseName, 'installed'));
              api.dispatch(setModAttribute(baseName, 'installTime', new Date()));
            }
          });
        }).catch((err) => {
          api.showErrorNotification('failed to extract', err);
        });
    }).catch((err) => {
      api.showErrorNotification('failed to display file dialog', err);
    });
}
