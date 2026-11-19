import { actionsToReducerSpec } from "../../../reducers/builder";
import type { ICollectionsPersistentState } from "../../../types/IState";
import * as actions from "../actions/persistent";

const persistentReducer = actionsToReducerSpec<ICollectionsPersistentState, typeof actions>(
  {
    collections: {},
    revisions: {},
    pendingVotes: {},
  },
  actions,
  {
    updateCollectionInfo: (state, payload) => {
      const { collectionId, collectionInfo, timestamp } = payload;

      if (collectionInfo === undefined) {
        if (state.collections?.[collectionId] === undefined) {
          return state;
        }
        const { [collectionId]: _, ...collections } = state.collections;
        return { ...state, collections };
      }

      return {
        ...state,
        collections: { ...state.collections, [collectionId]: { timestamp, info: collectionInfo } },
      };
    },
    updateRevisionInfo: (state, payload) => {
      const { revisionId, revisionInfo, timestamp } = payload;

      if (revisionInfo === undefined) {
        if (state.revisions?.[revisionId] === undefined) {
          return state;
        }
        const { [revisionId]: _, ...revisions } = state.revisions;
        return { ...state, revisions };
      }

      return {
        ...state,
        revisions: { ...state.revisions, [revisionId]: { timestamp, info: revisionInfo } },
      };
    },
    updateSuccessRate: (state, payload) => {
      const { revisionId, vote, average, total } = payload;

      const revision = state.revisions[revisionId];
      const info = revision?.info;
      return {
        ...state,
        revisions: {
          ...state.revisions,
          [revisionId]: {
            ...revision,
            info: {
              ...info,
              metadata: { ...info?.metadata, ratingValue: vote },
              rating: { average, total },
            },
          },
        },
      };
    },
    setPendingVote: (state, payload) => {
      const { revisionId, collectionSlug, revisionNumber, time } = payload;

      return {
        ...state,
        pendingVotes: {
          ...state.pendingVotes,
          [revisionId]: { collectionSlug, revisionNumber, time },
        },
      };
    },
    clearPendingVote: (state, payload) => {
      const { revisionId } = payload;

      if (state.pendingVotes?.[revisionId] === undefined) {
        return state;
      }
      const { [revisionId]: _, ...pendingVotes } = state.pendingVotes;
      return { ...state, pendingVotes };
    },
  },
);

export default persistentReducer;
