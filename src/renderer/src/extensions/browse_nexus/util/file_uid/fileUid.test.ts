import { describe, expect, it } from "vitest";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import { fileUidOf } from "./fileUid";

const mod = { game: { id: 1704 } } as unknown as ModSummary;

describe("fileUidOf", () => {
  it("makes a file's UID from its mod's game and its id", () => {
    expect(fileUidOf(mod, 11)).toBe("7318624272395");
  });

  it("takes a file id kept as a string alike", () => {
    expect(fileUidOf(mod, "11")).toBe(fileUidOf(mod, 11));
  });
});
