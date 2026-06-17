import { describe, expect, it } from "vitest";

import { checkFileLevelRequirements } from "./checkFileLevelRequirements";
import type { CandidateRow, FileVersionDetail, ModDetail, ResolverPorts } from "./types";

// ids are numeric (BigInt-style uid strings). Roles noted in comments.
// source 1001; deps 3001-3004; groups 9001-9004; files 2001-2006; mods 4001-4004.
const candidates: CandidateRow[] = [
  // 3001: satisfied (2001 installed + enabled)
  {
    sourceFileVersionUid: "1001",
    definitionId: "3001",
    modFileId: "9001",
    fileVersionUid: "2001",
    position: "1",
    category: 1,
    modStatus: "published",
    modUid: "4001",
  },
  // 3002: owned but disabled (2002 installed, disabled)
  {
    sourceFileVersionUid: "1001",
    definitionId: "3002",
    modFileId: "9002",
    fileVersionUid: "2002",
    position: "1",
    category: 1,
    modStatus: "published",
    modUid: "4002",
  },
  // 3003: wrong version (user has 2003 of group 9003; acceptable is 2004)
  {
    sourceFileVersionUid: "1001",
    definitionId: "3003",
    modFileId: "9003",
    fileVersionUid: "2004",
    position: "2",
    category: 1,
    modStatus: "published",
    modUid: "4003",
  },
  // 3004: missing — two versions in group 9004, 2006 wins on position
  {
    sourceFileVersionUid: "1001",
    definitionId: "3004",
    modFileId: "9004",
    fileVersionUid: "2005",
    position: "1",
    category: 4,
    modStatus: "published",
    modUid: "4004",
  },
  {
    sourceFileVersionUid: "1001",
    definitionId: "3004",
    modFileId: "9004",
    fileVersionUid: "2006",
    position: "2",
    category: 1,
    modStatus: "published",
    modUid: "4004",
  },
];

const details: Record<string, FileVersionDetail> = {
  "1001": {
    fileVersionUid: "1001",
    modUid: "4000",
    modFileId: "9000",
    name: "Source",
    version: "1.0",
  },
  "2001": {
    fileVersionUid: "2001",
    modUid: "4001",
    modFileId: "9001",
    name: "A file",
    version: "1.0",
  },
  "2002": {
    fileVersionUid: "2002",
    modUid: "4002",
    modFileId: "9002",
    name: "B file",
    version: "1.0",
  },
  "2003": {
    fileVersionUid: "2003",
    modUid: "4003",
    modFileId: "9003",
    name: "C file (old)",
    version: "0.9",
  },
  "2004": {
    fileVersionUid: "2004",
    modUid: "4003",
    modFileId: "9003",
    name: "C file",
    version: "2.0",
  },
  "2006": {
    fileVersionUid: "2006",
    modUid: "4004",
    modFileId: "9004",
    name: "D file",
    version: "2.0",
  },
};

const mods: Record<string, ModDetail> = {
  "4003": {
    modUid: "4003",
    name: "Mod C",
    summary: "c",
    thumbnailUrl: "img/c",
    adultContent: true,
  },
  "4004": {
    modUid: "4004",
    name: "Mod D",
    summary: "d",
    thumbnailUrl: "img/d",
    adultContent: false,
  },
};

const ports: ResolverPorts = {
  fetchCandidates: async () => candidates,
  fetchFileVersionDetails: async (uids) =>
    uids.map((u) => details[u]).filter((d): d is FileVersionDetail => d !== undefined),
  fetchModDetails: async (uids) =>
    uids.map((u) => mods[u]).filter((m): m is ModDetail => m !== undefined),
};

describe("checkFileLevelRequirements", () => {
  it("classifies satisfied / disabled / wrong-version / missing and recommends only when unowned", async () => {
    const report = await checkFileLevelRequirements({
      ports,
      installedFiles: [
        { fileVersionUid: "1001", enabled: true },
        { fileVersionUid: "2001", enabled: true },
        { fileVersionUid: "2002", enabled: false },
        { fileVersionUid: "2003", enabled: true },
      ],
    });

    expect(report.sources).toHaveLength(1);
    const source = report.sources[0]!;
    const dep = (id: string) => {
      const d = source.dependencies.find((x) => x.definitionId === id);
      if (!d) throw new Error(`missing dependency ${id}`);
      return d;
    };

    expect(dep("3001")).toMatchObject({ satisfyingEnabled: ["2001"], recommended: [] });
    expect(dep("3002")).toMatchObject({ satisfyingDisabled: ["2002"], recommended: [] });

    expect(dep("3003").wrongEnabled).toEqual(["2003"]);
    expect(dep("3003").recommended).toMatchObject([
      { fileVersionUid: "2004", fileName: "C file", modName: "Mod C", adultContent: true },
    ]);

    expect(dep("3004")).toMatchObject({
      satisfyingEnabled: [],
      satisfyingDisabled: [],
      wrongEnabled: [],
      wrongDisabled: [],
    });
    expect(dep("3004").recommended).toMatchObject([
      { fileVersionUid: "2006", fileName: "D file", version: "2.0", modName: "Mod D" },
    ]);
  });
});
