import type { ApplyFiles } from "@nexusmods/mod-pipeline";
import {
  InMemoryFS,
  InMemoryFSBuilder,
  QualifiedPath,
  type StatResult,
} from "@vortex/shared/filesystem";
import { describe, expect, test } from "vitest";

import { LinkCountingFS } from "@/test-utils/linkCountingFS";

import { applyFilesOn } from "./applyFiles";

const qualified = (path: string) => QualifiedPath.fromNative(path);

/** `/other` is on a second drive. */
class TwoDrivesFS extends InMemoryFS {
  override async stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult> {
    const status = await super.stat(path, options);
    return status.exists && path.path.startsWith("/other")
      ? { ...status, deviceId: status.deviceId + 1n }
      : status;
  }
}

const filesWith = (...paths: string[]) => {
  const builder = new InMemoryFSBuilder();
  for (const path of paths) {
    builder.file(qualified(path), { type: "text", data: path });
  }
  return applyFilesOn(new LinkCountingFS(builder.store));
};

const idAt = async (files: ApplyFiles, path: string) => (await files.statusAt(path))?.id;

describe("applyFilesOn", () => {
  test("gives hardlinks of one file one id, and other files another", async () => {
    const files = filesWith("/a", "/b");

    await files.link("/a", "/link");

    expect(await idAt(files, "/link")).toBe(await idAt(files, "/a"));
    expect(await idAt(files, "/b")).not.toBe(await idAt(files, "/a"));
  });

  test("counts a file's hardlinks", async () => {
    const files = filesWith("/a", "/b");

    await files.link("/a", "/link");

    expect((await files.statusAt("/a"))?.linkCount).toBe(2);
    expect((await files.statusAt("/b"))?.linkCount).toBe(1);
  });

  test("won't move or link over a file", async () => {
    const files = filesWith("/a", "/taken");
    const takenId = await idAt(files, "/taken");

    await expect(files.move("/a", "/taken")).rejects.toThrow();
    await expect(files.link("/a", "/taken")).rejects.toThrow();

    expect(await idAt(files, "/taken")).toBe(takenId);
    expect(await idAt(files, "/a")).toBeDefined();
  });

  test.each([
    ["a folder there", "/other/a"],
    ["a folder not made yet", "/other/new/a"],
  ])("won't move a file into %s on another drive", async (_, target) => {
    const seeded = new InMemoryFSBuilder()
      .file(qualified("/game/a"), { type: "text", data: "a" })
      .dir(qualified("/other"));
    const files = applyFilesOn(new TwoDrivesFS(seeded.store));

    await expect(files.move("/game/a", target)).rejects.toThrow("another drive");

    expect(await idAt(files, "/game/a")).toBeDefined();
    expect(await idAt(files, target)).toBeUndefined();
  });

  test("creates a folder and those above it, and again without failing", async () => {
    const files = filesWith();

    await files.createFolder("/one/two");
    await files.createFolder("/one/two");

    expect(await idAt(files, "/one/two")).toBeDefined();
  });

  test("leaves a folder with something in it", async () => {
    const files = filesWith("/full/a");

    await files.removeEmptyFolder("/full");

    expect(await idAt(files, "/full/a")).toBeDefined();
  });

  test("leaves a file at a folder's path", async () => {
    const files = filesWith("/a");

    await files.removeEmptyFolder("/a");

    expect(await idAt(files, "/a")).toBeDefined();
  });

  test("ignores a folder that isn't there", async () => {
    await expect(filesWith().removeEmptyFolder("/missing")).resolves.toBeUndefined();
  });
});
