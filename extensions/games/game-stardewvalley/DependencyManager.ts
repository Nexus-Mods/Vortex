/* eslint-disable */
import { ISDVModManifest } from './types';
import turbowalk from 'turbowalk';
import { log, types, selectors, util } from 'vortex-api';
import { GAME_ID } from './common';

import { parseManifest } from './util';

import path from 'path';

type ManifestMap = { [modId: string]: ISDVModManifest[] };
export default class DependencyManager {
  private mApi: types.IExtensionApi;
  private mManifests: ManifestMap;
  private mLoading: boolean = false;

  constructor(api: types.IExtensionApi) {
    this.mApi = api;
  }

  public async getManifests(): Promise<ManifestMap> {
    await this.scanManifests();
    return this.mManifests;
  }

  public async refresh(): Promise<void> {
    if (this.mLoading) {
      return;
    }
    this.mLoading = true;
    await this.scanManifests(true);
    this.mLoading = false;
  }

  public async scanManifests(force?: boolean): Promise<void> {
    if (!force && this.mManifests !== undefined) {
      return;
    }
    const state = this.mApi.getState();
    const staging = selectors.installPathForGame(state, GAME_ID);
    const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
    const profile = selectors.profileById(state, profileId);
    const isInstalled = (mod: types.IMod) => mod?.state === 'installed';
    const isActive = (modId: string) => util.getSafe(profile, ['modState', modId, 'enabled'], false);
    const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
    const manifests = await Object.values(mods).reduce(async (accumP, iter) => {
      const accum = await accumP;      
      if (!isInstalled(iter) || !isActive(iter.id)) {
        return Promise.resolve(accum);
      }
      const modPath = path.join(staging, iter.installationPath);
      return turbowalk(modPath, async entries => {
      for (const entry of entries) {
        if (path.basename(entry.filePath) === 'manifest.json') {
          let manifest;
          try {
            manifest = await parseManifest(entry.filePath);
          } catch (err) {
            log('error', 'failed to parse manifest', { error: err.message, manifest: entry.filePath });
            continue;
          }
          const list = accum[iter.id] ?? [];
          list.push(manifest);
          accum[iter.id] = list;
        }
      }
      }, { skipHidden: false, recurse: true, skipInaccessible: true, skipLinks: true})
      .then(() => Promise.resolve(accum))
      .catch(err => {
        if (err['code'] === 'ENOENT') {
          return Promise.resolve([]);
        } else {
          return Promise.reject(err);
        }
      });
    }, {});
    this.mManifests = manifests;
    return Promise.resolve();
  }
}
