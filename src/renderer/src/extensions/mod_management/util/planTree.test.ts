import {
  DestinationState,
  HashType,
  NexusFileId,
  OperationKind,
  planDestinations,
} from "@nexusmods/mod-pipeline";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { describe, expect, test } from "vitest";

import {
  makeDiskEntry,
  makeDiskScan,
  makeLockfile,
  makeNexusFileSource,
} from "@/test-utils/lockfileBuilders";

import {
  allFolderPaths,
  countByState,
  defaultExpandedFolders,
  destinationStateName,
  diskEntryLines,
  filterPlan,
  nexusFileLabel,
  NO_PLAN_FILTER,
  planPathKeys,
  planRows,
  planTree,
  PlanRowKind,
  type IPlanFilter,
  type PlanRow,
} from "./planTree";

const DATA = "/fixture-root/game/Data";
const TEXTURE = `${DATA}/textures/sky.dds`;

const lockfileWithTexture = () => {
  const lockfile = makeLockfile();
  return makeLockfile({
    files: [
      ...lockfile.files,
      makeNexusFileSource({
        nexusFileId: NexusFileId("7318624307999"),
        fileHash: "sky-texture-hash",
        destinationPath: TEXTURE,
      }),
    ],
  });
};

const planOptions = { backupPathOf: (destinationPath: string) => `${destinationPath}.backup` };

/** SkyUI's plugin and the texture still deployed, SkyUI's config gone from disk. */
const rerun = () =>
  planDestinations(
    lockfileWithTexture(),
    lockfileWithTexture(),
    makeDiskScan({ entries: [makeDiskEntry(), makeDiskEntry({ path: TEXTURE })] }),
    planOptions,
  );

const fileName = (path: string) => QualifiedPath.fromNative(path).basename;

const rowLabel = (row: PlanRow) =>
  row.kind === PlanRowKind.Folder
    ? `${row.depth} ${row.folder.name}/`
    : `${row.depth} ${fileName(row.destination.destinationPath)}`;

describe("planTree", () => {
  test("groups destinations by folder, joining a folder that holds only one folder to it", () => {
    const topFolders = planTree(
      planDestinations(makeLockfile(), undefined, makeDiskScan(), planOptions),
    );

    expect(topFolders).toMatchObject([
      {
        path: DATA,
        name: DATA,
        fileCount: 2,
        operationCounts: {
          [OperationKind.Backup]: 0,
          [OperationKind.Link]: 2,
          [OperationKind.Unlink]: 0,
        },
        files: [{ destinationPath: `${DATA}/SkyUI_SE.esp` }],
        folders: [
          {
            path: `${DATA}/interface/skyui`,
            name: "interface/skyui",
            files: [{ destinationPath: `${DATA}/interface/skyui/config.txt` }],
          },
        ],
      },
    ]);
  });

  test("lists folders before files, and a folder's contents only while it is expanded", () => {
    const topFolders = planTree(rerun());

    expect(planRows(topFolders, defaultExpandedFolders(topFolders)).map(rowLabel)).toEqual([
      `0 ${DATA}/`,
      "1 interface/skyui/",
      "2 config.txt",
      "1 textures/",
      "1 SkyUI_SE.esp",
    ]);
    expect(planRows(topFolders, new Set()).map(rowLabel)).toEqual([`0 ${DATA}/`]);
  });

  test("starts with the folders that hold an operation expanded", () => {
    const topFolders = planTree(rerun());

    expect([...defaultExpandedFolders(topFolders)]).toEqual([DATA, `${DATA}/interface/skyui`]);
  });

  test("expands every folder of a tree on request, so a filtered tree shows its matches", () => {
    const topFolders = planTree(rerun());

    expect([...allFolderPaths(topFolders)]).toEqual([
      DATA,
      `${DATA}/interface/skyui`,
      `${DATA}/textures`,
    ]);
  });

  test("rejects a destination that sits in no folder", () => {
    const [destination] = rerun();

    expect(() => planTree([{ ...destination, destinationPath: "/plugins.txt" }])).toThrow(
      "/plugins.txt is not in a folder",
    );
  });

  test("lists no rows for a plan with no destinations", () => {
    const topFolders = planTree([]);

    expect(planRows(topFolders, defaultExpandedFolders(topFolders))).toEqual([]);
  });

  test("lists the folders of each drive by their full path when destinations span drives", () => {
    const appData = "C:/Users/me/AppData/Local/Skyrim Special Edition";
    const gameData = "D:/Steam/Skyrim Special Edition/Data";
    const lockfile = makeLockfile({
      files: [
        makeNexusFileSource({ destinationPath: `${appData}/plugins.txt` }),
        makeNexusFileSource({ destinationPath: `${gameData}/SkyUI_SE.esp` }),
      ],
    });
    const topFolders = planTree(
      planDestinations(
        lockfile,
        lockfile,
        makeDiskScan({
          roots: [appData, "D:/Steam/Skyrim Special Edition"],
          entries: [
            makeDiskEntry({ path: `${appData}/plugins.txt` }),
            makeDiskEntry({ path: `${gameData}/SkyUI_SE.esp` }),
          ],
        }),
        planOptions,
      ),
    );

    expect(planRows(topFolders, defaultExpandedFolders(topFolders)).map(rowLabel)).toEqual([
      `0 ${appData}/`,
      `0 ${gameData}/`,
    ]);
  });
});

describe("filterPlan", () => {
  test.each<[string, Partial<IPlanFilter>, string[]]>([
    ["an operation", { operationKinds: new Set([OperationKind.Link]) }, ["config.txt"]],
    [
      "a state",
      { states: new Set([DestinationState.DeployedUnhashed]) },
      ["SkyUI_SE.esp", "sky.dds"],
    ],
    ["a mod's Nexus file", { nexusFileId: NexusFileId("7318624307999") }, ["sky.dds"]],
    ["a path, ignoring case", { pathText: "SKYUI" }, ["config.txt", "SkyUI_SE.esp"]],
    ["a path typed with backslashes", { pathText: "interface\\skyui" }, ["config.txt"]],
  ])("keeps the destinations with %s", (_, filter, expected) => {
    const destinations = rerun();
    const kept = filterPlan(destinations, planPathKeys(destinations), {
      ...NO_PLAN_FILTER,
      ...filter,
    });

    expect(kept.map(({ destinationPath }) => fileName(destinationPath))).toEqual(expected);
  });
});

test("describes a disk entry's file id without a device id it doesn't have", () => {
  expect(
    diskEntryLines(
      makeDiskEntry({
        size: 2048,
        id: 13n,
        contentHash: { fileHash: "abc", hashType: HashType.Md5 },
      }),
    ),
  ).toEqual([
    `file, 2 KB, modified ${Temporal.Instant.from("2025-10-09T08:53:20Z").toLocaleString()}`,
    "md5 abc",
    "file id 13",
  ]);
});

test("clips a long mod name in the middle, keeping its Nexus file whole", () => {
  const nexusFileId = NexusFileId("7318624808494");
  const modNames = new Map([[nexusFileId, `Daedric Shrines ${"x".repeat(200)} FIXES`]]);

  expect(nexusFileLabel(nexusFileId, modNames, 20)).toBe(
    "Daedric ...xxx FIXES (Nexus file 7318624808494)",
  );
});

test("counts destinations by state", () => {
  expect(countByState(rerun())).toEqual(
    new Map([
      [DestinationState.DeployedUnhashed, 2],
      [DestinationState.DeployedMissing, 1],
    ]),
  );
});

describe("destinationStateName", () => {
  test("names a state by its name in the planner's table", () => {
    expect(destinationStateName(DestinationState.DeployedUnhashed)).toBe("DeployedUnhashed");
  });
});
