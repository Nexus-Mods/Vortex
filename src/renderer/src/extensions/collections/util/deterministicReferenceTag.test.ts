import { describe, expect, test } from "vitest";

import {
  makeExactRef,
  makeFuzzyRef,
  makePatches,
  makeReference,
} from "../../../test-utils/builders";
import type { IModInstallSpec } from "../../mod_management/types/IMod";
import { deterministicReferenceTag } from "./deterministicReferenceTag";

describe("deterministicReferenceTag", () => {
  test("is stable for the same file identity and install spec", () => {
    // the core property: same inputs -> same tag, every time (no random shortid drift)
    expect(deterministicReferenceTag(makeExactRef())).toBe(
      deterministicReferenceTag(makeExactRef()),
    );
  });

  test("ignores the reference's existing tag (derived from file identity, not the old tag)", () => {
    // a re-installed mod that lost / changed its stamped tag still resolves to the same identity
    expect(deterministicReferenceTag(makeExactRef({ tag: "random-1" }))).toBe(
      deterministicReferenceTag(makeExactRef({ tag: "random-2" })),
    );
  });

  test("for an exact rule, the identity is fileMD5 and repo modId / fileId are ignored", () => {
    // an exact rule pins a file, so its identity is the content hash; two exact references with
    // different repo ids but the same fileMD5 resolve to the same tag
    const a = makeExactRef({
      repo: { repository: "nexus", gameId: "skyrimse", modId: "100", fileId: "5" },
    });
    const b = makeExactRef({
      repo: { repository: "nexus", gameId: "skyrimse", modId: "999", fileId: "7" },
    });
    expect(deterministicReferenceTag(a)).toBe(deterministicReferenceTag(b));
  });

  test("differs when the file hash (fileMD5) differs", () => {
    expect(deterministicReferenceTag(makeExactRef({ fileMD5: "abc123" }))).not.toBe(
      deterministicReferenceTag(makeExactRef({ fileMD5: "def456" })),
    );
  });

  test("differs when the install spec differs (same file, different patches)", () => {
    const specA: IModInstallSpec = { patches: makePatches() };
    const specB: IModInstallSpec = {
      patches: makePatches({ "meshes/other.nif": "cafebabecafebabe" }),
    };
    expect(deterministicReferenceTag(makeExactRef(), specA)).not.toBe(
      deterministicReferenceTag(makeExactRef(), specB),
    );
  });

  test("is independent of key order within the install spec (canonical serialization)", () => {
    const a: IModInstallSpec = { patches: { "a.nif": "1", "b.nif": "2" } };
    const b: IModInstallSpec = { patches: { "b.nif": "2", "a.nif": "1" } };
    expect(deterministicReferenceTag(makeExactRef(), a)).toBe(
      deterministicReferenceTag(makeExactRef(), b),
    );
  });

  test("derives a stable, distinct tag for a bundle (no repo, content-hash fileMD5)", () => {
    // bundles carry no repo; authoring sets fileMD5 to the bundled file's content hash so the tag
    // is still deterministic and recomputable from the extracted file
    const bundleA = makeReference({ fileMD5: "bundle-content-a" });
    const bundleB = makeReference({ fileMD5: "bundle-content-b" });
    expect(deterministicReferenceTag(bundleA)).toBe(
      deterministicReferenceTag(makeReference({ fileMD5: "bundle-content-a" })),
    );
    expect(deterministicReferenceTag(bundleA)).not.toBe(deterministicReferenceTag(bundleB));
  });

  test("treats an empty install spec ({} / []) the same as an absent one", () => {
    // some collections export empty objects/arrays for choices/patches/hashes where others omit
    // them; both must hash identically or the same effective spec would drift to a different tag
    const empty: IModInstallSpec = { patches: {}, fileList: [] };
    expect(deterministicReferenceTag(makeExactRef(), empty)).toBe(
      deterministicReferenceTag(makeExactRef()),
    );
  });

  test("still yields a unique tag per file when the install spec is empty", () => {
    // with an empty spec the tag falls back to fileMD5, which must still distinguish members
    const empty: IModInstallSpec = { patches: {}, fileList: [] };
    expect(deterministicReferenceTag(makeExactRef({ fileMD5: "file-x" }), empty)).not.toBe(
      deterministicReferenceTag(makeExactRef({ fileMD5: "file-y" }), empty),
    );
  });

  test("for a prefers/latest rule, the identity is repo.modId, not the (varying) fileMD5", () => {
    // a fuzzy rule resolves to whatever version is newest/preferred, so its fileMD5 changes between
    // versions; two fuzzy refs with the same mod page but different fileMD5 must yield the SAME tag
    expect(deterministicReferenceTag(makeFuzzyRef({ fileMD5: "v1-md5" }))).toBe(
      deterministicReferenceTag(makeFuzzyRef({ fileMD5: "v2-md5" })),
    );
  });

  test("for a prefers/latest rule, differs when the mod page (repo.modId) differs", () => {
    const modA = makeFuzzyRef({
      repo: { repository: "nexus", gameId: "skyrimse", modId: "100", fileId: "5" },
    });
    const modB = makeFuzzyRef({
      repo: { repository: "nexus", gameId: "skyrimse", modId: "200", fileId: "5" },
    });
    expect(deterministicReferenceTag(modA)).not.toBe(deterministicReferenceTag(modB));
  });

  test("for a prefers/latest rule, the same modId on a different repository or game does not collide", () => {
    // modId is only unique within a repository+game, so the full repo triple is the identity
    const nexus = makeFuzzyRef({
      repo: { repository: "nexus", gameId: "skyrimse", modId: "100", fileId: "5" },
    });
    const otherRepo = makeFuzzyRef({
      repo: { repository: "other", gameId: "skyrimse", modId: "100", fileId: "5" },
    });
    const otherGame = makeFuzzyRef({
      repo: { repository: "nexus", gameId: "fallout4", modId: "100", fileId: "5" },
    });
    expect(deterministicReferenceTag(nexus)).not.toBe(deterministicReferenceTag(otherRepo));
    expect(deterministicReferenceTag(nexus)).not.toBe(deterministicReferenceTag(otherGame));
  });

  test("an exact and a fuzzy rule sharing an identity value do not collide", () => {
    // exact hashes fileMD5, fuzzy hashes modId; the scheme is part of the hash so a coincidental
    // shared string value can't produce the same tag
    const exact = makeExactRef({
      fileMD5: "shared",
      repo: { repository: "nexus", gameId: "skyrimse", modId: "shared", fileId: "5" },
    });
    const fuzzy = makeFuzzyRef({
      fileMD5: "shared",
      repo: { repository: "nexus", gameId: "skyrimse", modId: "shared", fileId: "5" },
    });
    expect(deterministicReferenceTag(exact)).not.toBe(deterministicReferenceTag(fuzzy));
  });

  test("returns undefined when the relevant identity is absent", () => {
    // exact rule with no fileMD5, and a fuzzy rule with no repo.modId - nothing stable to hash
    expect(deterministicReferenceTag(makeReference())).toBeUndefined();
    expect(deterministicReferenceTag(makeFuzzyRef({ repo: undefined }))).toBeUndefined();
  });
});
