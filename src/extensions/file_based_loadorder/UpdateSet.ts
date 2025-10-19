/* eslint-disable */
import { IExtensionApi, IMod } from '../../types/api';
import { getSafe } from '../../util/storeHelper';

import * as _ from 'lodash';
import { ILoadOrderEntry, ILoadOrderEntryExt } from './types/types';
import { log } from '../../util/log';
import { activeGameId } from '../profile_management/activeGameId';
import { lastActiveProfileForGame } from '../profile_management/activeGameId';
import { toExtendedLoadOrderEntry } from './util';
import { util } from 'vortex-api';
import { currentLoadOrderForProfile } from './selectors';

export default class UpdateSet {
  private mApi: IExtensionApi;
  private mModEntries: { [modId: number]: ILoadOrderEntryExt[] } = {};
  private mExternalEntries: { [modId: string]: ILoadOrderEntryExt[] } = {};
  private mInitialized = false;
  private mShouldRestore = false;
  private mIsFBLO: (gameId: string) => boolean;
  constructor(api: IExtensionApi, isFBLO: (gameId: string) => boolean) {
    this.mApi = api;
    this.mIsFBLO = isFBLO;
  }

  public get shouldRestore(): boolean {
    return this.mInitialized && this.mShouldRestore;
  }

  public set shouldRestore(value: boolean) {
    this.mShouldRestore = value;
  }

  public get shouldReset(): boolean {
    return this.mInitialized && !this.mShouldRestore;
  }

  public forceReset = () => {
    this.reset();
  }

  public addEntry = (lo: ILoadOrderEntryExt) => {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const modId = lo.modId ?? lo.id;
    const mod = util.getSafe(state, ['persistent', 'mods', gameMode, modId], undefined);
    if (modId === undefined) return;

    let key;
    const numericId = getSafe(mod, ['attributes', 'modId'], -1);
    key = (numericId !== -1) ? numericId : lo.id;
    const target = lo.modId ? this.mModEntries : this.mExternalEntries;
    if (!target[key]) {
      target[key] = [lo];
    } else if (!target[key].some(entry => entry.id === lo.id)) {
      target[key].push(lo);
    }
  };

  public init = (gameId: string, modEntries?: ILoadOrderEntryExt[]) => {
    if (!this.mIsFBLO(gameId) || this.mShouldRestore) {
      return;
    }
    if (this.shouldReset) {
      this.reset();
    }
    this.mInitialized = true;
    modEntries = (!!modEntries && Array.isArray(modEntries))
      ? modEntries
      : this.genExtendedItemsFromState();

    modEntries.forEach((iter: ILoadOrderEntryExt) => this.addEntry(iter));
  }

  private genExtendedItemsFromState = () => {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    if (!gameMode) {
      return [];
    }
    const profileId = lastActiveProfileForGame(state, gameMode);
    if (!profileId) {
      return [];
    }
    const loadOrder: ILoadOrderEntry[] = currentLoadOrderForProfile(state, profileId);
    if (!loadOrder || !Array.isArray(loadOrder)) {
      return [];
    }

    const extended = loadOrder.map(toExtendedLoadOrderEntry(this.mApi))
    return extended;
  };

  private reset = () => {
    this.mModEntries = {};
    this.mExternalEntries = {};
    this.mInitialized = false;
    this.mShouldRestore = false;
  }

  public has = (value: number | string): boolean => {
    return (typeof value === 'string')
      ? this.mExternalEntries[value] !== undefined
      : this.mModEntries[value] !== undefined;
  }

  public hasEntry = (entry: ILoadOrderEntry): boolean => {
    return !!entry.modId
      ? Object.values(this.mModEntries).some(l => l.some(m => m.modId === entry.modId || m.id === entry.id))
      : Object.values(this.mExternalEntries).some(l => l.some(m => m.id === entry.id));
  }

  public restore = (loadOrder: ILoadOrderEntry[]): ILoadOrderEntry[] => {
    if (Object.keys(this.mModEntries).length === 0 && Object.keys(this.mExternalEntries).length === 0) {
      // Nothing to restore
      return loadOrder;
    }
    const restoredLO: ILoadOrderEntry[] = [...loadOrder];
    const getEntryExt = (entry: ILoadOrderEntry): ILoadOrderEntryExt | null => {
      const stored = this.findEntry(entry);
      if (!stored) {
        // This is probably an entry for a manually added mod/native game entry
        //  use the existing index.
        return { ...entry, index: loadOrder.findIndex(l => l.name === entry.name) };
      }
      return stored.entries.find(l => l.name === entry.name) || null;
    }
    restoredLO.sort((lhs, rhs) => {
      const lhsEntry = getEntryExt(lhs);
      const rhsEntry = getEntryExt(rhs);
      if (!lhsEntry || !rhsEntry) {
        return 0;
      }
      return lhsEntry.index - rhsEntry.index;
    });
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const remapped = restoredLO.map(toExtendedLoadOrderEntry(this.mApi));
    this.init(gameMode, remapped);
    this.mShouldRestore = false;
    return remapped;
  }

  // The modId of the mod we are looking for as stored in Vortex's state.
  public findEntry = (lookUpEntry: ILoadOrderEntry): { entries: ILoadOrderEntryExt[] } | null => {
    if (!this.hasEntry(lookUpEntry)) {
      return null;
    }

    if (lookUpEntry.modId === undefined) {
      // This is an external entry, we need to find it in the external entries.
      const extEntry = Object.entries(this.mExternalEntries).find(entry => {
        const [eId, loEntries] = entry;
        return loEntries.some(l => l.id === lookUpEntry.id);
      });
      if (extEntry !== undefined) {
        return { entries: this.mExternalEntries[extEntry[0]] };
      }
    } else {
      const numericId = Object.entries(this.mModEntries).find(entry => {
        const [nId, loEntries] = entry;
        return loEntries.some(l => l.modId === lookUpEntry.modId || l.id === lookUpEntry.id);
      })?.[0];
      if (numericId === undefined) {
        return null;
      }
      return { entries: this.mModEntries[numericId] };
    }
  }

  public get = (modId: number | string): ILoadOrderEntryExt[] => {
    if (typeof modId === 'string') {
      return this.mExternalEntries[modId] || [];
    } else {
      return this.mModEntries[modId] || [];
    }
  }

  public add = (x: number): this => {
    log('warn', 'Use addEntry', x);
    return;
  }

  public isInitialized = (): boolean => {
    return this.mInitialized;
  }
}
