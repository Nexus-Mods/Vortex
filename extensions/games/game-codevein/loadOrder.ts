import { fs, types, util } from 'vortex-api';

import { GAME_ID } from './common';
import { ILoadOrderEntry, IProps, ISerializableData, LoadOrder } from './types';
import { ensureLOFile, genProps, makePrefix } from './util';

export async function serialize(context: types.IExtensionContext,
                                loadOrder: LoadOrder,
                                profileId?: string): Promise<void> {
  const props: IProps = genProps(context);
  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('invalid props'));
  }

  // Make sure the LO file is created and ready to be written to.
  const loFilePath = await ensureLOFile(context, profileId, props);
  const filteredLO = loadOrder.filter(lo => props.mods?.[lo?.modId]?.type !== 'collection');

  // The array at this point is sorted in the order in which we want the game to load the
  //  mods, which means we can just loop through it and use the index to assign the prefix.
  const prefixedLO = filteredLO.map((loEntry: ILoadOrderEntry, idx: number) => {
    const prefix = makePrefix(idx);
    const data: ISerializableData = {
      prefix,
    };
    return { ...loEntry, data };
  });

  // Write the prefixed LO to file.
  await fs.removeAsync(loFilePath).catch({ code: 'ENOENT' }, () => Promise.resolve());
  await fs.writeFileAsync(loFilePath, JSON.stringify(prefixedLO), { encoding: 'utf8' });
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
  const loFilePath = await ensureLOFile(context);
  const fileData = await fs.readFileAsync(loFilePath, { encoding: 'utf8' });
  try {
    const data: ILoadOrderEntry[] = JSON.parse(fileData);

    // User may have disabled/removed a mod - we need to filter out any existing
    //  entries from the data we parsed.
    const filteredData = data.filter(entry => enabledModIds.includes(entry.id));

    // Check if the user added any new mods.
    const diff = enabledModIds.filter(id => (mods[id]?.type !== 'collection')
      && (filteredData.find(loEntry => loEntry.id === id) === undefined));

    // Add any newly added mods to the bottom of the loadOrder.
    diff.forEach(missingEntry => {
      filteredData.push({
        id: missingEntry,
        modId: missingEntry,
        enabled: true,
        name: mods[missingEntry] !== undefined
          ? util.renderModName(mods[missingEntry])
          : missingEntry,
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
