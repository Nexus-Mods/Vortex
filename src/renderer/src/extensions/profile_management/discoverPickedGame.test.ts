import { VortexGameId } from "@vortex/shared";
import { describe, expect } from "vitest";

import { makeGameHarness } from "../../test-utils/builders";
import { test } from "../../test-utils/harnessTest";
import { discoverPickedGame } from "./index";

const cyberpunk = VortexGameId("cyberpunk2077");

describe("discoverPickedGame", () => {
  test("lets a stubbed game picked from a store go on to its extension download", async () => {
    const { api } = makeGameHarness({ gameId: cyberpunk, stub: true });

    await expect(discoverPickedGame(api, cyberpunk, "steam")).resolves.toBeUndefined();
  });
});
