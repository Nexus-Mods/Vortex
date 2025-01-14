import * as deprecated from '../mod_load_order/types/types';
import { ILoadOrderEntry, ILoadOrderGameInfo, LoadOrder } from './types/types';
import { IExtensionApi, IMod, IProfile, IState } from '../../types/api';
import { activeProfile, lastActiveProfileForGame, profileById } from '../profile_management/selectors';
import { getSafe } from '../../util/api';
import { installPathForGame } from '../mod_management/selectors';
import path from 'path';
import * as fs from '../../util/fs';

interface IProps {
  refresh: () => void
}

export function migrateToFBLO(api: IExtensionApi, props: IProps, entry: deprecated.IGameLoadOrderEntry) {
  if (!entry?.gameId) {
    return ;
  }

  const profile = lastActiveProfileForGame(api.getState(), entry.gameId);
  if (!profile) {
    return;
  }

  const fbloEntry: ILoadOrderGameInfo = {
    gameId: entry.gameId,
    noCollectionGeneration: entry?.noCollectionGeneration,
    usageInstructions: entry?.createInfoPanel({ refresh: () => props.refresh }),
    deserializeLoadOrder: deserializeLoadOrder.bind(null, api, entry),
    serializeLoadOrder: ((current, previous) =>
      serializeLoadOrder.bind(api, entry, current, previous)),
    validate: validate.bind(null, entry),
    toggleableEntries: entry?.displayCheckboxes ?? false,
    clearStateOnPurge: true,
  };

  return fbloEntry;

}

export async function deserializeLoadOrder(api: IExtensionApi, entry: deprecated.IGameLoadOrderEntry) {
  const loadOrderPath = await ensureLoadOrderPath(api, entry);
  if (loadOrderPath === undefined) {
    return Promise.resolve([]);
  } else {
    return JSON.parse(await fs.readFileAsync(loadOrderPath, { encoding: 'utf8' }));
  }
}

async function serializeLoadOrder(api: IExtensionApi, entry: deprecated.IGameLoadOrderEntry, current: LoadOrder, prev: LoadOrder): Promise<void> {
  const loadOrderPath = await ensureLoadOrderPath(api, entry);
  if (loadOrderPath === undefined) {
    return Promise.resolve();
  } else {
    const deprecatedEntries = toDeprecatedDisplayItems(current) ?? [];
    const preSorted = await entry.preSort(deprecatedEntries as any, 'ascending', 'drag-n-drop');
    return fs.writeFileAsync(loadOrderPath, JSON.stringify(preSorted, undefined, 2), { encoding: 'utf8' });
  }
}

export async function ensureLoadOrderPath(api: IExtensionApi, entry: deprecated.IGameLoadOrderEntry): Promise<string | undefined> {
  const state = api.getState();
  const profileId = lastActiveProfileForGame(state, entry.gameId);
  const loFileName = `${profileId}_loadOrder.json`;
  const installationPath = installPathForGame(state, entry.gameId);
  if (installationPath === undefined) {
    return Promise.resolve(undefined);
  }
  const loadOrderPath = path.join(installationPath, loFileName);
  const currentLO = await getPersistentLoadOrder(api);
  try {
    await fs.ensureDirWritableAsync(path.dirname(loadOrderPath));
    await fs.writeFileAsync(loadOrderPath, JSON.stringify(currentLO, undefined, 2), { encoding: 'utf8' });
    return Promise.resolve(loadOrderPath);
  } catch (err) {
    return Promise.reject(err);
  }
}

export function getPersistentLoadOrder(api: IExtensionApi, loadOrder?: deprecated.ILoadOrder): LoadOrder {
  const state = api.getState();
  const profile: IProfile = activeProfile(state);
  if (!profile?.gameId) {
    return [];
  }
  loadOrder = loadOrder ?? getSafe(state, ['persistent', 'loadOrder', profile.id], undefined);
  if (loadOrder === undefined) {
    return [];
  }
  if (Array.isArray(loadOrder)) {
    return loadOrder;
  }
  if (typeof loadOrder === 'object') {
    return Object.entries(loadOrder).map(([key, item]) => convertDisplayItem(key, item));
  }
  return [];
}

function toDeprecatedDisplayItems(items: ILoadOrderEntry[]): deprecated.ILoadOrderEntry[] {
  return items.map((item, idx) => ({
    id: item.id,
    name: item.name,
    enabled: item.enabled,
    locked: item.locked,
    prefix: item.data?.prefix,
    pos: idx,
    imgUrl: null,
    external: !item.modId,
    data: {
      prefix: item.data?.prefix,
    }
  } as deprecated.ILoadOrderEntry));
}

function convertDisplayItem(key: string, item: deprecated.ILoadOrderEntry): ILoadOrderEntry {
  return {
    id: key,
    modId: key,
    name: key,
    locked: item.locked,
    enabled: true,
    data: {
      prefix: item.prefix,
    }
  }
}

function validate() {
  return Promise.resolve(undefined);
}