import type { IMessage, IMessageHandler } from "@vortex/adaptor-api";
import type { StatResult } from "@vortex/fs";

import {
  NodeFileSystemBackendImpl,
  NodeFileSystemImpl,
  PathResolverRegistryImpl,
} from "@vortex/fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileSystemServiceHandler } from "./fs-service";
import { nativeToQP, platformResolver } from "./testing";

/**
 * Simulate the transport boundary: class instances arrive as plain
 * objects with own-properties preserved and prototypes stripped. We use
 * Node's native `structuredClone` which matches postMessage semantics.
 */
function stripPrototype<T>(value: T): T {
  return structuredClone(value);
}

function invoke(
  handler: IMessageHandler,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const message: IMessage<{ method: string; args: unknown[] }> = {
    type: "vortex:host/filesystem" as never,
    id: "msg:1" as never,
    payload: { method, args },
  };
  return handler(message);
}

describe("createFileSystemServiceHandler", () => {
  let root: string;
  let service: ReturnType<typeof createFileSystemServiceHandler>;
  let rootQP: ReturnType<typeof nativeToQP>;

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), "fs-service-"));
    rootQP = nativeToQP(root);
    const resolver = platformResolver();
    const filesystem = new NodeFileSystemImpl(
      new NodeFileSystemBackendImpl(),
      new PathResolverRegistryImpl([resolver]),
    );
    service = createFileSystemServiceHandler(filesystem, { batchSize: 2 });
  });

  afterEach(async () => {
    await service.closeAll();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("readFile / writeFile roundtrip", async () => {
    const path = rootQP.join("hello.txt");
    await invoke(service.handler, "writeFile", [
      stripPrototype(path),
      new Uint8Array([1, 2, 3]),
    ]);
    const bytes = (await invoke(service.handler, "readFile", [
      stripPrototype(path),
    ])) as Uint8Array;
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("stat reports non-existence without throwing", async () => {
    const path = rootQP.join("missing");
    const result = (await invoke(service.handler, "stat", [
      stripPrototype(path),
    ])) as StatResult;
    expect(result.exists).toBe(false);
  });

  it("propagates FileSystemError with name/code/isTransient on failure", async () => {
    const missing = rootQP.join("does-not-exist.txt");
    await expect(
      invoke(service.handler, "readFile", [stripPrototype(missing)]),
    ).rejects.toMatchObject({
      name: "FileSystemError",
      code: "not found",
      isTransient: false,
    });
  });

  describe("enumeration cursor protocol", () => {
    it("paginates across batches and closes implicitly when done", async () => {
      await fs.writeFile(join(root, "a.txt"), "");
      await fs.writeFile(join(root, "b.txt"), "");
      await fs.writeFile(join(root, "c.txt"), "");

      const open = (await invoke(service.handler, "enumerateOpen", [
        stripPrototype(rootQP),
        { types: "files" },
      ])) as {
        cursorId: string;
        batch: unknown[];
        done: boolean;
      };

      expect(open.batch).toHaveLength(2);
      expect(open.done).toBe(false);

      const next = (await invoke(service.handler, "enumerateNext", [
        open.cursorId,
      ])) as { batch: unknown[]; done: boolean };

      expect(next.done).toBe(true);
      const collected = [...open.batch, ...next.batch];
      const values = collected
        .map((e) => (e as { value: string }).value)
        .sort();
      expect(values).toEqual([
        rootQP.join("a.txt").value,
        rootQP.join("b.txt").value,
        rootQP.join("c.txt").value,
      ]);

      // Cursor should already be forgotten — next call on it is empty+done.
      const after = (await invoke(service.handler, "enumerateNext", [
        open.cursorId,
      ])) as { batch: unknown[]; done: boolean };
      expect(after).toEqual({ batch: [], done: true });
    });

    it("enumerateClose releases a live cursor", async () => {
      await fs.writeFile(join(root, "a.txt"), "");
      await fs.writeFile(join(root, "b.txt"), "");
      await fs.writeFile(join(root, "c.txt"), "");

      const open = (await invoke(service.handler, "enumerateOpen", [
        stripPrototype(rootQP),
        { types: "files" },
      ])) as { cursorId: string; done: boolean };

      expect(open.done).toBe(false);

      await invoke(service.handler, "enumerateClose", [open.cursorId]);

      const after = (await invoke(service.handler, "enumerateNext", [
        open.cursorId,
      ])) as { batch: unknown[]; done: boolean };
      expect(after).toEqual({ batch: [], done: true });
    });

    it("includeStatus returns [QualifiedPath-shape, status] tuples", async () => {
      const filePath = join(root, "a.txt");
      await fs.writeFile(filePath, "hi");

      const open = (await invoke(service.handler, "enumerateOpen", [
        stripPrototype(rootQP),
        { includeStatus: true, types: "files" },
      ])) as {
        cursorId: string;
        batch: Array<[{ value: string }, { isFile: boolean; size: number }]>;
        done: boolean;
      };

      expect(open.batch).toHaveLength(1);
      const entry = open.batch[0];
      if (entry === undefined) throw new Error("expected one entry");
      const [qp, status] = entry;
      expect(qp.value).toBe(rootQP.join("a.txt").value);
      expect(status.isFile).toBe(true);
      expect(status.size).toBe(2);
    });

    it("closeAll releases every live cursor", async () => {
      await fs.writeFile(join(root, "a.txt"), "");
      await fs.writeFile(join(root, "b.txt"), "");
      await fs.writeFile(join(root, "c.txt"), "");

      const open1 = (await invoke(service.handler, "enumerateOpen", [
        stripPrototype(rootQP),
        { types: "files" },
      ])) as { cursorId: string; done: boolean };
      expect(open1.done).toBe(false);

      await service.closeAll();

      const after = (await invoke(service.handler, "enumerateNext", [
        open1.cursorId,
      ])) as { batch: unknown[]; done: boolean };
      expect(after).toEqual({ batch: [], done: true });
    });
  });

  it("rejects unknown methods", async () => {
    await expect(invoke(service.handler, "nope", [])).rejects.toThrow(
      /Unknown filesystem method/,
    );
  });

  it("rejects malformed path arguments", async () => {
    await expect(
      invoke(service.handler, "readFile", ["not a qualified path"]),
    ).rejects.toThrow(/Expected QualifiedPath/);
  });

  it("resolves QualifiedPath inputs back to the native path", async () => {
    const resolver = platformResolver();
    const resolved = await resolver.resolve(rootQP);
    expect(resolved).toBe(root);
  });
});
