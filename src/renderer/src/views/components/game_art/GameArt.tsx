import React from "react";
import { useSelector } from "react-redux";

import { gameById } from "@/extensions/gamemode_management/selectors";
import {
  heroImageURLForGameId,
  nexusGameIdForGame,
} from "@/extensions/nexus_integration/util/gameImageURLs";
import type { IState } from "@/types/IState";

import { useSpineContext } from "../Spine/SpineContext";
import { useGameArt } from "./GameArt.context";

/**
 * The open game's hero art, faded into the window's bottom left, behind the whole layout. The
 * spine and menu sit straight on it; a page shows it only where its own background lets it
 * through. Nothing while it's turned off, outside a game, or for a game with no Nexus art.
 */
export const GameArt = () => {
  const { selection } = useSpineContext();
  const { isEnabled } = useGameArt();
  const game = useSelector((state: IState) =>
    selection.type === "game" ? gameById(state, selection.gameId) : undefined,
  );

  if (!isEnabled || selection.type !== "game") {
    return null;
  }

  const gameId = game && nexusGameIdForGame(game);

  if (!gameId) {
    return null;
  }

  return (
    <div aria-hidden className="nxm-game-art">
      <img alt="" className="nxm-game-art-image" src={heroImageURLForGameId(gameId)} />
    </div>
  );
};
