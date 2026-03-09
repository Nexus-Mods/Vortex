import * as _ from 'lodash';
import { actions, fs, types, util } from 'vortex-api';

import { setPreviousLO } from './actions';
import { GAME_ID, INVALID_LO_MOD_TYPES } from './common';
import { ILoadOrderEntry, IProps, ISerializableData, LoadOrder } from './types';
import { ensureLOFile, genProps, getPrefixOffset, makePrefix } from './util';

function isLODifferent(prev: LoadOrder, current: LoadOrder) {
  const diff = _.difference(prev, current);
  if (diff.length > 0) {
    return true;
  }

  return false;
}

function corruptLODialog(props: IProps, filePath: string, err: Error) {
  return new Promise<ILoadOrderEntry[]>((resolve, reject) => {
    props.api.showDialog('error', 'Corrupt load order file', {
      bbcode: props.api.translate('The load order file is in a corrupt state or missing. '
        + 'You can try to fix it yourself or Vortex can regenerate the file for you, but '
        + 'that may result in loss of data. Will only affect load order items you added manually, if any).'),
    }, [
      { label: 'Cancel', action: () => reject(err) },
      {
        label: 'Regenerate File',
        action: async () => {
          await fs.removeAsync(filePath).catch(err2 => null);
          return resolve([]);
        },
      },
    ]);
  });
}

export async function serialize(context: types.IExtensionContext,
                                loadOrder: LoadOrder,
                                previousLO: LoadOrder,
                                profileId?: string): Promise<void> {
  const props: IProps = genProps(context);
  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('invalid props'));
  }

  // Make sure the LO file is created and ready to be written to.
  const loFilePath = await ensureLOFile(context, profileId, props);
  const filteredLO = loadOrder.filter(lo =>
    !INVALID_LO_MOD_TYPES.includes(props.mods?.[lo?.modId]?.type));

  const offset = getPrefixOffset(context.api);

  // The array at this point is sorted in the order in which we want the game to load the
  //  mods, which means we can just loop through it and use the index to assign the prefix.
  const prefixedLO = filteredLO.map((loEntry: ILoadOrderEntry, idx: number) => {
    const prefix = makePrefix(idx + offset);
    const data: ISerializableData = {
      prefix,
    };
    return { ...loEntry, data };
  });

  const fileData = await fs.readFileAsync(loFilePath, { encoding: 'utf8' })
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve('[]')
      : Promise.reject(err));

  let savedLO: ILoadOrderEntry[] = [];
  try {
    savedLO = JSON.parse(fileData);
  } catch (err) {
    savedLO = await corruptLODialog(props, loFilePath, err);
  }

  const batchedActions = [];
  // if (isLODifferent(savedLO, prefixedLO)) {
  //   batchedActions.push(actions.setLoadOrder(props.profile.id, prefixedLO));
  // }
  batchedActions.push(setPreviousLO(props.profile.id, previousLO));
  util.batchDispatch(context.api.store, batchedActions);

  // Write the prefixed LO to file.
  await fs.removeAsync(loFilePath).catch({ code: 'ENOENT' }, () => Promise.resolve());
  await util.writeFileAtomic(loFilePath, JSON.stringify(prefixedLO));
  return Promise.resolve();
}

export async function deserialize(context: types.IExtensionContext): Promise<LoadOrder> {
  // genProps is a small utility function which returns often re-used objects
  //  such as the current list of installed Mods, Vortex's application state,
  //  the currently active profile, etc.
  const props: IProps = genProps(context);
  if (props?.profile?.gameId !== GAME_ID) {
    // Why are we deserializing when the profile is invalid or belongs to
    //  another game ?
    return [];
  }

  // The deserialization function should be used to filter and insert wanted data into Vortex's
  //  loadOrder application state, once that's done, Vortex will trigger a serialization event
  //  which will ensure that the data is written to the LO file.
  const currentModsState = util.getSafe(props.profile, ['modState'], {});

  // we only want to insert enabled mods.
  const enabledModIds = Object.keys(currentModsState)
    .filter(modId => util.getSafe(currentModsState, [modId, 'enabled'], false));
  const mods: { [modId: string]: types.IMod } = util.getSafe(props.state,
    ['persistent', 'mods', GAME_ID], {});
  let data: ILoadOrderEntry[] = [];
  let loFilePath;
  try {
    try {
      loFilePath = await ensureLOFile(context);
      const fileData = await fs.readFileAsync(loFilePath, { encoding: 'utf8' });
      data = JSON.parse(fileData);
    } catch (err) {
      data = await corruptLODialog(props, loFilePath, err);
    }
    // User may have disabled/removed a mod - we need to filter out any existing
    //  entries from the data we parsed.
    const filteredData = data.filter(entry => enabledModIds.includes(entry.id));
    const offset = getPrefixOffset(context.api);
    // Check if the user added any new mods.
    const diff = enabledModIds.filter(id => (!INVALID_LO_MOD_TYPES.includes(mods[id]?.type))
      && (filteredData.find(loEntry => loEntry.id === id) === undefined));

    // Add any newly added mods to the bottom of the loadOrder.
    diff.forEach((missingEntry, idx) => {
      filteredData.push({
        id: missingEntry,
        modId: missingEntry,
        enabled: true,
        name: mods[missingEntry] !== undefined
          ? util.renderModName(mods[missingEntry])
          : missingEntry,
        data: {
          prefix: makePrefix(idx + filteredData.length + offset),
        },
      });
    });

    // At this point you may have noticed that we're not setting the prefix
    //  for the newly added mod entries - we could certainly do that here,
    //  but that would simply be code duplication as we need to assign prefixes
    //  during serialization anyway (otherwise user drag-drop interactions will
    //  not be saved)
    return filteredData;
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function validate(prev: LoadOrder,
                               current: LoadOrder): Promise<any> {
  // Nothing to validate really - the game does not read our load order file
  //  and we don't want to apply any restrictions either, so we just
  //  return.
  return undefined;
}
