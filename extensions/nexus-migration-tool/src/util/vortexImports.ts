import * as Promise from 'bluebird';
import { actions as nmmActions, deriveInstallName, types } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { generate as shortid } from 'shortid';
import { IFileEntry as FileEntry, IModEntry as ModEntry } from './nmmEntries';

interface IVortexMod {
  [modId: string]: types.IMod;
}

export function createProfile(gameId: string, profileId: string,
                              profileName: string, dispatch: Redux.Dispatch<any>) {
  dispatch(nmmActions.setProfile({
    id: profileId,
    gameId,
    name: profileName,
    modState: {},
  }));
}

export function addMods(gameID: string, modEntries: ModEntry[], dispatch: Redux.Dispatch<any>) {
  const mods: types.IMod[] = [];

  Promise.map(modEntries, modEntry => {
    const modName = modEntry.modFilename.substr(0, modEntry.modFilename.lastIndexOf('.'));
    const mod: types.IMod = {
      id: deriveInstallName(modName, ''),
      state: 'installed',
      archiveId: shortid(),
      installationPath: modName,
      attributes: {
        name: modName,
        installTime: new Date().getTime().toString(),
        version: modEntry.modVersion,
        fileId: modEntry.downloadId,
        fileMD5: modEntry.archiveMD5,
        notes: 'Imported using the NMM-Migration-Tool',
      },
    };

    mods.push(mod);
  });

  dispatch(nmmActions.addMods(gameID, mods));
}

function enableMod(mod: types.IMod, profile: types.IProfile, dispatch: Redux.Dispatch<any>) {
  dispatch(nmmActions.setModEnabled(profile.id, mod.id, true));
}
