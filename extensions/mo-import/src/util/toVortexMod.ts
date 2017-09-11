import { IModEntry } from '../types/moEntries';

import { types } from 'vortex-api';

function toVortexMod(input: IModEntry, md5Hash: string): types.IMod {
  const mod: types.IMod = {
    id: input.modName,
    state: 'installed',
    installationPath: input.modName,
    attributes: {
      name: input.modName,
      installTime: new Date(),
      version: input.modVersion,
      fileId: input.downloadId,
      fileMD5: md5Hash,
      notes: 'Imported from MO',
      category: input.categoryId,
    },
  };
  if (input.nexusId) {
    mod.attributes.source = 'nexus';
    mod.attributes.modId = input.nexusId;
  }
  return mod;
}

export default toVortexMod;
