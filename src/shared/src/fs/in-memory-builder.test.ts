import { assert, describe, expect, it } from "vitest";

import { VortexError } from "../errors/base";
import { InMemoryFS } from "./in-memory";
import { Builder, TimeSeed } from "./in-memory-builder";
import { QualifiedPath } from "./paths";

function seedError(seed: () => void): VortexError {
  try {
    seed();
    return expect.unreachable("expected the seed call to throw");
  } catch (err) {
    assert(err instanceof VortexError, `expected VortexError, got: ${String(err)}`);
    return err;
  }
}

function fileContents(builder: Builder, path: QualifiedPath): Uint8Array {
  const lookup = builder.store.lookup(path);
  assert(lookup.ok, `expected '${path.value}' to be seeded`);
  const node = lookup.node;
  assert(node.type === "file", `expected '${path.value}' to be a file`);
  return node.contents;
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("Builder.file", () => {
  it("encodes text contents as UTF-8", () => {
    const builder = new Builder();

    builder.file(QualifiedPath.fromNative("/hello.txt"), {
      type: "text",
      data: "h\u00e9llo w\u00f6rld",
    });

    expect(decode(fileContents(builder, QualifiedPath.fromNative("/hello.txt")))).toBe(
      "h\u00e9llo w\u00f6rld",
    );
  });

  it("serializes json contents", () => {
    const builder = new Builder();
    const data = { modId: 42, tags: ["armor", "steel"] };

    builder.file(QualifiedPath.fromNative("/meta.json"), { type: "json", data });

    const parsed: unknown = JSON.parse(
      decode(fileContents(builder, QualifiedPath.fromNative("/meta.json"))),
    );
    expect(parsed).toEqual(data);
  });

  it("stores binary contents by reference", () => {
    const builder = new Builder();
    const bytes = new Uint8Array([1, 2, 3]);

    builder.file(QualifiedPath.fromNative("/data.bin"), { type: "binary", data: bytes });

    expect(fileContents(builder, QualifiedPath.fromNative("/data.bin"))).toBe(bytes);
  });

  it("creates missing parent directories on demand", () => {
    const builder = new Builder();

    builder.file(QualifiedPath.fromNative("/deep/nested/file.txt"), { type: "text", data: "x" });

    for (const path of ["/deep", "/deep/nested"]) {
      const lookup = builder.store.lookup(QualifiedPath.fromNative(path));
      assert(lookup.ok);
      expect(lookup.node.type).toBe("dir");
    }
    const file = builder.store.lookup(QualifiedPath.fromNative("/deep/nested/file.txt"));
    assert(file.ok);
    expect(file.node.type).toBe("file");
  });

  it("keeps the original basename casing", () => {
    const builder = new Builder();

    builder.file(QualifiedPath.fromNative("/Dir/File.TXT"), { type: "text", data: "x" });

    const lookup = builder.store.lookup(QualifiedPath.fromNative("/dir/file.txt"));
    assert(lookup.ok);
    const node = lookup.node;
    assert(node.type === "file");
    expect(node.name).toBe("File.TXT");
  });

  it("throws fs:already-exists on a duplicate seed", () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/data.txt"), { type: "text", data: "one" });

    const error = seedError(() =>
      builder.file(QualifiedPath.fromNative("/data.txt"), { type: "text", data: "two" }),
    );

    assert(error.data.kind === "fs:already-exists");
    expect(error.data.path).toBe("native:///data.txt");
  });

  it("throws fs:already-exists when the target path holds a directory", () => {
    const builder = new Builder();
    builder.dir(QualifiedPath.fromNative("/data"));

    const error = seedError(() =>
      builder.file(QualifiedPath.fromNative("/data"), { type: "text", data: "x" }),
    );
    expect(error.data.kind).toBe("fs:already-exists");
  });

  it("throws fs:not-a-directory when a file blocks the parent tree", () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" });

    const error = seedError(() =>
      builder.file(QualifiedPath.fromNative("/file.txt/child.txt"), { type: "text", data: "x" }),
    );
    expect(error.data.kind).toBe("fs:not-a-directory");
  });

  it("overrides individual timestamps from status", () => {
    const builder = new Builder();
    const modifiedTime = Temporal.Instant.from("2030-06-15T12:00:00Z");

    builder.file(
      QualifiedPath.fromNative("/timed.txt"),
      { type: "text", data: "x" },
      {
        modifiedTime,
      },
    );

    const lookup = builder.store.lookup(QualifiedPath.fromNative("/timed.txt"));
    assert(lookup.ok);
    const node = lookup.node;
    assert(node.type === "file");
    expect(node.times.modifiedTime).toBe(modifiedTime);
    expect(node.times.accessTime).toBe(TimeSeed);
  });
});

describe("Builder.dir", () => {
  it("reuses an existing directory and keeps its children", () => {
    const builder = new Builder();

    builder.dir(QualifiedPath.fromNative("/x"));
    builder.file(QualifiedPath.fromNative("/x/child.txt"), { type: "text", data: "x" });
    const before = builder.store.lookup(QualifiedPath.fromNative("/x"));
    assert(before.ok);

    builder.dir(QualifiedPath.fromNative("/x"));
    const after = builder.store.lookup(QualifiedPath.fromNative("/x"));
    assert(after.ok);
    expect(after.node).toBe(before.node);

    const child = builder.store.lookup(QualifiedPath.fromNative("/x/child.txt"));
    assert(child.ok);
    expect(child.node.type).toBe("file");
  });

  it("creates missing parents like file does", () => {
    const builder = new Builder();

    builder.dir(QualifiedPath.fromNative("/a/b"));

    const lookup = builder.store.lookup(QualifiedPath.fromNative("/a/b"));
    assert(lookup.ok);
    expect(lookup.node.type).toBe("dir");
  });
});

describe("Builder.build", () => {
  it("returns an InMemoryFS backed by the live store", () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/before.txt"), { type: "text", data: "x" });

    const fs = builder.build();
    expect(fs).toBeInstanceOf(InMemoryFS);

    builder.file(QualifiedPath.fromNative("/after.txt"), { type: "text", data: "x" });
    const lookup = builder.store.lookup(QualifiedPath.fromNative("/after.txt"));
    assert(lookup.ok);
    expect(lookup.node.type).toBe("file");
  });
});
