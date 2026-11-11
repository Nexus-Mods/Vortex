import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { makeGameStored } from "../../test-utils/builders";
import { findGame, type IGameData } from "./queries";

const data = (...ids: VortexGameId[]): IGameData => ({
  known: ids.map((id) => makeGameStored({ id, name: id })),
});

describe("findGame", () => {
  describe("by vortexId", () => {
    it("finds the game registered under the id", () => {
      const result = findGame(data(VortexGameId("skyrimse"), VortexGameId("fallout4")), {
        vortexGameId: VortexGameId("fallout4"),
      });

      expect(result?.id).toBe("fallout4");
    });

    it("finds a Tier 0 game by its tier-0 id", () => {
      const result = findGame(data(VortexGameId("skyrimse"), VortexGameId("tier-0-1303")), {
        vortexGameId: VortexGameId("tier-0-1303"),
      });

      expect(result?.id).toBe("tier-0-1303");
    });

    it("is undefined when no known game has the id", () => {
      expect(
        findGame(data(VortexGameId("skyrimse")), { vortexGameId: VortexGameId("fallout4") }),
      ).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(data(), { vortexGameId: VortexGameId("skyrimse") })).toBeUndefined();
    });

    it("does not match on the id's case", () => {
      expect(
        findGame(data(VortexGameId("skyrimse")), { vortexGameId: VortexGameId("SkyrimSE") }),
      ).toBeUndefined();
    });
  });
});
