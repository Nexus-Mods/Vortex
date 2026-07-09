import type PromiseBB from "bluebird";
import type { TFunction } from "i18next";
import React from "react";

import { getSafe } from "@/util/storeHelper";

import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import GameThumbnail from "../views/GameThumbnail";

interface IGamesGridProps {
  t: TFunction;
  games: IGameStored[];
  type: string;
  gameMode: string;
  discoveredGames: { [id: string]: IDiscoveryResult };
  container: HTMLElement | null;
  getBounds: () => ClientRect;
  onRefreshGameInfo: (gameId: string) => PromiseBB<void>;
}

export const GamesGrid = ({
  t,
  games,
  type,
  gameMode,
  discoveredGames,
  container,
  getBounds,
  onRefreshGameInfo,
}: IGamesGridProps) => {
  const isDiscovered = (gameId: string) =>
    getSafe(discoveredGames, [gameId, "path"], undefined) !== undefined;

  return (
    <div className="grid-games">
      {games.map((game) => (
        <GameThumbnail
          active={game.id === gameMode}
          className="w-full!"
          container={container}
          discovered={isDiscovered(game.id)}
          game={game}
          getBounds={getBounds}
          imageClassName="rounded-md"
          key={game.id + "_" + (game.contributed ?? "official")}
          t={t}
          type={type}
          onRefreshGameInfo={onRefreshGameInfo}
        />
      ))}
    </div>
  );
};
