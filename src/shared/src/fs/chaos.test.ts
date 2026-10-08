import { assert, describe, expect, it } from "vitest";

import { VortexError } from "../errors/base";
import { ChaosFS } from "./chaos";
import { InMemoryFS } from "./in-memory";
import { Builder } from "./in-memory-builder";
import { QualifiedPath } from "./paths";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

function memory(seed: (builder: Builder) => void): InMemoryFS {
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

describe("ChaosFS", () => {
  it("passes through calls that match no rule", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [{ op: "readFile", fault: { kind: "fs:not-found" } }],
    );

    await fs.writeFile(QualifiedPath.fromNative("/dir/data.txt"), encode("ok"));

    const stat = await fs.stat(QualifiedPath.fromNative("/dir/data.txt"));
    assert(stat.exists);
    assert(stat.isFile);
  });

  it("fails a matching call once, then recovers", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [{ op: "writeFile", fault: { kind: "fs:no-space" } }],
    );

    const error = await fsError(
      fs.writeFile(QualifiedPath.fromNative("/dir/data.txt"), encode("ok")),
    );
    assert(error.data.kind === "fs:no-space");
    expect(error.data.path).toBe("native:///dir/data.txt");
    expect(error.message).toBe("Injected fault 'fs:no-space'");
    expect(await fs.stat(QualifiedPath.fromNative("/dir/data.txt"))).toEqual({ exists: false });

    await fs.writeFile(QualifiedPath.fromNative("/dir/data.txt"), encode("ok"));
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.txt")))).toBe("ok");
  });

  it("consumes its budget across matching calls", async () => {
    const fs = new ChaosFS(
      memory((builder) =>
        builder.file(QualifiedPath.fromNative("/data.txt"), { type: "text", data: "ok" }),
      ),
      [{ op: "readFile", fault: { kind: "fs:no-space" }, times: 2 }],
    );

    await fsError(fs.readFile(QualifiedPath.fromNative("/data.txt")));
    await fsError(fs.readFile(QualifiedPath.fromNative("/data.txt")));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/data.txt")))).toBe("ok");
  });

  it("fails persistently with an infinite budget", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [{ op: "writeFile", fault: { kind: "fs:read-only" }, times: Infinity }],
    );

    for (let attempt = 0; attempt < 3; attempt++) {
      const error = await fsError(
        fs.writeFile(QualifiedPath.fromNative("/dir/data.txt"), encode("ok")),
      );
      expect(error.data.kind).toBe("fs:read-only");
    }
  });

  it("filters rules by op", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [{ op: "delete", fault: { kind: "fs:no-permissions" } }],
    );

    await fs.writeFile(QualifiedPath.fromNative("/dir/data.txt"), encode("ok"));
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.txt")))).toBe("ok");

    const error = await fsError(fs.delete(QualifiedPath.fromNative("/dir/data.txt")));
    expect(error.data.kind).toBe("fs:no-permissions");
  });

  it("filters rules by path", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/staging"))),
      [
        {
          op: "writeFile",
          path: (path) => path.value.includes("/game/"),
          fault: { kind: "fs:no-permissions" },
        },
      ],
    );

    await fs.writeFile(QualifiedPath.fromNative("/staging/mod.esp"), encode("ok"));

    const error = await fsError(
      fs.writeFile(QualifiedPath.fromNative("/game/mod.esp"), encode("x")),
    );
    assert(error.data.kind === "fs:no-permissions");
    expect(error.data.path).toBe("native:///game/mod.esp");
  });

  it("matches when any path argument matches", async () => {
    const fs = new ChaosFS(
      memory((builder) => {
        builder.file(QualifiedPath.fromNative("/staging/mod.esp"), { type: "text", data: "x" });
        builder.dir(QualifiedPath.fromNative("/game"));
      }),
      [
        {
          op: "copy",
          path: (path) => path.value.includes("/game/"),
          fault: { kind: "fs:no-space" },
        },
      ],
    );

    const error = await fsError(
      fs.copy(
        QualifiedPath.fromNative("/staging/mod.esp"),
        QualifiedPath.fromNative("/game/mod.esp"),
      ),
    );
    assert(error.data.kind === "fs:no-space");
    expect(error.data.path).toBe("native:///game/mod.esp");
  });

  it("evaluates rules in listed order", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [
        { op: "writeFile", fault: { kind: "fs:no-space" } },
        { op: "writeFile", fault: { kind: "fs:no-permissions" } },
      ],
    );

    const first = await fsError(fs.writeFile(QualifiedPath.fromNative("/dir/a.txt"), encode("x")));
    expect(first.data.kind).toBe("fs:no-space");

    const second = await fsError(fs.writeFile(QualifiedPath.fromNative("/dir/b.txt"), encode("x")));
    expect(second.data.kind).toBe("fs:no-permissions");

    await fs.writeFile(QualifiedPath.fromNative("/dir/c.txt"), encode("x"));
  });

  it("carries kind, originalCode, transient flag and message", async () => {
    const fs = new ChaosFS(
      memory((builder) =>
        builder.file(QualifiedPath.fromNative("/deploy/mod.esp"), { type: "text", data: "x" }),
      ),
      [
        {
          op: "delete",
          fault: {
            kind: "os:generic",
            originalCode: "EBUSY",
            transient: true,
            message: "file is in use",
          },
        },
      ],
    );

    const error = await fsError(fs.delete(QualifiedPath.fromNative("/deploy/mod.esp")));
    assert(error.data.kind === "os:generic");
    expect(error.data.originalCode).toBe("EBUSY");
    expect(error.isTransient).toBe(true);
    expect(error.message).toBe("file is in use");

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/deploy/mod.esp")))).toBe("x");
  });

  it("filters createStream rules by mode", async () => {
    const fs = new ChaosFS(
      memory((builder) =>
        builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "ok" }),
      ),
      [{ op: "createStream", mode: "r", fault: { kind: "fs:no-permissions" } }],
    );

    const error = await fsError(fs.createStream(QualifiedPath.fromNative("/dir/data.txt"), "r"));
    expect(error.data.kind).toBe("fs:no-permissions");

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/other.txt"), "w");
    const writer = stream.getWriter();
    await writer.write(encode("ok"));
    await writer.close();
    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/other.txt")))).toBe("ok");
  });

  it("fails a write stream after failAfter bytes, keeping partial data", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [{ op: "createStream", fault: { kind: "fs:no-space" }, failAfter: 5 }],
    );

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/data.bin"), "w");
    const writer = stream.getWriter();

    await writer.write(encode("12345"));
    const error = await fsError(writer.write(encode("678")));
    assert(error.data.kind === "fs:no-space");

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.bin")))).toBe("12345");
  });

  it("persists only the allowed bytes of an oversized chunk", async () => {
    const fs = new ChaosFS(
      memory((builder) => builder.dir(QualifiedPath.fromNative("/dir"))),
      [{ op: "createStream", fault: { kind: "fs:no-space" }, failAfter: 2 }],
    );

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/data.bin"), "w");
    const writer = stream.getWriter();

    await fsError(writer.write(encode("12345")));

    expect(decode(await fs.readFile(QualifiedPath.fromNative("/dir/data.bin")))).toBe("12");
  });

  it("fails a read stream at chunk granularity after failAfter bytes", async () => {
    const fs = new ChaosFS(
      memory((builder) =>
        builder.file(QualifiedPath.fromNative("/dir/data.txt"), {
          type: "text",
          data: "hello world",
        }),
      ),
      [{ op: "createStream", fault: { kind: "fs:no-space" }, failAfter: 5 }],
    );

    const stream = await fs.createStream(QualifiedPath.fromNative("/dir/data.txt"), "r");
    const reader = stream.getReader();

    const chunk = await reader.read();
    assert(!chunk.done);
    expect(decode(chunk.value)).toBe("hello world");

    const error = await fsError(reader.read());
    assert(error.data.kind === "fs:no-space");
  });

  it("fails a directory iterator after failAfter entries", async () => {
    const fs = new ChaosFS(
      memory((builder) => {
        builder.file(QualifiedPath.fromNative("/dir/a.txt"), { type: "text", data: "x" });
        builder.file(QualifiedPath.fromNative("/dir/b.txt"), { type: "text", data: "x" });
        builder.file(QualifiedPath.fromNative("/dir/c.txt"), { type: "text", data: "x" });
      }),
      [{ op: "enumerateDirectory", fault: { kind: "fs:no-space" }, failAfter: 2 }],
    );

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"));

    const first = await iterator.next();
    assert(!first.done);
    const second = await iterator.next();
    assert(!second.done);

    const error = await fsError(iterator.next());
    assert(error.data.kind === "fs:no-space");
  });

  it("lets an iterator finish when it ends before failAfter", async () => {
    const fs = new ChaosFS(
      memory((builder) => {
        builder.file(QualifiedPath.fromNative("/dir/a.txt"), { type: "text", data: "x" });
        builder.file(QualifiedPath.fromNative("/dir/b.txt"), { type: "text", data: "x" });
      }),
      [{ op: "enumerateDirectory", fault: { kind: "fs:no-space" }, failAfter: 10 }],
    );

    const iterator = await fs.enumerateDirectory(QualifiedPath.fromNative("/dir"));
    const entries: string[] = [];
    for (;;) {
      const result = await iterator.next();
      if (result.done) break;
      entries.push(result.value.value);
    }

    expect(entries).toHaveLength(2);
  });

  it("fails stream and iterator calls eagerly without failAfter", async () => {
    const fs = new ChaosFS(
      memory((builder) => {
        builder.dir(QualifiedPath.fromNative("/dir"));
        builder.file(QualifiedPath.fromNative("/dir/data.txt"), { type: "text", data: "x" });
      }),
      [{ fault: { kind: "fs:no-permissions" }, times: Infinity }],
    );

    const streamError = await fsError(
      fs.createStream(QualifiedPath.fromNative("/dir/data.txt"), "r"),
    );
    expect(streamError.data.kind).toBe("fs:no-permissions");

    const iteratorError = await fsError(fs.enumerateDirectory(QualifiedPath.fromNative("/dir")));
    expect(iteratorError.data.kind).toBe("fs:no-permissions");
  });
});
