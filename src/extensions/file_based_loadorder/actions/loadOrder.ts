import createAction from '../../../actions/safeCreateAction';
import { ILoadOrderEntry, LoadOrder } from '../types/types';

// Change a specific load order entry.
export const setLoadOrderEntry =
  createAction('SET_LOAD_ORDER_ENTRY',
    (profileId: string, loEntry: ILoadOrderEntry) =>
      ({ profileId, loEntry })) as any;

export const setNewLoadOrder =
  createAction('SET_NEW_LOAD_ORDER',
    (profileId: string, loadOrder: LoadOrder) =>
      ({ profileId, loadOrder })) as any;
