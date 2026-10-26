import { describe, expect, test } from "vitest";

import { DiskEntryKind, type DiskEntry, type DiskScan } from "./diskScan";
import { GameStore } from "./gameInstall";
import { NexusFileId, NexusGameId, SteamAppId, SteamBuildId } from "./ids";
import { FileSourceKind, HashType, type FileSource, type Lockfile } from "./lockfile";
import { plan } from "./plan";

const GAME_DIR = "/fixture-root/game";

function lockfile(files: FileSource[], gameId = NexusGameId(1704)): Lockfile {
  return {
    version: 1,
    gameId,
    install: {
      store: GameStore.Steam,
      appId: SteamAppId(489830),
      buildId: SteamBuildId(15218373),
      depots: [],
    },
    files,
  };
}

function makeFileSource(name: string): FileSource {
  return {
    source: FileSourceKind.Nexus,
    nexusFileId: NexusFileId("7318624307791"),
    fileHash: `${name}-hash`,
    hashType: HashType.Md5,
    destinationPath: `${GAME_DIR}/${name}`,
  };
}

function diskEntry(name: string, kind: DiskEntryKind = DiskEntryKind.File): DiskEntry {
  return {
    path: `${GAME_DIR}/${name}`,
    kind,
    size: 1024,
    modifiedTime: Temporal.Instant.from("2025-10-09T08:53:20Z"),
  };
}

function diskScan(...entries: DiskEntry[]): DiskScan {
  return { takenAt: Temporal.Instant.from("2026-10-21T09:00:00Z"), roots: [GAME_DIR], entries };
}

describe("plan", () => {
  test.each(["../plugin.dll", "Data/../plugin.dll", "Data//plugin.dll", "C:/plugin.dll"])(
    "rejects the destination %s",
    (name) => {
      expect(() => plan(lockfile([makeFileSource(name)]), undefined, diskScan())).toThrow(
        "not a valid path under a scanned folder",
      );
    },
  );

  test("rejects a destination outside the scanned folders", () => {
    const outside = {
      ...makeFileSource("plugin.dll"),
      destinationPath: "/fixture-root/other/plugin.dll",
    };

    expect(() => plan(lockfile([outside]), undefined, diskScan())).toThrow(
      "not a valid path under a scanned folder",
    );
  });

  test("rejects a lockfile that lists a destination twice", () => {
    const plugin = makeFileSource("plugin.dll");

    expect(() => plan(lockfile([plugin, plugin]), undefined, diskScan())).toThrow(
      "a lockfile lists a destination twice",
    );
  });

  test("rejects a lockfile with destinations that differ only in case", () => {
    const lockfileWithCaseTwins = lockfile([
      makeFileSource("Data/Textures/sky.dds"),
      makeFileSource("Data/textures/sky.dds"),
    ]);

    expect(() => plan(lockfileWithCaseTwins, undefined, diskScan())).toThrow(
      "a lockfile lists a destination twice",
    );
  });

  test("rejects lockfiles for different games", () => {
    expect(() => plan(lockfile([]), lockfile([], NexusGameId(1100)), diskScan())).toThrow(
      "the lockfiles are for games 1100 and 1704",
    );
  });

  test.each([
    ["unsorted", ["b.esp", "a.esp"]],
    ["duplicated", ["a.esp", "a.esp"]],
  ])("rejects a disk scan with %s entries", (_, names) => {
    expect(() =>
      plan(lockfile([]), undefined, diskScan(...names.map((name) => diskEntry(name)))),
    ).toThrow("the disk scan is not sorted by path");
  });

  test("rejects a destination that is a folder on disk", () => {
    expect(() =>
      plan(
        lockfile([makeFileSource("Data/SKSE")]),
        undefined,
        diskScan(diskEntry("Data/SKSE/plugin.dll")),
      ),
    ).toThrow(`${GAME_DIR}/Data/SKSE is a folder on disk`);
  });

  test.each([DiskEntryKind.File, DiskEntryKind.Link])(
    "rejects a destination inside a folder that is a %s on disk",
    (kind) => {
      expect(() =>
        plan(
          lockfile([makeFileSource("Data/SKSE/plugin.dll")]),
          undefined,
          diskScan(diskEntry("Data/SKSE", kind)),
        ),
      ).toThrow(`${GAME_DIR}/Data/SKSE is a file or link on disk where a folder is needed`);
    },
  );

  test("rejects a lockfile with a destination inside another", () => {
    const lockfileWithNesting = lockfile([
      makeFileSource("Data/SKSE"),
      makeFileSource("Data/SKSE/plugin.dll"),
    ]);

    expect(() => plan(lockfileWithNesting, undefined, diskScan())).toThrow(
      `${GAME_DIR}/Data/SKSE/plugin.dll is inside ${GAME_DIR}/Data/SKSE, another destination`,
    );
  });
});
