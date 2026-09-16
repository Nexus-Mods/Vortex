import { describe, expect, it } from "vitest";

import metaLookupMatch from "./metaLookupMatch";

// Characterization test for the md5-lookup match ladder, kept because it is the
// root of https://github.com/Nexus-Mods/Vortex/issues/21979: a game-agnostic md5
// lookup can return a record for a byte-identical file some other author
// re-uploaded to Nexus for a different game, and step 3 below hands that foreign
// record back with no corroboration. This locks the current behaviour in so any
// future hardening of the fallback shows up as a diff here.

const result = (value: any) => ({ key: value.sourceURI ?? "k", value }) as any;

describe("metaLookupMatch", () => {
  it("step 1: prefers the entry whose fileName matches the archive on disk", () => {
    const match = metaLookupMatch(
      [
        result({ fileName: "OtherMod.zip", gameId: "skyrimse", sourceURI: "a" }),
        result({ fileName: "BepInEx.zip", gameId: "valheim", sourceURI: "b" }),
      ],
      "BepInEx.zip",
      "skyrimse",
    );

    expect(match.value.sourceURI).toBe("b");
  });

  it("step 2: with no filename match, prefers the entry intended for the managed game", () => {
    const match = metaLookupMatch(
      [
        result({ fileName: "renamed-by-user.zip", gameId: "valheim", sourceURI: "a" }),
        result({ fileName: "also-renamed.zip", gameId: "skyrimse", sourceURI: "b" }),
      ],
      "BepInEx.zip",
      "skyrimse",
    );

    expect(match.value.sourceURI).toBe("b");
  });

  it("step 3: with neither, blindly returns the first surviving entry (#21979 fallback)", () => {
    const match = metaLookupMatch(
      [
        result({ fileName: "x.zip", gameId: "megastoresimulator", sourceURI: "foreign" }),
        result({ fileName: "y.zip", gameId: "lethalcompany", sourceURI: "also-foreign" }),
      ],
      "ConfigurationManager.zip",
      "hollowknightsilksong",
    );

    // no filename or game corroboration exists, yet a match is still returned
    expect(match.value.sourceURI).toBe("foreign");
  });

  it("drops revoked and unpublished entries before matching", () => {
    const match = metaLookupMatch(
      [
        result({
          fileName: "BepInEx.zip",
          gameId: "skyrimse",
          sourceURI: "revoked",
          status: "revoked",
        }),
        result({ fileName: "BepInEx.zip", gameId: "skyrimse", sourceURI: "live" }),
      ],
      "BepInEx.zip",
      "skyrimse",
    );

    expect(match.value.sourceURI).toBe("live");
  });

  it("returns undefined when every entry is revoked or unpublished", () => {
    const match = metaLookupMatch(
      [
        result({ fileName: "a.zip", sourceURI: "a", status: "revoked" }),
        result({ fileName: "b.zip", sourceURI: "b", status: "unpublished" }),
      ],
      "a.zip",
      "skyrimse",
    );

    expect(match).toBeUndefined();
  });

  it("returns undefined for an empty lookup result", () => {
    expect(metaLookupMatch([], "a.zip", "skyrimse")).toBeUndefined();
  });
});
