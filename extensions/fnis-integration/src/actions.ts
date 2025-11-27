import { createAction } from 'redux-act';

export const setAutoRun = createAction('SET_AUTO_FNIS', enabled => enabled);
export const setPatches = createAction('SET_FNIS_PATCHES',
  (profileId: string, patches: string[]) => ({ profileId, patches }));
export const setNeedToRun = createAction('SET_FNIS_FORCE_RUN',
  (profileId: string, force: boolean) => ({ profileId, force }));
