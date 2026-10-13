import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { useMainContext } from "@/contexts";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { activeGameId } from "@/util/selectors";

import type { IMod } from "../../types/IMod";
import { collectionRevisions } from "../../util/mod_has_update/modHasUpdate";

/** A revision's changelog, by collection slug and revision; "" for one that has none. */
const changelogs = new Map<string, Promise<string>>();

/** Collections updating, by id: shared, so a collection's two rows can't each start one. */
const updating = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const setUpdating = (id: string, value: boolean) => {
  if (value) {
    updating.add(id);
  } else {
    updating.delete(id);
  }
  listeners.forEach((listener) => listener());
};

/**
 * An installed collection's revision, whether a newer one is out, and a way to update to it.
 * Its rows share whether it's updating, so its group's and its own can't both start one.
 */
export const useCollectionRevision = (collection: IMod) => {
  const { api } = useMainContext();
  const { attributes } = collection;
  const isUpdating = useSyncExternalStore(subscribe, () => updating.has(collection.id));

  // As the collection's own Update does: the update shows the changelog, then installs.
  const update = useCallback(async () => {
    if (updating.has(collection.id)) {
      return;
    }
    setUpdating(collection.id, true);

    try {
      await new Promise<void>((resolve, reject) =>
        api.events.emit(
          "collection-update",
          attributes?.downloadGame ?? activeGameId(api.getState()),
          attributes?.collectionSlug,
          attributes?.newestVersion,
          attributes?.source,
          collection.id,
          (err: Error | null) => (err ? reject(err) : resolve()),
        ),
      );
    } catch {
      // The update reports its own failure, or the user cancelled it.
    } finally {
      setUpdating(collection.id, false);
    }
  }, [api, attributes, collection.id]);

  return { ...collectionRevisions(collection), update, updating: isUpdating };
};

/** Fetches a revision's changelog, forgetting it if that fails so the next ask tries again. */
const requestChangelog = async (
  api: IExtensionApi,
  key: string,
  slug: string,
  revision: number,
): Promise<string> => {
  try {
    const [result] = await api.emitAndAwait("get-nexus-collection-revision", slug, revision);
    // The handler reports its own failures and resolves with nothing: not an empty changelog.
    if (result === undefined) {
      throw new Error(`Couldn't fetch revision ${revision} of ${slug}`);
    }

    return result.collectionChangelog?.description ?? "";
  } catch (err) {
    changelogs.delete(key);
    throw err;
  }
};

/** A revision's changelog as it's fetched: coming, in ("" for a revision without one), or failed. */
export type ChangelogFetch =
  | { status: "loading" }
  | { status: "loaded"; changelog: string }
  | { status: "failed" };

/**
 * A collection revision's changelog. It isn't stored, so it's fetched, once per revision for
 * the whole session; one that fails, offline or refused, is fetched again next time.
 */
export const useCollectionChangelog = (slug: string, revision: number): ChangelogFetch => {
  const { api } = useMainContext();
  const key = `${slug}:${revision}`;

  // Kept with the revision it's for, so another's never shows while this one's coming.
  const [fetched, setFetched] = useState<{ key: string; result: ChangelogFetch }>();

  useEffect(() => {
    let current = true;

    const load = async () => {
      // One fetch per revision, however many popovers ask for it.
      let changelog = changelogs.get(key);
      if (changelog === undefined) {
        changelog = requestChangelog(api, key, slug, revision);
        changelogs.set(key, changelog);
      }

      let result: ChangelogFetch;
      try {
        result = { status: "loaded", changelog: await changelog };
      } catch {
        result = { status: "failed" };
      }

      if (current) {
        setFetched({ key, result });
      }
    };

    void load();

    return () => {
      current = false;
    };
  }, [api, key, revision, slug]);

  return fetched?.key === key ? fetched.result : { status: "loading" };
};
