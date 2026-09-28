import { InMemoryFS, QualifiedPath } from "@vortex/shared/filesystem";
import type { Api } from "@vortex/shared/preload";
import { beforeEach, describe, expect, it, vi, assert } from "vitest";

import { installInMemoryFS } from "./fsApi";

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const setApi = (api: unknown): void => {
  (window as unknown as { api?: unknown }).api = api;
};

const getApi = (): unknown => (window as unknown as { api?: unknown }).api;

describe("installInMemoryFS", () => {
  beforeEach(() => {
    setApi(undefined);
  });
  it("installs an in-memory filesystem on window.api.fs", () => {
    const { fs } = installInMemoryFS();

    expect(window.api.fs).toBe(fs);
    expect(fs).toBeInstanceOf(InMemoryFS);
  });

  it("seeds the filesystem through the builder", async () => {
    const { fs } = installInMemoryFS((builder) =>
      builder.file(QualifiedPath.fromNative("/data.txt"), { type: "text", data: "hello" }),
    );

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/data.txt")))).toBe("hello");
  });

  it("exposes the seeded filesystem through window.api.fs", async () => {
    installInMemoryFS((builder) =>
      builder.file(QualifiedPath.fromNative("/data.txt"), { type: "text", data: "hello" }),
    );

    const stat = await window.api.fs.stat(QualifiedPath.fromNative("/data.txt"));
    assert(stat.exists);
    assert(stat.isFile);
  });

  it("restores the previous window.api.fs", () => {
    const sentinel = { stat: vi.fn() };
    setApi({ fs: sentinel } as unknown as Api);

    const { restore } = installInMemoryFS();
    expect(window.api.fs).not.toBe(sentinel);

    restore();
    expect(window.api.fs).toBe(sentinel);
  });

  it("removes window.api when there was none", () => {
    expect(getApi()).toBeUndefined();

    const { restore } = installInMemoryFS();
    expect(getApi()).toBeDefined();

    restore();
    expect(getApi()).toBeUndefined();
  });
});
