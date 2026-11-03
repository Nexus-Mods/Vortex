import {
  DestinationState,
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
  countByState,
  defaultExpandedFolders,
  filterPlan,
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

/** SkyUI's plugin and the texture still deployed, SkyUI's config gone from disk. */
const rerun = () =>
  planDestinations(
    lockfileWithTexture(),
    lockfileWithTexture(),
    makeDiskScan({ entries: [makeDiskEntry(), makeDiskEntry({ path: TEXTURE })] }),
  );

const NO_FILTER: IPlanFilter = {
  operationKinds: new Set(),
  states: new Set(),
  nexusFileId: undefined,
  pathText: "",
};

const fileName = (path: string) => QualifiedPath.fromNative(path).basename;

const rowLabel = (row: PlanRow) =>
  row.kind === PlanRowKind.Folder
    ? `${row.depth} ${row.folder.name}/`
    : `${row.depth} ${fileName(row.destination.destinationPath)}`;

describe("planTree", () => {
  test("groups destinations by folder, joining a folder that holds only one folder to it", () => {
    const root = planTree(planDestinations(makeLockfile(), undefined, makeDiskScan()));

    expect(root).toMatchObject({
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
    });
  });

  test("lists folders before files, and a folder's contents only while it is expanded", () => {
    const root = planTree(rerun());

    expect(planRows(root, defaultExpandedFolders(root)).map(rowLabel)).toEqual([
      `0 ${DATA}/`,
      "1 interface/skyui/",
      "2 config.txt",
      "1 textures/",
      "1 SkyUI_SE.esp",
    ]);
    expect(planRows(root, new Set()).map(rowLabel)).toEqual([`0 ${DATA}/`]);
  });

  test("starts with the folders that hold an operation expanded", () => {
    const root = planTree(rerun());

    expect([...defaultExpandedFolders(root)]).toEqual([DATA, `${DATA}/interface/skyui`]);
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
  ])("keeps the destinations with %s", (_, filter, expected) => {
    const destinations = rerun();
    const kept = filterPlan(destinations, planPathKeys(destinations), { ...NO_FILTER, ...filter });

    expect(kept.map(({ destinationPath }) => fileName(destinationPath))).toEqual(expected);
  });
});

test("counts destinations by state", () => {
  expect(countByState(rerun())).toEqual(
    new Map([
      [DestinationState.DeployedUnhashed, 2],
      [DestinationState.DeployedMissing, 1],
    ]),
  );
});
