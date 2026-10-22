import { render } from "@testing-library/react";
import { GameId } from "@vortex/shared";
import React, { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

const spine = vi.hoisted((): { selection: SpineSelection } => ({
  selection: { type: "game", gameId: "skyrimse" },
}));
const games = vi.hoisted(() => ({ hasHero: true }));

vi.mock("../Spine/SpineContext", () => ({
  useSpineContext: () => ({ selection: spine.selection }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({}),
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
import { GameArtProvider, useGameArt } from "./GameArt.context";

/** Sets the art up from inside the provider, as the dev tools and Browse's picker do. */
const Setup = ({ isEnabled, preview }: { isEnabled: boolean; preview?: GameId }) => {
  const { setIsEnabled, setPreviewGame } = useGameArt();
  useEffect(() => {
    setIsEnabled(isEnabled);
    setPreviewGame(preview);
  }, [isEnabled, preview, setIsEnabled, setPreviewGame]);
  return null;
};

const renderArt = ({ isEnabled = true, preview }: { isEnabled?: boolean; preview?: GameId } = {}) =>
  render(
    <GameArtProvider>
      <GameArt />

      <Setup isEnabled={isEnabled} preview={preview} />
    </GameArtProvider>,
  );

const artSrc = (container: HTMLElement) =>
  container.querySelector(".nxm-game-art img")?.getAttribute("src");

describe("GameArt", () => {
  it("draws the open game's hero art", () => {
    spine.selection = { type: "game", gameId: "skyrimse" };
    games.hasHero = true;
    const { container } = renderArt();
    expect(artSrc(container)).toBe("https://images.nexusmods.com/images/games/v2/1704/hero.jpg");
  });

  it("draws nothing while it's turned off", () => {
    spine.selection = { type: "game", gameId: "skyrimse" };
    games.hasHero = true;
    const { container } = renderArt({ isEnabled: false });
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

  it("draws the preview game's art in place of the open game's", () => {
    spine.selection = { type: "game", gameId: "skyrimse" };
    games.hasHero = true;
    const { container } = renderArt({ preview: GameId(3474) });
    expect(artSrc(container)).toBe("https://images.nexusmods.com/images/games/v2/3474/hero.jpg");
  });
});
