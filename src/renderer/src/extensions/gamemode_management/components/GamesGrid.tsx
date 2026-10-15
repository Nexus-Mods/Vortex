import React from "react";

import type { IGameStored } from "../types/IGameStored";
import type { IGameSection } from "./GameCard";
import { GameCard } from "./GameCard";

interface IGamesGridProps {
  /** The store each game was detected on, by game id, for cards discovery hasn't labelled. */
  detectedStores?: Record<string, string>;
  games: IGameStored[];
  section: IGameSection;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
}

export const GamesGrid = ({
  detectedStores,
  games,
  section,
  onRefreshGameInfo,
}: IGamesGridProps) => (
  <div className="grid-games">
    {games.map((game) => (
      <GameCard
        detectedStore={detectedStores?.[game.id]}
        game={game}
        key={game.id + "_" + (game.contributed ?? "official")}
        section={section}
        onRefreshGameInfo={onRefreshGameInfo}
      />
    ))}
  </div>
);
