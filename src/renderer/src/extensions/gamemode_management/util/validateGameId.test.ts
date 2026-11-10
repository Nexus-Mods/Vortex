import { describe, expect, it } from "vitest";

import { makeGame } from "@/test-utils/builders";
import type { IGame } from "@/types/IGame";

import { validateGameId } from "./validateGameId";

describe("validateGameId", () => {
  it("accepts a game and leaves it unchanged", () => {
    const game = makeGame({ id: "skyrimse" });
    const before = { ...game };

    validateGameId(game);

    expect(game).toEqual(before);
  });

  it("accepts a plain-string id, as a JavaScript extension passes it", () => {
    const game = { ...makeGame(), id: "stardewvalley" } as unknown as IGame;

    expect(() => validateGameId(game)).not.toThrow();
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

    expect(() => validateGameId(game as unknown as IGame)).not.toThrow();
    expect(game).toBeInstanceOf(GetterGame);
    expect(game.id).toBe("gettergame");
  });

  it("rejects a game with an empty id", () => {
    const game = { ...makeGame(), id: "" } as unknown as IGame;

    expect(() => validateGameId(game)).toThrow();
  });
});
