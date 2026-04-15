import type { RelativePath } from "@vortex/fs";

import { describe, expectTypeOf, it } from "vitest";

import type { Base, StorePathSnapshot } from "../stores/providers.js";
import type {
  IGameInstallerService,
  InstallMapping,
} from "./game-installer.js";
import type { GamePaths } from "./game-paths.js";

describe("InstallMapping<T>", () => {
  it("accepts any Base as the anchor when T is empty", () => {
    const entry = {} as InstallMapping;
    expectTypeOf(entry.anchor).toEqualTypeOf<Base>();
  });

  it("admits adaptor-declared anchor keys via T", () => {
    const entry = {} as InstallMapping<"saves" | "preferences">;
    expectTypeOf(entry.anchor).toEqualTypeOf<"saves" | "preferences" | Base>();
  });

  it("types source and destination as RelativePath", () => {
    const entry = {} as InstallMapping;
    expectTypeOf(entry.source).toEqualTypeOf<RelativePath>();
    expectTypeOf(entry.destination).toEqualTypeOf<RelativePath>();
  });
});

describe("IGameInstallerService", () => {
  it("exposes an install method taking context, paths, files", () => {
    expectTypeOf<IGameInstallerService["install"]>().parameters.toEqualTypeOf<
      [StorePathSnapshot, GamePaths, readonly RelativePath[]]
    >();
  });

  it("returns Promise<readonly InstallMapping[]>", () => {
    expectTypeOf<
      IGameInstallerService["install"]
    >().returns.resolves.toEqualTypeOf<readonly InstallMapping[]>();
  });

  it("threads T through to both paths and mappings", () => {
    type Svc = IGameInstallerService<"saves">;
    expectTypeOf<Svc["install"]>().parameters.toEqualTypeOf<
      [StorePathSnapshot, GamePaths<"saves">, readonly RelativePath[]]
    >();
    expectTypeOf<Svc["install"]>().returns.resolves.toEqualTypeOf<
      readonly InstallMapping<"saves">[]
    >();
  });
});
