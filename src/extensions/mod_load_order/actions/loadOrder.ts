import createAction from '../../../actions/safeCreateAction';
import { IItemRendererOptions, ILoadOrderEntry } from '../types/types';

// Change a specific load order entry.
export const setLoadOrderEntry =
  createAction('SET_LOAD_ORDER_ENTRY',
    (profileId: string, modId: string, loEntry: ILoadOrderEntry) =>
      ({ profileId, modId, loEntry })) as any;

// Can be used to store game specific load order options
//  for the specified profileId.
export const setGameLoadOrderOptions =
  createAction('SET_GAME_LOAD_ORDER_OPTIONS',
    (gameId: string, profileId: string, itemRendererOptions: IItemRendererOptions) =>
      ({ gameId, profileId, itemRendererOptions })) as any;
