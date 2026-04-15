import { QualifiedPath } from "@vortex/fs";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { StorePathSnapshot } from "../stores/providers.js";
import type { GamePaths, IGamePathService } from "./game-paths.js";

import { Base } from "../stores/providers.js";
import { rehydrateGamePaths } from "./game-paths.js";

describe("GamePaths<T>", () => {
  it("allows the mandatory Base.Game key", () => {
    expectTypeOf<GamePaths>().toMatchTypeOf<Map<Base, QualifiedPath>>();
  });

  it("admits adaptor-declared keys via T", () => {
    expectTypeOf<GamePaths<"saves" | "preferences">>().toMatchTypeOf<
      Map<"saves" | "preferences" | Base, QualifiedPath>
    >();
  });
});

describe("IGamePathService", () => {
  it("exposes a paths method returning Promise<GamePaths>", () => {
    expectTypeOf<
      IGamePathService["paths"]
    >().returns.resolves.toMatchTypeOf<GamePaths>();
  });

  it("takes a single StorePathSnapshot argument", () => {
    expectTypeOf<IGamePathService["paths"]>().parameters.toEqualTypeOf<
      [StorePathSnapshot]
    >();
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
    const stripped = new Map<Base | "saves", QualifiedPath>([
      [Base.Game, stripPrototype(game)],
      ["saves", stripPrototype(saves)],
    ]);
    expect(stripped.get(Base.Game)).not.toBeInstanceOf(QualifiedPath);

    const rehydrated = rehydrateGamePaths<"saves">(stripped);
    expect(rehydrated.get(Base.Game)).toBeInstanceOf(QualifiedPath);
    expect(rehydrated.get(Base.Game)?.value).toBe(game.value);
    expect(rehydrated.get("saves")?.value).toBe(saves.value);
  });

  it("passes through already-hydrated QualifiedPath values", () => {
    const game = QualifiedPath.parse("linux:///games/Foo");
    const raw = new Map<Base, QualifiedPath>([[Base.Game, game]]);
    const rehydrated = rehydrateGamePaths(raw);
    expect(rehydrated.get(Base.Game)).toBe(game);
  });
});
