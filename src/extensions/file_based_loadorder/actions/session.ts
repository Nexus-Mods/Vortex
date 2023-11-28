import createAction from '../../../actions/safeCreateAction';

// This is a hack to force the load order to update.
//  It's absolutely mandatory to ensure this is
//  dispatched sparingly, as it will cause a full re-rendering
//  of the load order page EACH time.
export const setFBForceUpdate =
  createAction('SET_FB_FORCE_UPDATE', (profileId: string) => ({ profileId })) as any;
