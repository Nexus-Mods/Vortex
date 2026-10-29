import * as nodeFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, assert, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { NodeFileSystemBackendImpl } from "./backend";

// The `close` of every directory the backend opens, so the tests can see when it's released.
const closeSpies = vi.hoisted(() => [] as MockInstance[]);

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof nodeFs>();

  return {
    ...actual,
    opendir: async (...args: Parameters<typeof actual.opendir>) => {
      const dir = await actual.opendir(...args);
      closeSpies.push(vi.spyOn(dir, "close"));
      return dir;
    },
  };
});

describe("NodeFileSystemBackendImpl.enumerateDirectory", () => {
  let root: string;
  let backend: NodeFileSystemBackendImpl;

  beforeEach(async () => {
    closeSpies.length = 0;
    root = await nodeFs.mkdtemp(join(tmpdir(), "node-fs-backend-"));
    backend = new NodeFileSystemBackendImpl();
  });

  afterEach(async () => {
    await nodeFs.rm(root, { recursive: true, force: true });
  });

  it("closes the directory once the listing is exhausted", async () => {
    for (const name of ["a", "b", "c"]) {
      await nodeFs.writeFile(join(root, name), name);
    }

    const iterator = await backend.enumerateDirectory(root);
    for await (const _entry of iterator) {
      // drained without calling return()
    }

    expect(closeSpies).toHaveLength(1);

    const [close] = closeSpies;
    assert(close !== undefined);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the directory when every entry was filtered out", async () => {
    await nodeFs.mkdir(join(root, "sub"));

    const iterator = await backend.enumerateDirectory(root, { types: "files" });
    for await (const _entry of iterator) {
      // all filtered out
    }

    const [close] = closeSpies;
    assert(close !== undefined);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("doesn't leave the directory open while there are entries left", async () => {
    for (const name of ["a", "b"]) {
      await nodeFs.writeFile(join(root, name), name);
    }

    const iterator = await backend.enumerateDirectory(root);
    await iterator.next();

    const [close] = closeSpies;
    assert(close !== undefined);

    expect(close).not.toHaveBeenCalled();

    await iterator.return?.(undefined);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("lets return() be called after the listing is exhausted", async () => {
    await nodeFs.writeFile(join(root, "a"), "a");

    const iterator = await backend.enumerateDirectory(root);
    for await (const _entry of iterator) {
      // drained
    }

    await expect(iterator.return?.(undefined)).resolves.toEqual({ done: true, value: undefined });
  });

  it("reports done on every call after the listing is exhausted", async () => {
    await nodeFs.writeFile(join(root, "a"), "a");

    const iterator = await backend.enumerateDirectory(root);
    await iterator.next();

    expect((await iterator.next()).done).toBe(true);
    await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
  });
});
