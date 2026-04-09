import { describe, expectTypeOf, it } from "vitest";

import type { QualifiedPath } from "@vortex/fs";

import type {
  GameFolder,
  GameFolderMap,
  IGamePathService,
} from "./game-paths.js";

describe("GameFolder", () => {
  it("is a union of well-known folder names", () => {
    expectTypeOf<GameFolder>().toEqualTypeOf<
      "install" | "saves" | "preferences" | "config" | "cache"
    >();
  });
});

describe("GameFolderMap", () => {
  it("accepts well-known folder keys", () => {
    expectTypeOf<GameFolderMap>().toMatchTypeOf<
      Partial<Record<GameFolder, QualifiedPath>>
    >();
  });

  it("accepts arbitrary string keys", () => {
    expectTypeOf<GameFolderMap>().toMatchTypeOf<
      Record<string, QualifiedPath | undefined>
    >();
  });
});

describe("IGamePathService", () => {
  it("has resolveGameFolders returning Promise<GameFolderMap>", () => {
    expectTypeOf<
      IGamePathService["resolveGameFolders"]
    >().returns.resolves.toMatchTypeOf<GameFolderMap>();
  });
});
