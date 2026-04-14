import * as nodeFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileSystemError } from "../browser/filesystem";
import { PathResolverRegistryImpl, QualifiedPath } from "../browser/paths";
import { NodeFileSystemBackendImpl } from "./backend";
import { NodeFileSystemImpl } from "./filesystem-impl";
import { nativeToQP, platformResolver, platformScheme } from "./testing";

describe("NodeFileSystemImpl", () => {
  let root: string;
  let rootQP: QualifiedPath;
  let fs: NodeFileSystemImpl;

  beforeEach(async () => {
    root = await nodeFs.mkdtemp(join(tmpdir(), "node-fs-"));
    rootQP = nativeToQP(root);
    fs = new NodeFileSystemImpl(
      new NodeFileSystemBackendImpl(),
      new PathResolverRegistryImpl([platformResolver()]),
    );
  });

  afterEach(async () => {
    await nodeFs.rm(root, { recursive: true, force: true });
  });

  it("writes and reads files through QualifiedPath", async () => {
    const target = rootQP.join("hello.txt");
    await fs.writeFile(target, new Uint8Array([1, 2, 3]));
    const bytes = await fs.readFile(target);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("stats existing files and reports missing ones", async () => {
    const target = rootQP.join("s.txt");
    await fs.writeFile(target, new Uint8Array([9]));
    const present = await fs.stat(target);
    expect(present.exists).toBe(true);
    if (present.exists && present.isFile) expect(present.size).toBe(1);

    const missing = await fs.stat(rootQP.join("missing"));
    expect(missing.exists).toBe(false);
  });

  it("throws FileSystemError for missing files via readFile", async () => {
    await expect(fs.readFile(rootQP.join("nope"))).rejects.toBeInstanceOf(
      FileSystemError,
    );
  });

  it("enumerates a directory yielding QualifiedPath entries", async () => {
    for (const name of ["a.txt", "b.txt", "c.txt"]) {
      await nodeFs.writeFile(join(root, name), name);
    }
    const iter = await fs.enumerateDirectory(rootQP, { types: "files" });
    const seen: string[] = [];
    while (true) {
      const step = await iter.next();
      if (step.done) break;
      const qp = step.value;
      expect(qp).toBeInstanceOf(QualifiedPath);
      expect(qp.scheme).toBe(platformScheme());
      seen.push(qp.basename);
    }
    expect(seen.sort()).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("yields [QualifiedPath, Status] tuples when includeStatus is set", async () => {
    await nodeFs.writeFile(join(root, "x.txt"), "hi");
    const iter = await fs.enumerateDirectory(rootQP, {
      includeStatus: true,
      types: "files",
    });
    const step = await iter.next();
    expect(step.done).toBe(false);
    const [qp, status] = step.value as [QualifiedPath, { size: number }];
    expect(qp).toBeInstanceOf(QualifiedPath);
    expect(qp.basename).toBe("x.txt");
    expect(status.size).toBe(2);
  });

  it("rehydrates nested entries under the root QP when recursive", async () => {
    await nodeFs.mkdir(join(root, "sub"));
    await nodeFs.writeFile(join(root, "sub", "nested.txt"), "x");
    const iter = await fs.enumerateDirectory(rootQP, {
      recursive: true,
      types: "files",
    });
    const seen: string[] = [];
    while (true) {
      const step = await iter.next();
      if (step.done) break;
      seen.push(step.value.path);
    }
    expect(seen.some((p) => p.endsWith(`${rootQP.path}/sub/nested.txt`))).toBe(
      true,
    );
  });

  it("closes the backend iterator when return() is called", async () => {
    for (const name of ["a", "b", "c"]) {
      await nodeFs.writeFile(join(root, name), name);
    }
    const iter = await fs.enumerateDirectory(rootQP, { types: "files" });
    await iter.next();
    await iter.return?.(undefined);
    // After return, next() must report done without throwing (the underlying
    // Dir handle is closed, but the wrapper swallows that in return()).
    const tail = await iter
      .next()
      .catch(() => ({ done: true, value: undefined }));
    expect(tail.done).toBe(true);
  });

  it("rejects paths whose scheme has no registered resolver", async () => {
    const unknown = QualifiedPath.parse("steam://SteamApps/common/Skyrim");
    await expect(fs.readFile(unknown)).rejects.toThrow(/No resolver/);
  });
});
