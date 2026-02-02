import * as actions from "../actions/persistent";

import * as _ from "lodash";
import { types, util } from "vortex-api";

const persistentReducer: types.IReducerSpec = {
  reducers: {
    [actions.updateCollectionInfo as any]: (state, payload) => {
      const { collectionId, collectionInfo, timestamp } = payload;

      if (collectionInfo === undefined) {
        return util.deleteOrNop(state, ["collections", collectionId]);
      } else {
        return util.setSafe(state, ["collections", collectionId], {
          timestamp,
          info: collectionInfo,
        });
      }
    },
    [actions.updateRevisionInfo as any]: (state, payload) => {
      const { revisionId, revisionInfo, timestamp } = payload;

      if (revisionInfo === undefined) {
        return util.deleteOrNop(state, ["revisions", "revisionId"]);
      } else {
        return util.setSafe(state, ["revisions", revisionId], {
          timestamp,
          info: revisionInfo,
        });
      }
    },
    [actions.updateSuccessRate as any]: (state, payload) => {
      const { revisionId, vote, average, total } = payload;

      const revPath = ["revisions", revisionId, "info"];

      state = util.setSafe(
        state,
        [...revPath, "metadata", "ratingValue"],
        vote,
      );
      return util.setSafe(state, [...revPath, "rating"], {
        average,
        total,
      });
    },
    [actions.setPendingVote as any]: (state, payload) => {
      const { revisionId, collectionSlug, revisionNumber, time } = payload;

      return util.setSafe(state, ["pendingVotes", revisionId], {
        collectionSlug,
        revisionNumber,
        time,
      });
    },
    [actions.clearPendingVote as any]: (state, payload) => {
      const { revisionId } = payload;
      return util.deleteOrNop(state, ["pendingVotes", revisionId]);
    },
  },
  defaults: {
    collections: {},
    revisions: {},
    pendingVotes: {},
  },
};

export default persistentReducer;
