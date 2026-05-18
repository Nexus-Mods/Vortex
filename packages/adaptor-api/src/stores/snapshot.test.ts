import { describe, expect, expectTypeOf, it } from "vitest";

import { PathProviderError, QualifiedPath } from "../fs/paths";
import {
  Base,
  OS,
  Store,
  type LinuxStorePathProvider,
  type StorePathProvider,
  type StorePathSnapshot,
  type WindowsStorePathProvider,
} from "./providers.js";
import { createStorePathProvider } from "./snapshot.js";

function steamSnapshot(gameOS: OS = OS.Windows): StorePathSnapshot {
  const baseOS = OS.Linux;
  const gameBases = new Map<Base, QualifiedPath>([
    [Base.Game, QualifiedPath.parse("windows:///C/Games/Foo")],
    [Base.Home, QualifiedPath.parse("windows:///C/Users/me")],
    [Base.AppData, QualifiedPath.parse("windows:///C/Users/me/AppData")],
    [Base.Documents, QualifiedPath.parse("windows:///C/Users/me/Documents")],
  ]);
  const linuxBases = new Map<Base, QualifiedPath>([
    [Base.Game, QualifiedPath.parse("linux:///games/Foo")],
    [Base.Home, QualifiedPath.parse("linux:///home/me")],
    [Base.XdgData, QualifiedPath.parse("linux:///home/me/.local/share")],
  ]);
  return {
    store: Store.Steam,
    baseOS,
    gameOS,
    bases: new Map<OS, ReadonlyMap<Base, QualifiedPath>>([
      [OS.Windows, gameBases],
      [OS.Linux, linuxBases],
    ]),
  };
}

describe("createStorePathProvider", () => {
  it("exposes store and OS discriminators from the snapshot", () => {
    const provider = createStorePathProvider(steamSnapshot());
    expect(provider.store).toBe(Store.Steam);
    expect(provider.baseOS).toBe(OS.Linux);
    expect(provider.gameOS).toBe(OS.Windows);
  });

  it("resolves bases against gameOS by default", async () => {
    const provider = createStorePathProvider(steamSnapshot());
    const game = await provider.fromBase(Base.Game);
    expect(game.value).toBe("windows:///C/Games/Foo");
  });

  it("resolves against an explicit OS when asked", async () => {
    const provider = createStorePathProvider(steamSnapshot());
    const hostGame = await provider.fromBase(Base.Game, OS.Linux);
    expect(hostGame.value).toBe("linux:///games/Foo");
  });

  it("rejects when the base is absent for the requested OS", async () => {
    const provider = createStorePathProvider(steamSnapshot());
    // XdgData is a Linux base, not present under Windows gameOS
    await expect(provider.fromBase(Base.XdgData as never)).rejects.toBeInstanceOf(
      PathProviderError,
    );
    await expect(provider.fromBase(Base.Documents as never, OS.Linux)).rejects.toBeInstanceOf(
      PathProviderError,
    );
  });

  it("rejects when the OS has no bases resolved", async () => {
    const snapshot: StorePathSnapshot = {
      store: Store.GOG,
      baseOS: OS.Windows,
      gameOS: OS.Windows,
      bases: new Map<OS, ReadonlyMap<Base, QualifiedPath>>([
        [
          OS.Windows,
          new Map<Base, QualifiedPath>([
            [Base.Game, QualifiedPath.parse("windows:///C/Games/Bar")],
          ]),
        ],
      ]),
    };
    const provider = createStorePathProvider(snapshot);
    await expect(provider.fromBase(Base.Game, OS.Linux)).rejects.toBeInstanceOf(PathProviderError);
  });

  it("reparses QualifiedPaths that crossed an IPC boundary (no prototype)", async () => {
    const snapshot = steamSnapshot();
    // Simulate structuredClone's prototype-stripping on the bases values.
    const stripped: StorePathSnapshot = {
      ...snapshot,
      bases: new Map(
        Array.from(snapshot.bases, ([os, inner]) => [
          os,
          new Map(
            Array.from(inner, ([base, qp]) => [
              base,
              {
                value: qp.value,
                scheme: qp.scheme,
                data: qp.data,
                path: qp.path,
              } as unknown as QualifiedPath,
            ]),
          ),
        ]),
      ),
    };
    expect(stripped.bases.get(OS.Windows)?.get(Base.Game)).not.toBeInstanceOf(QualifiedPath);

    const provider = createStorePathProvider(stripped);
    const game = await provider.fromBase(Base.Game);
    expect(game).toBeInstanceOf(QualifiedPath);
    expect(game.value).toBe("windows:///C/Games/Foo");
  });

  it("hands back real QualifiedPath instances when the snapshot already has them", async () => {
    const snapshot = steamSnapshot();
    const provider = createStorePathProvider(snapshot);
    const game = await provider.fromBase(Base.Game);
    expect(game).toBeInstanceOf(QualifiedPath);
  });
});

describe("isWindows discriminant", () => {
  it("returns isWindows: true when gameOS is Windows", () => {
    const provider = createStorePathProvider(steamSnapshot(OS.Windows));
    expect(provider.isWindows).toBe(true);
    expect(provider.gameOS).toBe(OS.Windows);
  });

  it("returns isWindows: false when gameOS is Linux", () => {
    const provider = createStorePathProvider(steamSnapshot(OS.Linux));
    expect(provider.isWindows).toBe(false);
    expect(provider.gameOS).toBe(OS.Linux);
  });

  it("narrows to WindowsStorePathProvider when isWindows is checked", () => {
    const provider: StorePathProvider = createStorePathProvider(steamSnapshot(OS.Windows));
    if (provider.isWindows) {
      expectTypeOf(provider).toEqualTypeOf<WindowsStorePathProvider>();
    } else {
      expectTypeOf(provider).toEqualTypeOf<LinuxStorePathProvider>();
    }
  });
});
