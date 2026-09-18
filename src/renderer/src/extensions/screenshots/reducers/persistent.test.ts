import { describe, it, expect } from "vitest";

import type { GameMediaModTag, GameMediaSource } from "../util/mediaTypes";
import type { IGameMediaPersistentState } from "./persistent";
import { persistentReducer } from "./persistent";

describe("setGameMediaSourceEnabled", () => {
  it("adds a disabled source to the disabled list", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {},
      disabledSources: {},
    };
    const gameId = "testGame";
    const sourceId = "testSource";

    const result = persistentReducer.reducers["SET_GAME_MEDIA_SOURCE_ENABLED"](input, {
      gameId,
      sourceId,
      enabled: false,
    });
    expect(result.disabledSources).toEqual({ [gameId]: [sourceId] });
  });

  it("removes an enabled source from the disabled list", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {},
      disabledSources: { testGame: ["testSource"] },
    };
    const gameId = "testGame";
    const sourceId = "testSource";

    const result = persistentReducer.reducers["SET_GAME_MEDIA_SOURCE_ENABLED"](input, {
      gameId,
      sourceId,
      enabled: true,
    });

    expect(result.disabledSources[gameId].length).toEqual(0);
  });

  it("does not duplicate the source id", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {},
      disabledSources: { testGame: ["testSource"] },
    };
    const gameId = "testGame";
    const sourceId = "testSource";

    const result = persistentReducer.reducers["SET_GAME_MEDIA_SOURCE_ENABLED"](input, {
      gameId,
      sourceId,
      enabled: false,
    });

    expect(result.disabledSources[gameId].length).toEqual(1);
  });
});

describe("addGameMediaSource", () => {
  it("adds a custom source under the correct game ID", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {},
      disabledSources: {},
    };
    const gameId = "testGame";
    const sourceId = "testSource";
    const source: GameMediaSource = {
      name: "test source",
      path: "test path",
    };

    const result = persistentReducer.reducers["ADD_GAME_MEDIA_SOURCE"](input, {
      gameId,
      sourceId,
      source,
    });

    expect(result.sources[gameId][sourceId]).toEqual(source);
  });

  it("preserves existing sources for other games", () => {
    const input: IGameMediaPersistentState = {
      sources: {
        existing: {
          some_source: { name: "Existing", path: "somePath" },
        },
      },
      modTags: {},
      disabledSources: {},
    };
    const gameId = "testGame";
    const sourceId = "testSource";
    const source: GameMediaSource = {
      name: "test source",
      path: "test path",
    };

    const result = persistentReducer.reducers["ADD_GAME_MEDIA_SOURCE"](input, {
      gameId,
      sourceId,
      source,
    });

    expect(result.sources[gameId][sourceId]).toEqual(source);
    expect(result.sources.existing.some_source.name).toEqual("Existing");
  });

  it("merges instead of replacing the whole map", () => {
    const input: IGameMediaPersistentState = {
      sources: {
        testGame: {
          some_source: { name: "Existing", path: "somePath" },
        },
      },
      modTags: {},
      disabledSources: {},
    };
    const gameId = "testGame";
    const sourceId = "testSource";
    const source: GameMediaSource = {
      name: "test source",
      path: "test path",
    };

    const result = persistentReducer.reducers["ADD_GAME_MEDIA_SOURCE"](input, {
      gameId,
      sourceId,
      source,
    });

    expect(result.sources[gameId][sourceId]).toEqual(source);
    expect(result.sources[gameId].some_source.name).toEqual("Existing");
  });
});

describe("deleteGameMediaSource", () => {
  it("removes only the target source", () => {
    const input: IGameMediaPersistentState = {
      sources: {
        testGame: {
          testSource: { name: "Test", path: "testPath" },
          some_source: { name: "Existing", path: "somePath" },
        },
        othergameId: {
          otherSource: { name: "Other", path: "otherPath" },
        },
      },
      modTags: {},
      disabledSources: {},
    };
    const gameId = "testGame";
    const sourceId = "testSource";

    const result = persistentReducer.reducers["DELETE_GAME_MEDIA_SOURCE"](input, {
      gameId,
      sourceId,
    });

    // Deletes the target source
    expect(result.sources[gameId][sourceId]).toBeUndefined();
    // Doesn't delete non-target source
    expect(result.sources[gameId].some_source.name).toEqual("Existing");
    // Doesn't delete anything from unrelated game
    expect(result.sources.othergameId.otherSource.name).toEqual("Other");
  });

  it("handles non-existant sources safely", () => {
    const input: IGameMediaPersistentState = {
      sources: {
        gameId: {
          testSource: { name: "Test", path: "testPath" },
          some_source: { name: "Existing", path: "somePath" },
        },
        othergameId: {
          otherSource: { name: "Other", path: "otherPath" },
        },
      },
      modTags: {},
      disabledSources: {},
    };

    const result = persistentReducer.reducers["DELETE_GAME_MEDIA_SOURCE"](input, {
      gameId: "gameId",
      sourceId: "doesnotexist",
    });

    // No changes
    expect(Object.keys(result.sources.gameId).length).toEqual(2);
    expect(Object.keys(result.sources.othergameId).length).toEqual(1);
  });
});

describe("deleteGameMediaModTag", () => {
  it("deletes only the tag supplied", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        game1: {
          image1: [
            {
              id: "modidentifier1",
              name: "tag name",
              x: 1,
              y: 1,
              createdAt: new Date().toString(),
            },
            {
              id: "modidentifier2",
              name: "tag name",
              x: 1,
              y: 1,
              createdAt: new Date().toString(),
            },
          ],
        },
      },
      disabledSources: {},
    };

    const result = persistentReducer.reducers["DELETE_GAME_MEDIA_MOD_TAG"](input, {
      gameId: "game1",
      mediaId: "image1",
      modId: "modidentifier1",
    });

    expect(result.modTags["game1"]["image1"].length).toEqual(1);
    expect(result.modTags["game1"]["image1"][0].id).toEqual("modidentifier2");
  });
});

describe("setGameMediaModTags", () => {
  it("stores tags for a media item", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {},
      disabledSources: {},
    };

    const gameId = "game";
    const mediaId = "media";
    const tags: GameMediaModTag[] = [
      {
        id: "identifier",
        name: "tag name",
        x: 1,
        y: 1,
        createdAt: new Date().toString(),
      },
    ];

    const result = persistentReducer.reducers["SET_GAME_MEDIA_MOD_TAGS"](input, {
      gameId,
      mediaId,
      tags,
    });

    expect(result.modTags[gameId][mediaId].length).toEqual(1);
  });

  it("removes an items entry when tags become empty", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        game: {
          media: [
            {
              id: "identifier",
              name: "tag name",
              x: 1,
              y: 1,
              createdAt: new Date().toString(),
            },
          ],
        },
      },
      disabledSources: {},
    };

    const gameId = "game";
    const mediaId = "media";

    const result = persistentReducer.reducers["SET_GAME_MEDIA_MOD_TAGS"](input, {
      gameId,
      mediaId,
      tags: [],
    });

    expect(result.modTags[gameId]?.[mediaId]).toBeUndefined();
  });

  it("keeps other game IDs unaffected", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        game2: {
          media2: [
            {
              id: "identifier",
              name: "tag name",
              x: 1,
              y: 1,
              createdAt: new Date().toString(),
            },
          ],
        },
      },
      disabledSources: {},
    };

    const gameId = "game";
    const mediaId = "media";
    const tags: GameMediaModTag[] = [
      {
        id: "identifier",
        name: "tag name",
        x: 1,
        y: 1,
        createdAt: new Date().toString(),
      },
    ];

    const result = persistentReducer.reducers["SET_GAME_MEDIA_MOD_TAGS"](input, {
      gameId,
      mediaId,
      tags,
    });

    expect(result.modTags[gameId][mediaId]).toEqual(tags);
    expect(result.modTags.game2.media2.length).toEqual(1);
  });
});

describe("clearGameMediaModTags", () => {
  const tag = (id: string): GameMediaModTag => ({
    id,
    name: `Mod ${id}`,
    x: 0.5,
    y: 0.5,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  it("removes only the listed media", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        testGame: {
          "sourceA::gone.png": [tag("1")],
          "sourceA::kept.png": [tag("2")],
        },
      },
      disabledSources: {},
    };

    const result = persistentReducer.reducers["CLEAR_GAME_MEDIA_MOD_TAGS"](input, {
      gameId: "testGame",
      mediaIds: ["sourceA::gone.png"],
    });

    expect(result.modTags.testGame["sourceA::gone.png"]).toBeUndefined();
    expect(result.modTags.testGame["sourceA::kept.png"]).toEqual([tag("2")]);
  });

  it("leaves other games untouched", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        testGame: { "sourceA::gone.png": [tag("1")] },
        otherGame: { "sourceB::keep.png": [tag("2")] },
      },
      disabledSources: {},
    };

    const result = persistentReducer.reducers["CLEAR_GAME_MEDIA_MOD_TAGS"](input, {
      gameId: "testGame",
      mediaIds: ["sourceA::gone.png"],
    });

    expect(result.modTags.otherGame["sourceB::keep.png"]).toEqual([tag("2")]);
  });

  it("drops the game entry once its last tags are cleared", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        testGame: {
          "sourceA::one.png": [tag("1")],
          "sourceA::two.png": [tag("2")],
        },
        otherGame: { "sourceB::keep.png": [tag("3")] },
      },
      disabledSources: {},
    };

    const result = persistentReducer.reducers["CLEAR_GAME_MEDIA_MOD_TAGS"](input, {
      gameId: "testGame",
      mediaIds: ["sourceA::one.png", "sourceA::two.png"],
    });

    expect(result.modTags.testGame).toBeUndefined();
    expect(Object.keys(result.modTags)).toEqual(["otherGame"]);
  });

  it("returns the state unchanged when the game has no tags", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: { otherGame: { "sourceB::keep.png": [tag("1")] } },
      disabledSources: {},
    };

    const result = persistentReducer.reducers["CLEAR_GAME_MEDIA_MOD_TAGS"](input, {
      gameId: "testGame",
      mediaIds: ["sourceA::gone.png"],
    });

    expect(result).toBe(input);
  });

  it("ignores media ids that are not present", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: { testGame: { "sourceA::kept.png": [tag("1")] } },
      disabledSources: {},
    };

    const result = persistentReducer.reducers["CLEAR_GAME_MEDIA_MOD_TAGS"](input, {
      gameId: "testGame",
      mediaIds: ["sourceA::never-existed.png"],
    });

    expect(result.modTags.testGame["sourceA::kept.png"]).toEqual([tag("1")]);
  });

  it("does not mutate the previous state", () => {
    const input: IGameMediaPersistentState = {
      sources: {},
      modTags: {
        testGame: {
          "sourceA::gone.png": [tag("1")],
          "sourceA::kept.png": [tag("2")],
        },
      },
      disabledSources: {},
    };

    persistentReducer.reducers["CLEAR_GAME_MEDIA_MOD_TAGS"](input, {
      gameId: "testGame",
      mediaIds: ["sourceA::gone.png"],
    });

    expect(input.modTags.testGame["sourceA::gone.png"]).toEqual([tag("1")]);
  });
});
