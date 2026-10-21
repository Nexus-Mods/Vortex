import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { FileSourceKind, type FileSource, type Lockfile } from "./lockfile";
import { OperationKind, plan, type Operation } from "./plan";

/** The game directory the lockfiles deploy into, a fresh temp directory per test. */
let gameDir: string;

beforeEach(async () => {
  gameDir = await mkdtemp(path.join(tmpdir(), "mod-pipeline-plan-"));
});

afterEach(async () => {
  await rm(gameDir, { recursive: true, force: true });
});

function lockfile(files: FileSource[]): Lockfile {
  return {
    version: 1,
    gameId: "1704",
    gameVersion: "1.6.1170",
    storeId: "steam",
    files,
  };
}

function makeFileSource(name: string, fileHash: string): FileSource {
  return {
    source: FileSourceKind.Nexus,
    fileId: "100",
    fileHash,
    destinationPath: path.join(gameDir, name),
  };
}

/** Puts a file on disk at each file's destination. */
async function deploy(...files: FileSource[]): Promise<void> {
  for (const { destinationPath } of files) {
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, path.basename(destinationPath));
  }
}

/** The plan's operations in destination order, so tests don't depend on plan's ordering. */
function planSorted(current: Lockfile, previous: Lockfile): Operation[] {
  return plan(current, previous).sort((a, b) =>
    a.destinationSource.destinationPath.localeCompare(b.destinationSource.destinationPath),
  );
}

describe("plan", () => {
  test("Copies one file. One file is in the current lockfile, no previous lockfile and disk state is empty", async () => {
    const mod1 = makeFileSource("mod1.mod", "hash-1");

    expect(planSorted(lockfile([mod1]), lockfile([]))).toEqual([
      { kind: OperationKind.Copy, destinationSource: mod1 },
    ]);
  });

  test("Deletes a file. Current lockfile is empty, previous has one file and disk state has one.", async () => {
    const mod1 = makeFileSource("mod1.mod", "hash-1");
    await deploy(mod1);

    expect(planSorted(lockfile([]), lockfile([mod1]))).toEqual([
      { kind: OperationKind.Delete, destinationSource: mod1 },
    ]);
  });

  test("Plans nothing when both lockfiles are empty", async () => {
    expect(planSorted(lockfile([]), lockfile([]))).toEqual([]);
  });

  test("Plans nothing when the lockfile is unchanged and its files are on disk", async () => {
    const mod1 = makeFileSource("mod1.mod", "hash-1");
    await deploy(mod1);

    expect(planSorted(lockfile([mod1]), lockfile([mod1]))).toEqual([]);
  });

  // TODO: Does this make sense?
  test("Copies the new version of a file whose hash changed", async () => {
    const previousMod1 = makeFileSource("mod1.mod", "hash-1");
    const currentMod1 = makeFileSource("mod1.mod", "hash-2");
    await deploy(previousMod1);

    expect(planSorted(lockfile([currentMod1]), lockfile([previousMod1]))).toEqual([
      { kind: OperationKind.Copy, destinationSource: currentMod1 },
    ]);
  });

  test("Copies a file that is in both lockfiles but missing from disk", async () => {
    const mod1 = makeFileSource("mod1.mod", "hash-1");

    expect(planSorted(lockfile([mod1]), lockfile([mod1]))).toEqual([
      { kind: OperationKind.Copy, destinationSource: mod1 },
    ]);
  });

  test("Plans nothing if a file already exists on disk", async () => {
    const mod1 = makeFileSource("mod1.mod", "hash-1");
    await deploy(mod1);

    expect(planSorted(lockfile([mod1]), lockfile([]))).toEqual([]);
  });

  test("Plans nothing for a removed file that is already gone from disk", async () => {
    const mod1 = makeFileSource("mod1.mod", "hash-1");

    expect(planSorted(lockfile([]), lockfile([mod1]))).toEqual([]);
  });

  test("Check subdirectory logic, should delete the file", async () => {
    const mod = makeFileSource("SKSE/Plugins/plugin.dll", "hash-1");
    await deploy(mod);

    expect(planSorted(lockfile([]), lockfile([mod]))).toEqual([
      { kind: OperationKind.Delete, destinationSource: mod },
    ]);
  });

  // TODO: how do we do error handling
  test("Do not allow level up in filenames", async () => {
    const mod = makeFileSource("../plugin.dll", "hash-1");
    await deploy(mod);

    expect(planSorted(lockfile([mod]), lockfile([]))).toEqual([]);
  });

  //TODO: do we need more of these kind of tests?
  test("Broken filenames, return nothing", async () => {
    const mod = makeFileSource(":/mod.mod", "hash-1");

    expect(planSorted(lockfile([mod]), lockfile([]))).toEqual([]);
  });

  test("Copies, deletes and keeps files in one plan", async () => {
    const kept = makeFileSource("kept.mod", "hash-kept");
    const added = makeFileSource("added.mod", "hash-added");
    const removed = makeFileSource("removed.mod", "hash-removed");
    const previousUpdated = makeFileSource("updated.mod", "hash-old");
    const currentUpdated = makeFileSource("updated.mod", "hash-new");
    await deploy(kept, removed, previousUpdated);

    expect(
      planSorted(
        lockfile([kept, added, currentUpdated]),
        lockfile([kept, removed, previousUpdated]),
      ),
    ).toEqual([
      { kind: OperationKind.Copy, destinationSource: added },
      { kind: OperationKind.Delete, destinationSource: removed },
      { kind: OperationKind.Copy, destinationSource: currentUpdated },
    ]);
  });

  test("Only plans Copy and Delete", async () => {
    const kept = makeFileSource("kept.mod", "hash-kept");
    const added = makeFileSource("added.mod", "hash-added");
    const removed = makeFileSource("removed.mod", "hash-removed");
    await deploy(removed);

    const kinds = plan(lockfile([kept, added]), lockfile([kept, removed])).map(({ kind }) => kind);

    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) {
      expect([OperationKind.Copy, OperationKind.Delete]).toContain(kind);
    }
  });
});
