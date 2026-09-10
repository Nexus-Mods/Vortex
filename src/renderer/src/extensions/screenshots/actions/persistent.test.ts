import { describe, it, expect } from "vitest";

import type { GameMediaModTag, GameMediaSource } from "../util/mediaTypes";
import * as actions from "./persistent";

describe("addGameMediaSource", () => {
  it("creates the correct action", () => {
    const source: GameMediaSource = {
      name: "Test Source",
      path: "path\\to\\source",
    };
    const gameId = "test";
    const sourceId = "testSource";

    const action = actions.addGameMediaSource(gameId, sourceId, source);
    expect(action).toEqual({
      error: false,
      type: "ADD_GAME_MEDIA_SOURCE",
      payload: { gameId, sourceId, source },
    });
  });
});

describe("deleteGameMediaSource", () => {
  it("creates the correct action", () => {
    const gameId = "test";
    const sourceId = "testSource";

    const action = actions.deleteGameMediaSource(gameId, sourceId);
    expect(action).toEqual({
      error: false,
      type: "DELETE_GAME_MEDIA_SOURCE",
      payload: { gameId, sourceId },
    });
  });
});

describe("setGameMediaModTags", () => {
  it("creates the correct action", () => {
    const gameId = "test";
    const mediaId = "testSource";
    const tags: GameMediaModTag[] = [
      {
        id: "testtag",
        name: "Some mod",
        x: 1,
        y: 1,
        createdAt: new Date().toString(),
      },
    ];

    const action = actions.setGameMediaModTags(gameId, mediaId, tags);
    expect(action).toEqual({
      error: false,
      type: "SET_GAME_MEDIA_MOD_TAGS",
      payload: { gameId, mediaId, tags },
    });
  });
});

describe("setGameMediaSourceEnabled", () => {
  it("creates the correct action", () => {
    const gameId = "test";
    const sourceId = "testSource";
    const enabled = false;

    const action = actions.setGameMediaSourceEnabled(gameId, sourceId, enabled);
    expect(action).toEqual({
      error: false,
      type: "SET_GAME_MEDIA_SOURCE_ENABLED",
      payload: { gameId, sourceId, enabled },
    });
  });
});
