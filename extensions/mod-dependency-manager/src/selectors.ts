import { IModLookupInfo } from './types/IModLookupInfo';

import { selectors, types, util } from 'nmm-api';
import { createSelector } from 'reselect';

const allMods = (state: types.IState) => state.persistent.mods;

const currentGameMods = createSelector(allMods, selectors.activeGameId, (inMods, gameId) =>
  inMods[gameId]);

const modState = createSelector(selectors.activeProfile, (profile) => profile.modState);

export const enabledModKeys = createSelector(currentGameMods, modState, (mods, modStateIn) => {
  const res: IModLookupInfo[] = [];

  Object.keys(mods).forEach(modId => {
    const attributes = mods[modId].attributes;
    if (util.getSafe(modStateIn, [modId, 'enabled'], false)
        && (attributes['fileMD5'] || attributes['fileName'] || attributes['logicalFileName'])) {
      res.push({
        fileMD5: attributes['fileMD5'],
        fileName: attributes['fileName'],
        fileSizeBytes: attributes['fileSizeBytes'],
        logicalFileName: attributes['logicalFileName'],
        customFileName: attributes['customFileName'],
        version: attributes['version'],
        name: attributes['name'],
      });
    }
  });
  return res;
});
