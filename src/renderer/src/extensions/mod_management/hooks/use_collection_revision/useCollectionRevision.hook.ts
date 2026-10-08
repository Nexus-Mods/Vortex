import { useCallback, useEffect, useState } from "react";

import { useMainContext } from "@/contexts";
import { UserCanceled } from "@/util/CustomErrors";
import { activeGameId } from "@/util/selectors";
import { toPromise } from "@/util/util";

import type { IMod } from "../../types/IMod";

/** A revision's changelog, by collection slug and revision; "" for one that has none. */
const changelogs = new Map<string, Promise<string>>();

const revisionNumber = (value: string | undefined) => parseInt(value ?? "0", 10) || 0;

/**
 * An installed collection's revision, whether a newer one is out, a way to update to it,
 * and the newest revision's changelog. The changelog isn't stored, so it's fetched, once
 * per revision for the whole session; undefined until it's in, or when there isn't one.
 */
export const useCollectionRevision = (collection: IMod) => {
  const { api } = useMainContext();
  const { attributes } = collection;
  const revision = revisionNumber(attributes?.version);
  const newest = Math.max(revision, revisionNumber(attributes?.newestVersion));
  const slug: string | undefined = attributes?.collectionSlug;

  const [changelog, setChangelog] = useState<string>();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (slug === undefined || newest === 0) {
      return;
    }

    const key = `${slug}:${newest}`;
    let fetched = changelogs.get(key);

    if (fetched === undefined) {
      fetched = api
        .emitAndAwait("get-nexus-collection-revision", slug, newest)
        .then((results) => results[0]?.collectionChangelog?.description ?? "")
        // Offline or refused: no button, and another go next time it's shown.
        .catch(() => {
          changelogs.delete(key);
          return "";
        });
      changelogs.set(key, fetched);
    }

    let current = true;
    void fetched.then((description) => current && setChangelog(description || undefined));

    return () => {
      current = false;
    };
  }, [api, newest, slug]);

  // As the collection's own Update does: the update shows the changelog, then installs.
  const update = useCallback(async () => {
    setUpdating(true);

    try {
      await toPromise((cb) =>
        api.events.emit(
          "collection-update",
          attributes?.downloadGame ?? activeGameId(api.getState()),
          slug,
          attributes?.newestVersion,
          attributes?.source,
          collection.id,
          cb,
        ),
      );
    } catch (err) {
      if (!(err instanceof UserCanceled)) {
        api.showErrorNotification("Failed to update collection", err);
      }
    } finally {
      setUpdating(false);
    }
  }, [api, attributes, collection.id, slug]);

  return { revision, newest, hasUpdate: newest > revision, update, updating, changelog };
};
