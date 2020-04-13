import createAction from '../../../actions/safeCreateAction';
import { ILoadOrderEntry } from '../types/types';

export const setLoadOrderEntry =
  createAction('SET_LOAD_ORDER_ENTRY',
    (profileId: string, modId: string, loEntry: ILoadOrderEntry) =>
      ({ profileId, modId, loEntry })) as any;
