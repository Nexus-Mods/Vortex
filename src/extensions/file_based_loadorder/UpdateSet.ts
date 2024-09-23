/* eslint-disable */
import {
  IExtensionApi,
} from '../../types/IExtensionContext';
import {getSafe} from '../../util/storeHelper';

import * as _ from 'lodash';
import { ILoadOrderEntry } from './types/types';
import { log } from '../../util/log';
import { activeGameId, lastActiveProfileForGame } from '../profile_management/selectors';

export interface ILoadOrderEntryExt extends ILoadOrderEntry {
  index: number;
}

export default class UpdateSet extends Set<number> {
  private mApi: IExtensionApi;
  private mModEntries: { [modId: number]: ILoadOrderEntryExt[] } = {};
  private mInitialized = false;
  constructor(api: IExtensionApi) {
    super([]);
    this.mApi = api;
    this.init();
  }

  public addNumericModId = (lo: ILoadOrderEntryExt) => {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const mods = getSafe(state, ['persistent', 'mods', gameMode], {});
    if (lo.modId === undefined) {
      // No modId, no restoration
      return;
    }

    if (mods[lo.modId]?.attributes?.modId === undefined) {
      // The numeric id of the mod is the only unique item we can
      //  use to ascertain if we can recover this entry's index.
      return;
    }

    const numericId: number = getSafe(mods[lo.modId], ['attributes', 'modId'], -1);
    if (numericId !== -1 && (this.mModEntries[numericId] === undefined) || (!this.mModEntries[numericId].some(m => m.name === lo.name))) {
      this.mModEntries[numericId] = [].concat(this.mModEntries[numericId] || [], lo);
      super.add(numericId);
    }
    return;
  }

  public init = (modEntries?: ILoadOrderEntryExt[]) => {
    this.reset();
    this.registerListeners();
    this.mInitialized = true;
    modEntries = modEntries !== undefined ? modEntries : this.genExtendedItemsFromState();
    modEntries.forEach((iter: ILoadOrderEntryExt) => this.addNumericModId(iter));
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
    const loadOrder = getSafe(state, ['persistent', 'loadOrder', profileId], []);
    const filtered = loadOrder.reduce((acc, lo, idx) => {
      if (!filtered.includes(lo.modId)) {
        return acc;
      }
      acc.push({ ...lo, index: idx });
      return acc;
    }, []);
    return filtered;
  };

  private registerListeners = () => {
    this.mApi.events.on('gamemode-activated', this.reset);
  }

  private removeListeners = () => {
    this.mApi.events.removeListener('gamemode-activated', this.reset);
  }

  public destroy = () => {
    this.reset();
  }

  private reset = () => {
    this.removeListeners();
    super.clear();
    this.mModEntries = [];
    this.mInitialized = false;
  }

  public has = (value: number): boolean => {
    return super.has(value)
      || (this.mModEntries[value] !== undefined);
  }

  public hasEntry = (entry: ILoadOrderEntry): boolean => {
    return Object.values(this.mModEntries).some(l => l.some(m => m.modId === entry.modId || m.id === entry.id));
  }

  private tryRemoveNumId = (numId: number, entries: ILoadOrderEntryExt[], nameLookup: string) => {
    if (entries.length === 1) {
      // If this is the only entry in the array, we remove all traces
      //  of this specific numeric mod id, both from the numeric set
      //  and the mod entries object.
      super.delete(numId);
      delete this.mModEntries[numId]; 
    } else {
      // Take out the entry from the mod entries object. This will ensure we don't
      //  attempt to re-arrange it again.
      this.mModEntries[numId] = entries.filter(l => l.name !== nameLookup);
    }

    if (super.size === 0) {
      this.reset();
    }
  }

  public restore = (loadOrder: ILoadOrderEntry[]): ILoadOrderEntry[] => {
    if (Object.keys(this.mModEntries).length === 0) {
      // Nothing to restore
      return loadOrder;
    }
    const restoredLO: ILoadOrderEntry[] = [...loadOrder];
    loadOrder.forEach((iter, idx) => {
      // Check if the updateSet has this modId.
      const stored: { numId: number, entries: ILoadOrderEntryExt[] } = this.findEntry(iter);
      if (stored) {
        // We're only interested in 1 specific entry, keep in mind that there might be multiple lo entries
        //  that are associated with the same numeric mod id.
        const entryExt: ILoadOrderEntryExt = stored.entries.find(l => l.name === iter.name);
        if (entryExt && entryExt.index !== idx) {
          // The entry is in the wrong position - re-arrange the array.
          restoredLO.splice(idx, 1);
          restoredLO.splice(entryExt.index, 0, iter);

          // We only remove the numeric mod id if we confirm that we modified the
          //  list, otherwise we keep it around as the restoration functionality
          //  can be called multiple times without modification.
          this.tryRemoveNumId(stored.numId, stored.entries, iter.name);
        }
      }
    });
    return restoredLO;
  }

  public get = (value: number): ILoadOrderEntryExt[] | null => {
    if (super.has(value) && this.mModEntries[value] !== undefined) {
      return this.mModEntries[value];
    }
    return null;
  }

  // The modId of the mod we are looking for as stored in Vortex's state.
  public findEntry = (lookUpEntry: ILoadOrderEntry): { numId: number, entries: ILoadOrderEntryExt[] } | null => {
    if (!this.hasEntry(lookUpEntry)) {
      return null;
    }

    const numericId = Object.entries(this.mModEntries).find(entry => {
      const [nId, loEntries] = entry;
      return loEntries.some(l => l.modId === lookUpEntry.modId || l.id === lookUpEntry.id);
    })?.[0];
    if (numericId === undefined) {
      return null;
    }
    return { numId: +numericId, entries: this.mModEntries[numericId] };
  }

  public add = (x: number): this => {
    log('warn', 'Use addNumericModId', x);    
    return;
  }

  public isInitialized = (): boolean => {
    return this.mInitialized;
  }
}
