/* eslint-disable */
import path from 'path';
import { fs, selectors, types, util } from 'vortex-api';

import { GAME_ID, HALO1_MAPS_RELPATH, HALO_GAMES } from './common';

const MAP_NUMBER_CONSTRAINT = 28;
export async function testCEMP(api: types.IExtensionApi): Promise<types.ITestResult> {
  const state = api.getState();
  const activeGameMode = selectors.activeGameId(state);
  if (activeGameMode !== GAME_ID) {
    return Promise.resolve(undefined);
  }
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (discovery === undefined) {
    return Promise.resolve(undefined);
  }

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const ceMods = Object.keys(mods).filter(modId => mods[modId]?.attributes?.haloGames.includes(HALO_GAMES.halo1.internalId));
  if (ceMods.length === 0) {
    return Promise.resolve(undefined);
  }
  const halo1MapsPath = path.join(discovery.path, HALO1_MAPS_RELPATH);
  try {
    const fileEntries = await fs.readdirAsync(halo1MapsPath);
    if (fileEntries.length < MAP_NUMBER_CONSTRAINT) {
      throw new Error('Not enough maps'); 
    }
    return Promise.resolve(undefined);
  } catch (err) {
    const result: types.ITestResult = {
      description: {
        short: 'Halo: CE Multiplayer maps are missing',
        long: 'Your "{{dirPath}}" folder is either missing/inaccessible, or appears to not contain all the required maps. '
            + 'This is usually an indication that you do not have Halo: CE Multiplayer installed. Some mods may not '
            + 'work properly due to a bug in the game engine. Please ensure you have installed CE MP through your game store.',
        replace: {
          dirPath: halo1MapsPath,
        }
      },
      severity: 'warning',
    }
    return Promise.resolve(result);
  }
}