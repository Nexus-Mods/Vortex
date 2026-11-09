import { describe, expect, it } from "vitest";

import { makeGame } from "@/test-utils/builders";

import { assertRegisteredGame } from "./registeredGame";

describe("assertRegisteredGame", () => {
  it("accepts a game and leaves it unchanged", () => {
    const game = makeGame({ id: "skyrimse" });
    const before = { ...game };

    assertRegisteredGame(game);

    expect(game).toEqual(before);
  });

  it("accepts a class whose id is a getter, keeping its prototype", () => {
    class GetterGame {
      public get id() {
        return "gettergame";
      }
      public name = "Getter Game";
      public requiredFiles: string[] = [];
      public queryModPath = () => ".";
      public executable = () => "game.exe";
    }
    const game = new GetterGame();

    expect(() => assertRegisteredGame(game)).not.toThrow();
    expect(game).toBeInstanceOf(GetterGame);
    expect(game.id).toBe("gettergame");
  });

  it("rejects a game with an empty id", () => {
    expect(() => assertRegisteredGame(makeGame({ id: "" }))).toThrow();
  });
});
