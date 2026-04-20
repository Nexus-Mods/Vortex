import type { PathResolver, ResolvedPath } from "@vortex/fs";

import { PathResolverError, QualifiedPath } from "@vortex/fs";
import { describe, expect, it } from "vitest";

import { PathResolverRegistryImpl } from "./path-resolver-registry";

function mkResolver(scheme: string, prefix: string): PathResolver {
  return {
    scheme,
    parent: null,
    resolve(path: QualifiedPath): Promise<ResolvedPath> {
      if (path.scheme !== scheme) {
        return Promise.reject(
          new PathResolverError(`Unsupported scheme '${path.scheme}'`),
        );
      }
      return Promise.resolve(`${prefix}${path.path}`);
    },
  };
}

describe("PathResolverRegistryImpl", () => {
  it("dispatches resolve() to the resolver registered for the scheme", async () => {
    const registry = new PathResolverRegistryImpl([
      mkResolver("linux", "/linux"),
      mkResolver("windows", "C:/windows"),
    ]);

    const linuxResolved = await registry.resolve(
      QualifiedPath.parse("linux:///home/alice"),
    );
    expect(linuxResolved).toBe("/linux/home/alice");

    const winResolved = await registry.resolve(
      QualifiedPath.parse("windows://C:/Users/alice"),
    );
    expect(winResolved).toBe("C:/windowsC:/Users/alice");
  });

  it("rejects with PathResolverError when no resolver is registered for the scheme", async () => {
    const registry = new PathResolverRegistryImpl([mkResolver("linux", "/")]);
    await expect(
      registry.resolve(QualifiedPath.parse("steam://SteamApps/common/Skyrim")),
    ).rejects.toBeInstanceOf(PathResolverError);
  });

  it("register() overwrites any prior resolver for the same scheme", async () => {
    const registry = new PathResolverRegistryImpl([
      mkResolver("linux", "/first"),
    ]);
    registry.register(mkResolver("linux", "/second"));

    const resolved = await registry.resolve(QualifiedPath.parse("linux:///x"));
    expect(resolved).toBe("/second/x");
  });

  it("get() returns the registered resolver or undefined", () => {
    const linux = mkResolver("linux", "/");
    const registry = new PathResolverRegistryImpl([linux]);
    expect(registry.get("linux")).toBe(linux);
    expect(registry.get("windows")).toBeUndefined();
  });

  it("accepts resolvers via register() when constructed empty", async () => {
    const registry = new PathResolverRegistryImpl();
    registry.register(mkResolver("linux", ""));
    expect(await registry.resolve(QualifiedPath.parse("linux:///a"))).toBe(
      "/a",
    );
  });
});
