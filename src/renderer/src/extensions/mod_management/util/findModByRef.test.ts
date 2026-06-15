/**
 * Tests for findModByRef, focused on the install-spec consolidation: identity
 * matching answers "is this mod installed", and the optional installSpec narrows
 * that to "installed the way this rule asks for" (installer choices / file list /
 * patches). Several variants of the same mod can be installed at once, so the spec
 * has to pick the right one.
 */

import { describe, it, expect, vi } from "vitest";

import type { IMod, IModAttributes, IModReference } from "../types/IMod";
import { findModByRef } from "./findModByRef";

vi.mock("../../../util/log", () => ({
  log: vi.fn(),
}));

const createMod = (id: string, attributes: IModAttributes): IMod => ({
  id,
  state: "installed",
  type: "",
  installationPath: `mods/${id}`,
  attributes,
});

describe("findModByRef", () => {
  const sharedMD5 = "shared-identity-md5";

  // two installed variants of the same mod: same identity (md5), different patches
  const variantA = createMod("variant-a", {
    fileMD5: sharedMD5,
    fileName: "variant-a.7z",
    logicalFileName: "Shared.7z",
    version: "1.0.0",
    source: "nexus",
    game: ["skyrimse"],
    patches: { "a.esp": "hash-a" },
  });
  const variantB = createMod("variant-b", {
    fileMD5: sharedMD5,
    fileName: "variant-b.7z",
    logicalFileName: "Shared.7z",
    version: "1.0.0",
    source: "nexus",
    game: ["skyrimse"],
    patches: { "a.esp": "hash-b" },
  });

  const mods = { "variant-a": variantA, "variant-b": variantB };

  it("returns a mod matched by identity when no install spec is given", () => {
    const reference: IModReference = { fileMD5: sharedMD5 };
    expect(findModByRef(reference, mods)).toBeDefined();
  });

  it("returns the variant whose install spec matches the requested one", () => {
    const reference: IModReference = { fileMD5: sharedMD5 };

    expect(findModByRef(reference, mods, undefined, { patches: { "a.esp": "hash-b" } })).toBe(
      variantB,
    );
    expect(findModByRef(reference, mods, undefined, { patches: { "a.esp": "hash-a" } })).toBe(
      variantA,
    );
  });

  it("returns undefined when no installed variant matches the install spec", () => {
    const reference: IModReference = { fileMD5: sharedMD5 };

    expect(
      findModByRef(reference, mods, undefined, { patches: { "a.esp": "never-installed" } }),
    ).toBeUndefined();
  });

  it("falls back to identity-only matching when the install spec is empty", () => {
    // an empty spec requests no particular variant, so the first identity match wins.
    const reference: IModReference = { fileMD5: sharedMD5 };
    expect(findModByRef(reference, mods, undefined, {})).toBeDefined();
  });

  it("honours the install spec on the idHint fast-path", () => {
    // idHint points at variantA, but the spec asks for variantB. The fast-path must not
    // short-circuit to the wrong variant; it should reject the hint and find the match.
    const reference: IModReference = { fileMD5: sharedMD5, idHint: "variant-a" } as IModReference;

    expect(findModByRef(reference, mods, undefined, { patches: { "a.esp": "hash-b" } })).toBe(
      variantB,
    );
  });

  it("uses the idHint fast-path when the spec matches the hinted mod", () => {
    const reference: IModReference = { fileMD5: sharedMD5, idHint: "variant-a" } as IModReference;

    expect(findModByRef(reference, mods, undefined, { patches: { "a.esp": "hash-a" } })).toBe(
      variantA,
    );
  });

  it("honours the install spec on the md5Hint fast-path", () => {
    const reference: IModReference = { md5Hint: sharedMD5 } as IModReference;

    expect(findModByRef(reference, mods, undefined, { patches: { "a.esp": "hash-b" } })).toBe(
      variantB,
    );
  });

  it("returns undefined for an unknown reference", () => {
    expect(findModByRef({ fileMD5: "no-such-mod" }, mods)).toBeUndefined();
  });

  it("returns undefined for a nullish reference", () => {
    expect(findModByRef(undefined as unknown as IModReference, mods)).toBeUndefined();
  });
});
