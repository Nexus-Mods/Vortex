import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { setCurrentProfile } from "@/extensions/profile_management/actions/settings";

import { setBrowseModSearchText } from "../../actions/session";
import { type IBrowseSessionState, sessionReducer } from "./session";

const reduce = (state: IBrowseSessionState, action: { type: string; payload?: unknown }) =>
  sessionReducer.reducers[action.type](state, action.payload);

const searching = (text: string): IBrowseSessionState =>
  reduce(reduce({}, setCurrentProfile("skyrimse", "p1")), setBrowseModSearchText(text));

describe("sessionReducer", () => {
  it("clears the search text when another game becomes active", () => {
    const state = reduce(searching("skyui"), setCurrentProfile("fallout4", "p2"));

    expect(state.modSearchText).toBeUndefined();
    expect(state.activeGameId).toBe(VortexGameId("fallout4"));
  });

  it("keeps the search text when another profile of the same game becomes active", () => {
    const state = reduce(searching("skyui"), setCurrentProfile("skyrimse", "p3"));

    expect(state.modSearchText).toBe("skyui");
  });

  it("clears the search text when no game is active", () => {
    const state = reduce(searching("skyui"), setCurrentProfile(undefined, undefined));

    expect(state.modSearchText).toBeUndefined();
  });

  it("keeps the rest of Browse's session when the game changes", () => {
    const state = reduce(
      { ...searching("skyui"), section: "collections" },
      setCurrentProfile("fallout4", "p2"),
    );

    expect(state.section).toBe("collections");
  });
});
