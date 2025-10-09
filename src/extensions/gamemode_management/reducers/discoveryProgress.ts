import { IReducerSpec } from '../../../types/IExtensionContext';
import * as actions from '../actions/discoveryProgress';
import update from 'immutability-helper';

export interface IDiscoveryProgressState {
  isDiscovering: boolean;
  progress: {
    current: number;
    total: number;
    message: string;
    gameId?: string;
  } | null;
}

export const discoveryProgressReducer: IReducerSpec = {
  reducers: {
    [actions.setDiscoveryProgress as any]: (state, payload) => 
      update(state, { 
        progress: { $set: payload },
      }),
    [actions.setDiscoveryRunning as any]: (state, payload) => 
      update(state, { 
        isDiscovering: { $set: payload },
      }),
    [actions.clearDiscoveryProgress as any]: (state, payload) => 
      update(state, { 
        progress: { $set: null },
        isDiscovering: { $set: false },
      }),
  },
  defaults: {
    isDiscovering: false,
    progress: null,
  },
};