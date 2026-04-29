import type { IAdaptorManifest } from "@nexusmods/adaptor-api";

import { adaptorName, pid, semVer, uri } from "@nexusmods/adaptor-api";
import { describe, expect, it } from "vitest";

import { AdaptorRegistry, NameService } from "./registry.js";

// --- NameService ---

describe("NameService", () => {
  it("resolves a registered name", () => {
    const ns = new NameService();
    ns.register(uri("vortex:host/ping"), pid("pid:1"));
    expect(ns.resolve(uri("vortex:host/ping"))).toBe("pid:1");
  });

  it("returns undefined for an unregistered name", () => {
    const ns = new NameService();
    expect(ns.resolve(uri("vortex:host/unknown"))).toBeUndefined();
  });

  it("unregisters a name", () => {
    const ns = new NameService();
    ns.register(uri("vortex:host/ping"), pid("pid:1"));
    ns.unregister(uri("vortex:host/ping"));
    expect(ns.resolve(uri("vortex:host/ping"))).toBeUndefined();
  });

  it("overwrites a previously registered name", () => {
    const ns = new NameService();
    ns.register(uri("vortex:host/ping"), pid("pid:1"));
    ns.register(uri("vortex:host/ping"), pid("pid:2"));
    expect(ns.resolve(uri("vortex:host/ping"))).toBe("pid:2");
  });

  it("handles multiple independent names", () => {
    const ns = new NameService();
    ns.register(uri("vortex:host/ping"), pid("pid:1"));
    ns.register(uri("vortex:adaptor/echo"), pid("pid:2"));
    expect(ns.resolve(uri("vortex:host/ping"))).toBe("pid:1");
    expect(ns.resolve(uri("vortex:adaptor/echo"))).toBe("pid:2");
  });
});

// --- AdaptorRegistry ---

function makeManifest(id: string, name: string): IAdaptorManifest {
  return {
    id: uri(id),
    name: adaptorName(name),
    version: semVer("0.1.0"),
    provides: [uri(`${id}/echo`)],
    requires: [],
  };
}

describe("AdaptorRegistry", () => {
  it("registers and retrieves an adaptor by PID", () => {
    const registry = new AdaptorRegistry();
    const manifest = makeManifest("vortex:adaptor/ping", "ping");
    registry.register(pid("pid:1"), manifest);
    expect(registry.get(pid("pid:1"))).toEqual({ pid: pid("pid:1"), manifest });
  });

  it("returns undefined for unknown PID", () => {
    const registry = new AdaptorRegistry();
    expect(registry.get(pid("pid:99"))).toBeUndefined();
  });

  it("lists all registered adaptors", () => {
    const registry = new AdaptorRegistry();
    registry.register(pid("pid:1"), makeManifest("vortex:adaptor/a", "a"));
    registry.register(pid("pid:2"), makeManifest("vortex:adaptor/b", "b"));
    const all = registry.list();
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.manifest.name)).toContain("a");
    expect(all.map((a) => a.manifest.name)).toContain("b");
  });

  it("unregisters an adaptor", () => {
    const registry = new AdaptorRegistry();
    registry.register(pid("pid:1"), makeManifest("vortex:adaptor/a", "a"));
    registry.unregister(pid("pid:1"));
    expect(registry.get(pid("pid:1"))).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });
});
