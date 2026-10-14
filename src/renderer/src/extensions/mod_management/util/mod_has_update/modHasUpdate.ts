import { MOD_TYPE as COLLECTION_TYPE } from "../../../collections/constants";
import type { IMod } from "../../types/IMod";
import type { UpdateState } from "../modUpdateState";
import updateState from "../modUpdateState";

const revisionNumber = (value: string | undefined) => parseInt(value ?? "0", 10) || 0;

/** An installed collection's revision, the newest that's out, and whether that's newer. */
export const collectionRevisions = (collection: IMod) => {
  const revision = revisionNumber(collection.attributes?.version);
  const newest = Math.max(revision, revisionNumber(collection.attributes?.newestVersion));

  return { revision, newest, hasUpdate: newest > revision };
};

/** Whether a mod's update state is one the table offers an update for: to update, or to pick. */
export const offersUpdate = (state: UpdateState) => state === "update" || state === "update-site";

/**
 * Whether the table offers an update for a mod or collection: a newer file for a mod, a
 * bugged version alone not counting, and a newer revision for a collection.
 */
export const modHasUpdate = (mod: IMod): boolean =>
  mod.type === COLLECTION_TYPE
    ? collectionRevisions(mod).hasUpdate
    : offersUpdate(updateState(mod.attributes ?? {}));
