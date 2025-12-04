import * as actions from '../actions/installTracking';
import { ICollectionInstallSession, ICollectionInstallState } from '../types';
import { generateCollectionSessionId } from '../util';
import { setSafe, merge } from '../../../util/storeHelper';

// Initial state
const initialState: ICollectionInstallState = {
  activeSession: undefined,
  lastActiveSessionId: undefined,
  sessionHistory: {},
};

export const collectionInstallReducer = {
  reducers: {
    [actions.startInstallSession as any]: (state: ICollectionInstallState, payload: any) => {
      const sessionId = generateCollectionSessionId(payload.collectionId, payload.profileId);
      const mods = payload.mods as { [ruleId: string]: any };
      const downloadedCount = Object.values(mods).filter(mod => ['downloaded', 'downloading', 'installed', 'installing', 'skipped'].includes(mod.status)).length;
      const installedCount = Object.values(mods).filter(mod => mod.status === 'installed').length;
      const session: ICollectionInstallSession = {
        ...payload,
        sessionId,
        downloadedCount,
        installedCount,
        failedCount: 0,
        skippedCount: 0,
      };
      
      return setSafe(state, ['activeSession'], session);
    },

    [actions.updateModStatus as any]: (state: ICollectionInstallState, payload: any) => {
      if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
        return state;
      }

      const modPath = ['activeSession', 'mods', payload.ruleId];
      let newState = setSafe(state, [...modPath, 'status'], payload.status);
      
      // Update session counters
      const mods = newState.activeSession!.mods;
      const downloadedCount = Object.values(mods).filter(mod => ['downloaded', 'downloading', 'installed', 'installing', 'skipped'].includes(mod.status)).length;
      const installedCount = Object.values(mods).filter(mod => mod.status === 'installed').length;
      const failedCount = Object.values(mods).filter(mod => mod.status === 'failed').length;
      const skippedCount = Object.values(mods).filter(mod => mod.status === 'skipped').length;
      
      newState = merge(newState, ['activeSession'], {
        downloadedCount,
        installedCount,
        failedCount,
        skippedCount,
      });
      
      return newState;
    },

    [actions.markModInstalled as any]: (state: ICollectionInstallState, payload: any) => {
      if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
        return state;
      }

      let newState = setSafe(state, ['activeSession', 'mods', payload.ruleId, 'modId'], payload.modId);
      newState = setSafe(newState, ['activeSession', 'mods', payload.ruleId, 'status'], 'installed');
      newState = setSafe(newState, ['activeSession', 'mods', payload.ruleId, 'endTime'], Date.now());

      // Update counters
      const mods = newState.activeSession!.mods;
      const downloadedCount = Object.values(mods).filter(mod => ['downloaded', 'downloading', 'installed', 'installing', 'skipped'].includes(mod.status)).length;
      const installedCount = Object.values(mods).filter(mod => mod.status === 'installed').length;
      newState = setSafe(newState, ['activeSession', 'downloadedCount'], downloadedCount);
      newState = setSafe(newState, ['activeSession', 'installedCount'], installedCount);

      return newState;
    },

    [actions.finishInstallSession as any]: (state: ICollectionInstallState, payload: any) => {
      if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
        return state;
      }
      
      let newState = setSafe(state, ['sessionHistory', payload.sessionId], state.activeSession);
      newState = setSafe(newState, ['lastActiveSessionId'], payload.sessionId);
      newState = setSafe(newState, ['activeSession'], undefined);
      
      return newState;
    },
  },
  
  defaults: initialState,
};