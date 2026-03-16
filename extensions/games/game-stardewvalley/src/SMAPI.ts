import type { types } from 'vortex-api';

import { gte } from 'semver';
import { actions, selectors, util } from 'vortex-api';

import { GAME_ID, MOD_TYPE_SMAPI } from './common';
import { SMAPI_MOD_ID, SMAPI_URL } from './constants';
import { selectSdvMods } from './state/selectors';

/**
 * SMAPI integration helpers.
 *
 * Responsibilities:
 * - identify discovered SMAPI tool/mod entries
 * - deploy SMAPI and set it as primary tool when available
 * - download/install/update SMAPI through Nexus APIs
 */

export function findSMAPITool(api: types.IExtensionApi): types.IDiscoveredTool | undefined {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const tool = discovery?.tools?.['smapi'];
  return tool?.path ? tool : undefined;
}

export function getSMAPIMods(api: types.IExtensionApi): types.IMod[] {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = selectors.profileById(state, profileId);
  const isActive = (modId: string) => util.getSafe(profile, ['modState', modId, 'enabled'], false);
  const isSMAPI = (mod: types.IMod) =>
    mod.type === MOD_TYPE_SMAPI && mod.attributes?.modId === SMAPI_MOD_ID;
  const mods: { [modId: string]: types.IMod } = selectSdvMods(state);
  return Object.values(mods).filter((mod: types.IMod) => isSMAPI(mod) && isActive(mod.id));
}

export function findSMAPIMod(api: types.IExtensionApi): types.IMod | undefined {
  const SMAPIMods = getSMAPIMods(api);
  return (SMAPIMods.length === 0)
    ? undefined
    : SMAPIMods.length > 1
      ? SMAPIMods.reduce<types.IMod | undefined>((prev, iter) => {
        if (prev === undefined) {
          return iter;
        }
        return (gte(iter?.attributes?.version ?? '0.0.0', prev?.attributes?.version ?? '0.0.0')) ? iter : prev;
      }, undefined)
      : SMAPIMods[0];
}

export async function deploySMAPI(api: types.IExtensionApi) {
  await util.toPromise(cb => api.events.emit('deploy-mods', cb));
  await util.toPromise(cb => api.events.emit('start-quick-discovery', () => cb(null)));

  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  const tool = discovery?.tools?.['smapi'];
  if (tool && api.store !== undefined) {
    api.store.dispatch(actions.setPrimaryTool(GAME_ID, tool.id));
  }
}

export async function downloadSMAPI(api: types.IExtensionApi, update?: boolean) {
  api.dismissNotification?.('smapi-missing');
  api.sendNotification?.({
    id: 'smapi-installing',
    message: update ? 'Updating SMAPI' : 'Installing SMAPI',
    type: 'activity',
    noDismiss: true,
    allowSuppress: false,
  });

  if (api.ext?.ensureLoggedIn !== undefined) {
    await api.ext.ensureLoggedIn();
  }

  try {
    if (api.ext?.nexusGetModFiles === undefined) {
      throw new util.ProcessCanceled('Nexus API unavailable');
    }
    const modFiles = await api.ext.nexusGetModFiles(GAME_ID, SMAPI_MOD_ID);

    const fileTime = (input: any) => Number.parseInt(input.uploaded_time, 10);

    const file = modFiles
      .filter(file => file.category_id === 1)
      .sort((lhs, rhs) => fileTime(lhs) - fileTime(rhs))[0];

    if (file === undefined) {
      throw new util.ProcessCanceled('No SMAPI main file found');
    }

    const dlInfo = {
      game: GAME_ID,
      name: 'SMAPI',
    };

    const nxmUrl = `nxm://${GAME_ID}/mods/${SMAPI_MOD_ID}/files/${file.file_id}`;
    const dlId = await util.toPromise<string>(cb =>
      api.events.emit('start-download', [nxmUrl], dlInfo, undefined, cb, undefined, { allowInstall: false }));
    const modId = await util.toPromise<string>(cb =>
      api.events.emit('start-install-download', dlId, { allowAutoEnable: false }, cb));
    const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);
    await actions.setModsEnabled(api, profileId, [modId], true, {
      allowAutoDeploy: false,
      installed: true,
    });

    await deploySMAPI(api);
  } catch (err) {
    api.showErrorNotification?.('Failed to download/install SMAPI', err);
    util.opn(SMAPI_URL).catch(() => null);
  } finally {
    api.dismissNotification?.('smapi-installing');
  }
}
