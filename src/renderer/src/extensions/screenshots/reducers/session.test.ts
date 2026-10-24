import { describe, it, expect } from "vitest";

import type { GameMediaItem } from "../util/mediaTypes";
import type { IGameMediaSessionState } from "./session";
import { sessionReducer } from "./session";

const item = (id: string, sourceId: string = "default"): GameMediaItem => ({
  id,
  path: id,
  sourceId,
  name: id,
  type: "image",
});

describe("setFoundGameMedia", () => {
  it("overwrites the existing state with the incoming media", () => {
    const input: IGameMediaSessionState = { items: [item("a"), item("b")] };

    const newItems = [item("c"), item("d")];

    const result = sessionReducer.reducers["SET_FOUND_GAME_MEDIA"](input, { media: newItems });

    expect(result.items).toEqual(newItems);
  });
});

describe("replaceSourceGameMedia", () => {
  it("replaces only the items for the given source", () => {
    const input: IGameMediaSessionState = {
      ...sessionReducer.defaults,
      items: [item("a"), item("b"), item("c", "otherSource")],
    };

    const result = sessionReducer.reducers["REPLACE_SOURCE_GAME_MEDIA"](input, {
      sourceId: "otherSource",
      media: [item("d", "otherSource"), item("e", "otherSource")],
    });

    expect(result.items.length).toBe(4);
    expect(result.items.find((i) => i.name === "c")).toBeUndefined();
    expect(result.items.filter((i) => i.sourceId === "default")).toEqual([item("a"), item("b")]);
  });
});
