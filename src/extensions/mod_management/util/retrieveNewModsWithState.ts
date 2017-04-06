import { getSafe } from '../../../util/storeHelper';

import { IModProps, IModWithState } from '../types/IModProps';

function retrieveNewModsWithState(
  oldProps: IModProps,
  newProps: IModProps,
  mModsWithState: { [id: string]: IModWithState },
  modAction: string) {
  let newModsWithState = {};
  Object.keys(newProps.mods).forEach((modId: string) => {

    const nexusModId: number = parseInt(getSafe(newProps.mods[modId].attributes,
      ['modId'], undefined), 10);

    let enabledModId = Object.keys(newProps.mods).filter((key) => {
      if (parseInt(getSafe(newProps.mods[key].attributes, ['modId'],
        undefined), 10) === nexusModId && getSafe(newProps.modState, [key, 'enabled'], false)) {
        return key;
      } else {
        return null;
      }
    });

    let modIdList = Object.keys(newModsWithState).filter((key) =>
      parseInt(getSafe(newModsWithState[key].attributes, ['modId'],
        undefined), 10) === nexusModId);

    if (modIdList.length === 0) {
      if ((oldProps.mods[modId] !== newProps.mods[modId])
        || (oldProps.modState[modId] !== newProps.modState[modId])) {
        if (enabledModId.length > 0) {
          modId = enabledModId[0];
        }
        newModsWithState[modId] = Object.assign({}, newProps.mods[modId],
          newProps.modState[modId]);
      } else {
        if (enabledModId.length > 0) {
          newModsWithState[enabledModId[0]] = Object.assign({}, newProps.mods[enabledModId[0]],
            newProps.modState[enabledModId[0]]);
        } else if (modAction === 'removing') {
          if (newProps.mods[modId] !== undefined) {
            newModsWithState[modId] = Object.assign({}, newProps.mods[modId],
              newProps.modState[modId]);
          }
        } else {
          if (mModsWithState[modId] !== undefined) {
            newModsWithState[modId] = Object.assign({}, newProps.mods[modId],
              newProps.modState[modId]);
          }
        }
      }
    }
  });

  return newModsWithState;
}

export default retrieveNewModsWithState;
