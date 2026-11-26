import type { NexusGameId, RecordedGameUid, VortexGameId } from "@vortex/shared";
import { describe, expect, expectTypeOf, it } from "vitest";

import { ContributesSchema } from "./contributes";

const parse = (data: unknown) => ContributesSchema.safeParse(data);

describe("ContributesSchema", () => {
  it("parses a valid manifest into branded values", () => {
    const result = ContributesSchema.parse({
      games: { "made-up-game": { nexusGameId: 42, name: "Made Up", gameUid: "uid-1" } },
      gameEnhancements: [{ gameUid: "uid-2" }, { nexusGameId: 7 }],
    });

    const game = result.games?.["made-up-game" as VortexGameId];
    expect(game).toEqual({ nexusGameId: 42, name: "Made Up", gameUid: "uid-1" });
    expect(result.gameEnhancements).toEqual([{ gameUid: "uid-2" }, { nexusGameId: 7 }]);

    expectTypeOf(game?.nexusGameId).toEqualTypeOf<NexusGameId | undefined>();
    expectTypeOf(game?.gameUid).toEqualTypeOf<RecordedGameUid | undefined>();
  });

  it("accepts a manifest with nothing declared", () => {
    expect(parse({}).success).toBe(true);
  });

  describe("game keys", () => {
    it("rejects an empty key", () => {
      expect(parse({ games: { "": {} } }).success).toBe(false);
    });

    it("rejects the reserved tier-0- prefix", () => {
      expect(parse({ games: { "tier-0-made-up": {} } }).success).toBe(false);
    });

    it("accepts keys that merely resemble the prefix", () => {
      expect(parse({ games: { "tier-1-made-up": {}, "my-tier-0-game": {} } }).success).toBe(true);
    });
  });

  describe("nexusGameId", () => {
    it.each([0, -1, 1.5, "1", null])("rejects %j", (nexusGameId) => {
      expect(parse({ games: { game: { nexusGameId } } }).success).toBe(false);
    });

    it("accepts a positive integer", () => {
      expect(parse({ games: { game: { nexusGameId: 1 } } }).success).toBe(true);
    });
  });

  describe("gameUid", () => {
    it("rejects an empty string", () => {
      expect(parse({ games: { game: { gameUid: "" } } }).success).toBe(false);
    });

    it("accepts any non-empty string, as catalogue ids are opaque", () => {
      expect(parse({ games: { game: { gameUid: "not even a uuid!" } } }).success).toBe(true);
    });
  });

  describe("gameUid case", () => {
    it("lowercases an uppercase uid in a declared game", () => {
      const result = ContributesSchema.parse({ games: { game: { gameUid: "UID-ABC" } } });

      expect(result.games).toEqual({ game: { gameUid: "uid-abc" } });
    });

    it("lowercases an uppercase uid in an enhancement", () => {
      const result = ContributesSchema.parse({ gameEnhancements: [{ gameUid: "UID-ABC" }] });

      expect(result.gameEnhancements).toEqual([{ gameUid: "uid-abc" }]);
    });
  });

  it("declares a game with an empty object", () => {
    expect(ContributesSchema.parse({ games: { game: {} } }).games).toEqual({ game: {} });
  });

  describe("game enhancements", () => {
    it("accepts exactly one target", () => {
      expect(parse({ gameEnhancements: [{ gameUid: "uid-1" }] }).success).toBe(true);
      expect(parse({ gameEnhancements: [{ nexusGameId: 1 }] }).success).toBe(true);
    });

    it("rejects both targets", () => {
      expect(parse({ gameEnhancements: [{ gameUid: "uid-1", nexusGameId: 1 }] }).success).toBe(
        false,
      );
    });

    it("rejects neither target", () => {
      expect(parse({ gameEnhancements: [{}] }).success).toBe(false);
    });
  });

  it("drops unknown keys instead of rejecting them", () => {
    const result = ContributesSchema.parse({
      future: true,
      games: { game: { nexusGameId: 1, future: true } },
      gameEnhancements: [{ gameUid: "uid-1", future: true }],
    });

    expect(result).toEqual({
      games: { game: { nexusGameId: 1 } },
      gameEnhancements: [{ gameUid: "uid-1" }],
    });
  });
});
