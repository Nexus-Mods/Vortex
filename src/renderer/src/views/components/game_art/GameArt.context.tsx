import React, { createContext, type ReactNode, useContext, useMemo, useState } from "react";

interface IGameArtContext {
  /** Whether the game art shows at all; off until it's ready for users, on from the dev tools. */
  isEnabled: boolean;
  /** Turns the game art on or off. */
  setIsEnabled: (isEnabled: boolean) => void;
}

const GameArtContext = createContext<IGameArtContext>({
  isEnabled: false,
  setIsEnabled: () => undefined,
});

/**
 * Holds whether the game art shows, for `GameArt`, the pane it shows through, and the dev tools
 * that set it.
 */
export const GameArtProvider = ({ children }: { children: ReactNode }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const value = useMemo(() => ({ isEnabled, setIsEnabled }), [isEnabled]);

  return <GameArtContext.Provider value={value}>{children}</GameArtContext.Provider>;
};

/** Whether the game art shows, and the way to set it. */
export const useGameArt = () => useContext(GameArtContext);
