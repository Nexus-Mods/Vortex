/**
 * Unit coverage for selectedOptionalRules - the pure filter that decides which optional (recommends)
 * members still need installing when the trailing optional phase runs. Kept in dependencies.ts next
 * to gatherDependencies/findModByRef; tested here without the InstallManager orchestration.
 */
import { describe, expect, it, vi } from "vitest";

import { makeDownload, makeMod, makeRule } from "../../../test-utils/builders";
import type { IMod } from "../types/IMod";
import { findDownloadByRef, lookupFromDownload, selectedOptionalRules } from "./dependencies";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));
// native module pulled in transitively via util/selectors; not exercised by these tests
vi.mock("winapi-bindings", () => ({ default: {} }));

describe("selectedOptionalRules", () => {
  it("returns only selected (non-ignored) optional members that are not yet installed", () => {
    const rules = [
      makeRule({ type: "recommends", reference: { tag: "opt-selected" } }),
      makeRule({ type: "recommends", reference: { tag: "opt-skipped" }, ignored: true }),
      makeRule({ type: "requires", reference: { tag: "req" } }),
      makeRule({ type: "recommends", reference: { tag: "opt-installed" } }),
    ];
    // an installed mod carrying the "opt-installed" reference tag - that member is already done
    const mods: Record<string, IMod> = {
      m1: makeMod({ id: "m1", attributes: { referenceTag: "opt-installed" } }),
    };

    const result = selectedOptionalRules(rules, mods);
    expect(result.map((r) => r.reference.tag)).toEqual(["opt-selected"]);
  });

  it("treats an explicit ignored:false as selected", () => {
    const rules = [makeRule({ type: "recommends", reference: { tag: "opt" }, ignored: false })];
    expect(selectedOptionalRules(rules, {}).map((r) => r.reference.tag)).toEqual(["opt"]);
  });

  it("tolerates an empty / undefined rule list", () => {
    expect(selectedOptionalRules([], {})).toEqual([]);
    expect(selectedOptionalRules(undefined as unknown as [], {})).toEqual([]);
  });
});

describe("lookupFromDownload", () => {
  it("derives lookup info from the download", () => {
    const download = makeDownload({
      fileMD5: "abc",
      localPath: "some file.zip",
      size: 1234,
      modInfo: { version: "1.2.3", name: "Some File", referenceTag: "tag-1" },
    });
    const lookup = lookupFromDownload(download);
    expect(lookup).toMatchObject({
      fileMD5: "abc",
      fileName: "some file.zip",
      fileSizeBytes: 1234,
      version: "1.2.3",
      logicalFileName: "Some File",
      referenceTag: "tag-1",
    });
  });

  it("memoizes per download object (same object -> same result, new object -> new result)", () => {
    const download = makeDownload({ fileMD5: "abc" });
    const first = lookupFromDownload(download);
    // repeated matching of the same (immutable) download must not re-allocate
    expect(lookupFromDownload(download)).toBe(first);

    // a state change produces a NEW download object, which must be re-derived
    const changed = { ...download, fileMD5: "def" };
    const second = lookupFromDownload(changed);
    expect(second).not.toBe(first);
    expect(second.fileMD5).toBe("def");
  });
});

describe("findDownloadByRef", () => {
  it("still resolves downloads by reference tag after repeated (cached) probes", () => {
    const downloads = {
      dl1: makeDownload({
        id: "dl1",
        state: "finished",
        game: ["skyrimse"],
        modInfo: { referenceTag: "tag-a" },
      }),
      dl2: makeDownload({
        id: "dl2",
        state: "finished",
        game: ["skyrimse"],
        modInfo: { referenceTag: "tag-b" },
      }),
    };
    const ref = { tag: "tag-b", gameId: "skyrimse" } as never;
    const first = findDownloadByRef(ref, downloads);
    const second = findDownloadByRef(ref, downloads);
    expect(first).toBe("dl2");
    expect(second).toBe("dl2");
  });
});
