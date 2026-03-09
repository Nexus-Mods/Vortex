/* eslint-disable */
import * as path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api';

import { GAME_ID } from './common';
import { listPackage } from './divineWrapper';
import { IPakInfo } from './types';
import { extractPakInfoImpl, logDebug } from './util';

import { LRUCache } from 'lru-cache';

export interface ICacheEntry {
  lastModified: number;
  info: IPakInfo;
  fileName: string;
  packageList: string[];
  isListed: boolean;
  mod?: types.IMod;
}

type IPakMap = LRUCache<string, ICacheEntry>;
export default class PakInfoCache {
  private static instance: PakInfoCache = null;
  public static getInstance(api: types.IExtensionApi): PakInfoCache {
    if (!PakInfoCache.instance) {
      PakInfoCache.instance = new PakInfoCache(api);
    }

    return PakInfoCache.instance;
  }

  private mCache: IPakMap;
  private mApi: types.IExtensionApi;

  constructor(api: types.IExtensionApi) {
    // 700 should be enough for everyone I hope.
    this.mApi = api;
    this.mCache = new LRUCache<string, ICacheEntry>({ max: 700 });
    this.load(api);
  }

  public async getCacheEntry(api: types.IExtensionApi,
                             filePath: string,
                             mod?: types.IMod): Promise<ICacheEntry> {
    const id = this.fileId(filePath);
    const stat = await fs.statAsync(filePath);
    const ctime = stat.ctimeMs;
    const hasChanged = (entry: ICacheEntry) => {
      return (!!mod && !!entry.mod)
        ? mod.attributes?.fileId !== entry.mod.attributes?.fileId
        : ctime !== entry?.lastModified;
    };

    const cacheEntry = await this.mCache.get(id);
    const packageNotListed = (cacheEntry?.packageList || []).length === 0;
    if (!cacheEntry || hasChanged(cacheEntry) || packageNotListed) {
      const packageList = await listPackage(api, filePath);
      const isListed = this.isLOListed(api, filePath, packageList);
      const info = await extractPakInfoImpl(api, filePath, mod, isListed);
      this.mCache.set(id, {
        fileName: path.basename(filePath),
        lastModified: ctime,
        info,
        packageList,
        mod,
        isListed,
      });
    }
    return this.mCache.get(id);
  }

  public reset() {
    this.mCache = new LRUCache<string, ICacheEntry>({ max: 700 });
    this.save();
  }

  public async save() {
    if (!this.mCache) {
      // Nothing to save.
      return;
    }
    const state = this.mApi.getState();
    const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
    const staging = selectors.installPathForGame(state, GAME_ID);
    const cachePath = path.join(path.dirname(staging), 'cache', profileId + '.json');
    try {
      await fs.ensureDirWritableAsync(path.dirname(cachePath));
      // Convert cache entries to array for serialization
      const cacheData = Array.from(this.mCache.entries());
      await util.writeFileAtomic(cachePath, JSON.stringify(cacheData));
    } catch (err) {
      log('error', 'failed to save cache', err);
      return;
    }
  }

  private async load(api: types.IExtensionApi): Promise<void> {
    const state = api.getState();
    const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
    const staging = selectors.installPathForGame(state, GAME_ID);
    const cachePath = path.join(path.dirname(staging), 'cache', profileId + '.json');
    try {
      await fs.ensureDirWritableAsync(path.dirname(cachePath));
      const data = await fs.readFileAsync(cachePath, { encoding: 'utf8' });
      const cacheData = JSON.parse(data);
      // Restore cache entries from array
      if (Array.isArray(cacheData)) {
        for (const [key, value] of cacheData) {
          this.mCache.set(key, value);
        }
      }
    } catch (err) {
      if (!['ENOENT'].includes(err.code)) {
        log('error', 'failed to load cache', err);
      }
    }
  }

  private isLOListed(api: types.IExtensionApi, pakPath: string, packageList: string[]): boolean {
    try {
      // look at the end of the first bit of data to see if it has a meta.lsx file
      // example 'Mods/Safe Edition/meta.lsx\t1759\t0'
      const containsMetaFile = packageList.find(line => path.basename(line.split('\t')[0]).toLowerCase() === 'meta.lsx') !== undefined ? true : false;

      // invert result as 'listed' means it doesn't contain a meta file.
      return !containsMetaFile;
    } catch (err) {
      api.sendNotification({
        type: 'error',
        message: `${path.basename(pakPath)} couldn't be read correctly. This mod be incorrectly locked/unlocked but will default to unlocked.`,
      });
      return false;    
    }
  }

  private fileId(filePath: string): string {
    return path.basename(filePath).toUpperCase();
  }
}
