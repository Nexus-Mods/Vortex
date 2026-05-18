import { describe, expect, expectTypeOf, it } from "vitest";

import { QualifiedPath } from "../fs/paths";
import type { StorePathProvider } from "../stores/providers";
import type { GamePaths, IGamePathService } from "./game-paths";
import { rehydrateGamePaths } from "./game-paths";

describe("GamePaths<T>", () => {
  it("produces the expected mapped-type shape for game-only", () => {
    expectTypeOf<GamePaths<"game">>().toEqualTypeOf<{
      game: QualifiedPath;
    }>();
  });

  it("admits adaptor-declared keys via T", () => {
    expectTypeOf<GamePaths<"game" | "saves" | "preferences">>().toEqualTypeOf<{
      game: QualifiedPath;
      saves: QualifiedPath;
      preferences: QualifiedPath;
    }>();
  });
});

describe("IGamePathService", () => {
  it("always includes 'game' in the returned GamePaths", () => {
    expectTypeOf<IGamePathService["paths"]>().returns.resolves.toMatchTypeOf<{
      game: QualifiedPath;
    }>();
  });

  it("takes a single StorePathProvider argument", () => {
    expectTypeOf<IGamePathService["paths"]>().parameters.toEqualTypeOf<[StorePathProvider]>();
  });

  it("threads T into the return type alongside 'game'", () => {
    type Svc = IGamePathService<"saves">;
    expectTypeOf<Svc["paths"]>().returns.resolves.toEqualTypeOf<GamePaths<"game" | "saves">>();
  });
});

/**
 * Simulates what `structuredClone` does to QualifiedPath values:
 * returns a plain object with the same own properties but no prototype
 * link back to {@link QualifiedPath}.
 */
function stripPrototype(qp: QualifiedPath): QualifiedPath {
  return {
    value: qp.value,
    scheme: qp.scheme,
    data: qp.data,
    path: qp.path,
  } as unknown as QualifiedPath;
}

describe("rehydrateGamePaths", () => {
  it("reconstructs QualifiedPath instances from prototype-stripped data", () => {
    const game = QualifiedPath.parse("windows:///C/Games/Foo");
    const saves = QualifiedPath.parse("windows:///C/Users/me/Saved Games/Foo");
    const stripped = {
      game: stripPrototype(game),
      saves: stripPrototype(saves),
    } as GamePaths<"game" | "saves">;
    expect(stripped.game).not.toBeInstanceOf(QualifiedPath);

    const rehydrated = rehydrateGamePaths(stripped);
    expect(rehydrated.game).toBeInstanceOf(QualifiedPath);
    expect(rehydrated.game.value).toBe(game.value);
    expect(rehydrated.saves.value).toBe(saves.value);
  });

  it("passes through already-hydrated QualifiedPath values", () => {
    const game = QualifiedPath.parse("linux:///games/Foo");
    const raw = { game } as GamePaths<"game">;
    const rehydrated = rehydrateGamePaths(raw);
    expect(rehydrated.game).toBe(game);
  });
});
