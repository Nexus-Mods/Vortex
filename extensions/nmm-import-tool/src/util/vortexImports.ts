import { IFileEntry, IModEntry } from '../types/nmmEntries';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { actions, log, types } from 'vortex-api';

interface IVortexMod {
  [modId: string]: types.IMod;
}

export function createProfile(gameId: string, profileId: string,
                              profileName: string, dispatch: Redux.Dispatch<any>) {
  log ('info', 'Create profile: ', {gameId, profileId});
  dispatch(actions.setProfile({
    id: profileId,
    gameId,
    name: profileName,
    modState: {},
  }));
}

export function addMods(gameID: string, profileId: string,
                        modEntries: IModEntry[], dispatch: Redux.Dispatch<any>) {
  const mods: types.IMod[] = [];

  Promise.map(modEntries, modEntry => {
    const modName = modEntry.modFilename.substr(0, modEntry.modFilename.lastIndexOf('.'));
    const mod: types.IMod = {
      id: modName,
      type: '',
      state: 'installed',
      installationPath: modName,
      attributes: {
        name: modName,
        installTime: new Date(),
        version: modEntry.modVersion,
        fileId: modEntry.downloadId,
        fileMD5: modEntry.archiveMD5,
        notes: 'Imported using the NMM-Import-Tool',
        category: modEntry.categoryId,
      },
    };
    if (modEntry.nexusId) {
      mod.attributes.source = 'nexus';
      mod.attributes.modId = modEntry.nexusId;
    }

    mods.push(mod);
  })
  .then(() => {
    dispatch(actions.addMods(gameID, mods));
  })
  .then(() => {
    Promise.map(mods, mod => {
      enableMod(mod.id, profileId, dispatch);
    });
  });
}

function enableMod(modId: string, profileId: string, dispatch: Redux.Dispatch<any>) {
  dispatch(actions.setModEnabled(profileId, modId, true));
}
