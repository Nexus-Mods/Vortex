import createAction from '../../../actions/safeCreateAction';
import { LoadOrder, IValidationResult } from '../types/types';

// This is a hack to force the load order to update.
//  It's absolutely mandatory to ensure this is
//  dispatched sparingly, as it will cause a full re-rendering
//  of the load order page EACH time.
export const setFBForceUpdate =
  createAction('SET_FB_FORCE_UPDATE', (profileId: string) => ({ profileId })) as any;

// Intends to keep track of the load order in-between deployment events.
export const setFBLoadOrderRedundancy =
  createAction('SET_FB_LOAD_ORDER_REDUNDANCY', (profileId: string, loadOrder: LoadOrder) => ({ profileId, loadOrder })) as any;

export const setValidationResult =
  createAction('SET_FB_VALIDATION_RESULT', (profileId: string, result: IValidationResult) => ({ profileId, result })) as any;
