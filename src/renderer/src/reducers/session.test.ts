import { VortexGameId } from "@vortex/shared";
import { describe, it, expect } from "vitest";

import { sessionReducer, defaultState } from "./session";

describe("displayGroup", () => {
  it("sets the display item and creates missing nodes", () => {
    const result = sessionReducer.reducers.DISPLAY_GROUP(defaultState, {
      groupId: "someGroupId",
      itemId: "someItemId",
    });
    expect(result.displayGroups).toEqual({ someGroupId: "someItemId" });
  });
});

describe("purge progress", () => {
  const gameId = VortexGameId("skyrimse");

  it("keeps each purge apart, so a second purge doesn't overwrite the first's progress", () => {
    let state = sessionReducer.reducers.SET_PURGE_PROGRESS(defaultState, {
      purgeId: "first",
      gameId,
      text: "Removing links",
      percent: 40,
    });
    state = sessionReducer.reducers.SET_PURGE_PROGRESS(state, {
      purgeId: "second",
      gameId,
      text: "Waiting for other operations to complete",
      percent: 0,
    });

    expect(state.purges.first).toEqual({ gameId, text: "Removing links", percent: 40 });
    expect(state.purges.second.percent).toBe(0);
  });

  it("forgets only the purge that finished", () => {
    let state = sessionReducer.reducers.SET_PURGE_PROGRESS(defaultState, {
      purgeId: "first",
      gameId,
      text: "Removing links",
      percent: 40,
    });
    state = sessionReducer.reducers.SET_PURGE_PROGRESS(state, {
      purgeId: "second",
      gameId,
      text: "Preparing purge",
      percent: 0,
    });
    state = sessionReducer.reducers.CLEAR_PURGE_PROGRESS(state, { purgeId: "first" });

    expect(Object.keys(state.purges)).toEqual(["second"]);
  });
});
