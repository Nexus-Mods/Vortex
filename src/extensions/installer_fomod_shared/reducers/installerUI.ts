import update from 'immutability-helper';

import * as actions from '../actions/installerUI';
import { IFOMODStateDialog } from '../types/interface';

import { IReducerSpec } from '../../../types/IExtensionContext';
import { createReducer } from '../../../util/reducers';

type ActionType<P> = (state: IFOMODStateDialog, payload: P) => IFOMODStateDialog;

const startDialog: ActionType<actions.StartDialogPayload> = (state, payload) => {
  const { instanceId, info } = payload;
  const existingInstance = state.instances?.[instanceId];

  return update(state, {
    activeInstanceId: { $set: instanceId },
    instances: {
      [instanceId]: existingInstance
        ? { $merge: { info } }
        : { $set: { info, state: undefined } }
    }
  });
};

const endDialog: ActionType<actions.EndDialogPayload> = (state, payload) => {
  const { instanceId } = payload;
  return update(state, {
    activeInstanceId: { $set: null },
    instances: {
      [instanceId]: {
        info: { $set: null }
      }
    }
  });
};

const clearDialog: ActionType<actions.ClearDialogPayload> = (state, payload) => {
  const { instanceId } = payload;
  return update(state, {
    instances: { $unset: [instanceId] }
  });
};

const setDialogState: ActionType<actions.SetDialogStatePayload> = (state, payload) => {
  const { instanceId, dialogState } = payload;
  const existingInstance = state.instances?.[instanceId];

  return update(state, {
    instances: {
      [instanceId]: existingInstance
        ? { $merge: { state: dialogState } }
        : { $set: { info: undefined, state: dialogState } }
    }
  });
};

const getReducers = () => {
  const reducers: { [key: string]: ActionType<any> } = {};
  createReducer(actions.startDialog, startDialog, reducers);
  createReducer(actions.endDialog, endDialog, reducers);
  createReducer(actions.clearDialog, clearDialog, reducers);
  createReducer(actions.setDialogState, setDialogState, reducers);
  return reducers;
};

const getDefaults = (): IFOMODStateDialog => ({
  activeInstanceId: null,
  instances: {},
});

export const installerUIReducer: IReducerSpec<IFOMODStateDialog>  = {
  reducers: getReducers(),
  defaults: getDefaults(),
};
