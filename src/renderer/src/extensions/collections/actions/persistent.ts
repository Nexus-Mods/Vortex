import type { ICollection, IRevision } from "@nexusmods/nexus-api";
import { createAction } from "redux-act";

export const updateCollectionInfo = createAction(
  "UPDATE_COLLECTION_INFO",
  (collectionId: string, collectionInfo: Partial<ICollection>, timestamp: number) => ({
    collectionId,
    collectionInfo,
    timestamp,
  }),
);

// A revision as we cache it: optional fields with a reduced `collection` (the full collection is
// cached separately via updateCollectionInfo and rehydrated from the slug on read), so we can
// store an { id, slug } collection pointer without supplying a full ICollection. The clean fix
// is to make `IRevision.collection` partial upstream in node-nexus-api (where IRevision is
// defined); that repo is out of scope for LAZ-483, so we model the reduced shape here.
type PartialRevisionInfo = Partial<Omit<IRevision, "collection">> & {
  collection?: Partial<ICollection>;
};

export const updateRevisionInfo = createAction(
  "UPDATE_REVISION_INFO",
  (revisionId: number, revisionInfo: PartialRevisionInfo, timestamp: number) => ({
    revisionId,
    revisionInfo,
    timestamp,
  }),
);

export const updateSuccessRate = createAction(
  "UPDATE_COLLECTION_HEALTH_RATE",
  (revisionId: number, vote: "positive" | "negative", average: number, total: number) => ({
    revisionId,
    vote,
    average,
    total,
  }),
);

export const setPendingVote = createAction(
  "SET_REVISION_PENDING_VOTE",
  (revisionId: number, collectionSlug: string, revisionNumber: number, time: number) => ({
    revisionId,
    collectionSlug,
    revisionNumber,
    time,
  }),
);

export const clearPendingVote = createAction(
  "CLEAR_REVISION_PENDING_VOTE",
  (revisionId: number) => ({ revisionId }),
);
