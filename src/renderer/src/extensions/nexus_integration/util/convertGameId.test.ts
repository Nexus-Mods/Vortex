import { describe, expect, it } from "vitest";

import type { IGameStored } from "../../gamemode_management/types/IGameStored";
import { convertGameIdReverse, downloadGameForNexusId } from "./convertGameId";

const KNOWN: IGameStored[] = [
  { id: "hollowknightsilksong", name: "Silksong" } as any,
  { id: "megastoresimulator", name: "Megastore Simulator" } as any,
  {
    id: "skyrimse",
    name: "Skyrim Special Edition",
    details: { nexusPageId: "skyrimspecialedition" },
  } as any,
];

describe("convertGameIdReverse", () => {
  it("maps a domain back to the internal id via nexusPageId", () => {
    expect(convertGameIdReverse(KNOWN, "skyrimspecialedition")).toBe("skyrimse");
  });

  it("passes an unknown domain through lower-cased", () => {
    expect(convertGameIdReverse(KNOWN, "Megastoresimulator")).toBe("megastoresimulator");
  });

  it("returns undefined for a nullish input", () => {
    expect(convertGameIdReverse(KNOWN, undefined)).toBeUndefined();
  });
});

// https://github.com/Nexus-Mods/Vortex/issues/21979 - the mod's downloadGame must
// track whatever the modId was resolved from, not the managed game and not a
// meta lookup the modId didn't come from.
describe("downloadGameForNexusId", () => {
  describe("modId came from the download's own nexus record", () => {
    it("uses that record's game id, not the md5 lookup's domain", () => {
      expect(downloadGameForNexusId(KNOWN, 7, "megastoresimulator", "hollowknightsilksong")).toBe(
        "megastoresimulator",
      );
    });

    it("resolves that game id through nexusPageId", () => {
      expect(downloadGameForNexusId(KNOWN, 7, "skyrimspecialedition", undefined)).toBe("skyrimse");
    });

    // the regression this signature exists to prevent: a collection that lists BepInEx (or a
    // config manager) as a Nexus dependency downloads the right file with the right modId, but
    // an nxm-protocol resolve stamps only modId/fileId - no gameId - and the shared archive's
    // md5 collides onto a foreign domain. Pinning downloadGame to that domain would point the
    // update check at <foreign game>/mods/<our modId> = an unrelated mod, breaking a check that
    // works today. Returning undefined leaves download_management's download.game[0] in place.
    it("returns undefined rather than the md5 domain when the record carries no game id", () => {
      expect(downloadGameForNexusId(KNOWN, 7, undefined, "megastoresimulator")).toBeUndefined();
    });
  });

  describe("modId came from the md5 meta lookup", () => {
    it("pins the game to that same lookup's domain", () => {
      expect(downloadGameForNexusId(KNOWN, undefined, undefined, "megastoresimulator")).toBe(
        "megastoresimulator",
      );
    });

    it("resolves that domain to the internal id on the way through", () => {
      expect(downloadGameForNexusId(KNOWN, undefined, undefined, "skyrimspecialedition")).toBe(
        "skyrimse",
      );
    });
  });

  it("is undefined when the file carries no nexus identity at all", () => {
    // filterModInfo's filterNullish then drops the key, leaving the
    // download_management extractor's download.game[0] value in place
    expect(downloadGameForNexusId(KNOWN, undefined, undefined, undefined)).toBeUndefined();
  });
});
