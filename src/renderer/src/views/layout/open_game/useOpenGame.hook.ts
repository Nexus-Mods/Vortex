import type { VortexGameId } from "@vortex/shared";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { useMainContext } from "@/contexts";
import { activeGameId, nextProfileId, profileById } from "@/util/selectors";

import type { ISelectGameOptions } from "../../components/Spine/SpineContext";

/** Where a game opens in this layout, which remembers no page per game. */
const DEFAULT_PAGE = "Mods";

/**
 * Answers "open-game" for the classic layout, as the spine does for the modern one:
 * the game is activated when it has to be, and its page shows once it is in play.
 *
 * The layout holds the wait because the profile switch takes the main layout down,
 * and whatever asked with it.
 */
export const useOpenGame = (): void => {
  const { api } = useMainContext();
  const activeGame = useSelector(activeGameId);

  // The game asked for that isn't in play yet, and the page to show once it is.
  const pendingRef = useRef<{ gameId: VortexGameId; page: string } | undefined>(undefined);

  useEffect(() => {
    const pending = pendingRef.current;
    // No game in play is a switch still under way.
    if (pending === undefined || activeGame === undefined) {
      return;
    }

    // Another game coming into play ends the wait just the same.
    pendingRef.current = undefined;
    if (pending.gameId === activeGame) {
      api.events.emit("show-main-page", pending.page);
    }
  }, [api, activeGame]);

  useEffect(() => {
    const openGame = (gameId: VortexGameId, options?: ISelectGameOptions) => {
      const state = api.getState();
      const page = options?.page ?? DEFAULT_PAGE;

      if (activeGameId(state) === gameId) {
        pendingRef.current = undefined;
        api.events.emit("show-main-page", page);
        return;
      }

      pendingRef.current = { gameId, page };

      // Whoever added the game has already started the switch to its new profile.
      const next = nextProfileId(state);
      if (next === undefined || profileById(state, next)?.gameId !== gameId) {
        api.events.emit("activate-game", gameId);
      }
    };

    api.events.on("open-game", openGame);
    return () => {
      api.events.removeListener("open-game", openGame);
    };
  }, [api]);
};
