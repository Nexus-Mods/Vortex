import { ICollection, IRevision } from "@nexusmods/nexus-api";
import { createAction } from "redux-act";

export const updateCollectionInfo = createAction(
  "UPDATE_COLLECTION_INFO",
  (
    collectionId: string,
    collectionInfo: Partial<ICollection>,
    timestamp: number,
  ) => ({ collectionId, collectionInfo, timestamp }),
);

export const updateRevisionInfo = createAction(
  "UPDATE_REVISION_INFO",
  (
    revisionId: number,
    revisionInfo: Partial<IRevision>,
    timestamp: number,
  ) => ({ revisionId, revisionInfo, timestamp }),
);

export const updateSuccessRate = createAction(
  "UPDATE_COLLECTION_HEALTH_RATE",
  (
    revisionId: number,
    vote: "positive" | "negative",
    average: number,
    total: number,
  ) => ({ revisionId, vote, average, total }),
);

export const setPendingVote = createAction(
  "SET_REVISION_PENDING_VOTE",
  (
    revisionId: number,
    collectionSlug: string,
    revisionNumber: number,
    time: number,
  ) => ({ revisionId, collectionSlug, revisionNumber, time }),
);

export const clearPendingVote = createAction(
  "CLEAR_REVISION_PENDING_VOTE",
  (revisionId: number) => ({ revisionId }),
);
