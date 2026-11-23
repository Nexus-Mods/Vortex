import * as path from "node:path";

import { parseError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { afterEach, describe, expect, test } from "vitest";

import { installInMemoryFS, type InstalledInMemoryFS } from "../../../test-utils/fsApi";
import { makeLockfile, makeNexusFileSource } from "../../../test-utils/lockfileBuilders";
import { checksum } from "../../../util/checksum";
import { ReconcileChange, reconcileLockfile } from "./reconcileLockfile";

const STAGE_MODIFIED_TIME = Temporal.Instant.from("2025-10-09T08:53:20Z");

const GAME_DIR = path.resolve("fixture-root", "game");
const STAGING_DIR = path.resolve("fixture-root", "staging");

const qualified = (...parts: string[]) => QualifiedPath.fromNative(path.join(...parts));

const CONTENT = "SkyUI_SE.esp content";
const CONTENT_BYTES = new TextEncoder().encode(CONTENT);
const CONTENT_HASH = checksum(Buffer.from(CONTENT_BYTES));

let installed: InstalledInMemoryFS | undefined;

afterEach(() => {
  installed?.restore();
  installed = undefined;
});

/** A `getFileByHash` that resolves to `path`, whatever hash it's asked for. */
function hashLookupAlwaysAt(
  path: QualifiedPath,
): (hash: string) => Promise<QualifiedPath | undefined> {
  return async () => path;
}

describe("reconcileLockfile", () => {
  test("reports no change when the destination is still the staged file's hardlink", async () => {
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      builder
        .file(staged, { type: "text", data: CONTENT }, { modifiedTime: STAGE_MODIFIED_TIME })
        .dir(deployed.parent());
    });
    await installed.fs.createLink(staged, deployed, "hardlink");

    const lockfile = makeLockfile({
      files: [
        makeNexusFileSource({
          destinationPath: deployed.path,
          fileHash: CONTENT_HASH,
          stageModifiedTime: STAGE_MODIFIED_TIME,
        }),
      ],
    });

    const result = await reconcileLockfile(lockfile, hashLookupAlwaysAt(staged));

    expect(result).toEqual([]);
  });

  test("reports DestinationMissing when nothing is at the destination", async () => {
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      builder.file(staged, { type: "text", data: CONTENT });
    });

    const file = makeNexusFileSource({ destinationPath: deployed.path, fileHash: CONTENT_HASH });
    const lockfile = makeLockfile({ files: [file] });

    const result = await reconcileLockfile(lockfile, hashLookupAlwaysAt(staged));

    expect(result).toEqual([{ file, change: ReconcileChange.DestinationMissing }]);
  });

  test("reports StagedMissing when nothing is at the staged path", async () => {
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      // deployed exists, but nothing is seeded at `staged`: getFileByHash points nowhere real
      builder.file(deployed, { type: "text", data: CONTENT });
    });

    const file = makeNexusFileSource({ destinationPath: deployed.path, fileHash: CONTENT_HASH });
    const lockfile = makeLockfile({ files: [file] });

    const result = await reconcileLockfile(lockfile, hashLookupAlwaysAt(staged));

    expect(result).toEqual([{ file, change: ReconcileChange.StagedMissing }]);
  });

  test("reports StagedContentChanged when the hardlink is intact but the staged file's content moved on", async () => {
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      builder
        .file(staged, { type: "text", data: CONTENT }, { modifiedTime: STAGE_MODIFIED_TIME })
        .dir(deployed.parent());
    });
    const { fs } = installed;
    await fs.createLink(staged, deployed, "hardlink");

    const file = makeNexusFileSource({
      destinationPath: deployed.path,
      fileHash: CONTENT_HASH,
      stageModifiedTime: STAGE_MODIFIED_TIME,
    });
    const lockfile = makeLockfile({ files: [file] });

    // the hardlink is untouched - this mutates the shared node, so the destination gets the new
    // bytes (and a fresh modified time) too, exactly as editing through either of a hardlink's two
    // names normally would
    await fs.writeFile(staged, new TextEncoder().encode("a newer mod update"));

    const result = await reconcileLockfile(lockfile, hashLookupAlwaysAt(staged));

    expect(result).toEqual([{ file, change: ReconcileChange.StagedContentChanged }]);
  });

  test("reports DestinationReplaced when the hardlink was deleted and a new file with the same name took its place", async () => {
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      builder.file(staged, { type: "text", data: CONTENT }).dir(deployed.parent());
    });
    const { fs } = installed;
    await fs.createLink(staged, deployed, "hardlink");

    const file = makeNexusFileSource({ destinationPath: deployed.path, fileHash: CONTENT_HASH });
    const lockfile = makeLockfile({ files: [file] });
    const getFileByHash = hashLookupAlwaysAt(staged);

    await fs.delete(deployed);
    await fs.writeFile(deployed, CONTENT_BYTES);

    const result = await reconcileLockfile(lockfile, getFileByHash);

    expect(result).toEqual([{ file, change: ReconcileChange.DestinationReplaced }]);
  });

  test("reports DestinationError when the destination can't be statted", async () => {
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    // "Data" is a file, not a folder, so anything under it fails to stat rather than being missing
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      builder.file(staged, { type: "text", data: CONTENT });
      builder.file(qualified(GAME_DIR, "Data"), { type: "text", data: "not a folder" });
    });

    const file = makeNexusFileSource({ destinationPath: deployed.path, fileHash: CONTENT_HASH });
    const lockfile = makeLockfile({ files: [file] });

    const result = await reconcileLockfile(lockfile, hashLookupAlwaysAt(staged));

    expect(result).toEqual([
      { file, change: ReconcileChange.DestinationError, error: expect.any(Error) },
    ]);
    expect(parseError(result[0]?.error).data.kind).toBe("fs:not-a-directory");
  });

  test("reports StagedError when the staged file can't be statted", async () => {
    // "SkyUI" is a file, not a folder, so anything under it fails to stat rather than being missing
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.esp");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    installed = installInMemoryFS((builder) => {
      builder.file(qualified(STAGING_DIR, "SkyUI"), { type: "text", data: "not a folder" });
    });

    const file = makeNexusFileSource({ destinationPath: deployed.path, fileHash: CONTENT_HASH });
    const lockfile = makeLockfile({ files: [file] });

    const result = await reconcileLockfile(lockfile, hashLookupAlwaysAt(staged));

    expect(result).toEqual([
      { file, change: ReconcileChange.StagedError, error: expect.any(Error) },
    ]);
    expect(parseError(result[0]?.error).data.kind).toBe("fs:not-a-directory");
  });
});
