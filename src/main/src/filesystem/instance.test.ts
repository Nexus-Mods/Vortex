import { InMemoryFS, InMemoryFSBuilder, QualifiedPath } from "@vortex/shared/filesystem";
import { beforeEach, describe, expect, it, assert } from "vitest";

import { getFileSystem, initFileSystem, resetFileSystem, setFileSystem } from "./instance";

const build = (seed: (builder: InMemoryFSBuilder) => void): InMemoryFS => {
  const builder = new InMemoryFSBuilder();
  seed(builder);
  return builder.build();
};

describe("filesystem instance", () => {
  beforeEach(() => {
    resetFileSystem();
  });

  it("throws when read before initialization", () => {
    expect(() => getFileSystem()).toThrow("Filesystem is not initialized");
  });

  it("returns the initialized filesystem", () => {
    const fs = build(() => undefined);
    initFileSystem(fs);

    expect(getFileSystem()).toBe(fs);
  });

  it("rejects double initialization", () => {
    initFileSystem(build(() => undefined));

    expect(() => initFileSystem(build(() => undefined))).toThrow(
      "Filesystem is already initialized",
    );
  });

  it("swaps the instance without the initialized guard", () => {
    const first = build(() => undefined);
    const second = build(() => undefined);
    initFileSystem(first);

    setFileSystem(second);

    expect(getFileSystem()).toBe(second);
  });

  it("serves an in-memory filesystem through getFileSystem", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/data.txt"), { type: "text", data: "hello" }),
    );
    setFileSystem(fs);

    expect(getFileSystem()).toBeInstanceOf(InMemoryFS);

    await fs.createDirectory(QualifiedPath.fromNative("/dir"));
    await fs.writeFile(QualifiedPath.fromNative("/dir/data.txt"), new TextEncoder().encode("two"));

    const stat = await fs.stat(QualifiedPath.fromNative("/dir/data.txt"));
    assert(stat.exists);
    assert(stat.isFile);
  });
});
