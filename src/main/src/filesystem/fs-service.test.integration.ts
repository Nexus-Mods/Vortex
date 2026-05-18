/**
 * End-to-end test for the filesystem RPC path: the real
 * `createFileSystemClient` polyfill from `@nexusmods/adaptor-api/fs` talks through the
 * real `createRpcTransport` from the adaptor host over a `MessageChannel`,
 * against the real `createFileSystemServiceHandler` wrapping a real
 * `FileSystemBackendImpl`. No Worker, no bundle — just the same wiring
 * `bootstrap.ts` would do at runtime, driven from the test process.
 */

import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MessageChannel } from "node:worker_threads";

import type { IMethodMessage } from "@nexusmods/adaptor-api";
import { FileSystemError, QualifiedPath } from "@nexusmods/adaptor-api/fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRpcTransport, type IRpcTransport } from "../node-adaptor-host/transport.js";
import { NodeFileSystemBackendImpl } from "./backend";
import { createFileSystemClient } from "./client";
import { NodeFileSystemImpl } from "./filesystem-impl";
import type { FileSystemServiceHandler } from "./fs-service.js";
import { createFileSystemServiceHandler } from "./fs-service.js";
import { PathResolverRegistryImpl } from "./path-resolver-registry";
import { nativeToQP, platformResolver } from "./testing.js";

describe("filesystem RPC end-to-end", () => {
  let root: string;
  let rootQP: QualifiedPath;
  let hostTransport: IRpcTransport;
  let clientTransport: IRpcTransport;
  let service: FileSystemServiceHandler;

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), "fs-rpc-"));
    rootQP = nativeToQP(root);

    const { port1, port2 } = new MessageChannel();
    hostTransport = createRpcTransport(port1);
    clientTransport = createRpcTransport(port2);

    const filesystem = new NodeFileSystemImpl(
      new NodeFileSystemBackendImpl(),
      new PathResolverRegistryImpl([platformResolver()]),
    );
    service = createFileSystemServiceHandler(filesystem, { batchSize: 2 });

    hostTransport.onCall((msg: IMethodMessage) =>
      service.handler({
        type: "vortex:host/filesystem" as never,
        id: "msg:test" as never,
        payload: { method: msg.method, args: msg.args },
      }),
    );
  });

  afterEach(async () => {
    await service.closeAll();
    clientTransport.dispose();
    hostTransport.dispose();
    await fs.rm(root, { recursive: true, force: true });
  });

  function makeClient() {
    return createFileSystemClient((method, args) =>
      clientTransport.call({
        uri: "vortex:host/filesystem",
        method,
        args: [...args],
      }),
    );
  }

  it("writes, reads, and stats a file round-trip", async () => {
    const client = makeClient();
    const path = rootQP.join("hello.txt");

    await client.writeFile(path, new Uint8Array([1, 2, 3]));

    const bytes = await client.readFile(path);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);

    const stat = await client.stat(path);
    expect(stat.exists).toBe(true);
    if (stat.exists && stat.isFile) {
      expect(stat.size).toBe(3);
    }
  });

  it("propagates FileSystemError across the transport", async () => {
    const client = makeClient();
    const missing = rootQP.join("nope.txt");

    const err = await client.readFile(missing).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FileSystemError);
    const fsErr = err as FileSystemError;
    expect(fsErr.code).toBe("not found");
    expect(fsErr.isTransient).toBe(false);
  });

  it("iterates directory contents across multiple batches", async () => {
    const client = makeClient();
    // batchSize is 2; write 5 files so we exercise at least 3 RPC pulls.
    for (const name of ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"]) {
      await fs.writeFile(join(root, name), name);
    }

    const iterator = await client.enumerateDirectory(rootQP, {
      types: "files",
    });

    const seen: string[] = [];
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      const qp = next.value as QualifiedPath;
      expect(qp).toBeInstanceOf(QualifiedPath);
      seen.push(qp.basename);
    }

    expect(seen.sort()).toEqual(["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"]);
  });

  it("closes the cursor when the consumer bails early", async () => {
    const client = makeClient();
    for (const name of ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"]) {
      await fs.writeFile(join(root, name), name);
    }

    const iterator = await client.enumerateDirectory(rootQP, {
      types: "files",
    });

    await iterator.next();
    await iterator.return?.(undefined);

    // After close, further next() calls return done — the cursor on the
    // host has been released so there is nothing left to pull.
    const tail = await iterator.next();
    expect(tail.done).toBe(true);
  });

  it("returns [QualifiedPath, Status] tuples when includeStatus is set", async () => {
    const client = makeClient();
    await fs.writeFile(join(root, "a.txt"), "hi");

    const iterator = await client.enumerateDirectory(rootQP, {
      includeStatus: true,
      types: "files",
    });

    const first = await iterator.next();
    expect(first.done).toBe(false);
    const [qp, status] = first.value as [QualifiedPath, { isFile: boolean; size: number }];
    expect(qp).toBeInstanceOf(QualifiedPath);
    expect(qp.basename).toBe("a.txt");
    expect(status.isFile).toBe(true);
    expect(status.size).toBe(2);
  });
});
