import { IExtensionApi } from '../../../types/IExtensionContext';
import convertGameId from './convertGameId';

import * as opn from 'opn';
import * as path from 'path';

function downloadMod(modId: string, newestFileId: string, gameMode: string, api: IExtensionApi) {
  if (newestFileId === '0') {
    let modPageUrl = path.join('http://www.nexusmods.com',
      convertGameId(gameMode), 'mods', modId);
    opn(modPageUrl);
  } else {
    let url = `nxm://${convertGameId(gameMode)}/mods/${modId}/files/${newestFileId}`;
    api.events.emit('download-updated-mod', url);
  }
}

export default downloadMod;
