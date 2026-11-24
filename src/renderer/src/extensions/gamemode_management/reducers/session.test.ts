import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { clearGameAddStore, setGameAddExtension, setGameAddStore } from "../actions/session";
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

describe("gameAddExtension", () => {
  const emberville = {
    name: "Emberville",
    modId: 1,
    fileId: 1,
    author: "tester",
    version: "1.0.0",
    timestamp: 0,
  };

  const picked = sessionReducer.reducers.SET_GAME_ADD_EXTENSION(
    sessionReducer.defaults,
    setGameAddExtension(emberville).payload,
  );

  it("starts out empty", () => {
    expect(sessionReducer.defaults.gameAddExtension).toBeNull();
  });

  it("holds the extension of the tile picked", () => {
    expect(picked.gameAddExtension).toEqual(emberville);
  });

  it("is replaced by none when a tile with no extension is picked", () => {
    const next = sessionReducer.reducers.SET_GAME_ADD_EXTENSION(
      picked,
      setGameAddExtension(null).payload,
    );

    expect(next.gameAddExtension).toBeNull();
  });

  it("is forgotten once the add ends", () => {
    expect(
      sessionReducer.reducers.CLEAR_GAME_ADD_STORE(picked, clearGameAddStore().payload)
        .gameAddExtension,
    ).toBeNull();
  });
});
