import * as actions from "../actions/persistent";

import update from "immutability-helper";
import type { types } from "vortex-api";

const persistentReducer: types.IReducerSpec = {
  reducers: {
    [actions.updateCollectionInfo as any]: (state, payload) => {
      const { collectionId, collectionInfo, timestamp } = payload;

      if (collectionInfo === undefined) {
        if (state.collections?.[collectionId] === undefined) {
          return state;
        }
        return update(state, { collections: { $unset: [collectionId] } });
      }

      return update(state, {
        collections: {
          [collectionId]: { $set: { timestamp, info: collectionInfo } },
        },
      });
    },
    [actions.updateRevisionInfo as any]: (state, payload) => {
      const { revisionId, revisionInfo, timestamp } = payload;

      if (revisionInfo === undefined) {
        if (state.revisions?.[revisionId] === undefined) {
          return state;
        }
        return update(state, { revisions: { $unset: [revisionId] } });
      }

      return update(state, {
        revisions: {
          [revisionId]: { $set: { timestamp, info: revisionInfo } },
        },
      });
    },
    [actions.updateSuccessRate as any]: (state, payload) => {
      const { revisionId, vote, average, total } = payload;

      return update(state, {
        revisions: {
          [revisionId]: {
            $apply: (rev) =>
              update(rev ?? {}, {
                info: {
                  $apply: (info) =>
                    update(info ?? {}, {
                      metadata: {
                        $apply: (m) => ({ ...(m ?? {}), ratingValue: vote }),
                      },
                      rating: { $set: { average, total } },
                    }),
                },
              }),
          },
        },
      });
    },
    [actions.setPendingVote as any]: (state, payload) => {
      const { revisionId, collectionSlug, revisionNumber, time } = payload;

      return update(state, {
        pendingVotes: {
          [revisionId]: {
            $set: { collectionSlug, revisionNumber, time },
          },
        },
      });
    },
    [actions.clearPendingVote as any]: (state, payload) => {
      const { revisionId } = payload;

      if (state.pendingVotes?.[revisionId] === undefined) {
        return state;
      }
      return update(state, { pendingVotes: { $unset: [revisionId] } });
    },
  },
  defaults: {
    collections: {},
    revisions: {},
    pendingVotes: {},
  },
};

export default persistentReducer;
