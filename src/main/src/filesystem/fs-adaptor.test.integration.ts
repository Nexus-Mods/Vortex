/**
 * Full end-to-end test for the filesystem contract from inside a real
 * adaptor Worker. Loads the `fs-test` adaptor bundle through the same
 * `createTestHarness` flow used by `loader.test.integration.ts`, wires
 * `vortex:host/filesystem` to a real `NodeFileSystemImpl` over a tmpdir,
 * and calls the `fs-test` probe service to make the Worker exercise the
 * injected `FileSystem`.
 *
 * Unlike `fs-service.test.integration.ts`, which talks to the host
 * handler directly over an in-process MessageChannel, this test pushes
 * every call through the real Worker boundary — the bootstrap's
 * `createFileSystemClient` swap, VM sandbox, `@provides` scanner, and
 * transport envelope are all exercised.
 */

import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestHarness,
  type ITestHarness,
} from "../node-adaptor-host/testing/harness.js";
import { NodeFileSystemBackendImpl } from "./backend";
import { NodeFileSystemImpl } from "./filesystem-impl";
import { createFileSystemServiceHandler } from "./fs-service.js";
import { PathResolverRegistryImpl } from "./path-resolver-registry";
import { nativeToQP, platformResolver } from "./testing.js";

const BUNDLE_PATH = path.resolve(
  import.meta.dirname,
  "../../../../packages/adaptors/fs-test/dist/index.mjs",
);
const BOOTSTRAP_PATH = path.resolve(
  import.meta.dirname,
  "../../out/bootstrap.mjs",
);

const PROBE_URI = "vortex:adaptor/fs-test/probe";

/** Serialize a QualifiedPath to a plain object for the wire. */
function serialize(qp: { value: string; scheme: string; path: string }) {
  return { value: qp.value, scheme: qp.scheme, path: qp.path };
}

describe("fs-test adaptor (Worker end-to-end)", () => {
  let root: string;
  let rootQP: ReturnType<typeof nativeToQP>;
  let harness: ITestHarness;
  let service: ReturnType<typeof createFileSystemServiceHandler>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(tmpdir(), "fs-adaptor-"));
    rootQP = nativeToQP(root);

    const filesystem = new NodeFileSystemImpl(
      new NodeFileSystemBackendImpl(),
      new PathResolverRegistryImpl([platformResolver()]),
    );
    service = createFileSystemServiceHandler(filesystem, { batchSize: 2 });

    harness = await createTestHarness(
      BUNDLE_PATH,
      { "vortex:host/filesystem": service.handler },
      BOOTSTRAP_PATH,
    );
  });

  afterEach(async () => {
    await harness?.shutdown();
    await service.closeAll();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("loads the fs-test adaptor and lists the probe service in the manifest", () => {
    expect(harness.manifest.provides).toContain(PROBE_URI);
    expect(harness.manifest.requires).toContain("vortex:host/filesystem");
  });

  it("round-trips writeFile + readFile through the Worker via FileSystem", async () => {
    const target = serialize(rootQP.join("hello.txt"));
    const bytes = (await harness.call(PROBE_URI, "writeRead", [
      target,
      [1, 2, 3, 4],
    ])) as number[];

    expect(bytes).toEqual([1, 2, 3, 4]);

    // Verify the host actually wrote the file on disk (not a no-op).
    const onDisk = await fs.readFile(path.join(root, "hello.txt"));
    expect(Array.from(onDisk)).toEqual([1, 2, 3, 4]);
  });

  it("surfaces FileSystemError across the Worker boundary with code/isTransient", async () => {
    const missing = serialize(rootQP.join("nope.txt"));
    const result = (await harness.call(PROBE_URI, "readMissing", [
      missing,
    ])) as { name: string; code: string; isTransient: boolean };

    expect(result).toEqual({
      name: "FileSystemError",
      code: "not found",
      isTransient: false,
    });
  });

  it("iterates enumerateDirectory through the cursor protocol", async () => {
    // batchSize is 2; with 5 files the Worker must make 3+ cursor calls.
    for (const name of ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"]) {
      await fs.writeFile(path.join(root, name), name);
    }

    const names = (await harness.call(PROBE_URI, "listFiles", [
      serialize(rootQP),
    ])) as string[];

    expect(names).toEqual(["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"]);
  });
});
