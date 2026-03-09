import { selectors, types, util } from 'vortex-api';

import { GAME_ID, getSuppressModLimitBranch } from './common';
import { ModLimitPatcher } from './modLimitPatch';

const MOD_LIMIT_THRESHOLD = 24;

export async function testModLimitBreach(
    api: types.IExtensionApi,
    limitPatcher: ModLimitPatcher): Promise<types.ITestResult> {
  const t = api.translate;
  const state: types.IState = api.store.getState();
  const isSuppressed = util.getSafe(state, getSuppressModLimitBranch(), false);
  const profile: types.IProfile = selectors.activeProfile(state);
  if (profile?.gameId !== GAME_ID || isSuppressed) {
    return Promise.resolve(undefined);
  }

  const mods: { [modId: string]: types.IMod } = state.persistent.mods[GAME_ID] ?? {};
  const limitPatch = Object.values(mods).find(mod => mod.type === 'w3modlimitpatcher');
  if (limitPatch) {
    // A limit patch already exists.
    return Promise.resolve(undefined);
  }

  const enabled = Object.keys(mods).filter(id =>
    util.getSafe(profile, ['modState', id, 'enabled'], false));

  let res: types.ITestResult;

  if (enabled.length >= MOD_LIMIT_THRESHOLD) {
    res = {
      severity: 'warning',
      description: {
        short: t('Mod Limit Reached'),
      },
      automaticFix: () => (limitPatcher.ensureModLimitPatch() as any),
    };
  }

  return Promise.resolve(res);
}
