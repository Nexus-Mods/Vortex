import type { GameId } from "@vortex/shared";
import React, { createContext, type ReactNode, useContext, useMemo, useState } from "react";

interface IGameArtContext {
  /** Whether the game art shows at all; off until it's ready for users, on from the dev tools. */
  isEnabled: boolean;
  /** Turns the game art on or off. */
  setIsEnabled: (isEnabled: boolean) => void;
  /** A game whose art stands in for the open game's, so design can try it over each. */
  previewGame: GameId | undefined;
  /** Stands another game's art in, or with `undefined` goes back to the open game's. */
  setPreviewGame: (gameId: GameId | undefined) => void;
}

const GameArtContext = createContext<IGameArtContext>({
  isEnabled: false,
  setIsEnabled: () => undefined,
  previewGame: undefined,
  setPreviewGame: () => undefined,
});

/**
 * Holds whether the game art shows and its preview game, for `GameArt`, the pane it shows
 * through, and the dev tools and pages that set them.
 */
export const GameArtProvider = ({ children }: { children: ReactNode }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [previewGame, setPreviewGame] = useState<GameId>();
  const value = useMemo(
    () => ({ isEnabled, setIsEnabled, previewGame, setPreviewGame }),
    [isEnabled, previewGame],
  );

  return <GameArtContext.Provider value={value}>{children}</GameArtContext.Provider>;
};

/** Whether the game art shows, its preview game, and the ways to set them. */
export const useGameArt = () => useContext(GameArtContext);
