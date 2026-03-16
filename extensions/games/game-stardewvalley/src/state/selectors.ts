/* eslint-disable */
import type { types } from 'vortex-api';

import { util } from 'vortex-api';

import { GAME_ID } from '../common';

export function selectSdvDiscoveryPath(state: types.IState): string | undefined {
  return util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
}

export function selectDiscoveredToolPath(state: types.IState, gameId: string): string {
  return util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'path'], '');
}

export function selectSdvMods(state: types.IState): { [modId: string]: types.IMod } {
  return util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
}

export function selectMergeConfigsEnabled(state: types.IState, profileId: string): boolean {
  return util.getSafe(state, ['settings', 'SDV', 'mergeConfigs', profileId], false);
}

export function selectConfigModAttributes(state: types.IState, configModId: string): string[] {
  return util.getSafe(state, ['persistent', 'mods', GAME_ID, configModId, 'attributes', 'configMod'], []);
}
