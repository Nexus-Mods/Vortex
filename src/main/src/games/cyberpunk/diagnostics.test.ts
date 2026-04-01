import { describe, expect, it } from "vitest";

import {
  buildArchiveConflictDiagnostics,
  buildArchiveParserDiagnostics,
} from "./diagnostics";

describe("cyberpunk diagnostics helpers", () => {
  it("converts hash conflicts into warning diagnostics", () => {
    const diagnostics = buildArchiveConflictDiagnostics([
      {
        hash: "0123456789abcdef",
        mappedName: "base\\gameplay\\items\\legendary.ent",
        virtualPath: "base\\gameplay\\items\\legendary.ent",
        winnerEntryId: "winner-entry",
        winnerModId: "winner-mod",
        loserEntryIds: ["loser-entry"],
        loserModIds: ["loser-mod"],
        bucket: "archive",
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        id: "cyberpunk-archive-conflict-0123456789abcdef",
        level: "warning",
        kind: "conflict",
        relatedModIds: ["winner-mod", "loser-mod"],
        archiveEntryIds: ["winner-entry", "loser-entry"],
        fixType: "guided",
      }),
    ]);
  });

  it("converts parser failures into warning diagnostics", () => {
    const diagnostics = buildArchiveParserDiagnostics([
      {
        modId: "example-mod",
        modName: "Example Mod",
        archivePath: "E:\\Games\\Cyberpunk 2077\\archive\\pc\\mod\\example.archive",
        relativePath: "archive\\pc\\mod\\example.archive",
        message: "Archive hash table is truncated",
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        id: "cyberpunk-archive-parser-example-mod-archive-pc-mod-example-archive",
        level: "warning",
        kind: "parser",
        relatedModIds: ["example-mod"],
        fixType: "guided",
      }),
    ]);
  });
});

