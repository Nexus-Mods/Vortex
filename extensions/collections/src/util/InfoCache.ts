import {
  updateCollectionInfo,
  updateRevisionInfo,
} from "../actions/persistent";
import { CACHE_EXPIRE_MS, CACHE_LRU_COUNT, MOD_TYPE } from "../constants";
import { ICollectionModRule } from "../types/ICollection";
import { IStateEx } from "../types/IStateEx";
import { readCollection } from "./importCollection";

import { ICollection, IRevision } from "@nexusmods/nexus-api";
import * as path from "path";
import { log, selectors, types, util } from "vortex-api";

/**
 * manages caching of collection and revision info
 * NOTE: this doesn't have any state of its own, the actual cache is stored in application state
 * As such, this doesn't need to be a class, a bunch of functions would have done. If this
 * behavior were to change, the way InfoCache gets used would become invalid!
 */
class InfoCache {
  private mApi: types.IExtensionApi;
  private mCacheRevRequests: { [revId: string]: Promise<IRevision> } = {};
  private mCacheColRequests: { [revId: string]: Promise<ICollection> } = {};
  private mCacheColRules: { [revId: string]: Promise<ICollectionModRule[]> } =
    {};

  constructor(api: types.IExtensionApi) {
    this.mApi = api;
  }

  public async getCollectionModRules(
    revisionId: number,
    collection: types.IMod,
    gameId: string,
  ) {
    const cacheId = revisionId ?? collection.id;
    if (this.mCacheColRules[cacheId] === undefined) {
      this.mCacheColRules[cacheId] = this.cacheCollectionModRules(
        revisionId,
        collection,
        gameId,
      );
    }

    return this.mCacheColRules[cacheId];
  }

  public async getCollectionInfo(
    slug: string,
    forceFetch?: boolean,
  ): Promise<ICollection> {
    const { store } = this.mApi;
    if (slug === undefined) {
      return;
    }
    const collections =
      store.getState().persistent.collections.collections ?? {};
    if (
      forceFetch ||
      collections[slug]?.timestamp === undefined ||
      Date.now() - collections[slug].timestamp > CACHE_EXPIRE_MS
    ) {
      if (this.mCacheColRequests[slug] === undefined) {
        this.mCacheColRequests[slug] = this.cacheCollectionInfo(slug);
      }
      return this.mCacheColRequests[slug];
    }

    return collections[slug].info;
  }

  public async clearCache() {
    const { store } = this.mApi;
    const state = this.mApi.getState<IStateEx>();

    const cutOffTime = Date.now() - CACHE_EXPIRE_MS;

    // remove collection infos
    {
      const { collections } = state.persistent.collections;
      const collectionsToDrop: string[] = Object.keys(collections)
        .sort(
          (lhs, rhs) => collections[rhs].timestamp - collections[lhs].timestamp,
        )
        .reduce((prev, iter, idx) => {
          if (
            idx >= CACHE_LRU_COUNT ||
            collections[iter].timestamp < cutOffTime
          ) {
            prev.push(iter);
          }
          return prev;
        }, []);
      if (collectionsToDrop.length > 0) {
        log("debug", "dropping outdated collections cache", {
          ids: collectionsToDrop,
        });
        util.batchDispatch(
          store,
          collectionsToDrop.map((coll) =>
            updateCollectionInfo(coll, undefined, undefined),
          ),
        );
      }
    }

    // remove revision infos
    {
      const { revisions } = state.persistent.collections;
      const revisionsToDrop: number[] = Object.keys(revisions)
        .sort((lhs, rhs) => revisions[rhs].timestamp - revisions[lhs].timestamp)
        .reduce((prev, iter, idx) => {
          if (
            idx >= CACHE_LRU_COUNT ||
            revisions[iter].timestamp < cutOffTime
          ) {
            prev.push(iter);
          }
          return prev;
        }, []);
      if (revisionsToDrop.length > 0) {
        log("debug", "dropping outdated revision cache", {
          ids: revisionsToDrop,
        });
        util.batchDispatch(
          store,
          revisionsToDrop.map((rev) =>
            updateRevisionInfo(rev, undefined, undefined),
          ),
        );
      }
    }
  }

  /**
   * get meta information about a revision, cached if possible
   * @param revisionId globally unique id of the revision
   * @param collectionSlug id of the collection
   * @param revisionNumber number of the revision within this collection
   * @param fetchBehavior if/how to update the cache:
   *    "avoid" will update only if there is no data at all,
   *    "allow" will also update if the cache is expired,
   *    "force" will always update
   * @returns
   */
  public async getRevisionInfo(
    revisionId: number,
    collectionSlug: string,
    revisionNumber: number,
    fetchBehavior: "allow" | "avoid" | "force" = "allow",
  ): Promise<IRevision> {
    const { store } = this.mApi;
    const revisions: { [id: string]: { info: IRevision; timestamp: number } } =
      store.getState().persistent.collections.revisions ?? {};
    if (
      fetchBehavior === "force" ||
      revisions[revisionId]?.timestamp === undefined ||
      (Date.now() - revisions[revisionId].timestamp > CACHE_EXPIRE_MS &&
        fetchBehavior === "allow")
    ) {
      this.fetchRevisionInfo(
        revisions,
        revisionId,
        collectionSlug,
        revisionNumber,
      );
      return this.mCacheRevRequests[revisionId];
    }

    if (!revisions[revisionId]?.info?.collection) {
      return Promise.resolve(undefined);
    }

    const collectionInfo = await this.getCollectionInfo(
      revisions[revisionId].info.collection.slug,
    );

    return {
      ...revisions[revisionId].info,
      collection: {
        ...collectionInfo,
      },
    };
  }

  private fetchRevisionInfo(
    revisions,
    revisionId: number,
    collectionSlug: string,
    revisionNumber: number,
  ): void {
    log("info", "revision info cache outdated", {
      timestamp: revisions[revisionId]?.timestamp,
      now: Date.now(),
    });

    if (this.mCacheRevRequests[revisionId] === undefined) {
      this.mCacheRevRequests[revisionId] = this.cacheRevisionInfo(
        revisionId,
        collectionSlug,
        revisionNumber,
      );
    }
  }

  private async cacheCollectionModRules(
    revisionId: number,
    collection: types.IMod,
    gameId: string,
  ): Promise<ICollectionModRule[]> {
    const store = this.mApi.store;
    const state = store.getState();

    const mods: { [modId: string]: types.IMod } = util.getSafe(
      state,
      ["persistent", "mods", gameId],
      {},
    );
    const colMod =
      collection ??
      Object.values(mods).find(
        (iter) =>
          iter.type === MOD_TYPE && iter.attributes?.revisionId === revisionId,
      );
    if (colMod?.installationPath === undefined) {
      return [];
    }
    const stagingPath = selectors.installPathForGame(state, gameId);
    try {
      const collectionInfo = await readCollection(
        this.mApi,
        path.join(stagingPath, colMod.installationPath, "collection.json"),
      );
      return collectionInfo.modRules;
    } catch (err) {
      if (err.code !== "ENOENT") {
        this.mApi.showErrorNotification(
          "Failed to cache collection mod rules",
          err,
          {
            allowReport: false,
          },
        );
      }
      return [];
    }
  }

  private async cacheCollectionInfo(
    collectionSlug: string,
  ): Promise<ICollection> {
    const { store } = this.mApi;

    const collectionInfo: ICollection = (
      await this.mApi.emitAndAwait("get-nexus-collection", collectionSlug)
    )[0];
    if (!!collectionInfo?.id) {
      store.dispatch(
        updateCollectionInfo(
          collectionInfo.id.toString(),
          collectionInfo,
          Date.now(),
        ),
      );
      delete this.mCacheColRequests[collectionInfo.id.toString()];
    }
    return collectionInfo;
  }

  private updateRevisionCacheState(
    store: types.ThunkStore<any>,
    revisionId: number,
    revisionInfo: any,
    now: number,
  ): void {
    // we cache revision info and collection info separately to reduce duplication
    // in the application state
    store.dispatch(
      updateCollectionInfo(
        revisionInfo.collection.id.toString(),
        revisionInfo.collection,
        now,
      ),
    );
    store.dispatch(
      updateRevisionInfo(
        revisionId,
        {
          ...revisionInfo,
          collection: {
            id: revisionInfo.collection.id,
            slug: revisionInfo.collection.slug,
          },
        },
        now,
      ),
    );
  }

  private async cacheRevisionInfo(
    revisionId: number,
    collectionSlug: string,
    revisionNumber: number,
  ): Promise<IRevision> {
    const { store } = this.mApi;

    if (collectionSlug === undefined || revisionNumber === undefined) {
      const err = new Error("missing collection/revision id");
      err["allowReport"] = false;
      return Promise.reject(err);
    }

    const revisionInfo = (
      await this.mApi.emitAndAwait(
        "get-nexus-collection-revision",
        collectionSlug,
        revisionNumber,
      )
    )[0];
    const now = Date.now();

    if (!!revisionInfo) {
      this.updateRevisionCacheState(store, revisionId, revisionInfo, now);
    } else {
      store.dispatch(updateRevisionInfo(revisionId, null, now));
    }
    const result: IRevision = await revisionInfo;
    delete this.mCacheRevRequests[revisionId];
    return result ?? null;
  }
}

export default InfoCache;
