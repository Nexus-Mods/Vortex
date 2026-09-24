import { describe, expect, it, vi } from "vitest";

import type { IBulkInstallItem } from "../../views/content/types";
import { splitByAuthorNote } from "./splitByAuthorNote.util";

const item = (key: string, note?: string): IBulkInstallItem => ({
  key,
  install: vi.fn(),
  notedRequirement: note ? { modUID: `uid-${key}`, modName: key, note } : undefined,
});

describe("splitByAuthorNote", () => {
  it("separates the noted mods from the rest, keeping order", () => {
    const { noted, unnoted } = splitByAuthorNote([
      item("a"),
      item("b", "Optional"),
      item("c"),
      item("d", "Only for X"),
    ]);

    expect(noted.map((i) => i.key)).toEqual(["b", "d"]);
    expect(unnoted.map((i) => i.key)).toEqual(["a", "c"]);
  });

  it("leaves nothing to review when no author left a note", () => {
    expect(splitByAuthorNote([item("a"), item("b")]).noted).toEqual([]);
  });
});
