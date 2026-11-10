import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { clearGameAddStore, setGameAddStore } from "../actions/session";
import { sessionReducer } from "./session";

describe("gameAddStore", () => {
  it("starts out empty", () => {
    expect(sessionReducer.defaults.gameAddStore).toBeNull();
  });

  it("holds the store picked for a game", () => {
    const state = sessionReducer.reducers.SET_GAME_ADD_STORE(
      sessionReducer.defaults,
      setGameAddStore(VortexGameId("fallout4"), "steam").payload,
    );

    expect(state.gameAddStore).toEqual({ gameId: "fallout4", store: "steam" });
  });

  it("is forgotten once the add ends", () => {
    const picked = sessionReducer.reducers.SET_GAME_ADD_STORE(
      sessionReducer.defaults,
      setGameAddStore(VortexGameId("fallout4"), "steam").payload,
    );

    expect(
      sessionReducer.reducers.CLEAR_GAME_ADD_STORE(picked, clearGameAddStore().payload)
        .gameAddStore,
    ).toBeNull();
  });
});
