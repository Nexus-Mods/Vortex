import { GameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { tierZeroGameId } from "./tierZeroGameId";

describe("tierZeroGameId", () => {
  it("is the game's numeric id behind the tier-0 prefix", () => {
    expect(tierZeroGameId(GameId(1303))).toBe("tier-0-1303");
  });
});
