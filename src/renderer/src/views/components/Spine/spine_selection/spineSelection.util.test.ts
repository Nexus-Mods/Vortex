import { describe, expect, it } from "vitest";

import { deriveSpineSelection, type SpineSelection } from "./spineSelection.util";

const pageGroups = new Map([
  ["Dashboard", "dashboard"],
  ["application_settings", "global"],
  ["Mods", "per-game"],
  ["Downloads", "global"],
  ["about", "hidden"],
] as const);

const HOME: SpineSelection = { type: "home" };
const DOWNLOADS: SpineSelection = { type: "downloads" };
const game = (gameId: string): SpineSelection => ({ type: "game", gameId });

const derive = (
  mainPage: string,
  activeGameId: string | undefined,
  previous: SpineSelection | undefined,
) => deriveSpineSelection({ mainPage, pageGroups, activeGameId, previous });

describe("deriveSpineSelection", () => {
  it.each([
    [
      "a just-mounted spine starts in the active game, whatever is open",
      "Dashboard",
      "skyrim",
      undefined,
      game("skyrim"),
    ],
    [
      "a just-mounted spine starts at Home without an active game",
      "Mods",
      undefined,
      undefined,
      HOME,
    ],
    ["a per-game page selects the active game", "Mods", "skyrim", HOME, game("skyrim")],
    ["a per-game page selects Home without an active game", "Mods", undefined, HOME, HOME],
    ["the downloads page selects Downloads", "Downloads", "skyrim", game("skyrim"), DOWNLOADS],
    [
      "a global page selects Home, even with a game active",
      "application_settings",
      "skyrim",
      game("skyrim"),
      HOME,
    ],
    ["a dashboard page selects Home", "Dashboard", "skyrim", DOWNLOADS, HOME],
    ["a hidden page keeps Home", "about", "skyrim", HOME, HOME],
    ["a hidden page keeps Downloads", "about", "skyrim", DOWNLOADS, DOWNLOADS],
    [
      "a hidden page follows the active game while in one",
      "about",
      "stardew",
      game("skyrim"),
      game("stardew"),
    ],
    ["an unknown page keeps the selection", "not-registered", "skyrim", HOME, HOME],
    ["no open page keeps the selection", "", "skyrim", DOWNLOADS, DOWNLOADS],
  ])("%s", (_name, mainPage, activeGameId, previous, expected) => {
    expect(derive(mainPage, activeGameId, previous)).toEqual(expected);
  });

  it("hands back the previous selection itself when nothing changed", () => {
    const previous = game("skyrim");

    expect(derive("Mods", "skyrim", previous)).toBe(previous);
  });

  it("hands back a new selection when the active game changed", () => {
    const previous = game("skyrim");

    expect(derive("Mods", "stardew", previous)).not.toBe(previous);
  });
});
