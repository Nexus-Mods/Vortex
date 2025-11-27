import * as path from 'path';
import { types, util } from 'vortex-api';

export function profileSavePath(profile: types.IProfile, forceGlobal: boolean = false) {
  const localSaves = util.getSafe(profile, ['features', 'local_saves'], false);
  if (profile.gameId === 'enderal') {
    return localSaves && !forceGlobal
      ? path.join('..', 'Enderal', 'Saves', profile.id) + path.sep
      : path.join('..', 'Enderal', 'Saves') + path.sep;
  } else if (profile.gameId === 'enderalspecialedition') {
    return localSaves && !forceGlobal
      ? path.join('..', 'Enderal Special Edition', 'Saves', profile.id) + path.sep
      : path.join('..', 'Enderal Special Edition', 'Saves') + path.sep;
  } else {
    return localSaves && !forceGlobal
      ? path.join('Saves', profile.id) + path.sep
      : 'Saves' + path.sep;
  }
}
