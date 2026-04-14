import * as nodeFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PathResolverRegistryImpl } from "../browser/paths";
import { NodeFileSystemBackendImpl } from "./backend";
import { NodeFileSystemImpl } from "./filesystem-impl";
import { nativeToQP, platformResolver } from "./testing";
import { WebFileSystemImpl } from "./web-filesystem-impl";

describe("WebFileSystemImpl", () => {
  let root: string;
  let fs: WebFileSystemImpl;

  beforeEach(async () => {
    root = await nodeFs.mkdtemp(join(tmpdir(), "web-fs-"));
    const node = new NodeFileSystemImpl(
      new NodeFileSystemBackendImpl(),
      new PathResolverRegistryImpl([platformResolver()]),
    );
    fs = new WebFileSystemImpl(node);
  });

  afterEach(async () => {
    await nodeFs.rm(root, { recursive: true, force: true });
  });

  it("delegates flat methods to the underlying NodeFileSystem", async () => {
    const rootQP = nativeToQP(root);
    const target = rootQP.join("f.txt");
    await fs.writeFile(target, new Uint8Array([1, 2, 3, 4]));
    const bytes = await fs.readFile(target);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("createStream('r') returns a ReadableStream that reads the file bytes", async () => {
    const rootQP = nativeToQP(root);
    const target = rootQP.join("r.txt");
    await nodeFs.writeFile(join(root, "r.txt"), new Uint8Array([9, 8, 7]));

    const stream = await fs.createStream(target, "r");
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const res = await reader.read();
      if (res.done) break;
      chunks.push(res.value as Uint8Array);
    }
    const total = Buffer.concat(chunks);
    expect(Array.from(total)).toEqual([9, 8, 7]);
  });

  it("createStream('w') returns a WritableStream that persists written bytes", async () => {
    const rootQP = nativeToQP(root);
    const target = rootQP.join("w.txt");
    const stream = await fs.createStream(target, "w");
    const writer = stream.getWriter();
    await writer.write(new Uint8Array([5, 6, 7]));
    await writer.close();

    const onDisk = await nodeFs.readFile(join(root, "w.txt"));
    expect(Array.from(onDisk)).toEqual([5, 6, 7]);
  });

  it("enumerateDirectory passes through QP entries", async () => {
    const rootQP = nativeToQP(root);
    for (const name of ["a", "b"]) {
      await nodeFs.writeFile(join(root, name), name);
    }
    const iter = await fs.enumerateDirectory(rootQP, { types: "files" });
    const seen: string[] = [];
    while (true) {
      const step = await iter.next();
      if (step.done) break;
      seen.push(step.value.basename);
    }
    expect(seen.sort()).toEqual(["a", "b"]);
  });
});
