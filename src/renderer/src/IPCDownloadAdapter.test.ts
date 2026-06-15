import { describe, expect, it } from "vitest";

import type { IGameStored } from "./extensions/gamemode_management/types/IGameStored";
import { expandCompatibleGameIds } from "./IPCDownloadAdapter";

function game(id: string, compatibleDownloads?: string[]): IGameStored {
  return {
    id,
    name: id,
    requiredFiles: [],
    executable: `${id}.exe`,
    ...(compatibleDownloads !== undefined ? { details: { compatibleDownloads } } : {}),
  };
}

describe("expandCompatibleGameIds", () => {
  // Skyrim VR borrows skyrimse downloads via `details.compatibleDownloads`.
  const skyrimse = game("skyrimse");
  const skyrimvr = game("skyrimvr", ["skyrimse"]);
  const fallout4 = game("fallout4", ["fallout4london"]);
  const games = [skyrimse, skyrimvr, fallout4];

  it("appends games that declare the download's game as a compatible source", () => {
    // A skyrimse-domain download, while skyrimvr is one of the managed games,
    // must list skyrimvr so the install handler can target it (APP-506).
    expect(expandCompatibleGameIds(games, "skyrimse")).toEqual(["skyrimse", "skyrimvr"]);
  });

  it("keeps the download's own game id first for path resolution", () => {
    // download.game[0] drives the on-disk download path, so the base id must stay first.
    expect(expandCompatibleGameIds(games, "skyrimse")[0]).toBe("skyrimse");
  });

  it("returns only the game id when nothing declares it compatible", () => {
    expect(expandCompatibleGameIds(games, "fallout4")).toEqual(["fallout4"]);
  });

  it("ignores games whose details/compatibleDownloads are absent", () => {
    expect(expandCompatibleGameIds([skyrimse, game("oblivion")], "skyrimse")).toEqual(["skyrimse"]);
  });

  it("dedupes if the source game also declares itself compatible", () => {
    const selfRef = game("xcom2", ["xcom2"]);
    expect(expandCompatibleGameIds([selfRef], "xcom2")).toEqual(["xcom2"]);
  });

  it("matches multiple borrowing games", () => {
    const skyrimvrAlt = game("skyrimvr-alt", ["skyrimse"]);
    expect(expandCompatibleGameIds([...games, skyrimvrAlt], "skyrimse")).toEqual([
      "skyrimse",
      "skyrimvr",
      "skyrimvr-alt",
    ]);
  });

  it("preserves the undefined id (no managed game) as the sole entry", () => {
    expect(expandCompatibleGameIds(games, undefined)).toEqual([undefined]);
  });
});
