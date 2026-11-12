import { describe, expect, test } from "vitest";

import { DiskEntryKind, type DiskEntry, type DiskScan } from "./diskScan";
import { GameStore } from "./gameInstall";
import { NexusFileId, NexusGameId, SteamAppId, SteamBuildId } from "./ids";
import { FileSourceKind, HashType, type FileSource, type Lockfile } from "./lockfile";
import {
  DestinationState,
  inApplyOrder,
  KeptReason,
  OperationKind,
  plan,
  planDestinations,
  type Operation,
} from "./plan";

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

const backupPathOf = (destinationPath: string) => `${destinationPath}.backup`;
const options = { backupPathOf };

function diskScan(...entries: DiskEntry[]): DiskScan {
  return { takenAt: Temporal.Instant.from("2026-10-21T09:00:00Z"), roots: [GAME_DIR], entries };
}

describe("plan", () => {
  test.each(["../plugin.dll", "Data/../plugin.dll", "Data//plugin.dll", "C:/plugin.dll"])(
    "rejects the destination %s",
    (name) => {
      expect(() => plan(lockfile([makeFileSource(name)]), undefined, diskScan(), options)).toThrow(
        "not a valid path under a scanned folder",
      );
    },
  );

  test("rejects a destination outside the scanned folders", () => {
    const outside = {
      ...makeFileSource("plugin.dll"),
      destinationPath: "/fixture-root/other/plugin.dll",
    };

    expect(() => plan(lockfile([outside]), undefined, diskScan(), options)).toThrow(
      "not a valid path under a scanned folder",
    );
  });

  test("rejects a lockfile that lists a destination twice", () => {
    const plugin = makeFileSource("plugin.dll");

    expect(() => plan(lockfile([plugin, plugin]), undefined, diskScan(), options)).toThrow(
      "a lockfile lists a destination twice",
    );
  });

  test("rejects a lockfile with destinations that differ only in case", () => {
    const lockfileWithCaseTwins = lockfile([
      makeFileSource("Data/Textures/sky.dds"),
      makeFileSource("Data/textures/sky.dds"),
    ]);

    expect(() => plan(lockfileWithCaseTwins, undefined, diskScan(), options)).toThrow(
      "a lockfile lists a destination twice",
    );
  });

  test("rejects a lockfile with destinations that differ only in how an accent is encoded", () => {
    const lockfileWithCompositionTwins = lockfile([
      // precomposed "é", then "e" followed by a combining acute accent
      makeFileSource("Data/Café.esp"),
      makeFileSource("Data/Café.esp"),
    ]);

    expect(() => plan(lockfileWithCompositionTwins, undefined, diskScan(), options)).toThrow(
      "a lockfile lists a destination twice",
    );
  });

  test("rejects lockfiles for different games", () => {
    expect(() => plan(lockfile([]), lockfile([], NexusGameId(1100)), diskScan(), options)).toThrow(
      "the lockfiles are for games 1100 and 1704",
    );
  });

  test.each([
    ["unsorted", ["b.esp", "a.esp"]],
    ["duplicated", ["a.esp", "a.esp"]],
  ])("rejects a disk scan with %s entries", (_, names) => {
    expect(() =>
      plan(lockfile([]), undefined, diskScan(...names.map((name) => diskEntry(name))), options),
    ).toThrow("the disk scan is not sorted by path");
  });

  test("rejects a destination that is a folder on disk", () => {
    expect(() =>
      plan(
        lockfile([makeFileSource("Data/SKSE")]),
        undefined,
        diskScan(diskEntry("Data/SKSE/plugin.dll")),
        options,
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
          options,
        ),
      ).toThrow(`${GAME_DIR}/Data/SKSE is a file or link on disk where a folder is needed`);
    },
  );

  test("rejects a lockfile with a destination inside another", () => {
    const lockfileWithNesting = lockfile([
      makeFileSource("Data/SKSE"),
      makeFileSource("Data/SKSE/plugin.dll"),
    ]);

    expect(() => plan(lockfileWithNesting, undefined, diskScan(), options)).toThrow(
      `${GAME_DIR}/Data/SKSE/plugin.dll is inside ${GAME_DIR}/Data/SKSE, another destination`,
    );
  });
});

describe("planDestinations", () => {
  test("lists every destination in order with its state, its inputs and its operations", () => {
    const kept = makeFileSource("Data/a.esp");
    const removed = makeFileSource("Data/b.esp");
    const added = makeFileSource("Data/c.esp");
    const keptOnDisk = diskEntry("Data/a.esp");

    expect(
      planDestinations(
        lockfile([kept, added]),
        lockfile([kept, removed]),
        diskScan(keptOnDisk),
        options,
      ),
    ).toEqual([
      {
        destinationPath: kept.destinationPath,
        state: DestinationState.DeployedUnhashed,
        disk: keptOnDisk,
        previous: kept,
        current: kept,
        operations: [],
      },
      {
        destinationPath: removed.destinationPath,
        state: DestinationState.RemovedMissing,
        disk: undefined,
        previous: removed,
        current: undefined,
        operations: [],
      },
      {
        destinationPath: added.destinationPath,
        state: DestinationState.NewFile,
        disk: undefined,
        previous: undefined,
        current: added,
        operations: [{ kind: OperationKind.Link, file: added, reason: DestinationState.NewFile }],
      },
    ]);
  });

  test("reports a deployed file whose content is on disk as unchanged", () => {
    const deployed = makeFileSource("Data/a.esp");
    const onDisk: DiskEntry = {
      ...diskEntry("Data/a.esp"),
      contentHash: { fileHash: deployed.fileHash, hashType: deployed.hashType },
    };

    expect(
      planDestinations(lockfile([deployed]), lockfile([deployed]), diskScan(onDisk), options),
    ).toMatchObject([{ state: DestinationState.Unchanged, operations: [] }]);
  });
});

describe("BACKUP", () => {
  const added = makeFileSource("Data/a.esp");
  const backupOfAdded = diskEntry("Data/a.esp.backup");
  const operationsFor = (current: FileSource[], previous: FileSource[], disk: DiskScan) =>
    planDestinations(lockfile(current), lockfile(previous), disk, options).flatMap(
      ({ operations }) => operations,
    );

  test("backs up a file with one link into a free backup name", () => {
    expect(operationsFor([added], [], diskScan(diskEntry("Data/a.esp")))).toEqual([
      {
        kind: OperationKind.Backup,
        destinationPath: added.destinationPath,
        reason: DestinationState.NewOverUnhashed,
      },
      { kind: OperationKind.Link, file: added, reason: DestinationState.NewOverUnhashed },
    ]);
  });

  test("sets aside a file with another hardlink, leaving the backup name free", () => {
    const linkedElsewhere = { ...diskEntry("Data/a.esp"), hardlinkCount: 2 };

    expect(operationsFor([added], [], diskScan(linkedElsewhere))).toEqual([
      {
        kind: OperationKind.Backup,
        destinationPath: added.destinationPath,
        reason: DestinationState.NewOverUnhashed,
        setAside: KeptReason.LinkedElsewhere,
      },
      { kind: OperationKind.Link, file: added, reason: DestinationState.NewOverUnhashed },
    ]);
  });

  test("sets aside a file whose backup name holds an earlier original", () => {
    expect(operationsFor([added], [], diskScan(diskEntry("Data/a.esp"), backupOfAdded))).toEqual([
      {
        kind: OperationKind.Backup,
        destinationPath: added.destinationPath,
        reason: DestinationState.NewOverUnhashed,
        setAside: KeptReason.BackupTaken,
      },
      { kind: OperationKind.Link, file: added, reason: DestinationState.NewOverUnhashed },
    ]);
  });

  test("restores the earlier original after setting aside a file no current file replaces", () => {
    const removed = makeFileSource("Data/a.esp");
    const edited: DiskEntry = {
      ...diskEntry("Data/a.esp"),
      contentHash: { fileHash: "edited-hash", hashType: HashType.Md5 },
    };

    expect(operationsFor([], [removed], diskScan(edited, backupOfAdded))).toEqual([
      {
        kind: OperationKind.Backup,
        destinationPath: removed.destinationPath,
        reason: DestinationState.RemovedEdited,
        setAside: KeptReason.BackupTaken,
      },
      {
        kind: OperationKind.Restore,
        destinationPath: removed.destinationPath,
        reason: DestinationState.RemovedEdited,
      },
    ]);
  });
});

describe("RESTORE", () => {
  const removed = makeFileSource("Data/a.esp");
  const backup = diskEntry("Data/a.esp.backup");
  const operationsFor = (current: FileSource[], disk: DiskScan) =>
    planDestinations(lockfile(current), lockfile([removed]), disk, options).flatMap(
      ({ operations }) => operations,
    );

  test("restores the original where it unlinks a removed file", () => {
    expect(operationsFor([], diskScan(diskEntry("Data/a.esp"), backup))).toEqual([
      { kind: OperationKind.Unlink, file: removed, reason: DestinationState.RemovedUnhashed },
      {
        kind: OperationKind.Restore,
        destinationPath: removed.destinationPath,
        reason: DestinationState.RemovedUnhashed,
      },
    ]);
  });

  test("leaves the original backed up where a current file needs the path as a folder", () => {
    const inside = makeFileSource("Data/a.esp/b.esp");

    expect(operationsFor([inside], diskScan(diskEntry("Data/a.esp"), backup))).toEqual([
      { kind: OperationKind.Unlink, file: removed, reason: DestinationState.RemovedUnhashed },
      { kind: OperationKind.Link, file: inside, reason: DestinationState.NewFile },
    ]);
  });

  test("leaves the original backed up where the removed file is already gone", () => {
    expect(operationsFor([], diskScan(backup))).toEqual([]);
  });
});

describe("OperationKind", () => {
  test("declares the operation kinds in the order inApplyOrder runs them", () => {
    const file = makeFileSource("plugin.dll");
    const reason = DestinationState.NewFile;
    const operationByKind: Record<Operation["kind"], Operation> = {
      [OperationKind.Backup]: {
        kind: OperationKind.Backup,
        destinationPath: file.destinationPath,
        reason,
      },
      [OperationKind.Link]: { kind: OperationKind.Link, file, reason },
      [OperationKind.Unlink]: { kind: OperationKind.Unlink, file, reason },
      [OperationKind.Restore]: {
        kind: OperationKind.Restore,
        destinationPath: file.destinationPath,
        reason,
      },
    };

    expect(inApplyOrder(Object.values(operationByKind)).map(({ kind }) => kind)).toEqual(
      Object.values(OperationKind),
    );
  });
});
