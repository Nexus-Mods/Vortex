/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";

import * as selectors from "./selectors";
import type { GameMediaItem, GameMediaModTag } from "./util/mediaTypes";

const tag = (id: string): GameMediaModTag => ({
  id,
  name: `Mod ${id}`,
  x: 0.5,
  y: 0.5,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const item = (id: string): GameMediaItem => ({
  id,
  name: `${id}.jpg`,
  path: `images/${id}.jpg`,
  sourceId: "default",
  type: "image",
});

const makeState = (overrides: any = {}) =>
  ({
    persistent: {
      game_media: { sources: {}, modTags: {}, disabledSources: {}, flags: {}, ...overrides },
    },
    session: { game_media: { items: [] } },
  }) as any;

describe("game media selectors", () => {
  it("disabledSources returns the same reference on repeated calls when the game has no entry", () => {
    const state = makeState();

    expect(selectors.disabledSources(state, "game-1")).toBe(
      selectors.disabledSources(state, "game-1"),
    );
  });

  it("modTags returns a stable empty array", () => {
    const state = makeState();

    expect(selectors.modTags(state, "game-1", "a.png")).toBe(
      selectors.modTags(state, "game-1", "a.png"),
    );
  });

  it("orphanedTagIds returns [] when liveItems is undefined", () => {
    const state = makeState({ modTags: { "game-1": { "src::gone.png": [tag("1")] } } });

    expect(selectors.orphanedTagIds(state, "game-1", undefined as never)).toEqual([]);
  });

  it("orphanedTagIds finds ids absent from the live list and excludes present ones", () => {
    const state = makeState({
      modTags: {
        "game-1": {
          "src::gone.png": [tag("1")],
          "src::here.png": [tag("2")],
        },
      },
    });

    expect(selectors.orphanedTagIds(state, "game-1", [item("src::here.png")])).toEqual([
      "src::gone.png",
    ]);
  });

  it("orphanedTagIds survive a missing game_media slice", () => {
    const empty = { persistent: {}, session: {} } as any;

    expect(selectors.orphanedTagIds(empty, "game-1", [item("a")])).toEqual([]);
  });
});
