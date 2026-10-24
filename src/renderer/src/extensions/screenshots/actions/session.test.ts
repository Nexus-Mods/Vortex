import { describe, it, expect } from "vitest";

import type { GameMediaItem } from "../util/mediaTypes";
import * as actions from "./session";

describe("setFoundGameMedia", () => {
  it("creates the correct action", () => {
    const media: GameMediaItem[] = [
      {
        id: "111",
        name: "file.jpg",
        sourceId: "source",
        type: "image",
        path: "file.jpg",
      },
    ];
    const action = actions.setFoundGameMedia(media);
    expect(action).toEqual({
      error: false,
      type: "SET_FOUND_GAME_MEDIA",
      payload: { media },
    });
  });
});
