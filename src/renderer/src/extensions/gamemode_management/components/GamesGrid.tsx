import React from "react";

import type { IGameStored } from "../types/IGameStored";
import { GameCard } from "./GameCard";

interface IGamesGridProps {
  games: IGameStored[];
  /** Which set of registered actions the cards get: `managed` or `unmanaged`. */
  type: string;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
}

export const GamesGrid = ({ games, type, onRefreshGameInfo }: IGamesGridProps) => (
  <div className="grid-games">
    {games.map((game) => (
      <GameCard
        game={game}
        key={game.id + "_" + (game.contributed ?? "official")}
        type={type}
        onRefreshGameInfo={onRefreshGameInfo}
      />
    ))}
  </div>
);
