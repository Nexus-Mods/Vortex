import { render } from "@testing-library/react";
import { GameId } from "@vortex/shared";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const spine = vi.hoisted((): { selection: SpineSelection } => ({
  selection: { type: "game", gameId: "skyrimse" },
}));
const games = vi.hoisted(() => ({ hasHero: true }));
const settings = vi.hoisted((): { showGameArt?: boolean } => ({}));

vi.mock("../Spine/SpineContext", () => ({
  useSpineContext: () => ({ selection: spine.selection }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { interface: settings } }),
}));
vi.mock("@/extensions/gamemode_management/selectors", () => ({
  gameById: (_state: unknown, gameId: string) => ({ id: gameId }),
}));
vi.mock("@/extensions/nexus_integration/util/gameImageURLs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  nexusGameIdForGame: () => (games.hasHero ? GameId(1704) : undefined),
}));

import type { SpineSelection } from "../Spine/spine_selection/spineSelection.util";
import { GameArt } from "./GameArt";

const renderArt = ({ showGameArt }: { showGameArt?: boolean } = {}) => {
  settings.showGameArt = showGameArt;
  return render(<GameArt />);
};

const artSrc = (container: HTMLElement) =>
  container.querySelector(".nxm-game-art img")?.getAttribute("src");

describe("GameArt", () => {
  it("draws the open game's hero art", () => {
    spine.selection = { type: "game", gameId: "skyrimse" };
    games.hasHero = true;
    const { container } = renderArt({ showGameArt: true });
    expect(artSrc(container)).toBe("https://images.nexusmods.com/images/games/v2/1704/hero.jpg");
  });

  it("draws the art for settings saved before the setting existed", () => {
    spine.selection = { type: "game", gameId: "skyrimse" };
    games.hasHero = true;
    const { container } = renderArt();
    expect(artSrc(container)).toBe("https://images.nexusmods.com/images/games/v2/1704/hero.jpg");
  });

  it("draws nothing while the user has it turned off", () => {
    spine.selection = { type: "game", gameId: "skyrimse" };
    games.hasHero = true;
    const { container } = renderArt({ showGameArt: false });
    expect(container.querySelector(".nxm-game-art")).toBeNull();
  });

  it("draws nothing outside a game", () => {
    spine.selection = { type: "home" };
    const { container } = renderArt();
    expect(container.querySelector(".nxm-game-art")).toBeNull();
  });

  it("draws nothing for a game with no Nexus art", () => {
    spine.selection = { type: "game", gameId: "homebrew" };
    games.hasHero = false;
    const { container } = renderArt();
    expect(container.querySelector(".nxm-game-art")).toBeNull();
  });
});
