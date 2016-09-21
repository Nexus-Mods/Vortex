import { IExtensionApi } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import * as fs from 'fs';
import * as path from 'path';

function watchForMods(modPath: string, api: IExtensionApi) {
  fs.watch(modPath, (event: string, fileName: string) => {
    if (event === 'rename') {
      fs.exists(path.join(modPath, fileName), (exists: boolean) => {
        if (exists) {
          if (fileName.endsWith('.installing')) {
            log('info', 'new mod being installed', fileName);
          } else {
            log('info', 'new mod finished installing', fileName);
          }
        }
      });
    }
  });
}

export default watchForMods;
