import { assert, describe, expect, it } from "vitest";

import { VortexError } from "../errors/base";
import { InMemoryFS } from "./in-memory";
import { Builder, TimeSeed } from "./in-memory-builder";
import { QualifiedPath } from "./paths";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

function build(seed: (builder: Builder) => void): InMemoryFS {
  const builder = new Builder();
  seed(builder);
  return builder.build();
}

async function fsError(promise: Promise<unknown>): Promise<VortexError> {
  try {
    await promise;
    return expect.unreachable("expected the fs call to reject");
  } catch (err) {
    assert(err instanceof VortexError, `expected VortexError, got: ${String(err)}`);
    return err;
  }
}

async function collect<T>(iterator: AsyncIterator<T, undefined>): Promise<T[]> {
  const entries: T[] = [];
  let result = await iterator.next();
  while (!result.done) {
    entries.push(result.value);
    result = await iterator.next();
  }
  return entries;
}

async function readAll(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry,
  );
}

function seedLink(builder: Builder, path: QualifiedPath, target: QualifiedPath): void {
  const ensure = builder.store.ensureDirectory(path.parent());
  assert(ensure.ok, `seed failed: ${stringify(ensure)}`);
  const attach = builder.store.attach(path, {
    type: "symlink",
    id: builder.store.nextId(),
    name: path.basename,
    times: {
      accessTime: TimeSeed,
      modifiedTime: TimeSeed,
      changeTime: TimeSeed,
      creationTime: TimeSeed,
    },
    target,
  });
  assert(attach.ok, `seed failed: ${stringify(attach)}`);
}

describe("InMemoryFS.readFile", () => {
  it("reads seeded text and binary contents", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/text.txt"), { type: "text", data: "hello" });
      builder.file(QualifiedPath.fromNative("/data.bin"), {
        type: "binary",
        data: new Uint8Array([1, 2, 3]),
      });
    });

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/text.txt")))).toBe("hello");
    expect(await fs.readFile(QualifiedPath.fromNative("/data.bin"))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("rejects with fs:not-found for a missing path", async () => {
    const fs = build(() => undefined);

    const error = await fsError(fs.readFile(QualifiedPath.fromNative("/missing.txt")));
    assert(error.data.kind === "fs:not-found");
    expect(error.data.path).toBe("native:///missing.txt");
  });

  it("rejects with fs:not-a-file when the path is a directory", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const error = await fsError(fs.readFile(QualifiedPath.fromNative("/dir")));
    expect(error.data.kind).toBe("fs:not-a-file");
  });

  it("rejects with fs:not-a-directory when a file blocks the walk", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" }),
    );

    const error = await fsError(fs.readFile(QualifiedPath.fromNative("/file.txt/child.txt")));
    expect(error.data.kind).toBe("fs:not-a-directory");
  });

  it("reads through a symlink", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/link")))).toBe("hello");
  });
});

describe("InMemoryFS.writeFile", () => {
  it("creates a file under an existing parent", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    await fs.writeFile(QualifiedPath.fromNative("/dir/new.txt"), encode("data"));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/new.txt")))).toBe("data");
  });

  it("overwrites an existing file in place, preserving identity", async () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/f.txt"), { type: "text", data: "one" });
    const before = builder.store.lookup(QualifiedPath.fromNative("/f.txt"));
    assert(before.ok);
    const beforeNode = before.node;
    const fs = builder.build();

    await fs.writeFile(QualifiedPath.fromNative("/f.txt"), encode("two"));

    const after = builder.store.lookup(QualifiedPath.fromNative("/f.txt"));
    assert(after.ok);
    expect(after.node).toBe(beforeNode);
    const node = after.node;
    assert(node.type === "file");
    expect(decode(node.contents)).toBe("two");
  });

  it("rejects with fs:not-found when the parent is missing", async () => {
    const fs = build(() => undefined);

    const error = await fsError(
      fs.writeFile(QualifiedPath.fromNative("/missing/new.txt"), encode("x")),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:not-a-directory when the parent is a file", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" }),
    );

    const error = await fsError(
      fs.writeFile(QualifiedPath.fromNative("/file.txt/child.txt"), encode("x")),
    );
    expect(error.data.kind).toBe("fs:not-a-directory");
  });

  it("rejects with fs:not-a-file when the target is a directory", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const error = await fsError(fs.writeFile(QualifiedPath.fromNative("/dir"), encode("x")));
    expect(error.data.kind).toBe("fs:not-a-file");
  });

  it("writes through a symlink to its target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "one" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    await fs.writeFile(QualifiedPath.fromNative("/link"), encode("two"));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/target/data.txt")))).toBe("two");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/link")))).toBe("two");
  });

  it("creates the target of a dangling symlink", async () => {
    const builder = new Builder();
    builder.dir(QualifiedPath.fromNative("/target"));
    seedLink(
      builder,
      QualifiedPath.fromNative("/link"),
      QualifiedPath.fromNative("/target/missing.txt"),
    );
    const fs = builder.build();

    await fs.writeFile(QualifiedPath.fromNative("/link"), encode("created"));

    const link = builder.store.lookup(QualifiedPath.fromNative("/link"), { parseSymLink: true });
    assert(link.ok);
    expect(link.node.type).toBe("symlink");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/target/missing.txt")))).toBe(
      "created",
    );
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/link")))).toBe("created");
  });
});

describe("InMemoryFS.stat", () => {
  it("stats files with their size and directories without", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/"));
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "hello" });
      builder.dir(QualifiedPath.fromNative("/sub"));
    });

    const fileStat = await fs.stat(QualifiedPath.fromNative("/file.txt"));
    assert(fileStat.exists);
    assert(fileStat.isFile);
    expect(fileStat.size).toBe(5);
    expect(fileStat.isSymLink).toBe(false);

    const dirStat = await fs.stat(QualifiedPath.fromNative("/sub"));
    assert(dirStat.exists);
    assert(!dirStat.isFile);

    const rootStat = await fs.stat(QualifiedPath.fromNative("/"));
    assert(rootStat.exists);
    assert(!rootStat.isFile);
  });

  it("reports exists:false for a missing path", async () => {
    const fs = build(() => undefined);

    expect(await fs.stat(QualifiedPath.fromNative("/missing.txt"))).toEqual({ exists: false });
  });

  it("stats through a symlink, following it by default", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    const stat = await fs.stat(QualifiedPath.fromNative("/link"));
    assert(stat.exists);
    assert(stat.isFile);
    expect(stat.size).toBe(5);
    expect(stat.isSymLink).toBe(false);
  });

  it("reports the link itself with parseSymLink", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    const stat = await fs.stat(QualifiedPath.fromNative("/link"), { parseSymLink: true });
    assert(stat.exists);
    assert(stat.isSymLink);
    assert(stat.isFile);
    expect(stat.symLinkData.accessTime).toBe(TimeSeed);
    expect(stat.size).toBe(5);
  });

  it("reports exists:false for a dangling symlink with parseSymLink", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/target"));
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/missing.txt"),
      );
    });

    expect(await fs.stat(QualifiedPath.fromNative("/link"), { parseSymLink: true })).toEqual({
      exists: false,
    });
  });
});

describe("InMemoryFS.createDirectory", () => {
  it("creates all missing parents in one call", async () => {
    const fs = build(() => undefined);

    await fs.createDirectory(QualifiedPath.fromNative("/a/b/c"));

    const stat = await fs.stat(QualifiedPath.fromNative("/a/b/c"));
    assert(stat.exists);
    assert(!stat.isFile);
  });

  it("reuses an existing directory", async () => {
    const builder = new Builder();
    builder.dir(QualifiedPath.fromNative("/dir"));
    builder.file(QualifiedPath.fromNative("/dir/child.txt"), { type: "text", data: "x" });
    const before = builder.store.lookup(QualifiedPath.fromNative("/dir"));
    assert(before.ok);
    const fs = builder.build();

    await fs.createDirectory(QualifiedPath.fromNative("/dir"));

    const after = builder.store.lookup(QualifiedPath.fromNative("/dir"));
    assert(after.ok);
    expect(after.node).toBe(before.node);
    const child = builder.store.lookup(QualifiedPath.fromNative("/dir/child.txt"));
    assert(child.ok);
    expect(child.node.type).toBe("file");
  });

  it("rejects with fs:not-a-directory when a file blocks the walk", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" }),
    );

    const error = await fsError(fs.createDirectory(QualifiedPath.fromNative("/file.txt/sub")));
    assert(error.data.kind === "fs:not-a-directory");
    expect(error.data.path).toBe("native:///file.txt/sub");
  });

  it("rejects with fs:not-a-directory when the target is a file", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/dir"));
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
    });

    const error = await fsError(fs.createDirectory(QualifiedPath.fromNative("/dir/data.txt")));
    expect(error.data.kind).toBe("fs:not-a-directory");
  });

  it("creates unknown store roots on demand", async () => {
    const fs = build(() => undefined);

    await fs.createDirectory(QualifiedPath.fromNative("C:/data/sub"));

    const stat = await fs.stat(QualifiedPath.fromNative("C:/data/sub"));
    assert(stat.exists);
    assert(!stat.isFile);
  });

  it("follows symlink components and creates inside the target", async () => {
    const builder = new Builder();
    builder.dir(QualifiedPath.fromNative("/target"));
    seedLink(builder, QualifiedPath.fromNative("/a/link"), QualifiedPath.fromNative("/target"));
    const fs = builder.build();

    await fs.createDirectory(QualifiedPath.fromNative("/a/link/sub"));

    const stat = await fs.stat(QualifiedPath.fromNative("/target/sub"));
    assert(stat.exists);
    assert(!stat.isFile);
  });
});

describe("InMemoryFS.delete", () => {
  it("removes a file", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" }),
    );

    await fs.delete(QualifiedPath.fromNative("/file.txt"));

    expect(await fs.stat(QualifiedPath.fromNative("/file.txt"))).toEqual({ exists: false });
  });

  it("rejects with fs:directory-not-empty for a non-empty directory", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/dir"));
      builder.file(QualifiedPath.fromNative("/dir/child.txt"), { type: "text", data: "x" });
    });

    const error = await fsError(fs.delete(QualifiedPath.fromNative("/dir")));
    assert(error.data.kind === "fs:directory-not-empty");
    expect(error.data.path).toBe("native:///dir");
  });

  it("removes an empty directory", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    await fs.delete(QualifiedPath.fromNative("/dir"));

    expect(await fs.stat(QualifiedPath.fromNative("/dir"))).toEqual({ exists: false });
  });

  it("rejects with fs:not-found for a missing path", async () => {
    const fs = build(() => undefined);

    const error = await fsError(fs.delete(QualifiedPath.fromNative("/missing.txt")));
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("removes a symlink itself, not its target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    await fs.delete(QualifiedPath.fromNative("/link"));

    expect(await fs.stat(QualifiedPath.fromNative("/link"))).toEqual({ exists: false });
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/target/data.txt")))).toBe("hello");
  });
});

describe("InMemoryFS.deleteRecursive", () => {
  it("removes a whole subtree", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/dir"));
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/dir/nested"));
      builder.file(QualifiedPath.fromNative("/dir/nested/deep.txt"), { type: "text", data: "x" });
      builder.file(QualifiedPath.fromNative("/other.txt"), { type: "text", data: "x" });
    });

    await fs.deleteRecursive(QualifiedPath.fromNative("/dir"));

    expect(await fs.stat(QualifiedPath.fromNative("/dir"))).toEqual({ exists: false });
    expect(await fs.stat(QualifiedPath.fromNative("/dir/data.txt"))).toEqual({ exists: false });
    expect(await fs.stat(QualifiedPath.fromNative("/dir/nested/deep.txt"))).toEqual({
      exists: false,
    });
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/other.txt")))).toBe("x");
  });

  it("removes a single file", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" }),
    );

    await fs.deleteRecursive(QualifiedPath.fromNative("/file.txt"));

    expect(await fs.stat(QualifiedPath.fromNative("/file.txt"))).toEqual({ exists: false });
  });

  it("rejects with fs:not-found for a missing path", async () => {
    const fs = build(() => undefined);

    const error = await fsError(fs.deleteRecursive(QualifiedPath.fromNative("/missing")));
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:invalid-path for a store root", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/")));

    const error = await fsError(fs.deleteRecursive(QualifiedPath.fromNative("/")));
    expect(error.data.kind).toBe("fs:invalid-path");
  });

  it("removes a symlink itself, not its target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    await fs.deleteRecursive(QualifiedPath.fromNative("/link"));

    expect(await fs.stat(QualifiedPath.fromNative("/link"))).toEqual({ exists: false });
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/target/data.txt")))).toBe("hello");
  });
});

describe("InMemoryFS.copy", () => {
  it("copies a file", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/source.txt"), { type: "text", data: "hello" }),
    );

    await fs.copy(QualifiedPath.fromNative("/source.txt"), QualifiedPath.fromNative("/dest.txt"));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/source.txt")))).toBe("hello");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dest.txt")))).toBe("hello");
  });

  it("deep-clones directories with fresh nodes and copied contents", async () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/src/Dir/File.TXT"), { type: "text", data: "one" });
    const fs = builder.build();

    await fs.copy(QualifiedPath.fromNative("/src"), QualifiedPath.fromNative("/dst"));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dst/Dir/File.TXT")))).toBe("one");

    await fs.writeFile(QualifiedPath.fromNative("/src/Dir/File.TXT"), encode("changed"));
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dst/Dir/File.TXT")))).toBe("one");

    const sourceLookup = builder.store.lookup(QualifiedPath.fromNative("/src/Dir/File.TXT"));
    assert(sourceLookup.ok);
    const targetLookup = builder.store.lookup(QualifiedPath.fromNative("/dst/Dir/File.TXT"));
    assert(targetLookup.ok);
    const sourceNode = sourceLookup.node;
    const targetNode = targetLookup.node;
    assert(sourceNode.type === "file");
    assert(targetNode.type === "file");
    expect(targetNode).not.toBe(sourceNode);
    expect(targetNode.id).not.toBe(sourceNode.id);
  });

  it("rejects with fs:not-found for a missing source", async () => {
    const fs = build(() => undefined);

    const error = await fsError(
      fs.copy(QualifiedPath.fromNative("/missing.txt"), QualifiedPath.fromNative("/dest.txt")),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:already-exists for an occupied target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/source.txt"), { type: "text", data: "one" });
      builder.file(QualifiedPath.fromNative("/dest.txt"), { type: "text", data: "two" });
    });

    const error = await fsError(
      fs.copy(QualifiedPath.fromNative("/source.txt"), QualifiedPath.fromNative("/dest.txt")),
    );
    expect(error.data.kind).toBe("fs:already-exists");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dest.txt")))).toBe("two");
  });

  it("replaces an occupied target with overwrite", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/source.txt"), { type: "text", data: "one" });
      builder.file(QualifiedPath.fromNative("/dest.txt"), { type: "text", data: "two" });
    });

    await fs.copy(QualifiedPath.fromNative("/source.txt"), QualifiedPath.fromNative("/dest.txt"), {
      overwrite: true,
    });

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dest.txt")))).toBe("one");
  });

  it("replaces an occupied directory wholesale with overwrite", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/src"));
      builder.file(QualifiedPath.fromNative("/src/data.txt"), { type: "text", data: "one" });
      builder.dir(QualifiedPath.fromNative("/dst"));
      builder.file(QualifiedPath.fromNative("/dst/old.txt"), { type: "text", data: "two" });
    });

    await fs.copy(QualifiedPath.fromNative("/src"), QualifiedPath.fromNative("/dst"), {
      overwrite: true,
    });

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dst/data.txt")))).toBe("one");
    expect(await fs.stat(QualifiedPath.fromNative("/dst/old.txt"))).toEqual({ exists: false });
  });

  it("copies the target of a symlink source", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    await fs.copy(QualifiedPath.fromNative("/link"), QualifiedPath.fromNative("/copy.txt"));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/copy.txt")))).toBe("hello");
  });
});

describe("InMemoryFS.move", () => {
  it("moves a file and renames it", async () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/one/data.txt"), { type: "text", data: "hello" });
    builder.dir(QualifiedPath.fromNative("/two"));
    const fs = builder.build();

    await fs.move(
      QualifiedPath.fromNative("/one/data.txt"),
      QualifiedPath.fromNative("/two/renamed.txt"),
    );

    expect(await fs.stat(QualifiedPath.fromNative("/one/data.txt"))).toEqual({ exists: false });
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/two/renamed.txt")))).toBe("hello");
    const lookup = builder.store.lookup(QualifiedPath.fromNative("/two/renamed.txt"));
    assert(lookup.ok);
    expect(lookup.node.name).toBe("renamed.txt");
  });

  it("moves a directory with its children", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/one/sub"));
      builder.file(QualifiedPath.fromNative("/one/sub/data.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/two"));
    });

    await fs.move(QualifiedPath.fromNative("/one/sub"), QualifiedPath.fromNative("/two/sub"));

    expect(await fs.stat(QualifiedPath.fromNative("/one/sub"))).toEqual({ exists: false });
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/two/sub/data.txt")))).toBe("x");
  });

  it("rejects with fs:not-found for a missing source", async () => {
    const fs = build(() => undefined);

    const error = await fsError(
      fs.move(QualifiedPath.fromNative("/missing.txt"), QualifiedPath.fromNative("/dest.txt")),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:not-found for a missing target parent", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/source.txt"), { type: "text", data: "one" }),
    );

    const error = await fsError(
      fs.move(
        QualifiedPath.fromNative("/source.txt"),
        QualifiedPath.fromNative("/missing/dest.txt"),
      ),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:already-exists for an occupied target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/one.txt"), { type: "text", data: "one" });
      builder.file(QualifiedPath.fromNative("/two.txt"), { type: "text", data: "two" });
    });

    const error = await fsError(
      fs.move(QualifiedPath.fromNative("/one.txt"), QualifiedPath.fromNative("/two.txt")),
    );
    expect(error.data.kind).toBe("fs:already-exists");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/one.txt")))).toBe("one");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/two.txt")))).toBe("two");
  });

  it("replaces an occupied target with overwrite", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/one.txt"), { type: "text", data: "one" });
      builder.file(QualifiedPath.fromNative("/two.txt"), { type: "text", data: "two" });
    });

    await fs.move(QualifiedPath.fromNative("/one.txt"), QualifiedPath.fromNative("/two.txt"), {
      overwrite: true,
    });

    expect(await fs.stat(QualifiedPath.fromNative("/one.txt"))).toEqual({ exists: false });
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/two.txt")))).toBe("one");
  });

  it("moves a symlink itself, not its target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    await fs.move(QualifiedPath.fromNative("/link"), QualifiedPath.fromNative("/moved.txt"));

    expect(await fs.stat(QualifiedPath.fromNative("/link"))).toEqual({ exists: false });
    const linkStat = await fs.stat(QualifiedPath.fromNative("/moved.txt"), {
      parseSymLink: true,
    });
    assert(linkStat.exists);
    assert(linkStat.isSymLink);
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/moved.txt")))).toBe("hello");
  });

  it("rejects with fs:invalid-path for a store root", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/")));

    const error = await fsError(
      fs.move(QualifiedPath.fromNative("/"), QualifiedPath.fromNative("/x")),
    );
    expect(error.data.kind).toBe("fs:invalid-path");
  });
});

describe("InMemoryFS.createLink", () => {
  it("hardlinks share identity and content", async () => {
    const builder = new Builder();
    builder.file(QualifiedPath.fromNative("/original/data.txt"), { type: "text", data: "one" });
    builder.dir(QualifiedPath.fromNative("/other"));
    const fs = builder.build();

    await fs.createLink(
      QualifiedPath.fromNative("/original/data.txt"),
      QualifiedPath.fromNative("/other/data.txt"),
      "hardlink",
    );

    const from = builder.store.lookup(QualifiedPath.fromNative("/original/data.txt"));
    assert(from.ok);
    const to = builder.store.lookup(QualifiedPath.fromNative("/other/data.txt"));
    assert(to.ok);
    expect(to.node).toBe(from.node);

    await fs.writeFile(QualifiedPath.fromNative("/other/data.txt"), encode("changed"));
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/original/data.txt")))).toBe(
      "changed",
    );
  });

  it("rejects with fs:not-found for a missing hardlink source", async () => {
    const fs = build(() => undefined);

    const error = await fsError(
      fs.createLink(
        QualifiedPath.fromNative("/missing.txt"),
        QualifiedPath.fromNative("/link.txt"),
        "hardlink",
      ),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:already-exists for an occupied target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/one.txt"), { type: "text", data: "one" });
      builder.file(QualifiedPath.fromNative("/two.txt"), { type: "text", data: "two" });
    });

    const error = await fsError(
      fs.createLink(
        QualifiedPath.fromNative("/one.txt"),
        QualifiedPath.fromNative("/two.txt"),
        "hardlink",
      ),
    );
    expect(error.data.kind).toBe("fs:already-exists");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/two.txt")))).toBe("two");
  });

  it("rejects with fs:not-found for a missing target parent", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/one.txt"), { type: "text", data: "one" }),
    );

    const error = await fsError(
      fs.createLink(
        QualifiedPath.fromNative("/one.txt"),
        QualifiedPath.fromNative("/missing/link.txt"),
        "hardlink",
      ),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("creates dangling symlinks", async () => {
    const builder = new Builder();
    builder.dir(QualifiedPath.fromNative("/dir"));
    const fs = builder.build();

    await fs.createLink(
      QualifiedPath.fromNative("/target/missing.txt"),
      QualifiedPath.fromNative("/dir/link"),
      "symlink",
    );

    const link = builder.store.lookup(QualifiedPath.fromNative("/dir/link"), {
      parseSymLink: true,
    });
    assert(link.ok);
    const node = link.node;
    assert(node.type === "symlink");
    expect(node.target.value).toBe("native:///target/missing.txt");

    expect(await fs.stat(QualifiedPath.fromNative("/dir/link"), { parseSymLink: true })).toEqual({
      exists: false,
    });

    const error = await fsError(fs.readFile(QualifiedPath.fromNative("/dir/link")));
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("symlinks resolve their target for reads", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      builder.dir(QualifiedPath.fromNative("/dir"));
    });

    await fs.createLink(
      QualifiedPath.fromNative("/target/data.txt"),
      QualifiedPath.fromNative("/dir/link"),
      "symlink",
    );

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/link")))).toBe("hello");
    const stat = await fs.stat(QualifiedPath.fromNative("/dir/link"));
    assert(stat.exists);
    assert(stat.isFile);
    expect(stat.isSymLink).toBe(false);
  });

  it("rejects with fs:already-exists for an occupied symlink target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/one.txt"), { type: "text", data: "one" });
      builder.file(QualifiedPath.fromNative("/two.txt"), { type: "text", data: "two" });
    });

    const error = await fsError(
      fs.createLink(
        QualifiedPath.fromNative("/one.txt"),
        QualifiedPath.fromNative("/two.txt"),
        "symlink",
      ),
    );
    expect(error.data.kind).toBe("fs:already-exists");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/two.txt")))).toBe("two");
  });
});

describe("InMemoryFS.enumerateDirectory", () => {
  it("yields every direct child", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      builder.file(QualifiedPath.fromNative("/dir/other.bin"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/dir/sub"));
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"));
    const paths = await collect(iterator);

    expect(paths.map((path) => path.value).toSorted()).toEqual([
      "native:///dir/data.txt",
      "native:///dir/other.bin",
      "native:///dir/sub",
    ]);
  });

  it("filters by types", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/dir/sub"));
    });

    const files = await collect(
      await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), { types: "files" }),
    );
    expect(files.map((path) => path.value)).toEqual(["native:///dir/data.txt"]);

    const directories = await collect(
      await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), { types: "directories" }),
    );
    expect(directories.map((path) => path.value)).toEqual(["native:///dir/sub"]);
  });

  it("excludes symlinks from both types filters", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/dir/sub"));
      seedLink(
        builder,
        QualifiedPath.fromNative("/dir/link"),
        QualifiedPath.fromNative("/dir/data.txt"),
      );
    });

    const files = await collect(
      await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), { types: "files" }),
    );
    expect(files.map((path) => path.value)).toEqual(["native:///dir/data.txt"]);

    const directories = await collect(
      await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), { types: "directories" }),
    );
    expect(directories.map((path) => path.value)).toEqual(["native:///dir/sub"]);
  });

  it("matches include against the full path value", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      builder.file(QualifiedPath.fromNative("/dir/other.bin"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/dir/sub"));
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), {
      include: "*data.txt",
    });
    const paths = await collect(iterator);

    expect(paths.map((path) => path.value)).toEqual(["native:///dir/data.txt"]);
  });

  it("matches exclude against the full path value", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      builder.file(QualifiedPath.fromNative("/dir/other.bin"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/dir/sub"));
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), {
      exclude: "*.txt",
    });
    const paths = await collect(iterator);

    expect(paths.map((path) => path.value).toSorted()).toEqual([
      "native:///dir/other.bin",
      "native:///dir/sub",
    ]);
  });

  it("yields descendants after their directory in pre-order", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/root/a.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/root/sub"));
      builder.file(QualifiedPath.fromNative("/root/sub/b.txt"), { type: "text", data: "x" });
      builder.file(QualifiedPath.fromNative("/root/c.txt"), { type: "text", data: "x" });
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/root"), {
      recursive: true,
    });
    const paths = await collect(iterator);

    expect(paths.map((path) => path.value).toSorted()).toEqual([
      "native:///root/a.txt",
      "native:///root/c.txt",
      "native:///root/sub",
      "native:///root/sub/b.txt",
    ]);

    const positions = new Map(paths.map((path, index) => [path.value, index]));
    const subIndex = positions.get("native:///root/sub");
    const childIndex = positions.get("native:///root/sub/b.txt");
    assert(subIndex !== undefined);
    assert(childIndex !== undefined);
    expect(childIndex).toBeGreaterThan(subIndex);
  });

  it("descends include-mismatched directories when recursive", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/root/data.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/root/sub"));
      builder.file(QualifiedPath.fromNative("/root/sub/more.txt"), { type: "text", data: "x" });
      builder.dir(QualifiedPath.fromNative("/root/sub/inner"));
      builder.file(QualifiedPath.fromNative("/root/sub/inner/deep.txt"), {
        type: "text",
        data: "x",
      });
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/root"), {
      recursive: true,
      include: "*.txt",
    });
    const paths = await collect(iterator);

    expect(paths.map((path) => path.value).toSorted()).toEqual([
      "native:///root/data.txt",
      "native:///root/sub/inner/deep.txt",
      "native:///root/sub/more.txt",
    ]);
  });

  it("yields [path, status] with includeStatus true, following links", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "hello" });
      builder.dir(QualifiedPath.fromNative("/dir/sub"));
      seedLink(
        builder,
        QualifiedPath.fromNative("/dir/link"),
        QualifiedPath.fromNative("/dir/data.txt"),
      );
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), {
      includeStatus: true,
    });
    const entries = await collect(iterator);
    const statuses = new Map(entries.map(([path, status]) => [path.value, status]));
    expect(statuses.size).toBe(3);

    const fileStatus = statuses.get("native:///dir/data.txt");
    assert(fileStatus !== undefined);
    assert(fileStatus.isFile);
    expect(fileStatus.size).toBe(5);
    expect(fileStatus.isSymLink).toBe(false);

    const dirStatus = statuses.get("native:///dir/sub");
    assert(dirStatus !== undefined);
    assert(!dirStatus.isFile);

    const linkStatus = statuses.get("native:///dir/link");
    assert(linkStatus !== undefined);
    assert(linkStatus.isFile);
    expect(linkStatus.size).toBe(5);
    expect(linkStatus.isSymLink).toBe(false);
  });

  it("reports links as symlinks with includeStatus symlink", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/dir/link"),
        QualifiedPath.fromNative("/dir/data.txt"),
      );
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), {
      includeStatus: "symlink",
    });
    const entries = await collect(iterator);
    const statuses = new Map(entries.map(([path, status]) => [path.value, status]));
    expect(statuses.size).toBe(2);

    const linkStatus = statuses.get("native:///dir/link");
    assert(linkStatus !== undefined);
    assert(linkStatus.isFile);
    assert(linkStatus.isSymLink);
    expect(linkStatus.symLinkData.accessTime).toBe(TimeSeed);
    expect(linkStatus.size).toBe(5);

    const fileStatus = statuses.get("native:///dir/data.txt");
    assert(fileStatus !== undefined);
    expect(fileStatus.isSymLink).toBe(false);
  });

  it("skips dangling symlinks when includeStatus is set", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/dir/dangling"),
        QualifiedPath.fromNative("/missing"),
      );
    });

    for (const includeStatus of [true, "symlink"] as const) {
      const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"), {
        includeStatus,
      });
      const entries = await collect(iterator);
      expect(entries.map(([path]) => path.value)).toEqual(["native:///dir/data.txt"]);
    }
  });

  it("preserves entry casing", async () => {
    const fs = build((builder) => {
      builder.dir(QualifiedPath.fromNative("/Dir"));
      builder.file(QualifiedPath.fromNative("/Dir/File.TXT"), { type: "text", data: "x" });
    });

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/Dir"));
    const paths = await collect(iterator);

    expect(paths.map((path) => path.value)).toEqual(["native:///Dir/File.TXT"]);
  });

  it("rejects with fs:not-found for a missing directory", async () => {
    const fs = build(() => undefined);

    const error = await fsError(fs.enumerateDirectory(QualifiedPath.fromNative("/missing")));
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:not-a-directory when the path is a file", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "x" }),
    );

    const error = await fsError(fs.enumerateDirectory(QualifiedPath.fromNative("/file.txt")));
    expect(error.data.kind).toBe("fs:not-a-directory");
  });
});

describe("InMemoryFS.createStream", () => {
  it("reads a file through a read stream", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "hello" }),
    );

    const stream = await fs.createStream(QualifiedPath.fromNative("/file.txt"), "r");
    expect(decode(await readAll(stream))).toBe("hello");
  });

  it("slices reads with inclusive start and end", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), {
        type: "text",
        data: "hello world",
      }),
    );

    const head = await fs.createStream(QualifiedPath.fromNative("/file.txt"), "r", {
      start: 0,
      end: 4,
    });
    expect(decode(await readAll(head))).toBe("hello");

    const tail = await fs.createStream(QualifiedPath.fromNative("/file.txt"), "r", {
      start: 6,
      end: 10,
    });
    expect(decode(await readAll(tail))).toBe("world");
  });

  it("rejects with fs:not-found for a missing file", async () => {
    const fs = build(() => undefined);

    const error = await fsError(fs.createStream(QualifiedPath.fromNative("/missing.txt"), "r"));
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:not-a-file when the path is a directory", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const error = await fsError(fs.createStream(QualifiedPath.fromNative("/dir"), "r"));
    expect(error.data.kind).toBe("fs:not-a-file");
  });

  it("reads through a symlink", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "hello" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    const stream = await fs.createStream(QualifiedPath.fromNative("/link"), "r");
    expect(decode(await readAll(stream))).toBe("hello");
  });

  it("creates a file with a write stream", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/new.txt"), "w");
    const writer = stream.getWriter();
    await writer.write(encode("created"));
    await writer.close();

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/new.txt")))).toBe("created");
  });

  it("truncates an existing file at open", async () => {
    const fs = build((builder) =>
      builder.file(QualifiedPath.fromNative("/file.txt"), { type: "text", data: "old" }),
    );

    const stream = await fs.createStream(QualifiedPath.fromNative("/file.txt"), "w");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/file.txt")))).toBe("");

    const writer = stream.getWriter();
    await writer.write(encode("new"));
    await writer.close();
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/file.txt")))).toBe("new");
  });

  it("commits chunks incrementally", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/data.txt"), "w");
    const writer = stream.getWriter();

    await writer.write(encode("one"));
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.txt")))).toBe("one");

    await writer.write(encode("two"));
    await writer.close();
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.txt")))).toBe("onetwo");
  });

  it("zero-fills the start offset", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/")));

    const stream = await fs.createStream(QualifiedPath.fromNative("/file.txt"), "w", { start: 2 });
    const writer = stream.getWriter();
    await writer.write(encode("ab"));
    await writer.close();

    const contents = await fs.readFile(QualifiedPath.fromNative("/file.txt"));
    expect(contents).toEqual(new Uint8Array([0, 0, 97, 98]));
  });

  it("writes through a symlink to its target", async () => {
    const fs = build((builder) => {
      builder.file(QualifiedPath.fromNative("/target/data.txt"), { type: "text", data: "old" });
      seedLink(
        builder,
        QualifiedPath.fromNative("/link"),
        QualifiedPath.fromNative("/target/data.txt"),
      );
    });

    const stream = await fs.createStream(QualifiedPath.fromNative("/link"), "w");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/target/data.txt")))).toBe("");

    const writer = stream.getWriter();
    await writer.write(encode("new"));
    await writer.close();

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/target/data.txt")))).toBe("new");
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/link")))).toBe("new");
  });

  it("leaves partial data after an abort", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/data.txt"), "w");
    const writer = stream.getWriter();
    await writer.write(encode("partial"));
    await writer.abort();

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.txt")))).toBe("partial");
  });

  it("rejects with fs:not-found for a missing parent", async () => {
    const fs = build(() => undefined);

    const error = await fsError(
      fs.createStream(QualifiedPath.fromNative("/missing/data.txt"), "w"),
    );
    expect(error.data.kind).toBe("fs:not-found");
  });

  it("rejects with fs:not-a-file when the target is a directory", async () => {
    const fs = build((builder) => builder.dir(QualifiedPath.fromNative("/dir")));

    const error = await fsError(fs.createStream(QualifiedPath.fromNative("/dir"), "w"));
    expect(error.data.kind).toBe("fs:not-a-file");
  });

  it("throws for an unknown mode", async () => {
    const fs = build(() => undefined);

    await expect(fs.createStream(QualifiedPath.fromNative("/file.txt"), "x")).rejects.toThrow(
      "unknown mode 'x'",
    );
  });
});
