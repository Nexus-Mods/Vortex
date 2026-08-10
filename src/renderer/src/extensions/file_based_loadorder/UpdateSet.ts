import type { IExtensionApi } from "../../types/api";
import { getSafe } from "../../util/storeHelper";
import { activeGameId, lastActiveProfileForGame } from "../profile_management/selectors";
import { currentLoadOrderForProfile } from "./selectors";
import type { ILoadOrderEntry, ILoadOrderEntryExt } from "./types/types";
import { toExtendedLoadOrderEntry } from "./util";

export default class UpdateSet {
  private mApi: IExtensionApi;
  private mModEntries: { [modId: number]: ILoadOrderEntryExt[] } = {};
  private mExternalEntries: { [modId: string]: ILoadOrderEntryExt[] } = {};
  // O(1) lookup indexes into the buckets above; findEntry runs once per load
  //  order entry on every change.
  // Map of mod id to its mModEntries bucket
  private mModsByModId = new Map<string, ILoadOrderEntryExt[]>();
  // Map of entry id to its mModEntries bucket
  private mModsByEntryId = new Map<string, ILoadOrderEntryExt[]>();
  // Map of entry id to its mExternalEntries bucket
  private mExternalByEntryId = new Map<string, ILoadOrderEntryExt[]>();
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
  };

  public addEntry = (lo: ILoadOrderEntryExt) => {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const modId = lo.modId ?? lo.id;
    const mod = getSafe(state, ["persistent", "mods", gameMode, modId], undefined);
    if (modId === undefined) return;

    let key;
    const numericId = getSafe(mod, ["attributes", "modId"], -1);
    key = numericId !== -1 ? numericId : lo.id;
    const target = lo.modId ? this.mModEntries : this.mExternalEntries;
    if (!target[key]) {
      target[key] = [lo];
    } else if (!target[key].some((entry) => entry.id === lo.id)) {
      target[key].push(lo);
    }
    if (lo.modId) {
      this.mModsByModId.set(lo.modId, target[key]);
      this.mModsByEntryId.set(lo.id, target[key]);
    } else {
      this.mExternalByEntryId.set(lo.id, target[key]);
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
    modEntries =
      !!modEntries && Array.isArray(modEntries) ? modEntries : this.genExtendedItemsFromState();

    modEntries.forEach((iter: ILoadOrderEntryExt) => this.addEntry(iter));
  };

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

    const extended = loadOrder.map(toExtendedLoadOrderEntry(this.mApi));
    return extended;
  };

  private reset = () => {
    this.mModEntries = {};
    this.mExternalEntries = {};
    this.mModsByModId.clear();
    this.mModsByEntryId.clear();
    this.mExternalByEntryId.clear();
    this.mInitialized = false;
    this.mShouldRestore = false;
  };

  public restore = (loadOrder: ILoadOrderEntry[]): ILoadOrderEntry[] => {
    if (
      Object.keys(this.mModEntries).length === 0 &&
      Object.keys(this.mExternalEntries).length === 0
    ) {
      // Nothing to restore
      return loadOrder;
    }
    const restoredLO: ILoadOrderEntry[] = [...loadOrder];
    const getEntryExt = (entry: ILoadOrderEntry): ILoadOrderEntryExt | null => {
      const stored = this.findEntry(entry);
      if (!stored) {
        // This is probably an entry for a manually added mod/native game entry
        //  use the existing index.
        return {
          ...entry,
          index: loadOrder.findIndex((l) => l.name === entry.name),
        };
      }
      return stored.entries.find((l) => l.name === entry.name) || null;
    };
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
  };

  // The modId of the mod we are looking for as stored in Vortex's state.
  public findEntry = (lookUpEntry: ILoadOrderEntry): { entries: ILoadOrderEntryExt[] } | null => {
    if (lookUpEntry.modId === undefined) {
      // This is an external entry, we need to find it in the external entries.
      const entries = this.mExternalByEntryId.get(lookUpEntry.id);
      return entries !== undefined ? { entries } : null;
    }
    // Prefer the entry-id index: that bucket is guaranteed to contain this
    //  exact entry. The modId index is the fallback for when the entry's id
    //  changed (mod reinstalled under a new Vortex id).
    const entries =
      this.mModsByEntryId.get(lookUpEntry.id) ?? this.mModsByModId.get(lookUpEntry.modId);
    return entries !== undefined ? { entries } : null;
  };

  public isInitialized = (): boolean => {
    return this.mInitialized;
  };
}
